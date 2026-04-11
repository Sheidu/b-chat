const crypto = require('crypto');

function resolveKeyMaterial(rawKey) {
  if (!rawKey || rawKey.trim() === '') {
    // Development fallback only; override in production.
    return crypto.createHash('sha256').update('family-chat-default-message-key').digest();
  }

  const trimmed = rawKey.trim();
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return Buffer.from(trimmed, 'hex');
  }

  return crypto.createHash('sha256').update(trimmed).digest();
}

function parsePreviousKeys(previousKeys) {
  if (!previousKeys || typeof previousKeys !== 'string') return [];
  return previousKeys
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function createMessageCrypto({ rawKey, previousKeys }) {
  const primaryKey = resolveKeyMaterial(rawKey);
  const fallbackKeys = parsePreviousKeys(previousKeys).map((value) => resolveKeyMaterial(value));
  const allKeys = [primaryKey, ...fallbackKeys];

  function encryptText(plainText) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', primaryKey, iv);
    const encrypted = Buffer.concat([cipher.update(String(plainText), 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    return `enc:v1:${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
  }

  function decryptText(storedText) {
    if (typeof storedText !== 'string' || !storedText.startsWith('enc:v1:')) {
      return storedText;
    }

    const parts = storedText.split(':');
    if (parts.length !== 5) {
      throw new Error('Malformed encrypted payload');
    }

    const iv = Buffer.from(parts[2], 'base64');
    const tag = Buffer.from(parts[3], 'base64');
    const ciphertext = Buffer.from(parts[4], 'base64');
    for (const key of allKeys) {
      try {
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(tag);
        const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
        return decrypted.toString('utf8');
      } catch {
        continue;
      }
    }

    throw new Error('Unable to decrypt payload with available keys');
  }

  return {
    encryptText,
    decryptText,
  };
}

module.exports = {
  createMessageCrypto,
};
