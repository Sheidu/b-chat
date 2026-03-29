const express = require('express');

function createUsersRoutes({ usersService }) {
  const router = express.Router();

  router.get('/users', (req, res) => {
    try {
      const result = usersService.listUsers();
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
