// =========================================================
// form/steps.ts — 3-step inspection form state machine
// State is persisted in IndexedDB draft store on every step
// and handles offline draft recovery, GPS tagging & photo capture.
// =========================================================

import {
  Category,
  Priority,
  LocationCoords,
  SubmissionDraft,
  saveDraft,
  loadDraft,
  clearDraft,
  saveSubmission,
  getSubmission,
  getAllSubmissions,
} from '../db';
import { capturePhoto, createPreviewURL, revokePreviewURL } from './camera';
import { registerBackgroundSync, flushPendingSubmissions } from '../sync';
import { getCampusLocation } from '../utils/geo';
import { showToast } from '../utils/toast';

// ── Campus Management Zones at VKU ───────────────────────────
export interface CampusZone {
  id: string;
  name: string;
  shortName: string;
  icon: string;
  desc: string;
  defaultType: string;
  types: string[];
  suggestedRooms: string[];
}

export const CAMPUS_ZONES: CampusZone[] = [
  {
    id: 'Khu V',
    name: 'Khu V — Khối Giảng đường Lý thuyết Trung tâm',
    shortName: 'Giảng đường V',
    icon: '🏫',
    desc: 'Hệ thống giảng đường V.A101 – V.A506, Giảng đường bậc thang, Hội trường lớn V',
    defaultType: 'Phòng học lý thuyết',
    types: ['Phòng học lý thuyết', 'Giảng đường bậc thang', 'Hội trường V', 'Phòng trực giảng viên'],
    suggestedRooms: ['V.A101', 'V.A201', 'V.A212', 'V.A301', 'V.A405', 'V.A501', 'V.A502', 'Hội trường V'],
  },
  {
    id: 'Khu B',
    name: 'Khu B — Trung tâm Thực hành CNTT & Vi mạch Bán dẫn',
    shortName: 'Lab CNTT & Bán dẫn',
    icon: '💻',
    desc: 'Phòng thực hành máy tính PC, Lab AI & Data, Lab Vi mạch Bán dẫn, Lab IoT, Server Room',
    defaultType: 'Phòng Lab máy tính',
    types: ['Phòng Lab máy tính', 'Lab AI & Data Science', 'Lab Thiết kế Vi mạch & Bán dẫn', 'Lab Mạng & An ninh thông tin', 'Phòng Server trung tâm'],
    suggestedRooms: ['B.A101', 'B.A201', 'B.A202 (Lab AI)', 'B.A301 (Vi mạch)', 'B.A305 (IoT)', 'B.Server Room'],
  },
  {
    id: 'Khu A',
    name: 'Khu A — Tòa nhà Hiệu bộ & Văn phòng Ban Giám hiệu',
    shortName: 'Tòa nhà Hiệu bộ',
    icon: '🏛️',
    desc: 'Ban Giám hiệu, Phòng Đào tạo & Khảo thí, Bộ phận Một cửa, Phòng CTSV, Văn phòng Khoa',
    defaultType: 'Văn phòng hành chính',
    types: ['Bộ phận Một cửa sinh viên', 'Văn phòng Ban Giám hiệu', 'Phòng Đào tạo', 'Phòng Công tác sinh viên', 'Phòng Họp & Hội đồng'],
    suggestedRooms: ['A.101 (Một Cửa)', 'A.102 (CTSV)', 'A.201 (Đào Tạo)', 'A.301 (BGH)', 'A.Họp Hội Đồng'],
  },
  {
    id: 'Khu C',
    name: 'Khu C — Thư viện Số & Không gian Sáng chế MakerSpace',
    shortName: 'Thư viện & MakerSpace',
    icon: '📚',
    desc: 'Thư viện tài nguyên số, Phòng đọc cá nhân, Phòng học nhóm, Không gian sáng chế MakerSpace',
    defaultType: 'Thư viện & Tự học',
    types: ['Thư viện số & Tra cứu', 'Phòng đọc mở & Tự học', 'Phòng thuyết trình & Học nhóm', 'Không gian sáng chế MakerSpace'],
    suggestedRooms: ['C.A101 (Thư viện số)', 'C.A201 (MakerSpace)', 'C.A301 (Phòng đọc)', 'C.A401 (Hội thảo)'],
  },
  {
    id: 'Khu K',
    name: 'Khu K — Trung tâm Hội nghị & Hội trường Trịnh Công Sơn',
    shortName: 'Hội trường Trịnh Công Sơn',
    icon: '🎭',
    desc: 'Hệ thống giảng đường K.A101 – K.A408, Hội trường Trịnh Công Sơn 1.000 chỗ, Văn phòng Đoàn - Hội',
    defaultType: 'Hội trường sự kiện',
    types: ['Phòng học K.A', 'Hội trường Trịnh Công Sơn', 'Phòng Hội thảo Quốc tế', 'Văn phòng Đoàn TN - Hội SV', 'Phòng sinh hoạt CLB'],
    suggestedRooms: ['K.A101', 'K.A112', 'K.A201', 'K.A207', 'K.A301', 'K.A311', 'K.A401', 'Hội trường TCS'],
  },
  {
    id: 'Khu KTX',
    name: 'Khu KTX — Ký túc xá Sinh viên Quốc tế & Dịch vụ Đời sống',
    shortName: 'Ký túc xá & Đời sống',
    icon: '🛏️',
    desc: 'Ký túc xá Khối nhà A & B, Căn tin trường, Trạm Y tế, Phòng tự học KTX, Khu giặt ủi',
    defaultType: 'Ký túc xá sinh viên',
    types: ['Phòng ở KTX Khối A', 'Phòng ở KTX Khối B', 'Căn tin sinh viên', 'Trạm Y tế trường', 'Phòng tự học KTX'],
    suggestedRooms: ['KTX.A101', 'KTX.A201', 'KTX.A301', 'KTX.B201', 'Căn tin VKU', 'Trạm Y Tế'],
  },
  {
    id: 'Khu TheThao',
    name: 'Khu Thể thao — Nhà thi đấu Đa năng & Sân bãi Thể chất',
    shortName: 'Thể thao & Nhà thi đấu',
    icon: '⚽',
    desc: 'Nhà thi đấu đa năng (Futsal, Cầu lông, Bóng bàn), Sân bóng cỏ nhân tạo, Sân bóng rổ ngoài trời',
    defaultType: 'Sân bãi thể thao',
    types: ['Nhà thi đấu đa năng', 'Sân bóng cỏ nhân tạo', 'Cụm sân bóng rổ / Chuyền', 'Phòng tập Gym sinh viên'],
    suggestedRooms: ['Nhà thi đấu S1', 'Sân bóng đá mini 1', 'Sân bóng rổ ngoài trời', 'Phòng Gym SV'],
  },
  {
    id: 'Khu NghienCuu',
    name: 'Khu Nghiên cứu KH&CN & Vườn ươm Doanh nghiệp',
    shortName: 'Viện NC & Vườn ươm',
    icon: '🔬',
    desc: 'Viện Khoa học Công nghệ VKU, Phòng R&D hợp tác quốc tế, Vườn ươm Khởi nghiệp VKU-Korea',
    defaultType: 'Viện nghiên cứu & R&D',
    types: ['Phòng Lab Nghiên cứu R&D', 'Không gian Khởi nghiệp Start-up', 'Văn phòng Viện KH&CN'],
    suggestedRooms: ['R&D.A101', 'Lab Korea R&D', 'Vườn ươm Startup', 'Văn phòng Viện'],
  },
  {
    id: 'Khu HaTang',
    name: 'Hạ tầng Kỹ thuật, Trạm Biến áp & An toàn PCCC',
    shortName: 'Hạ tầng & PCCC',
    icon: '⚡',
    desc: 'Trạm biến áp trung thế, Máy phát điện dự phòng, Hệ thống cấp nước & Bể ngầm PCCC, Trạm sạc xe điện',
    defaultType: 'Hạ tầng kỹ thuật',
    types: ['Trạm biến áp & Máy phát điện', 'Hệ thống bơm & Bể ngầm PCCC', 'Trạm sạc xe máy điện', 'Kho thiết bị kỹ thuật'],
    suggestedRooms: ['Trạm Biến Áp TBA1', 'Trạm Bơm PCCC', 'Trạm Sạc Xe Điện Cổng Phụ'],
  },
  {
    id: 'Khu CanhQuan',
    name: 'Khu khuôn viên Cảnh quan, Nhà giữ xe & An ninh Toàn trường',
    shortName: 'Nhà xe & An ninh',
    icon: '🌿',
    desc: 'Nhà giữ xe sinh viên & cán bộ GV, Cổng chính Trần Đại Nghĩa, Cổng phụ Nam Kỳ Khởi Nghĩa, Bốt bảo vệ',
    defaultType: 'Nhà xe & An ninh',
    types: ['Nhà giữ xe sinh viên', 'Nhà giữ xe cán bộ - GV', 'Cổng chính & Bốt bảo vệ', 'Sân trường & Quảng trường'],
    suggestedRooms: ['Nhà xe Sinh viên B', 'Nhà xe Cán bộ A', 'Cổng chính Trần Đại Nghĩa', 'Bốt Bảo vệ Cổng 2'],
  },
];

