const test = require('node:test');
const assert = require('node:assert/strict');
const { buildMessagesService } = require('../services/messages.service');
const { createMessageCrypto } = require('../security/message-crypto');

test('messages service encrypts stored text and decrypts on read', () => {
  const stored = [];
  const messagesRepository = {
    createMessage(fromId, toId, text, clientToken) {
      stored.push({ from_id: fromId, to_id: toId, text, client_token: clientToken, timestamp: 'now' });
      return { lastInsertRowid: 1 };
    },
    listMessagesBetweenUsers() {
      return [{ id: 1, ...stored[0] }];
    },
  };

  const messageCrypto = createMessageCrypto({ rawKey: 'test-key' });
  const service = buildMessagesService({ messagesRepository, messageCrypto });

  const created = service.createMessage({ from: 1, to: 2, text: 'secret hello', clientToken: 'abc' });
  assert.equal(created.text, 'secret hello');
  assert.ok(stored[0].text.startsWith('enc:v1:'));

  const listed = service.listConversation(1, 2);
  assert.equal(listed.status, 200);
  assert.equal(listed.body[0].text, 'secret hello');
});
