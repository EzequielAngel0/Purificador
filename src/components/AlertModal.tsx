// src/components/AlertModal.tsx
import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity } from 'react-native';

interface Props {
  visible: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const AlertModal: React.FC<Props> = ({
  visible,
  title,
  message,
  onConfirm,
  onCancel
}) => (
  <Modal transparent animationType="fade" visible={visible} onRequestClose={onCancel}>
    <View style={styles.backdrop}>
      <View style={styles.container}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>
        <View style={styles.actions}>
          <TouchableOpacity style={[styles.button, styles.cancel]} onPress={onCancel}>
            <Text>Cancelar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.button, styles.confirm]} onPress={onConfirm}>
            <Text style={styles.confirmText}>Confirmar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  </Modal>
);

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: '#00000088',
    alignItems: 'center',
    justifyContent: 'center'
  },
  container: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    width: '80%'
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8
  },
  message: {
    fontSize: 14,
    marginBottom: 16
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12
  },
  button: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8
  },
  cancel: {
    backgroundColor: '#E5E7EB'
  },
  confirm: {
    backgroundColor: '#3B82F6'
  },
  confirmText: {
    color: '#fff',
    fontWeight: '600'
  }
});

export default AlertModal;
