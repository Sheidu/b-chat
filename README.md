# b-chat

Simple chat app with:
- **Backend:** Node.js + Express + Socket.IO + SQLite
- **Frontend:** Flutter

## 1) Start the backend

```bash
cd backend
npm install
npm start
```

Backend runs on `http://localhost:3000` by default.

### Backend structure

`backend/index.js` performs explicit startup wiring (env loading, migrations, repositories/services
composition, Socket.IO attach, and server listen). `backend/app.js` keeps `createApp()` for
Express middleware + route registration.

Current runtime helper services used by `index.js` / `app.js`:

- `services/runtime-hardening.service.js` (env file bootstrap + production hardening checks)
- `services/http-config.service.js` (CORS allowlist parsing/options)
- `db/connection.js` and `db/migrations.js`
- `repositories/*.repository.js`
- `services/*.service.js`
- `routes/*.routes.js`
- `sockets/chat.socket.js`

All raw SQL is centralized in `backend/repositories/`.

If `backend/.env` is missing, backend will auto-create it from `backend/.env.example` and print:

```text
.env created from .env.example. Please update secrets!
```

`backend/.env.example` includes defaults/placeholders for:
- compliance/auth (`REGISTRATION_POLICY`, `TERMS_VERSION`, `USER_AGREEMENT_URL`)
- auth abuse controls (`AUTH_RATE_LIMIT_WINDOW_MS`, `AUTH_RATE_LIMIT_MAX_ATTEMPTS`)
- message crypto (`MESSAGE_ENCRYPTION_KEY`, `MESSAGE_ENCRYPTION_PREVIOUS_KEYS`)
- runtime hardening (`CORS_ALLOWLIST`, `SESSION_COOKIE_SECURE`)

## 2) Start the Flutter frontend

In a second terminal:

```bash
cd frontend
flutter pub get
flutter run
```

### Frontend localization (RU/EN)

The Flutter client is localized in **Russian** and **English** using Flutter `gen-l10n`.

- ARB source files:
  - `frontend/lib/l10n/app_ru.arb`
  - `frontend/lib/l10n/app_en.arb`
- Generated localization classes:
  - `frontend/lib/l10n/app_localizations.dart`
  - `frontend/lib/l10n/app_localizations_ru.dart`
  - `frontend/lib/l10n/app_localizations_en.dart`

Runtime locale behavior:
- Supported locales: `ru`, `en`
- First launch: app detects system locale
- If system locale is unsupported, fallback is `ru`
- User selection is persisted in `SharedPreferences` (`user_locale`) and can be changed
  from **Settings → Language**
- Registration consent text is localized and rendered from `termsProcessingConsent(ownerName)`
  using `CHAT_OWNER_NAME`

## 3) API base URL configuration (important)

The frontend supports a single runtime setting for backend URL via `--dart-define`:

```bash
flutter run --dart-define=CHAT_API_BASE_URL=http://<YOUR_IP>:3000
```

If you do not pass it, defaults are:
- Android emulator: `http://10.0.2.2:3000`
- Web/iOS/desktop: `http://localhost:3000`

Use your machine's LAN IP (e.g. `http://192.168.1.25:3000`) when testing from a **real phone**
on the same Wi-Fi.

## 4) Socket identity model

Each Socket.IO client must call `join` with its userId immediately after connecting.
The backend stores that value in `socket.data.userId` and uses it to authenticate all
subsequent events on that socket.

- `join(userId)` — registers the socket's identity; a second call with a different userId
  disconnects the socket.
- `sendMessage({ from, to, text, clientToken })` — the `from` field is verified against
  `socket.data.userId`. Mismatches are rejected with `Sender identity mismatch` and logged.

This prevents any connected client from forging messages as another user.

> **Note:** the REST endpoints (`GET /users`, `GET /messages/:fromId/:toId`) do not currently
> require a token. Adding JWT authentication to the HTTP layer is the next planned hardening step.

## 5) Quick sanity checks

- Open two app instances/users and register both.
- Confirm user list loads.
- Keep one user logged in, register another user from a second instance, and verify contacts
  refresh automatically (server emits `usersChanged`, frontend re-fetches `/users`).
- Send a message and confirm both sender + receiver see realtime updates.
- Temporarily disconnect network and send a message; it should queue/retry and reconcile via
  `client_token` once reconnected.

### Backend quality checks

```bash
cd backend
npm test
npm run lint
```

### CI checks

GitHub Actions (`.github/workflows/ci.yml`) runs:
- Backend: `npm run lint` + `npm run test:coverage` with enforced minimum coverage
  (lines/statements 85%, functions 80%, branches 75%)
- Frontend: `flutter test --coverage` with enforced minimum line coverage (80%)

## Notes

