import { Geolocation, PermissionStatus } from '@capacitor/geolocation';

export interface GeoPosition {
  latitude: number;
  longitude: number;
}

export type LocationStatus = 'granted' | 'denied' | 'prompt' | 'off' | 'error';

export interface LocationResult {
  status: LocationStatus;
  position?: GeoPosition;
}

export const locationService = {
  async getPermissionStatus(): Promise<PermissionStatus> {
    try {
      return await Geolocation.checkPermissions();
    } catch {
      return { location: 'denied' } as PermissionStatus;
    }
  },

  async requestPermission(): Promise<PermissionStatus> {
    try {
      return await Geolocation.requestPermissions();
    } catch {
      return { location: 'denied' } as PermissionStatus;
    }
  },

  /**
   * Ensures location permission AND fetches the current position.
   * Returns an explicit status so the UI can tell the difference between:
   *  - permission not granted yet ('prompt')
   *  - permission denied ('denied')
   *  - device location services turned off ('off')
   *  - a successful read ('granted')
   * Permission is (re)requested every call so the OS prompt appears each visit.
   */
  async ensureLocation(): Promise<LocationResult> {
    let perm = await this.getPermissionStatus();
    if (perm.location !== 'granted') {
      perm = await this.requestPermission();
    }
    if (perm.location !== 'granted') {
      return { status: perm.location === 'denied' ? 'denied' : 'prompt' };
    }

    try {
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 12000,
      });
      return {
        status: 'granted',
        position: {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        },
      };
    } catch (e: any) {
      const code = e?.code;
      const msg = String(e?.message || '');
      if (code === 2 || /unavailable/i.test(msg)) return { status: 'off' };
      if (code === 1 || /denied|permission/i.test(msg)) return { status: 'denied' };
      return { status: 'error' };
    }
  },

  async getCurrentPosition(): Promise<GeoPosition | null> {
    const res = await this.ensureLocation();
    return res.position ?? null;
  },
};
