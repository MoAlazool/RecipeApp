import { useEffect, useState, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Text } from '@rneui/themed';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { getData } from '@/utils/imageCache';
import { useMealPlanStore } from '@/stores/mealPlanStore';
import { useRecipeStore } from '@/stores/recipeStore';
import type { SharedMealPlanData, SharedMealPlanMeal, PlannerMealSlot, Recipe } from '@/utils/types';

// ============================================================
// DESIGN TOKENS
// ============================================================

const C = {
  ivory: '#FFFFFF',
  charcoal: '#1A1510',
  gold: '#D4AF37',
  terracotta: '#C66E4E',
  muted: '#8A8578',
  background: '#FAFAF8',
  cardBg: '#F5F3EE',
};

const SLOT_CONFIG: Record<PlannerMealSlot, { icon: string; color: string; label: string }> = {
  breakfast: { icon: 'sunny', color: '#FB923C', label: 'Breakfast' },
  lunch: { icon: 'restaurant', color: '#4ADE80', label: 'Lunch' },
  dinner: { icon: 'moon', color: '#60A5FA', label: 'Dinner' },
  snack: { icon: 'cafe', color: '#D4AF37', label: 'Snack' },
};

// ============================================================
// MEAL ROW
// ============================================================

function MealRow({
  meal,
  recipe,
  isLoadingRecipe,
  isSaved,
  onViewRecipe,
  onSaveRecipe,
}: {
  meal: SharedMealPlanMeal;
  recipe: Recipe | null;
  isLoadingRecipe: boolean;
  isSaved: boolean;
  onViewRecipe: () => void;
  onSaveRecipe: () => void;
}) {
  const config = SLOT_CONFIG[meal.slot];
  const thumbnail = recipe?.thumbnail_url || meal.thumbnailUrl;

  return (
    <Pressable
      style={({ pressed }) => [styles.mealRow, pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] }]}
      onPress={onViewRecipe}
      disabled={isLoadingRecipe && !recipe}
    >
      {/* Thumbnail */}
      <View style={styles.mealThumb}>
        {thumbnail ? (
          <Image source={{ uri: thumbnail }} style={styles.mealThumbImg} contentFit="cover" />
        ) : (
          <View style={[styles.mealThumbPlaceholder, { backgroundColor: config.color + '15' }]}>
            <Ionicons name={config.icon as any} size={18} color={config.color} />
          </View>
        )}
      </View>

      {/* Info */}
      <View style={styles.mealInfo}>
        <View style={styles.mealSlotRow}>
          <View style={[styles.mealSlotDot, { backgroundColor: config.color }]} />
          <Text style={styles.mealSlotLabel}>{config.label}</Text>
        </View>
        <Text style={styles.mealTitle} numberOfLines={1}>{meal.title}</Text>
        <View style={styles.mealMeta}>
          {meal.timeMinutes != null && (
            <Text style={styles.mealMetaText}>{meal.timeMinutes} min</Text>
          )}
          {meal.timeMinutes != null && meal.calories != null && (
            <Text style={styles.mealMetaDot}> · </Text>
          )}
          {meal.calories != null && (
            <Text style={styles.mealMetaText}>{meal.calories} cal</Text>
          )}
        </View>
      </View>

      {/* Actions */}
      <View style={styles.mealActions}>
        {isSaved ? (
          <View style={styles.savedBadge}>
            <Ionicons name="checkmark" size={12} color="#6B8E23" />
          </View>
        ) : (
          <Pressable
            style={({ pressed }) => [styles.saveIconBtn, pressed && { opacity: 0.5 }]}
            onPress={(e) => {
              e.stopPropagation?.();
              onSaveRecipe();
            }}
            hitSlop={8}
          >
            <Ionicons name="bookmark-outline" size={16} color={C.gold} />
          </Pressable>
        )}
        <Ionicons name="chevron-forward" size={16} color={C.muted} />
      </View>
    </Pressable>
  );
}

// ============================================================
// MAIN SCREEN
// ============================================================

