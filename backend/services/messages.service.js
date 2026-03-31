function buildMessagesService({ messagesRepository, messageCrypto }) {
  function listConversation(fromId, toId) {
    const rows = messagesRepository.listMessagesBetweenUsers(fromId, toId);
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
    const normalizedClientToken =
      typeof clientToken === 'string' && clientToken.trim() !== ''
        ? clientToken.trim()
        : null;

    const encryptedText = messageCrypto ? messageCrypto.encryptText(text) : text;
    const info = messagesRepository.createMessage(from, to, encryptedText, normalizedClientToken);

    return {
      id: info.lastInsertRowid,
      from_id: from,
      to_id: to,
      text,
      client_token: normalizedClientToken,
      timestamp: new Date().toISOString(),
    };
  }

  return {
    listConversation,
    createMessage,
  };
}

module.exports = {
  buildMessagesService,
};
