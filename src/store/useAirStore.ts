// src/store/useAirStore.ts
import { create } from 'zustand';
import { espService } from '../services/espService';
import { AirQualityState } from '../utils/helpers';

export interface AirState {
  airQualityValue: number | null;
  airQualityState: AirQualityState;
  lastUpdate: number | null;
  loading: boolean;
  error: string | null;
  fetchStatus: () => Promise<void>;
}

export const useAirStore = create<AirState>((set) => ({
  airQualityValue: null,
  airQualityState: 'BUENA',
  lastUpdate: null,
  loading: false,
  error: null,

  fetchStatus: async () => {
    set({ loading: true, error: null });

    try {
      const res = await espService.getStatus();

      if (!res || res.ok === false) {
        throw new Error('El dispositivo respondió con ok = false');
      }

      const air = res.data?.air ?? {};
      const time = res.data?.time ?? {};

      set({
        airQualityValue:
          typeof air.airQualityValue === 'number' ? air.airQualityValue : null,
        airQualityState:
          (air.airQualityState as AirQualityState) ?? 'BUENA',
        lastUpdate:
          typeof time.millis === 'number' ? time.millis : Date.now(),
        loading: false,
        error: null,
      });
    } catch (e: any) {
      set({
        loading: false,
        error: e?.message ?? 'Error desconocido al leer /api/status',
      });
    }
  },
}));
