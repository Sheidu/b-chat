function buildUsersRepository(db) {
  const findUserIdByEmailStmt = db.prepare('SELECT id FROM users WHERE email = ?');
  const createUserStmt = db.prepare(
    'INSERT INTO users (email, password, name, auth_channel, terms_version, terms_accepted_at) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const findUserByEmailStmt = db.prepare('SELECT * FROM users WHERE email = ?');
  const upgradePasswordStmt = db.prepare('UPDATE users SET password = ? WHERE id = ?');
  const listUsersStmt = db.prepare('SELECT id, email, name FROM users');

  return {
    findUserIdByEmail(email) {
      return findUserIdByEmailStmt.get(email);
    },
    createUser(email, passwordHash, name, authChannel, termsVersion, termsAcceptedAt) {
      return createUserStmt.run(
        email,
        passwordHash,
        name,
        authChannel,
        termsVersion,
        termsAcceptedAt
      );
    },
    findUserByEmail(email) {
      return findUserByEmailStmt.get(email);
    },
    upgradePasswordHash(userId, passwordHash) {
      return upgradePasswordStmt.run(passwordHash, userId);
    },
    listUsers() {
      return listUsersStmt.all();
    },
  };
}

module.exports = {
  buildUsersRepository,
};