/**
 * Smart room suggestion generator based on VKU standard formats:
 * - Khu V: V.A[floor][room], e.g. V.A502, V.A405, V.A212
 * - Khu K: K.A[floor][room], e.g. K.A207, K.A311, K.A112
 * - Khu B: B.A[floor]xx, Lab B.Axxx
 * - Khu A: A.[floor]xx
 */
export function getZoneSuggestedRooms(zoneId: string, floor?: string): string[] {
  const zone = CAMPUS_ZONES.find((z) => z.id === zoneId);
  if (!zone) return [];

  if (zoneId === 'Khu V') {
    if (floor === '1') return ['V.A101', 'V.A102', 'V.A108', 'Hội trường V'];
    if (floor === '2') return ['V.A201', 'V.A212', 'V.A202', 'V.A205'];
    if (floor === '3') return ['V.A301', 'V.A302', 'V.A305', 'V.A308'];
    if (floor === '4') return ['V.A401', 'V.A405', 'V.A402', 'V.A408'];
    if (floor === '5') return ['V.A501', 'V.A502', 'V.A505', 'V.A506'];
    return zone.suggestedRooms;
  }

  if (zoneId === 'Khu K') {
    if (floor === '1') return ['K.A101', 'K.A112', 'Hội trường TCS'];
    if (floor === '2') return ['K.A201', 'K.A207', 'K.A202'];
    if (floor === '3') return ['K.A301', 'K.A311', 'K.A302'];
    if (floor === '4') return ['K.A401', 'K.A408', 'K.A402'];
    return zone.suggestedRooms;
  }

  if (zoneId === 'Khu B') {
    if (floor && floor !== 'Trệt') {
      return [`B.A${floor}01`, `Lab B.A${floor}02`, `Lab B.A${floor}03`];
    }
    return zone.suggestedRooms;
  }

  if (zoneId === 'Khu A') {
    if (floor === '1') return ['A.101 (Một Cửa)', 'A.102 (CTSV)'];
    if (floor === '2') return ['A.201 (Đào Tạo)', 'A.202 (Khảo Thí)'];
    if (floor === '3') return ['A.301 (BGH)', 'A.302 (Tổ Chức)'];
    return zone.suggestedRooms;
  }

  return zone.suggestedRooms;
}

// ── Form State ───────────────────────────────────────────────
interface FormState {
  step: 1 | 2 | 3;
  editingId: string | null; // null if new, UUID if editing pending survey
  zone: string;
  building: string;
  floor: string;
  room: string;
  roomType: string;
  category: Category | '';
  rating: number;
  priority: Priority;
  tags: string[];
  inspector: string;
  location: LocationCoords | null;
  notes: string;
  photo: Blob | null;
  photoPreviewURL: string | null;
}

let state: FormState = {
  step: 1,
  editingId: null,
  zone: 'Khu V',
  building: 'Khu V',
  floor: '',
  room: '',
  roomType: 'Phòng học lý thuyết',
  category: '',
  rating: 0,
  priority: 'normal',
  tags: [],
  inspector: localStorage.getItem('vku_inspector') || '',
  location: null,
  notes: '',
  photo: null,
  photoPreviewURL: null,
};

// ── Restore draft on boot ────────────────────────────────────
export async function initFormState(): Promise<void> {
  const saved = await loadDraft();
  if (saved) {
    state = {
      ...state,
      zone: (saved as any).zone ?? saved.building ?? 'Khu V',
      building: saved.building ?? 'Khu V',
      floor: saved.floor ?? '',
      room: saved.room ?? '',
      roomType: (saved as any).roomType ?? 'Phòng học lý thuyết',
      category: (saved.category as Category) ?? '',
      rating: saved.rating ?? 0,
      priority: (saved.priority as Priority) ?? 'normal',
      tags: saved.tags ?? [],
      inspector: saved.inspector ?? (localStorage.getItem('vku_inspector') || ''),
      location: saved.location ?? null,
      notes: saved.notes ?? '',
      photo: saved.photo ?? null,
    };
    if (state.photo) {
      state.photoPreviewURL = createPreviewURL(state.photo);
    }
    console.info('[Form] Draft restored from IndexedDB');
  }

  // Pre-fetch campus GPS coordinates quietly in the background
  getCampusLocation().then((coords) => {
    if (coords && !state.location) {
      state.location = coords;
      console.info('[GPS] Location stamped:', coords);
    }
  });
}

