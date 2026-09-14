// =========================================================
// public/sw.js — Service Worker (Cache-First + Background Sync)
// Plain JS — no bundler, no Workbox. Explicit for report clarity.
// =========================================================

const CACHE_NAME = 'vku-survey-v1';
const SYNC_TAG = 'sync-submissions';

const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// ── Install ────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// ── Activate ───────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch: Cache-First ─────────────────────────────────────
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request)
        .then((response) => {
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          const toCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, toCache));
          return response;
        })
        .catch(() => {
          if (event.request.mode === 'navigate') {
            return caches.match('/');
          }
          return new Response('Offline', { status: 503 });
        });
    })
  );
});

// ── Background Sync ────────────────────────────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === SYNC_TAG) {
    event.waitUntil(syncPendingSubmissions());
  }
});

// ── Message from main thread ───────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ── Sync logic ─────────────────────────────────────────────
async function syncPendingSubmissions() {
  const db = await openDB();
  const records = await getAllPending(db);
  const API_URL = '/api/submissions';

  for (const record of records) {
    try {
      const body = new FormData();
      body.append('id', record.id);
      body.append('timestamp', record.timestamp);
      body.append('building', record.building);
      body.append('floor', record.floor);
      body.append('room', record.room);
      body.append('category', record.category);
      body.append('rating', String(record.rating));
      body.append('notes', record.notes ?? '');
      if (record.photo instanceof Blob) {
        body.append('photo', record.photo, 'photo.jpg');
      }

      const res = await fetch(API_URL, { method: 'POST', body });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      await markSynced(db, record.id);
    } catch (err) {
      console.warn('[SW] Sync failed for', record.id, err);
      break; // Stop — retry on next sync event
    }
  }
}

// ── Raw IndexedDB helpers ──────────────────────────────────
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('field-survey', 1);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('submissions')) {
        db.createObjectStore('submissions', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('draft')) {
        db.createObjectStore('draft');
      }
    };
  });
}

function getAllPending(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('submissions', 'readonly');
    const req = tx.objectStore('submissions').getAll();
    req.onsuccess = () =>
      resolve(req.result.filter((r) => r.status === 'PENDING_SYNC'));
    req.onerror = () => reject(req.error);
  });
}

function markSynced(db, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('submissions', 'readwrite');
    const store = tx.objectStore('submissions');
    const req = store.get(id);
    req.onsuccess = () => {
      const record = req.result;
      if (record) {
        record.status = 'SYNCED';
        store.put(record);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    };
    req.onerror = () => reject(req.error);
  });
}
