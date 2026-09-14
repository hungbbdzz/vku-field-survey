// =========================================================
// form/camera.ts — Photo capture abstraction
// Uses @capacitor/camera when running natively (Android APK),
// falls back to <input type="file" capture="environment"> on web.
// =========================================================

import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

// ── Public API ───────────────────────────────────────────────
export async function capturePhoto(): Promise<Blob | null> {
  let rawBlob: Blob | null = null;
  if (Capacitor.isNativePlatform()) {
    rawBlob = await captureNative();
  } else {
    rawBlob = await captureWeb();
  }
  if (!rawBlob) return null;
  return compressImage(rawBlob);
}

// ── Client-side Canvas Image Compression ─────────────────────
// Downscales high-resolution camera photos (3-10MB) to ~200-350KB JPEG
// Ensures fast sub-second IndexedDB writes and instant background sync
export async function compressImage(blob: Blob, maxWidth = 1280, quality = 0.82): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);

    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;

      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        resolve(blob);
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (compressed) => {
          resolve(compressed || blob);
        },
        'image/jpeg',
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(blob);
    };

    img.src = url;
  });
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
