// src/screens/SettingsScreen.tsx
import React from 'react';
import {
  ScrollView,
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Switch,
} from 'react-native';

import { useDeviceStore } from '../store/useDeviceStore';
import NotificationBadge from '../components/NotificationBadge';

const SettingsScreen: React.FC = () => {
  const {
    ip,
    port,
    autoReconnect,
    connected,
    connecting,
    setIp,
    setPort,
    setAutoReconnect,
    testConnection,
  } = useDeviceStore();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.header}>Air Purifier</Text>

      {/* Estado del dispositivo ESP32 */}
      <View style={styles.statusCard}>
        <Text style={styles.statusTitle}>
          {connected ? 'ESP32 Connected' : 'ESP32 Not Connected'}
        </Text>
        <Text style={styles.statusSubtitle}>
          {connected
            ? 'Communication with ESP32 is active.'
            : 'Connect to ESP32 Wi-Fi first.'}
        </Text>
      </View>

      {/* Configuración de red */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>ESP32 Network</Text>

        <Text style={styles.label}>IP Address</Text>
        <TextInput
          style={styles.input}
          value={ip}
          onChangeText={setIp}
          placeholder="192.168.4.1"
          placeholderTextColor="#7c7f8a"
          keyboardType="numeric"
        />

        <Text style={styles.label}>Port</Text>
        <TextInput
          style={styles.input}
          value={port}
          onChangeText={setPort}
          placeholder="80"
          placeholderTextColor="#7c7f8a"
          keyboardType="numeric"
        />

        <TouchableOpacity
          style={[styles.button, connected && styles.buttonSecondary]}
          onPress={testConnection}
          disabled={connecting}
        >
          <Text style={styles.buttonText}>
            {connecting ? 'Testing...' : 'Test connection'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Auto reconnect */}
      <View style={styles.row}>
        <Text style={styles.rowLabel}>Auto reconnect</Text>
        <Switch
          value={autoReconnect}
          onValueChange={setAutoReconnect}
        />
      </View>
    </ScrollView>
  );
};

export default SettingsScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020817' },
  content: { padding: 16, paddingBottom: 32 },
  header: { fontSize: 22, fontWeight: '600', color: '#e5e7eb', marginBottom: 16 },

  statusCard: {
    backgroundColor: '#020617',
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1f2937',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  statusTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#e5e7eb',
  },
  statusSubtitle: { fontSize: 12, color: '#9ca3af', marginTop: 2 },

  card: {
    backgroundColor: '#020617',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1f2937',
    marginBottom: 16,
  },
  cardTitle: { color: '#e5e7eb', fontSize: 15, fontWeight: '600', marginBottom: 12 },
  label: { color: '#9ca3af', fontSize: 13, marginBottom: 4 },
  input: {
    backgroundColor: '#020817',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1f2937',
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#e5e7eb',
    fontSize: 14,
    marginBottom: 12,
  },
  button: {
    marginTop: 6,
    borderRadius: 999,
    paddingVertical: 10,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
  },
  buttonSecondary: {
    backgroundColor: '#1f2937',
  },
  buttonText: { color: '#f9fafb', fontWeight: '600', fontSize: 15 },

  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#1f2937',
    padding: 14,
    borderRadius: 16,
    marginBottom: 12,
  },
  rowLabel: { color: '#e5e7eb', fontSize: 15 },

  note: { color: '#6b7280', fontSize: 12, marginTop: 10, lineHeight: 18 },
  bold: { color: '#e5e7eb', fontWeight: '700' },
});
