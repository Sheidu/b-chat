const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { Server } = require('socket.io');
const cors = require('cors');
const Database = require('better-sqlite3');  // < new import
const bcrypt = require('bcrypt');

const envPath = path.join(__dirname, '.env');
const envExamplePath = path.join(__dirname, '.env.example');

if (!fs.existsSync(envPath)) {
  if (fs.existsSync(envExamplePath)) {
    try {
      fs.copyFileSync(envExamplePath, envPath);
      console.log('.env created from .env.example. Please update secrets!');
    } catch (_err) {
      console.log('No .env and no .env.example found');
    }
  } else {
    console.log('No .env and no .env.example found');
  }
}

require('dotenv').config({ path: envPath });

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(cors());
app.use(express.json());

const BCRYPT_SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS || 12);

// Open DB (creates file if missing)
const dbPath = path.join(__dirname, 'family-chat.db');
const backupsDir = path.join(__dirname, 'backups');

function createDbBackupIfExists() {
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

createDbBackupIfExists();

const dbExistedBeforeStart = fs.existsSync(dbPath);
const requireExistingDb = process.env.DB_FILE_MUST_EXIST === '1';
const db = new Database(dbPath, {
  verbose: console.log, // verbose = logs queries (good for debug)
  fileMustExist: requireExistingDb,
});

if (!dbExistedBeforeStart) {
  console.warn(`[DB] Created new SQLite file at ${dbPath}`);
}

// Enable WAL mode right away > much better concurrency/performance for reads+writes
db.pragma('journal_mode = WAL');

// Create tables if not exist (synchronous!)
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

const messageColumns = db.prepare(`PRAGMA table_info(messages)`).all();
const hasClientTokenColumn = messageColumns.some((column) => column.name === 'client_token');
if (!hasClientTokenColumn) {
  db.exec('ALTER TABLE messages ADD COLUMN client_token TEXT');
}

// Register > synchronous prepare + run
app.post('/register', (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  try {
    // Check if exists
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) return res.status(400).json({ error: 'Email already taken' });

    const passwordHash = bcrypt.hashSync(password, BCRYPT_SALT_ROUNDS);
    const stmt = db.prepare('INSERT INTO users (email, password, name) VALUES (?, ?, ?)');
    const info = stmt.run(email, passwordHash, name || email.split('@')[0]);

    res.json({ id: info.lastInsertRowid, email, name: name || email.split('@')[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Login
app.post('/login', (req, res) => {
  const { email, password } = req.body;
  try {
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });

    const storedPassword = user.password || '';
    const looksHashed = /^\$2[aby]\$\d{2}\$/.test(storedPassword);
    let isValidPassword = false;

    if (looksHashed) {
      isValidPassword = bcrypt.compareSync(password, storedPassword);
    } else {
      // Backward compatibility with old plaintext rows; migrate to hash on successful login.
      isValidPassword = storedPassword === password;
      if (isValidPassword) {
        const upgradedHash = bcrypt.hashSync(password, BCRYPT_SALT_ROUNDS);
        db.prepare('UPDATE users SET password = ? WHERE id = ?').run(upgradedHash, user.id);
      }
    }

    if (!isValidPassword) return res.status(401).json({ error: 'Invalid email or password' });

    res.json({ id: user.id, email: user.email, name: user.name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all users (for contact list)
app.get('/users', (req, res) => {
  try {
    const users = db.prepare('SELECT id, email, name FROM users').all();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get message history between two users
app.get('/messages/:fromId/:toId', (req, res) => {
  const { fromId, toId } = req.params;
  try {
    const messages = db.prepare(`
      SELECT * FROM messages 
      WHERE (from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?)
      ORDER BY timestamp ASC
    `).all(fromId, toId, toId, fromId);
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Socket.IO real-time
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join', (userId) => {
    socket.join(`user_${userId}`);
  });

  socket.on('sendMessage', (data) => {
    const { from, to, text, clientToken } = data;
    try {
      const normalizedClientToken =
        typeof clientToken === 'string' && clientToken.trim() !== ''
          ? clientToken.trim()
          : null;

      const stmt = db.prepare('INSERT INTO messages (from_id, to_id, text, client_token) VALUES (?, ?, ?, ?)');
      const info = stmt.run(from, to, text, normalizedClientToken);

      const newMsg = {
        id: info.lastInsertRowid,
        from_id: from,
        to_id: to,
        text,
        client_token: normalizedClientToken,
        timestamp: new Date().toISOString()
      };

      // Broadcast to both users
      io.to(`user_${from}`).to(`user_${to}`).emit('newMessage', newMsg);
    } catch (err) {
      console.error('Message insert error:', err);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
