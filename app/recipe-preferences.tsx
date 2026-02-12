import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Dimensions,
  StatusBar,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Michelin-star Design Tokens
const C = {
  ivory: '#FFFEFB',
  charcoal: '#1A1510',
  gold: '#D4AF37',
  terracotta: '#C66E4E',
  muted: '#8A8578',
  hairline: 'rgba(26, 21, 16, 0.06)',
  glass: 'rgba(255, 255, 255, 0.92)',
  cardBg: 'rgba(26, 21, 16, 0.03)',
  olive: '#6B8E23',
};

const SHADOW_SOFT = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.04,
  shadowRadius: 8,
  elevation: 2,
};

type MealType = 'any' | 'breakfast' | 'lunch' | 'dinner' | 'snack';
type Difficulty = 'any' | 'easy' | 'medium' | 'hard';
type SortBy = 'best_match' | 'time' | 'difficulty' | 'calories';

interface OptionItem {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  description?: string;
}

const mealOptions: OptionItem[] = [
  { id: 'any', label: 'Any Meal', icon: 'grid-outline', description: 'Show all recipes' },
  { id: 'breakfast', label: 'Breakfast', icon: 'sunny-outline', description: 'Morning meals' },
  { id: 'lunch', label: 'Lunch', icon: 'restaurant-outline', description: 'Midday meals' },
  { id: 'dinner', label: 'Dinner', icon: 'moon-outline', description: 'Evening meals' },
  { id: 'snack', label: 'Snack', icon: 'cafe-outline', description: 'Quick bites' },
];

const difficultyOptions: OptionItem[] = [
  { id: 'any', label: 'Any Level', icon: 'star-outline', description: 'All difficulties' },
  { id: 'easy', label: 'Easy', icon: 'flash-outline', description: 'Under 20 mins' },
  { id: 'medium', label: 'Medium', icon: 'time-outline', description: '20-40 mins' },
  { id: 'hard', label: 'Challenging', icon: 'trophy-outline', description: '40+ mins' },
];

const sortOptions: OptionItem[] = [
  { id: 'best_match', label: 'Best Match', icon: 'sparkles-outline', description: 'AI recommended' },
  { id: 'time', label: 'Quickest', icon: 'timer-outline', description: 'Fastest to cook' },
  { id: 'difficulty', label: 'Easiest', icon: 'leaf-outline', description: 'Simplest first' },
  { id: 'calories', label: 'Healthiest', icon: 'heart-outline', description: 'Lowest calories' },
];

