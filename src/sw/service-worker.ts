// =========================================================
// Service Worker — VKU Field Survey
// Strategy: Cache-First for app shell, Background Sync for submissions
// NOTE: No Workbox — explicit for architecture report clarity
// =========================================================

const CACHE_NAME = 'vku-survey-v1';
const SYNC_TAG = 'sync-submissions';

// App shell assets to pre-cache on install
const APP_SHELL: string[] = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// ── Install: pre-cache app shell ───────────────────────────
self.addEventListener('install', (event: Event) => {
  const e = event as ExtendableEvent;
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  // Activate immediately — don't wait for old SW to be replaced
  (self as unknown as ServiceWorkerGlobalScope).skipWaiting();
});

// ── Activate: remove stale caches ──────────────────────────
self.addEventListener('activate', (event: Event) => {
  const e = event as ExtendableEvent;
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      )
    )
  );
  // Take control of all open clients immediately
  (self as unknown as ServiceWorkerGlobalScope).clients.claim();
});

// ── Fetch: Cache-First strategy ────────────────────────────
self.addEventListener('fetch', (event: Event) => {
  const e = event as FetchEvent;
  // Only handle GET requests; skip cross-origin requests to the sync API
  if (e.request.method !== 'GET') return;

  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached; // Cache hit → return immediately

      // Cache miss → fetch from network, then cache it
      return fetch(e.request)
        .then((response) => {
          // Only cache valid, same-origin responses
          if (
            !response ||
            response.status !== 200 ||
            response.type !== 'basic'
          ) {
            return response;
          }
          const toCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, toCache));
          return response;
        })
        .catch(() => {
          // Offline fallback for navigation requests
          if (e.request.mode === 'navigate') {
            return caches.match('/') as Promise<Response>;
          }
          return new Response('Offline', { status: 503 });
        });
    })
  );
});

// ── Background Sync ─────────────────────────────────────────
self.addEventListener('sync', (event: Event) => {
  const e = event as SyncEvent;
  if (e.tag === SYNC_TAG) {
    e.waitUntil(syncPendingSubmissions());
  }
});

// ── Push messages from main thread ─────────────────────────
self.addEventListener('message', (event: MessageEvent) => {
  if (event.data?.type === 'SKIP_WAITING') {
    (self as unknown as ServiceWorkerGlobalScope).skipWaiting();
  }
});

// ── Sync logic ──────────────────────────────────────────────
// We open IndexedDB directly here — idb library not available in SW,
// so we use the raw IDBOpenDBRequest API (keeps the SW dependency-free).
async function syncPendingSubmissions(): Promise<void> {
  const db = await openDB();
  const records = await getAllPending(db);

  // Sequential dispatch — stop on first failure to keep queue consistent
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

      const res = await fetch('/api/submissions', { method: 'POST', body });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      await markSynced(db, record.id);
    } catch (err) {
      console.warn('[SW] Sync failed for', record.id, err);
      break; // Stop loop — retry on next sync event
    }
  }
}

// ── Raw IndexedDB helpers (no idb library) ──────────────────
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('field-survey', 1);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('submissions')) {
        db.createObjectStore('submissions', { keyPath: 'id' });
      }
    };
  });
}

function getAllPending(db: IDBDatabase): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('submissions', 'readonly');
    const store = tx.objectStore('submissions');
    const req = store.getAll();
    req.onsuccess = () =>
      resolve(
        (req.result as any[]).filter((r) => r.status === 'PENDING_SYNC')
      );
    req.onerror = () => reject(req.error);
  });
}

function markSynced(db: IDBDatabase, id: string): Promise<void> {
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

// ── Type augmentation for non-standard events ───────────────
interface SyncEvent extends ExtendableEvent {
  readonly tag: string;
  readonly lastChance: boolean;
}
