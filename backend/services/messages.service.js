function parsePositiveInt(value) {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) return value;
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    if (Number.isInteger(parsed) && parsed > 0) return parsed;
  }
  return null;
}

function parseLimit(value) {
  if (value == null) return 50;
  const parsed = parsePositiveInt(value);
  if (!parsed) return null;
  return Math.min(parsed, 50);
}

function parseBeforeCursor(before, beforeId) {
  if (before == null || before === "") return null;
  if (typeof before !== "string") return null;
  const parsed = new Date(before);
  if (Number.isNaN(parsed.getTime())) return null;
  const ts = parsed.toISOString();
  if (beforeId == null || beforeId === "") return { timestamp: ts, id: null };
  const parsedId = parsePositiveInt(beforeId);
  if (!parsedId) return null;
  return { timestamp: ts, id: parsedId };
}

function normalizeMessageText(text) {
  if (typeof text !== 'string') return null;
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (trimmed.length > 4000) return null;
  return trimmed;
}

function normalizeClientToken(clientToken) {
  if (typeof clientToken !== 'string') return null;
  const trimmed = clientToken.trim();
  if (!trimmed) return null;
  if (trimmed.length > 128) return null;
  return trimmed;
}

function buildMessagesService({ messagesRepository, complianceRepository, messageCrypto }) {
  function observeDecryptFailure(row, err) {
    console.error('[messages] decrypt failed', {
      id: row.id,
      fromId: row.from_id,
      toId: row.to_id,
      error: err && err.message ? err.message : String(err),
    });

    if (complianceRepository && typeof complianceRepository.createEvent === 'function') {
      complianceRepository.createEvent({
        eventType: 'decrypt_failure',
        status: 'error',
        userId: row.to_id,
        reason: `message_id:${row.id}`,
      });
    }
  }

  function listConversation(fromId, toId, { requesterUserId, before, beforeId, limit } = {}) {
    const normalizedFromId = parsePositiveInt(fromId);
    const normalizedToId = parsePositiveInt(toId);
    const normalizedLimit = parseLimit(limit);
    const normalizedBefore = parseBeforeCursor(before, beforeId);

    if (!normalizedFromId || !normalizedToId) {
      return { status: 400, body: { error: 'Invalid participant ids' } };
    }
    if (!normalizedLimit) {
      return { status: 400, body: { error: 'Invalid limit query param' } };
    }
    if ((before != null || beforeId != null) && normalizedBefore === null) {
      return { status: 400, body: { error: "Invalid before cursor params" } };
    }
    if (requesterUserId !== normalizedFromId && requesterUserId !== normalizedToId) {
      return { status: 403, body: { error: 'Forbidden conversation access' } };
    }

    const rows = messagesRepository.listMessagesBetweenUsers(normalizedFromId, normalizedToId, {
      before: normalizedBefore,
      limit: normalizedLimit,
    });

    const decrypted = rows.map((row) => {
      if (!messageCrypto) return row;
      try {
        return {
          ...row,
          text: messageCrypto.decryptText(row.text),
        };
      } catch (err) {
        observeDecryptFailure(row, err);
        return {
          ...row,
          text: '[Unable to decrypt message]',
          decrypt_failed: true,
        };
      }
    });

    return {
      status: 200,
      body: decrypted,
    };
  }

  function createMessage({ from, to, text, clientToken }) {
    const normalizedFrom = parsePositiveInt(from);
    const normalizedTo = parsePositiveInt(to);
    const normalizedText = normalizeMessageText(text);

    if (!normalizedFrom || !normalizedTo) {
      return { status: 400, body: { error: 'Invalid sender/recipient ids' } };
    }

    if (!normalizedText) {
      return { status: 400, body: { error: 'Message text must be 1-4000 chars' } };
    }

    const normalizedClientToken = normalizeClientToken(clientToken);
    if (clientToken != null && normalizedClientToken === null) {
      return { status: 400, body: { error: 'Client token must be <= 128 chars' } };
    }

    const encryptedText = messageCrypto ? messageCrypto.encryptText(normalizedText) : normalizedText;

    try {
      const info = messagesRepository.createMessage(
        normalizedFrom,
        normalizedTo,
        encryptedText,
        normalizedClientToken
      );


      return {
        status: 201,
        body: {
          id: info.lastInsertRowid,
          from_id: normalizedFrom,
          to_id: normalizedTo,
          text: normalizedText,
          client_token: normalizedClientToken,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (err) {
      if (err && /UNIQUE constraint failed: messages\.(from_id, messages\.to_id, messages\.client_token|client_token)/.test(String(err.message))) {
        const existing =
          normalizedClientToken == null || typeof messagesRepository.findMessageByConversationClientToken !== 'function'
            ? null
            : messagesRepository.findMessageByConversationClientToken(
                normalizedFrom,
                normalizedTo,
                normalizedClientToken
              );
        if (existing && existing.from_id === normalizedFrom && existing.to_id === normalizedTo) {
          return {
            status: 200,
            body: {
              ...existing,
              text: messageCrypto ? messageCrypto.decryptText(existing.text) : existing.text,
            },
          };
        }
      }
      throw err;
    }
  }

  return {
    listConversation,
    createMessage,
  };
}

module.exports = {
  buildMessagesService,
};
