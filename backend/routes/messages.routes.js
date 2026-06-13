const express = require('express');

function createMessagesRoutes({ messagesService, authMiddleware }) {
  const router = express.Router();

  router.get('/messages/:fromId/:toId', authMiddleware, (req, res) => {
    const { fromId, toId } = req.params;
    const { before, beforeId, limit } = req.query;

    try {
      const result = messagesService.listConversation(fromId, toId, {
        requesterUserId: req.auth.userId,
        before,
        beforeId,
        limit,
      });
      return res.status(result.status).json(result.body);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  return router;
}

module.exports = {
  createMessagesRoutes,
};
