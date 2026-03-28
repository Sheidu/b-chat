const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const dbPath = path.join(__dirname, '..', 'family-chat.db');
const mode = (process.argv[2] || 'summary').toLowerCase();
const repoRoot = path.join(__dirname, '..', '..');

function findFilesByName(rootDir, fileName, matches = []) {
  let entries = [];
  try {
    entries = fs.readdirSync(rootDir, { withFileTypes: true });
  } catch (_err) {
    return matches;
  }

  for (const entry of entries) {
    const absolutePath = path.join(rootDir, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'build') {
        continue;
      }
      findFilesByName(absolutePath, fileName, matches);
      continue;
    }

    if (entry.isFile() && entry.name === fileName) {
      matches.push(absolutePath);
    }
  }

  return matches;
}

function inspectDb(dbFilePath) {
  const stats = fs.statSync(dbFilePath);
  const payload = {
    dbPath: dbFilePath,
    size_bytes: stats.size,
    modified_at: stats.mtime.toISOString(),
  };

  try {
    const localDb = new Database(dbFilePath, { readonly: true });
    const localTables = localDb
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all()
      .map((row) => row.name);
    payload.tables = localTables;
    if (localTables.includes('users')) {
      payload.total_users = localDb.prepare('SELECT COUNT(*) AS total_users FROM users').get().total_users;
    }
    if (localTables.includes('messages')) {
      payload.total_messages = localDb
        .prepare('SELECT COUNT(*) AS total_messages FROM messages')
        .get().total_messages;
    }
    localDb.close();
  } catch (err) {
    payload.error = `Failed to inspect DB: ${err.message}`;
  }

  return payload;
}

if (mode === 'find') {
  const dbFiles = findFilesByName(repoRoot, 'family-chat.db');
  printJson({
    searched_under: repoRoot,
    count: dbFiles.length,
    databases: dbFiles.map((file) => inspectDb(file)),
  });
  process.exit(0);
}

if (!fs.existsSync(dbPath)) {
  console.log(
    JSON.stringify(
      {
        dbPath,
        exists: false,
        hint:
          'Database file not found. Start the backend once from backend/ to create and initialize family-chat.db.',
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

const db = new Database(dbPath, { readonly: true });

function printJson(value) {
  console.log(JSON.stringify(value, null, 2));
}

function tableExists(tableName) {
  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(tableName);
  return Boolean(row);
}

const tables = db
  .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
  .all()
  .map((row) => row.name);

if (mode === 'tables') {
  printJson({ dbPath, tables });
  process.exit(0);
}

if (mode === 'users') {
  if (!tableExists('users')) {
    printJson({ dbPath, error: 'users table missing', tables });
    process.exit(0);
  }

  const users = db.prepare('SELECT id, email, name FROM users ORDER BY id').all();
  printJson({ dbPath, users });
  process.exit(0);
}

if (mode === 'messages') {
  if (!tableExists('messages')) {
    printJson({ dbPath, error: 'messages table missing', tables });
    process.exit(0);
  }

  const count = db
    .prepare('SELECT COUNT(*) AS total_messages FROM messages')
    .get();
  printJson({ dbPath, ...count });
  process.exit(0);
}

if (mode !== 'summary') {
  printJson({
    dbPath,
    error: `Unknown mode: ${mode}`,
    usage: 'node scripts/db_inspect.js [summary|tables|users|messages|find]',
  });
  process.exit(1);
}

const payload = { dbPath, tables };

if (tableExists('users')) {
  payload.total_users = db.prepare('SELECT COUNT(*) AS total_users FROM users').get().total_users;
}

if (tableExists('messages')) {
  payload.total_messages = db
    .prepare('SELECT COUNT(*) AS total_messages FROM messages')
    .get().total_messages;
}

printJson(payload);
