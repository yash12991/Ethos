const CONTROL_PREFIX = '__ETHOS_CHAT_CONTROL__';

const CHAT_CONTROL_TYPES = {
  REQUEST: 'CHAT_REQUEST',
  ACCEPTED: 'CHAT_ACCEPTED',
  SEEN: 'CHAT_SEEN',
};

function toSenderType(role) {
  return role === 'reporter' ? 'user' : 'hr';
}

function toUserType(role) {
  return role === 'reporter' ? 'anon' : 'hr';
}

function buildControlMessage(type, payload = {}) {
  return `${CONTROL_PREFIX}${JSON.stringify({ type, ...payload })}`;
}

function parseControlMessage(content) {
  if (typeof content !== 'string' || !content.startsWith(CONTROL_PREFIX)) return null;

  try {
    return JSON.parse(content.slice(CONTROL_PREFIX.length));
  } catch {
    return null;
  }
}

function resolveChatState(messages) {
  let latestRequest = null;
  let acceptedAt = null;

  for (const message of messages) {
    const control = parseControlMessage(message.message);
    if (!control) continue;

    if (control.type === CHAT_CONTROL_TYPES.REQUEST) {
      latestRequest = {
        text: control.text || '',
        created_at: message.created_at,
      };
    }

    if (control.type === CHAT_CONTROL_TYPES.ACCEPTED) {
      acceptedAt = message.created_at;
    }
  }

  const chatState = acceptedAt
    ? 'active'
    : latestRequest
      ? 'pending_acceptance'
      : 'not_requested';

  return {
    chatState,
    latestRequest,
    acceptedAt,
  };
}

function toVisibleMessages(messages) {
  return messages
    .filter((message) => !parseControlMessage(message.message))
    .map((message) => ({
      id: message.id,
      sender_type: message.sender_type,
      message: message.message,
      created_at: message.created_at,
    }));
}

function resolveSeenState(messages) {
  let userLastSeenMessageId = null;
  let hrLastSeenMessageId = null;

  for (const message of messages) {
    const control = parseControlMessage(message.message);
    if (!control || control.type !== CHAT_CONTROL_TYPES.SEEN) continue;

    if (control.reader === 'user') userLastSeenMessageId = control.messageId || null;
    if (control.reader === 'hr') hrLastSeenMessageId = control.messageId || null;
  }

  return {
    user_last_seen_message_id: userLastSeenMessageId,
    hr_last_seen_message_id: hrLastSeenMessageId,
  };
}

function buildThreadStateFromMessages(messages) {
  const { chatState, latestRequest, acceptedAt } = resolveChatState(messages);
  const seen = resolveSeenState(messages);

  return {
    chat_state: chatState,
    request_message: latestRequest?.text || null,
    requested_at: latestRequest?.created_at || null,
    accepted_at: acceptedAt,
    seen,
  };
}

module.exports = {
  CHAT_CONTROL_TYPES,
  buildControlMessage,
  parseControlMessage,
  resolveChatState,
  resolveSeenState,
  toVisibleMessages,
  toSenderType,
  toUserType,
  buildThreadStateFromMessages,
};
