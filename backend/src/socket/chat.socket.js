const complaintModel = require('../models/complaint.model');
const chatModel = require('../models/chat.model');
const { verifyAccessToken } = require('../config/jwt');
const { encryptFields, decryptFields } = require('../services/encryption.service');
const {
  CHAT_CONTROL_TYPES,
  buildControlMessage,
  buildThreadStateFromMessages,
  resolveChatState,
  toSenderType,
  toVisibleMessages,
} = require('../services/chat.service');
const { canAccessChat } = require('../services/caseAccess.service');

function isHrRole(role) {
  return ['hr', 'committee', 'admin'].includes(role);
}

function toSocketUser(payload) {
  return {
    id: payload.sub,
    role: payload.role,
    alias: payload.alias,
    userType: payload.userType || (payload.role === 'reporter' ? 'anon' : 'hr'),
  };
}

function getTokenFromSocket(socket) {
  const authToken = socket.handshake.auth?.token;
  if (authToken) return authToken;

  const header = socket.handshake.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme === 'Bearer' && token) return token;

  return null;
}

async function loadThreadContext(complaintCode, user) {
  const complaint = await complaintModel.findByReference(complaintCode);
  if (!complaint) {
    throw new Error('Complaint not found');
  }
  if (!canAccessChat(complaint, user)) {
    throw new Error('You do not have access to chat for this case');
  }

  const rawMessages = await chatModel.listMessages(complaint.complaint_code, user);
  const decryptedMessages = rawMessages.map((item) => decryptFields(item, ['message']));
  const threadState = buildThreadStateFromMessages(decryptedMessages);
  const visibleMessages = toVisibleMessages(decryptedMessages);

  return {
    complaint,
    threadState,
    visibleMessages,
    decryptedMessages,
  };
}

function buildRoomName(complaintCode) {
  return `complaint:${complaintCode}`;
}

