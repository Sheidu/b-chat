function buildUsersRepository(db) {
  const findUserIdByEmailStmt = db.prepare('SELECT id FROM users WHERE email = ? AND deleted_at IS NULL');
  const createUserStmt = db.prepare(
    'INSERT INTO users (email, password, name, auth_channel, terms_version, terms_accepted_at, terms_url, terms_text_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );
  const findUserByEmailStmt = db.prepare('SELECT * FROM users WHERE email = ?');
  const findUserByIdStmt = db.prepare('SELECT * FROM users WHERE id = ?');
  const upgradePasswordStmt = db.prepare('UPDATE users SET password = ? WHERE id = ?');
  const listUsersStmt = db.prepare('SELECT id, email, name FROM users WHERE deleted_at IS NULL');
  const listContactsForUserStmt = db.prepare(`
    SELECT u.id, u.email, u.name
    FROM contacts c
    JOIN users u ON u.id = c.contact_user_id
    WHERE c.user_id = ?
      AND u.deleted_at IS NULL
    ORDER BY LOWER(COALESCE(u.name, u.email)) ASC
  `);
  const upsertContactStmt = db.prepare(
    'INSERT OR IGNORE INTO contacts (user_id, contact_user_id) VALUES (?, ?)'
  );
  const softDeleteUserStmt = db.prepare('UPDATE users SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?');
  const hardDeleteUserStmt = db.prepare('DELETE FROM users WHERE id = ?');
  const deleteMessagesByUserStmt = db.prepare('DELETE FROM messages WHERE from_id = ? OR to_id = ?');
  const deleteContactsByUserStmt = db.prepare('DELETE FROM contacts WHERE user_id = ? OR contact_user_id = ?');
  const listActiveUserIdsStmt = db.prepare('SELECT id FROM users WHERE id <> ? AND deleted_at IS NULL');

  const deleteUserDataTxn = db.transaction((userId, hardDelete) => {
    deleteMessagesByUserStmt.run(userId, userId);
    deleteContactsByUserStmt.run(userId, userId);
    if (hardDelete) {
      hardDeleteUserStmt.run(userId);
      return;
    }
    softDeleteUserStmt.run(userId);
  });

  return {
    findUserIdByEmail(email) {
      return findUserIdByEmailStmt.get(email);
    },
    createUser(
      email,
      passwordHash,
      name,
      authChannel,
      termsVersion,
      termsAcceptedAt,
      termsUrl,
      termsTextHash
    ) {
      return createUserStmt.run(
        email,
        passwordHash,
        name,
        authChannel,
        termsVersion,
        termsAcceptedAt,
        termsUrl,
        termsTextHash
      );
    },
    findUserByEmail(email) {
      return findUserByEmailStmt.get(email);
    },
    findUserById(userId) {
      return findUserByIdStmt.get(userId) || null;
    },
    upgradePasswordHash(userId, passwordHash) {
      return upgradePasswordStmt.run(passwordHash, userId);
    },
    listUsers() {
      return listUsersStmt.all();
    },
    listContactsForUser(userId) {
      return listContactsForUserStmt.all(userId);
    },
    addContactPair(userId, contactUserId) {
      if (userId === contactUserId) return;
      upsertContactStmt.run(userId, contactUserId);
      upsertContactStmt.run(contactUserId, userId);
    },
    seedContactsForUser(userId) {
      const userRows = listActiveUserIdsStmt.all(userId);
      for (const row of userRows) {
        upsertContactStmt.run(userId, row.id);
        upsertContactStmt.run(row.id, userId);
      }
    },
    deleteUserData(userId, { hardDelete = false } = {}) {
      deleteUserDataTxn(userId, hardDelete);
    },
  };
}

module.exports = {
  buildUsersRepository,
};
