import React, { useState, useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from '@rneui/themed';
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { CATEGORY_ICONS } from '@/stores/shoppingStore';
import type { Ingredient } from '@/utils/types';
import { getIngredientImage } from '@/utils/ingredientImages';

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

  // Group ingredients by "group" field when present
  const grouped = useMemo(() => {
    const hasGroups = ingredients.some(i => i.group);
    if (!hasGroups) return null;
    const map = new Map<string, Ingredient[]>();
    for (const ing of ingredients) {
      const key = ing.group || '';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(ing);
    }
    return map;
  }, [ingredients]);

  const getCategoryIcon = (category?: string): string => {
    if (!category) return 'ellipsis-horizontal';
    return CATEGORY_ICONS[category] || 'ellipsis-horizontal';
  };

  const renderItem = (ingredient: Ingredient, index: number) => {
    const isChecked = checkedItems.has(index);
    const amountStr = formatAmount(ingredient.amount);
    const unitStr = ingredient.unit || '';
    const hasAmount = amountStr || unitStr;
    const ingredientImage = getIngredientImage(ingredient.name);

    return (
      <TouchableOpacity
        key={index}
        style={styles.item}
        onPress={() => toggleCheck(index)}
        activeOpacity={0.7}
      >
        {ingredientImage ? (
          <View style={styles.thumbnailContainer}>
            <ExpoImage
              source={ingredientImage}
              style={[styles.thumbnail, isChecked && styles.thumbnailChecked]}
              contentFit="cover"
              transition={200}
            />
            {isChecked && (
              <View style={styles.thumbnailCheckmark}>
                <Ionicons name="checkmark" size={12} color="#FFFFFF" />
              </View>
            )}
          </View>
        ) : (
          <View style={styles.checkboxContainer}>
            <View style={[styles.checkbox, isChecked && styles.checkboxChecked]}>
              {isChecked ? (
                <Ionicons name="checkmark" size={16} color="#FFFFFF" />
              ) : (
                <Ionicons
                  name={getCategoryIcon(ingredient.category) as any}
                  size={12}
                  color="#D4B5AE"
                />
              )}
            </View>
          </View>
        )}
        <View style={[styles.content, isChecked && styles.contentChecked]}>
          <View style={styles.nameRow}>
            <Text style={[styles.name, isChecked && styles.nameChecked]} numberOfLines={2}>
              {ingredient.name}
            </Text>
            {hasAmount ? (
              <View style={styles.amountPill}>
                <Text style={[styles.amountText, isChecked && styles.amountTextChecked]}>
                  {[amountStr, unitStr].filter(Boolean).join(' ')}
                </Text>
              </View>
            ) : null}
          </View>
          {ingredient.notes && (
            <Text style={styles.notes}>{ingredient.notes}</Text>
          )}
          {ingredient.is_optional && (
            <Text style={styles.optional}>(optional)</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // Track the global index so checkbox state works across groups
  let globalIndex = 0;

  return (
    <View style={styles.container}>
      {grouped ? (
        Array.from(grouped).map(([group, items]) => {
          const startIndex = globalIndex;
          globalIndex += items.length;
          return (
            <View key={group || '_ungrouped'} style={group ? styles.group : undefined}>
              {group !== '' && (
                <View style={styles.groupLabel}>
                  <Ionicons name="restaurant-outline" size={14} color="#556B2F" />
                  <Text style={styles.groupLabelText}>{group}</Text>
                </View>
              )}
              {items.map((ingredient, i) => renderItem(ingredient, startIndex + i))}
            </View>
          );
        })
      ) : (
        ingredients.map((ingredient, index) => renderItem(ingredient, index))
      )}
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
  thumbnailContainer: {
    position: 'relative',
  },
  thumbnail: {
    width: 40,
    height: 40,
    borderRadius: 10,
  },
  thumbnailChecked: {
    opacity: 0.4,
  },
  thumbnailCheckmark: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 10,
    backgroundColor: 'rgba(242, 51, 13, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
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
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  name: {
    flex: 1,
    fontSize: 16,
    color: '#1C100D',
    lineHeight: 22,
    fontFamily: 'NotoSans_700Bold',
  },
  nameChecked: {
    textDecorationLine: 'line-through',
    color: '#9C5749',
  },
  amountPill: {
    backgroundColor: '#F8F6F5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E8D3CE',
  },
  amountText: {
    fontSize: 13,
    fontFamily: 'NotoSans_600SemiBold',
    color: '#9C5749',
  },
  amountTextChecked: {
    textDecorationLine: 'line-through',
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
  group: {
    marginBottom: 16,
    gap: 12,
  },
  groupLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(85, 107, 47, 0.1)',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    marginBottom: 10,
  },
  groupLabelText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#556B2F',
  },
});
