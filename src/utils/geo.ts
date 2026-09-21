// =========================================================
// utils/geo.ts — GPS coordinate capture helper
// Web: browser Geolocation API
// Android/iOS Capacitor: native @capacitor/geolocation plugin
// =========================================================

import { Geolocation, Position } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';
import { LocationCoords } from '../db';

/**
 * Get current GPS/location coordinates.
 * Supports native Capacitor runtime (Android APK) and standard Web browsers.
 */
export async function getCampusLocation(): Promise<LocationCoords | null> {
  // ── 1. Native Capacitor Environment (Android APK / iOS) ──
  if (Capacitor.isNativePlatform()) {
    try {
      let permissions = await Geolocation.checkPermissions();

      // Check if neither fine nor coarse location is granted
      const hasPermission =
        permissions.location === 'granted' || permissions.coarseLocation === 'granted';

      if (!hasPermission) {
        console.info('[GPS] Requesting native location permissions...');
        permissions = await Geolocation.requestPermissions();
      }

      const isGrantedAfter =
        permissions.location === 'granted' || permissions.coarseLocation === 'granted';

      if (!isGrantedAfter) {
        console.warn('[GPS] Native location permission was denied by user');
        return null;
      }

      let position: Position | null = null;

      // First attempt: High accuracy GPS (satellites)
      try {
        position = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 8000,
          maximumAge: 60000,
        });
      } catch (gpsError) {
        console.warn('[GPS] High-accuracy GPS timed out or unavailable, falling back to network provider...', gpsError);
        // Second attempt: Low accuracy fallback (Cell/Wi-Fi indoors)
        position = await Geolocation.getCurrentPosition({
          enableHighAccuracy: false,
          timeout: 10000,
          maximumAge: 120000,
        });
      }

      if (position?.coords) {
        return {
          latitude: Number(position.coords.latitude.toFixed(6)),
          longitude: Number(position.coords.longitude.toFixed(6)),
          accuracy: Math.round(position.coords.accuracy || 15),
        };
      }
    } catch (nativeErr) {
      console.warn('[GPS] Native Geolocation plugin error, attempting web fallback:', nativeErr);
    }
  }

  // ── 2. Standard Web Browser Environment / Web Fallback ──
  if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
    console.info('[GPS] Geolocation is not supported on this platform/device');
    return null;
  }

  return new Promise((resolve) => {
    // Attempt high accuracy first
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: Number(pos.coords.latitude.toFixed(6)),
          longitude: Number(pos.coords.longitude.toFixed(6)),
          accuracy: Math.round(pos.coords.accuracy),
        });
      },
      (_highAccErr) => {
        // High accuracy failed or timed out (e.g. indoors on laptop), try low accuracy
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            resolve({
              latitude: Number(pos.coords.latitude.toFixed(6)),
              longitude: Number(pos.coords.longitude.toFixed(6)),
              accuracy: Math.round(pos.coords.accuracy),
            });
          },
          (lowAccErr) => {
            console.info('[GPS] Web geolocation unavailable:', lowAccErr.message);
            resolve(null);
          },
          { enableHighAccuracy: false, timeout: 10000, maximumAge: 120000 }
        );
      },
      { enableHighAccuracy: true, timeout: 7000, maximumAge: 60000 }
    );
  });
}

