# Repository Analysis (Updated April 5, 2026)

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
1. **RU auth policy scope is intentionally narrow**
   - Current implementation supports email-only auth channel.
   - Policy modes are limited to `strict_ru_email` and `open_email`; there is no multi-channel RU authorization flow yet.

2. **Consent evidence is stronger, but governance is still incomplete**
   - Registration now requires both `termsAccepted=true` and `consentText`, and stores consent evidence hash (`terms_text_hash`) with `terms_url` + version/timestamp.
   - Still missing: explicit retention policy, export tooling, and legal/archive process for agreement artifacts.

3. **Auth abuse controls are baseline-level**
   - In-memory auth rate limiting is implemented for `/register` and `/login`.
   - Still missing distributed/persistent throttling (shared cache), account lockout strategy, and alerting on abuse patterns.

4. **Crypto operations are improved but still operationally maturing**
   - Message encryption supports previous-key decryption for rotation (`MESSAGE_ENCRYPTION_PREVIOUS_KEYS`).
   - Still missing documented staged key-rotation playbook with rollback monitoring and automated decryption-failure alerts.

## Recently Resolved
1. **SQL logging safety**
   - SQL statement logging is now opt-in (`SQL_VERBOSE=1`) and disabled by default.

## Recommended Next Steps (priority order)
1. **Productionize auth anti-abuse controls**
   - Replace in-memory limiter with shared-store limiter (Redis or equivalent) for multi-instance deployments.
   - Add anomaly monitoring and incident thresholds around repeated auth failures.

2. **Formalize consent/audit governance**
   - Define retention windows and archival/export procedure for `compliance_events` and consent evidence fields.
   - Add admin/audit query endpoints or ops scripts for evidence retrieval.

3. **Finish crypto rotation operations**
   - Document key rotation runbook using `MESSAGE_ENCRYPTION_PREVIOUS_KEYS` with rollout/rollback steps.
   - Add observability for decrypt failures and key-age policy checks.

4. **Expand integration coverage around realtime reliability**
   - Add socket-level tests for reconnect + retry ACK flows and message order tie-breaks.
   - Add end-to-end checks for optimistic message replacement and duplicate suppression behavior.

5. **Clarify compliance policy roadmap**
   - Keep email-only mode explicit in product/legal docs.
   - If future multi-channel RU authorization is required, document and phase a dedicated implementation plan.

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
Status: **PARTIALLY COMPLIANT (implemented for strict RU-email policy path)**.

Latest findings in code:
1. Registration enforces policy via `validateRegistrationPolicy` in `auth.service`:
   - supported channel is explicitly email-only;
   - in `strict_ru_email` mode, only `authChannel='email'` with `.ru/.рф` domains is accepted.
2. Login enforces `.ru/.рф` domain check in `strict_ru_email` mode before credential validation.
3. Policy and terms behavior are configurable via env (`REGISTRATION_POLICY`, `TERMS_VERSION`) during backend bootstrap.

Remaining compliance gap:
- Compliance currently covers only domain-based email policy; broader RU authorization methods are not implemented in this codebase.

### Requirement 2: Mandatory acceptance of user agreement
Status: **COMPLIANT for registration flow (with audit improvements still recommended)**.

Latest findings in code:
1. Frontend registration requires explicit checkbox confirmation before submit (`_termsAccepted` guard + user-facing validation).
2. Backend registration rejects requests unless both `termsAccepted === true` and non-empty `consentText` are provided.
3. DB schema stores acceptance metadata in `users` (`terms_version`, `terms_accepted_at`, `terms_url`, `terms_text_hash`).
4. Compliance audit records are written to `compliance_events` with context fields including IP and User-Agent.

Remaining improvement area:
- Evidence retrieval/retention operations should be formalized for legal/audit workflows.

### Questions answered from code review
1. **Are messages stored somewhere?**
   - Yes. Messages are persisted in SQLite table `messages` via `INSERT INTO messages (from_id, to_id, text, client_token)`.
2. **Are stored messages encrypted or plain?**
   - Encrypted at application layer before DB write (AES-256-GCM); decrypted on read.
   - Passwords are hashed with bcrypt; message payload encryption is handled separately via message crypto service.

### Minimal remediation checklist
1. Move auth rate limit from in-memory to shared persistent store for horizontally scaled deployments.
2. Document + automate key rotation lifecycle using `MESSAGE_ENCRYPTION_PREVIOUS_KEYS`.
3. Add retention/export operational procedures for consent evidence and compliance events.
4. Add socket-level integration tests for reconnect/retry ordering edge cases.

## Documentation update note (March 31, 2026)

The repository docs now explicitly document:
- where users can read the User Agreement text URL;
- how to override that URL for production;
- backend compliance env vars (`REGISTRATION_POLICY`, `TERMS_VERSION`, `USER_AGREEMENT_URL`, `MESSAGE_ENCRYPTION_KEY`, `MESSAGE_ENCRYPTION_PREVIOUS_KEYS`, auth rate-limit vars);
- compliance/audit tables and encrypted message storage behavior.

## Localization Audit (April 4, 2026)

### Status: Implemented and wired end-to-end for RU/EN

Findings:
1. Flutter localization is enabled in `MaterialApp`:
   - delegates configured (`AppLocalizations.delegate` + global Flutter delegates)
   - supported locales declared (`en`, `ru`)
2. Locale is managed through `LocaleProvider` and loaded before `runApp`:
   - persisted key: `user_locale` in `SharedPreferences`
   - first-launch behavior: detect system locale
   - unsupported system locale fallback: `ru`
3. UI language can be switched at runtime in Settings:
   - `RadioGroup<Locale>` with RU/EN options
4. Core user-facing screens consume localized strings:
   - login, registration, home, chat, settings, common errors/connection states
5. ARB and generated localization files are present for both RU/EN.

### Remaining localization risks
1. Documentation previously did not describe locale fallback and persistence behavior (now updated).
2. Future string additions require ARB updates + localization regeneration discipline (`flutter gen-l10n`).
