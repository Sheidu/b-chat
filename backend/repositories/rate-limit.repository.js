function buildRateLimitRepository(db) {
  const getStmt = db.prepare('SELECT count, reset_at_ms FROM rate_limit_buckets WHERE bucket_key = ?');
  const upsertStmt = db.prepare(`
    INSERT INTO rate_limit_buckets(bucket_key, count, reset_at_ms, updated_at_ms)
    VALUES(?, ?, ?, ?)
    ON CONFLICT(bucket_key) DO UPDATE SET
      count=excluded.count,
      reset_at_ms=excluded.reset_at_ms,
      updated_at_ms=excluded.updated_at_ms
  `);
  const pruneStmt = db.prepare('DELETE FROM rate_limit_buckets WHERE reset_at_ms <= ?');

  return {
    consume({ bucketKey, windowMs, now = Date.now() }) {
      pruneStmt.run(now);
      const existing = getStmt.get(bucketKey);
      let count = 1;
      let resetAt = now + windowMs;
      if (existing && existing.reset_at_ms > now) {
        count = existing.count + 1;
        resetAt = existing.reset_at_ms;
      }
      upsertStmt.run(bucketKey, count, resetAt, now);
      return { count, resetAt };
    },
  };
}

module.exports = {
  buildRateLimitRepository,
};
