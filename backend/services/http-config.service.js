function parseConfiguredOrigins(corsAllowlist) {
  return (corsAllowlist || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function isLoopbackDevOrigin(origin) {
  if (!origin) return true;
  try {
    const parsed = new URL(origin);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    return parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || parsed.hostname === '[::1]';
  } catch (_err) {
    return false;
  }
}

function createCorsOptions({ corsAllowlist }) {
  const allowedOrigins = parseConfiguredOrigins(corsAllowlist);

  return {
    origin(origin, callback) {
      if (allowedOrigins.length === 0) {
        if (isLoopbackDevOrigin(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error('Origin not allowed by development CORS defaults'));
        return;
      }

      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('Origin not allowed by CORS allowlist'));
    },
    credentials: true,
  };
}

function parseCorsOrigins(corsAllowlist) {
  const allowedOrigins = parseConfiguredOrigins(corsAllowlist);
  if (allowedOrigins.length > 0) return allowedOrigins;

  return [
    /^https?:\/\/localhost(?::\d+)?$/,
    /^https?:\/\/127\.0\.0\.1(?::\d+)?$/,
    /^https?:\/\/\[::1\](?::\d+)?$/,
  ];
}

module.exports = {
  createCorsOptions,
  parseCorsOrigins,
  isLoopbackDevOrigin,
};
