// src/components/LoadingSpinner.tsx
import React from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';

const LoadingSpinner: React.FC = () => (
  <View style={styles.container}>
    <ActivityIndicator size="large" />
  </View>
);

const styles = StyleSheet.create({
  container: {
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center'
  }
});

export default LoadingSpinner;
