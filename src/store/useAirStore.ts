// src/store/useAirStore.ts
import { create } from 'zustand';
import { espService } from '../services/espService';
import { AirQualityState } from '../utils/helpers';

export type FanMode = 'AUTO' | 'MANUAL';

export interface AirState {
  airQualityValue: number | null;
  airQualityState: AirQualityState;
  lastUpdate: number | null;

  fanMode: FanMode;
  fanPwm: number;

  loading: boolean;
  error: string | null;

  fetchStatus: () => Promise<void>;
  setFanMode: (mode: FanMode) => void;
  setFanPwm: (pwm: number) => void;
  setFanSettings: (mode: FanMode, pwm?: number) => void;
}

export const useAirStore = create<AirState>((set) => ({
  airQualityValue: null,
  airQualityState: 'BUENA',
  lastUpdate: null,

  fanMode: 'AUTO',
  fanPwm: 0,

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
      const fan = res.data?.fan ?? {};
      const time = res.data?.time ?? {};

      set({
        airQualityValue:
          typeof air.airQualityValue === 'number' ? air.airQualityValue : null,
        airQualityState:
          (air.airQualityState as AirQualityState) ?? 'BUENA',

        fanMode: (fan.fanMode as FanMode) ?? 'AUTO',
        fanPwm:
          typeof fan.fanPwm === 'number' ? fan.fanPwm : 0,

        lastUpdate:
          typeof time.millis === 'number' ? time.millis : Date.now(),

        loading: false,
        error: null,
      });
    } catch (e: any) {
      set({
        loading: false,
        error: e?.message ?? 'Error al leer /api/status',
      });
    }
  },

  setFanMode: (fanMode) => set({ fanMode }),
  setFanPwm: (fanPwm) => set({ fanPwm }),

  setFanSettings: (fanMode, fanPwm) =>
    set((state) => ({
      fanMode,
      fanPwm: typeof fanPwm === 'number' ? fanPwm : state.fanPwm,
    })),
}));
