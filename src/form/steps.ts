// =========================================================
// form/steps.ts — 3-step form state machine
// State is held in memory AND persisted to IndexedDB draft
// after each step to survive accidental page refreshes.
// =========================================================

import { Category, SubmissionDraft, saveDraft, loadDraft, clearDraft, saveSubmission } from '../db';
import { capturePhoto, createPreviewURL, revokePreviewURL } from './camera';
import { registerBackgroundSync } from '../sync';

// ── In-memory draft ──────────────────────────────────────────
interface FormState {
  step: 1 | 2 | 3;
  building: string;
  floor: string;
  room: string;
  category: Category | '';
  rating: number;
  notes: string;
  photo: Blob | null;
  photoPreviewURL: string | null;
}

let state: FormState = {
  step: 1,
  building: '',
  floor: '',
  room: '',
  category: '',
  rating: 0,
  notes: '',
  photo: null,
  photoPreviewURL: null,
};

// ── Restore draft on page load ────────────────────────────────
export async function initFormState(): Promise<void> {
  const saved = await loadDraft();
  if (saved) {
    state = {
      ...state,
      building: saved.building ?? '',
      floor: saved.floor ?? '',
      room: saved.room ?? '',
      category: (saved.category as Category) ?? '',
      rating: saved.rating ?? 0,
      notes: saved.notes ?? '',
      photo: saved.photo ?? null,
    };
    if (state.photo) {
      state.photoPreviewURL = createPreviewURL(state.photo);
    }
    console.info('[Form] Draft restored from IndexedDB');
  }
}

// ── Persist current state as draft ───────────────────────────
async function persistDraft(): Promise<void> {
  const draft: Partial<SubmissionDraft> = {
    building: state.building,
    floor: state.floor,
    room: state.room,
    category: state.category as Category,
    rating: state.rating,
    notes: state.notes,
    photo: state.photo ?? undefined,
    timestamp: new Date().toISOString(),
  };
  await saveDraft(draft);
}

// ── Step navigation ──────────────────────────────────────────
export function getState(): Readonly<FormState> {
  return state;
}

export async function goToStep(step: 1 | 2 | 3): Promise<void> {
  state.step = step;
  renderStep();
}

// ── Step 1: Location ─────────────────────────────────────────
export function renderStep1(container: HTMLElement): void {
  container.innerHTML = `
    <div class="step-header">
      <div class="step-badge">Bước 1/3</div>
      <h2 class="step-title">Thông tin vị trí</h2>
      <p class="step-desc">Nhập thông tin tòa nhà, tầng và phòng cần kiểm tra</p>
    </div>

    <div class="field-group">
      <label for="building" class="field-label">Tòa nhà <span class="required">*</span></label>
      <select id="building" class="field-input field-select" required>
        <option value="">-- Chọn tòa nhà --</option>
        <option value="A1" ${state.building === 'A1' ? 'selected' : ''}>A1 — Nhà học chính</option>
        <option value="A2" ${state.building === 'A2' ? 'selected' : ''}>A2 — Phòng Lab</option>
        <option value="B1" ${state.building === 'B1' ? 'selected' : ''}>B1 — Hội trường</option>
        <option value="C1" ${state.building === 'C1' ? 'selected' : ''}>C1 — Thư viện</option>
        <option value="D1" ${state.building === 'D1' ? 'selected' : ''}>D1 — Ký túc xá</option>
      </select>
    </div>

    <div class="field-row">
      <div class="field-group">
        <label for="floor" class="field-label">Tầng <span class="required">*</span></label>
        <input
          id="floor"
          type="number"
          min="1"
          max="10"
          class="field-input"
          placeholder="VD: 3"
          value="${state.floor}"
          required
        />
      </div>
      <div class="field-group">
        <label for="room" class="field-label">Phòng <span class="required">*</span></label>
        <input
          id="room"
          type="text"
          class="field-input"
          placeholder="VD: 301"
          value="${state.room}"
          required
        />
      </div>
    </div>

    <button id="step1-next" class="btn btn-primary btn-lg">
      Tiếp theo <span class="btn-arrow">→</span>
    </button>
  `;

  document.getElementById('step1-next')?.addEventListener('click', async () => {
    const building = (document.getElementById('building') as HTMLSelectElement).value;
    const floor = (document.getElementById('floor') as HTMLInputElement).value;
    const room = (document.getElementById('room') as HTMLInputElement).value;

    if (!building || !floor || !room) {
      showFieldError('Vui lòng điền đầy đủ thông tin vị trí.');
      return;
    }

    state.building = building;
    state.floor = floor;
    state.room = room;
    await persistDraft();
    state.step = 2;
    renderStep();
  });
}

