// =========================================================
// form/camera.ts — Photo capture abstraction
// Uses @capacitor/camera when running natively (Android APK),
// falls back to <input type="file" capture="environment"> on web.
// =========================================================

import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

// ── Public API ───────────────────────────────────────────────
export async function capturePhoto(): Promise<Blob | null> {
  if (Capacitor.isNativePlatform()) {
    return captureNative();
  }
  return captureWeb();
}

// ── Native (Android) ─────────────────────────────────────────
async function captureNative(): Promise<Blob | null> {
  try {
    const image = await Camera.getPhoto({
      quality: 85,
      allowEditing: false,
      resultType: CameraResultType.Base64, // v8 does not support Blob result
      source: CameraSource.Camera,
    });
    if (!image.base64String) return null;
    // Convert base64 → Blob
    const byteChars = atob(image.base64String);
    const bytes = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
    return new Blob([bytes], { type: 'image/jpeg' });
  } catch (err) {
    console.warn('[Camera] Native capture cancelled:', err);
    return null;
  }
}

// ── Web (PWA / browser) ──────────────────────────────────────
function captureWeb(): Promise<Blob | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment'; // Prefer rear camera on mobile

    input.onchange = () => {
      const file = input.files?.[0] ?? null;
      resolve(file);
    };
    input.oncancel = () => resolve(null);

    // Trigger file picker
    input.click();
  });
}

// ── Preview helper ───────────────────────────────────────────
export function createPreviewURL(blob: Blob): string {
  return URL.createObjectURL(blob);
}

export function revokePreviewURL(url: string): void {
  URL.revokeObjectURL(url);
}