export default function PlanDetailScreen() {
  const { cacheKey } = useLocalSearchParams<{ cacheKey: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { importMealPlan } = useMealPlanStore();
  const { getRecipe, saveRecipeToMyList, prefetchRecipes, recipes } = useRecipeStore();

  const [planData, setPlanData] = useState<SharedMealPlanData | null>(null);
  const [loadedRecipes, setLoadedRecipes] = useState<Record<string, Recipe>>({});
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
  const [savedRecipeIds, setSavedRecipeIds] = useState<Set<string>>(new Set());
  const [savingRecipeId, setSavingRecipeId] = useState<string | null>(null);
  const [planSaved, setPlanSaved] = useState(false);

  // Load plan data from cache
  useEffect(() => {
    if (!cacheKey) return;
    const data = getData<SharedMealPlanData>(cacheKey);
    if (data) setPlanData(data);
  }, [cacheKey]);

  // Collect all recipe IDs and prefetch
  useEffect(() => {
    if (!planData) return;
    const ids: string[] = [];
    if (planData.meals) {
      planData.meals.forEach((m) => { if (m.recipeId) ids.push(m.recipeId); });
    }
    if (planData.daySummaries) {
      planData.daySummaries.forEach((d) => {
        d.meals?.forEach((m) => { if (m.recipeId) ids.push(m.recipeId); });
      });
    }
    if (ids.length > 0) {
      prefetchRecipes(ids).catch(() => {});
      // Load each recipe for display
      ids.forEach(async (id) => {
        setLoadingIds((prev) => new Set(prev).add(id));
        const recipe = await getRecipe(id);
        if (recipe) {
          setLoadedRecipes((prev) => ({ ...prev, [id]: recipe }));
        }
        setLoadingIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
      });
    }
  }, [planData]);

  // Check which recipes are already saved
  useEffect(() => {
    const saved = new Set<string>();
    for (const r of recipes) {
      if (r.original_recipe_id) saved.add(r.original_recipe_id);
    }
    setSavedRecipeIds(saved);
  }, [recipes]);

  const handleViewRecipe = useCallback((recipeId?: string) => {
    if (!recipeId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/recipe/${recipeId}` as any);
  }, [router]);

  const handleSaveRecipe = useCallback(async (recipeId?: string) => {
    if (!recipeId || savingRecipeId) return;
    const recipe = loadedRecipes[recipeId];
    if (!recipe) return;
    setSavingRecipeId(recipeId);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await saveRecipeToMyList(recipe);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert('Error', 'Failed to save recipe.');
    } finally {
      setSavingRecipeId(null);
    }
  }, [loadedRecipes, savingRecipeId, saveRecipeToMyList]);

  const handleSavePlan = useCallback(() => {
    if (!planData || planSaved) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const count = importMealPlan(planData);
    if (count > 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setPlanSaved(true);
    } else {
      Alert.alert('No Meals', 'This plan has no meals to save.');
    }
  }, [planData, planSaved, importMealPlan]);

  if (!planData) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ActivityIndicator color={C.gold} style={{ marginTop: 60 }} />
      </View>
    );
  }

  const isDay = planData.type === 'day';

  // Flatten all meals for display
  const allMealGroups: { dayLabel?: string; date?: string; meals: SharedMealPlanMeal[] }[] = [];
  if (isDay && planData.meals) {
    allMealGroups.push({ meals: planData.meals });
  } else if (planData.daySummaries) {
    for (const day of planData.daySummaries) {
      if (day.meals && day.meals.length > 0) {
        allMealGroups.push({ dayLabel: day.dayLabel, date: day.date, meals: day.meals });
      }
    }
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={C.charcoal} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>
            {isDay ? planData.dayLabel || 'Day Plan' : 'Week Plan'}
          </Text>
          <Text style={styles.headerSub}>
            {isDay
              ? planData.date || ''
              : planData.startDate && planData.endDate
              ? (() => {
                  try {
                    const s = new Date(planData.startDate + 'T12:00:00');
                    const e = new Date(planData.endDate + 'T12:00:00');
                    return `${s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${e.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
                  } catch { return ''; }
                })()
              : ''}
          </Text>
        </View>
        <View style={{ width: 24 }} />
      </View>

      {/* Stats bar */}
      <View style={styles.statsBar}>
        <View style={styles.statPill}>
          <Ionicons name="restaurant-outline" size={13} color={C.gold} />
          <Text style={styles.statText}>{planData.totalMeals} meals</Text>
        </View>
        {planData.totalTimeMinutes != null && planData.totalTimeMinutes > 0 && (
          <View style={styles.statPill}>
            <Ionicons name="time-outline" size={13} color={C.gold} />
            <Text style={styles.statText}>{planData.totalTimeMinutes} min</Text>
          </View>
        )}
        {planData.totalCalories != null && planData.totalCalories > 0 && (
          <View style={styles.statPill}>
            <Ionicons name="flame-outline" size={13} color={C.gold} />
            <Text style={styles.statText}>~{planData.totalCalories} cal</Text>
          </View>
        )}
      </View>

      {/* Meals list */}
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 90 }]}
        showsVerticalScrollIndicator={false}
      >
        {allMealGroups.length === 0 && (
          <Text style={styles.emptyText}>No meals in this plan</Text>
        )}
        {allMealGroups.map((group, gi) => (
          <View key={gi}>
            {group.dayLabel && (
              <Text style={styles.dayHeader}>{group.dayLabel}</Text>
            )}
            {group.meals.map((meal) => (
              <MealRow
                key={`${gi}-${meal.slot}`}
                meal={meal}
                recipe={meal.recipeId ? loadedRecipes[meal.recipeId] || null : null}
                isLoadingRecipe={meal.recipeId ? loadingIds.has(meal.recipeId) : false}
                isSaved={meal.recipeId ? savedRecipeIds.has(meal.recipeId) : false}
                onViewRecipe={() => handleViewRecipe(meal.recipeId)}
                onSaveRecipe={() => handleSaveRecipe(meal.recipeId)}
              />
            ))}
          </View>
        ))}
      </ScrollView>

      {/* Bottom action */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable
          style={({ pressed }) => [
            styles.saveAllBtn,
            planSaved && styles.saveAllBtnSaved,
            pressed && { opacity: 0.8 },
          ]}
          onPress={handleSavePlan}
          disabled={planSaved}
        >
          <Ionicons
            name={planSaved ? 'checkmark-circle' : 'calendar-outline'}
            size={18}
            color={planSaved ? '#6B8E23' : C.ivory}
          />
          <Text style={[styles.saveAllText, planSaved && styles.saveAllTextSaved]}>
            {planSaved ? 'Saved to Planner' : 'Save to My Planner'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 12,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 18,
    color: C.charcoal,
  },
  headerSub: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 12,
    color: C.muted,
    marginTop: 2,
  },
  statsBar: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 14,
    gap: 8,
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  statText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12,
    color: C.charcoal,
  },
  content: {
    paddingHorizontal: 20,
  },
  emptyText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 14,
    color: C.muted,
    textAlign: 'center',
    marginTop: 40,
  },
  dayHeader: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 13,
    color: C.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 18,
    marginBottom: 8,
  },

  // Meal row
  mealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.ivory,
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    gap: 12,
    shadowColor: '#1A1510',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  mealThumb: {
    width: 56,
    height: 56,
    borderRadius: 12,
    overflow: 'hidden',
  },
  mealThumbImg: {
    width: 56,
    height: 56,
  },
  mealThumbPlaceholder: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  mealInfo: {
    flex: 1,
    gap: 3,
  },
  mealSlotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  mealSlotDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  mealSlotLabel: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 10,
    color: C.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  mealTitle: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 14,
    color: C.charcoal,
  },
  mealMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mealMetaText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 11,
    color: C.muted,
  },
  mealMetaDot: {
    color: C.muted,
    fontSize: 11,
  },
  mealActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  saveIconBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  savedBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(107, 142, 35, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Bottom bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: C.background,
    borderTopWidth: 1,
    borderTopColor: 'rgba(26, 21, 16, 0.05)',
  },
  saveAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: C.gold,
    paddingVertical: 14,
    borderRadius: 16,
    shadowColor: C.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  saveAllBtnSaved: {
    backgroundColor: 'rgba(107, 142, 35, 0.12)',
    shadowOpacity: 0,
    elevation: 0,
  },
  saveAllText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 15,
    color: C.ivory,
  },
  saveAllTextSaved: {
    color: '#6B8E23',
  },
});
