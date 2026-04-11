# Deployment and Capacity Guide

This document covers practical planning for running **b-chat** for up to 100 users,
including future media attachments (images/videos/audio/files).

## 1) Database and storage sizing

### Current state

- Users and text messages are stored in SQLite (`backend/family-chat.db`).
- Messages include only text plus metadata (`from_id`, `to_id`, `client_token`, `timestamp`).
- There is no file/image/video blob column and no object storage integration yet.
- SQLite size today is mostly text + indexes and grows slowly for small user counts.

### Text-only sizing

Quick planning formula:

```
messages_per_day_total × avg_text_bytes × retention_days × 1.3
```

`1.3` adds overhead for row metadata, indexes, and fragmentation.

Example for 100 users:
- 100 users, each sends 50 messages/day on average
- average 120 bytes/message
- retention 365 days

```
100 × 50 × 120 × 365 = 219,000,000 bytes ≈ 209 MB/year
× 1.3 overhead ≈ 272 MB/year
```

**Recommendation:** reserve **1–2 GB** SQLite disk for the first year.

### If you add images/videos/audio/files

Do **not** store binary blobs in SQLite.

Recommended architecture:
1. Store binaries in object storage (S3/R2/GCS/Azure Blob/MinIO).
2. Store only metadata + URL/path in DB (sender, recipient, MIME type, size, storage key, `created_at`).
3. Keep CDN in front for delivery and caching.

Sample conservative scenario for 100 users/month:
- 30 images/user @ 1.5 MB = 4,500 images → **6.75 GB/month**
- 5 short videos/user @ 15 MB = 500 videos → **7.5 GB/month**
- 40 audio msgs/user @ 0.3 MB = 4,000 audio → **1.2 GB/month**
- 10 files/user @ 0.5 MB = 1,000 files → **0.5 GB/month**

Total ≈ **16 GB/month**, around **192 GB/year** before deletions.

**Recommendation with media:** budget **250–500 GB** object storage to start.
DB metadata only: still well under **5 GB** at this scale.

#### Audio-message notes
- Prefer compressed formats (AAC/Opus) and enforce server-side max duration and size limits.
- Store only metadata in DB (duration, codec, size, URL/key).

---

## 2) Hosting for web + Android clients

### Minimal production topology

1. **Backend API + Socket.IO service**
   - Single Node.js process running `backend/index.js`.
   - Start with 1 small VM or container.

2. **Database**
   - SQLite works for a single-instance deployment with reliable disk backups.
   - For multi-instance scaling or high availability, migrate to PostgreSQL.

3. **Frontend hosting (web)**
   - Build Flutter web assets and host on static hosting/CDN.

4. **TLS + domain**
   - HTTPS for web, WSS for Socket.IO.
   - Ensure the reverse proxy forwards WebSocket upgrades for `/socket.io`.

5. **Object storage** (when attachments are added)
   - For image/video/file payloads.

### Sizing recommendation

| Resource | Recommendation |
|---|---|
| Backend VM/container | 2 vCPU, 2–4 GB RAM |
| Backend disk (DB + logs + backups) | 20–40 GB minimum |
| Static web hosting | any CDN/static host |
| Object storage (with media) | start at 250 GB |

---

## 3) Steps to open website in browser

### Local development

```bash
# Terminal 1 — backend
cd backend
npm install
npm start

# Terminal 2 — frontend
cd frontend
flutter pub get
flutter run -d chrome --dart-define=CHAT_API_BASE_URL=http://localhost:3000
```

### Production web deployment

```bash
cd frontend
flutter build web --release \
  --dart-define=CHAT_API_BASE_URL=https://api.your-domain.com \
  --dart-define=CHAT_USER_AGREEMENT_URL=https://your-domain.com/legal/user-agreement \
  --dart-define=CHAT_OWNER_NAME="Your Name"
```

Deploy `frontend/build/web/` to static hosting/CDN.
Deploy backend at `https://api.your-domain.com`.
Ensure reverse proxy supports WebSocket upgrades (`/socket.io`).
Restrict `CORS_ALLOWLIST` to your web domain.

---

## 4) Android installation package

### Debug APK (internal testing)

```bash
cd frontend
flutter build apk --debug \
  --dart-define=CHAT_API_BASE_URL=https://api.your-domain.com
# Output: frontend/build/app/outputs/flutter-apk/app-debug.apk
```

### Release APK (sideload)

