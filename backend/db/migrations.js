function ensureColumn(db, tableName, columnName, ddl) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
  const hasColumn = columns.some((column) => column.name === columnName);
  if (!hasColumn) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${ddl}`);
  }
}

function runMigrations(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      phone_number TEXT,
      password TEXT NOT NULL,
      name TEXT,
      auth_channel TEXT NOT NULL DEFAULT 'email',
      terms_version TEXT,
      terms_accepted_at DATETIME,
      terms_url TEXT,
      terms_text_hash TEXT,
      deleted_at DATETIME
    )
  `);

  ensureColumn(db, 'users', 'auth_channel', "auth_channel TEXT NOT NULL DEFAULT 'email'");
  ensureColumn(db, 'users', 'terms_version', 'terms_version TEXT');
  ensureColumn(db, 'users', 'terms_accepted_at', 'terms_accepted_at DATETIME');
  ensureColumn(db, 'users', 'terms_url', 'terms_url TEXT');
  ensureColumn(db, 'users', 'terms_text_hash', 'terms_text_hash TEXT');
  ensureColumn(db, 'users', 'deleted_at', 'deleted_at DATETIME');
  ensureColumn(db, 'users', 'phone_number', 'phone_number TEXT');

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

  ensureColumn(db, 'messages', 'client_token', 'client_token TEXT');

  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_client_token
    ON messages(client_token)
    WHERE client_token IS NOT NULL
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS compliance_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT NOT NULL,
      status TEXT NOT NULL,
      user_id INTEGER,
      email TEXT,
      auth_channel TEXT,
      reason TEXT,
      ip_address TEXT,
      user_agent TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_compliance_events_email
    ON compliance_events(email)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_compliance_events_created_at
    ON compliance_events(created_at)
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_id INTEGER NOT NULL,
      contact_id INTEGER NOT NULL,
      nickname TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(owner_id, contact_id),
      CHECK(owner_id != contact_id)
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_contacts_owner
    ON contacts(owner_id)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_contacts_contact
    ON contacts(contact_id)
  `);
}

module.exports = {
  runMigrations,
};
