const test = require('node:test');
const assert = require('node:assert/strict');
const { buildUsersService } = require('../services/users.service');

test('users service returns authenticated contact list', () => {
  const service = buildUsersService({
    usersRepository: {
      listContactsForUser(userId) {
        assert.equal(userId, 9);
        return [{ id: 1, email: 'a@example.ru', name: 'Alice' }];
      },
    },
  });

  const result = service.listUsers(9);
  assert.equal(result.status, 200);
  assert.equal(result.body.length, 1);
});

test('users service discovers users excluding contacts', () => {
  const service = buildUsersService({
    usersRepository: {
      listDiscoverUsers(userId) {
        assert.equal(userId, 9);
        return [{ id: 2, email: 'b@example.ru', name: 'Bob' }];
      },
    },
  });

  const result = service.discoverUsers(9);
  assert.equal(result.status, 200);
  assert.equal(result.body[0].id, 2);
});

test('users service adds contact with nickname', () => {
  const calls = [];
  const service = buildUsersService({
    usersRepository: {
      findUserById(userId) {
        if (userId === 2) return { id: 2, email: 'b@example.ru' };
        return null;
      },
      addContact(ownerId, contactId, nickname) {
        calls.push({ ownerId, contactId, nickname });
        return { changes: 1 };
      },
      updateContactNickname() {
        throw new Error('should not update nickname when insert succeeds');
      },
    },
  });

  const result = service.addContact({ ownerId: 1, contactId: 2, nickname: 'Bobby' });
  assert.equal(result.status, 201);
  assert.deepEqual(calls[0], { ownerId: 1, contactId: 2, nickname: 'Bobby' });
});

test('users service deletes current user and logs compliance event', () => {
  const events = [];
  const service = buildUsersService({
    usersRepository: {
      findUserById() {
        return { id: 4, email: 'u@example.ru', auth_channel: 'email' };
      },
      deleteUserData(userId, options) {
        assert.equal(userId, 4);
        assert.equal(options.hardDelete, true);
      },
    },
    complianceRepository: {
      createEvent(payload) {
        events.push(payload);
      },
    },
    hardDeleteUsers: true,
  });

  const result = service.deleteCurrentUser({ userId: 4, context: { ipAddress: '127.0.0.1' } });
  assert.equal(result.status, 200);
  assert.equal(result.body.mode, 'hard_delete');
  assert.equal(events[0].eventType, 'delete');
});

test('users service bumps token version and returns fresh token after profile update', () => {
  const issued = [];
  const service = buildUsersService({
    usersRepository: {
      findUserById(userId) {
        assert.equal(userId, 7);
        return { id: 7, email: 'old@example.ru', phone_number: '+79990000000', name: 'Old', auth_channel: 'email', token_version: 3 };
      },
      findUserByEmailOrPhone() {
        return null;
      },
      updateUserProfile(userId, email, phoneNumber, name) {
        assert.equal(userId, 7);
        assert.equal(email, 'new@example.ru');
        assert.equal(phoneNumber, '+79990000001');
        assert.equal(name, 'New');
        return { id: 7, email, phone_number: phoneNumber, name, auth_channel: 'email', token_version: 4 };
      },
    },
    jwtAuthService: {
      issueToken(user) {
        issued.push(user);
        return `token-v${user.tokenVersion}`;
      },
    },
  });

  const result = service.updateCurrentUser({
    userId: 7,
    email: 'New@Example.RU',
    phoneNumber: '+7 999 000 00 01',
    name: 'New',
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.token, 'token-v4');
  assert.equal(result.body.user.tokenVersion, 4);
  assert.equal(issued[0].tokenVersion, 4);
});