```bash
cd frontend
flutter build apk --release \
  --dart-define=CHAT_API_BASE_URL=https://api.your-domain.com
# Output: frontend/build/app/outputs/flutter-apk/app-release.apk
```

### Play Store package (AAB, recommended)

```bash
cd frontend
flutter build appbundle --release \
  --dart-define=CHAT_API_BASE_URL=https://api.your-domain.com
# Output: frontend/build/app/outputs/bundle/release/app-release.aab
```

### Required before publishing release

1. Create/upload signing keystore.
2. Configure signing in `frontend/android/app/build.gradle.kts`.
3. Set correct `applicationId` and `versionName`/`versionCode`.
4. Test release build on a physical device.

---

## 5) Localization deployment checklist (RU/EN)

Before publishing web/APK/AAB builds:

1. Verify both ARB files are up to date:
   - `frontend/lib/l10n/app_ru.arb`
   - `frontend/lib/l10n/app_en.arb`

2. Regenerate localization outputs:
   ```bash
   cd frontend
   flutter gen-l10n
   ```

3. Smoke-test in both languages:
   - Login/Register/Home/Chat/Settings translations
   - Settings language switch
   - Persisted locale after restart

4. Validate first-run locale behavior:
   - System `ru` → app `ru`
   - System `en` → app `en`
   - Unsupported system locale → fallback `ru`

Locale preference is stored client-side (`SharedPreferences`, key `user_locale`) and does not
require backend state.

---

## 6) Server storage vs device-only storage

**Recommendation: server-backed storage.**

| | Device-only | Server-backed |
|---|---|---|
| History on reinstall | Lost | Preserved |
| Multi-device sync | Not possible | Works |
| Offline resilience | Poor | Good (retry queue) |
| Compliance/audit | Hard | Straightforward |
| Security risk | Device loss/theft | Must secure infrastructure |

Server-backed can be highly secure with TLS in transit, encryption at rest (AES-256-GCM
already implemented), strict auth, and key rotation. Device-only is not automatically more
secure — phones can be lost, rooted, or unencrypted.

---

## 7) Known security limitations (current release)

| Area | Status |
|---|---|
| Socket sender identity | ✅ Verified — `data.from` checked against `socket.data.userId` on every `sendMessage` |
| REST endpoint auth | ⚠️ No token required — `GET /users`, `GET /messages/:fromId/:toId` are open |
| Auth rate limiting | ✅ In-process limiter on `/register` and `/login` |
| Message encryption | ✅ AES-256-GCM at rest |
| Password hashing | ✅ bcrypt |
| CORS | ✅ Configurable allowlist; blocks all origins if empty |
| User data deletion | ❌ No endpoint — required for compliance |
| JWT / session tokens | ❌ Not implemented — planned |

---

## 8) Compliance operations notes

### User Agreement text source

Default URL shown in frontend registration:
```
https://direct.yandex.ru/base/articles/polzovatelskoe-soglashenie
```

> **This must be replaced** with a URL under your own domain before going to production.
> The agreement must name this application's actual data controller and describe its
> specific data processing.

Override:
```bash
flutter run --dart-define=CHAT_USER_AGREEMENT_URL=https://your-domain.com/legal/user-agreement
```

### Backend compliance settings

| Variable | Default | Description |
|---|---|---|
| `REGISTRATION_POLICY` | `strict_ru_email` | `strict_ru_email` or `open_email` |
| `TERMS_VERSION` | `2026-03-31` | Stored with consent timestamp |
| `USER_AGREEMENT_URL` | *(see above)* | Stored with consent evidence |
| `MESSAGE_ENCRYPTION_KEY` | *(dev fallback)* | Must be set securely in production |

### Tables involved

| Table | Purpose |
|---|---|
| `users` | `auth_channel`, `terms_version`, `terms_accepted_at`, `terms_url`, `terms_text_hash` |
| `compliance_events` | Auth/consent audit records (accepted/rejected + reason + request metadata) |
| `messages` | AES-256-GCM encrypted message payload in `text` column |

### Minimal compliance checklist

- [ ] Host User Agreement at your own domain URL
- [ ] Set `REGISTRATION_POLICY` appropriately for your user base
- [ ] Set `USER_AGREEMENT_URL` to your hosted agreement
- [ ] Implement user data deletion endpoint (`DELETE /users/me`)
- [ ] Add indexes to `compliance_events` on `email` and `created_at`
- [ ] Define retention period and archival procedure for `compliance_events`
- [ ] Document and test key rotation procedure for `MESSAGE_ENCRYPTION_KEY`