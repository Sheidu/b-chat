function buildMessagesService({ messagesRepository }) {
  function listConversation(fromId, toId) {
    return {
      status: 200,
      body: messagesRepository.listMessagesBetweenUsers(fromId, toId),
    };
  }

  function createMessage({ from, to, text, clientToken }) {
    const normalizedClientToken =
      typeof clientToken === 'string' && clientToken.trim() !== ''
        ? clientToken.trim()
        : null;

    const info = messagesRepository.createMessage(from, to, text, normalizedClientToken);

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
