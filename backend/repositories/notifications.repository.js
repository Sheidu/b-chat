function buildNotificationsRepository(db) {
  const enqueueStmt = db.prepare(
    `INSERT INTO outbound_emails (event_type, recipient_email, recipient_phone, subject, body, locale, status, attempts, next_attempt_at)
     VALUES (?, ?, ?, ?, ?, ?, 'queued', 0, CURRENT_TIMESTAMP)`
  );
  const pullQueuedStmt = db.prepare(
    `SELECT * FROM outbound_emails
     WHERE status IN ('queued','retry')
       AND datetime(next_attempt_at) <= datetime('now')
     ORDER BY id ASC LIMIT 20`
  );
  const markSentStmt = db.prepare("UPDATE outbound_emails SET status='sent', sent_at=CURRENT_TIMESTAMP WHERE id=?");
  const markRetryStmt = db.prepare("UPDATE outbound_emails SET status='retry', attempts=attempts+1, last_error=?, next_attempt_at=datetime('now', '+5 minutes') WHERE id=?");
  const markDeadStmt = db.prepare("UPDATE outbound_emails SET status='dead_letter', attempts=attempts+1, last_error=? WHERE id=?");

  return {
    enqueueEmail(payload) {
      return enqueueStmt.run(
        payload.eventType,
        payload.recipientEmail,
        payload.recipientPhone || null,
        payload.subject,
        payload.body,
        payload.locale || 'ru'
      );
    },
    listQueued(_limit = 20) {
      return pullQueuedStmt.all();
    },
    markSent(id) { return markSentStmt.run(id); },
    markRetry(id, error) { return markRetryStmt.run(error, id); },
    markDeadLetter(id, error) { return markDeadStmt.run(error, id); },
  };
}

module.exports = { buildNotificationsRepository };
