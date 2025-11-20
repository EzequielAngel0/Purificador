// src/screens/HomeScreen.tsx
import React, { useEffect, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';

import Slider from '@react-native-community/slider';

import { useAirStore, FanMode } from '../store/useAirStore';
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
    fanMode,
    fanPwm,
    fetchStatus,
    setFanMode,
    setFanPwm,
  } = useAirStore();

  const { connected } = useDeviceStore();

  const [localPwm, setLocalPwm] = useState(fanPwm);
  const [sending, setSending] = useState(false);

  const isAuto = fanMode === 'AUTO';
  const isManual = fanMode === 'MANUAL';

  const aqiColor = getAirQualityColor(airQualityState);
  const aqiLabel = getAirQualityLabel(airQualityState);

  const pwmPercent = Math.round((localPwm / 255) * 100);

  /** Sincronizar slider si cambia desde API */
  useEffect(() => {
    setLocalPwm(fanPwm);
  }, [fanPwm]);

  /** Polling solo si AUTO */
  useEffect(() => {
    if (!connected || !isAuto) return;

    fetchStatus();
    const id = setInterval(fetchStatus, 4500);

    return () => clearInterval(id);
  }, [connected, isAuto, fetchStatus]);

  const ensureConnected = () => {
    if (!connected) {
      Alert.alert(
        'Sin conexión',
        'Conéctate al AP del ESP32 para controlar el ventilador.'
      );
      return false;
    }
    return true;
  };

  /** Cambio de modo AUTO/MANUAL */
  const handleMode = async (mode: FanMode) => {
    if (!ensureConnected()) return;

    setFanMode(mode);

    try {
      setSending(true);
      await useDeviceStore
        .getState()
        .testConnection(); // fuerza actualización de estado conexión

      await import('../services/espService')
        .then((m) => m.espService.controlFan({ fanMode: mode }));
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'No se pudo cambiar el modo');
    } finally {
      setSending(false);
    }
  };

  /** Mientras mueve slider */
  const handlePwmChange = (value: number) => {
    setLocalPwm(value);
  };

  /** Cuando suelta slider */
  const handlePwmCommit = async (value: number) => {
    if (!ensureConnected()) return;

    const pwm = Math.round(value);
    setFanPwm(pwm);

    try {
      setSending(true);
      await import('../services/espService')
        .then((m) =>
          m.espService.controlFan({
            fanMode: 'MANUAL',
            fanPwm: pwm,
          })
        );
    } catch (e: any) {
      Alert.alert(
        'Error al ajustar velocidad',
        e?.message ?? 'No se pudo enviar PWM'
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.header}>Air Purifier</Text>

      {/* Estado de conexión */}
      <View style={styles.statusCard}>
        <NotificationBadge
          state={connected ? 'BUENA' : null}
        />
        <Text style={styles.statusTitle}>
          {connected ? 'Device connected' : 'Device not connected'}
        </Text>
      </View>

      {/* Tarjeta de calidad del aire */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Air Quality Index</Text>
        <Text style={[styles.aqiValue, { color: aqiColor }]}>
          {airQualityValue ?? '--'}
        </Text>
        <Text style={styles.aqiLabel}>{aqiLabel}</Text>

        {lastUpdate && (
          <Text style={styles.lastUpdate}>
            Last update: {new Date(lastUpdate).toLocaleTimeString()}
          </Text>
        )}
      </View>

      {/* Control del ventilador */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Fan mode</Text>

        {connected && (
          <Text style={{ color: '#9ca3af', marginBottom: 6 }}>
            Current Speed: {fanPwm} / 255 ({Math.round((fanPwm / 255) * 100)}%)
          </Text>
        )}
        {/* Segmented Switch */}
        <View style={styles.segmentContainer}>
          <TouchableOpacity
            onPress={() => handleMode('AUTO')}
            style={[
              styles.segmentButton,
              isAuto && styles.segmentActive,
            ]}
          >
            <Text
              style={[
                styles.segmentText,
                isAuto && styles.segmentTextActive,
              ]}
            >
              AUTO
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => handleMode('MANUAL')}
            style={[
              styles.segmentButton,
              isManual && styles.segmentActive,
            ]}
          >
            <Text
              style={[
                styles.segmentText,
                isManual && styles.segmentTextActive,
              ]}
            >
              MANUAL
            </Text>
          </TouchableOpacity>
        </View>

        {isManual && (
          <View style={styles.sliderBlock}>
            <View style={styles.sliderHeader}>
              <Text style={styles.sliderLabel}>Fan Speed</Text>
              <Text style={styles.sliderPercent}>{pwmPercent}%</Text>
            </View>

            <Slider
              minimumValue={0}
              maximumValue={255}
              step={1}
              value={localPwm}
              onValueChange={handlePwmChange}
              onSlidingComplete={handlePwmCommit}
              minimumTrackTintColor="#3b82f6"
              maximumTrackTintColor="#1f2937"
              thumbTintColor="#3b82f6"
            />
          </View>
        )}
      </View>

      {(loading || sending) && (
        <View style={{ marginTop: 12 }}>
          <LoadingSpinner />
        </View>
      )}

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

export default HomeScreen;

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
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1f2937',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusTitle: {
    fontSize: 14,
    color: '#9ca3af',
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
    fontSize: 48,
    fontWeight: '700',
    marginBottom: 4,
  },
  aqiLabel: {
    fontSize: 14,
    color: '#9ca3af',
  },
  lastUpdate: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 10,
  },
  segmentContainer: {
    flexDirection: 'row',
    borderRadius: 12,
    backgroundColor: '#111827',
    padding: 4,
    marginTop: 10,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  segmentActive: {
    backgroundColor: '#3b82f6',
  },
  segmentText: {
    color: '#9ca3af',
    fontSize: 14,
    fontWeight: '600',
  },
  segmentTextActive: {
    color: '#f9fafb',
  },
  sliderBlock: {
    marginTop: 16,
  },
  sliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  sliderLabel: {
    color: '#9ca3af',
  },
  sliderPercent: {
    color: '#e5e7eb',
    fontWeight: '600',
  },
});
