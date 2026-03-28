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
- Send a message and confirm both sender + receiver see realtime updates.

## Notes

- SQLite database file is created in `backend/family-chat.db` when backend starts.
- Passwords are hashed with `bcrypt` on registration (`BCRYPT_SALT_ROUNDS`, default `12`).

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
- Backend: SQL logs for register/login/users/messages queries (verbose mode enabled)
- Frontend: `Socket connected → user <id>`
- Frontend: `Received newMessage: {...}` when messages arrive

If you see those, your REST + realtime flow is healthy.

## 7) Security note

Current auth/storage is for demo use only:
- Passwords are hashed, but historical plaintext rows (if any) are upgraded only after successful login.
- SQL verbose logging can print sensitive values during development (including user emails and query text).

Do **not** deploy this as-is to production.
