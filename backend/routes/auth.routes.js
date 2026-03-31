const express = require('express');

function extractRequestContext(req) {
  return {
    ipAddress: req.ip,
    userAgent: req.get('user-agent') || null,
  };
}

function createAuthRoutes({ authService }) {
  const router = express.Router();

  router.post('/register', (req, res) => {
    try {
      const payload = req.body || {};
      const result = authService.register({
        ...payload,
        context: extractRequestContext(req),
      });
      return res.status(result.status).json(result.body);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  router.post('/login', (req, res) => {
    try {
      const payload = req.body || {};
      const result = authService.login({
        ...payload,
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
  createAuthRoutes,
};
