// src/components/NotificationBadge.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { getAirQualityColor, AirQualityState } from '../utils/helpers';

interface Props {
  state: AirQualityState;
}

const NotificationBadge: React.FC<Props> = ({ state }) => {
  const color = getAirQualityColor(state);

  return (
    <View style={[styles.container, { backgroundColor: color }]}>
      <Text style={styles.text}>Calidad del aire: {state}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignSelf: 'flex-start'
  },
  text: {
    color: '#fff',
    fontWeight: '600'
  }
});

export default NotificationBadge;
