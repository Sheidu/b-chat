# Production hardening checklist

## CORS allowlist (required)

Set `CORS_ALLOWLIST` to a comma-separated list of trusted origins, for example:

```bash
CORS_ALLOWLIST=https://chat.example.com,https://admin.example.com
```

In production, backend startup fails when this allowlist is empty.

## Secure cookie/session strategy

This project currently uses stateless API auth responses (no server-issued cookie session yet).

When introducing cookie sessions/JWT cookies in production:

1. Set `SESSION_COOKIE_SECURE=true`.
2. Use `HttpOnly`, `Secure`, and `SameSite=Lax` (or `Strict`) cookie flags.
3. Keep session TTL short and rotate session identifiers on login.
4. Separate session signing/encryption keys from message encryption keys.

## Auth abuse controls

Auth endpoints are rate-limited in app process using:

- `AUTH_RATE_LIMIT_WINDOW_MS` (default `60000`)
- `AUTH_RATE_LIMIT_MAX_ATTEMPTS` (default `12`)

For multi-instance deployments, replace or supplement this with a shared limiter backend (for example Redis-based rate limiting) so limits are enforced cluster-wide.

## Consent evidence configuration

Set `USER_AGREEMENT_URL` to the canonical legal page used during registration. This URL is stored with consent evidence (`terms_url`) and should match your published agreement location.

## Secret rotation

Rotate secrets regularly and after any suspected leak:

- `MESSAGE_ENCRYPTION_KEY`
- `MESSAGE_ENCRYPTION_PREVIOUS_KEYS` (temporary rollover set)
- Any future session/JWT signing keys
- DB credentials (if moved off SQLite)

Recommended process:

1. Generate a new 32+ character secret in your secret manager.
2. Deploy backend with:
   - `MESSAGE_ENCRYPTION_KEY=<new key>`
   - `MESSAGE_ENCRYPTION_PREVIOUS_KEYS=<old key[,older key...]>`
3. Confirm active traffic can decrypt/validate using new key.
4. Remove old key(s) from `MESSAGE_ENCRYPTION_PREVIOUS_KEYS` after rollover window and restart all instances.
5. Record rotation date in your operations runbook.
