import React from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

interface PantryChipsProps {
  ingredients: string[];
  onAddPress?: () => void;
  isDark?: boolean;
}

export const PantryChips: React.FC<PantryChipsProps> = ({
  ingredients,
  onAddPress,
  isDark = false,
}) => {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>MY PANTRY</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Add Button */}
        {onAddPress && (
          <Pressable
            style={[
              styles.addButton,
              isDark && styles.addButtonDark,
            ]}
            onPress={onAddPress}
          >
            <Ionicons name="add" size={24} color={isDark ? '#9CA3AF' : '#D1D5DB'} />
          </Pressable>
        )}

        {/* Ingredient Chips */}
        {ingredients.map((ingredient, index) => (
          <View
            key={index}
            style={[
              styles.chip,
              isDark && styles.chipDark,
            ]}
          >
            <MaterialCommunityIcons
              name="food-apple"
              size={16}
              color={isDark ? '#9CA3AF' : '#94A3B8'}
            />
            <Text
              style={[
                styles.chipText,
                { color: isDark ? '#E5E7EB' : '#334155' },
              ]}
            >
              {ingredient}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#9CA3AF',
    letterSpacing: 1.5,
    marginBottom: 12,
    marginLeft: 4,
  },
  scrollContent: {
    paddingRight: 24,
    gap: 12,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonDark: {
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  chip: {
    height: 44,
    paddingHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  chipDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  chipText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
});
