# Repository Analysis (Updated April 23, 2026)

## April 23, 2026 implementation update

Implemented in this iteration:
- JWT issuance on `/register` and `/login`, plus middleware for protected REST routes.
- Message history pagination (`before`, `limit<=50`) and repository query changes.
- `compliance_events` indexes on `email` and `created_at`.
- Decrypt failure observability (`decrypt_failure` compliance events + logs).
- User deletion endpoint `DELETE /users/me` (soft/hard delete modes).
- Optimistic message timeout/failure UI with retry action in Flutter chat screen.
- Per-user contact lists backed by `contacts` table.

## Scope
This analysis reflects source review, first successful local run logs, and fixes applied on April 11, 2026:
- Backend (`npm start`)
- Frontend (`flutter run -d windows`)

## Current Architecture

### Backend (`backend/`)
- Stack: Express + Socket.IO + SQLite (`better-sqlite3`).
- Entry point (`index.js`) is composition-only:
  - env/bootstrap
  - DB connection + backup rotation (`db/connection.js`)
  - DB migration execution (`db/migrations.js`)
  - repository/service construction
  - Express app + HTTP server + socket handler registration
- Layered modules:
  - `routes/*.routes.js` (thin HTTP handlers)
  - `services/*.service.js` (validation/business rules/DTO shaping)
  - `repositories/*.repository.js` (all raw SQL with prepared statements)
  - `sockets/chat.socket.js` (Socket.IO event wiring)
- API routes:
  - `POST /register`
  - `POST /login`
  - `GET /users`
  - `GET /messages/:fromId/:toId`
- Socket events:
  - `join` — authenticates the socket by storing userId in `socket.data.userId`
  - `sendMessage` — verifies `data.from` matches the socket's authenticated userId
  - server emits `usersChanged` after successful registration
  - server emits `newMessage` after message persist

### Frontend (`frontend/`)
- Flutter app with Provider-based state management (`AuthProvider`, `LocaleProvider`, `SocketService`).
- `SocketService` is a shared singleton provided via `MultiProvider` in `main.dart`. Both `HomeScreen` and `ChatScreen` consume it; neither creates its own instance.
- API base URL is centralized in `AppConfig` and can be overridden via:
  - `--dart-define=CHAT_API_BASE_URL=http://<host>:3000`
- Main screens:
  - Login
  - Register
  - Contacts/Home
  - Chat
  - Settings (language toggle RU/EN, logout, compliance info)

## First-Run Validation (from provided logs)

### What worked
1. **Backend booted correctly** on port `3000` and created/validated tables.
2. **Registration worked** (`INSERT INTO users ...`).
3. **Login worked** (`SELECT * FROM users WHERE email = ?`).
4. **Users list loaded** (`SELECT id, email, name FROM users`).
5. **Message history query worked** (`GET /messages/:fromId/:toId`).
6. **Realtime transport worked**:
   - Socket connected.
   - `sendMessage` persisted messages.
   - Frontend received `newMessage` events.

### Observations worth documenting
- Query logging is opt-in (`SQL_VERBOSE=1`) and disabled by default.
- The frontend run demonstrates cross-layer integration is functional (auth + history + live messages).
- IDs in `sendMessage` inserts appear as `2.0`/`1.0` in logs; this is acceptable in SQLite.

## Fixes Applied (April 11, 2026)

### Fix 1 — ChatScreen dual-SocketService instance bug (frontend)

**File:** `frontend/lib/screens/chat_screen.dart`

**Problem:** `initState` called `_socketService = SocketService()` which created a brand-new,
orphaned socket instance. The `Consumer<SocketService>` widgets in `build()` read from the
Provider's shared instance, so the connection-status banner and AppBar indicator were watching
a different object than the one actually managing the connection. They never reflected real state.

Additionally, `dispose()` called `_socketService.dispose()` on the Provider-owned instance,
which would have torn down the shared socket for every other screen in the app.

**Fix:**
- `initState` now calls `Provider.of<SocketService>(context, listen: false)` to obtain the
  shared instance. A connect is issued only if the socket is not already connected (idempotent).
- `dispose()` no longer calls `_socketService.dispose()`. The Provider owns the lifecycle.

### Fix 2 — Socket `sendMessage` sender identity not verified (backend)

**File:** `backend/sockets/chat.socket.js`

**Problem:** The `sendMessage` handler trusted the client-supplied `data.from` field without
any verification. Any connected client could set `from` to another user's ID and send messages
that appeared to originate from that user.

**Fix:**
- On `join`: the validated userId is stored in `socket.data.userId`. A second `join` attempt
  with a different userId disconnects the socket immediately.
- On `sendMessage`: two guards are checked before the service call:
  1. The socket must have a stored `userId` (i.e. it called `join` first).
  2. `data.from` must equal `socket.data.userId`. Mismatches are rejected with
     `{ ok: false, error: 'Sender identity mismatch' }` and logged.
- A shared `_parsePositiveInt` helper is extracted at module level for consistent ID validation
  in both handlers.

## Remaining Risks / Tech Debt

1. **No auth token / session — HTTP endpoints are unauthenticated**
   - After login the backend returns `{id, email, name}` but issues no token.
   - Any HTTP client can call `GET /messages/1/2` or `POST /register` without credentials.
   - The socket `join`/`sendMessage` identity check mitigates the realtime surface, but the
     REST layer (`GET /messages`, `GET /users`) remains open.
   - Minimum fix: signed JWT stored in `SharedPreferences` on the client, validated as
     `Authorization: Bearer <token>` middleware on protected routes.

2. **No user data deletion endpoint**
   - Russian personal data law requires a mechanism for users to request deletion of their data.
   - No `DELETE /users/:id` or `DELETE /messages` endpoint exists.

