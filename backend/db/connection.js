const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

function createDbBackupIfExists(dbPath, backupsDir) {
  if (!fs.existsSync(dbPath)) return;

  fs.mkdirSync(backupsDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupsDir, `family-chat-${timestamp}.db`);
  fs.copyFileSync(dbPath, backupPath);

  const backupFiles = fs.readdirSync(backupsDir)
    .filter((fileName) => /^family-chat-.*\.db$/.test(fileName))
    .map((fileName) => {
      const filePath = path.join(backupsDir, fileName);
      const stats = fs.statSync(filePath);
      return { filePath, modifiedTimeMs: stats.mtimeMs };
    })
    .sort((a, b) => b.modifiedTimeMs - a.modifiedTimeMs);

  for (const oldBackup of backupFiles.slice(10)) {
    fs.unlinkSync(oldBackup.filePath);
  }
}

function createDatabaseConnection({ baseDir, shouldLogSqlStatements }) {
  const dbPath = path.join(baseDir, 'family-chat.db');
  const backupsDir = path.join(baseDir, 'backups');

  createDbBackupIfExists(dbPath, backupsDir);

  const dbExistedBeforeStart = fs.existsSync(dbPath);
  const requireExistingDb = process.env.DB_FILE_MUST_EXIST === '1';
  const db = new Database(dbPath, {
    verbose: shouldLogSqlStatements ? console.log : undefined,
    fileMustExist: requireExistingDb,
  });

  if (!dbExistedBeforeStart) {
    console.warn(`[DB] Created new SQLite file at ${dbPath}`);
  }

  db.pragma('journal_mode = WAL');
  return db;
}

module.exports = {
  createDatabaseConnection,
};