// ── Step 2: Category ─────────────────────────────────────────
const CATEGORIES: { value: Category; label: string; icon: string }[] = [
  { value: 'Hardware', label: 'Thiết bị máy tính', icon: '🖥️' },
  { value: 'Projector', label: 'Máy chiếu', icon: '📽️' },
  { value: 'AC', label: 'Điều hòa nhiệt độ', icon: '❄️' },
  { value: 'Electrical', label: 'Hệ thống điện', icon: '⚡' },
  { value: 'Furniture', label: 'Nội thất & bàn ghế', icon: '🪑' },
];

export function renderStep2(container: HTMLElement): void {
  container.innerHTML = `
    <div class="step-header">
      <div class="step-badge">Bước 2/3</div>
      <h2 class="step-title">Loại thiết bị</h2>
      <p class="step-desc">Chọn hạng mục cần kiểm tra</p>
    </div>

    <div class="category-grid">
      ${CATEGORIES.map(
        (cat) => `
        <button
          class="category-card ${state.category === cat.value ? 'selected' : ''}"
          data-category="${cat.value}"
          type="button"
        >
          <span class="category-icon">${cat.icon}</span>
          <span class="category-label">${cat.label}</span>
        </button>
      `
      ).join('')}
    </div>

    <div class="step-nav">
      <button id="step2-back" class="btn btn-secondary">← Quay lại</button>
      <button id="step2-next" class="btn btn-primary">Tiếp theo →</button>
    </div>
  `;

  // Category card selection
  container.querySelectorAll('.category-card').forEach((card) => {
    card.addEventListener('click', () => {
      container.querySelectorAll('.category-card').forEach((c) => c.classList.remove('selected'));
      card.classList.add('selected');
      state.category = (card as HTMLElement).dataset.category as Category;
    });
  });

  document.getElementById('step2-back')?.addEventListener('click', () => {
    state.step = 1;
    renderStep();
  });

  document.getElementById('step2-next')?.addEventListener('click', async () => {
    if (!state.category) {
      showFieldError('Vui lòng chọn loại thiết bị.');
      return;
    }
    await persistDraft();
    state.step = 3;
    renderStep();
  });
}

// ── Step 3: Inspection details ───────────────────────────────
export function renderStep3(container: HTMLElement): void {
  container.innerHTML = `
    <div class="step-header">
      <div class="step-badge">Bước 3/3</div>
      <h2 class="step-title">Chi tiết kiểm tra</h2>
      <p class="step-desc">Đánh giá tình trạng và ghi nhận vấn đề</p>
    </div>

    <div class="field-group">
      <label class="field-label">Đánh giá tình trạng <span class="required">*</span></label>
      <div class="star-rating" id="star-rating" role="radiogroup" aria-label="Đánh giá từ 1 đến 5 sao">
        ${[1, 2, 3, 4, 5]
          .map(
            (n) => `
          <button
            type="button"
            class="star ${state.rating >= n ? 'active' : ''}"
            data-value="${n}"
            aria-label="${n} sao"
          >★</button>
        `
          )
          .join('')}
      </div>
      <div class="star-labels">
        <span>Rất tệ</span><span>Tuyệt vời</span>
      </div>
    </div>

    <div class="field-group">
      <label for="notes" class="field-label">Ghi chú khiếm khuyết</label>
      <textarea
        id="notes"
        class="field-input field-textarea"
        placeholder="Mô tả chi tiết vấn đề phát hiện (không bắt buộc)..."
        rows="4"
      >${state.notes}</textarea>
    </div>

    <div class="field-group">
      <label class="field-label">Ảnh chụp hiện trạng</label>
      <button type="button" id="capture-btn" class="btn btn-outline btn-photo">
        <span class="btn-icon">📷</span> Chụp / Chọn ảnh
      </button>
      <div id="photo-preview" class="photo-preview ${state.photoPreviewURL ? '' : 'hidden'}">
        ${state.photoPreviewURL ? `<img src="${state.photoPreviewURL}" alt="Ảnh hiện trạng" />` : ''}
        <button type="button" id="remove-photo" class="remove-photo" aria-label="Xóa ảnh">✕</button>
      </div>
    </div>

    <div class="step-nav">
      <button id="step3-back" class="btn btn-secondary">← Quay lại</button>
      <button id="submit-btn" class="btn btn-success btn-lg">
        <span class="btn-icon">✓</span> Lưu & Gửi báo cáo
      </button>
    </div>
  `;

  // Star rating interaction
  container.querySelectorAll('.star').forEach((star) => {
    star.addEventListener('click', () => {
      const val = parseInt((star as HTMLElement).dataset.value ?? '0', 10);
      state.rating = val;
      container.querySelectorAll('.star').forEach((s, idx) => {
        s.classList.toggle('active', idx < val);
      });
    });
  });

  // Photo capture
  document.getElementById('capture-btn')?.addEventListener('click', async () => {
    const blob = await capturePhoto();
    if (!blob) return;

    // Revoke old preview URL to avoid memory leak
    if (state.photoPreviewURL) revokePreviewURL(state.photoPreviewURL);

    state.photo = blob;
    state.photoPreviewURL = createPreviewURL(blob);

    const preview = document.getElementById('photo-preview')!;
    preview.innerHTML = `<img src="${state.photoPreviewURL}" alt="Ảnh hiện trạng" /><button type="button" id="remove-photo" class="remove-photo" aria-label="Xóa ảnh">✕</button>`;
    preview.classList.remove('hidden');
    attachRemovePhoto();
  });

  attachRemovePhoto();

  document.getElementById('step3-back')?.addEventListener('click', () => {
    state.step = 2;
    renderStep();
  });

  document.getElementById('submit-btn')?.addEventListener('click', async () => {
    if (!state.rating) {
      showFieldError('Vui lòng chọn đánh giá sao.');
      return;
    }
    await handleSubmit();
  });
}

