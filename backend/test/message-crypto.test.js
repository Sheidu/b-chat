const test = require('node:test');
const assert = require('node:assert/strict');
const { createMessageCrypto } = require('../security/message-crypto');

test('decrypt supports previous keys for rotation scenarios', () => {
  const oldCrypto = createMessageCrypto({ rawKey: 'old-secret-key', previousKeys: '' });
  const encryptedWithOld = oldCrypto.encryptText('family message');

  const rotatedCrypto = createMessageCrypto({
    rawKey: 'new-secret-key',
    previousKeys: 'old-secret-key',
  });

  assert.equal(rotatedCrypto.decryptText(encryptedWithOld), 'family message');
});

test('decrypt throws when payload cannot be decrypted by current or previous keys', () => {
  const oldCrypto = createMessageCrypto({ rawKey: 'old-secret-key', previousKeys: '' });
  const encryptedWithOld = oldCrypto.encryptText('family message');

  const unrelatedCrypto = createMessageCrypto({
    rawKey: 'another-key',
    previousKeys: '',
  });

  assert.throws(() => unrelatedCrypto.decryptText(encryptedWithOld), /Unable to decrypt payload/);
});
