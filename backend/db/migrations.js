function ensureColumn(db, tableName, columnName, ddl) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
  const hasColumn = columns.some((column) => column.name === columnName);
  if (!hasColumn) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${ddl}`);
  }
}

/**
 * Checks whether a table exists AND has all the required columns.
 * If the table exists but is missing columns (e.g. from a previous failed
 * migration), it drops and recreates it.
 *
 * Safe to use only on tables with no foreign-key dependants, or when
 * called before any data has been written (i.e. new tables like `contacts`).
 */
function ensureTable(db, tableName, requiredColumns, createSql) {
  const existing = db
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`)
    .get(tableName);
 
  if (existing) {
    const cols = db.prepare(`PRAGMA table_info(${tableName})`).all();
    const colNames = cols.map((c) => c.name);
    const missingAny = requiredColumns.some((r) => !colNames.includes(r));
 
    if (missingAny) {
      // Table exists but is malformed — drop and recreate.
      // Only safe for tables with no dependants or no real data yet.
      console.warn(
        `[migrations] Table "${tableName}" is missing columns ${requiredColumns.filter(
          (r) => !colNames.includes(r)
        )}. Dropping and recreating.`
      );
      db.exec(`DROP TABLE IF EXISTS ${tableName}`);
    } else {
      return; // Table is fine, nothing to do.
    }
  }
 
  db.exec(createSql);
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
    CREATE TABLE IF NOT EXISTS outbound_emails (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT NOT NULL,
      recipient_email TEXT NOT NULL,
      recipient_phone TEXT,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      locale TEXT NOT NULL DEFAULT 'ru',
      status TEXT NOT NULL DEFAULT 'queued',
      attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      next_attempt_at TEXT NOT NULL,
      sent_at TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS compliance_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT NOT NULL,
      status TEXT NOT NULL,
      user_id INTEGER,
      email TEXT,
      phone TEXT,
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


  ensureColumn(db, 'outbound_emails', 'recipient_phone', 'recipient_phone TEXT');
  ensureColumn(db, 'compliance_events', 'phone', 'phone TEXT');

  ensureTable(
    db,
    'contacts',
    ['id', 'owner_id', 'contact_id', 'nickname', 'created_at'],
    `
    CREATE TABLE contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      contact_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      nickname TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(owner_id, contact_id),
      CHECK(owner_id != contact_id)
    )
    `
  );

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_contacts_owner
    ON contacts(owner_id)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_contacts_contact
    ON contacts(contact_id)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_outbound_emails_status_next_attempt
    ON outbound_emails(status, next_attempt_at)
  `);

  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone_unique
    ON users(phone_number)
    WHERE deleted_at IS NULL
  `);
}

module.exports = {
  runMigrations,
};
