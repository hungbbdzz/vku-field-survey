// =========================================================
// db/index.ts — IndexedDB layer via `idb`
// Database: field-survey  |  Store: submissions
// =========================================================

import { openDB as openIDB, DBSchema, IDBPDatabase } from 'idb';

// ── Schema types ───────────────────────────────────────────
export type SyncStatus = 'PENDING_SYNC' | 'SYNCED';

export type Category =
  | 'Hardware'
  | 'Projector'
  | 'AC'
  | 'Electrical'
  | 'Furniture';

export interface Submission {
  id: string;             // crypto.randomUUID()
  timestamp: string;      // ISO-8601
  status: SyncStatus;
  building: string;
  floor: string;
  room: string;
  category: Category;
  rating: number;         // 1–5
  notes: string;
  photo: Blob | null;
}

// Draft saved between form steps (no id / status yet)
export type SubmissionDraft = Omit<Submission, 'id' | 'status'>;

interface SurveyDB extends DBSchema {
  submissions: {
    key: string;
    value: Submission;
  };
  draft: {
    key: 'current';
    value: Partial<SubmissionDraft>;
  };
}

// ── Singleton DB promise ────────────────────────────────────
let _db: IDBPDatabase<SurveyDB> | null = null;

export async function getDB(): Promise<IDBPDatabase<SurveyDB>> {
  if (_db) return _db;
  _db = await openIDB<SurveyDB>('field-survey', 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('submissions')) {
        db.createObjectStore('submissions', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('draft')) {
        db.createObjectStore('draft');
      }
    },
  });
  return _db;
}

// ── Submissions ─────────────────────────────────────────────
export async function saveSubmission(
  submission: Submission
): Promise<void> {
  const db = await getDB();
  await db.put('submissions', submission);
}

export async function getAllSubmissions(): Promise<Submission[]> {
  const db = await getDB();
  return db.getAll('submissions');
}

export async function getPendingSubmissions(): Promise<Submission[]> {
  const all = await getAllSubmissions();
  return all.filter((s) => s.status === 'PENDING_SYNC');
}

export async function markSubmissionSynced(id: string): Promise<void> {
  const db = await getDB();
  const record = await db.get('submissions', id);
  if (record) {
    record.status = 'SYNCED';
    await db.put('submissions', record);
  }
}

export async function deleteSubmission(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('submissions', id);
}

// ── Draft (persists form state across accidental refreshes) ─
export async function saveDraft(
  draft: Partial<SubmissionDraft>
): Promise<void> {
  const db = await getDB();
  await db.put('draft', draft, 'current');
}

export async function loadDraft(): Promise<Partial<SubmissionDraft> | undefined> {
  const db = await getDB();
  return db.get('draft', 'current');
}

export async function clearDraft(): Promise<void> {
  const db = await getDB();
  await db.delete('draft', 'current');
}
