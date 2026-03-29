const express = require('express');
const cors = require('cors');
const { createAuthRoutes } = require('./routes/auth.routes');
const { createUsersRoutes } = require('./routes/users.routes');
const { createMessagesRoutes } = require('./routes/messages.routes');

function createApp({ authService, usersService, messagesService }) {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.use(createAuthRoutes({ authService }));
  app.use(createUsersRoutes({ usersService }));
  app.use(createMessagesRoutes({ messagesService }));

  return app;
}

module.exports = {
  createApp,
};
