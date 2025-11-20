// src/services/espService.ts
import { ESP } from '../utils/constants';

const API_BASE =
  ESP.port === 80 ? `${ESP.baseUrl}/api` : `${ESP.baseUrl}:${ESP.port}/api`;

async function request(path: string, options?: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    ESP.timeoutMs || 5000,
  );

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HTTP ${res.status}: ${text}`);
    }

    return res.json();
  } finally {
    clearTimeout(timeout);
  }
}

export interface WifiNetwork {
  ssid: string;
  rssi: number;
  secure: boolean;
}

export interface EspEvent {
  id?: number;
  device_id?: string;
  timestamp?: string;
  event_type?: string;
  event_code?: string | null;
  description?: string | null;
  air_quality_value?: number | null;
  air_quality_state?: string | null;
  severity?: number | null;
  fan_speed?: number | null;
  setpoint?: number | null;
}

export const espService = {
  ping() {
    return request('/ping');
  },

  getStatus() {
    return request('/status');
  },

  sendControl(body: {
    fanMode?: 'AUTO' | 'MANUAL';
    fanPwm?: number;
    setpoint?: number;
  }) {
    return request('/control', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  },

  getWifiNetworks(): Promise<{ ok: boolean; data: WifiNetwork[] }> {
    return request('/wifi-scan');
  },

  setWifiConfig(body: { ssid: string; password: string }) {
    return request('/wifi-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  },

  getEvents(): Promise<{ ok: boolean; data: EspEvent[] }> {
    return request('/events');
  },
};
