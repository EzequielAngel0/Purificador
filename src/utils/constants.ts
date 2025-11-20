// src/utils/constants.ts

// Configuración del ESP32 en modo AP
export const ESP = {
    // IP por defecto del AP del ESP32
    baseUrl: 'http://192.168.4.1',
    // Nuestro sketch usa puerto 80
    port: 80,
    // Timeout para peticiones HTTP desde la app (ms)
    timeoutMs: 5000,
  };
  
  // Si más adelante usas Supabase, puedes rellenar estos valores.
  // Por ahora quedan como placeholders para que TypeScript no falle.
  export const SUPABASE = {
    url: '',
    anonKey: '',
  };
  