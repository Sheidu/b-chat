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

function createComplianceRepoStub() {
  const events = [];
  return {
    events,
    createEvent(payload) {
      events.push(payload);
      return { lastInsertRowid: events.length };
    },
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

  const complianceRepository = createComplianceRepoStub();

  const authService = buildAuthService({
    usersRepository,
    complianceRepository,
    bcryptSaltRounds: 4,
    registrationPolicy: 'strict_ru_email',
    jwtAuthService: { issueToken: () => 'test-jwt' },
    onUserRegistered: (user) => {
      emittedUser = user;
    },
  });

  const result = authService.register({
    email: 'alice@example.ru',
    password: 'plain-secret',
    name: 'Alice',
    termsAccepted: true,
    consentText: 'consent',
    authChannel: 'email',
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.id, 77);
  assert.equal(result.body.email, 'alice@example.ru');
  assert.equal(result.body.name, 'Alice');
  assert.ok(savedHash.startsWith('$2'));
  assert.notEqual(savedHash, 'plain-secret');
  assert.equal(result.body.token, 'test-jwt');
  assert.equal(emittedUser.id, result.body.id);
  assert.equal(emittedUser.email, result.body.email);
  assert.equal(complianceRepository.events.length, 1);
  assert.equal(complianceRepository.events[0].status, 'accepted');
});

test('register rejects missing terms acceptance', () => {
  const usersRepository = createUsersRepoStub();
  const complianceRepository = createComplianceRepoStub();

  const authService = buildAuthService({
    usersRepository,
    complianceRepository,
    bcryptSaltRounds: 4,
    registrationPolicy: 'strict_ru_email',
  });

  const result = authService.register({
    email: 'alice@example.ru',
    password: 'plain-secret',
    name: 'Alice',
    termsAccepted: false,
    consentText: 'consent',
    authChannel: 'email',
  });

  assert.equal(result.status, 400);
  assert.equal(result.body.error, 'User agreement acceptance is required');
  assert.equal(complianceRepository.events[0].reason, 'terms_not_accepted');
});

test('register rejects missing consent text', () => {
  const authService = buildAuthService({
    usersRepository: createUsersRepoStub(),
    complianceRepository: createComplianceRepoStub(),
    bcryptSaltRounds: 4,
    registrationPolicy: 'strict_ru_email',
  });

  const result = authService.register({
    email: 'alice@example.ru',
    password: 'plain-secret',
    termsAccepted: true,
    consentText: '',
    authChannel: 'email',
  });

  assert.equal(result.status, 400);
  assert.equal(result.body.error, 'Consent text is required');
});

test('register rejects non-ru email domains in strict mode', () => {
  const usersRepository = createUsersRepoStub();

  const authService = buildAuthService({
    usersRepository,
    complianceRepository: createComplianceRepoStub(),
    bcryptSaltRounds: 4,
    registrationPolicy: 'strict_ru_email',
  });

  const result = authService.register({
    email: 'alice@example.com',
    password: 'plain-secret',
    name: 'Alice',
    termsAccepted: true,
    consentText: 'consent',
    authChannel: 'email',
  });

  assert.equal(result.status, 400);
  assert.equal(result.body.error, 'Only .ru/.рф email domains are allowed by current policy');
});

test('login upgrades legacy plaintext password rows', () => {
  let upgradedHash = null;
  let upgradedUserId = null;

  const usersRepository = createUsersRepoStub({
    findUserByEmail: () => ({
      id: 5,
      email: 'legacy@example.ru',
      name: 'Legacy User',
      password: 'legacy-plaintext',
      auth_channel: 'email',
    }),
    upgradePasswordHash: (userId, passwordHash) => {
      upgradedUserId = userId;
      upgradedHash = passwordHash;
      return { changes: 1 };
    },
  });

  const authService = buildAuthService({
    usersRepository,
    complianceRepository: createComplianceRepoStub(),
    bcryptSaltRounds: 4,
    registrationPolicy: 'strict_ru_email',
  });

  const result = authService.login({
    email: 'legacy@example.ru',
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
      email: 'bob@example.ru',
      name: 'Bob',
      password: 'wrong-password',
      auth_channel: 'email',
    }),
  });

  const authService = buildAuthService({
    usersRepository,
    complianceRepository: createComplianceRepoStub(),
    bcryptSaltRounds: 4,
    registrationPolicy: 'strict_ru_email',
  });

  const result = authService.login({
    email: 'bob@example.ru',
    password: 'expected-password',
  });

  assert.equal(result.status, 401);
  assert.deepEqual(result.body, { error: 'Invalid email or password' });
});


test('register rejects malformed payloads and boundary conditions', () => {
  const authService = buildAuthService({
    usersRepository: createUsersRepoStub(),
    complianceRepository: createComplianceRepoStub(),
    bcryptSaltRounds: 4,
    registrationPolicy: 'strict_ru_email',
  });

  assert.equal(
    authService.register({
      email: null,
      password: 'x',
      termsAccepted: true,
      consentText: 'consent',
      authChannel: 'email',
    }).status,
    400
  );
  assert.equal(
    authService.register({
      email: 'valid@example.ru',
      password: '',
      termsAccepted: true,
      consentText: 'consent',
      authChannel: 'email',
    }).status,
    400
  );
  assert.equal(
    authService.register({
      email: 'valid@example.ru',
      password: 'x',
      termsAccepted: true,
      consentText: 'consent',
      authChannel: 'sms',
    }).status,
    400
  );
});

test('login rejects malformed payloads', () => {
  const authService = buildAuthService({
    usersRepository: createUsersRepoStub(),
    complianceRepository: createComplianceRepoStub(),
    bcryptSaltRounds: 4,
    registrationPolicy: 'strict_ru_email',
  });

  assert.equal(authService.login({ email: ' ', password: 'x' }).status, 400);
  assert.equal(authService.login({ email: 'user@example.ru', password: null }).status, 400);
  assert.equal(authService.login({ email: 'user@example.com', password: 'x' }).status, 400);
});

test('register rejects invalid email format', () => {
  const authService = buildAuthService({
    usersRepository: createUsersRepoStub(),
    complianceRepository: createComplianceRepoStub(),
    bcryptSaltRounds: 4,
    registrationPolicy: 'strict_ru_email',
  });

  const result = authService.register({
    email: 'not-an-email',
    password: 'secret',
    termsAccepted: true,
    consentText: 'consent',
    authChannel: 'email',
  });

  assert.equal(result.status, 400);
  assert.equal(result.body.error, 'Invalid email format');
});

test('open_email policy allows non-ru email domains', () => {
  const authService = buildAuthService({
    usersRepository: createUsersRepoStub(),
    complianceRepository: createComplianceRepoStub(),
    bcryptSaltRounds: 4,
    registrationPolicy: 'open_email',
  });

  const result = authService.register({
    email: 'alice@example.com',
    password: 'secret',
    termsAccepted: true,
    consentText: 'consent',
    authChannel: 'email',
  });

  assert.equal(result.status, 200);
});
