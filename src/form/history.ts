// =========================================================
// form/history.ts — Submission history view
// Lists all saved records from IndexedDB with sync status.
// =========================================================

import { getAllSubmissions, Submission } from '../db';

const STATUS_LABELS: Record<string, string> = {
  PENDING_SYNC: 'Chờ đồng bộ',
  SYNCED: 'Đã đồng bộ',
};

const STATUS_CLASS: Record<string, string> = {
  PENDING_SYNC: 'badge-pending',
  SYNCED: 'badge-synced',
};

const CATEGORY_ICONS: Record<string, string> = {
  Hardware: '🖥️',
  Projector: '📽️',
  AC: '❄️',
  Electrical: '⚡',
  Furniture: '🪑',
};

export async function renderHistory(container: HTMLElement): Promise<void> {
  container.innerHTML = `
    <div class="history-header">
      <h2 class="history-title">📋 Lịch sử kiểm tra</h2>
      <button id="back-to-form" class="btn btn-secondary btn-sm">← Kiểm tra mới</button>
    </div>
    <div id="history-list" class="history-list">
      <div class="loading-spinner">⏳ Đang tải...</div>
    </div>
  `;

  document.getElementById('back-to-form')?.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('navigate', { detail: { page: 'form' } }));
  });

  const submissions = await getAllSubmissions();
  const listEl = document.getElementById('history-list')!;

  if (submissions.length === 0) {
    listEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📭</div>
        <p>Chưa có báo cáo nào được lưu.</p>
      </div>
    `;
    return;
  }

  // Sort newest first
  submissions.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  listEl.innerHTML = submissions.map((s) => renderCard(s)).join('');
}

function renderCard(s: Submission): string {
  const date = new Date(s.timestamp).toLocaleString('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
  const stars = '★'.repeat(s.rating) + '☆'.repeat(5 - s.rating);
  const icon = CATEGORY_ICONS[s.category] ?? '🔧';

  return `
    <div class="history-card" id="card-${s.id}">
      <div class="card-header">
        <span class="card-category">${icon} ${s.category}</span>
        <span class="badge ${STATUS_CLASS[s.status]}">${STATUS_LABELS[s.status]}</span>
      </div>
      <div class="card-location">
        📍 ${s.building} — Tầng ${s.floor} — Phòng ${s.room}
      </div>
      <div class="card-rating" aria-label="${s.rating} sao">${stars}</div>
      ${s.notes ? `<p class="card-notes">${s.notes}</p>` : ''}
      <div class="card-footer">
        <span class="card-time">🕐 ${date}</span>
      </div>
    </div>
  `;
}

// Live update a card's badge when it syncs
export function updateCardStatus(id: string): void {
  const card = document.getElementById(`card-${id}`);
  if (!card) return;
  const badge = card.querySelector('.badge');
  if (badge) {
    badge.className = `badge ${STATUS_CLASS['SYNCED']}`;
    badge.textContent = STATUS_LABELS['SYNCED'];
  }
}
