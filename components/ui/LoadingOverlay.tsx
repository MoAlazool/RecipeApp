import React from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { Text } from '@rneui/themed';

interface LoadingOverlayProps {
  visible: boolean;
  message?: string | null;
}

export function LoadingOverlay({ visible, message }: LoadingOverlayProps) {
  if (!visible) return null;

  const showMessage = Boolean(message && message.trim().length > 0);

  return (
    <View style={styles.overlay} pointerEvents="auto">
      <View style={styles.container}>
        <ActivityIndicator size="small" color="#C66E4E" />
        {showMessage ? (
          <Text style={styles.message}>{message}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    paddingTop: 56,
    zIndex: 20,
  },
  container: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderWidth: 1,
    borderColor: 'rgba(26,21,16,0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },
  message: {
    fontSize: 13,
    color: '#4A3228',
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
});
