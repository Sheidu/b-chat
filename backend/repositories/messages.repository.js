function buildMessagesRepository(db) {
  const listMessagesBetweenUsersStmt = db.prepare(`
    SELECT * FROM messages
    WHERE ((from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?))
      AND (? IS NULL OR timestamp < ?)
    ORDER BY timestamp DESC, id DESC
    LIMIT ?
  `);

  const createMessageStmt = db.prepare(
    'INSERT INTO messages (from_id, to_id, text, client_token) VALUES (?, ?, ?, ?)'
  );

  const findByClientTokenStmt = db.prepare('SELECT * FROM messages WHERE client_token = ? LIMIT 1');

  return {
    listMessagesBetweenUsers(fromId, toId, { before = null, limit = 50 } = {}) {
      return listMessagesBetweenUsersStmt.all(fromId, toId, toId, fromId, before, before, limit).reverse();
    },
    createMessage(fromId, toId, text, clientToken) {
      return createMessageStmt.run(fromId, toId, text, clientToken);
    },
    findMessageByClientToken(clientToken) {
      return findByClientTokenStmt.get(clientToken) || null;
    },
  };
}

module.exports = {
  buildMessagesRepository,
};
