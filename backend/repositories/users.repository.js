function buildUsersRepository(db) {
  const findUserIdByEmailStmt = db.prepare('SELECT id FROM users WHERE email = ? AND deleted_at IS NULL');
  const createUserStmt = db.prepare(
    'INSERT INTO users (email, phone_number, password, name, auth_channel, terms_version, terms_accepted_at, terms_url, terms_text_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );
  const findUserByEmailStmt = db.prepare('SELECT * FROM users WHERE email = ?');
  const findUserByPhoneStmt = db.prepare('SELECT * FROM users WHERE phone_number = ?');
  const findUserByEmailOrPhoneStmt = db.prepare('SELECT * FROM users WHERE email = ? OR phone_number = ?');
  const updateUserProfileStmt = db.prepare('UPDATE users SET email = ?, phone_number = ?, name = ? WHERE id = ? AND deleted_at IS NULL');
  const findUserByIdStmt = db.prepare('SELECT * FROM users WHERE id = ?');
  const upgradePasswordStmt = db.prepare('UPDATE users SET password = ? WHERE id = ?');

  const listContactsForUserStmt = db.prepare(`
    SELECT u.id, u.email, u.phone_number, u.name, c.nickname, c.created_at
    FROM contacts c
    JOIN users u ON u.id = c.contact_id
    WHERE c.owner_id = ?
      AND u.deleted_at IS NULL
    ORDER BY LOWER(COALESCE(c.nickname, u.name, u.email)) ASC
  `);

  const listDiscoverUsersStmt = db.prepare(`
    SELECT u.id, u.email, u.phone_number, u.name
    FROM users u
    WHERE u.deleted_at IS NULL
      AND u.id <> ?
      AND NOT EXISTS (
        SELECT 1 FROM contacts c
        WHERE c.owner_id = ?
          AND c.contact_id = u.id
      )
    ORDER BY LOWER(COALESCE(u.name, u.email)) ASC
  `);

  const addContactStmt = db.prepare(
    'INSERT OR IGNORE INTO contacts (owner_id, contact_id, nickname) VALUES (?, ?, ?)'
  );

  const updateContactNicknameStmt = db.prepare(
    'UPDATE contacts SET nickname = ? WHERE owner_id = ? AND contact_id = ?'
  );

  const softDeleteUserStmt = db.prepare('UPDATE users SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?');
  const hardDeleteUserStmt = db.prepare('DELETE FROM users WHERE id = ?');
  const deleteMessagesByUserStmt = db.prepare('DELETE FROM messages WHERE from_id = ? OR to_id = ?');
  const deleteOwnedContactsStmt = db.prepare('DELETE FROM contacts WHERE owner_id = ?');
  const deleteReferencedContactsStmt = db.prepare('DELETE FROM contacts WHERE contact_id = ?');

  const deleteUserDataTxn = db.transaction((userId, hardDelete) => {
    deleteMessagesByUserStmt.run(userId, userId);
    deleteOwnedContactsStmt.run(userId);
    deleteReferencedContactsStmt.run(userId);
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
      phoneNumber,
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
        phoneNumber,
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
    findUserByPhone(phoneNumber) {
      return findUserByPhoneStmt.get(phoneNumber);
    },
    findUserByEmailOrPhone(email, phoneNumber) {
      return findUserByEmailOrPhoneStmt.get(email, phoneNumber);
    },
    findUserById(userId) {
      return findUserByIdStmt.get(userId) || null;
    },
    updateUserProfile(userId, email, phoneNumber, name) {
      return updateUserProfileStmt.run(email, phoneNumber, name, userId);
    },
    upgradePasswordHash(userId, passwordHash) {
      return upgradePasswordStmt.run(passwordHash, userId);
    },
    listContactsForUser(userId) {
      return listContactsForUserStmt.all(userId);
    },
    listDiscoverUsers(userId) {
      return listDiscoverUsersStmt.all(userId, userId);
    },
    addContact(ownerId, contactId, nickname = null) {
      return addContactStmt.run(ownerId, contactId, nickname);
    },
    updateContactNickname(ownerId, contactId, nickname = null) {
      return updateContactNicknameStmt.run(nickname, ownerId, contactId);
    },
    deleteUserData(userId, { hardDelete = false } = {}) {
      deleteUserDataTxn(userId, hardDelete);
    },
  };
}

module.exports = {
  buildUsersRepository,
};
