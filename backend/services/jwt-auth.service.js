const crypto = require('crypto');

function toBase64Url(value) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function fromBase64Url(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4;
  const withPadding = padding === 0 ? normalized : normalized + '='.repeat(4 - padding);
  return Buffer.from(withPadding, 'base64').toString('utf8');
}

function signHs256(headerPayload, secret) {
  return toBase64Url(crypto.createHmac('sha256', secret).update(headerPayload).digest());
}

function extractBearerToken(headerValue) {
  if (typeof headerValue !== 'string') return null;
  const trimmed = headerValue.trim();
  if (!trimmed.toLowerCase().startsWith('bearer ')) return null;
  const token = trimmed.slice(7).trim();
  return token || null;
}

function parseExpirySeconds(expiresIn) {
  if (typeof expiresIn === 'number' && Number.isFinite(expiresIn) && expiresIn > 0) {
    return Math.floor(expiresIn);
  }

  if (typeof expiresIn === 'string') {
    const trimmed = expiresIn.trim();
    if (/^\d+$/.test(trimmed)) {
      const direct = Number.parseInt(trimmed, 10);
      if (Number.isInteger(direct) && direct > 0) return direct;
    }

    const match = /^(\d+)([smhd])$/.exec(trimmed);
    if (!match) return 7 * 24 * 60 * 60;
    const [, amountRaw, unit] = match;
    const amount = Number.parseInt(amountRaw, 10);
    const multipliers = { s: 1, m: 60, h: 3600, d: 86400 };
    return amount * multipliers[unit];
  }

  return 7 * 24 * 60 * 60;
}

function buildJwtAuthService({ secret, expiresIn = '7d' }) {
  if (typeof secret !== 'string' || secret.trim().length < 16) {
    throw new Error('JWT secret must be at least 16 characters long');
  }

  const ttlSeconds = parseExpirySeconds(expiresIn);

  function issueToken(user) {
    const header = { alg: 'HS256', typ: 'JWT' };
    const nowSec = Math.floor(Date.now() / 1000);
    const payload = {
      sub: String(user.id),
      email: user.email,
      name: user.name,
      iat: nowSec,
      exp: nowSec + ttlSeconds,
    };

    const encodedHeader = toBase64Url(JSON.stringify(header));
    const encodedPayload = toBase64Url(JSON.stringify(payload));
    const headerPayload = `${encodedHeader}.${encodedPayload}`;
    const signature = signHs256(headerPayload, secret);
    return `${headerPayload}.${signature}`;
  }

  function verifyToken(token) {
    if (typeof token !== 'string') throw new Error('Invalid token');
    const parts = token.split('.');
    if (parts.length !== 3) throw new Error('Invalid token');
    const [encodedHeader, encodedPayload, encodedSig] = parts;

    const expected = signHs256(`${encodedHeader}.${encodedPayload}`, secret);
    if (expected !== encodedSig) throw new Error('Invalid signature');

    const header = JSON.parse(fromBase64Url(encodedHeader));
    if (header.alg !== 'HS256' || header.typ !== 'JWT') throw new Error('Invalid header');

    const payload = JSON.parse(fromBase64Url(encodedPayload));
    const nowSec = Math.floor(Date.now() / 1000);
    if (!payload.exp || payload.exp < nowSec) throw new Error('Expired token');

    return payload;
  }

  function authMiddleware(req, res, next) {
    const token = extractBearerToken(req.get('authorization'));
    if (!token) {
      return res.status(401).json({ error: 'Authorization token is required' });
    }

    try {
      const claims = verifyToken(token);
      const userId = Number.parseInt(claims.sub, 10);
      if (!Number.isInteger(userId) || userId <= 0) {
        return res.status(401).json({ error: 'Invalid authorization token' });
      }

      req.auth = {
        userId,
        email: claims.email,
        name: claims.name,
      };

      return next();
    } catch (_err) {
      return res.status(401).json({ error: 'Invalid or expired authorization token' });
    }
  }

  return {
    issueToken,
    verifyToken,
    authMiddleware,
  };
}

module.exports = {
  buildJwtAuthService,
  extractBearerToken,
};
