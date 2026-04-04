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

You can override backend URL at runtime:

```bash
flutter run --dart-define=CHAT_API_BASE_URL=http://<YOUR_IP>:3000
```

Default behavior from `lib/config/app_config.dart`:
- Android: `http://10.0.2.2:3000`
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

## Expected runtime signals

On successful connection and messaging you should see logs similar to:
- `Socket connected → user <id>`
- `Received newMessage: {...}`

These indicate realtime Socket.IO flow is working end-to-end.

## User Agreement

During registration, users must accept the User Agreement.

Current default URL shown in UI:
- `https://direct.yandex.ru/base/articles/polzovatelskoe-soglashenie`

You can override it:

```bash
flutter run --dart-define=CHAT_USER_AGREEMENT_URL=https://your-domain.com/legal/user-agreement
```