// ── Persist current state as draft ───────────────────────────
async function persistDraft(): Promise<void> {
  const draft: Partial<SubmissionDraft> & { zone?: string; roomType?: string } = {
    zone: state.zone,
    building: state.building || state.zone,
    floor: state.floor,
    room: state.room,
    roomType: state.roomType,
    category: state.category as Category,
    rating: state.rating,
    priority: state.priority,
    tags: state.tags,
    inspector: state.inspector,
    location: state.location,
    notes: state.notes,
    photo: state.photo ?? undefined,
    timestamp: new Date().toISOString(),
  };
  await saveDraft(draft as any);
}

export function getState(): Readonly<FormState> {
  return state;
}

export async function goToStep(step: 1 | 2 | 3): Promise<void> {
  state.step = step;
  renderStep();
}

// ── Load pending submission for editing ──────────────────────
export async function loadSubmissionForEdit(id: string): Promise<void> {
  const sub = await getSubmission(id);
  if (!sub) {
    showToast('Không tìm thấy bản ghi khảo sát cần sửa.', 'error');
    return;
  }

  if (state.photoPreviewURL) revokePreviewURL(state.photoPreviewURL);

  state = {
    step: 1,
    editingId: sub.id,
    zone: sub.zone || sub.building || 'Khu V',
    building: sub.building,
    floor: sub.floor,
    room: sub.room,
    roomType: sub.roomType || 'Phòng học lý thuyết',
    category: sub.category,
    rating: sub.rating,
    priority: sub.priority || 'normal',
    tags: sub.tags || [],
    inspector: sub.inspector || (localStorage.getItem('vku_inspector') || ''),
    location: sub.location || null,
    notes: sub.notes || '',
    photo: sub.photo,
    photoPreviewURL: sub.photo ? createPreviewURL(sub.photo) : null,
  };

  await persistDraft();
  window.dispatchEvent(new CustomEvent('navigate', { detail: { page: 'form' } }));
  showToast(`Đang chỉnh sửa: Phòng ${sub.room} (${sub.building})`, 'info');
}

// ── Reset / Clear Form ───────────────────────────────────────
async function handleClearForm(): Promise<void> {
  const isEditing = Boolean(state.editingId);
  const msg = isEditing
    ? 'Bạn có muốn hủy chỉnh sửa báo cáo này và làm mới form?'
    : 'Bạn có chắc muốn xóa toàn bộ nội dung đang nhập và làm mới form?';

  const hasData =
    isEditing ||
    Boolean(state.floor) ||
    Boolean(state.room) ||
    Boolean(state.category) ||
    Boolean(state.notes) ||
    Boolean(state.photo) ||
    state.rating > 0 ||
    state.tags.length > 0;

  if (hasData) {
    if (!confirm(msg)) {
      return;
    }
  }

  await clearDraft();
  if (state.photoPreviewURL) revokePreviewURL(state.photoPreviewURL);
  state = {
    step: 1,
    editingId: null,
    zone: 'Khu V',
    building: 'Khu V',
    floor: '',
    room: '',
    roomType: 'Phòng học lý thuyết',
    category: '',
    rating: 0,
    priority: 'normal',
    tags: [],
    inspector: state.inspector,
    location: state.location,
    notes: '',
    photo: null,
    photoPreviewURL: null,
  };
  renderStep();
  showToast('Đã làm mới form khảo sát.', 'info');
}

