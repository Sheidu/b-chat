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
const { createAuthRateLimitMiddleware } = require('./services/auth-rate-limit.service');
const { buildJwtAuthService } = require('./services/jwt-auth.service');
const { buildNotificationService } = require('./services/notification.service');
const { buildNotificationsRepository } = require('./repositories/notifications.repository');

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
const previousMessageEncryptionKeys = process.env.MESSAGE_ENCRYPTION_PREVIOUS_KEYS || '';
const userAgreementUrl = process.env.USER_AGREEMENT_URL || '';
const authRateLimitWindowMs = Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS || 60_000);
const authRateLimitMaxAttempts = Number(process.env.AUTH_RATE_LIMIT_MAX_ATTEMPTS || 12);
const jwtSecret = process.env.JWT_SECRET || 'change-me-in-production-jwt-secret';
const jwtExpiresIn = process.env.JWT_EXPIRES_IN || '7d';
const hardDeleteUsers = process.env.HARD_DELETE_USERS === '1';
const mailSender = process.env.MAIL_SENDER || 'noreply@family-chat.local';
const emailQueuePollMs = Number(process.env.EMAIL_QUEUE_POLL_MS || 15000);

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
const notificationsRepository = buildNotificationsRepository(db);
const messageCrypto = createMessageCrypto({
  rawKey: messageEncryptionKey,
  previousKeys: previousMessageEncryptionKeys,
});

const io = new Server({
  cors: {
    origin: parseCorsOrigins(corsAllowlist),
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

const jwtAuthService = buildJwtAuthService({ secret: jwtSecret, expiresIn: jwtExpiresIn });
const notificationService = buildNotificationService({ notificationsRepository, senderEmail: mailSender });
const mailTransport = {
  send({ to, subject }) {
    console.log(`[mail] to=${to} subject=${subject}`);
  },
};
setInterval(() => notificationService.processQueue({ transport: mailTransport }), emailQueuePollMs);

const authService = buildAuthService({
  usersRepository,
  complianceRepository,
  bcryptSaltRounds,
  registrationPolicy,
  defaultTermsVersion: termsVersion,
  userAgreementUrl,
  jwtAuthService,
  notificationService,
  onUserRegistered: (user) => {
    io.emit('usersChanged', { type: 'registered', user });
  },
});

const usersService = buildUsersService({ usersRepository, complianceRepository, hardDeleteUsers });
const messagesService = buildMessagesService({ messagesRepository, complianceRepository, messageCrypto });
const authRateLimitMiddleware = createAuthRateLimitMiddleware({
  windowMs: authRateLimitWindowMs,
  maxAttempts: authRateLimitMaxAttempts,
});

const app = createApp({
  authService,
  usersService,
  messagesService,
  corsAllowlist,
  authRateLimitMiddleware,
  authMiddleware: jwtAuthService.authMiddleware,
});
const server = http.createServer(app);
io.attach(server);

registerChatSocketHandlers({ io, messagesService });

const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
