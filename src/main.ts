// =========================================================
// main.ts — App entry point
// Registers Service Worker, sets up Capacitor overrides,
// wires navigation, and bootstraps the form.
// =========================================================

import './style.css';
import { Capacitor } from '@capacitor/core';

import { Network } from '@capacitor/network';

import { initFormState, renderStep, updateCompanionSidebar } from './form/steps';
import { renderHistory, updateCardStatus } from './form/history';
import { setupOnlineListener, flushPendingSubmissions } from './sync';

import { showToast } from './utils/toast';

let isOnlineState = typeof navigator !== 'undefined' ? navigator.onLine : false;

// ── Service Worker Registration ──────────────────────────────
async function registerServiceWorker(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });
    console.info('[SW] Registered:', reg.scope);

    // Listen for messages from SW (e.g. Background Sync completed)
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'SUBMISSION_SYNCED') {
        updateCardStatus(event.data.id);
        showToast('Báo cáo đã được đồng bộ ngầm thành công!', 'success');
      }
    });

    // Notify on updates
    reg.onupdatefound = () => {
      const installing = reg.installing;
      if (!installing) return;
      installing.onstatechange = () => {
        if (
          installing.state === 'installed' &&
          navigator.serviceWorker.controller
        ) {
          showUpdateBanner();
        }
      };
    };
  } catch (err) {
    console.error('[SW] Registration failed:', err);
  }
}

// ── Update banner ────────────────────────────────────────────
function showUpdateBanner(): void {
  const banner = document.createElement('div');
  banner.className = 'update-banner';
  banner.innerHTML = `
    <span>🔄 Có phiên bản mới!</span>
    <button id="reload-btn" class="btn btn-xs">Cập nhật</button>
  `;
  document.body.prepend(banner);
  document.getElementById('reload-btn')?.addEventListener('click', () => {
    window.location.reload();
  });
}

// ── Online listener: web vs native ──────────────────────────
async function setupNetworkListener(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    // Use Capacitor Network plugin on Android
    await Network.addListener('networkStatusChange', (status) => {
      console.info('[Network] Status changed:', status);
      updateNetworkBadge(status.connected);
      if (status.connected) {
        showToast('Đã kết nối mạng (Android) — Bắt đầu đồng bộ', 'info');
        flushPendingSubmissions();
      } else {
        showToast('Mất kết nối mạng — Đang lưu trữ offline', 'warning');
      }
    });
    const status = await Network.getStatus();
    updateNetworkBadge(status.connected);
  } else {
    // Web fallback: window online/offline events + active internet ping
    setupOnlineListener();
    updateNetworkBadge(navigator.onLine);

    const checkRealConnection = async () => {
      if (!navigator.onLine) {
        if (isOnlineState) {
          updateNetworkBadge(false);
          showToast('Đang ở chế độ Offline — Báo cáo sẽ được lưu cục bộ', 'warning');
        }
        return;
      }

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2000);
        const res = await fetch('https://vku-field-survey.hungabc2206.workers.dev/api/submissions', {
          method: 'GET',
          mode: 'cors',
          cache: 'no-store',
          signal: controller.signal,
        });
        clearTimeout(timeout);
        const actuallyOnline = res.ok;
        if (actuallyOnline !== isOnlineState) {
          updateNetworkBadge(actuallyOnline);
          if (actuallyOnline) {
            showToast('Đã khôi phục kết nối Internet — Đang đồng bộ...', 'info');
            flushPendingSubmissions();
          } else {
            showToast('Mất kết nối Internet — Đang lưu trữ offline', 'warning');
          }
        }
      } catch {
        if (isOnlineState) {
          updateNetworkBadge(false);
          showToast('Mất kết nối Internet — Đang lưu trữ offline', 'warning');
        }
      }
    };

    window.addEventListener('online', () => {
      checkRealConnection();
    });
    window.addEventListener('offline', () => {
      updateNetworkBadge(false);
      showToast('Đang ở chế độ Offline — Báo cáo sẽ được lưu cục bộ', 'warning');
    });

    // Run immediate check and periodic 4-second heartbeat
    checkRealConnection();
    setInterval(checkRealConnection, 4000);
  }
}

export function updateNetworkBadge(online: boolean): void {
  isOnlineState = online;
  const badge = document.getElementById('network-badge');
  if (!badge) return;
  badge.textContent = online ? '🟢 Online' : '🔴 Offline';
  badge.className = `network-badge ${online ? 'online' : 'offline'}`;
}

// ── Navigation ───────────────────────────────────────────────
type Page = 'form' | 'history';
let currentPage: Page = 'form';

