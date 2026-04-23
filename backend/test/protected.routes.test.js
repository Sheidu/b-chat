const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { createApp } = require('../app');

function withServer(app, run) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(app);
    server.listen(0, async () => {
      try {
        const address = server.address();
        await run(`http://127.0.0.1:${address.port}`);
        server.close(() => resolve());
      } catch (err) {
        server.close(() => reject(err));
      }
    });
  });
}

test('protected routes require auth middleware when provided', async () => {
  const authMiddleware = (req, res, next) => {
    const auth = req.get('authorization');
    if (auth !== 'Bearer test-token') {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    req.auth = { userId: 1 };
    return next();
  };

  const app = createApp({
    authService: { register: () => ({ status: 200, body: {} }), login: () => ({ status: 200, body: {} }) },
    usersService: { listUsers: () => ({ status: 200, body: [] }), deleteCurrentUser: () => ({ status: 200, body: { success: true } }) },
    messagesService: { listConversation: () => ({ status: 200, body: [] }) },
    corsAllowlist: 'http://localhost:3000',
    authMiddleware,
  });

  await withServer(app, async (baseUrl) => {
    const usersRes = await fetch(`${baseUrl}/users`);
    assert.equal(usersRes.status, 401);

    const messagesRes = await fetch(`${baseUrl}/messages/1/2`);
    assert.equal(messagesRes.status, 401);

    const okUsersRes = await fetch(`${baseUrl}/users`, {
      headers: { Authorization: 'Bearer test-token' },
    });
    assert.equal(okUsersRes.status, 200);
  });
});
