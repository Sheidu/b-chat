const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { createApp } = require('../app');
const { createRateLimitMiddleware } = require('../services/auth-rate-limit.service');

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

test('POST /register is rate-limited after max attempts', async () => {
  const app = createApp({
    authService: {
      register() {
        return { status: 400, body: { error: 'forced' } };
      },
      login() {
        return { status: 401, body: { error: 'forced' } };
      },
    },
    usersService: { listUsers: () => ({ status: 200, body: [] }) },
    messagesService: { listConversation: () => ({ status: 200, body: [] }) },
    corsAllowlist: 'http://localhost:3000',
    rateLimitMiddleware: createRateLimitMiddleware({ windowMs: 60_000, maxAttempts: 2, errorMessage: 'Too many auth attempts. Please retry later.' }),
  });

  await withServer(app, async (baseUrl) => {
    const payload = { email: 'u@example.ru', password: '1234', termsAccepted: true };
    const first = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    assert.equal(first.status, 400);

    const second = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    assert.equal(second.status, 400);

    const third = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    assert.equal(third.status, 429);
    assert.deepEqual(await third.json(), { error: 'Too many auth attempts. Please retry later.' });
  });
});

test('register and login use separate rate-limit buckets', async () => {
  const app = createApp({
    authService: {
      register() {
        return { status: 400, body: { error: 'forced' } };
      },
      login() {
        return { status: 401, body: { error: 'forced' } };
      },
    },
    usersService: { listUsers: () => ({ status: 200, body: [] }) },
    messagesService: { listConversation: () => ({ status: 200, body: [] }) },
    corsAllowlist: 'http://localhost:3000',
    rateLimitMiddleware: createRateLimitMiddleware({ windowMs: 60_000, maxAttempts: 2, errorMessage: 'Too many auth attempts. Please retry later.' }),
  });

  await withServer(app, async (baseUrl) => {
    const registerPayload = { email: 'r@example.ru', password: '1234', termsAccepted: true };
    const loginPayload = { email: 'l@example.ru', password: '1234' };

    const reg1 = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(registerPayload),
    });
    assert.equal(reg1.status, 400);

    const reg2 = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(registerPayload),
    });
    assert.equal(reg2.status, 400);

    const reg3 = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(registerPayload),
    });
    assert.equal(reg3.status, 429);

    const login1 = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(loginPayload),
    });
    assert.equal(login1.status, 401);

    const login2 = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(loginPayload),
    });
    assert.equal(login2.status, 401);
  });
});
