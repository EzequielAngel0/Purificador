// src/store/useDeviceStore.ts
import { create } from 'zustand';
import { espService } from '../services/espService';

export interface DeviceState {
  ip: string;
  port: string;
  wifiPassword: string;

  autoReconnect: boolean;

  connected: boolean;
  connecting: boolean;
  lastPingAt: number | null;
  error: string | null;

  setIp: (ip: string) => void;
  setPort: (port: string) => void;
  setWifiPassword: (password: string) => void;
  setAutoReconnect: (value: boolean) => void;

  testConnection: () => Promise<void>;
}

const DEFAULT_IP = '192.168.4.1';
const DEFAULT_PORT = '80';
const DEFAULT_PASSWORD = '12345678';

export const useDeviceStore = create<DeviceState>((set, get) => ({
  ip: DEFAULT_IP,
  port: DEFAULT_PORT,
  wifiPassword: DEFAULT_PASSWORD,

  autoReconnect: false,

  connected: false,
  connecting: false,
  lastPingAt: null,
  error: null,

  setIp: (ip) => set({ ip }),
  setPort: (port) => set({ port }),
  setWifiPassword: (wifiPassword) => set({ wifiPassword }),
  setAutoReconnect: (autoReconnect) => set({ autoReconnect }),

  // Nota: espService por ahora sigue usando la IP fija 192.168.4.1:80.
  // Más adelante podemos hacer que use ip/port dinámicos si quieres.
  testConnection: async () => {
    set({ connecting: true, error: null });

    try {
      const res = await espService.ping();

      if (!res || res.ok === false) {
        throw new Error('El dispositivo respondió con ok = false');
      }

      set({
        connected: true,
        connecting: false,
        lastPingAt: Date.now(),
        error: null,
      });
    } catch (e: any) {
      set({
        connected: false,
        connecting: false,
        error: e?.message ?? 'No se pudo conectar con el ESP32',
      });
    }
  },
}));
