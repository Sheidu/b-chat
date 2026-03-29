const test = require('node:test');
const assert = require('node:assert/strict');
const { buildAuthService } = require('../services/auth.service');

function createUsersRepoStub(overrides = {}) {
  return {
    findUserIdByEmail: () => null,
    createUser: () => ({ lastInsertRowid: 101 }),
    findUserByEmail: () => null,
    upgradePasswordHash: () => ({}),
    ...overrides,
  };
}

test('register hashes password and emits usersChanged hook', () => {
  let emittedUser = null;
  let savedHash = null;

  const usersRepository = createUsersRepoStub({
    createUser: (_email, passwordHash) => {
      savedHash = passwordHash;
      return { lastInsertRowid: 77 };
    },
  });

  const authService = buildAuthService({
    usersRepository,
    bcryptSaltRounds: 4,
    onUserRegistered: (user) => {
      emittedUser = user;
    },
  });

  const result = authService.register({
    email: 'alice@example.com',
    password: 'plain-secret',
    name: 'Alice',
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.id, 77);
  assert.equal(result.body.email, 'alice@example.com');
  assert.equal(result.body.name, 'Alice');
  assert.ok(savedHash.startsWith('$2'));
  assert.notEqual(savedHash, 'plain-secret');
  assert.deepEqual(emittedUser, result.body);
});

test('login upgrades legacy plaintext password rows', () => {
  let upgradedHash = null;
  let upgradedUserId = null;

  const usersRepository = createUsersRepoStub({
    findUserByEmail: () => ({
      id: 5,
      email: 'legacy@example.com',
      name: 'Legacy User',
      password: 'legacy-plaintext',
    }),
    upgradePasswordHash: (userId, passwordHash) => {
      upgradedUserId = userId;
      upgradedHash = passwordHash;
      return { changes: 1 };
    },
  });

  const authService = buildAuthService({
    usersRepository,
    bcryptSaltRounds: 4,
  });

  const result = authService.login({
    email: 'legacy@example.com',
    password: 'legacy-plaintext',
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.id, 5);
  assert.equal(upgradedUserId, 5);
  assert.ok(typeof upgradedHash === 'string');
  assert.ok(upgradedHash.startsWith('$2'));
});

test('login rejects invalid credentials', () => {
  const usersRepository = createUsersRepoStub({
    findUserByEmail: () => ({
      id: 9,
      email: 'bob@example.com',
      name: 'Bob',
      password: 'wrong-password',
    }),
  });

  const authService = buildAuthService({
    usersRepository,
    bcryptSaltRounds: 4,
  });

  const result = authService.login({
    email: 'bob@example.com',
    password: 'expected-password',
  });

  assert.equal(result.status, 401);
  assert.deepEqual(result.body, { error: 'Invalid email or password' });
});
