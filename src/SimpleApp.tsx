// src/SimpleApp.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const SimpleApp: React.FC = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>SimpleApp: si ves esto, el bundle está OK</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: '#E5E7EB',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 16,
  },
});

export default SimpleApp;
