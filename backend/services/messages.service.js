function parsePositiveInt(value) {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) return value;
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    if (Number.isInteger(parsed) && parsed > 0) return parsed;
  }
  return null;
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

function buildMessagesService({ messagesRepository, messageCrypto }) {
  function listConversation(fromId, toId) {
    const normalizedFromId = parsePositiveInt(fromId);
    const normalizedToId = parsePositiveInt(toId);

    if (!normalizedFromId || !normalizedToId) {
      return { status: 400, body: { error: 'Invalid participant ids' } };
    }

    const rows = messagesRepository.listMessagesBetweenUsers(normalizedFromId, normalizedToId);
    const decrypted = rows.map((row) => ({
      ...row,
      text: messageCrypto ? messageCrypto.decryptText(row.text) : row.text,
    }));

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
      if (err && /UNIQUE constraint failed: messages\.client_token/.test(String(err.message))) {
        const existing =
          normalizedClientToken == null
            ? null
            : messagesRepository.findMessageByClientToken(normalizedClientToken);
        if (existing) {
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
