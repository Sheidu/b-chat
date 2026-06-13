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
- `GET /users/discover`
- `POST /users/contacts`
- `GET /messages/:fromId/:toId`
- `PATCH /users/me`
- `DELETE /users/me`

JWT settings:

- `JWT_SECRET` (required in production, 16+ chars)
- `JWT_EXPIRES_IN` (default `7d`, supports `s/m/h/d` suffix, e.g. `12h`)

`POST /register` and `POST /login` return `token` in the response body.
Registration additionally requires `phoneNumber`.

## User deletion endpoint (implemented)

`DELETE /users/me` deletes messages and contacts for current user and writes a `delete`
entry into `compliance_events`.

Mode control:

- `HARD_DELETE_USERS=0` (default): soft-delete user row (`users.deleted_at`) + hard-delete messages/contacts
- `HARD_DELETE_USERS=1`: hard-delete user row + messages/contacts

## Auth abuse controls

Auth endpoints and protected API routes use one unified rate-limit middleware (`createRateLimitMiddleware`). Auth uses in-memory defaults; API routes use a DB-backed repository store:

- `RATE_LIMIT_WINDOW_MS` (default `60000`)
- `RATE_LIMIT_MAX_ATTEMPTS` (default `12`)

The API limiter uses SQLite table `rate_limit_buckets` so limits survive process restarts and are shared by workers that point to the same DB file.

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


## Socket authentication (implemented)

Socket connections now require a valid JWT token (handshake auth/query/header).
The socket layer verifies the JWT, rejects deleted users or stale `token_version` values, and then
binds identity from `sub`. `join(userId)` must match `sub` from the verified token or the socket is
disconnected; the join event only confirms the socket joins its own room.


## Message pagination cursor

Use composite cursor params for stable paging: `before=<ISO8601>&beforeId=<messageId>`.
This avoids duplicate/missing edge cases when timestamps are equal.


## Email transport provider

Configure real provider delivery using webhook mode:
- `EMAIL_PROVIDER=webhook`
- `EMAIL_WEBHOOK_URL=https://provider.example/send`
- `EMAIL_WEBHOOK_TOKEN=<secret>`

Default `EMAIL_PROVIDER=log` is local/dev fallback only.


## Soft-delete email reservation

Soft-deleted user rows intentionally retain and permanently reserve their email address. This keeps
audit/account-history continuity and prevents a future account from inheriting an email identity that
previously belonged to a deleted row.
