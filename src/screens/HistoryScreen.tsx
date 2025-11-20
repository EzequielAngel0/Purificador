// src/screens/HistoryScreen.tsx
import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';

const HistoryScreen: React.FC = () => {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <Text style={styles.title}>Air Quality</Text>
      <Text style={styles.subtitle}>History view (pendiente de conectar a Supabase)</Text>
      {/* Aquí va tu chart */}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
  },
  contentContainer: {
    padding: 16,
  },
  title: {
    color: '#E5E7EB',
    fontSize: 22,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    color: '#9CA3AF',
    fontSize: 14,
    textAlign: 'center',
  },
});

export default HistoryScreen;
