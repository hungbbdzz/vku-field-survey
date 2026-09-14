// =========================================================
// form/history.ts — Submission history & audit queue manager
// Displays offline/online inspection records, KPI metrics,
// manual Sync trigger, photo thumbnails & CSV/JSON export.
// =========================================================

import { getAllSubmissions, deleteSubmission, clearAllSubmissions, Submission } from '../db';
import { flushPendingSubmissions, syncSingleSubmission } from '../sync';
import { showToast } from '../utils/toast';
import { loadSubmissionForEdit, CAMPUS_ZONES } from './steps';

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

const PRIORITY_LABELS: Record<string, string> = {
  normal: '🟢 Bình thường',
  high: '🟡 Cần xử lý sớm',
  urgent: '🔴 Khẩn cấp',
};

// URL cache for photos to revoke when leaving history view
let activeObjectUrls: string[] = [];
let allCachedSubmissions: Submission[] = [];

export async function renderHistory(container: HTMLElement): Promise<void> {
  // Clean up previous image URLs
  cleanupPhotoUrls();

  container.innerHTML = `
    <div class="history-view-wrapper">
      <!-- Top Bar Header -->
      <div class="history-top-bar">
        <div>
          <h2 class="history-title">📋 Quản lý khảo sát cơ sở vật chất VKU</h2>
          <p class="history-subtitle">Theo dõi hiện trạng toàn trường, chỉnh sửa phiếu ngoại tuyến và kiểm soát đồng bộ</p>
        </div>
        <div class="history-top-actions">
          <button id="sync-all-btn" class="btn btn-primary btn-sm" title="Gửi toàn bộ báo cáo chưa đồng bộ lên máy chủ">
            <span class="btn-icon" id="sync-icon">🔄</span> Đồng bộ tất cả
          </button>
          <button id="back-to-form" class="btn btn-secondary btn-sm">+ Khảo sát mới</button>
        </div>
      </div>

      <!-- Realtime Metrics Summary Ribbon -->
      <div class="metrics-ribbon">
        <div class="metric-card">
          <div class="metric-val" id="metric-total">0</div>
          <div class="metric-lbl">Tổng số khảo sát</div>
        </div>
        <div class="metric-card metric-pending">
          <div class="metric-val" id="metric-pending">0</div>
          <div class="metric-lbl">⏳ Chờ đồng bộ (Offline)</div>
        </div>
        <div class="metric-card metric-synced">
          <div class="metric-val" id="metric-synced">0</div>
          <div class="metric-lbl">☁️ Đã đồng bộ lên Cloud</div>
        </div>
        <div class="metric-card metric-star">
          <div class="metric-val" id="metric-rating">0.0 ★</div>
          <div class="metric-lbl">Đánh giá trung bình</div>
        </div>
      </div>

      <!-- Filter and Search Bar -->
      <div class="filter-search-bar">
        <input
          type="text"
          id="search-input"
          class="field-input search-input"
          placeholder="🔍 Tìm nhanh theo phòng, khu vực, lỗi, ghi chú, kiểm tra viên..."
        />
        
        <!-- Filter Zone -->
        <select id="filter-zone" class="field-input field-select filter-select">
          <option value="ALL">🏢 Tất cả khu vực VKU</option>
          ${CAMPUS_ZONES.map(
            (z) => `<option value="${z.id}">${z.icon} ${z.shortName}</option>`
          ).join('')}
        </select>

        <!-- Filter Category -->
        <select id="filter-category" class="field-input field-select filter-select">
          <option value="ALL">🏷️ Tất cả hạng mục</option>
          <option value="Hardware">🖥️ Phần cứng máy tính</option>
          <option value="Projector">📽️ Máy chiếu & Màn hình</option>
          <option value="AC">❄️ Điều hòa & Quạt</option>
          <option value="Electrical">⚡ Điện & Chiếu sáng</option>
          <option value="Furniture">🪑 Bàn ghế & Nội thất</option>
        </select>

        <!-- Filter Status -->
        <select id="filter-status" class="field-input field-select filter-select">
          <option value="ALL">Tất cả trạng thái</option>
          <option value="PENDING_SYNC">⏳ Chỉ chờ đồng bộ</option>
          <option value="SYNCED">☁️ Chỉ đã đồng bộ</option>
        </select>

        <!-- Action tools -->
        <div class="filter-actions-group">
          <button id="export-csv-btn" class="btn btn-outline btn-sm" title="Tải file báo cáo CSV/Excel">
            📥 Xuất CSV
          </button>
          <button id="print-report-btn" class="btn btn-outline btn-sm" title="In hoặc lưu PDF báo cáo khảo sát">
            🖨️ In / PDF
          </button>
          <button id="clear-all-btn" class="btn btn-outline-danger btn-sm" title="Xóa toàn bộ dữ liệu khảo sát trong máy">
            🗑️ Dọn sạch
          </button>
        </div>
      </div>

      <!-- Multi-column Cards List -->
      <div id="history-list" class="history-grid">
        <div class="loading-spinner">⏳ Đang tải dữ liệu từ IndexedDB...</div>
      </div>
    </div>

    <!-- Full Inspection Detail Modal -->
    <div id="detail-modal" class="photo-modal hidden">
      <div class="photo-modal-content detail-modal-content">
        <button id="close-detail-btn" class="close-modal-btn" aria-label="Đóng">✕</button>
        <div id="detail-modal-body"></div>
      </div>
    </div>

    <!-- Photo Lightbox Modal -->
    <div id="photo-modal" class="photo-modal hidden">
      <div class="photo-modal-content">
        <button id="close-modal-btn" class="close-modal-btn" aria-label="Đóng">✕</button>
        <img id="modal-img" src="" alt="Ảnh khảo sát phóng to" />
        <div id="modal-caption" class="modal-caption"></div>
      </div>
    </div>
  `;

  // Wire Top Buttons
  document.getElementById('back-to-form')?.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('navigate', { detail: { page: 'form' } }));
  });

  const syncBtn = document.getElementById('sync-all-btn');
  const syncIcon = document.getElementById('sync-icon');

  syncBtn?.addEventListener('click', async () => {
    if (!navigator.onLine) {
      showToast('Hiện đang offline. Vui lòng kết nối Wi-Fi hoặc 4G để đồng bộ.', 'warning');
      return;
    }
    syncBtn.setAttribute('disabled', 'true');
    syncIcon?.classList.add('spin-animation');
    showToast('Đang tiến hành đẩy toàn bộ hàng đợi lên máy chủ...', 'info');

    const result = await flushPendingSubmissions();
    syncIcon?.classList.remove('spin-animation');
    syncBtn.removeAttribute('disabled');

    if (result.synced > 0) {
      showToast(`Đã đồng bộ thành công ${result.synced}/${result.total} báo cáo!`, 'success');
      await loadAndRenderSubmissions();
    } else if (result.total === 0) {
      showToast('Tất cả dữ liệu đã được đồng bộ trước đó.', 'info');
    } else {
      showToast('Máy chủ tạm thời chưa phản hồi, sẽ tự động thử lại khi có mạng.', 'warning');
    }
  });

  // Modal close listeners
  document.getElementById('close-modal-btn')?.addEventListener('click', closeModal);
  document.getElementById('photo-modal')?.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).id === 'photo-modal') closeModal();
  });

  document.getElementById('close-detail-btn')?.addEventListener('click', closeDetailModal);
  document.getElementById('detail-modal')?.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).id === 'detail-modal') closeDetailModal();
  });

  // Search & Filter listeners
  document.getElementById('search-input')?.addEventListener('input', () => filterItems());
  document.getElementById('filter-zone')?.addEventListener('change', () => filterItems());
  document.getElementById('filter-category')?.addEventListener('change', () => filterItems());
  document.getElementById('filter-status')?.addEventListener('change', () => filterItems());

  // Export CSV
  document.getElementById('export-csv-btn')?.addEventListener('click', async () => {
    const items = await getAllSubmissions();
    if (items.length === 0) {
      showToast('Không có dữ liệu để xuất file.', 'warning');
      return;
    }
    exportToCSV(items);
  });

  // Print / PDF Report
  document.getElementById('print-report-btn')?.addEventListener('click', () => {
    window.print();
  });

  // Clear all submissions
  document.getElementById('clear-all-btn')?.addEventListener('click', async () => {
    const items = await getAllSubmissions();
    if (items.length === 0) {
      showToast('Danh sách lịch sử hiện đang trống.', 'info');
      return;
    }
    if (confirm('Bạn có chắc muốn xóa TẤT CẢ các báo cáo trong cơ sở dữ liệu IndexedDB? Hành động này không thể khôi phục.')) {
      await clearAllSubmissions();
      showToast('Đã dọn sạch toàn bộ lịch sử khảo sát.', 'info');
      await loadAndRenderSubmissions();
    }
  });

  // Initial load
  await loadAndRenderSubmissions();
}

