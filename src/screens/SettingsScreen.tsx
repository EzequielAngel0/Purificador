// src/screens/SettingsScreen.tsx
import React, { useState } from 'react';
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
    staConnected,
    staIp,
    staSsid,
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

  const handleSelectNetwork = (item: WifiNetwork) => {
    setSelectedSsid(item.ssid);
    clearError();
  };

  const handleConnectSta = () => {
    if (!selectedSsid || !staPassword) return;
    configureSta(selectedSsid, staPassword);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.header}>Air Purifier</Text>

      {/* Card: Conexión al ESP32 (AP) */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>ESP32 Access Point</Text>
        <Text style={styles.cardSubtitle}>
          Conéctate a la red Wi-Fi creada por el ESP32 (AP) para controlar el
          purificador.
        </Text>

        <Text style={styles.label}>IP address (AP)</Text>
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

        <TouchableOpacity
          style={[
            styles.button,
            connected && styles.buttonSecondary,
            connecting && styles.buttonDisabled,
          ]}
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
          {connected ? 'Status: Connected to ESP32 (AP)' : 'Status: Not connected'}
        </Text>
      </View>

      {/* Card: Configuración STA del ESP32 */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Wi-Fi (STA) for Internet</Text>
        <Text style={styles.cardSubtitle}>
          El ESP32 se conectará a esta red para enviar alertas a Supabase.
        </Text>

        <TouchableOpacity
          style={[styles.button, scanning && styles.buttonDisabled]}
          onPress={scanNetworks}
          disabled={scanning}
        >
          <Text style={styles.buttonText}>
            {scanning ? 'Scanning...' : 'Scan networks'}
          </Text>
        </TouchableOpacity>

        {wifiNetworks.length > 0 && (
          <View style={styles.networkListContainer}>
            <Text style={styles.sectionTitle}>Available networks</Text>
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
                        {item.secure ? 'Secure' : 'Open'} · RSSI {item.rssi} dBm
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        )}

        <Text style={styles.label}>Selected SSID</Text>
        <TextInput
          style={[styles.input, !selectedSsid && styles.inputDisabled]}
          value={selectedSsid ?? ''}
          onChangeText={setSelectedSsid}
          placeholder="Select a network from the list"
          placeholderTextColor="#7c7f8a"
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          value={staPassword}
          onChangeText={setStaPassword}
          secureTextEntry
          placeholder="Wi-Fi password"
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
            {configuring ? 'Connecting...' : 'Connect ESP32 to Wi-Fi'}
          </Text>
        </TouchableOpacity>

        <Text style={styles.statusText}>
          {staConnected
            ? `STA: Connected to ${staSsid ?? '(unknown)'} (${staIp ?? ''})`
            : 'STA: Not connected'}
        </Text>
      </View>

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <Text style={styles.note}>
        Nota: el teléfono debe conectarse por Wi-Fi al AP del ESP32 (ESP32_AIR).
        El ESP32, a su vez, se conecta a otra red (STA) para acceder a Internet
        y enviar/leer eventos desde Supabase.
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
  buttonSecondary: {
    backgroundColor: '#1f2937',
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
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#e5e7eb',
    marginBottom: 4,
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
  note: {
    marginTop: 12,
    fontSize: 12,
    color: '#6b7280',
  },
});

export default SettingsScreen;
