import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

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
            size={20}
            color={activeType === type.id ? '#FFFFFF' : isDark ? '#9CA3AF' : '#6B7280'}
          />
          <Text
            style={[
              styles.tabText,
              {
                color: activeType === type.id
                  ? '#FFFFFF'
                  : isDark
                  ? '#9CA3AF'
                  : '#6B7280',
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
    gap: 8,
    paddingVertical: 16,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 16,
    gap: 6,
    borderWidth: 1,
  },
  tabActive: {
    backgroundColor: '#FF4B2B',
    borderColor: '#FF4B2B',
    shadowColor: '#FF4B2B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 6,
  },
  tabInactive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
  },
  tabInactiveDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  tabText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
});
