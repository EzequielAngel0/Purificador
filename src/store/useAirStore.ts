// src/store/useAirStore.ts
import { create } from 'zustand';
import { espService } from '../services/espService';
import { supabase } from '../services/supabaseClient';
import { DEVICE_UUID } from '../utils/device';
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

export const useAirStore = create<AirState>((set, get) => ({
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
      if (!res || res.ok === false) throw new Error('ESP32 error');

      const air = res.data?.air ?? {};
      const fan = res.data?.fan ?? {};
      const time = res.data?.time ?? {};

      const airQualityState = (air.airQualityState as AirQualityState) ?? 'BUENA';
      const airQualityValue =
        typeof air.airQualityValue === 'number' ? air.airQualityValue : null;
      const fanPwm = typeof fan.fanPwm === 'number' ? fan.fanPwm : 0;

      set({
        airQualityValue,
        airQualityState,
        fanMode: (fan.fanMode as FanMode) ?? 'AUTO',
        fanPwm,
        lastUpdate: typeof time.millis === 'number' ? time.millis : Date.now(),
        loading: false,
        error: null,
      });

      // Guardar **SIEMPRE** mediciones
      if (airQualityValue !== null) {
        await supabase.from('measurements').insert({
          device_id: DEVICE_UUID,
          air_quality_value: airQualityValue,
          air_quality_state: airQualityState,
          fan_speed: fanPwm,
        });
      }

      // Evento crítico solo si MUY MALA
      if (airQualityState === 'MUY MALA') {
        await supabase.from('events').insert({
          device_id: DEVICE_UUID,
          event_type: 'ALARM',
          event_code: 'AIR_CRITICAL',
          description: 'Calidad de aire muy mala detectada',
          air_quality_value: airQualityValue,
          air_quality_state: airQualityState,
          severity: 5,
        });
      }
    } catch (e: any) {
      set({ loading: false, error: e.message ?? 'Error en fetchStatus' });
    }
  },

  setFanMode: (fanMode) => set({ fanMode }),
  setFanPwm: (fanPwm) => set({ fanPwm }),
  setFanSettings: (fanMode, fanPwm) =>
    set((s) => ({
      fanMode,
      fanPwm: typeof fanPwm === 'number' ? fanPwm : s.fanPwm,
    })),
}));