function attachRemovePhoto(): void {
  document.getElementById('remove-photo')?.addEventListener('click', () => {
    if (state.photoPreviewURL) revokePreviewURL(state.photoPreviewURL);
    state.photo = null;
    state.photoPreviewURL = null;
    const preview = document.getElementById('photo-preview')!;
    preview.innerHTML = '';
    preview.classList.add('hidden');
  });
}

// ── Submit ───────────────────────────────────────────────────
async function handleSubmit(): Promise<void> {
  const btn = document.getElementById('submit-btn') as HTMLButtonElement;
  btn.disabled = true;
  btn.textContent = 'Đang lưu...';

  try {
    const submission = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      status: 'PENDING_SYNC' as const,
      building: state.building,
      floor: state.floor,
      room: state.room,
      category: state.category as Category,
      rating: state.rating,
      notes: (document.getElementById('notes') as HTMLTextAreaElement)?.value ?? state.notes,
      photo: state.photo,
    };

    await saveSubmission(submission);
    await clearDraft();
    await registerBackgroundSync();

    showSuccessScreen();
  } catch (err) {
    console.error('[Form] Submit error:', err);
    btn.disabled = false;
    btn.textContent = 'Lưu & Gửi báo cáo';
    showFieldError('Lỗi lưu dữ liệu. Vui lòng thử lại.');
  }
}

// ── Success screen ───────────────────────────────────────────
function showSuccessScreen(): void {
  const container = document.getElementById('form-container')!;
  container.innerHTML = `
    <div class="success-screen">
      <div class="success-icon">✅</div>
      <h2 class="success-title">Đã lưu thành công!</h2>
      <p class="success-desc">
        Báo cáo kiểm tra đã được lưu. Dữ liệu sẽ tự động đồng bộ khi có kết nối mạng.
      </p>
      <div class="success-meta">
        <span>📍 ${state.building} — Tầng ${state.floor} — Phòng ${state.room}</span>
        <span>🏷️ ${state.category}</span>
        <span>⭐ ${state.rating}/5</span>
      </div>
      <div class="success-actions">
        <button id="new-inspection" class="btn btn-primary">+ Kiểm tra mới</button>
        <button id="view-history" class="btn btn-secondary">📋 Xem lịch sử</button>
      </div>
    </div>
  `;

  document.getElementById('new-inspection')?.addEventListener('click', () => {
    resetState();
    renderStep();
  });

  document.getElementById('view-history')?.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('navigate', { detail: { page: 'history' } }));
  });
}

// ── Helpers ──────────────────────────────────────────────────
function resetState(): void {
  if (state.photoPreviewURL) revokePreviewURL(state.photoPreviewURL);
  state = {
    step: 1,
    building: '',
    floor: '',
    room: '',
    category: '',
    rating: 0,
    notes: '',
    photo: null,
    photoPreviewURL: null,
  };
}

function showFieldError(msg: string): void {
  let el = document.getElementById('form-error');
  if (!el) {
    el = document.createElement('div');
    el.id = 'form-error';
    el.className = 'form-error';
    document.getElementById('form-container')?.prepend(el);
  }
  el.textContent = msg;
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  setTimeout(() => el?.remove(), 4000);
}

// ── Main render dispatcher ───────────────────────────────────
export function renderStep(): void {
  const container = document.getElementById('form-container');
  if (!container) return;

  // Clear any existing error
  document.getElementById('form-error')?.remove();

  updateProgressBar(state.step);

  switch (state.step) {
    case 1: return renderStep1(container);
    case 2: return renderStep2(container);
    case 3: return renderStep3(container);
  }
}

function updateProgressBar(step: number): void {
  const bar = document.getElementById('progress-fill');
  const labels = document.querySelectorAll('.progress-step');
  if (bar) bar.style.width = `${((step - 1) / 2) * 100}%`;
  labels.forEach((label, idx) => {
    label.classList.toggle('active', idx < step);
    label.classList.toggle('current', idx === step - 1);
  });
}
