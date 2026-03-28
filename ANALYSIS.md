# Repository Analysis

## Overview
This repository contains a full-stack family chat app with:
- A Node.js/Express + Socket.IO backend backed by SQLite (`backend/`).
- A Flutter frontend using Provider for auth state and Socket.IO client for real-time chat (`frontend/`).

## Backend Architecture (`backend/`)
- `index.js` starts an Express HTTP server and attaches a Socket.IO server.
- SQLite is opened through `better-sqlite3` with WAL mode enabled.
- Tables are created at startup for `users` and `messages`.
- REST endpoints:
  - `POST /register`
  - `POST /login`
  - `GET /users`
  - `GET /messages/:fromId/:toId`
- Socket events:
  - `join` to subscribe a user socket to `user_<id>` room.
  - `sendMessage` to store and broadcast new messages.

## Frontend Architecture (`frontend/`)
- `main.dart` boots app with `ChangeNotifierProvider<AuthProvider>`.
- `AuthProvider` performs register/login HTTP calls and tracks auth state.
- Screen flow:
  - `LoginScreen`
  - `RegisterScreen`
  - `HomeScreen` (contacts)
  - `ChatScreen` (history + live updates)
- `SocketService` wraps socket connection and message send/listen behavior.

## Key Findings
1. **Password storage is insecure**
   - Passwords are stored in plaintext and compared directly in SQL queries.
   - `bcrypt` is listed in dependencies but not used.

2. **Inconsistent backend base URL usage in Flutter**
   - `AuthProvider` and `HomeScreen` use `http://10.0.2.2:3000` (Android emulator).
   - `SocketService` is hardcoded to `http://localhost:3000`.
   - This can break chat connectivity depending on platform/environment.

3. **Missing model implementation**
   - `frontend/lib/models/messages.dart` exists but is empty.
   - Message data is handled as untyped maps throughout UI.

4. **Provider wiring risk**
   - `HomeScreen` calls `Provider.of<SocketService>(context, ...)` on logout.
   - `main.dart` only provides `AuthProvider`, so this may throw at runtime unless another provider is added elsewhere.

5. **Data and dependency artifacts committed**
   - SQLite DB files (`family-chat.db`, `-wal`, `-shm`) and `node_modules/` are present in repo.
   - This inflates repository size and risks environment-specific state leaking into source control.

6. **Package metadata is minimal**
   - Frontend `pubspec.yaml` has only bare dependencies and no Flutter project metadata sections.

## Suggested Next Improvements
1. Hash passwords with bcrypt on registration and validate with bcrypt compare on login.
2. Centralize API/socket base URL configuration by platform/env.
3. Add typed models (`User`, `Message`) and parse JSON into model objects.
4. Fix provider setup for `SocketService` (or avoid provider access in `HomeScreen`).
5. Update `.gitignore` and remove DB/runtime artifacts and `node_modules` from versioned files.
6. Add lint/test scripts for backend and frontend.
