function createCorsOptions({ corsAllowlist }) {
  const allowedOrigins = (corsAllowlist || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (allowedOrigins.length === 0) {
    return { origin: false };
  }

  return {
    origin(origin, callback) {
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
  return (corsAllowlist || '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
}

module.exports = {
  createCorsOptions,
  parseCorsOrigins,
};
