const express = require('express');

function createMessagesRoutes({ messagesService }) {
  const router = express.Router();

  router.get('/messages/:fromId/:toId', (req, res) => {
    const { fromId, toId } = req.params;

    try {
      const result = messagesService.listConversation(fromId, toId);
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
