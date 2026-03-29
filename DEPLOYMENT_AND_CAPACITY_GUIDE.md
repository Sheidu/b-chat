# Deployment and Capacity Guide

This document answers practical planning questions for running **b-chat** for about 20 users, including future media attachments (images/videos/audio/files).

## 1) Database and storage sizing for 20 users

## Current state in this repository

- The app currently stores users and text messages in SQLite (`backend/family-chat.db`).
- Messages currently include only text (`messages.text`) plus metadata (`from_id`, `to_id`, `client_token`, `timestamp`).
- There is no file/image/video blob column yet, and no object storage integration in current backend routes.
- Backend runtime is layered:
  - `index.js` bootstrap/composition
  - `db/` for connection + migrations
  - `repositories/` for SQL
  - `services/` for business logic
  - `routes/` and `sockets/` for transport

Because of that, SQLite size today is mostly text + indexes and grows slowly for 20 users.

## Text-only sizing (current app)

Quick planning formula for text-only:

- `messages_per_day_total × avg_text_bytes × retention_days × 1.3`
- `1.3` adds overhead for row metadata, indexes, and fragmentation.

Example assumptions for 20 users:

- 20 users
- each sends 100 messages/day on average
- average 120 bytes/message (short text + punctuation + emoji mix)
- retention 365 days

Estimated raw text/year:

- `20 × 100 × 120 × 365 = 87,600,000 bytes ≈ 83.5 MB`

With overhead (~30%):

- about `108 MB/year`

Practical recommendation for current text-only chat:

- Reserve **0.5-1 GB** SQLite disk for the first year to leave room for growth, backups, and safety margin.

## If you add images/videos/audio/files (recommended approach)

Do **not** store video/image binary blobs directly in SQLite for production use.

Recommended architecture:

1. Store binaries in object storage (S3/R2/GCS/Azure Blob/MinIO).
2. Store only metadata + URL/path in DB (sender, recipient, MIME type, size, storage key, created_at).
3. Keep CDN in front for delivery and caching.

### Capacity formula for media

Monthly attachment storage estimate:

- `(images_per_month × avg_image_size) + (videos_per_month × avg_video_size) + (audio_messages_per_month × avg_audio_size) + (files_per_month × avg_file_size)`

Then multiply by retention months and add ~15% safety.

Sample conservative scenario for 20 users:

- 30 images/user/month @ 1.5 MB = `900 images` => `1.35 GB/month`
- 5 short videos/user/month @ 15 MB = `100 videos` => `1.5 GB/month`
- 40 audio msgs/user/month @ 0.3 MB (compressed voice notes) = `800 audio` => `0.24 GB/month`
- 10 files/user/month @ 0.5 MB = `200 files` => `0.1 GB/month`

Total ≈ `3.19 GB/month`, around **38 GB/year** before deletions.

Planning recommendation with media enabled:

- Object storage budget: **50-100 GB** to start.
- DB (metadata only): still usually **<2 GB** for this scale.

### Audio-message specific notes

- Voice notes are usually much smaller than short video clips, but they can still dominate storage if users send many per day.
- Strongly prefer compressed formats (for example AAC/Opus) and enforce server-side max duration and size limits.
- Keep audio in object storage and store only metadata in DB (duration, codec, size, URL/key).

## 2) Hosting needed for website + Android clients

## Minimal production topology (good for 20 users)

1. **Backend API + Socket.IO service**
   - Node.js server running your `backend/index.js` bootstrap (which composes `app.js`, DB modules, repositories, services, routes, and socket handlers).
   - Start with 1 small VM/container.

2. **Database**
   - For current small scale, SQLite can work if you run a single backend instance and have reliable disk backups.
   - If you plan multi-instance scaling/high availability later, migrate to PostgreSQL.

3. **Frontend hosting (web)**
   - Build Flutter web assets and host on static hosting/CDN.

4. **TLS + domain**
   - HTTPS for web.
   - WSS (secure websocket) for Socket.IO in production.
   - Ensure websocket upgrade forwarding for `/socket.io`.

