// src/screens/HomeScreen.tsx
import React, { useEffect, useRef, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Animated,
  Easing,
  Vibration,
} from 'react-native';

import Slider from '@react-native-community/slider';

import { useAirStore, FanMode } from '../store/useAirStore';
import { useDeviceStore } from '../store/useDeviceStore';
import {
  AirQualityState,
  getAirQualityColor,
  getAirQualityLabel,
  getAirQualityBackgroundColor,
  getAirQualityBorderColor,
} from '../utils/helpers';

import NotificationBadge from '../components/NotificationBadge';
import LoadingSpinner from '../components/LoadingSpinner';
import AlertModal from '../components/AlertModal';
import { espService } from '../services/espService';

const MAX_PWM = 255;

const HomeScreen: React.FC = () => {
  const {
    airQualityValue,
    airQualityState,
    lastUpdate,
    loading,
    error,
    fanMode,
    fanPwm,
    lastManualPwm,
    fanSetpoint,
    fetchStatus,
    setFanMode,
    setFanPwm,
    setLastManualPwm,
    setFanSetpoint,
  } = useAirStore();

  const { connected } = useDeviceStore();

  // Slider lógico 0–100 (se mapea linealmente a 0–255 PWM)
  const [manualSlider, setManualSlider] = useState(0);
  const [localSetpoint, setLocalSetpoint] = useState(fanSetpoint);
  const [sending, setSending] = useState(false);

  const isAuto = fanMode === 'AUTO';
  const isManual = fanMode === 'MANUAL';

  const aqiTextColor = getAirQualityColor(airQualityState);
  const aqiBgColor = getAirQualityBackgroundColor(airQualityState);
  const aqiBorderColor = getAirQualityBorderColor(airQualityState);
  const aqiLabel = getAirQualityLabel(airQualityState);

  const currentFanPercent = Math.round((fanPwm / MAX_PWM) * 100);

  // Rango del setpoint (ajusta según tu lógica en el ESP32)
  const SETPOINT_MIN = 0;
  const SETPOINT_MAX = 1000;

  // Animación del ventilador
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const loopRef = useRef<Animated.CompositeAnimation | null>(null);
  const prevAirState = useRef<AirQualityState | null>(null);

  // Sincronizar slider de PWM lógico si cambia desde API
  useEffect(() => {
    if (fanPwm > 0) {
      const percent = Math.round((fanPwm / MAX_PWM) * 100);
      setManualSlider(percent);
    } else {
      setManualSlider(0);
    }
  }, [fanPwm]);

  // Sincronizar slider de setpoint si cambia desde store/API
  useEffect(() => {
    setLocalSetpoint(fanSetpoint);
  }, [fanSetpoint]);

  // POLLING SIEMPRE QUE HAYA CONEXIÓN (AUTO o MANUAL)
  useEffect(() => {
    if (!connected) return;

    fetchStatus();
    const id = setInterval(fetchStatus, 4500);

    return () => clearInterval(id);
  }, [connected, fetchStatus]);

  // Vibración cuando pasa a MUY MALA
  useEffect(() => {
    if (prevAirState.current !== 'MUY MALA' && airQualityState === 'MUY MALA') {
      Vibration.vibrate([0, 400, 400, 400], false);
    }
    prevAirState.current = airQualityState;
  }, [airQualityState]);

  // Velocidad de giro según velocidad real (fanPwm)
  useEffect(() => {
    const speedPercent = Math.max(0, Math.min(100, currentFanPercent));

    if (speedPercent <= 0) {
      loopRef.current?.stop();
      rotateAnim.setValue(0);
      return;
    }

    const minDuration = 800;  // rápido
    const maxDuration = 8000; // lento

    const duration =
      maxDuration - ((maxDuration - minDuration) * speedPercent) / 100;

    rotateAnim.setValue(0);
    loopRef.current?.stop();

    loopRef.current = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );

    loopRef.current.start();

    return () => {
      loopRef.current?.stop();
    };
  }, [currentFanPercent, rotateAnim]);

  const fanSpin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const ensureConnected = () => {
    if (!connected) {
      Alert.alert(
        'Sin conexión',
        'Conéctate al AP del ESP32 para controlar el ventilador.',
      );
      return false;
    }
    return true;
  };

  // Cambio de modo AUTO/MANUAL
  const handleMode = async (mode: FanMode) => {
    if (!ensureConnected()) return;

    try {
      setSending(true);

      if (mode === 'MANUAL') {
        // Al entrar a MANUAL usamos:
        // 1) último PWM manual si existe
        // 2) si no, el PWM actual
        // 3) si tampoco, 0
        let targetPwm: number;

        if (lastManualPwm > 0) {
          targetPwm = lastManualPwm;
        } else if (fanPwm > 0) {
          targetPwm = fanPwm;
        } else {
          targetPwm = 0;
        }

        targetPwm = Math.max(0, Math.min(targetPwm, MAX_PWM));

        setFanMode('MANUAL');
        setFanPwm(targetPwm);
        setLastManualPwm(targetPwm);
        setManualSlider(
          Math.round((targetPwm / MAX_PWM) * 100),
        );

        await useDeviceStore.getState().testConnection();
        await espService.sendControl({
          fanMode: 'MANUAL',
          fanPwm: targetPwm,
        });
      } else {
        // AUTO: el ESP32 se regula según el setpoint actual (firmware)
        setFanMode('AUTO');

        await useDeviceStore.getState().testConnection();
        await espService.sendControl({
          fanMode: 'AUTO',
          setpoint: fanSetpoint,
        });
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'No se pudo cambiar el modo');
    } finally {
      setSending(false);
    }
  };

  // Slider PWM (velocidad) – solo MANUAL
  const handlePwmChange = (value: number) => {
    setManualSlider(value);
  };

  const handlePwmCommit = async (value: number) => {
    if (!ensureConnected()) return;

    const pwm = Math.round((value / 100) * MAX_PWM);
    setFanPwm(pwm);
    setLastManualPwm(pwm);

    try {
      setSending(true);
      await espService.sendControl({
        fanMode: 'MANUAL',
        fanPwm: pwm,
      });
    } catch (e: any) {
      Alert.alert(
        'Error al ajustar velocidad',
        e?.message ?? 'No se pudo enviar la velocidad',
      );
    } finally {
      setSending(false);
    }
  };

  // Slider SETPOINT – solo MANUAL
  const handleSetpointChange = (value: number) => {
    setLocalSetpoint(value);
  };

  const handleSetpointCommit = async (value: number) => {
    if (!ensureConnected()) return;

    const sp = Math.round(value);
    setFanSetpoint(sp);

    try {
      setSending(true);
      await espService.sendControl({
        fanMode,
        fanPwm,
        setpoint: sp,
      });
    } catch (e: any) {
      Alert.alert(
        'Error al ajustar setpoint',
        e?.message ?? 'No se pudo enviar el setpoint',
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.header}>Purificador de Aire</Text>

      {airQualityState === 'MUY MALA' && (
        <View style={styles.alarmBanner}>
          <Text style={styles.alarmTitle}>Alerta: calidad del aire muy mala</Text>
          <Text style={styles.alarmText}>
            Revisa el entorno y ventila el espacio.
          </Text>
        </View>
      )}

      {/* Estado de conexión */}
      <View style={styles.statusCard}>
        <NotificationBadge state={connected ? 'BUENA' : null} />
        <Text style={styles.statusTitle}>
          {connected ? 'Dispositivo conectado' : 'Dispositivo no conectado'}
        </Text>
      </View>

      {/* Tarjeta de calidad del aire */}
      <View
        style={[
          styles.card,
          { backgroundColor: aqiBgColor, borderColor: aqiBorderColor },
        ]}
      >
        <Text style={styles.cardTitle}>Calidad del aire</Text>
        <Text style={[styles.aqiValue, { color: aqiTextColor }]}>
          {airQualityValue !== null ? `${airQualityValue} AQI` : '--'}
        </Text>
        <Text style={styles.aqiLabel}>{aqiLabel}</Text>

        {lastUpdate && (
          <Text style={styles.lastUpdate}>
            Última actualización: {new Date(lastUpdate).toLocaleTimeString()}
          </Text>
        )}
      </View>

      {/* Control del ventilador */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Ventilador</Text>

        <Text style={styles.currentSpeedText}>
          Velocidad actual: {currentFanPercent}%
        </Text>

        <View style={styles.fanImageWrapper}>
          <Animated.Image
            source={require('../assets/fan.png')}
            style={[styles.fanImage, { transform: [{ rotate: fanSpin }] }]}
            resizeMode="contain"
          />
        </View>

        {/* Selector de modo */}
        <View style={styles.segmentContainer}>
          <TouchableOpacity
            onPress={() => handleMode('AUTO')}
            style={[styles.segmentButton, isAuto && styles.segmentActive]}
          >
            <Text
              style={[styles.segmentText, isAuto && styles.segmentTextActive]}
            >
              AUTO
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => handleMode('MANUAL')}
            style={[styles.segmentButton, isManual && styles.segmentActive]}
          >
            <Text
              style={[styles.segmentText, isManual && styles.segmentTextActive]}
            >
              MANUAL
            </Text>
          </TouchableOpacity>
        </View>

        {/* Sliders solo en modo MANUAL */}
        {isManual && (
          <>
            {/* Slider de SETPOINT */}
            <View style={styles.sliderBlock}>
              <View style={styles.sliderHeader}>
                <Text style={styles.sliderLabel}>Setpoint</Text>
                <Text style={styles.sliderPercent}>{localSetpoint}</Text>
              </View>
              <Slider
                minimumValue={SETPOINT_MIN}
                maximumValue={SETPOINT_MAX}
                step={10}
                value={localSetpoint}
                onValueChange={handleSetpointChange}
                onSlidingComplete={handleSetpointCommit}
                minimumTrackTintColor="#22c55e"
                maximumTrackTintColor="#1f2937"
                thumbTintColor="#22c55e"
              />
            </View>

            {/* Slider de VELOCIDAD */}
            <View style={styles.sliderBlock}>
              <View style={styles.sliderHeader}>
                <Text style={styles.sliderLabel}>Velocidad del ventilador</Text>
                <Text style={styles.sliderPercent}>
                  {manualSlider}%
                </Text>
              </View>

              <Slider
                minimumValue={0}
                maximumValue={100}
                step={1}
                value={manualSlider}
                onValueChange={handlePwmChange}
                onSlidingComplete={handlePwmCommit}
                minimumTrackTintColor="#3b82f6"
                maximumTrackTintColor="#1f2937"
                thumbTintColor="#3b82f6"
              />
            </View>
          </>
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
  alarmBanner: {
    backgroundColor: '#7F1D1D',
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F87171',
  },
  alarmTitle: {
    color: '#FEE2E2',
    fontWeight: '700',
    marginBottom: 4,
    fontSize: 14,
  },
  alarmText: {
    color: '#FECACA',
    fontSize: 12,
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
    fontSize: 36,
    fontWeight: '700',
    marginBottom: 4,
  },
  aqiLabel: {
    fontSize: 14,
    color: '#e5e7eb',
  },
  lastUpdate: {
    fontSize: 11,
    color: '#d1d5db',
    marginTop: 10,
  },
  currentSpeedText: {
    color: '#9ca3af',
    marginBottom: 8,
    fontSize: 13,
  },
  fanImageWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
  },
  fanImage: {
    width: 160,
    height: 160,
  },
  segmentContainer: {
    flexDirection: 'row',
    borderRadius: 12,
    backgroundColor: '#111827',
    padding: 4,
    marginTop: 4,
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