- SQLite database file is always `backend/family-chat.db`.
- Passwords are hashed with `bcrypt` on registration (`BCRYPT_SALT_ROUNDS`, default `12`).
- Login supports migration of historical plaintext passwords to bcrypt after a successful login.
- `client_token` uses `ALTER TABLE ... ADD COLUMN` migration logic and **does not clear existing rows**.
- `new Database(dbPath, ...)` does **not** wipe an existing file, but will create a new DB file
  if one does not exist.
- To fail fast instead of creating a new DB file accidentally: `DB_FILE_MUST_EXIST=1`.
- SQL query logging: `SQL_VERBOSE=1` to enable, disabled by default.
- On each backend start a timestamped backup is created under `backend/backups/`; only the
  latest 10 backups are kept.

## Login troubleshooting for existing accounts

If existing users suddenly cannot log in, verify the backend is reading the expected DB file.

```bash
cd backend
node scripts/db_inspect.js tables   # list tables
node scripts/db_inspect.js users    # list users
node scripts/db_inspect.js messages # message count
node scripts/db_inspect.js find     # find all family-chat.db files in repo
node scripts/db_inspect.js          # summary (default)
```

When backend starts, if the DB file did not exist, it logs:

```text
[DB] Created new SQLite file at <path>
```

To error instead of creating a new DB file:

```bash
DB_FILE_MUST_EXIST=1 npm start
```

## 6) If Flutter says "No supported devices connected"

From `frontend/`, run:

```bash
flutter create . --platforms=android,ios,web,windows,linux,macos
flutter pub get
flutter run -d chrome        # web
flutter run -d windows       # desktop
flutter run -d <device-id>   # Android
```

See also `frontend/tool_bootstrap_platforms.md`.

## 7) First-run expected logs

- Backend: `Server running on port 3000`
- Backend: SQL logs for register/login/users/messages queries *(only when SQL_VERBOSE=1)*
- Frontend: `Socket connected → user <id>`
- Frontend: `Received newMessage: {...}` when messages arrive

## Localization QA checklist

- Login, Register, Home, Chat, and Settings screens are translated in both RU and EN.
- Language toggle in Settings switches UI immediately.
- Selected language persists after app restart.
- System-locale auto-detection works on first launch for `ru` and `en`.
- Unsupported system locale falls back to Russian.

## Deployment and capacity planning

See `DEPLOYMENT_AND_CAPACITY_GUIDE.md`.

## 8) Security note

Current auth/storage is for private family use:
- Socket sender identity is verified on every `sendMessage` event.
- REST endpoints do not yet require a token — planned for next hardening iteration.
- Passwords are hashed with bcrypt; historical plaintext rows are upgraded on first successful login.
- Keep `SQL_VERBOSE=0` in production (emails and query text can appear in logs).

Do **not** deploy this as-is to a public network without adding JWT auth to the REST layer.

## 9) Compliance-related configuration and User Agreement link

### Where users can read the User Agreement text

The app currently points users to:

```
https://direct.yandex.ru/base/articles/polzovatelskoe-soglashenie
```

Override at build/run time:

```bash
flutter run --dart-define=CHAT_USER_AGREEMENT_URL=https://your-domain.com/legal/user-agreement
```

Override consent text owner name:

```bash
flutter run --dart-define=CHAT_OWNER_NAME="Family Server Admin"
```

> **Important:** for legal compliance the User Agreement must be hosted at a URL that belongs
> to your own domain and names this application's actual data controller.

### Registration/auth compliance controls (backend)

- `REGISTRATION_POLICY` (default: `strict_ru_email`)
  - `strict_ru_email`: registration/login limited to `.ru/.рф` email domains.
  - `open_email`: non-RU email domains permitted.
- `TERMS_VERSION` (default: `2026-03-31`) — stored with user consent metadata.
- `USER_AGREEMENT_URL` — stored with consent evidence for each registration.
- `AUTH_RATE_LIMIT_WINDOW_MS` / `AUTH_RATE_LIMIT_MAX_ATTEMPTS` — control auth rate limiting.

### Production hardening environment variables

- `CORS_ALLOWLIST` (required in production): comma-separated trusted origins.
- `SESSION_COOKIE_SECURE`: set to `true` before enabling cookie sessions.
- `MESSAGE_ENCRYPTION_KEY`: must be at least 32 chars in production.
- `MESSAGE_ENCRYPTION_PREVIOUS_KEYS`: comma-separated fallback keys for rotation windows.

See `backend/PRODUCTION_HARDENING.md` for full guidance.

### Message encryption at rest

- AES-256-GCM encryption before DB write, decryption on read.
- `MESSAGE_ENCRYPTION_KEY` — strong secret required in production.
- `MESSAGE_ENCRYPTION_PREVIOUS_KEYS` — keeps historical messages decryptable during key rollover.

### Compliance audit logging

Backend stores auth/consent audit events in `compliance_events`:
- event type (`register`/`login`)
- status (`accepted`/`rejected`)
- reason, IP address, User-Agent, timestamp