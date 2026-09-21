// =========================================================
// utils/geo.ts — GPS coordinate capture helper
// Web: browser Geolocation API
// Android/iOS Capacitor: native Geolocation plugin
// =========================================================

import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';
import { LocationCoords } from '../db';

export async function getCampusLocation(): Promise<LocationCoords | null> {
  try {
    if (Capacitor.isNativePlatform()) {
      let permissions = await Geolocation.checkPermissions();

      if (permissions.location !== 'granted') {
        permissions = await Geolocation.requestPermissions();
      }

      if (permissions.location !== 'granted') {
        console.info('[GPS] Native location permission denied');
        return null;
      }

      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      });

      return {
        latitude: Number(position.coords.latitude.toFixed(6)),
        longitude: Number(position.coords.longitude.toFixed(6)),
        accuracy: Math.round(position.coords.accuracy),
      };
    }

    if (!('geolocation' in navigator)) {
      console.info('[GPS] Geolocation not supported on this device');
      return null;
    }

    return await new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => resolve({
          latitude: Number(position.coords.latitude.toFixed(6)),
          longitude: Number(position.coords.longitude.toFixed(6)),
          accuracy: Math.round(position.coords.accuracy),
        }),
        (err) => {
          console.info('[GPS] Browser geolocation unavailable:', err.message);
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    });
  } catch (err) {
    console.info('[GPS] Location unavailable:', err);
    return null;
  }
}
