const express = require('express');

function createAuthRoutes({ authService }) {
  const router = express.Router();

  router.post('/register', (req, res) => {
    try {
      const result = authService.register(req.body || {});
      return res.status(result.status).json(result.body);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  router.post('/login', (req, res) => {
    try {
      const result = authService.login(req.body || {});
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
