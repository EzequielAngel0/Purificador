// src/screens/HistoryScreen.tsx
import React, {
  useEffect,
  useState,
  useCallback,
  useRef,
} from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Animated,
  Easing,
} from 'react-native';
import { espService, EspEvent } from '../services/espService';

const HistoryScreen: React.FC = () => {
  const [events, setEvents] = useState<EspEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Animación de aparición de la lista
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const translateYAnim = useRef(new Animated.Value(12)).current;

  const runListAnimation = () => {
    opacityAnim.setValue(0);
    translateYAnim.setValue(12);

    Animated.parallel([
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(translateYAnim, {
        toValue: 0,
        duration: 260,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  };

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await espService.getEvents();

      if (!res || res.ok === false) {
        throw new Error('ESP32 respondió error en /api/events');
      }

      const list = Array.isArray(res.data) ? res.data : [];

      // Si la tabla aún no tiene air_quality_state, esto seguirá funcionando:
      // nos quedamos con todo y decidimos en app qué mostrar.
      const normalized: EspEvent[] = list.map((e) => ({
        ...e,
      }));

      setEvents(normalized);
      if (normalized.length > 0) {
        runListAnimation();
      }
    } catch (e: any) {
      setError(e?.message ?? 'No se pudo cargar el historial de eventos');
    } finally {
      setLoading(false);
    }
  }, [opacityAnim, translateYAnim]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadEvents();
    setRefreshing(false);
  };

  const formatTimestamp = (ev: EspEvent): string => {
    if (!ev.timestamp) return 'No timestamp';
    const d = new Date(ev.timestamp);
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;
  };

  const formatTitle = (ev: EspEvent): string => {
    const state = ev.air_quality_state;
    if (state === 'MUY MALA') return 'Very poor air quality';
    if (state === 'MALA') return 'Bad air quality';
    if (ev.event_type === 'ALARM') return 'Alarm';
    if (ev.event_type === 'WARNING') return 'Warning';
    return 'Info event';
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <Text style={styles.header}>History</Text>

      <Text style={styles.subtitle}>
        Eventos enviados por el ESP32 (por ejemplo, estados de aire mala / muy
        mala). Desliza hacia abajo para refrescar.
      </Text>

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {!loading && !error && events.length === 0 && (
        <Text style={styles.emptyText}>
          No hay eventos registrados todavía.
        </Text>
      )}

      <Animated.View
        style={{
          opacity: opacityAnim,
          transform: [{ translateY: translateYAnim }],
        }}
      >
        {events.map((ev) => {
          const title = formatTitle(ev);
          const tsLabel = formatTimestamp(ev);
          const aqi = ev.air_quality_value ?? null;
          const sev = ev.severity ?? null;

          return (
            <TouchableOpacity
              key={String(ev.id) + tsLabel}
              style={styles.eventCard}
              activeOpacity={0.85}
            >
              <View style={styles.eventHeaderRow}>
                <Text style={styles.eventTitle}>{title}</Text>
                {sev != null && (
                  <Text style={styles.severityText}>sev {sev}</Text>
                )}
              </View>

              <Text style={styles.eventTimestamp}>{tsLabel}</Text>

              {aqi != null && (
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>AQI value</Text>
                  <Text style={styles.rowValue}>{aqi}</Text>
                </View>
              )}

              {ev.fan_speed != null && (
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Fan speed (PWM)</Text>
                  <Text style={styles.rowValue}>{ev.fan_speed}</Text>
                </View>
              )}

              {ev.setpoint != null && (
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Setpoint</Text>
                  <Text style={styles.rowValue}>{ev.setpoint}</Text>
                </View>
              )}

              {ev.description && (
                <Text style={styles.description}>{ev.description}</Text>
              )}
            </TouchableOpacity>
          );
        })}
      </Animated.View>

      {loading && (
        <Text style={[styles.emptyText, { marginTop: 12 }]}>
          Cargando eventos...
        </Text>
      )}
    </ScrollView>
  );
};

export default HistoryScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020817',
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    fontSize: 22,
    fontWeight: '600',
    color: '#e5e7eb',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#9ca3af',
    marginBottom: 12,
  },
  errorBox: {
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#450a0a',
    marginBottom: 10,
  },
  errorText: {
    color: '#fecaca',
    fontSize: 12,
  },
  emptyText: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 12,
  },
  eventCard: {
    backgroundColor: '#020617',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  eventHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  eventTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#e5e7eb',
  },
  severityText: {
    fontSize: 11,
    color: '#9ca3af',
  },
  eventTimestamp: {
    marginTop: 4,
    fontSize: 11,
    color: '#9ca3af',
  },
  row: {
    marginTop: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rowLabel: {
    fontSize: 12,
    color: '#9ca3af',
  },
  rowValue: {
    fontSize: 12,
    color: '#e5e7eb',
    fontWeight: '500',
  },
  description: {
    marginTop: 8,
    fontSize: 12,
    color: '#d1d5db',
  },
});
