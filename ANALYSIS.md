# Repository Analysis (Updated March 29, 2026)

## Scope
This analysis reflects both source review and your first successful local run logs for:
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
  - `join`
  - `sendMessage`
  - server emits `usersChanged` after successful registration
  - server emits `newMessage` after message persist

### Frontend (`frontend/`)
- Flutter app with Provider-based auth state (`AuthProvider`).
- API base URL is centralized in `AppConfig` and can be overridden via:
  - `--dart-define=CHAT_API_BASE_URL=http://<host>:3000`
- Main screens:
  - Login
  - Register
  - Contacts/Home
  - Chat

## First-Run Validation (from provided logs)

### What worked
1. **Backend booted correctly** on port `3000` and created/validated tables.
2. **Registration worked** (`INSERT INTO users ...`).
3. **Login worked** (`SELECT * FROM users WHERE email = ? AND password = ?`).
4. **Users list loaded** (`SELECT id, email, name FROM users`).
5. **Message history query worked** (`GET /messages/:fromId/:toId`).
6. **Realtime transport worked**:
   - Socket connected.
   - `sendMessage` persisted messages.
   - Frontend received `newMessage` events.

### Observations worth documenting
- Query logging is enabled with SQLite `verbose: console.log`, so SQL statements are printed during runtime.
- The frontend run demonstrates cross-layer integration is functional (auth + history + live messages).
- IDs in `sendMessage` inserts appear as `2.0`/`1.0` in logs; this is acceptable in SQLite, but can be normalized later if desired.

## Remaining Risks / Tech Debt
1. **Message and user payload validation is still uneven**
   - Core message parsing is typed, but broader API/socket payload validation can be expanded.

2. **Conversation ordering edge cases**
   - History merge + realtime updates are reconciled, but tie-breaking strategy for identical timestamps should be explicitly tested.

3. **Password migration edge case handling**
   - New registrations are bcrypt-hashed.
   - Legacy plaintext rows are only upgraded when users successfully log in.

4. **Backend test coverage is still minimal**
   - Initial service/repository unit tests exist, but API-level and edge-case coverage should be expanded.

## Recently Resolved
1. **SQL logging safety**
   - SQL statement logging is now opt-in (`SQL_VERBOSE=1`) and disabled by default.

## Recommended Next Steps (priority order)
1. Add message delivery acknowledgements/retry for transient disconnects.
2. Add API/service validation tests for malformed payloads and boundary cases.
3. Add frontend widget/integration tests for conversation de-duplication UX.
4. Add coverage reporting thresholds in CI for backend + frontend.
5. Add production hardening checks (CORS allowlist, secure cookie/session strategy, secret rotation docs).

## Backend Refactor Notes (March 29, 2026)

### What improved
1. SQL is no longer mixed into route handlers or socket handlers.
2. Route modules became thin and are now easier to read/extend.
3. Password and registration logic moved into `auth.service` and can be tested in isolation.
4. Message persistence path moved behind repository + service.
5. Socket policy is explicit in `chat.socket.js`.

### Why this matters
- Faster maintenance: smaller files with clear ownership.
- Safer changes: DB access is centralized and easier to audit.
- Easier testing: services can be tested with mocked repositories.

### Confirmed healthy behavior
1. Backend startup and schema checks are normal (`journal_mode=WAL`, `CREATE TABLE IF NOT EXISTS ...`).
2. Password migration path worked for a legacy/plaintext user:
   - `SELECT * FROM users WHERE email = 'bovkunalex@mail.ru'`
   - `UPDATE users SET password = '<bcrypt hash>' WHERE id = 2`
3. User list and conversation history queries succeeded.
4. Socket session worked end-to-end:
   - Connect
   - Message insert
   - Frontend receipt of `newMessage`

### Notable log details
- Values like `2.0` in SQLite write logs are benign numeric formatting from the JS↔SQLite boundary.
- `/*+28 bytes*/` inside the printed hash value is `better-sqlite3` query-log truncation and does **not** mean the stored hash is corrupted.
- `Lost connection to device.` appears after Flutter reports successful runtime activity and commonly indicates the desktop app/process was closed or detached, not necessarily a backend/socket failure.

### Likely UX issue observed
- Sender-side duplicate bubble risk still existed in this run pattern:
  - Client adds optimistic message immediately.
  - Server broadcasts same message back via `newMessage`.
  - Without reconciliation, the sender can see duplicates.

## Compliance Audit: Registration/Auth + Message Storage (March 31, 2026)

### Legal baseline reviewed
- Consultant hotdocs link provided in the task (`https://www.consultant.ru/law/hotdocs/81325.html`).
  - Note: the public mirror behind that specific URL appears inconsistent and may now resolve to an unrelated hotdocs item in open search indexes.
- Official publication card for Federal Law No. 406-FZ dated July 31, 2023 (`https://publication.pravo.gov.ru/document/0001202307310022`) introducing Russian user-authorization constraints for site owners.
- Yandex article on website user agreement structure and acceptance mechanics (`https://direct.yandex.ru/base/articles/polzovatelskoe-soglashenie`, updated July 29, 2024).

### Requirement 1: Email registration/login must comply with RU authorization rules
Status: **NOT COMPLIANT**.

Findings in code:
1. Registration accepts any non-empty `email` and `password`; there is no check for RU domain or approved RU authorization method.
2. Login also accepts arbitrary email values and validates only credentials.
3. There is no support for alternative legally common RU auth channels (e.g., Gosuslugi/ESIA, RU operator phone, EBS, or approved domestic auth system).

### Requirement 2: Mandatory acceptance of user agreement
Status: **NOT COMPLIANT**.

Findings in code:
1. Registration UI has no checkbox/consent capture for user agreement acceptance.
2. Backend registration contract has no `termsAccepted` field and stores no acceptance timestamp/version.
3. No endpoint or DB field exists for consent audit trail (agreement version, accepted_at, ip/device metadata).

### Questions answered from code review
1. **Are messages stored somewhere?**
   - Yes. Messages are persisted in SQLite table `messages` via `INSERT INTO messages (from_id, to_id, text, client_token)`.
2. **Are stored messages encrypted or plain?**
   - Plain text at application/database layer: message body is stored as `text TEXT NOT NULL` and written/read directly without encryption transform.
   - Passwords are hashed with bcrypt, but this does not apply to message payloads.

### Minimal remediation checklist
1. Add registration policy enforcement in backend service:
   - validate allowed auth channel for RU users;
   - reject disallowed email identities where policy requires.
2. Add mandatory terms acceptance in frontend + backend:
   - `termsAccepted` boolean required at registration;
   - persist agreement version + accepted timestamp in DB.
3. Add compliance logging/audit fields for auth + consent events.
4. Encrypt message content at rest (field-level encryption using managed key) if business/security policy requires confidentiality beyond filesystem controls.

## Documentation update note (March 31, 2026)

The repository docs now explicitly document:
- where users can read the User Agreement text URL;
- how to override that URL for production;
- backend compliance env vars (`REGISTRATION_POLICY`, `TERMS_VERSION`, `MESSAGE_ENCRYPTION_KEY`);
- compliance/audit tables and encrypted message storage behavior.