// ── Step 1: Location & Inspector ─────────────────────────────
export function renderStep1(container: HTMLElement): void {
  const gpsText = state.location
    ? `📍 Tọa độ GPS: ${state.location.latitude.toFixed(4)}°N, ${state.location.longitude.toFixed(4)}°E (±${state.location.accuracy || 10}m)`
    : '📍 Chưa có tọa độ GPS (Đang nạp...)';

  const currentZone = CAMPUS_ZONES.find((z) => z.id === state.zone) || CAMPUS_ZONES[0];

  container.innerHTML = `
    <div class="step-header">
      <div class="step-header-top">
        <div class="step-badge">Bước 1/3</div>
        <button type="button" id="clear-form-btn" class="btn-clear-form" title="Xóa toàn bộ nội dung và làm mới">🗑️ Xóa form</button>
      </div>
      <h2 class="step-title">Khu vực quản lý & Địa điểm</h2>
      <p class="step-desc">Chọn khối cơ sở vật chất, tòa nhà và phòng cần khảo sát tại khuôn viên VKU</p>
    </div>

    <!-- Inspector Input -->
    <div class="field-group">
      <label for="inspector" class="field-label">Kiểm tra viên (Họ tên / MSSV)</label>
      <input
        id="inspector"
        type="text"
        class="field-input"
        placeholder="VD: Nguyễn Văn A - 21IT001"
        value="${state.inspector}"
      />
    </div>

    <!-- Visual Campus Zone Cards Grid -->
    <div class="field-group">
      <label class="field-label">Khu vực quản lý VKU (Chạm hoặc bấm chọn) <span class="required">*</span></label>
      <div class="zone-tiles-grid" id="zone-tiles-grid">
        ${CAMPUS_ZONES.map(
          (z) => `
          <button
            type="button"
            class="zone-tile-btn ${state.zone === z.id ? 'active' : ''}"
            data-zone-id="${z.id}"
          >
            <span class="zone-tile-icon">${z.icon}</span>
            <div class="zone-tile-meta">
              <span class="zone-tile-name">${z.shortName}</span>
              <span class="zone-tile-id">${z.id}</span>
            </div>
          </button>
        `
        ).join('')}
      </div>

      <!-- Native select fallback for accessibility & auto-sync -->
      <select id="zone-select" class="field-input field-select zone-dropdown-hidden">
        ${CAMPUS_ZONES.map(
          (z) => `
          <option value="${z.id}" ${state.zone === z.id ? 'selected' : ''}>
            ${z.icon} ${z.name}
          </option>
        `
        ).join('')}
      </select>
      <div class="zone-description-note" id="zone-desc">
        <span class="zone-desc-icon">ℹ️</span>
        <span class="zone-desc-content"><strong>Chi tiết khu vực:</strong> ${currentZone.desc}</span>
      </div>
    </div>

    <!-- Space Type & Floor Selection -->
    <div class="field-row">
      <div class="field-group">
        <label for="room-type-select" class="field-label">Loại không gian</label>
        <select id="room-type-select" class="field-input field-select">
          ${currentZone.types.map(
            (t) => `
            <option value="${t}" ${state.roomType === t ? 'selected' : ''}>${t}</option>
          `
          ).join('')}
        </select>
      </div>
      <div class="field-group">
        <label for="floor" class="field-label">Tầng / Vị trí <span class="required">*</span></label>
        <input
          id="floor"
          type="text"
          class="field-input"
          placeholder="VD: 3 hoặc Tầng trệt..."
          value="${state.floor}"
          required
        />
        <!-- Floor Quick Chips -->
        <div class="quick-chips-row" id="floor-quick-chips">
          ${['Trệt', '1', '2', '3', '4', '5'].map(
            (f) => `
            <button type="button" class="quick-chip-btn ${state.floor === f ? 'active' : ''}" data-floor="${f}">
              T.${f}
            </button>
          `
          ).join('')}
        </div>
      </div>
    </div>

    <!-- Room Input & Dynamic Suggested Rooms -->
    <div class="field-group">
      <label for="room" class="field-label">Tên phòng / Số phòng cụ thể <span class="required">*</span></label>
      <input
        id="room"
        type="text"
        class="field-input"
        placeholder="VD: V.A502, K.A207, V.A212, Lab B.A201, A.101..."
        value="${state.room}"
        required
      />
      <!-- Dynamic Room Suggestions based on selected zone & floor -->
      <div class="room-suggestions-wrap">
        <span class="room-suggestions-label" id="room-suggestions-label">Gợi ý nhanh phòng (${currentZone.shortName}${state.floor ? ` - Tầng ${state.floor}` : ''}):</span>
        <div class="quick-chips-row" id="room-quick-chips">
          ${getZoneSuggestedRooms(currentZone.id, state.floor).map(
            (r) => `
            <button type="button" class="quick-chip-btn ${state.room === r ? 'active' : ''}" data-room="${r}">
              ${r}
            </button>
          `
          ).join('')}
        </div>
      </div>
    </div>

    <div class="gps-strip" id="gps-strip">
      <span class="gps-text" id="gps-text">${gpsText}</span>
      <button type="button" id="refresh-gps-btn" class="btn btn-xs btn-outline">Cập nhật GPS</button>
    </div>

    <button id="step1-next" class="btn btn-primary btn-lg">
      Tiếp theo: Chọn thiết bị <span class="btn-arrow">→</span>
    </button>
  `;

  // Auto-save helpers
  const autoSaveInputs = () => {
    const zoneVal = (document.getElementById('zone-select') as HTMLSelectElement)?.value || state.zone;
    state.zone = zoneVal;
    state.building = zoneVal;
    state.floor = (document.getElementById('floor') as HTMLInputElement)?.value || '';
    state.room = (document.getElementById('room') as HTMLInputElement)?.value || '';
    state.roomType = (document.getElementById('room-type-select') as HTMLSelectElement)?.value || state.roomType;
    const insp = (document.getElementById('inspector') as HTMLInputElement)?.value || '';
    state.inspector = insp;
    if (insp) localStorage.setItem('vku_inspector', insp);
    persistDraft();
    updateCompanionSidebar();
  };

  document.getElementById('clear-form-btn')?.addEventListener('click', handleClearForm);

  // Switch Zone Logic
  const handleZoneChange = (selectedZoneId: string) => {
    state.zone = selectedZoneId;
    state.building = selectedZoneId;

    // Highlight active tile
    container.querySelectorAll('.zone-tile-btn').forEach((btn) => {
      btn.classList.toggle('active', (btn as HTMLElement).dataset.zoneId === selectedZoneId);
    });

    const zoneSelect = document.getElementById('zone-select') as HTMLSelectElement;
    if (zoneSelect) zoneSelect.value = selectedZoneId;

    const zoneObj = CAMPUS_ZONES.find((z) => z.id === selectedZoneId);
    if (zoneObj) {
      const descEl = document.getElementById('zone-desc');
      if (descEl) {
        descEl.innerHTML = `
          <span class="zone-desc-icon">ℹ️</span>
          <span class="zone-desc-content"><strong>Chi tiết khu vực:</strong> ${zoneObj.desc}</span>
        `;
      }

      const roomTypeSelect = document.getElementById('room-type-select') as HTMLSelectElement;
      if (roomTypeSelect) {
        roomTypeSelect.innerHTML = zoneObj.types
          .map((t) => `<option value="${t}">${t}</option>`)
          .join('');
        state.roomType = zoneObj.types[0] || '';
      }

      // Refresh Room Suggestions
      updateRoomSuggestions();
    }

    persistDraft();
    updateCompanionSidebar();
  };

  // Wire Zone Tiles
  container.querySelectorAll('.zone-tile-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const zid = (btn as HTMLElement).dataset.zoneId;
      if (zid) handleZoneChange(zid);
    });
  });

  // Wire Floor Chips
  container.querySelectorAll('#floor-quick-chips .quick-chip-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const f = (btn as HTMLElement).dataset.floor || '';
      state.floor = f;
      const floorInput = document.getElementById('floor') as HTMLInputElement;
      if (floorInput) floorInput.value = f;
      container.querySelectorAll('#floor-quick-chips .quick-chip-btn').forEach((b) => {
        b.classList.toggle('active', (b as HTMLElement).dataset.floor === f);
      });
      // Dynamically update room suggestions based on selected floor
      updateRoomSuggestions();
      persistDraft();
      updateCompanionSidebar();
    });
  });

  // Wire Room Chips
  let bindRoomChips = () => {
    container.querySelectorAll('#room-quick-chips .quick-chip-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const r = (btn as HTMLElement).dataset.room || '';
        state.room = r;
        const roomInput = document.getElementById('room') as HTMLInputElement;
        if (roomInput) roomInput.value = r;
        container.querySelectorAll('#room-quick-chips .quick-chip-btn').forEach((b) => {
          b.classList.toggle('active', (b as HTMLElement).dataset.room === r);
        });
        persistDraft();
        updateCompanionSidebar();
      });
    });
  };

  const updateRoomSuggestions = () => {
    const roomChipsWrap = document.getElementById('room-quick-chips');
    const labelEl = document.getElementById('room-suggestions-label');
    const zoneObj = CAMPUS_ZONES.find((z) => z.id === state.zone);
    if (!zoneObj || !roomChipsWrap) return;

    if (labelEl) {
      labelEl.textContent = `Gợi ý nhanh phòng (${zoneObj.shortName}${state.floor ? ` - Tầng ${state.floor}` : ''}):`;
    }

    const rooms = getZoneSuggestedRooms(state.zone, state.floor);
    roomChipsWrap.innerHTML = rooms
      .map(
        (r) => `
        <button type="button" class="quick-chip-btn ${state.room === r ? 'active' : ''}" data-room="${r}">
          ${r}
        </button>
      `
      )
      .join('');
    bindRoomChips();
  };
  bindRoomChips();

  document.getElementById('zone-select')?.addEventListener('change', (e) => {
    handleZoneChange((e.target as HTMLSelectElement).value);
  });

  document.getElementById('room-type-select')?.addEventListener('change', autoSaveInputs);
  document.getElementById('floor')?.addEventListener('input', autoSaveInputs);
  document.getElementById('room')?.addEventListener('input', autoSaveInputs);
  document.getElementById('inspector')?.addEventListener('input', autoSaveInputs);

  // GPS refresh
  document.getElementById('refresh-gps-btn')?.addEventListener('click', async () => {
    const txt = document.getElementById('gps-text');
    if (txt) txt.textContent = '⏳ Đang lấy tín hiệu vệ tinh...';
    const coords = await getCampusLocation();
    if (coords) {
      state.location = coords;
      await persistDraft();
      if (txt) {
        txt.textContent = `📍 Đã định vị: ${coords.latitude.toFixed(4)}°N, ${coords.longitude.toFixed(4)}°E (±${coords.accuracy || 10}m)`;
      }
      updateCompanionSidebar();
      showToast('Đã cập nhật tọa độ GPS kiểm tra viên', 'success');
    } else {
      if (txt) txt.textContent = '⚠️ Không lấy được GPS (Kiểm tra quyền vị trí)';
    }
  });

  document.getElementById('step1-next')?.addEventListener('click', async () => {
    const zone = state.zone || (document.getElementById('zone-select') as HTMLSelectElement).value;
    const floor = (document.getElementById('floor') as HTMLInputElement).value.trim();
    const room = (document.getElementById('room') as HTMLInputElement).value.trim();
    const roomType = (document.getElementById('room-type-select') as HTMLSelectElement).value;
    const inspector = (document.getElementById('inspector') as HTMLInputElement).value.trim();

    if (!zone || !floor || !room) {
      showFieldError('Vui lòng chọn khu vực, tầng và tên phòng cụ thể.');
      return;
    }

    state.zone = zone;
    state.building = zone;
    state.floor = floor;
    state.room = room;
    state.roomType = roomType;
    state.inspector = inspector;
    if (inspector) localStorage.setItem('vku_inspector', inspector);

    await persistDraft();
    state.step = 2;
    renderStep();
  });
}

