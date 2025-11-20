// src/screens/HomeScreen.tsx
import React, { useEffect } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useAirStore } from '../store/useAirStore';
import { useDeviceStore } from '../store/useDeviceStore';
import {
  getAirQualityColor,
  getAirQualityLabel,
} from '../utils/helpers';
import NotificationBadge from '../components/NotificationBadge';
import LoadingSpinner from '../components/LoadingSpinner';
import AlertModal from '../components/AlertModal';

const HomeScreen: React.FC = () => {
  const {
    airQualityValue,
    airQualityState,
    lastUpdate,
    loading,
    error,
    fetchStatus,
  } = useAirStore();

  const { connected, connecting, testConnection } = useDeviceStore();

  useEffect(() => {
    if (!connected) return;

    fetchStatus();
    const id = setInterval(fetchStatus, 5000);
    return () => clearInterval(id);
  }, [connected, fetchStatus]);

  const aqiColor = getAirQualityColor(airQualityState);
  const aqiLabel = getAirQualityLabel(airQualityState);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.header}>Air Purifier</Text>

      {/* Estado de conexión */}
      <View style={styles.statusCard}>
        <Text style={styles.statusTitle}>
          {connected ? 'Device connected' : 'Device not connected'}
        </Text>
        <Text style={styles.statusSubtitle}>
          {connected
            ? 'ESP32 reachable over Wi-Fi.'
            : 'Conéctate al AP del ESP32 y prueba la conexión en Settings.'}
        </Text>
        <TouchableOpacity
          style={styles.smallButton}
          onPress={testConnection}
          disabled={connecting}
        >
          <Text style={styles.smallButtonText}>
            {connecting ? 'Testing...' : 'Test connection'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* AQI */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Air Quality Index</Text>
        <Text style={[styles.aqiValue, { color: aqiColor }]}>
          {airQualityValue ?? '--'}
        </Text>
        <Text style={styles.aqiLabel}>{aqiLabel}</Text>
        <NotificationBadge state={airQualityState} />

        {lastUpdate && (
          <Text style={styles.lastUpdate}>
            Last update: {new Date(lastUpdate).toLocaleTimeString()}
          </Text>
        )}
      </View>

      {/* Modos de ventilador (por ahora sólo UI, sin control aún) */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Fan mode</Text>
        <View style={styles.modeRow}>
          <TouchableOpacity style={styles.modeButton}>
            <Text style={styles.modeText}>AUTO</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.modeButton}>
            <Text style={styles.modeText}>MANUAL</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading && <LoadingSpinner />}

      <AlertModal
        visible={!!error}
        title="Error"
        message={error ?? ''}
        onConfirm={fetchStatus}
        onCancel={() => {}}
      />
    </ScrollView>
  );
};

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
    marginBottom: 16,
  },
  statusCard: {
    backgroundColor: '#020617',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e5e7eb',
  },
  statusSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: '#9ca3af',
  },
  smallButton: {
    marginTop: 12,
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#0ea5e9',
  },
  smallButtonText: {
    color: '#f9fafb',
    fontSize: 13,
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#020617',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e5e7eb',
    marginBottom: 8,
  },
  aqiValue: {
    fontSize: 40,
    fontWeight: '700',
    marginBottom: 4,
  },
  aqiLabel: {
    fontSize: 14,
    color: '#9ca3af',
    marginBottom: 8,
  },
  lastUpdate: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 8,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#1f2937',
    backgroundColor: '#020817',
  },
  modeText: {
    color: '#e5e7eb',
    fontSize: 14,
    fontWeight: '500',
  },
});

export default HomeScreen;
