const fs = require('fs');

function ensureEnvFile({ envPath, envExamplePath }) {
  if (fs.existsSync(envPath)) return;

  if (fs.existsSync(envExamplePath)) {
    try {
      fs.copyFileSync(envExamplePath, envPath);
      console.log('.env created from .env.example. Please update secrets!');
      return;
    } catch (_err) {
      console.log('No .env and no .env.example found');
      return;
    }
  }

  console.log('No .env and no .env.example found');
}

function runProductionHardeningChecks({ nodeEnv, messageEncryptionKey, corsAllowlist, sessionCookieSecure }) {
  if (nodeEnv !== 'production') return;

  if (!messageEncryptionKey || messageEncryptionKey.length < 32) {
    throw new Error('MESSAGE_ENCRYPTION_KEY must be set to at least 32 chars in production');
  }

  if (!corsAllowlist.trim()) {
    throw new Error('CORS_ALLOWLIST must be configured in production');
  }

  if (sessionCookieSecure !== 'true') {
    console.warn('SESSION_COOKIE_SECURE should be true in production. Current value:', sessionCookieSecure);
  }
}

module.exports = {
  ensureEnvFile,
  runProductionHardeningChecks,
};