// ── Step 2: Category & Defect Tags ───────────────────────────
const CATEGORIES: { value: Category; label: string; icon: string; desc: string }[] = [
  { value: 'Hardware', label: 'Thiết bị máy tính & Lab', icon: '🖥️', desc: 'PC sinh viên, Server, Mạng LAN' },
  { value: 'Projector', label: 'Máy chiếu & Màn hình', icon: '📽️', desc: 'Máy chiếu, Màn chiếu, Cáp HDMI' },
  { value: 'AC', label: 'Điều hòa & Thông gió', icon: '❄️', desc: 'Máy lạnh, Dàn nóng/lạnh, Điều khiển' },
  { value: 'Electrical', label: 'Hệ thống điện & Ánh sáng', icon: '⚡', desc: 'Bóng đèn, Ổ cắm, Cầu dao, Quạt' },
  { value: 'Furniture', label: 'Nội thất & Bàn ghế', icon: '🪑', desc: 'Bàn ghế SV, Bục giảng, Bảng viết' },
];

const CATEGORY_TAGS: Record<Category, string[]> = {
  Hardware: ['Mất mạng LAN', 'Liệt bàn phím/chuột', 'Màn hình sọc/hỏng', 'Không lên nguồn', 'Thiếu cáp kết nối'],
  Projector: ['Bóng mờ / ố vàng', 'Không nhận cáp HDMI', 'Hỏng remote', 'Màn chiếu kẹt rách', 'Quạt máy chiếu ồn'],
  AC: ['Không mát / kém lạnh', 'Chảy nước dàn lạnh', 'Hỏng điều khiển', 'Kêu to / rung lắc', 'Mùi ẩm mốc'],
  Electrical: ['Đèn chớp nháy / cháy', 'Ổ cắm lỏng / chập điện', 'Mất điện nhánh', 'Công tắc hỏng', 'Quạt trần rung'],
  Furniture: ['Bàn ghế lung lay / gãy', 'Mặt bàn bong tróc', 'Bảng viết mờ / khó xóa', 'Cửa phòng / khóa kẹt', 'Rèm cửa rách'],
};

