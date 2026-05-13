const express = require('express');
const cors = require('cors');
const { createAuthRoutes } = require('./routes/auth.routes');
const { createUsersRoutes } = require('./routes/users.routes');
const { createMessagesRoutes } = require('./routes/messages.routes');
const { createCorsOptions } = require('./services/http-config.service');

function createApp({
  authService,
  usersService,
  messagesService,
  corsAllowlist,
  rateLimitMiddleware,
  authMiddleware,
  tokenRevocationMiddleware,
}) {
  const app = express();
  const resolvedAuthMiddleware =
    typeof authMiddleware === 'function'
      ? authMiddleware
      : (req, _res, next) => {
          req.auth = req.auth || { userId: null };
          next();
        };

  app.use(cors(createCorsOptions({ corsAllowlist })));
  app.use(express.json({ limit: '32kb' }));
  if (typeof rateLimitMiddleware === 'function') {
    app.use(['/register', '/login', '/users', '/messages'], rateLimitMiddleware);
  }

  app.use(createAuthRoutes({ authService }));
  if (typeof tokenRevocationMiddleware === 'function') {
    app.use(tokenRevocationMiddleware);
  }
  app.use(createUsersRoutes({ usersService, authMiddleware: resolvedAuthMiddleware }));
  app.use(createMessagesRoutes({ messagesService, authMiddleware: resolvedAuthMiddleware }));

  return app;
}

module.exports = {
  createApp,
};
