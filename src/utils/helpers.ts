// src/utils/helpers.ts

// Estados que devuelve el ESP32 en airQualityState
export type AirQualityState = 'BUENA' | 'MODERADA' | 'MALA' | 'MUY MALA' | null;

// Color para el texto / UI según estado
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
