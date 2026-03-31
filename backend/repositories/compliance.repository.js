function buildComplianceRepository(db) {
  const createEventStmt = db.prepare(`
    INSERT INTO compliance_events (
      event_type,
      status,
      user_id,
      email,
      auth_channel,
      reason,
      ip_address,
      user_agent
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  return {
    createEvent({
      eventType,
      status,
      userId,
      email,
      authChannel,
      reason,
      ipAddress,
      userAgent,
    }) {
      return createEventStmt.run(
        eventType,
        status,
        userId || null,
        email || null,
        authChannel || null,
        reason || null,
        ipAddress || null,
        userAgent || null
      );
    },
  };
}

module.exports = {
  buildComplianceRepository,
};
