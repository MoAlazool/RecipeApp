import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from '@rneui/themed';
import { Ionicons } from '@expo/vector-icons';

interface ServingAdjusterProps {
  servings: number;
  originalServings: number;
  onChange: (newServings: number) => void;
}

export function ServingAdjuster({
  servings,
  originalServings,
  onChange,
}: ServingAdjusterProps) {
  const decrease = () => {
    if (servings > 1) onChange(servings - 1);
  };

  const increase = () => {
    if (servings < 20) onChange(servings + 1);
  };

  const isScaled = servings !== originalServings;
  const scaleFactor = (servings / originalServings).toFixed(1).replace(/\.0$/, '');

  return (
    <View style={styles.container}>
      <View style={styles.leftSection}>
        <View style={styles.iconContainer}>
          <Ionicons name="people" size={18} color="#F2330D" />
        </View>
        <View>
          <Text style={styles.label}>Servings</Text>
          {isScaled && (
            <Text style={styles.originalLabel}>Original: {originalServings}</Text>
          )}
        </View>
      </View>

      <View style={styles.rightSection}>
        {isScaled && (
          <View style={styles.scaleBadge}>
            <Text style={styles.scaleBadgeText}>{scaleFactor}x</Text>
          </View>
        )}
        <View style={styles.controls}>
          <TouchableOpacity
            style={[styles.button, styles.buttonMinus]}
            onPress={decrease}
            disabled={servings <= 1}
            activeOpacity={0.7}
          >
            <Ionicons name="remove" size={20} color={servings <= 1 ? '#CCC' : '#666'} />
          </TouchableOpacity>

          <Text style={styles.value}>{servings}</Text>

          <TouchableOpacity
            style={[styles.button, styles.buttonPlus]}
            onPress={increase}
            disabled={servings >= 20}
            activeOpacity={0.7}
          >
            <Ionicons name="add" size={20} color={servings >= 20 ? '#CCC' : '#F2330D'} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8F6F5',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(242, 51, 13, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#1C100D',
  },
  originalLabel: {
    fontSize: 12,
    fontFamily: 'NotoSans_500Medium',
    color: '#9C5749',
    marginTop: 2,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  scaleBadge: {
    backgroundColor: 'rgba(242, 51, 13, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  scaleBadgeText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#F2330D',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  button: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonMinus: {
    borderColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
  },
  buttonPlus: {
    borderColor: 'rgba(242, 51, 13, 0.3)',
    backgroundColor: 'rgba(242, 51, 13, 0.08)',
  },
  value: {
    fontSize: 20,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#1C100D',
    minWidth: 32,
    textAlign: 'center',
  },
});
