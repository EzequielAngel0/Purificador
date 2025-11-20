// src/screens/SettingsScreen.tsx
import React from 'react';
import {
  ScrollView,
  View,
  Text,
  TextInput,
  StyleSheet,
  Switch,
  TouchableOpacity,
} from 'react-native';
import { useDeviceStore } from '../store/useDeviceStore';

const SettingsScreen: React.FC = () => {
  const {
    ip,
    port,
    wifiPassword,
    autoReconnect,
    connected,
    connecting,
    setIp,
    setPort,
    setWifiPassword,
    setAutoReconnect,
    testConnection,
  } = useDeviceStore();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.header}>Air Purifier</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>ESP32 Access Point</Text>
        <Text style={styles.cardSubtitle}>
          Conéctate a la red Wi-Fi creada por el ESP32.
        </Text>

        <Text style={styles.label}>IP address</Text>
        <TextInput
          style={styles.input}
          value={ip}
          onChangeText={setIp}
          keyboardType="numeric"
          placeholder="192.168.4.1"
          placeholderTextColor="#7c7f8a"
        />

        <Text style={styles.label}>Port</Text>
        <TextInput
          style={styles.input}
          value={port}
          onChangeText={setPort}
          keyboardType="numeric"
          placeholder="80"
          placeholderTextColor="#7c7f8a"
        />

        <Text style={styles.label}>Wi-Fi password</Text>
        <TextInput
          style={styles.input}
          value={wifiPassword}
          onChangeText={setWifiPassword}
          secureTextEntry
          placeholder="12345678"
          placeholderTextColor="#7c7f8a"
        />

        <TouchableOpacity
          style={[styles.button, connected && styles.buttonSecondary]}
          onPress={testConnection}
          disabled={connecting}
        >
          <Text style={styles.buttonText}>
            {connecting
              ? 'Testing...'
              : connected
              ? 'Re-test connection'
              : 'Test connection'}
          </Text>
        </TouchableOpacity>

        <Text style={styles.statusText}>
          {connected ? 'Status: Connected' : 'Status: Not connected'}
        </Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.rowLabel}>Auto reconnect</Text>
        <Switch
          value={autoReconnect}
          onValueChange={setAutoReconnect}
        />
      </View>

      <Text style={styles.note}>
        Nota: la app no puede cambiar automáticamente la red Wi-Fi del
        teléfono. Sigue siendo necesario conectarse al AP del ESP32 desde los
        ajustes de Wi-Fi del sistema, usando estos datos.
      </Text>
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
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#9ca3af',
    marginTop: 4,
    marginBottom: 12,
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
  button: {
    marginTop: 16,
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#0ea5e9',
  },
  buttonSecondary: {
    backgroundColor: '#1f2937',
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
  row: {
    marginTop: 8,
    padding: 16,
    borderRadius: 20,
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#1f2937',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowLabel: {
    fontSize: 15,
    color: '#e5e7eb',
  },
  note: {
    marginTop: 12,
    fontSize: 12,
    color: '#6b7280',
  },
});

export default SettingsScreen;
