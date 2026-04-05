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

test('GET /messages returns 400 for malformed path params', async () => {
  const app = createApp({
    authService: {},
    usersService: { listUsers: () => ({ status: 200, body: [] }) },
    messagesService: { listConversation: () => ({ status: 400, body: { error: 'Invalid participant ids' } }) },
    corsAllowlist: 'http://localhost:3000',
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/messages/not-a-number/2`);
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: 'Invalid participant ids' });
  });
});
