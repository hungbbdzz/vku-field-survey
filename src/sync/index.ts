// =========================================================
// sync/index.ts — Offline sync queue
// Dispatches PENDING_SYNC records to backend sequentially.
// Called from:
//   1. SW 'sync' event (Background Sync API — Chrome/Android)
//   2. window 'online' event fallback (Safari/iOS)
//   3. Capacitor Network.addListener (native Android)
// =========================================================

import {
  getPendingSubmissions,
  markSubmissionSynced,
  Submission,
} from '../db';

export const SYNC_TAG = 'sync-submissions';

// ── Endpoint ────────────────────────────────────────────────
// In production replace with your actual API URL.
// Set VITE_API_URL in .env (or Cloudflare Pages env vars).
const API_URL = import.meta.env.VITE_API_URL ?? '/api/submissions';

// ── Register Background Sync tag ────────────────────────────
export async function registerBackgroundSync(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    // Background Sync is not available on Safari — guard the call
    if ('sync' in reg) {
      await (reg as any).sync.register(SYNC_TAG);
      console.info('[Sync] Background Sync registered:', SYNC_TAG);
    }
  } catch (err) {
    console.warn('[Sync] Background Sync registration failed:', err);
    // Fallback: attempt immediate sync
    await flushPendingSubmissions();
  }
}

// ── Main flush function ──────────────────────────────────────
// Sequential loop (for...of + await) — stops on first failure
// to avoid an inconsistent queue state.
export async function flushPendingSubmissions(): Promise<void> {
  const pending = await getPendingSubmissions();
  if (pending.length === 0) return;

  console.info(`[Sync] Flushing ${pending.length} pending submission(s)`);

  for (const record of pending) {
    try {
      await dispatchSubmission(record);
      await markSubmissionSynced(record.id);
      console.info('[Sync] Synced:', record.id);
      // Notify UI
      window.dispatchEvent(
        new CustomEvent('submission-synced', { detail: { id: record.id } })
      );
    } catch (err) {
      console.warn('[Sync] Failed for', record.id, '— stopping loop:', err);
      break; // Do not continue — retry on next online event
    }
  }
}

// ── HTTP dispatch ────────────────────────────────────────────
async function dispatchSubmission(record: Submission): Promise<void> {
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
    body.append('photo', record.photo, `photo-${record.id}.jpg`);
  }

  const res = await fetch(API_URL, { method: 'POST', body });
  if (!res.ok) {
    throw new Error(`Server responded ${res.status} ${res.statusText}`);
  }
}

// ── Online event listeners ───────────────────────────────────
// Set up in main.ts; exported here for testability
export function setupOnlineListener(): void {
  window.addEventListener('online', () => {
    console.info('[Sync] Network restored — flushing queue');
    flushPendingSubmissions();
  });
}
