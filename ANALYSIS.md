# Repository Analysis (Updated March 28, 2026)

## Scope
This analysis reflects both source review and your first successful local run logs for:
- Backend (`npm start`)
- Frontend (`flutter run -d windows`)

## Current Architecture

### Backend (`backend/`)
- Stack: Express + Socket.IO + SQLite (`better-sqlite3`).
- DB initializes on startup and enables WAL mode.
- API routes:
  - `POST /register`
  - `POST /login`
  - `GET /users`
  - `GET /messages/:fromId/:toId`
- Socket events:
  - `join`
  - `sendMessage`

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
1. **Verbose SQL logs may expose sensitive fields in development output**
   - Useful for debugging, but avoid in production.

2. **Untyped message model**
   - `frontend/lib/models/messages.dart` is currently empty; UI uses dynamic maps.

3. **Duplicate-chat-message UX risk**
   - Chat screen uses optimistic UI append and also listens to server broadcast,
     which can lead to temporary duplicates for sender messages.

4. **Password migration edge case handling**
   - New registrations are bcrypt-hashed.
   - Legacy plaintext rows are only upgraded when users successfully log in.

## Recommended Next Steps (priority order)
1. Disable or gate SQL verbose logging by environment.
2. Introduce typed `Message` model and parsing.
3. De-duplicate sender-side optimistic + socket-delivered messages.
4. Add basic automated checks (backend lint/test, Flutter analyze/test) to keep behavior stable.

## Second-Run Analysis (provided logs, March 28, 2026)

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