5. **Object storage** (when attachments are introduced)
   - For image/video/file payloads.

## Sizing recommendation to start

- Backend VM/container: **2 vCPU, 2-4 GB RAM**.
- Disk for backend+SQLite+logs+backups: **20-40 GB** minimum.
- Static web hosting: any CDN/static host plan is enough.
- Object storage: start at **50 GB** if media is on.

## Server storage vs storing messages only on user devices

Short answer: for most chat products, **server-backed storage is preferable**.

### Device-only storage (no server history)

Pros:

- Lower backend storage cost.
- Potentially less central data to breach.

Cons:

- Users lose history when they reinstall app, switch phone, or lose device.
- Multi-device sync is hard or impossible.
- Message delivery/recovery is less reliable when devices are offline.
- Hard to support legal/compliance/audit requirements if needed later.

### Server-backed storage (recommended baseline)

Pros:

- Reliable history and sync across web + Android (and future iOS/desktop).
- Better operational control: backups, retention policy, restores.
- Easier feature growth (search, attachments, moderation, analytics, export).

Cons:

- You must secure infrastructure and data lifecycle.
- Requires encryption, access controls, monitoring, and backup hygiene.

### Security comparison (important)

- Device-only is **not automatically more secure**; phones can be lost, rooted, malware-infected, or unencrypted.
- Server-backed can be highly secure if done correctly:
  - TLS in transit
  - encryption at rest
  - strict auth/session controls
  - least-privilege DB/object-storage access
  - key rotation + audit logging
- Highest-security model for private chat is end-to-end encryption, regardless of whether server stores ciphertext.

Practical recommendation for this app: keep server-backed storage, add retention controls, and encrypt media/object storage.

## 3) Steps to open website in browser for this app

The frontend is Flutter and can run/build for web.

### Local development in browser

1. Start backend:

```bash
cd backend
npm install
npm start
```

2. Start frontend in Chrome:

```bash
cd frontend
flutter pub get
flutter run -d chrome --dart-define=CHAT_API_BASE_URL=http://localhost:3000
```

3. Open the URL printed by Flutter (typically localhost with a random port).

### Production web deployment flow

1. Build web bundle:

```bash
cd frontend
flutter build web --release --dart-define=CHAT_API_BASE_URL=https://api.your-domain.com
```

2. Deploy `frontend/build/web/` to static hosting/CDN.
3. Deploy backend at `https://api.your-domain.com`.
4. Ensure reverse proxy supports websocket upgrades (`/socket.io`).
5. Keep CORS restricted to your web domain in production.

## 4) How to make Android installation package

This Flutter project already includes Android platform scaffolding in `frontend/android/`.

### Debug APK (quick internal testing)

```bash
cd frontend
flutter pub get
flutter build apk --debug --dart-define=CHAT_API_BASE_URL=https://api.your-domain.com
```

Output typically:

- `frontend/build/app/outputs/flutter-apk/app-debug.apk`

### Release APK

```bash
cd frontend
flutter build apk --release --dart-define=CHAT_API_BASE_URL=https://api.your-domain.com
```

Output:

- `frontend/build/app/outputs/flutter-apk/app-release.apk`

### Play Store package (recommended): AAB

```bash
cd frontend
flutter build appbundle --release --dart-define=CHAT_API_BASE_URL=https://api.your-domain.com
```

Output:

- `frontend/build/app/outputs/bundle/release/app-release.aab`

### Required before publishing release

1. Create/upload-signing keystore.
2. Configure signing in `frontend/android/app/build.gradle.kts`.
3. Set proper app id/version in Gradle.
4. Test release build on physical device.

---

## Practical summary

- **20 users, text-only:** SQLite disk needs are small (well under 1 GB/year in typical usage).
- **With media:** storage cost is dominated by object storage, not DB.
- **Hosting:** one small backend VM + static web hosting + TLS is enough to start.
- **Web access:** use Flutter web build + hosted backend URL.
- **Android package:** use `flutter build apk` (testing) and `flutter build appbundle` (Play Store).
