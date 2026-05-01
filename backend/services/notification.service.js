const fs = require('fs');
const path = require('path');

function loadLocale(locale) {
  const safe = locale === 'en' ? 'en' : 'ru';
  const file = path.join(__dirname, '..', 'locales', `email.${safe}.json`);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function buildNotificationService({ notificationsRepository, senderEmail = 'noreply@localhost' }) {
  function enqueueWelcomeEmail({ email, phoneNumber, name, locale = 'ru' }) {
    const dict = loadLocale(locale);
    const subject = dict.welcome_subject;
    const body = dict.welcome_body.replace('{name}', name || (locale === 'en' ? 'friend' : 'пользователь'));
    notificationsRepository.enqueueEmail({
      eventType: 'welcome_registered', recipientEmail: email, recipientPhone: phoneNumber, subject, body, locale,
    });
  }

  function processQueue({ transport }) {
    if (!transport || typeof transport.send !== 'function') return;
    const queued = notificationsRepository.listQueued(20);
    for (const row of queued) {
      try {
        transport.send({ from: senderEmail, to: row.recipient_email, subject: row.subject, text: row.body });
        notificationsRepository.markSent(row.id);
      } catch (err) {
        if ((row.attempts || 0) >= 4) notificationsRepository.markDeadLetter(row.id, String(err.message || err));
        else notificationsRepository.markRetry(row.id, String(err.message || err));
      }
    }
  }

  return { enqueueWelcomeEmail, processQueue };
}

module.exports = { buildNotificationService };