export function renderStep2(container: HTMLElement): void {
  const currentTags = state.category ? (CATEGORY_TAGS[state.category as Category] || []) : [];

  container.innerHTML = `
    <div class="step-header">
      <div class="step-header-top">
        <div class="step-badge">Bước 2/3</div>
        <button type="button" id="clear-form-btn" class="btn-clear-form" title="Xóa toàn bộ nội dung và làm mới">🗑️ Xóa form</button>
      </div>
      <h2 class="step-title">Hạng mục & Vấn đề thường gặp</h2>
      <p class="step-desc">Chọn loại thiết bị và tích nhanh các khiếm khuyết ghi nhận</p>
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
          <span class="category-desc">${cat.desc}</span>
        </button>
      `
      ).join('')}
    </div>

    <div id="quick-tags-container" class="quick-tags-container ${state.category ? '' : 'hidden'}">
      <label class="field-label">Gợi ý lỗi nhanh (Chạm để chọn):</label>
      <div class="tags-pill-list" id="tags-pill-list">
        ${currentTags
          .map(
            (tag) => `
          <button
            type="button"
            class="tag-pill ${state.tags.includes(tag) ? 'active' : ''}"
            data-tag="${tag}"
          >+ ${tag}</button>
        `
          )
          .join('')}
      </div>
    </div>

    <div class="step-nav">
      <button id="step2-back" class="btn btn-secondary">← Quay lại Vị trí</button>
      <button id="step2-next" class="btn btn-primary">Tiếp theo: Đánh giá →</button>
    </div>
  `;

  document.getElementById('clear-form-btn')?.addEventListener('click', handleClearForm);

  // Category card click
  container.querySelectorAll('.category-card').forEach((card) => {
    card.addEventListener('click', async () => {
      container.querySelectorAll('.category-card').forEach((c) => c.classList.remove('selected'));
      card.classList.add('selected');
      const selectedCat = (card as HTMLElement).dataset.category as Category;
      state.category = selectedCat;
      state.tags = []; // Reset tags for new category
      await persistDraft();
      updateCompanionSidebar();

      // Update tags view
      renderCategoryTags(container, selectedCat);
    });
  });

  bindTagEvents(container);

  document.getElementById('step2-back')?.addEventListener('click', () => {
    state.step = 1;
    renderStep();
  });

  document.getElementById('step2-next')?.addEventListener('click', async () => {
    if (!state.category) {
      showFieldError('Vui lòng chọn loại thiết bị cần kiểm tra.');
      return;
    }
    await persistDraft();
    state.step = 3;
    renderStep();
  });
}

function renderCategoryTags(container: HTMLElement, cat: Category): void {
  const tagsWrap = container.querySelector('#quick-tags-container') as HTMLElement;
  const list = container.querySelector('#tags-pill-list') as HTMLElement;
  if (!tagsWrap || !list) return;

  const tags = CATEGORY_TAGS[cat] || [];
  tagsWrap.classList.remove('hidden');
  list.innerHTML = tags
    .map(
      (tag) => `
      <button
        type="button"
        class="tag-pill ${state.tags.includes(tag) ? 'active' : ''}"
        data-tag="${tag}"
      >+ ${tag}</button>
    `
    )
    .join('');

  bindTagEvents(container);
}

function bindTagEvents(container: HTMLElement): void {
  container.querySelectorAll('.tag-pill').forEach((pill) => {
    pill.addEventListener('click', async () => {
      const tag = (pill as HTMLElement).dataset.tag!;
      if (state.tags.includes(tag)) {
        state.tags = state.tags.filter((t) => t !== tag);
        pill.classList.remove('active');
      } else {
        state.tags.push(tag);
        pill.classList.add('active');
      }
      await persistDraft();
      updateCompanionSidebar();
    });
  });
}

// ── Step 3: Condition, Priority, Photo & Notes ────────────────
const RATING_DESCRIPTIONS = [
  '',
  '1 sao — Hư hỏng nặng / Ngưng hoạt động',
  '2 sao — Xuống cấp / Kém hiệu quả',
  '3 sao — Hoạt động tạm ổn',
  '4 sao — Tốt / Đạt tiêu chuẩn',
  '5 sao — Rất tốt / Như mới',
];

export function renderStep3(container: HTMLElement): void {
  container.innerHTML = `
    <div class="step-header">
      <div class="step-header-top">
        <div class="step-badge">Bước 3/3</div>
        <button type="button" id="clear-form-btn" class="btn-clear-form" title="Xóa toàn bộ nội dung và làm mới">🗑️ Xóa form</button>
      </div>
      <h2 class="step-title">Chi tiết đánh giá & Hiện trạng</h2>
      <p class="step-desc">Đánh giá sao, mức độ ưu tiên và chụp ảnh bằng chứng</p>
    </div>

    <!-- Rating Section -->
    <div class="field-group">
      <label class="field-label">Đánh giá tình trạng thiết bị <span class="required">*</span></label>
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
      <div class="rating-text-feedback" id="rating-text-feedback">
        ${state.rating > 0 ? RATING_DESCRIPTIONS[state.rating] : 'Chạm để chọn mức độ (1–5 sao)'}
      </div>
    </div>

    <!-- Priority Section -->
    <div class="field-group">
      <label class="field-label">Mức độ ưu tiên khắc phục</label>
      <div class="priority-group">
        <label class="priority-option ${state.priority === 'normal' ? 'selected' : ''}">
          <input type="radio" name="priority" value="normal" ${state.priority === 'normal' ? 'checked' : ''} />
          <span>🟢 Bình thường</span>
        </label>
        <label class="priority-option ${state.priority === 'high' ? 'selected' : ''}">
          <input type="radio" name="priority" value="high" ${state.priority === 'high' ? 'checked' : ''} />
          <span>🟡 Cần xử lý sớm</span>
        </label>
        <label class="priority-option ${state.priority === 'urgent' ? 'selected' : ''}">
          <input type="radio" name="priority" value="urgent" ${state.priority === 'urgent' ? 'checked' : ''} />
          <span>🔴 Khẩn cấp</span>
        </label>
      </div>
    </div>

    <!-- Photo Capture -->
    <div class="field-group">
      <label class="field-label">Ảnh chụp hiện trường thiết bị</label>
      <div class="photo-action-bar">
        <button type="button" id="capture-btn" class="btn btn-outline btn-photo">
          <span class="btn-icon">📷</span> Chụp / Chọn ảnh
        </button>
        <span class="photo-hint">Tự động nén tối ưu (nhỏ gọn & sắc nét)</span>
      </div>
      <div id="photo-preview" class="photo-preview ${state.photoPreviewURL ? '' : 'hidden'}">
        ${state.photoPreviewURL ? `<img src="${state.photoPreviewURL}" alt="Ảnh hiện trạng" />` : ''}
        <button type="button" id="remove-photo" class="remove-photo" aria-label="Xóa ảnh">✕</button>
      </div>
    </div>

    <!-- Notes & Defect description -->
    <div class="field-group">
      <label for="notes" class="field-label">Ghi chú chi tiết khiếm khuyết</label>
      <textarea
        id="notes"
        class="field-input field-textarea"
        placeholder="Mô tả hiện tượng hư hỏng, vị trí cụ thể trong phòng..."
        rows="3"
      >${state.notes}</textarea>
    </div>

    <div class="step-nav">
      <button id="step3-back" class="btn btn-secondary">← Quay lại Thiết bị</button>
      <button id="submit-btn" class="btn btn-success btn-lg">
        <span class="btn-icon">✓</span> ${state.editingId ? 'Cập nhật báo cáo' : 'Lưu & Gửi báo cáo'}
      </button>
    </div>
  `;

  document.getElementById('clear-form-btn')?.addEventListener('click', handleClearForm);

  // Star rating events
  container.querySelectorAll('.star').forEach((star) => {
    star.addEventListener('click', async () => {
      const val = parseInt((star as HTMLElement).dataset.value ?? '0', 10);
      state.rating = val;
      container.querySelectorAll('.star').forEach((s, idx) => {
        s.classList.toggle('active', idx < val);
      });
      const feedback = document.getElementById('rating-text-feedback');
      if (feedback) feedback.textContent = RATING_DESCRIPTIONS[val];
      await persistDraft();
      updateCompanionSidebar();
    });
  });

  // Priority radio change
  container.querySelectorAll('input[name="priority"]').forEach((radio) => {
    radio.addEventListener('change', async (e) => {
      const target = e.target as HTMLInputElement;
      state.priority = target.value as Priority;
      container.querySelectorAll('.priority-option').forEach((opt) => opt.classList.remove('selected'));
      target.closest('.priority-option')?.classList.add('selected');
      await persistDraft();
      updateCompanionSidebar();
    });
  });

  // Notes input auto-save
  document.getElementById('notes')?.addEventListener('input', async (e) => {
    state.notes = (e.target as HTMLTextAreaElement).value;
    await persistDraft();
    updateCompanionSidebar();
  });

  // Photo capture
  document.getElementById('capture-btn')?.addEventListener('click', async () => {
    showToast('Đang mở máy ảnh...', 'info');
    const blob = await capturePhoto();
    if (!blob) return;

    if (state.photoPreviewURL) revokePreviewURL(state.photoPreviewURL);

    state.photo = blob;
    state.photoPreviewURL = createPreviewURL(blob);
    await persistDraft();
    updateCompanionSidebar();

    const preview = document.getElementById('photo-preview')!;
    preview.innerHTML = `<img src="${state.photoPreviewURL}" alt="Ảnh hiện trạng" /><button type="button" id="remove-photo" class="remove-photo" aria-label="Xóa ảnh">✕</button>`;
    preview.classList.remove('hidden');
    attachRemovePhoto();
    showToast('Đã chụp và nén ảnh thành công', 'success');
  });

  attachRemovePhoto();

  function attachRemovePhoto(): void {
    document.getElementById('remove-photo')?.addEventListener('click', async () => {
      if (state.photoPreviewURL) revokePreviewURL(state.photoPreviewURL);
      state.photo = null;
      state.photoPreviewURL = null;
      await persistDraft();
      updateCompanionSidebar();
      const preview = document.getElementById('photo-preview');
      if (preview) {
        preview.innerHTML = '';
        preview.classList.add('hidden');
      }
      showToast('Đã xóa ảnh đính kèm', 'info');
    });
  }

  document.getElementById('step3-back')?.addEventListener('click', () => {
    state.step = 2;
    renderStep();
  });

  document.getElementById('submit-btn')?.addEventListener('click', async () => {
    if (!state.rating) {
      showFieldError('Vui lòng đánh giá tình trạng từ 1 đến 5 sao.');
      return;
    }
    await handleSubmit();
  });
}

// ── Submit Handling ──────────────────────────────────────────
async function handleSubmit(): Promise<void> {
  const btn = document.getElementById('submit-btn') as HTMLButtonElement;
  if (!btn) return;
  btn.disabled = true;
  btn.textContent = 'Đang lưu vào IndexedDB...';

  try {
    const isEdit = Boolean(state.editingId);
    const submissionId = state.editingId || crypto.randomUUID();
    const notesInput = (document.getElementById('notes') as HTMLTextAreaElement)?.value ?? state.notes;

    const submission = {
      id: submissionId,
      timestamp: new Date().toISOString(),
      status: 'PENDING_SYNC' as const,
      zone: state.zone,
      building: state.building || state.zone,
      floor: state.floor,
      room: state.room,
      roomType: state.roomType,
      category: state.category as Category,
      rating: state.rating,
      priority: state.priority,
      tags: state.tags,
      inspector: state.inspector,
      location: state.location,
      notes: notesInput,
      photo: state.photo,
    };

    // 1. Save / Update locally to IndexedDB
    await saveSubmission(submission);

    // 2. Clear current draft & editingId
    await clearDraft();
    state.editingId = null;

    // 3. Register Background Sync
    await registerBackgroundSync();

    // 4. Try immediate flush if online
    if (navigator.onLine) {
      flushPendingSubmissions();
    }

    showSuccessScreen(isEdit);
  } catch (err) {
    console.error('[Form] Submit error:', err);
    btn.disabled = false;
    btn.textContent = 'Lưu & Gửi báo cáo';
    showFieldError('Lỗi lưu dữ liệu khảo sát. Vui lòng thử lại.');
  }
}

// ── Success Screen ───────────────────────────────────────────
function showSuccessScreen(isEdit = false): void {
  const container = document.getElementById('form-container')!;
  const isOnline = navigator.onLine;

  container.innerHTML = `
    <div class="success-screen">
      <div class="success-icon">${isEdit ? '✏️' : '🎉'}</div>
      <h2 class="success-title">${isEdit ? 'Đã cập nhật báo cáo thành công!' : 'Đã ghi nhận khảo sát thành công!'}</h2>
      <p class="success-desc">
        ${
          isEdit
            ? 'Báo cáo đã được cập nhật lại trong cơ sở dữ liệu IndexedDB.'
            : isOnline
            ? 'Dữ liệu đã được lưu an toàn vào IndexedDB và đang được đồng bộ lên máy chủ VKU.'
            : 'Đang offline. Báo cáo đã được lưu an toàn tại máy và sẽ tự động đồng bộ khi có Wi-Fi/4G.'
        }
      </p>
      <div class="success-meta">
        <div><span>📍 Khu vực:</span> <strong>${state.zone || state.building} — Tầng ${state.floor} — Phòng ${state.room}</strong> ${state.roomType ? `(${state.roomType})` : ''}</div>
        <div><span>🏷️ Hạng mục:</span> <strong>${state.category}</strong></div>
        <div><span>⭐ Đánh giá:</span> <strong>${state.rating}/5 sao</strong> (${state.priority === 'urgent' ? '🔴 Khẩn cấp' : state.priority === 'high' ? '🟡 Cần sửa sớm' : '🟢 Bình thường'})</div>
        ${state.tags.length > 0 ? `<div><span>🔧 Vấn đề:</span> <strong>${state.tags.join(', ')}</strong></div>` : ''}
      </div>
      <div class="success-actions">
        <button id="new-inspection" class="btn btn-primary btn-lg">+ Khảo sát phòng tiếp theo</button>
        <button id="view-history" class="btn btn-secondary">📋 Xem Danh sách & Đồng bộ</button>
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