async function loadAndRenderSubmissions(): Promise<void> {
  allCachedSubmissions = await getAllSubmissions();
  allCachedSubmissions.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  updateMetricsRibbon(allCachedSubmissions);
  filterItems();
}

function updateMetricsRibbon(items: Submission[]): void {
  const totalEl = document.getElementById('metric-total');
  const pendingEl = document.getElementById('metric-pending');
  const syncedEl = document.getElementById('metric-synced');
  const ratingEl = document.getElementById('metric-rating');

  const total = items.length;
  const pending = items.filter((s) => s.status === 'PENDING_SYNC').length;
  const synced = items.filter((s) => s.status === 'SYNCED').length;
  const avgRating = total > 0 ? (items.reduce((acc, s) => acc + s.rating, 0) / total).toFixed(1) : '0.0';

  if (totalEl) totalEl.textContent = String(total);
  if (pendingEl) pendingEl.textContent = String(pending);
  if (syncedEl) syncedEl.textContent = String(synced);
  if (ratingEl) ratingEl.textContent = `${avgRating} ★`;
}

function filterItems(): void {
  const query = (document.getElementById('search-input') as HTMLInputElement)?.value.toLowerCase().trim() || '';
  const filterZone = (document.getElementById('filter-zone') as HTMLSelectElement)?.value || 'ALL';
  const filterCategory = (document.getElementById('filter-category') as HTMLSelectElement)?.value || 'ALL';
  const filterStatus = (document.getElementById('filter-status') as HTMLSelectElement)?.value || 'ALL';

  const filtered = allCachedSubmissions.filter((s) => {
    if (filterZone !== 'ALL' && (s.zone || s.building) !== filterZone) return false;
    if (filterCategory !== 'ALL' && s.category !== filterCategory) return false;
    if (filterStatus !== 'ALL' && s.status !== filterStatus) return false;
    if (!query) return true;

    const matchLocation = `${s.zone || ''} ${s.building} ${s.floor} ${s.room} ${s.roomType || ''}`.toLowerCase();
    const matchCat = s.category.toLowerCase();
    const matchNotes = (s.notes || '').toLowerCase();
    const matchInspector = (s.inspector || '').toLowerCase();
    const matchTags = (s.tags || []).join(' ').toLowerCase();

    return (
      matchLocation.includes(query) ||
      matchCat.includes(query) ||
      matchNotes.includes(query) ||
      matchInspector.includes(query) ||
      matchTags.includes(query)
    );
  });

  renderList(filtered);
}

