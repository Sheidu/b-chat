const express = require('express');

function extractRequestContext(req) {
  return {
    ipAddress: req.ip,
    userAgent: req.get('user-agent') || null,
  };
}

function createUsersRoutes({ usersService, authMiddleware }) {
  const router = express.Router();

  router.get('/users', authMiddleware, (req, res) => {
    try {
      const result = usersService.listUsers(req.auth.userId);
      return res.status(result.status).json(result.body);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  router.delete('/users/me', authMiddleware, (req, res) => {
    try {
      const result = usersService.deleteCurrentUser({
        userId: req.auth.userId,
        context: extractRequestContext(req),
      });
      return res.status(result.status).json(result.body);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  return router;
}

module.exports = {
  createUsersRoutes,
};
