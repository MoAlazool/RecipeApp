import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Michelin-star Design Tokens
const C = {
  ivory: '#FFFEFB',
  charcoal: '#1A1510',
  terracotta: '#C66E4E',
  gold: '#D4AF37',
  muted: '#8A8578',
};

type MealType = 'Breakfast' | 'Lunch' | 'Dinner';

interface MealTypeTabsProps {
  activeType: MealType;
  onSelect: (type: MealType) => void;
  isDark?: boolean;
}

export const MealTypeTabs: React.FC<MealTypeTabsProps> = ({
  activeType,
  onSelect,
  isDark = false,
}) => {
  const types: { id: MealType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { id: 'Breakfast', label: 'Breakfast', icon: 'sunny-outline' },
    { id: 'Lunch', label: 'Lunch', icon: 'restaurant-outline' },
    { id: 'Dinner', label: 'Dinner', icon: 'moon-outline' },
  ];

  return (
    <View style={styles.container}>
      {types.map((type) => (
        <Pressable
          key={type.id}
          onPress={() => onSelect(type.id)}
          style={[
            styles.tab,
            activeType === type.id
              ? styles.tabActive
              : isDark
              ? styles.tabInactiveDark
              : styles.tabInactive,
          ]}
        >
          <Ionicons
            name={type.icon}
            size={18}
            color={activeType === type.id ? C.ivory : isDark ? C.muted : C.muted}
          />
          <Text
            style={[
              styles.tabText,
              {
                color: activeType === type.id ? C.ivory : isDark ? C.muted : C.muted,
              },
            ]}
          >
            {type.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 16,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
    borderWidth: 1,
  },
  tabActive: {
    backgroundColor: C.terracotta,
    borderColor: C.terracotta,
    shadowColor: C.terracotta,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  tabInactive: {
    backgroundColor: C.ivory,
    borderColor: 'rgba(26, 21, 16, 0.08)',
  },
  tabInactiveDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  tabText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    letterSpacing: 0.2,
  },
});