3. **Message pagination not implemented**
   - `listMessagesBetweenUsers` has no `LIMIT`/`OFFSET`.
   - For 100 users with months of history this will eventually be slow and load large payloads
     into memory on every chat open.

4. **Optimistic messages have no timeout / failure state**
   - If a socket ACK never fires, the optimistic bubble stays in the UI forever with no
     visual indicator and no way for the user to retry or dismiss.

5. **`compliance_events` table has no indexes**
   - Audit queries on `email` or `created_at` will do full scans as the table grows.
   - Add: `CREATE INDEX IF NOT EXISTS idx_compliance_events_email ON compliance_events(email)`
   - Add: `CREATE INDEX IF NOT EXISTS idx_compliance_events_created_at ON compliance_events(created_at)`

6. **User Agreement URL points to Yandex's document**
   - The default `USER_AGREEMENT_URL` links to Yandex's own agreement.
   - A legally valid agreement must be hosted at a URL specific to this application and its
     actual data controller.

7. **RU auth policy scope is intentionally narrow**
   - Only `email` auth channel is supported.
   - Policy modes are limited to `strict_ru_email` and `open_email`.

8. **Consent evidence governance is incomplete**
   - Retention policy, export tooling, and legal/archive process for agreement artifacts are
     not defined.

9. **Auth abuse controls are baseline-level**
   - In-memory rate limiting is implemented for `/register` and `/login`.
   - Missing: distributed/persistent throttling for multi-instance deployments, account lockout,
     and alerting on abuse patterns.

10. **Crypto operations are operationally maturing**
    - Key-rotation playbook using `MESSAGE_ENCRYPTION_PREVIOUS_KEYS` is not documented with
      rollback monitoring or automated decryption-failure alerts.

## Recommended Next Steps (priority order)

1. **Add JWT authentication to REST endpoints**
   - Issue a signed token on login/register.
   - Add `Authorization` middleware to `GET /users` and `GET /messages/:fromId/:toId`.

2. **Add user data deletion endpoint**
   - `DELETE /users/me` — soft-delete or hard-delete user row and associated messages.
   - Log deletion event in `compliance_events`.

3. **Add message pagination**
   - Add `?before=<timestamp>&limit=50` query params to `GET /messages/:fromId/:toId`.
   - Update `listMessagesBetweenUsers` repository method accordingly.

4. **Add optimistic message failure UI**
   - After ~10 seconds without ACK, mark the message as failed and offer a retry button.

5. **Productionize auth anti-abuse controls**
   - Replace in-memory limiter with shared-store limiter (Redis or equivalent).

6. **Formalize consent/audit governance**
   - Define retention windows and archival/export procedure for `compliance_events`.
   - Host the User Agreement at a URL under your own domain.

7. **Finish crypto rotation operations**
   - Document key rotation runbook with rollout/rollback steps.
   - Add observability for decrypt failures.

8. **Index `compliance_events` table**
   - Add indexes on `email` and `created_at` in `db/migrations.js`.

## Backend Refactor Notes (March 29, 2026)

### What improved
1. SQL is no longer mixed into route handlers or socket handlers.
2. Route modules became thin and are now easier to read/extend.
3. Password and registration logic moved into `auth.service` and can be tested in isolation.
4. Message persistence path moved behind repository + service.
5. Socket policy is explicit in `chat.socket.js`.

### Confirmed healthy behavior
1. Backend startup and schema checks are normal (`journal_mode=WAL`, `CREATE TABLE IF NOT EXISTS ...`).
2. Password migration path worked for a legacy/plaintext user.
3. User list and conversation history queries succeeded.
4. Socket session worked end-to-end: connect → message insert → frontend receipt of `newMessage`.

## Compliance Audit: Registration/Auth + Message Storage (March 31, 2026)

### Requirement 1: Email registration/login must comply with RU authorization rules
Status: **PARTIALLY COMPLIANT (implemented for strict RU-email policy path)**.

1. Registration enforces policy via `validateRegistrationPolicy` in `auth.service`:
   - supported channel is explicitly email-only
   - in `strict_ru_email` mode, only `authChannel='email'` with `.ru/.рф` domains is accepted
2. Login enforces `.ru/.рф` domain check in `strict_ru_email` mode before credential validation.
3. Policy and terms behavior are configurable via env (`REGISTRATION_POLICY`, `TERMS_VERSION`).

Remaining gap: compliance currently covers only domain-based email policy.

### Requirement 2: Mandatory acceptance of user agreement
Status: **COMPLIANT for registration flow**.

1. Frontend registration requires explicit checkbox confirmation before submit.
2. Backend registration rejects requests unless both `termsAccepted === true` and non-empty
   `consentText` are provided.
3. DB schema stores acceptance metadata (`terms_version`, `terms_accepted_at`, `terms_url`,
   `terms_text_hash`).
4. Compliance audit records are written to `compliance_events`.

Remaining gap: evidence retrieval/retention operations are not formalized.

### Message storage
- Messages are persisted in SQLite table `messages`.
- Encrypted at application layer before DB write (AES-256-GCM); decrypted on read.
- Passwords are hashed with bcrypt.

## Localization Audit (April 4, 2026)

### Status: Implemented and wired end-to-end for RU/EN

1. Flutter localization is enabled in `MaterialApp` with `AppLocalizations.delegate`.
2. Locale is managed through `LocaleProvider`:
   - persisted key: `user_locale` in `SharedPreferences`
   - first-launch behavior: detect system locale
   - unsupported system locale fallback: `ru`
3. UI language can be switched at runtime in Settings.
4. Core user-facing screens consume localized strings.
5. ARB and generated localization files are present for both RU/EN.

### Remaining localization risks
1. Future string additions require ARB updates + `flutter gen-l10n` regeneration.