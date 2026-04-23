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
