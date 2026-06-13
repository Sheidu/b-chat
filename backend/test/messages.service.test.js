const test = require('node:test');
const assert = require('node:assert/strict');
const { buildMessagesService } = require('../services/messages.service');
const { createMessageCrypto } = require('../security/message-crypto');

test('messages service encrypts stored text and decrypts on read', () => {
  const stored = [];
  const messagesRepository = {
    createMessage(fromId, toId, text, clientToken) {
      stored.push({ id: 1, from_id: fromId, to_id: toId, text, client_token: clientToken, timestamp: 'now' });
      return { lastInsertRowid: 1 };
    },
    listMessagesBetweenUsers() {
      return [{ ...stored[0] }];
    },
    findMessageByConversationClientToken(_fromId, _toId, token) {
      return stored.find((message) => message.client_token === token) || null;
    },
  };

  const messageCrypto = createMessageCrypto({ rawKey: 'test-key' });
  const service = buildMessagesService({ messagesRepository, messageCrypto });

  const created = service.createMessage({ from: 1, to: 2, text: 'secret hello', clientToken: 'abc' });
  assert.equal(created.status, 201);
  assert.equal(created.body.text, 'secret hello');
  assert.ok(stored[0].text.startsWith('enc:v1:'));

  const listed = service.listConversation(1, 2, { requesterUserId: 1 });
  assert.equal(listed.status, 200);
  assert.equal(listed.body[0].text, 'secret hello');
});

test('messages service validates malformed and boundary payloads', () => {
  const service = buildMessagesService({
    messagesRepository: {
      createMessage() {
        throw new Error('should not write invalid messages');
      },
      listMessagesBetweenUsers() {
        return [];
      },
      findMessageByConversationClientToken() {
        return null;
      },
    },
    messageCrypto: null,
  });

  assert.equal(service.createMessage({ from: 'x', to: 2, text: 'ok' }).status, 400);
  assert.equal(service.createMessage({ from: 1, to: 2, text: '' }).status, 400);
  assert.equal(service.createMessage({ from: 1, to: 2, text: 'a'.repeat(4001) }).status, 400);
  assert.equal(service.createMessage({ from: 1, to: 2, text: 'ok', clientToken: 'a'.repeat(129) }).status, 400);
  assert.equal(service.listConversation('nan', 2, { requesterUserId: 2 }).status, 400);
  assert.equal(service.listConversation(1, 2, { requesterUserId: 3 }).status, 403);
  assert.equal(service.listConversation(1, 2, { requesterUserId: 1, limit: '0' }).status, 400);
});

test('messages service returns existing message for duplicate client token', () => {
  const duplicateErr = new Error('UNIQUE constraint failed: messages.client_token');
  const stored = {
    id: 3,
    from_id: 1,
    to_id: 2,
    text: 'persisted',
    client_token: 'dup-token',
    timestamp: new Date().toISOString(),
  };

  const service = buildMessagesService({
    messagesRepository: {
      createMessage() {
        throw duplicateErr;
      },
      listMessagesBetweenUsers() {
        return [];
      },
      findMessageByConversationClientToken() {
        return stored;
      },
    },
    messageCrypto: null,
  });

  const result = service.createMessage({ from: 1, to: 2, text: 'persisted', clientToken: 'dup-token' });
  assert.equal(result.status, 200);
  assert.equal(result.body.id, 3);
});


test('messages service rejects duplicate client token from a different conversation', () => {
  const duplicateErr = new Error('UNIQUE constraint failed: messages.from_id, messages.to_id, messages.client_token');

  const service = buildMessagesService({
    messagesRepository: {
      createMessage() {
        throw duplicateErr;
      },
      listMessagesBetweenUsers() {
        return [];
      },
      findMessageByConversationClientToken() {
        return { id: 4, from_id: 9, to_id: 2, text: 'other', client_token: 'dup-token' };
      },
    },
    messageCrypto: null,
  });

  assert.throws(
    () => service.createMessage({ from: 1, to: 2, text: 'persisted', clientToken: 'dup-token' }),
    /UNIQUE constraint failed/
  );
});
