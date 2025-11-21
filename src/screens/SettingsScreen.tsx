// src/screens/SettingsScreen.tsx
import React, { useEffect, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import { useDeviceStore } from '../store/useDeviceStore';
import type { WifiNetwork } from '../services/espService';

const SettingsScreen: React.FC = () => {
  const {
    ip,
    port,
    connected,
    connecting,
    apIp,
    staConnected,
    staIp,
    staSsid,
    sensorReady,
    wifiNetworks,
    scanning,
    configuring,
    setIp,
    setPort,
    testConnection,
    scanNetworks,
    configureSta,
    error,
    clearError,
  } = useDeviceStore();

  const [selectedSsid, setSelectedSsid] = useState<string | null>(null);
  const [staPassword, setStaPassword] = useState('');

  // Auto-ping: mientras el sensor NO esté listo, intentamos ping cada 5 s.
  useEffect(() => {
    // Primer intento al abrir la pantalla
    testConnection().catch(() => {});

    let interval: ReturnType<typeof setInterval> | null = null;

    if (!sensorReady) {
      interval = setInterval(() => {
        testConnection().catch(() => {});
      }, 5000);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [sensorReady, testConnection]);

  const handleSelectNetwork = (item: WifiNetwork) => {
    setSelectedSsid(item.ssid);
    clearError();
  };

  const handleConnectSta = () => {
    if (!selectedSsid || !staPassword) return;
    configureSta(selectedSsid, staPassword);
  };

  const buttonDisabled = connecting || !sensorReady;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.header}>Estado de red</Text>

      {/* Estado general de red + sensor */}
      <View style={styles.card}>
        <Text style={styles.cardSubtitle}>
          El teléfono se conecta al AP del ESP32. El ESP32, por STA, se conecta
          a una red con Internet para enviar datos a Supabase.
        </Text>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>IP actual del AP (ESP32)</Text>
          <Text style={styles.infoValue}>{apIp ?? ip ?? 'Desconocida'}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>IP actual del STA (ESP32 → Wi-Fi)</Text>
          <Text style={styles.infoValue}>
            {staConnected && staIp ? staIp : 'No conectado'}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Estado AP</Text>
          <Text style={styles.infoValue}>
            {connected ? 'Conectado al ESP32' : 'No conectado al ESP32'}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Estado STA</Text>
          <Text style={styles.infoValue}>
            {staConnected
              ? `Conectado a ${staSsid ?? '(SSID desconocido)'}`
              : 'STA no conectado'}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Sensor MQ135</Text>
          <Text style={styles.infoValue}>
            {sensorReady
              ? 'Listo (ya está entregando lecturas)'
              : 'Calentando / sin lecturas estables'}
          </Text>
        </View>
      </View>

      {/* Configuración de la IP que usa la app para el AP */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Conexión al AP del ESP32 (App)</Text>

        <Text style={styles.label}>IP del ESP32 (AP) usada por la app</Text>
        <TextInput
          style={styles.input}
          value={ip}
          onChangeText={setIp}
          keyboardType="numeric"
          placeholder="192.168.4.1"
          placeholderTextColor="#7c7f8a"
        />

        <Text style={styles.label}>Puerto HTTP</Text>
        <TextInput
          style={styles.input}
          value={port}
          onChangeText={setPort}
          keyboardType="numeric"
          placeholder="80"
          placeholderTextColor="#7c7f8a"
        />

        {/* Botón para probar conexión (bloqueado mientras el sensor no está listo) */}
        <TouchableOpacity
          style={[
            styles.button,
            connected && styles.buttonConnected,
            buttonDisabled && styles.buttonDisabled,
          ]}
          onPress={testConnection}
          disabled={buttonDisabled}
        >
          <Text style={styles.buttonText}>
            {!sensorReady
              ? 'Esperando a que el sensor esté listo...'
              : connecting
              ? 'Probando...'
              : connected
              ? 'Re-probar conexión con ESP32'
              : 'Probar conexión con ESP32'}
          </Text>
        </TouchableOpacity>

        <Text style={styles.statusText}>
          AP: {connected ? 'Conectado' : 'No conectado'}
        </Text>
      </View>

      {/* Configuración STA */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Red STA del ESP32 (Internet)</Text>
        <Text style={styles.cardSubtitle}>
          Aquí configuras a qué Wi-Fi se conecta el ESP32 por STA para tener
          acceso a Internet.
        </Text>

        <TouchableOpacity
          style={[styles.button, scanning && styles.buttonDisabled]}
          onPress={scanNetworks}
          disabled={scanning}
        >
          <Text style={styles.buttonText}>
            {scanning ? 'Escaneando...' : 'Escanear redes Wi-Fi'}
          </Text>
        </TouchableOpacity>

        {wifiNetworks.length > 0 && (
          <View style={styles.networkListContainer}>
            <FlatList
              data={wifiNetworks}
              keyExtractor={(item) => item.ssid + String(item.rssi)}
              renderItem={({ item }) => {
                const isSelected = item.ssid === selectedSsid;
                return (
                  <TouchableOpacity
                    style={[
                      styles.networkItem,
                      isSelected && styles.networkItemSelected,
                    ]}
                    onPress={() => handleSelectNetwork(item)}
                  >
                    <View>
                      <Text
                        style={[
                          styles.networkSsid,
                          isSelected && styles.networkSsidSelected,
                        ]}
                      >
                        {item.ssid || '<Hidden SSID>'}
                      </Text>
                      <Text style={styles.networkMeta}>
                        {item.secure ? 'Segura' : 'Abierta'} · RSSI {item.rssi} dBm
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        )}

        <Text style={styles.label}>SSID seleccionado</Text>
        <TextInput
          style={[styles.input, !selectedSsid && styles.inputDisabled]}
          value={selectedSsid ?? ''}
          onChangeText={setSelectedSsid}
          placeholder="Selecciona una red de la lista"
          placeholderTextColor="#7c7f8a"
        />

        <Text style={styles.label}>Contraseña</Text>
        <TextInput
          style={styles.input}
          value={staPassword}
          onChangeText={setStaPassword}
          secureTextEntry
          placeholder="Contraseña Wi-Fi"
          placeholderTextColor="#7c7f8a"
        />

        <TouchableOpacity
          style={[
            styles.button,
            configuring && styles.buttonDisabled,
            (!selectedSsid || !staPassword) && styles.buttonDisabled,
          ]}
          onPress={handleConnectSta}
          disabled={configuring || !selectedSsid || !staPassword}
        >
          <Text style={styles.buttonText}>
            {configuring ? 'Conectando...' : 'Conectar ESP32 a Wi-Fi'}
          </Text>
        </TouchableOpacity>

        <Text style={styles.statusText}>
          {staConnected
            ? `STA: Conectado a ${staSsid ?? '(SSID desconocido)'}`
            : 'STA: No conectado'}
        </Text>
      </View>

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
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
  card: {
    backgroundColor: '#020617',
    borderRadius: 20,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#e5e7eb',
    marginBottom: 6,
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#9ca3af',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  infoLabel: {
    fontSize: 13,
    color: '#9ca3af',
  },
  infoValue: {
    fontSize: 13,
    color: '#e5e7eb',
  },
  label: {
    fontSize: 13,
    color: '#9ca3af',
    marginTop: 8,
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#020817',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1f2937',
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#e5e7eb',
    fontSize: 14,
  },
  inputDisabled: {
    opacity: 0.5,
  },
  button: {
    marginTop: 16,
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#0ea5e9',
  },
  buttonConnected: {
    backgroundColor: '#22c55e',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#f9fafb',
    fontSize: 14,
    fontWeight: '600',
  },
  statusText: {
    marginTop: 8,
    fontSize: 13,
    color: '#9ca3af',
  },
  networkListContainer: {
    marginTop: 12,
    maxHeight: 220,
  },
  networkItem: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1f2937',
    marginBottom: 6,
    backgroundColor: '#020817',
  },
  networkItemSelected: {
    borderColor: '#0ea5e9',
    backgroundColor: '#0b1120',
  },
  networkSsid: {
    color: '#e5e7eb',
    fontSize: 14,
  },
  networkSsidSelected: {
    fontWeight: '600',
  },
  networkMeta: {
    color: '#6b7280',
    fontSize: 12,
  },
  errorBox: {
    marginTop: 8,
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#450a0a',
  },
  errorText: {
    color: '#fecaca',
    fontSize: 12,
  },
});

export default SettingsScreen;