function initChatSocket(io) {
  io.use((socket, next) => {
    try {
      const token = getTokenFromSocket(socket);
      if (!token) return next(new Error('Unauthorized'));

      const payload = verifyAccessToken(token);
      socket.user = toSocketUser(payload);
      return next();
    } catch {
      return next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    socket.on('chat:join', async ({ complaintCode }, ack) => {
      try {
        const normalizedCode = String(complaintCode || '').trim();
        if (!normalizedCode) throw new Error('complaintCode is required');

        const context = await loadThreadContext(normalizedCode, socket.user);
        const room = buildRoomName(context.complaint.complaint_code);

        socket.join(room);

        const payload = {
          complaint_code: context.complaint.complaint_code,
          complaint_status: context.complaint.status,
          thread: {
            complaint_id: context.complaint.id,
            complaint_code: context.complaint.complaint_code,
            complaint_status: context.complaint.status,
            chat_state: context.threadState.chat_state,
            request_message: context.threadState.request_message,
            requested_at: context.threadState.requested_at,
            accepted_at: context.threadState.accepted_at,
            seen: context.threadState.seen,
          },
          messages: context.visibleMessages,
        };

        if (typeof ack === 'function') ack({ ok: true, data: payload });
        socket.emit('chat:joined', payload);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to join thread';
        if (typeof ack === 'function') ack({ ok: false, message });
        socket.emit('chat:error', { message });
      }
    });

    socket.on('chat:leave', ({ complaintCode }) => {
      const normalizedCode = String(complaintCode || '').trim();
      if (!normalizedCode) return;
      socket.leave(buildRoomName(normalizedCode));
    });

    socket.on('chat:initiate_request', async ({ complaintCode, message }, ack) => {
      try {
        if (!isHrRole(socket.user.role)) throw new Error('Only HR users can initiate chat requests');

        const normalizedCode = String(complaintCode || '').trim();
        const requestText = String(message || '').trim();
        if (!normalizedCode) throw new Error('complaintCode is required');
        if (!requestText) throw new Error('message is required');
        if (requestText.length > 2000) throw new Error('message too long');

        const complaint = await complaintModel.findByReferenceForUser(normalizedCode, socket.user);
        if (!complaint) throw new Error('Complaint not found');

        const encrypted = encryptFields(
          { message: buildControlMessage(CHAT_CONTROL_TYPES.REQUEST, { text: requestText }) },
          ['message']
        );

        await chatModel.createMessage({
          complaint_id: complaint.id,
          sender_type: 'hr',
          message: encrypted.message,
        });

        const context = await loadThreadContext(complaint.complaint_code, socket.user);
        const room = buildRoomName(complaint.complaint_code);
        const threadPayload = {
          complaint_code: complaint.complaint_code,
          complaint_status: complaint.status,
          chat_state: context.threadState.chat_state,
          request_message: context.threadState.request_message,
          requested_at: context.threadState.requested_at,
          accepted_at: context.threadState.accepted_at,
          seen: context.threadState.seen,
        };

        io.to(room).emit('chat:thread_state', threadPayload);
        if (typeof ack === 'function') ack({ ok: true, data: threadPayload });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to initiate chat request';
        if (typeof ack === 'function') ack({ ok: false, message });
        socket.emit('chat:error', { message });
      }
    });

    socket.on('chat:accept_request', async ({ complaintCode }, ack) => {
      try {
        if (socket.user.role !== 'reporter') {
          throw new Error('Only anonymous users can accept chat requests');
        }

        const normalizedCode = String(complaintCode || '').trim();
        if (!normalizedCode) throw new Error('complaintCode is required');

        const complaint = await complaintModel.findByReferenceForUser(normalizedCode, socket.user);
        if (!complaint) throw new Error('Complaint not found');

        const contextBefore = await loadThreadContext(complaint.complaint_code, socket.user);
        if (contextBefore.threadState.chat_state === 'not_requested') {
          throw new Error('No pending HR chat request for this complaint');
        }

        if (contextBefore.threadState.chat_state !== 'active') {
          const encrypted = encryptFields(
            { message: buildControlMessage(CHAT_CONTROL_TYPES.ACCEPTED) },
            ['message']
          );

          await chatModel.createMessage({
            complaint_id: complaint.id,
            sender_type: 'user',
            message: encrypted.message,
          });
        }

        const context = await loadThreadContext(complaint.complaint_code, socket.user);
        const room = buildRoomName(complaint.complaint_code);
        const threadPayload = {
          complaint_code: complaint.complaint_code,
          complaint_status: complaint.status,
          chat_state: context.threadState.chat_state,
          request_message: context.threadState.request_message,
          requested_at: context.threadState.requested_at,
          accepted_at: context.threadState.accepted_at,
          seen: context.threadState.seen,
        };

        io.to(room).emit('chat:thread_state', threadPayload);
        if (typeof ack === 'function') ack({ ok: true, data: threadPayload });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to accept chat request';
        if (typeof ack === 'function') ack({ ok: false, message });
        socket.emit('chat:error', { message });
      }
    });

    socket.on('chat:send', async ({ complaintCode, message }, ack) => {
      try {
        const normalizedCode = String(complaintCode || '').trim();
        const text = String(message || '').trim();
        if (!normalizedCode) throw new Error('complaintCode is required');
        if (!text) throw new Error('message is required');
        if (text.length > 2000) throw new Error('message too long');

        const complaint = await complaintModel.findByReferenceForUser(normalizedCode, socket.user);
        if (!complaint) throw new Error('Complaint not found');

        const context = await loadThreadContext(complaint.complaint_code, socket.user);
        const state = resolveChatState(context.decryptedMessages);
        if (state.chatState !== 'active') {
          throw new Error('Chat is not active. HR request must be accepted first');
        }

        const encrypted = encryptFields({ message: text }, ['message']);
        const created = await chatModel.createMessage({
          complaint_id: complaint.id,
          sender_type: toSenderType(socket.user.role),
          message: encrypted.message,
        });
        const visibleMessage = decryptFields(created, ['message']);
        const room = buildRoomName(complaint.complaint_code);
        const payload = {
          complaint_code: complaint.complaint_code,
          message: {
            id: visibleMessage.id,
            sender_type: visibleMessage.sender_type,
            message: visibleMessage.message,
            created_at: visibleMessage.created_at,
          },
        };

        io.to(room).emit('chat:message', payload);
        if (typeof ack === 'function') ack({ ok: true, data: payload });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to send message';
        if (typeof ack === 'function') ack({ ok: false, message });
        socket.emit('chat:error', { message });
      }
    });

    socket.on('chat:typing', async ({ complaintCode, isTyping }) => {
      try {
        const normalizedCode = String(complaintCode || '').trim();
        if (!normalizedCode) return;

        const complaint = await complaintModel.findByReferenceForUser(normalizedCode, socket.user);
        if (!complaint) return;

        const room = buildRoomName(complaint.complaint_code);
        socket.to(room).emit('chat:typing', {
          complaint_code: complaint.complaint_code,
          by: toSenderType(socket.user.role),
          is_typing: Boolean(isTyping),
        });
      } catch {
        // Ignore typing errors because this is non-critical transient state.
      }
    });

    socket.on('chat:seen', async ({ complaintCode, messageId }, ack) => {
      try {
        const normalizedCode = String(complaintCode || '').trim();
        const normalizedMessageId = String(messageId || '').trim();
        if (!normalizedCode) throw new Error('complaintCode is required');
        if (!normalizedMessageId) throw new Error('messageId is required');

        const complaint = await complaintModel.findByReferenceForUser(normalizedCode, socket.user);
        if (!complaint) throw new Error('Complaint not found');

        const reader = socket.user.role === 'reporter' ? 'user' : 'hr';
        const encrypted = encryptFields(
          {
            message: buildControlMessage(CHAT_CONTROL_TYPES.SEEN, {
              reader,
              messageId: normalizedMessageId,
            }),
          },
          ['message']
        );

        await chatModel.createMessage({
          complaint_id: complaint.id,
          sender_type: toSenderType(socket.user.role),
          message: encrypted.message,
        });

        const context = await loadThreadContext(complaint.complaint_code, socket.user);
        const payload = {
          complaint_code: complaint.complaint_code,
          seen: context.threadState.seen,
        };
        const room = buildRoomName(complaint.complaint_code);
        io.to(room).emit('chat:seen', payload);
        if (typeof ack === 'function') ack({ ok: true, data: payload });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to mark seen';
        if (typeof ack === 'function') ack({ ok: false, message });
      }
    });
  });
}

module.exports = {
  initChatSocket,
};
