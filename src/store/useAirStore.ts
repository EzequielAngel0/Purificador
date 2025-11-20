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

  // Última velocidad manual recordada
  lastManualPwm: number;

  // Setpoint actual (ej. 0–1000, default 500)
  fanSetpoint: number;

  loading: boolean;
  error: string | null;

  fetchStatus: () => Promise<void>;
  setFanMode: (mode: FanMode) => void;
  setFanPwm: (pwm: number) => void;
  setFanSettings: (mode: FanMode, pwm?: number) => void;

  setLastManualPwm: (pwm: number) => void;
  setFanSetpoint: (value: number) => void;
}

export const useAirStore = create<AirState>((set, get) => ({
  airQualityValue: null,
  airQualityState: 'BUENA',
  lastUpdate: null,

  fanMode: 'AUTO',
  fanPwm: 0,
  lastManualPwm: 0,

  // valor por defecto de setpoint (se alinea con el .ino: THRESHOLD_MODERATE = 500)
  fanSetpoint: 500,

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

      const currentState = get();

      const airQualityState =
        (air.airQualityState as AirQualityState) ?? currentState.airQualityState ?? 'BUENA';

      const airQualityValue =
        typeof air.airQualityValue === 'number'
          ? air.airQualityValue
          : currentState.airQualityValue;

      // IMPORTANTE: aquí usamos las claves que realmente manda el ESP32:
      // fan["mode"], fan["pwm"], fan["setpoint"]
      const fanModeFromApi =
        (fan.mode as FanMode) === 'AUTO' || (fan.mode as FanMode) === 'MANUAL'
          ? (fan.mode as FanMode)
          : currentState.fanMode;

      const fanPwmFromApi =
        typeof fan.pwm === 'number'
          ? fan.pwm
          : currentState.fanPwm;

      const fanSetpointFromApi =
        typeof fan.setpoint === 'number'
          ? fan.setpoint
          : currentState.fanSetpoint ?? 500;

      const prevLastManual = currentState.lastManualPwm;

      set({
        airQualityValue,
        airQualityState,
        fanMode: fanModeFromApi,
        fanPwm: fanPwmFromApi,
        lastManualPwm:
          fanModeFromApi === 'MANUAL' ? fanPwmFromApi : prevLastManual,
        fanSetpoint: fanSetpointFromApi,
        lastUpdate:
          typeof time.millis === 'number'
            ? time.millis
            : currentState.lastUpdate ?? Date.now(),
        loading: false,
        error: null,
      });

      // Guardar SIEMPRE mediciones
      if (airQualityValue !== null) {
        await supabase.from('measurements').insert({
          device_id: DEVICE_UUID,
          air_quality_value: airQualityValue,
          air_quality_state: airQualityState,
          fan_speed: fanPwmFromApi,
        });
      }

      // Evento crítico solo si MUY MALA (desde la app)
      if (airQualityState === 'MUY MALA') {
        await supabase.from('events').insert({
          device_id: DEVICE_UUID,
          event_type: 'ALARM',
          event_code: 'AIR_CRITICAL',
          description: 'Calidad de aire muy mala detectada (app)',
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

  setFanPwm: (fanPwm) =>
    set((state) => ({
      fanPwm,
      lastManualPwm: state.fanMode === 'MANUAL' ? fanPwm : state.lastManualPwm,
    })),

  setFanSettings: (fanMode, fanPwm) =>
    set((state) => ({
      fanMode,
      fanPwm: typeof fanPwm === 'number' ? fanPwm : state.fanPwm,
      lastManualPwm:
        fanMode === 'MANUAL' && typeof fanPwm === 'number'
          ? fanPwm
          : state.lastManualPwm,
    })),

  setLastManualPwm: (pwm: number) => set({ lastManualPwm: pwm }),

  setFanSetpoint: (value: number) => set({ fanSetpoint: value }),
}));
