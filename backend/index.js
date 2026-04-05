const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const dotenv = require('dotenv');
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
const { ensureEnvFile, runProductionHardeningChecks } = require('./services/runtime-hardening.service');
const { parseCorsOrigins } = require('./services/http-config.service');

const baseDir = __dirname;
const envPath = path.join(baseDir, '.env');
const envExamplePath = path.join(baseDir, '.env.example');

ensureEnvFile({ envPath, envExamplePath });
dotenv.config({ path: envPath });

const bcryptSaltRounds = Number(process.env.BCRYPT_SALT_ROUNDS || 12);
const shouldLogSqlStatements = process.env.SQL_VERBOSE === '1';
const registrationPolicy = process.env.REGISTRATION_POLICY || 'strict_ru_email';
const termsVersion = process.env.TERMS_VERSION || '2026-03-31';
const corsAllowlist = process.env.CORS_ALLOWLIST || '';
const sessionCookieSecure = process.env.SESSION_COOKIE_SECURE || 'auto';
const messageEncryptionKey = process.env.MESSAGE_ENCRYPTION_KEY || '';

runProductionHardeningChecks({
  nodeEnv: process.env.NODE_ENV,
  messageEncryptionKey,
  corsAllowlist,
  sessionCookieSecure,
});

const db = createDatabaseConnection({
  baseDir,
  shouldLogSqlStatements,
});

runMigrations(db);

const usersRepository = buildUsersRepository(db);
const messagesRepository = buildMessagesRepository(db);
const complianceRepository = buildComplianceRepository(db);
const messageCrypto = createMessageCrypto({ rawKey: messageEncryptionKey });

const io = new Server({
  cors: {
    origin: parseCorsOrigins(corsAllowlist),
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

const authService = buildAuthService({
  usersRepository,
  complianceRepository,
  bcryptSaltRounds,
  registrationPolicy,
  defaultTermsVersion: termsVersion,
  onUserRegistered: (user) => {
    io.emit('usersChanged', { type: 'registered', user });
  },
});

const usersService = buildUsersService({ usersRepository });
const messagesService = buildMessagesService({ messagesRepository, messageCrypto });

const app = createApp({ authService, usersService, messagesService, corsAllowlist });
const server = http.createServer(app);
io.attach(server);

registerChatSocketHandlers({ io, messagesService });

const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
