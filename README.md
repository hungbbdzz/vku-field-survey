# VKU Field Survey

> **Offline-first** campus facility inspection PWA for Vietnam-Korea University of Information and Communication Technology (VKU).

[![Deploy to Cloudflare Pages](https://deploy.workers.cloudflare.com/button)](https://dash.cloudflare.com/)

---

## Features

| Feature | Status |
|---|---|
| PWA installable (standalone) | ✅ |
| Cache-First Service Worker (no Workbox) | ✅ |
| 3-step inspection form | ✅ |
| IndexedDB persistence (`idb`) + draft recovery | ✅ |
| Background Sync API + `window.online` fallback | ✅ |
| Photo capture (web + Capacitor Camera) | ✅ |
| Network detection (web + Capacitor Network) | ✅ |
| Android APK via Capacitor | ✅ |
| Cloudflare Pages deploy | ✅ |

---

## Project Structure

```
vku-field-survey/
├── public/
│   ├── sw.js               ← Service Worker (Cache-First + Background Sync)
│   ├── manifest.json       ← PWA manifest
│   └── icons/
│       ├── icon-192.png
│       └── icon-512.png
├── src/
│   ├── main.ts             ← App entry: SW registration, network, navigation
│   ├── style.css           ← Global design system
│   ├── db/
│   │   └── index.ts        ← IndexedDB layer (idb): submissions + draft store
│   ├── form/
│   │   ├── steps.ts        ← 3-step form state machine
│   │   ├── camera.ts       ← Photo capture (Capacitor / web fallback)
│   │   └── history.ts      ← Submission history view
│   ├── sw/
│   │   └── service-worker.ts ← TypeScript source of SW (reference / testing)
│   └── sync/
│       └── index.ts        ← Sequential sync queue + Background Sync registration
├── capacitor.config.ts
├── vite.config.ts
├── tsconfig.json
└── _redirects              ← Cloudflare Pages SPA fallback
```

---

## Quick Start

### Prerequisites

- Node.js ≥ 20
- npm ≥ 9
- Android Studio (for APK build)
- Java 17+ (for Capacitor Android build)

### Development

```bash
# 1. Install dependencies
npm install

# 2. Copy env file
cp .env.example .env

# 3. Start dev server (http://localhost:5173)
npm run dev
```

> **Note:** The Service Worker runs from `public/sw.js`. It is served by Vite's static file server and will register correctly at `localhost`.

### Production Build

```bash
npm run build
# Output: dist/
```

### Deploy to Cloudflare Pages

1. Push repo to GitHub
2. Log into [Cloudflare Pages](https://pages.cloudflare.com/)
3. **Create project** → Connect GitHub repo
4. Set build settings:
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Node version:** `20`
5. Add environment variable: `VITE_API_URL` = your backend URL
6. Click **Deploy**

---

## Android APK (Capacitor)

```bash
# 1. Build the web app
npm run build

# 2. Add Android platform (first time only)
npm run cap:add:android

# 3. Sync web assets into the Android project
npm run cap:sync

# 4. Open in Android Studio
npm run cap:open
# Then: Build → Build Bundle(s)/APK(s) → Build APK(s)
```

### Required Android Permissions

The following are auto-added by Capacitor plugins:

```xml
<!-- Camera plugin -->
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />

<!-- Network plugin -->
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
<uses-permission android:name="android.permission.INTERNET" />
```

---

## Architecture

```
User Input
    │
    ▼
3-Step Form (src/form/steps.ts)
    │  saves draft after each step
    ▼
IndexedDB — draft store (idb)
    │
    │  on Submit
    ▼
IndexedDB — submissions store
    │  status: PENDING_SYNC
    ▼
Sync Queue (src/sync/index.ts)
    │
    ├─── Background Sync API (Chrome/Android)
    │       └── SW 'sync' event → sw.js → syncPendingSubmissions()
    │
    └─── window 'online' event (Safari/iOS fallback)
              └── flushPendingSubmissions()
                      │  for...of sequential
                      ▼
              POST /api/submissions (FormData + Blob)
                      │
                      ▼
              markSubmissionSynced() → status: SYNCED
```

---

## Data Schema

```typescript
interface Submission {
  id: string;          // crypto.randomUUID()
  timestamp: string;   // ISO-8601
  status: 'PENDING_SYNC' | 'SYNCED';
  building: string;    // e.g. "A1"
  floor: string;       // e.g. "3"
  room: string;        // e.g. "301"
  category: 'Hardware' | 'Projector' | 'AC' | 'Electrical' | 'Furniture';
  rating: number;      // 1–5
  notes: string;
  photo: Blob | null;  // Raw Blob, not base64
}
```

---

## Ambiguities / Open Questions

> Flagging these rather than guessing silently (as requested in the spec):

1. **Backend API** — The spec references `POST /api/submissions` but no backend is specified. The sync queue dispatches to `VITE_API_URL`. You need to provide a backend (e.g., Cloudflare Worker, Supabase, or a simple Express server) for sync to work end-to-end. The app is fully functional offline without it.

2. **Background Sync persistence** — The SW Background Sync API only retries while the browser is open on Android Chrome. For iOS/Safari, the `window.online` event is the only fallback. Confirmed this limitation is documented in the report.

3. **Photo format** — Photos are stored as raw `Blob` in IndexedDB. The sync queue sends them as `multipart/form-data`. Make sure your backend accepts multipart uploads.

4. **Capacitor live reload** — During Android dev, uncomment the `server.url` in `capacitor.config.ts` pointing to your local IP for hot reload. Remove before building the production APK.

5. **Icon format** — Icons are JPEG (generated). For maximum PWA compatibility, consider converting to PNG using an image editor.

---

## License

MIT — Vietnam-Korea University of Information and Communication Technology (VKU)
