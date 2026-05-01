const test = require('node:test');
const assert = require('node:assert/strict');
const { buildJwtAuthService, extractBearerToken } = require('../services/jwt-auth.service');

test('jwt service issues and verifies token', () => {
  const service = buildJwtAuthService({ secret: 'very-secret-key-12345', expiresIn: '1h' });
  const token = service.issueToken({ id: 4, email: 'a@example.ru', name: 'Alice' });
  const claims = service.verifyToken(token);
  assert.equal(claims.sub, '4');
  assert.equal(claims.email, 'a@example.ru');
});

test('extractBearerToken parses valid token header', () => {
  assert.equal(extractBearerToken('Bearer abc.def'), 'abc.def');
  assert.equal(extractBearerToken('Basic token'), null);
});


test('jwt service treats 7d as days, not seconds', () => {
  const service = buildJwtAuthService({ secret: 'very-secret-key-12345', expiresIn: '7d' });
  const token = service.issueToken({ id: 1, email: 'u@example.ru', name: 'U' });
  const claims = service.verifyToken(token);
  const ttl = claims.exp - claims.iat;
  assert.equal(ttl, 7 * 24 * 60 * 60);
});
