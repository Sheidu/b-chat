# Production hardening checklist

## CORS allowlist (required)

Set `CORS_ALLOWLIST` to a comma-separated list of trusted origins:

```bash
CORS_ALLOWLIST=https://chat.example.com,https://admin.example.com
```

In production, backend startup fails when this allowlist is empty.

In development, omitting `CORS_ALLOWLIST` sets `origin: false` which blocks all cross-origin
requests, including `flutter run -d chrome`. Set it explicitly for local web development:

```bash
CORS_ALLOWLIST=http://localhost:3000,http://localhost:8080
```

## Socket identity verification

The socket `sendMessage` handler now verifies that `data.from` matches the userId stored on
the socket at `join` time. This prevents any connected client from forging messages as another
user.

The `join` handler:
- Validates the userId is a positive integer; disconnects the socket if not.
- Stores the value in `socket.data.userId`.
- Disconnects the socket if a second `join` is attempted with a different userId.

The `sendMessage` handler:
- Rejects the event with `Not authenticated` if the socket has no stored userId.
- Rejects the event with `Sender identity mismatch` if `data.from` does not equal the
  stored userId, and logs the attempt.

> **Limitation:** this is a lightweight trust model. The socket accepts the client-supplied
> userId at `join` time without cryptographic proof. For stronger guarantees, validate a
> signed JWT at `join` instead of trusting the raw value. This is the recommended next step.

## REST endpoint authentication (planned)

The HTTP endpoints (`GET /users`, `GET /messages/:fromId/:toId`) do not currently require
a token. Any HTTP client that knows valid user IDs can read conversation history.

Planned fix:
1. Issue a signed JWT on `/login` and `/register`.
2. Add `Authorization: Bearer <token>` middleware to all protected routes.
3. Store the token in `SharedPreferences` on the Flutter client and attach it to every
   HTTP request.

Until this is implemented, restrict network access to trusted clients at the infrastructure
level (firewall, VPN, private network).

## Secure cookie/session strategy

This project currently uses stateless API auth responses (no server-issued cookie session yet).

When introducing cookie sessions/JWT cookies in production:

1. Set `SESSION_COOKIE_SECURE=true`.
2. Use `HttpOnly`, `Secure`, and `SameSite=Lax` (or `Strict`) cookie flags.
3. Keep session TTL short and rotate session identifiers on login.
4. Separate session signing/encryption keys from message encryption keys.

## Auth abuse controls

Auth endpoints are rate-limited in-process using:

- `AUTH_RATE_LIMIT_WINDOW_MS` (default `60000`)
- `AUTH_RATE_LIMIT_MAX_ATTEMPTS` (default `12`)

For multi-instance deployments, replace or supplement this with a shared limiter backend
(e.g. Redis) so limits are enforced cluster-wide.

## Consent evidence configuration

Set `USER_AGREEMENT_URL` to the canonical legal page used during registration. This URL is
stored with consent evidence (`terms_url`) and should:
- be hosted at a URL under your own domain
- name this application's actual data controller
- describe the specific data processing performed by this application

The current default (`https://direct.yandex.ru/...`) points to Yandex's own agreement and
is **not legally valid** for this application in production.

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
4. Remove old key(s) from `MESSAGE_ENCRYPTION_PREVIOUS_KEYS` after rollover window and
   restart all instances.
5. Record rotation date in your operations runbook.

## Database indexes for compliance_events

The `compliance_events` table currently has no indexes. As the table grows, audit queries
on `email` or `created_at` will do full scans. Add the following to `db/migrations.js`:

```js
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_compliance_events_email
  ON compliance_events(email)
`);
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_compliance_events_created_at
  ON compliance_events(created_at)
`);
```

## User data deletion (compliance requirement)

Russian personal data law requires a mechanism for users to request deletion of their data.
No deletion endpoint currently exists. The planned implementation:

- `DELETE /users/me` — requires valid auth token (once JWT is implemented)
- Hard-delete or soft-delete the user row and associated messages
- Write a `delete` event to `compliance_events` with timestamp and reason
- Revoke/invalidate the user's session/token

## SQL logging

SQL query logging is controlled by `SQL_VERBOSE`:
- `SQL_VERBOSE=1` — enable (prints emails and query text to stdout)
- any other value or unset — disabled (default)

Always keep `SQL_VERBOSE=0` in production.