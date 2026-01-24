import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from '@rneui/themed';
import { Ionicons } from '@expo/vector-icons';
import type { Ingredient } from '@/utils/types';

interface IngredientListProps {
  ingredients: Ingredient[];
  scaleFactor: number;
}

export function IngredientList({
  ingredients,
  scaleFactor,
}: IngredientListProps) {
  const [checkedItems, setCheckedItems] = useState<Set<number>>(new Set());

  const toggleCheck = (index: number) => {
    const newChecked = new Set(checkedItems);
    if (newChecked.has(index)) {
      newChecked.delete(index);
    } else {
      newChecked.add(index);
    }
    setCheckedItems(newChecked);
  };
  const formatAmount = (amount?: number): string => {
    if (!amount) return '';
    const scaled = amount * scaleFactor;

    // Round to sensible fractions
    if (scaled === Math.floor(scaled)) return scaled.toString();
    if (Math.abs(scaled - 0.25) < 0.01) return '1/4';
    if (Math.abs(scaled - 0.33) < 0.01) return '1/3';
    if (Math.abs(scaled - 0.5) < 0.01) return '1/2';
    if (Math.abs(scaled - 0.67) < 0.01) return '2/3';
    if (Math.abs(scaled - 0.75) < 0.01) return '3/4';

    return scaled.toFixed(1).replace(/\.0$/, '');
  };

  return (
    <View style={styles.container}>
      {ingredients.map((ingredient, index) => {
        const isChecked = checkedItems.has(index);
        return (
          <TouchableOpacity
            key={index}
            style={styles.item}
            onPress={() => toggleCheck(index)}
            activeOpacity={0.7}
          >
            <View style={styles.checkboxContainer}>
              <View style={[styles.checkbox, isChecked && styles.checkboxChecked]}>
                {isChecked && (
                  <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                )}
              </View>
            </View>
            <View style={[styles.content, isChecked && styles.contentChecked]}>
              <Text style={[styles.name, isChecked && styles.nameChecked]}>
                {formatAmount(ingredient.amount)} {ingredient.unit} {ingredient.name}
              </Text>
              {ingredient.notes && (
                <Text style={styles.notes}>{ingredient.notes}</Text>
              )}
              {ingredient.is_optional && (
                <Text style={styles.optional}>(optional)</Text>
              )}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
    gap: 12,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    padding: 12,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  checkboxContainer: {
    paddingTop: 2,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E8D3CE',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  checkboxChecked: {
    backgroundColor: '#F2330D',
    borderColor: '#F2330D',
  },
  content: {
    flex: 1,
  },
  contentChecked: {
    opacity: 0.5,
  },
  name: {
    fontSize: 16,
    color: '#1C100D',
    lineHeight: 22,
    fontFamily: 'NotoSans_600SemiBold',
  },
  nameChecked: {
    textDecorationLine: 'line-through',
    color: '#9C5749',
  },
  notes: {
    fontSize: 13,
    color: '#9C5749',
    fontStyle: 'italic',
    marginTop: 4,
    fontFamily: 'NotoSans_500Medium',
  },
  optional: {
    fontSize: 12,
    color: '#4CAF50',
    marginTop: 4,
    fontFamily: 'NotoSans_500Medium',
  },
});
