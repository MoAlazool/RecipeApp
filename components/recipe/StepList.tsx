import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from '@rneui/themed';
import { Ionicons } from '@expo/vector-icons';
import type { RecipeStep } from '@/utils/types';

interface StepListProps {
  steps: RecipeStep[];
}

export function StepList({ steps }: StepListProps) {
  return (
    <View style={styles.container}>
      {steps.filter(step => step.instruction).map((step, index) => (
        <View key={index} style={styles.step}>
          <View style={styles.stepNumber}>
            <Text style={styles.stepNumberText}>{step.step_number}</Text>
          </View>
          <View style={styles.stepContent}>
            <Text style={styles.instruction}>{step.instruction}</Text>

            <View style={styles.stepMeta}>
              {step.duration_minutes && (
                <View style={styles.metaItem}>
                  <Ionicons name="time-outline" size={14} color="#FF6B35" />
                  <Text style={styles.metaText}>{step.duration_minutes} min</Text>
                </View>
              )}
              {step.temperature && (
                <View style={styles.metaItem}>
                  <Ionicons name="thermometer-outline" size={14} color="#FF6B35" />
                  <Text style={styles.metaText}>{step.temperature}</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
  },
  step: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FF6B35',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  stepNumberText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  stepContent: {
    flex: 1,
  },
  instruction: {
    fontSize: 16,
    color: '#1A1A2E',
    lineHeight: 24,
  },
  stepMeta: {
    flexDirection: 'row',
    marginTop: 10,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: 10,
  },
  metaText: {
    marginLeft: 4,
    fontSize: 12,
    color: '#FF6B35',
    fontWeight: '600',
  },
});
