function buildInMemoryRateLimitStore() {
  const attempts = new Map();

  function pruneExpired(now) {
    for (const [key, entry] of attempts.entries()) {
      if (entry.resetAt <= now) attempts.delete(key);
    }
  }

  return {
    consume({ bucketKey, windowMs, now = Date.now() }) {
      pruneExpired(now);
      const entry = attempts.get(bucketKey) || { count: 0, resetAt: now + windowMs };
      if (entry.resetAt <= now) {
        entry.count = 0;
        entry.resetAt = now + windowMs;
      }
      entry.count += 1;
      attempts.set(bucketKey, entry);
      return { count: entry.count, resetAt: entry.resetAt };
    },
  };
}

function getClientIp(req) {
  return req.ip || req.connection?.remoteAddress || 'unknown';
}

function getRouteKey(req) {
  if (typeof req.baseUrl === 'string' && req.baseUrl.trim()) return req.baseUrl;
  if (typeof req.path === 'string' && req.path.trim()) return req.path;
  if (typeof req.originalUrl === 'string' && req.originalUrl.trim()) return req.originalUrl.split('?')[0];
  return 'unknown-route';
}

function createRateLimitMiddleware({
  rateLimitStore = buildInMemoryRateLimitStore(),
  windowMs = 60_000,
  maxAttempts = 12,
  scope = 'auth',
  errorMessage = 'Too many attempts. Please retry later.',
} = {}) {
  return function rateLimit(req, res, next) {
    const bucketKey = `${scope}:${getClientIp(req)}:${getRouteKey(req)}`;
    const result = rateLimitStore.consume({ bucketKey, windowMs });

    const remaining = Math.max(0, maxAttempts - result.count);
    res.setHeader('X-RateLimit-Limit', String(maxAttempts));
    res.setHeader('X-RateLimit-Remaining', String(remaining));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(result.resetAt / 1000)));

    if (result.count > maxAttempts) {
      return res.status(429).json({ error: errorMessage });
    }

    return next();
  };
}

module.exports = {
  buildInMemoryRateLimitStore,
  createRateLimitMiddleware,
};
