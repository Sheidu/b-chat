const test = require('node:test');
const assert = require('node:assert/strict');
const { createCorsOptions, parseCorsOrigins, isLoopbackDevOrigin } = require('../services/http-config.service');

function checkOrigin(options, origin) {
  return new Promise((resolve) => {
    options.origin(origin, (err, allowed) => resolve({ err, allowed }));
  });
}

test('development CORS defaults allow localhost ports when allowlist is empty', async () => {
  const options = createCorsOptions({ corsAllowlist: '' });

  assert.deepEqual(await checkOrigin(options, 'http://localhost:62615'), { err: null, allowed: true });
  assert.deepEqual(await checkOrigin(options, 'http://127.0.0.1:62615'), { err: null, allowed: true });
  assert.deepEqual(await checkOrigin(options, undefined), { err: null, allowed: true });
});

test('development CORS defaults reject non-loopback origins when allowlist is empty', async () => {
  const options = createCorsOptions({ corsAllowlist: '' });
  const result = await checkOrigin(options, 'https://example.com');

  assert.equal(result.allowed, undefined);
  assert.match(result.err.message, /development CORS defaults/);
});

test('configured CORS allowlist remains exact-match only', async () => {
  const options = createCorsOptions({ corsAllowlist: 'https://chat.example.com,http://localhost:5000' });

  assert.deepEqual(await checkOrigin(options, 'http://localhost:5000'), { err: null, allowed: true });

  const rejected = await checkOrigin(options, 'http://localhost:62615');
  assert.equal(rejected.allowed, undefined);
  assert.match(rejected.err.message, /CORS allowlist/);
});

test('socket CORS origins use loopback regex defaults when allowlist is empty', () => {
  const origins = parseCorsOrigins('');

  assert.equal(origins.some((origin) => origin.test('http://localhost:62615')), true);
  assert.equal(origins.some((origin) => origin.test('https://127.0.0.1:62615')), true);
});

test('loopback origin helper only accepts http/https localhost addresses', () => {
  assert.equal(isLoopbackDevOrigin('http://localhost:62615'), true);
  assert.equal(isLoopbackDevOrigin('https://127.0.0.1:3000'), true);
  assert.equal(isLoopbackDevOrigin('ftp://localhost:3000'), false);
  assert.equal(isLoopbackDevOrigin('https://example.com'), false);
});
