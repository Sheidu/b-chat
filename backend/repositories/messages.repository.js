function buildMessagesRepository(db) {
  const listMessagesBetweenUsersStmt = db.prepare(`
    SELECT * FROM messages
    WHERE (from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?)
    ORDER BY timestamp ASC
  `);

  const createMessageStmt = db.prepare(
    'INSERT INTO messages (from_id, to_id, text, client_token) VALUES (?, ?, ?, ?)'
  );

  return {
    listMessagesBetweenUsers(fromId, toId) {
      return listMessagesBetweenUsersStmt.all(fromId, toId, toId, fromId);
    },
    createMessage(fromId, toId, text, clientToken) {
      return createMessageStmt.run(fromId, toId, text, clientToken);
    },
  };
}

module.exports = {
  buildMessagesRepository,
};
