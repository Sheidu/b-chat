# Frontend (Flutter)

This is the Flutter client for **b-chat**.

## Run

```bash
flutter pub get
flutter run
```

For desktop on Windows:

```bash
flutter run -d windows
```

## Backend URL configuration

Override the backend URL at runtime:

```bash
flutter run --dart-define=CHAT_API_BASE_URL=http://<YOUR_IP>:3000
```

Default behavior from `lib/config/app_config.dart`:
- Android emulator: `http://10.0.2.2:3000`
- Web/Desktop/iOS: `http://localhost:3000`

## Localization (RU/EN)

This app uses Flutter `gen-l10n` with two locales:
- `ru` (Russian)
- `en` (English)

Localization source files:
- `lib/l10n/app_ru.arb`
- `lib/l10n/app_en.arb`

Locale behavior:
- On first launch, app detects system locale.
- If locale is unsupported, fallback is Russian (`ru`).
- Chosen locale is persisted in `SharedPreferences` (`user_locale`).
- Users can switch language from **Settings → Language**.

If you change ARB strings, regenerate localizations:

```bash
flutter gen-l10n
```


## Authenticated API usage

Backend now returns JWT on register/login and requires
`Authorization: Bearer <token>` for:

- `GET /users` (contact list scoped to current user)
- `GET /messages/:fromId/:toId?before=<timestamp>&limit=50`
- `DELETE /users/me`

`AuthProvider` stores token in memory and attaches it to REST requests.

Home screen now has **Add Contact** FAB:
- Opens Discover screen
- Loads `/users/discover`
- Client-side search by name/email/phone
- Adds contact via `POST /users/contacts` with optional nickname

## Socket connection model

`SocketService` is a **shared singleton** provided via `MultiProvider` in `main.dart`.
Both `HomeScreen` and `ChatScreen` consume the same instance from the Provider — neither
screen creates its own `SocketService()`.

- `HomeScreen` calls `socketService.connect(userId)` after the build phase and subscribes
  to `usersChanged` events.
- `ChatScreen` reads the Provider instance via `Provider.of<SocketService>(context, listen: false)`
  in `initState` and calls `connect` only if not already connected (idempotent).
- `ChatScreen.dispose()` does **not** call `socketService.dispose()` — the Provider owns
  the lifecycle.

`Consumer<SocketService>` widgets in `ChatScreen` (AppBar status text and connection banner)
now correctly reflect the live connection state because they watch the same instance that is
managing the socket.

## Expected runtime signals

On successful connection and messaging you should see logs similar to:
- `Socket connected → user <id>`
- `Received newMessage: {...}`

## User Agreement

During registration, users must accept the User Agreement and provide a phone number.

Current default URL shown in UI:
```
https://direct.yandex.ru/base/articles/polzovatelskoe-soglashenie
```

Override at run/build time:

```bash
flutter run --dart-define=CHAT_USER_AGREEMENT_URL=https://your-domain.com/legal/user-agreement
```

Override the consent text owner name:

```bash
flutter run --dart-define=CHAT_OWNER_NAME="Family Server Admin"
```

> **Important:** for production use the User Agreement must be hosted at a URL under your
> own domain and must name the actual data controller for this application.

## Reliability and UX notes

- Chat send uses Socket.IO acknowledgement with retry queue for transient disconnects.
- Optimistic messages are marked as failed after ~10 seconds without ACK and expose a retry action in chat UI.
- Conversation rendering de-duplicates optimistic/server echoes and suppresses duplicate IDs.
- Login/Register submit with Enter key exactly like pressing the action button.
- Connection status is shown in the ChatScreen AppBar and as a banner when disconnected.

## Tests

```bash
flutter test
```

Test coverage includes:
- `ConversationMessageStore` — optimistic message replacement and duplicate suppression
- Login/Register — Enter-key submission behaviour
- Widget tests — login screen render, register screen render, locale provider

## Building for release

### Android APK

```bash
flutter build apk --release \
  --dart-define=CHAT_API_BASE_URL=https://api.your-domain.com
```

### Android AAB (Play Store)

```bash
flutter build appbundle --release \
  --dart-define=CHAT_API_BASE_URL=https://api.your-domain.com
```

### Web

```bash
flutter build web --release \
  --dart-define=CHAT_API_BASE_URL=https://api.your-domain.com
```