function resetState(): void {
  if (state.photoPreviewURL) revokePreviewURL(state.photoPreviewURL);
  state = {
    step: 1,
    editingId: null,
    zone: state.zone,
    building: state.building,
    floor: state.floor,
    room: '',
    roomType: state.roomType,
    category: '',
    rating: 0,
    priority: 'normal',
    tags: [],
    inspector: state.inspector,
    location: state.location,
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

  document.getElementById('form-error')?.remove();
  updateProgressBar(state.step);

  switch (state.step) {
    case 1:
      renderStep1(container);
      break;
    case 2:
      renderStep2(container);
      break;
    case 3:
      renderStep3(container);
      break;
  }

  // Prepend editing banner if in editing mode
  if (state.editingId) {
    const banner = document.createElement('div');
    banner.className = 'editing-banner';
    banner.innerHTML = `
      <div class="editing-banner-content">
        <span>✏️ Đang điều chỉnh báo cáo: <strong>${state.room ? state.room + ' — ' : ''}${state.zone || state.building}</strong> (Chờ đồng bộ)</span>
      </div>
      <button type="button" id="cancel-edit-btn" class="btn btn-xs btn-outline">Hủy sửa</button>
    `;
    container.prepend(banner);
    document.getElementById('cancel-edit-btn')?.addEventListener('click', async () => {
      await handleClearForm();
    });
  }

  // Update live preview companion sidebar on desktop
  updateCompanionSidebar();
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

// ── VKU Campus Safety & Technical Tips ────────────────────────
export function getZoneSafetyTip(zoneId: string): string {
  switch (zoneId) {
    case 'Khu B':
      return 'Kiểm tra switch mạng tầng, nguồn điện dàn máy tính PC và thiết bị đo kiểm. Báo ngay nếu phát hiện chập cháy ổ cắm.';
    case 'Khu V':
      return 'Kiểm tra máy chiếu, cáp HDMI, điều hòa và hệ thống chiếu sáng giảng đường trước ca học.';
    case 'Khu A':
      return 'Kiểm tra đường truyền internet hành chính, máy in mạng một cửa và hệ thống điều hòa văn phòng.';
    case 'Khu C':
      return 'Kiểm tra máy quét mã vạch thư viện số, trạm sạc thiết bị di động và an toàn máy in 3D MakerSpace.';
    case 'Khu K':
      return 'Kiểm tra hệ thống âm thanh, micro, máy chiếu công suất lớn và cửa thoát hiểm hội trường Trịnh Công Sơn.';
    case 'Khu KTX':
      return 'Kiểm tra van nước rò rỉ, đèn hành lang, hệ thống báo cháy tự động và khu giặt sấy sinh viên.';
    case 'Khu TheThao':
      return 'Kiểm tra đèn chiếu sáng sân bóng đá cỏ nhân tạo, sàn nhà thi đấu đa năng và thiết bị tập thể hình.';
    case 'Khu NghienCuu':
      return 'Kiểm tra điều kiện nhiệt độ - độ ẩm phòng R&D, nguồn điện liên tục UPS và tủ thiết bị chuyên dụng.';
    case 'Khu HaTang':
      return 'Tuân thủ nghiêm ngặt quy tắc an toàn điện cao áp, kiểm tra áp lực đồng hồ nước PCCC và trạm sạc xe điện.';
    case 'Khu CanhQuan':
      return 'Kiểm tra đèn chiếu sáng quảng trường, barrier nhà xe sinh viên, camera an ninh và bốt bảo vệ.';
    default:
      return 'Ghi nhận hiện trạng đầy đủ, chụp ảnh cận cảnh và báo cáo ngay các sự cố khẩn cấp về tổ quản trị.';
  }
}

// ── Desktop Companion Sidebar (Live Ticket & Campus Intel) ────
export async function updateCompanionSidebar(): Promise<void> {
  const sidebar = document.getElementById('companion-sidebar');
  if (!sidebar) return;

  const currentZone = CAMPUS_ZONES.find((z) => z.id === state.zone) || CAMPUS_ZONES[0];
  let pendingCount = 0;
  try {
    const all = await getAllSubmissions();
    pendingCount = all.filter((s) => s.status === 'PENDING_SYNC').length;
  } catch (e) {
    console.warn('[Sidebar] Could not load pending count', e);
  }

  const stars = state.rating > 0
    ? '★'.repeat(state.rating) + '☆'.repeat(5 - state.rating) + ` (${state.rating}/5 sao)`
    : 'Chưa chấm sao';

  sidebar.innerHTML = `
    <!-- Live Ticket Preview Card -->
    <div class="sidebar-card live-ticket-card">
      <div class="sidebar-card-header">
        <div class="live-pulse-title">
          <span class="live-pulse-dot"></span>
          <h3 class="sidebar-card-title">Xem trước phiếu khảo sát</h3>
        </div>
        <span class="badge live-status-badge ${state.editingId ? 'badge-priority-urgent' : 'badge-pending'}">
          ${state.editingId ? '✏️ Đang sửa' : '📝 Bản nháp'}
        </span>
      </div>

      <div class="live-ticket-body">
        <div class="live-ticket-location">
          <div class="live-zone-tag">${currentZone.icon} <strong>${currentZone.name}</strong></div>
          <div class="live-room-row">
            ${state.room ? `Phòng: <span class="highlight-room">${state.room}</span>` : '<span class="text-muted">Chưa chọn phòng</span>'}
            ${state.floor ? `— Tầng <strong>${state.floor}</strong>` : ''}
          </div>
          <div class="live-space-type">Loại không gian: <span>${state.roomType || currentZone.defaultType}</span></div>
        </div>

        <div class="live-ticket-device-row">
          <div class="live-cat-pill">${state.category ? `🏷️ ${state.category}` : '⚪ Chưa chọn thiết bị'}</div>
          <div class="badge badge-priority-${state.priority}">
            ${state.priority === 'urgent' ? '🔴 Khẩn cấp' : state.priority === 'high' ? '🟡 Cần sửa sớm' : '🟢 Bình thường'}
          </div>
        </div>

        <div class="live-stars">${stars}</div>

        ${
          state.tags.length > 0
            ? `<div class="live-tags-wrap">${state.tags.map((t) => `<span class="card-tag-pill">${t}</span>`).join('')}</div>`
            : ''
        }

        ${
          state.photoPreviewURL
            ? `<div class="live-photo-preview"><img src="${state.photoPreviewURL}" alt="Ảnh xem trước" /><span class="live-photo-tag">✓ Đã đính kèm ảnh</span></div>`
            : ''
        }

        ${state.notes ? `<p class="live-notes-quote">“${state.notes}”</p>` : ''}

        <div class="live-meta-footer">
          <div class="live-meta-row"><span>👤 Kiểm tra viên:</span> <strong>${state.inspector || 'Chưa nhập'}</strong></div>
          <div class="live-meta-row"><span>📍 Tọa độ GPS:</span> <strong>${state.location ? `${state.location.latitude.toFixed(4)}, ${state.location.longitude.toFixed(4)}` : 'Đang lấy...'}</strong></div>
        </div>
      </div>
    </div>

    <!-- VKU Facilities & Campus Intelligence -->
    <div class="sidebar-card campus-intel-card">
      <div class="sidebar-card-header">
        <h3 class="sidebar-card-title">🏢 Hướng dẫn kỹ thuật VKU</h3>
        <span class="campus-code-badge">${currentZone.shortName}</span>
      </div>
      <div class="intel-content">
        <div class="intel-hotline-box">
          <div class="intel-hotline-icon">📞</div>
          <div class="intel-hotline-text">
            <span class="intel-hotline-label">Hotline CSVC & Kỹ thuật:</span>
            <strong class="intel-hotline-number">0236.3667.113</strong>
          </div>
        </div>
        <div class="intel-tip-box">
          <div class="intel-tip-label">💡 Lưu ý tại ${currentZone.shortName}:</div>
          <p class="intel-tip-text">${getZoneSafetyTip(currentZone.id)}</p>
        </div>
      </div>
    </div>

    <!-- Offline Queue Status Card -->
    <div class="sidebar-card offline-status-card">
      <div class="sidebar-card-header">
        <h3 class="sidebar-card-title">💾 Hàng đợi Offline</h3>
        <span class="offline-count-badge" id="sidebar-queue-badge">${pendingCount} chờ gửi</span>
      </div>
      <p class="offline-status-desc">
        Dữ liệu lưu an toàn 100% trong IndexedDB, không mất khi đóng ứng dụng hay mất kết nối.
      </p>
      <button type="button" id="sidebar-sync-btn" class="btn btn-outline btn-sm btn-block">
        🔄 Đồng bộ lên máy chủ ngay
      </button>
    </div>
  `;

  document.getElementById('sidebar-sync-btn')?.addEventListener('click', async () => {
    if (!navigator.onLine) {
      showToast('Đang Offline. Vui lòng kết nối Wi-Fi/4G để đồng bộ.', 'warning');
      return;
    }
    showToast('Đang tiến hành đồng bộ dữ liệu...', 'info');
    const res = await flushPendingSubmissions();
    if (res.synced > 0) {
      showToast(`Đã đồng bộ thành công ${res.synced}/${res.total} báo cáo!`, 'success');
      updateCompanionSidebar();
    } else if (res.total === 0) {
      showToast('Tất cả báo cáo đã được đồng bộ.', 'info');
    } else {
      showToast('Máy chủ chưa phản hồi, sẽ tự động thử lại khi có mạng.', 'warning');
    }
  });
}
