function createAuthRateLimitMiddleware({ windowMs = 60_000, maxAttempts = 12 } = {}) {
  const attempts = new Map();

  function getClientIp(req) {
    return req.ip || req.connection?.remoteAddress || 'unknown';
  }

  function getRouteKey(req) {
    if (typeof req.baseUrl === 'string' && req.baseUrl.trim()) {
      return req.baseUrl;
    }
    if (typeof req.path === 'string' && req.path.trim()) {
      return req.path;
    }
    if (typeof req.originalUrl === 'string' && req.originalUrl.trim()) {
      return req.originalUrl.split('?')[0];
    }
    return 'unknown-route';
  }

  function pruneExpired(now) {
    for (const [key, entry] of attempts.entries()) {
      if (entry.resetAt <= now) {
        attempts.delete(key);
      }
    }
  }

  return function authRateLimit(req, res, next) {
    const now = Date.now();
    pruneExpired(now);

    const clientIp = getClientIp(req);
    const routeKey = getRouteKey(req);
    const bucketKey = `${clientIp}:${routeKey}`;
    const entry = attempts.get(bucketKey) || { count: 0, resetAt: now + windowMs };

    if (entry.resetAt <= now) {
      entry.count = 0;
      entry.resetAt = now + windowMs;
    }

    entry.count += 1;
    attempts.set(bucketKey, entry);

    const remaining = Math.max(0, maxAttempts - entry.count);
    res.setHeader('X-RateLimit-Limit', String(maxAttempts));
    res.setHeader('X-RateLimit-Remaining', String(remaining));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));

    if (entry.count > maxAttempts) {
      return res.status(429).json({ error: 'Too many auth attempts. Please retry later.' });
    }

    return next();
  };
}

module.exports = {
  createAuthRateLimitMiddleware,
};
