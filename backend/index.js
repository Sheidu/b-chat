const http = require('http');
const path = require('path');
const fs = require('fs');
const { Server } = require('socket.io');
const { createApp } = require('./app');
const { createDatabaseConnection } = require('./db/connection');
const { runMigrations } = require('./db/migrations');
const { buildUsersRepository } = require('./repositories/users.repository');
const { buildMessagesRepository } = require('./repositories/messages.repository');
const { buildComplianceRepository } = require('./repositories/compliance.repository');
const { buildAuthService } = require('./services/auth.service');
const { buildUsersService } = require('./services/users.service');
const { buildMessagesService } = require('./services/messages.service');
const { registerChatSocketHandlers } = require('./sockets/chat.socket');
const { createMessageCrypto } = require('./security/message-crypto');

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

const BCRYPT_SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS || 12);
const shouldLogSqlStatements = process.env.SQL_VERBOSE === '1';
const registrationPolicy = process.env.REGISTRATION_POLICY || 'strict_ru_email';
const termsVersion = process.env.TERMS_VERSION || '2026-03-31';

const db = createDatabaseConnection({
  baseDir: __dirname,
  shouldLogSqlStatements,
});

runMigrations(db);

const usersRepository = buildUsersRepository(db);
const messagesRepository = buildMessagesRepository(db);
const complianceRepository = buildComplianceRepository(db);
const messageCrypto = createMessageCrypto({ rawKey: process.env.MESSAGE_ENCRYPTION_KEY || '' });

const io = new Server({
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

const authService = buildAuthService({
  usersRepository,
  complianceRepository,
  bcryptSaltRounds: BCRYPT_SALT_ROUNDS,
  registrationPolicy,
  defaultTermsVersion: termsVersion,
  onUserRegistered: (user) => {
    io.emit('usersChanged', { type: 'registered', user });
  },
});

const usersService = buildUsersService({ usersRepository });
const messagesService = buildMessagesService({ messagesRepository, messageCrypto });

const app = createApp({ authService, usersService, messagesService });
const server = http.createServer(app);
io.attach(server);

registerChatSocketHandlers({ io, messagesService });

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
