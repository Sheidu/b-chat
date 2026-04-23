# Production hardening checklist

## CORS allowlist (required)

Set `CORS_ALLOWLIST` to a comma-separated list of trusted origins:

```bash
CORS_ALLOWLIST=https://chat.example.com,https://admin.example.com
```

In production, backend startup fails when this allowlist is empty.

## REST endpoint authentication (implemented)

Protected HTTP routes now require JWT bearer auth:

- `GET /users`
- `GET /messages/:fromId/:toId`
- `DELETE /users/me`

JWT settings:

- `JWT_SECRET` (required in production, 16+ chars)
- `JWT_EXPIRES_IN` (default `7d`, supports `s/m/h/d` suffix, e.g. `12h`)

`POST /register` and `POST /login` return `token` in the response body.

## User deletion endpoint (implemented)

`DELETE /users/me` deletes messages and contacts for current user and writes a `delete`
entry into `compliance_events`.

Mode control:

- `HARD_DELETE_USERS=0` (default): soft-delete user row (`users.deleted_at`) + hard-delete messages/contacts
- `HARD_DELETE_USERS=1`: hard-delete user row + messages/contacts

## Auth abuse controls

Auth endpoints are rate-limited in-process using:

- `AUTH_RATE_LIMIT_WINDOW_MS` (default `60000`)
- `AUTH_RATE_LIMIT_MAX_ATTEMPTS` (default `12`)

## Message crypto key rotation runbook (rollout + rollback)

### Rollout

1. Generate new 32+ char key in secret manager.
2. Deploy backend with:
   - `MESSAGE_ENCRYPTION_KEY=<new key>`
   - `MESSAGE_ENCRYPTION_PREVIOUS_KEYS=<old key[,older key...]>`
3. Verify live message reads/writes succeed.
4. Watch logs for decrypt errors (`[messages] decrypt failed`).
5. Keep previous keys during defined rollover window.
6. After window, remove old keys from `MESSAGE_ENCRYPTION_PREVIOUS_KEYS` and redeploy.

### Rollback

1. If decrypt failures spike after rollout, revert to prior env set immediately:
   - `MESSAGE_ENCRYPTION_KEY=<previous primary key>`
   - `MESSAGE_ENCRYPTION_PREVIOUS_KEYS=<known older keys>`
2. Redeploy all instances.
3. Confirm decrypt failure logs stop increasing.
4. Open incident report and capture affected message IDs from logs/compliance events.

## Decrypt failure observability (implemented)

When decryption fails in message history reads, backend now:

1. Logs structured error context with message id + participants.
2. Writes `decrypt_failure` events into `compliance_events`.
3. Returns placeholder text (`[Unable to decrypt message]`) with `decrypt_failed: true`.

Recommended alert rule: trigger when decrypt failures exceed baseline in a 5-minute window.

## Database indexes for compliance_events (implemented)

Migrations now create:

- `idx_compliance_events_email`
- `idx_compliance_events_created_at`

## SQL logging

SQL query logging is controlled by `SQL_VERBOSE`:

- `SQL_VERBOSE=1` — enable (prints emails and query text to stdout)
- any other value or unset — disabled (default)

Always keep `SQL_VERBOSE=0` in production.
