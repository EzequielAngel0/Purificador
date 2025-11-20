// src/store/useDeviceStore.ts
import { create } from 'zustand';
import { espService, WifiNetwork } from '../services/espService';

export interface DeviceState {
  // Conexión al ESP32 (AP)
  ip: string;
  port: string;

  connected: boolean;
  connecting: boolean;
  lastPingAt: number | null;
  error: string | null;

  // Info STA del ESP32 (red con Internet)
  staConnected: boolean;
  staIp: string | null;
  staSsid: string | null;

  // Redes disponibles para STA
  wifiNetworks: WifiNetwork[];
  scanning: boolean;
  configuring: boolean;

  // Actions
  setIp: (ip: string) => void;
  setPort: (port: string) => void;
  clearError: () => void;

  testConnection: () => Promise<void>;
  scanNetworks: () => Promise<void>;
  configureSta: (ssid: string, password: string) => Promise<void>;
}

const DEFAULT_IP = '192.168.4.1';
const DEFAULT_PORT = '80';

export const useDeviceStore = create<DeviceState>((set, get) => ({
  ip: DEFAULT_IP,
  port: DEFAULT_PORT,

  connected: false,
  connecting: false,
  lastPingAt: null,
  error: null,

  staConnected: false,
  staIp: null,
  staSsid: null,

  wifiNetworks: [],
  scanning: false,
  configuring: false,

  setIp: (ip) => set({ ip }),
  setPort: (port) => set({ port }),
  clearError: () => set({ error: null }),

  testConnection: async () => {
    set({ connecting: true, error: null });

    try {
      const res = await espService.ping();

      if (!res || res.ok === false) {
        throw new Error('El dispositivo respondió con ok = false');
      }

      const net = res.data?.net ?? {};
      const staConnected = !!net.staConnected;
      const staIp = typeof net.staIp === 'string' ? net.staIp : null;
      const staSsid = typeof net.staSsid === 'string' ? net.staSsid : null;

      set({
        connected: true,
        connecting: false,
        lastPingAt: Date.now(),
        error: null,
        staConnected,
        staIp,
        staSsid,
      });
    } catch (e: any) {
      set({
        connected: false,
        connecting: false,
        error: e?.message ?? 'No se pudo conectar con el ESP32',
      });
    }
  },

  scanNetworks: async () => {
    set({ scanning: true, error: null });

    try {
      const res = await espService.getWifiNetworks();
      if (!res || res.ok === false) {
        throw new Error('Error al escanear redes Wi-Fi');
      }

      set({
        wifiNetworks: res.data ?? [],
        scanning: false,
      });
    } catch (e: any) {
      set({
        scanning: false,
        error: e?.message ?? 'No se pudieron escanear redes',
      });
    }
  },

  configureSta: async (ssid: string, password: string) => {
    if (!ssid || !password) {
      set({ error: 'SSID y contraseña son obligatorios' });
      return;
    }

    set({ configuring: true, error: null });

    try {
      const res = await espService.setWifiConfig({ ssid, password });
      if (!res || res.ok === false) {
        throw new Error('ESP32 respondió error al configurar STA');
      }

      const data = res.data ?? {};
      const staConnected = !!data.staConnected;
      const staIp =
        typeof data.staIp === 'string' && data.staIp.length > 0
          ? data.staIp
          : null;
      const staSsid =
        typeof data.staSsid === 'string' && data.staSsid.length > 0
          ? data.staSsid
          : null;

      set({
        configuring: false,
        staConnected,
        staIp,
        staSsid,
      });
    } catch (e: any) {
      set({
        configuring: false,
        error: e?.message ?? 'No se pudo configurar la red STA',
      });
    }
  },
}));
