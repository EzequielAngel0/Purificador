// src/utils/helpers.ts

// Estados que devuelve el ESP32 en airQualityState
export type AirQualityState = 'BUENA' | 'MODERADA' | 'MALA' | 'MUY MALA' | null;

// Color principal (texto / iconos) según estado
export const getAirQualityColor = (state: AirQualityState): string => {
  switch (state) {
    case 'BUENA':
      return '#22C55E'; // verde
    case 'MODERADA':
      return '#FACC15'; // amarillo
    case 'MALA':
      return '#F97316'; // naranja
    case 'MUY MALA':
      return '#EF4444'; // rojo
    default:
      return '#9CA3AF'; // gris
  }
};

// Fondo del card según estado
export const getAirQualityBackgroundColor = (state: AirQualityState): string => {
  switch (state) {
    case 'BUENA':
      return '#064E3B'; // verde oscuro
    case 'MODERADA':
      return '#4B4704'; // amarillo oscuro
    case 'MALA':
      return '#7C2D12'; // naranja oscuro
    case 'MUY MALA':
      return '#701A1A'; // rojo oscuro
    default:
      return '#020617'; // fondo base dark
  }
};

// Borde del card según estado
export const getAirQualityBorderColor = (state: AirQualityState): string => {
  switch (state) {
    case 'BUENA':
      return '#10B981';
    case 'MODERADA':
      return '#FACC15';
    case 'MALA':
      return '#FB923C';
    case 'MUY MALA':
      return '#EF4444';
    default:
      return '#1F2937';
  }
};

// Label legible para la tarjeta principal
export const getAirQualityLabel = (state: AirQualityState): string => {
  switch (state) {
    case 'BUENA':
      return 'Buena calidad de aire';
    case 'MODERADA':
      return 'Calidad moderada';
    case 'MALA':
      return 'Mala calidad de aire';
    case 'MUY MALA':
      return 'Muy mala calidad de aire';
    default:
      return 'Sin datos';
  }
};
