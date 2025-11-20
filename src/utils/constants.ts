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
    url: 'https://ztjtczlwjbxtxdgbpoub.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0anRjemx3amJ4dHhkZ2Jwb3ViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM1MzY3ODAsImV4cCI6MjA3OTExMjc4MH0.hh8QPr0mZT5MMSToj6Dbf-u81M3i28ciEde4Ok4WChk',
  };
  