export default function RecipePreferencesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();

  const [selectedMeal, setSelectedMeal] = useState<MealType>('any');
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty>('any');
  const [selectedSort, setSelectedSort] = useState<SortBy>('best_match');

  const handleSelect = useCallback((
    type: 'meal' | 'difficulty' | 'sort',
    value: string
  ) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (type === 'meal') setSelectedMeal(value as MealType);
    else if (type === 'difficulty') setSelectedDifficulty(value as Difficulty);
    else setSelectedSort(value as SortBy);
  }, []);

  const handleContinue = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.replace({
      pathname: '/recipe-results',
      params: {
        ...params,
        mealType: selectedMeal,
        difficulty: selectedDifficulty,
        sortBy: selectedSort,
      },
    });
  }, [router, params, selectedMeal, selectedDifficulty, selectedSort]);

  const renderOptionGroup = (
    title: string,
    subtitle: string,
    options: OptionItem[],
    selected: string,
    type: 'meal' | 'difficulty' | 'sort',
    delay: number
  ) => (
    <Animated.View
      entering={FadeInDown.duration(400).delay(delay).springify()}
      style={styles.optionGroup}
    >
      <View style={styles.optionHeader}>
        <Text style={styles.optionTitle}>{title}</Text>
        <Text style={styles.optionSubtitle}>{subtitle}</Text>
      </View>
      <View style={styles.optionsGrid}>
        {options.map((option) => {
          const isSelected = selected === option.id;
          return (
            <Pressable
              key={option.id}
              onPress={() => handleSelect(type, option.id)}
              style={[
                styles.optionCard,
                isSelected && styles.optionCardSelected,
              ]}
            >
              <View style={[
                styles.optionIconWrap,
                isSelected && styles.optionIconWrapSelected,
              ]}>
                <Ionicons
                  name={option.icon}
                  size={22}
                  color={isSelected ? C.ivory : C.muted}
                />
              </View>
              <Text style={[
                styles.optionLabel,
                isSelected && styles.optionLabelSelected,
              ]}>
                {option.label}
              </Text>
              {option.description && (
                <Text style={styles.optionDesc}>{option.description}</Text>
              )}
              {isSelected && (
                <View style={styles.checkBadge}>
                  <Ionicons name="checkmark" size={12} color={C.ivory} />
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
    </Animated.View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <BlurView intensity={80} tint="light" style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={12}
        >
          <Ionicons name="chevron-back" size={24} color={C.charcoal} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Preferences</Text>
          <Text style={styles.headerSubtitle}>Customize your results</Text>
        </View>
        <View style={{ width: 40 }} />
      </BlurView>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <Animated.View
          entering={FadeIn.duration(500)}
          style={styles.hero}
        >
          <View style={styles.heroIconWrap}>
            <Ionicons name="options-outline" size={32} color={C.gold} />
          </View>
          <Text style={styles.heroTitle}>What are you craving?</Text>
          <Text style={styles.heroSubtitle}>
            Let us know your preferences and we'll find the perfect recipes for you
          </Text>
        </Animated.View>

        {/* Option Groups */}
        {renderOptionGroup(
          'Meal Type',
          'When do you want to eat?',
          mealOptions,
          selectedMeal,
          'meal',
          100
        )}

        {renderOptionGroup(
          'Difficulty',
          'How much time do you have?',
          difficultyOptions,
          selectedDifficulty,
          'difficulty',
          200
        )}

        {renderOptionGroup(
          'Sort By',
          'How should we order results?',
          sortOptions,
          selectedSort,
          'sort',
          300
        )}
      </ScrollView>

      {/* Bottom Dock */}
      <BlurView
        intensity={80}
        tint="light"
        style={[styles.dock, { paddingBottom: insets.bottom + 8 }]}
      >
        <View style={styles.dockInner}>
          <View style={styles.previewChips}>
            <View style={styles.previewChip}>
              <Ionicons name="restaurant-outline" size={14} color={C.muted} />
              <Text style={styles.previewChipText}>
                {mealOptions.find(o => o.id === selectedMeal)?.label}
              </Text>
            </View>
            <View style={styles.previewChip}>
              <Ionicons name="speedometer-outline" size={14} color={C.muted} />
              <Text style={styles.previewChipText}>
                {difficultyOptions.find(o => o.id === selectedDifficulty)?.label}
              </Text>
            </View>
          </View>
          <Pressable
            onPress={handleContinue}
            style={({ pressed }) => [
              styles.continueBtn,
              pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
            ]}
          >
            <Text style={styles.continueBtnText}>Find Recipes</Text>
            <Ionicons name="arrow-forward" size={18} color={C.ivory} />
          </Pressable>
        </View>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.ivory,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.hairline,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(26, 21, 16, 0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: 'PlayfairDisplay_600SemiBold',
    color: C.charcoal,
  },
  headerSubtitle: {
    fontSize: 12,
    fontFamily: 'NotoSans_400Regular',
    color: C.muted,
    marginTop: 2,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  hero: {
    alignItems: 'center',
    marginBottom: 32,
  },
  heroIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 24,
    fontFamily: 'PlayfairDisplay_600SemiBold',
    color: C.charcoal,
    textAlign: 'center',
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 14,
    fontFamily: 'NotoSans_400Regular',
    color: C.muted,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
  optionGroup: {
    marginBottom: 28,
  },
  optionHeader: {
    marginBottom: 14,
  },
  optionTitle: {
    fontSize: 18,
    fontFamily: 'PlayfairDisplay_600SemiBold',
    color: C.charcoal,
    marginBottom: 4,
  },
  optionSubtitle: {
    fontSize: 13,
    fontFamily: 'NotoSans_400Regular',
    color: C.muted,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  optionCard: {
    width: (SCREEN_WIDTH - 50) / 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: C.hairline,
    ...SHADOW_SOFT,
  },
  optionCardSelected: {
    borderColor: C.terracotta,
    backgroundColor: 'rgba(198, 110, 78, 0.04)',
  },
  optionIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: C.cardBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  optionIconWrapSelected: {
    backgroundColor: C.terracotta,
  },
  optionLabel: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: C.charcoal,
    marginBottom: 4,
  },
  optionLabelSelected: {
    color: C.terracotta,
  },
  optionDesc: {
    fontSize: 12,
    fontFamily: 'NotoSans_400Regular',
    color: C.muted,
  },
  checkBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: C.terracotta,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dock: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 12,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: C.hairline,
  },
  dockInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  previewChips: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  previewChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(26, 21, 16, 0.04)',
    borderRadius: 8,
  },
  previewChipText: {
    fontSize: 12,
    fontFamily: 'NotoSans_500Medium',
    color: C.muted,
  },
  continueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.terracotta,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    shadowColor: C.terracotta,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  continueBtnText: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: C.ivory,
  },
});
