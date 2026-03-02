const complaintModel = require('../models/complaint.model');
const chatModel = require('../models/chat.model');
const { encryptFields, decryptFields } = require('../services/encryption.service');
const { logAuditEvent } = require('../services/audit.service');
const { ApiError } = require('../middlewares/error.middleware');
const {
  CHAT_CONTROL_TYPES,
  buildControlMessage,
  resolveChatState,
  toVisibleMessages,
  toSenderType,
  toUserType,
  buildThreadStateFromMessages,
} = require('../services/chat.service');
const { canAccessChat } = require('../services/caseAccess.service');

async function getComplaintForActorOr404(reference, user) {
  const complaint = await complaintModel.findByReference(reference);
  if (!complaint) throw new ApiError(404, 'Complaint not found');
  if (!canAccessChat(complaint, user)) throw new ApiError(403, 'You do not have access to chat for this case');
  return complaint;
}

async function listThreads(req, res, next) {
  try {
    const summaries = await chatModel.listThreadSummaries(req.user);

    const threadData = await Promise.all(
      summaries.map(async (summary) => {
        const rawMessages = await chatModel.listMessages(summary.complaint_code, req.user);
        const decryptedMessages = rawMessages.map((item) => decryptFields(item, ['message']));
        const threadState = buildThreadStateFromMessages(decryptedMessages);

        const latestVisibleMessage = toVisibleMessages(decryptedMessages).slice(-1)[0] || null;

        return {
          thread_id: summary.thread_id,
          complaint_id: summary.complaint_id,
          complaint_code: summary.complaint_code,
          complaint_status: summary.complaint_status,
          chat_state: threadState.chat_state,
          request_message: threadState.request_message,
          requested_at: threadState.requested_at,
          accepted_at: threadState.accepted_at,
          seen: threadState.seen,
          last_message_preview: latestVisibleMessage?.message || threadState.request_message || null,
          last_message_at:
            latestVisibleMessage?.created_at ||
            threadState.requested_at ||
            summary.last_message_at ||
            summary.thread_created_at,
        };
      })
    );

    return res.json({
      success: true,
      data: threadData,
    });
  } catch (err) {
    return next(err);
  }
}

async function initiateRequest(req, res, next) {
  try {
    if (!['hr', 'committee', 'admin'].includes(req.user.role)) {
      throw new ApiError(403, 'Only HR users can initiate chat requests');
    }

    const { complaintId } = req.params;
    const complaint = await getComplaintForActorOr404(complaintId, req.user);

    const messageText = req.body.message.trim();
    const controlPayload = buildControlMessage(CHAT_CONTROL_TYPES.REQUEST, {
      text: messageText,
    });

    const encrypted = encryptFields({ message: controlPayload }, ['message']);
    await chatModel.createMessage({
      complaint_id: complaint.id,
      sender_type: 'hr',
      message: encrypted.message,
    });

    await logAuditEvent({
      actorUserId: req.user.id,
      action: 'chat.request.initiate',
      userType: 'hr',
      metadata: { complaintCode: complaint.complaint_code },
    });

    return res.status(201).json({
      success: true,
      data: {
        complaint_code: complaint.complaint_code,
        chat_state: 'pending_acceptance',
      },
    });
  } catch (err) {
    return next(err);
  }
}

async function acceptRequest(req, res, next) {
  try {
    if (req.user.role !== 'reporter') {
      throw new ApiError(403, 'Only anonymous users can accept chat requests');
    }

    const { complaintId } = req.params;
    const complaint = await getComplaintForActorOr404(complaintId, req.user);

    const rawMessages = await chatModel.listMessages(complaint.complaint_code, req.user);
    const decryptedMessages = rawMessages.map((item) => decryptFields(item, ['message']));
    const { chatState } = resolveChatState(decryptedMessages);

    if (chatState === 'active') {
      return res.json({
        success: true,
        data: {
          complaint_code: complaint.complaint_code,
          chat_state: 'active',
        },
      });
    }

    if (chatState !== 'pending_acceptance') {
      throw new ApiError(400, 'No pending HR chat request for this complaint');
    }

    const encrypted = encryptFields(
      { message: buildControlMessage(CHAT_CONTROL_TYPES.ACCEPTED) },
      ['message']
    );

    await chatModel.createMessage({
      complaint_id: complaint.id,
      sender_type: 'user',
      message: encrypted.message,
    });

    await logAuditEvent({
      actorUserId: req.user.id,
      action: 'chat.request.accept',
      userType: 'anon',
      metadata: { complaintCode: complaint.complaint_code },
    });

    return res.json({
      success: true,
      data: {
        complaint_code: complaint.complaint_code,
        chat_state: 'active',
      },
    });
  } catch (err) {
    return next(err);
  }
}

async function postMessage(req, res, next) {
  try {
    const { complaintId } = req.params;
    const complaint = await getComplaintForActorOr404(complaintId, req.user);

    const rawMessages = await chatModel.listMessages(complaint.complaint_code, req.user);
    const decryptedMessages = rawMessages.map((item) => decryptFields(item, ['message']));
    const { chatState } = resolveChatState(decryptedMessages);

    if (chatState !== 'active') {
      throw new ApiError(403, 'Chat is not active. HR request must be accepted first');
    }

    const encrypted = encryptFields({ message: req.body.message }, ['message']);

    const createdMessage = await chatModel.createMessage({
      complaint_id: complaint.id,
      sender_type: toSenderType(req.user.role),
      message: encrypted.message,
    });

    const decrypted = decryptFields(createdMessage, ['message']);

    await logAuditEvent({
      actorUserId: req.user.id,
      action: 'chat.message.create',
      userType: toUserType(req.user.role),
      metadata: { complaintCode: complaint.complaint_code },
    });

    return res.status(201).json({ success: true, data: decrypted });
  } catch (err) {
    return next(err);
  }
}

async function getMessages(req, res, next) {
  try {
    const { complaintId } = req.params;
    const complaint = await getComplaintForActorOr404(complaintId, req.user);

    const rawMessages = await chatModel.listMessages(complaint.complaint_code, req.user);
    const decryptedMessages = rawMessages.map((item) => decryptFields(item, ['message']));
    const threadState = buildThreadStateFromMessages(decryptedMessages);

    const visibleMessages = toVisibleMessages(decryptedMessages);

    return res.json({
      success: true,
      data: {
        thread: {
          complaint_id: complaint.id,
          complaint_code: complaint.complaint_code,
          complaint_status: complaint.status,
          chat_state: threadState.chat_state,
          request_message: threadState.request_message,
          requested_at: threadState.requested_at,
          accepted_at: threadState.accepted_at,
          seen: threadState.seen,
        },
        messages: visibleMessages,
      },
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  listThreads,
  initiateRequest,
  acceptRequest,
  postMessage,
  getMessages,
};