function showPage(page: Page): void {
  currentPage = page;
  const app = document.getElementById('app')!;

  if (page === 'form') {
    app.innerHTML = `
      <header class="app-header">
        ${renderHeader()}
      </header>
      <main class="app-main app-workspace">
        <div class="workspace-grid">
          <div class="workspace-main-column">
            <div class="progress-bar">
              <div class="progress-track">
                <div id="progress-fill" class="progress-fill"></div>
              </div>
              <div class="progress-steps">
                <span class="progress-step current">1. Khu vực & Địa điểm</span>
                <span class="progress-step">2. Thiết bị & Khiếm khuyết</span>
                <span class="progress-step">3. Hiện trạng & Đánh giá</span>
              </div>
            </div>
            <div id="form-container" class="form-container"></div>
          </div>

          <!-- Desktop Companion Sidebar -->
          <aside id="companion-sidebar" class="workspace-companion-column"></aside>
        </div>
      </main>
    `;
    renderStep();
    updateCompanionSidebar();
  } else if (page === 'history') {
    app.innerHTML = `
      <header class="app-header">
        ${renderHeader()}
      </header>
      <main class="app-main app-history">
        <div id="history-container" class="history-view-container"></div>
      </main>
    `;
    renderHistory(document.getElementById('history-container')!);
  }

  // Ensure network badge is accurate after re-render
  updateNetworkBadge(isOnlineState);

  // Re-wire nav buttons
  document.getElementById('nav-form')?.addEventListener('click', () => showPage('form'));
  document.getElementById('nav-history')?.addEventListener('click', () => showPage('history'));
}

function renderHeader(): string {
  return `
    <div class="header-brand">
      <div class="header-logo">🏫</div>
      <div class="header-titles">
        <span class="header-name">VKU Field Survey</span>
        <span class="header-sub">Kiểm tra cơ sở vật chất</span>
      </div>
    </div>
    <nav class="header-nav">
      <button id="nav-form" class="nav-btn ${currentPage === 'form' ? 'active' : ''}">📝 Kiểm tra</button>
      <button id="nav-history" class="nav-btn ${currentPage === 'history' ? 'active' : ''}">📋 Lịch sử</button>
    </nav>
    <div class="header-status">
      <a href="/vku-field-survey.apk" download="vku-field-survey.apk" class="apk-download-btn" title="Tải ứng dụng Android APK">
        📥 Tải APK
      </a>
      <span id="network-badge" class="network-badge ${isOnlineState ? 'online' : 'offline'}">
        ${isOnlineState ? '🟢 Online' : '🔴 Offline'}
      </span>
    </div>
  `;
}

// ── Custom event routing ─────────────────────────────────────
window.addEventListener('navigate', (e: Event) => {
  const { page } = (e as CustomEvent<{ page: Page }>).detail;
  showPage(page);
});

// Live sync badge update
window.addEventListener('submission-synced', (e: Event) => {
  const { id } = (e as CustomEvent<{ id: string }>).detail;
  updateCardStatus(id);
});

window.addEventListener('sync-completed', (e: Event) => {
  const { synced } = (e as CustomEvent<{ synced: number; total: number }>).detail;
  if (synced > 0) {
    showToast(`Đã đồng bộ thành công ${synced} báo cáo lên máy chủ!`, 'success');
  }
});

// ── Splash Screen Management ──────────────────────────────────
function updateSplashStatus(message: string): void {
  const statusEl = document.getElementById('splash-status');
  if (statusEl) {
    statusEl.textContent = message;
  }
}

function dismissSplashScreen(): void {
  const splash = document.getElementById('app-splash-screen');
  if (!splash) return;

  splash.classList.add('splash-hidden');
  setTimeout(() => {
    splash.remove();
  }, 500);
}

// ── Bootstrap ────────────────────────────────────────────────
async function bootstrap(): Promise<void> {
  const startTime = Date.now();

  if (Capacitor.isNativePlatform()) {
    document.body.classList.add('is-native');
    try {
      const status = await Network.getStatus();
      isOnlineState = status.connected;
    } catch {
      isOnlineState = navigator.onLine;
    }
  } else {
    isOnlineState = navigator.onLine;
  }

  // Render initial page
  showPage('form');

  updateSplashStatus('Đang kiểm tra dịch vụ nền...');
  await registerServiceWorker();

  updateSplashStatus('Đang nạp cơ sở dữ liệu offline...');
  await initFormState();

  updateSplashStatus('Đang cấu hình kết nối...');
  await setupNetworkListener();

  // Trigger sync if online
  if (isOnlineState) {
    flushPendingSubmissions();
  }

  updateSplashStatus('Sẵn sàng làm việc!');

  // Ensure minimum display duration (~1100ms) for smooth branding experience without flicker
  const elapsed = Date.now() - startTime;
  const remaining = Math.max(0, 1100 - elapsed);

  setTimeout(() => {
    dismissSplashScreen();
  }, remaining);
}

bootstrap();


