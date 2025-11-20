// src/services/espService.ts
import { useDeviceStore } from '../store/useDeviceStore';

async function dynamicRequest(
  path: string,
  options?: RequestInit,
  timeoutMs = 5000,
) {
  const { ip, port } = useDeviceStore.getState();

  const baseUrl =
    port === '80'
      ? `http://${ip}/api`
      : `http://${ip}:${port}/api`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${baseUrl}${path}`, {
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

export const espService = {
  ping() {
    return dynamicRequest('/ping', undefined, 4000);
  },

  getStatus() {
    return dynamicRequest('/status');
  },

  controlFan({
    fanMode,
    fanPwm,
  }: {
    fanMode: 'AUTO' | 'MANUAL';
    fanPwm?: number;
  }) {
    return dynamicRequest('/control', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fanMode,
        ...(fanMode === 'MANUAL'
          ? { fanPwm: fanPwm ?? 0 }
          : {}),
      }),
    });
  },
};
