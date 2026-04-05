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
  authRateLimitMiddleware,
}) {
  const app = express();

  app.use(cors(createCorsOptions({ corsAllowlist })));
  app.use(express.json({ limit: '32kb' }));
  if (typeof authRateLimitMiddleware === 'function') {
    app.use(['/register', '/login'], authRateLimitMiddleware);
  }

  app.use(createAuthRoutes({ authService }));
  app.use(createUsersRoutes({ usersService }));
  app.use(createMessagesRoutes({ messagesService }));

  return app;
}

module.exports = {
  createApp,
};
