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

## Expected runtime signals

On successful connection and messaging you should see logs similar to:
- `Socket connected → user <id>`
- `Received newMessage: {...}`

These indicate realtime Socket.IO flow is working end-to-end.