function renderList(items: Submission[]): void {
  const listEl = document.getElementById('history-list');
  if (!listEl) return;

  if (items.length === 0) {
    listEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📭</div>
        <h3>Không tìm thấy báo cáo phù hợp</h3>
        <p>Thử điều chỉnh bộ lọc hoặc bấm <strong>"+ Khảo sát mới"</strong> để bắt đầu ghi nhận dữ liệu.</p>
      </div>
    `;
    return;
  }

  listEl.innerHTML = items.map((s) => renderCard(s)).join('');

  // Attach interactive listeners for each card
  items.forEach((s) => {
    // Zoom thumbnail
    if (s.photo instanceof Blob) {
      const imgBtn = document.getElementById(`img-btn-${s.id}`);
      imgBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        const url = (imgBtn.querySelector('img') as HTMLImageElement)?.src;
        const caption = `${s.zone || s.building} — Phòng ${s.room} (${s.category})`;
        openModal(url, caption);
      });
    }

    // Edit button
    const editBtn = document.getElementById(`edit-btn-${s.id}`);
    editBtn?.addEventListener('click', async (e) => {
      e.stopPropagation();
      await loadSubmissionForEdit(s.id);
    });

    // Delete button
    const delBtn = document.getElementById(`del-btn-${s.id}`);
    delBtn?.addEventListener('click', async (e) => {
      e.stopPropagation();
      const isPending = s.status === 'PENDING_SYNC';
      const promptText = isPending
        ? `Xóa báo cáo phòng ${s.room} (${s.zone || s.building}) khỏi hàng đợi đồng bộ?`
        : `Bạn có chắc muốn xóa báo cáo tại phòng ${s.room} (${s.zone || s.building})?`;
      if (confirm(promptText)) {
        await deleteSubmission(s.id);
        showToast('Đã xóa báo cáo khỏi cơ sở dữ liệu.', 'info');
        await loadAndRenderSubmissions();
      }
    });

    // Sync Single Card button
    const singleSyncBtn = document.getElementById(`sync-single-${s.id}`);
    singleSyncBtn?.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!navigator.onLine) {
        showToast('Hiện đang Offline. Vui lòng kết nối mạng để đồng bộ.', 'warning');
        return;
      }
      singleSyncBtn.setAttribute('disabled', 'true');
      singleSyncBtn.textContent = '⏳ Đang gửi...';
      const success = await syncSingleSubmission(s.id);
      if (success) {
        showToast(`Đã đồng bộ báo cáo phòng ${s.room} lên Cloud!`, 'success');
        updateCardStatus(s.id);
        await loadAndRenderSubmissions();
      } else {
        singleSyncBtn.removeAttribute('disabled');
        singleSyncBtn.textContent = '🔄 Gửi ngay';
        showToast('Chưa gửi được báo cáo, vui lòng thử lại sau.', 'error');
      }
    });

    // View Details Modal
    const detailBtn = document.getElementById(`detail-btn-${s.id}`);
    detailBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      openDetailModal(s);
    });
  });
}

function renderCard(s: Submission): string {
  const date = new Date(s.timestamp).toLocaleString('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
  const stars = '★'.repeat(s.rating) + '☆'.repeat(5 - s.rating);
  const icon = CATEGORY_ICONS[s.category] ?? '🔧';

  let photoHtml = '';
  if (s.photo instanceof Blob) {
    const url = URL.createObjectURL(s.photo);
    activeObjectUrls.push(url);
    photoHtml = `
      <div class="card-thumb-wrap" id="img-btn-${s.id}" title="Chạm để xem ảnh phóng to">
        <img src="${url}" class="card-thumb" alt="Hiện trạng" />
        <span class="card-thumb-zoom">🔍 Phóng to</span>
      </div>
    `;
  }

  const priorityBadge = s.priority
    ? `<span class="badge badge-priority-${s.priority}">${PRIORITY_LABELS[s.priority]}</span>`
    : '';

  const gpsBadge = s.location
    ? `<span class="badge badge-gps" title="Tọa độ GPS">📍 ${s.location.latitude.toFixed(4)}, ${s.location.longitude.toFixed(4)}</span>`
    : '';

  const tagsHtml = s.tags && s.tags.length > 0
    ? `<div class="card-tags-list">${s.tags.map((t) => `<span class="card-tag-pill">${t}</span>`).join('')}</div>`
    : '';

  const isPending = s.status === 'PENDING_SYNC';

  return `
    <div class="history-card" id="card-${s.id}">
      <div class="card-header">
        <div class="card-header-left">
          <span class="card-category">${icon} ${s.category}</span>
          ${priorityBadge}
          ${gpsBadge}
        </div>
        <span class="badge ${STATUS_CLASS[s.status]}">${STATUS_LABELS[s.status]}</span>
      </div>

      <div class="card-body-row">
        <div class="card-body-text">
          <div class="card-location">
            🏢 <strong>${s.zone || s.building}</strong> — Tầng <strong>${s.floor}</strong> — Phòng <strong>${s.room}</strong>
            ${s.roomType ? `<span class="card-tag-pill" style="margin-left: 6px;">${s.roomType}</span>` : ''}
          </div>
          <div class="card-rating" aria-label="${s.rating} sao">${stars} (${s.rating}/5 sao)</div>
          ${tagsHtml}
          ${s.notes ? `<p class="card-notes">“${s.notes}”</p>` : ''}
          ${s.inspector ? `<div class="card-inspector">👤 Kiểm tra viên: <strong>${s.inspector}</strong></div>` : ''}
        </div>
        ${photoHtml}
      </div>

      <div class="card-footer">
        <span class="card-time">🕐 ${date}</span>
        <div class="card-footer-actions">
          ${
            isPending
              ? `<button id="sync-single-${s.id}" class="card-action-btn btn-sync-single" title="Đồng bộ ngay báo cáo này lên máy chủ">🔄 Gửi ngay</button>`
              : ''
          }
          <button id="detail-btn-${s.id}" class="card-action-btn btn-detail" title="Xem chi tiết phiếu khảo sát">👁️ Chi tiết</button>
          <button id="edit-btn-${s.id}" class="card-action-btn btn-edit" title="Chỉnh sửa nội dung báo cáo này">✏️ Sửa</button>
          <button id="del-btn-${s.id}" class="card-action-btn btn-delete" title="Xóa báo cáo này">🗑️ Xóa</button>
        </div>
      </div>
    </div>
  `;
}

export function updateCardStatus(id: string): void {
  const card = document.getElementById(`card-${id}`);
  if (!card) return;
  const badge = card.querySelector('.badge');
  if (badge) {
    badge.className = `badge ${STATUS_CLASS['SYNCED']}`;
    badge.textContent = STATUS_LABELS['SYNCED'];
  }
  const syncBtn = document.getElementById(`sync-single-${id}`);
  if (syncBtn) syncBtn.remove();
}

// ── Detail Modal ─────────────────────────────────────────────
function openDetailModal(s: Submission): void {
  const modal = document.getElementById('detail-modal');
  const body = document.getElementById('detail-modal-body');
  if (!modal || !body) return;

  const date = new Date(s.timestamp).toLocaleString('vi-VN', {
    dateStyle: 'full',
    timeStyle: 'medium',
  });
  const stars = '★'.repeat(s.rating) + '☆'.repeat(5 - s.rating);
  const icon = CATEGORY_ICONS[s.category] ?? '🔧';

  let photoHtml = '';
  if (s.photo instanceof Blob) {
    const url = URL.createObjectURL(s.photo);
    activeObjectUrls.push(url);
    photoHtml = `
      <div class="detail-photo-box">
        <img src="${url}" alt="Ảnh hiện trường" class="detail-photo-img" />
      </div>
    `;
  }

  const mapLink = s.location
    ? `<a href="https://www.google.com/maps?q=${s.location.latitude},${s.location.longitude}" target="_blank" rel="noopener noreferrer" class="btn btn-xs btn-outline">🗺️ Mở Google Maps (${s.location.latitude.toFixed(4)}, ${s.location.longitude.toFixed(4)})</a>`
    : 'Chưa ghi nhận GPS';

  body.innerHTML = `
    <div class="detail-header">
      <div class="detail-header-top">
        <span class="detail-title-icon">${icon}</span>
        <div>
          <h3 class="detail-title">${s.zone || s.building} — Phòng ${s.room}</h3>
          <p class="detail-subtitle">Hạng mục: <strong>${s.category}</strong> (${s.roomType || 'Phòng học'})</p>
        </div>
      </div>
      <span class="badge ${STATUS_CLASS[s.status]}">${STATUS_LABELS[s.status]}</span>
    </div>

    <div class="detail-grid">
      <div class="detail-item">
        <span class="detail-item-label">Tầng / Vị trí:</span>
        <strong class="detail-item-value">Tầng ${s.floor}</strong>
      </div>
      <div class="detail-item">
        <span class="detail-item-label">Mức độ ưu tiên:</span>
        <strong class="detail-item-value">${PRIORITY_LABELS[s.priority || 'normal']}</strong>
      </div>
      <div class="detail-item">
        <span class="detail-item-label">Đánh giá chất lượng:</span>
        <strong class="detail-item-value">${stars} (${s.rating}/5 sao)</strong>
      </div>
      <div class="detail-item">
        <span class="detail-item-label">Kiểm tra viên:</span>
        <strong class="detail-item-value">${s.inspector || 'Chưa định danh'}</strong>
      </div>
      <div class="detail-item full-width">
        <span class="detail-item-label">Thời điểm khảo sát:</span>
        <span class="detail-item-value">${date}</span>
      </div>
      <div class="detail-item full-width">
        <span class="detail-item-label">Tọa độ hiện trường:</span>
        <span class="detail-item-value">${mapLink}</span>
      </div>
    </div>

    ${
      s.tags && s.tags.length > 0
        ? `
        <div class="detail-tags-section">
          <span class="detail-item-label">Các vấn đề khiếm khuyết ghi nhận:</span>
          <div class="card-tags-list">
            ${s.tags.map((t) => `<span class="card-tag-pill">${t}</span>`).join('')}
          </div>
        </div>
      `
        : ''
    }

    ${
      s.notes
        ? `
        <div class="detail-notes-section">
          <span class="detail-item-label">Ghi chú chi tiết:</span>
          <div class="detail-notes-content">“${s.notes}”</div>
        </div>
      `
        : ''
    }

    ${photoHtml}

    <div class="detail-actions">
      <button type="button" id="detail-edit-btn" class="btn btn-primary btn-sm">✏️ Chỉnh sửa phiếu này</button>
      <button type="button" id="detail-close-btn" class="btn btn-secondary btn-sm">Đóng</button>
    </div>
  `;

  document.getElementById('detail-close-btn')?.addEventListener('click', closeDetailModal);
  document.getElementById('detail-edit-btn')?.addEventListener('click', async () => {
    closeDetailModal();
    await loadSubmissionForEdit(s.id);
  });

  modal.classList.remove('hidden');
}

function closeDetailModal(): void {
  const modal = document.getElementById('detail-modal');
  modal?.classList.add('hidden');
}

function openModal(imgUrl: string, caption: string): void {
  const modal = document.getElementById('photo-modal');
  const img = document.getElementById('modal-img') as HTMLImageElement;
  const cap = document.getElementById('modal-caption');
  if (modal && img && cap) {
    img.src = imgUrl;
    cap.textContent = caption;
    modal.classList.remove('hidden');
  }
}

function closeModal(): void {
  const modal = document.getElementById('photo-modal');
  modal?.classList.add('hidden');
}

function cleanupPhotoUrls(): void {
  activeObjectUrls.forEach((url) => URL.revokeObjectURL(url));
  activeObjectUrls = [];
}

// ── Export to CSV (UTF-8 with BOM for Microsoft Excel) ────────
function exportToCSV(items: Submission[]): void {
  const headers = [
    'Mã UUID',
    'Thời gian',
    'Trạng thái',
    'Khu vực Tòa nhà',
    'Tầng',
    'Phòng',
    'Loại không gian',
    'Hạng mục',
    'Đánh giá (1-5)',
    'Mức độ ưu tiên',
    'Vấn đề ghi nhận',
    'Ghi chú khiếm khuyết',
    'Kiểm tra viên',
    'Vĩ độ GPS',
    'Kinh độ GPS',
  ];

  const rows = items.map((s) => [
    `"${s.id}"`,
    `"${new Date(s.timestamp).toLocaleString('vi-VN')}"`,
    `"${STATUS_LABELS[s.status]}"`,
    `"${s.zone || s.building}"`,
    `"${s.floor}"`,
    `"${s.room}"`,
    `"${s.roomType || ''}"`,
    `"${s.category}"`,
    s.rating,
    `"${PRIORITY_LABELS[s.priority || 'normal'] || ''}"`,
    `"${(s.tags || []).join('; ')}"`,
    `"${(s.notes || '').replace(/"/g, '""')}"`,
    `"${(s.inspector || '').replace(/"/g, '""')}"`,
    s.location?.latitude || '',
    s.location?.longitude || '',
  ]);

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `VKU_Field_Survey_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  showToast('Đã xuất file báo cáo CSV thành công!', 'success');
}
