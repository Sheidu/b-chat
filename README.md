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

### Backend structure (current)

`backend/index.js` is now only a composition/bootstrap entrypoint. It wires:

- `app.js` (Express app + middleware)
- `db/connection.js` and `db/migrations.js`
- `routes/*.routes.js`
- `services/*.service.js`
- `repositories/*.repository.js`
- `sockets/chat.socket.js`

All raw SQL is centralized in `backend/repositories/`.

If `backend/.env` is missing, backend will auto-create it from `backend/.env.example` and print:

```text
.env created from .env.example. Please update secrets!
```

## 2) Start the Flutter frontend

In a second terminal:

```bash
cd frontend
flutter pub get
flutter run
```

## 3) API base URL configuration (important)

The frontend now supports a single runtime setting for backend URL via `--dart-define`:

```bash
flutter run --dart-define=CHAT_API_BASE_URL=http://<YOUR_IP>:3000
```

If you do not pass it, defaults are:
- Android emulator: `http://10.0.2.2:3000`
- Web/iOS/desktop: `http://localhost:3000`

Use your machine's LAN IP (example `http://192.168.1.25:3000`) when testing from a **real phone** on the same Wi-Fi.

## 4) Quick sanity checks

- Open two app instances/users and register both.
- Confirm user list loads.
- Keep one user logged in, register another user from a second instance, and verify contacts refresh automatically (server emits `usersChanged`, frontend re-fetches `/users`).
- Send a message and confirm both sender + receiver see realtime updates.

### Backend quality checks

```bash
cd backend
npm test
npm run lint
```

### CI checks

GitHub Actions (`.github/workflows/ci.yml`) now runs:
- Backend: `npm run lint` + `npm test`
- Frontend: `flutter analyze` + `flutter test`

## Notes

- SQLite database file is always `backend/family-chat.db` (resolved from backend `index.js` directory, not your terminal working directory).
- Passwords are hashed with `bcrypt` on registration (`BCRYPT_SALT_ROUNDS`, default `12`).
- Login supports migration of historical plaintext passwords to bcrypt after a successful login.
- Adding `client_token` uses `ALTER TABLE ... ADD COLUMN` migration logic and **does not clear existing rows**.
- `new Database(dbPath, ...)` does **not** wipe an existing file, but it will create a new DB file if one does not exist.
- To fail fast instead of creating a new DB file accidentally, start backend with `DB_FILE_MUST_EXIST=1`.
- SQL query logging is controlled by env vars:
  - `SQL_VERBOSE=1` → enable SQL logs.
  - any other value (or unset) → SQL logs are disabled.
- On each backend start, if `family-chat.db` exists, a timestamped backup is created under `backend/backups/` and only the latest 10 backups are kept.
- Message SQL is handled by `backend/repositories/messages.repository.js`; user SQL is handled by `backend/repositories/users.repository.js`.

## Login troubleshooting for existing accounts

If existing users suddenly cannot log in (`Invalid email or password`), first verify backend is reading the expected DB file and that users still exist.

From repo root (works on Windows CMD/PowerShell and bash):

```bash
cd backend
node scripts/db_inspect.js tables
```

If `users` is present, list users:

```bash
cd backend
node scripts/db_inspect.js users
```

You can also inspect message count:

```bash
cd backend
node scripts/db_inspect.js messages
```

If that first query returns an empty list, you are likely on a different/new DB file than expected.

By default, `node scripts/db_inspect.js` prints a summary (`dbPath`, tables, and counts when available).

When backend starts, if the DB file did not exist, it now logs:

```text
[DB] Created new SQLite file at <path>
```

If you want backend to error instead of creating a new DB file, run:

```bash
cd backend
DB_FILE_MUST_EXIST=1 npm start
```

To search this repo for *all* `family-chat.db` files (to detect accidental duplicates):

```bash
cd backend
node scripts/db_inspect.js find
```

## 5) If Flutter says "No supported devices connected"

This means your `frontend/` project does not yet include scaffolding for the device platform you selected (for example web/windows).

From `frontend/`, run:

```bash
flutter create . --platforms=android,ios,web,windows,linux,macos
flutter pub get
```

Then run with an explicit device target:

```bash
flutter run -d chrome
# or
flutter run -d windows
# or
flutter run -d <your-android-device-id>
```

A quick helper note is also available at `frontend/tool_bootstrap_platforms.md`.

## 6) First-run expected logs

After backend + frontend are both running, normal indicators include:
- Backend: `Server running on port 3000`
- Backend: SQL logs for register/login/users/messages queries **only when SQL logging is enabled**
- Frontend: `Socket connected → user <id>`
- Frontend: `Received newMessage: {...}` when messages arrive

If you see those, your REST + realtime flow is healthy.


## Deployment and capacity planning

For infrastructure sizing, browser deployment, and Android packaging guidance, see:

- `DEPLOYMENT_AND_CAPACITY_GUIDE.md`

## 7) Security note

Current auth/storage is for demo use only:
- Passwords are hashed, but historical plaintext rows (if any) are upgraded only after successful login.
- SQL verbose logging can print sensitive values (including user emails and query text); keep `SQL_VERBOSE=0` in production.

Do **not** deploy this as-is to production.
