// =========================================================
// utils/geo.ts — GPS coordinate capture helper
// Works across Web browsers and Capacitor Android WebViews
// =========================================================

import { LocationCoords } from '../db';

export async function getCampusLocation(): Promise<LocationCoords | null> {
  if (!('geolocation' in navigator)) {
    console.info('[GPS] Geolocation not supported on this device');
    return null;
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: Number(position.coords.latitude.toFixed(6)),
          longitude: Number(position.coords.longitude.toFixed(6)),
          accuracy: Math.round(position.coords.accuracy),
        });
      },
      (err) => {
        console.info('[GPS] Geolocation skipped or unavailable:', err.message);
        resolve(null);
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 60000,
      }
    );
  });
}
