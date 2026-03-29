function runMigrations(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_id INTEGER NOT NULL,
      to_id INTEGER NOT NULL,
      text TEXT NOT NULL,
      client_token TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const messageColumns = db.prepare('PRAGMA table_info(messages)').all();
  const hasClientTokenColumn = messageColumns.some((column) => column.name === 'client_token');

  if (!hasClientTokenColumn) {
    db.exec('ALTER TABLE messages ADD COLUMN client_token TEXT');
  }
}

module.exports = {
  runMigrations,
};
