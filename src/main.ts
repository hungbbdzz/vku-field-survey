// =========================================================
// main.ts — App entry point
// Registers Service Worker, sets up Capacitor overrides,
// wires navigation, and bootstraps the form.
// =========================================================

import './style.css';
import { Capacitor } from '@capacitor/core';

import { Network } from '@capacitor/network';

import { initFormState, renderStep } from './form/steps';
import { renderHistory, updateCardStatus } from './form/history';
import { setupOnlineListener, flushPendingSubmissions } from './sync';

// ── Service Worker Registration ──────────────────────────────
async function registerServiceWorker(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });
    console.info('[SW] Registered:', reg.scope);

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
        flushPendingSubmissions();
      }
    });
    const status = await Network.getStatus();
    updateNetworkBadge(status.connected);
  } else {
    // Web fallback: window online/offline events
    setupOnlineListener();
    updateNetworkBadge(navigator.onLine);
    window.addEventListener('online', () => updateNetworkBadge(true));
    window.addEventListener('offline', () => updateNetworkBadge(false));
  }
}

function updateNetworkBadge(online: boolean): void {
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
      <main class="app-main">
        <div class="progress-bar">
          <div class="progress-track">
            <div id="progress-fill" class="progress-fill"></div>
          </div>
          <div class="progress-steps">
            <span class="progress-step current">Vị trí</span>
            <span class="progress-step">Thiết bị</span>
            <span class="progress-step">Kiểm tra</span>
          </div>
        </div>
        <div id="form-container" class="form-container"></div>
      </main>
    `;
    renderStep();
  } else if (page === 'history') {
    app.innerHTML = `
      <header class="app-header">
        ${renderHeader()}
      </header>
      <main class="app-main">
        <div id="form-container" class="form-container"></div>
      </main>
    `;
    renderHistory(document.getElementById('form-container')!);
  }

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
    <span id="network-badge" class="network-badge">🔴 Offline</span>
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

// ── Bootstrap ────────────────────────────────────────────────
async function bootstrap(): Promise<void> {
  await registerServiceWorker();
  await initFormState();
  await setupNetworkListener();
  showPage('form');
}

bootstrap();
