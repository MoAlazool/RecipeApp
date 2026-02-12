import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  ScrollView,
  Pressable,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Text } from '@rneui/themed';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image as ExpoImage } from 'expo-image';
import { useRouter } from 'expo-router';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  interpolate,
  runOnJS,
} from 'react-native-reanimated';
import { format, addDays, addWeeks, startOfWeek, endOfWeek, isToday as isTodayFn } from 'date-fns';
import * as Haptics from 'expo-haptics';
import { useMealPlanStore } from '@/stores/mealPlanStore';
import { useRecipeStore } from '@/stores/recipeStore';
import { useBottomTabBarHeight } from '@/hooks/useBottomTabBarHeight';
import { useUsageGate } from '@/hooks/useUsageGate';
import UsageLimitSheet from '@/components/ui/UsageLimitSheet';
import { TabScreenTransition } from '@/components/layout/TabScreenTransition';
import RecipePickerSheet from '@/components/planner/RecipePickerSheet';
import ViewModeToggle from '@/components/planner/ViewModeToggle';
import WeekScheduleView from '@/components/planner/WeekScheduleView';
import TodaysPlanCard from '@/components/planner/TodaysPlanCard';
import DayActionMenu from '@/components/planner/DayActionMenu';
import type { PlannerMealSlot, MealPlanItem, Recipe } from '@/utils/types';

// ============================================================
// DESIGN TOKENS
// ============================================================

const C = {
  ivory: '#FFFFFF',
  charcoal: '#1A1510',
  gold: '#D4AF37',
  terracotta: '#C66E4E',
  muted: '#8A8578',
  hairline: 'rgba(26, 21, 16, 0.08)',
  cardBg: '#F5F3EE',
  background: '#FAFAF8',
};

const SLOTS: { key: PlannerMealSlot; label: string; icon: string }[] = [
  { key: 'breakfast', label: 'Breakfast', icon: 'sunny-outline' },
  { key: 'lunch', label: 'Lunch', icon: 'restaurant-outline' },
  { key: 'dinner', label: 'Dinner', icon: 'moon-outline' },
  { key: 'snack', label: 'Snack', icon: 'cafe-outline' },
];

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ============================================================
// WEEK HEADER
// ============================================================

function WeekHeader({
  label,
  onPrev,
  onNext,
}: {
  label: string;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <View style={styles.weekHeader}>
      <Pressable
        style={({ pressed }) => [styles.arrowPill, pressed && { opacity: 0.6 }]}
        onPress={onPrev}
      >
        <Ionicons name="chevron-back" size={18} color={C.charcoal} />
      </Pressable>
      <Text style={styles.weekLabel}>{label}</Text>
      <Pressable
        style={({ pressed }) => [styles.arrowPill, pressed && { opacity: 0.6 }]}
        onPress={onNext}
      >
        <Ionicons name="chevron-forward" size={18} color={C.charcoal} />
      </Pressable>
    </View>
  );
}

// ============================================================
// DAY SELECTOR — swipeable, today centered
// ============================================================

function DaySelector({
  days,
  selectedDate,
  onSelect,
  onLongPress,
  getFilledCount,
  onSwipeWeek,
}: {
  days: { date: string; dayLabel: string; dayNumber: string; isToday: boolean }[];
  selectedDate: string;
  onSelect: (date: string) => void;
  onLongPress: (date: string) => void;
  getFilledCount: (date: string) => number;
  onSwipeWeek: (dir: number) => void;
}) {
  const slideX = useSharedValue(0);

  const panGesture = Gesture.Pan()
    .activeOffsetX([-15, 15])
    .failOffsetY([-10, 10])
    .onUpdate((e) => {
      slideX.value = e.translationX * 0.7;
    })
    .onEnd((e) => {
      const pastThreshold =
        Math.abs(e.translationX) > 80 || Math.abs(e.velocityX) > 600;
      if (pastThreshold) {
        const dir = e.translationX < 0 ? 1 : -1;
        slideX.value = withTiming(
          -dir * SCREEN_WIDTH,
          { duration: 150, easing: Easing.in(Easing.quad) },
          (finished) => {
            if (finished) {
              runOnJS(onSwipeWeek)(dir);
              slideX.value = dir * SCREEN_WIDTH * 0.5;
              slideX.value = withTiming(0, {
                duration: 220,
                easing: Easing.out(Easing.cubic),
              });
            }
          }
        );
      } else {
        slideX.value = withTiming(0, {
          duration: 200,
          easing: Easing.out(Easing.cubic),
        });
      }
    });

  const rowAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: slideX.value }],
    opacity: interpolate(
      Math.abs(slideX.value),
      [0, SCREEN_WIDTH * 0.6],
      [1, 0],
      'clamp'
    ),
  }));

  return (
    <View style={styles.dayRowClip}>
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[styles.dayRow, rowAnimStyle]}>
          {days.map((d) => {
            const isSelected = d.date === selectedDate;
            const filledCount = getFilledCount(d.date);

            return (
              <Pressable
                key={d.date}
                style={[
                  styles.dayPill,
                  isSelected && styles.dayPillActive,
                  d.isToday && !isSelected && styles.dayPillToday,
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onSelect(d.date);
                }}
                onLongPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  onLongPress(d.date);
                }}
                delayLongPress={400}
              >
                <Text
                  style={[
                    styles.dayLetter,
                    isSelected && styles.dayLetterActive,
                  ]}
                >
                  {d.dayLabel}
                </Text>
                <Text
                  style={[
                    styles.dayNum,
                    isSelected && styles.dayNumActive,
                  ]}
                >
                  {d.dayNumber}
                </Text>
                <View style={styles.dotRow}>
                  {[0, 1, 2, 3].map((i) => (
                    <View
                      key={i}
                      style={[
                        styles.dot,
                        i < filledCount && styles.dotFilled,
                      ]}
                    />
                  ))}
                </View>
              </Pressable>
            );
          })}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

// ============================================================
// EMPTY SLOT CARD
// ============================================================

function EmptySlotCard({
  slot,
  onAdd,
}: {
  slot: { key: PlannerMealSlot; label: string; icon: string };
  onAdd: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.emptyCard, pressed && { opacity: 0.7 }]}
      onPress={onAdd}
    >
      <View style={styles.emptyCardInner}>
        <Ionicons name={slot.icon as any} size={20} color={C.muted} />
        <View style={styles.emptyCardText}>
          <Text style={styles.emptyCardLabel}>Add {slot.label}</Text>
          <Text style={styles.emptyCardHint}>Tap to choose a recipe</Text>
        </View>
        <View style={styles.addCircle}>
          <Ionicons name="add" size={20} color={C.gold} />
        </View>
      </View>
    </Pressable>
  );
}

// ============================================================
// FILLED SLOT CARD
// ============================================================

function FilledSlotCard({
  slot,
  item,
  onRemove,
  onPress,
}: {
  slot: { key: PlannerMealSlot; label: string; icon: string };
  item: MealPlanItem;
  onRemove: () => void;
  onPress: () => void;
}) {
  const time = item.totalTimeMinutes;
  const timeLabel = time < 60 ? `${time} min` : `${Math.round(time / 60 * 2) / 2} hr`;
  const diffLabel =
    item.difficulty === 'beginner' ? 'Easy' : item.difficulty === 'intermediate' ? 'Medium' : 'Hard';

  return (
    <Pressable
      style={({ pressed }) => [styles.filledCard, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
    >
      <View style={styles.filledCardRow}>
        <ExpoImage
          source={item.thumbnailUrl ? { uri: item.thumbnailUrl } : undefined}
          style={styles.filledThumb}
          contentFit="cover"
        />
        <View style={styles.filledInfo}>
          <View style={styles.slotMicroLabel}>
            <Ionicons name={slot.icon as any} size={11} color={C.gold} />
            <Text style={styles.slotMicroText}>{slot.label}</Text>
          </View>
          <Text style={styles.filledTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.filledMeta}>
            {timeLabel} · {diffLabel}{item.calories ? ` · ${item.calories} cal` : ''}
          </Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.removeBtn, pressed && { opacity: 0.5 }]}
          onPress={onRemove}
          hitSlop={8}
        >
          <Ionicons name="close-circle" size={22} color={C.muted} />
        </Pressable>
      </View>
    </Pressable>
  );
}

// ============================================================
// MAIN SCREEN
// ============================================================

export default function PlannerScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const bottomTabBarHeight = useBottomTabBarHeight();
  const pickerRef = useRef<BottomSheetModal>(null);
  const dayActionRef = useRef<BottomSheetModal>(null);
  const { checkGate, limitSheetRef, limitInfo } = useUsageGate();
  const [activeSlot, setActiveSlot] = useState<PlannerMealSlot | null>(null);
  const [actionMenuDate, setActionMenuDate] = useState<string>('');
  // For week view: track the date+slot for the picker
  const [weekPickerDate, setWeekPickerDate] = useState<string>('');

  const {
    selectedDate,
    weekOffset,
    viewMode,
    clipboard,
    plans,
    setSelectedDate,
    setWeekOffset,
    setViewMode,
    getWeekDays,
    getMealsForDay,
    getFilledSlotsCount,
    getDayNutrition,
    addMeal,
    removeMeal,
    copyDay,
    pasteDay,
    clearDay,
  } = useMealPlanStore();

  // Centered 7-day window: today always in position 4 (middle)
  const centeredDays = useMemo(() => {
    const centerDate = addDays(new Date(), weekOffset * 7);
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(centerDate, i - 3);
      return {
        date: format(d, 'yyyy-MM-dd'),
        dayLabel: format(d, 'EEEEE'),
        dayNumber: format(d, 'd'),
        isToday: isTodayFn(d),
      };
    });
  }, [weekOffset]);

  // Week label for header
  const weekLabel = useMemo(() => {
    if (weekOffset === 0) return 'This Week';
    const centerDate = addDays(new Date(), weekOffset * 7);
    const first = addDays(centerDate, -3);
    const last = addDays(centerDate, 3);
    return `${format(first, 'MMM d')} – ${format(last, 'MMM d')}`;
  }, [weekOffset]);

  const weekDays = getWeekDays(); // Mon-Sun for week view
  const dayPlan = getMealsForDay(selectedDate);

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const isSelectedToday = selectedDate === todayStr;
  const todayNutrition = getDayNutrition(selectedDate);

  // Pre-fetch shared recipes so they open instantly
  const { prefetchRecipes } = useRecipeStore();
  useEffect(() => {
    const slots: PlannerMealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack'];
    const ids: string[] = [];
    const dates = viewMode === 'day'
      ? centeredDays.map((d) => d.date)
      : weekDays.map((d) => d.date);
    for (const date of dates) {
      const day = plans[date];
      if (!day) continue;
      for (const s of slots) {
        const item = day[s];
        if (item?.recipeId) ids.push(item.recipeId);
      }
    }
    if (ids.length > 0) prefetchRecipes(ids).catch(() => {});
  }, [selectedDate, weekOffset, viewMode, plans]);

  const handleChangeViewMode = useCallback(async (mode: 'day' | 'week'): Promise<boolean> => {
    if (mode === 'week') {
      const allowed = await checkGate('week_planner');
      if (!allowed) return false;
    }
    setViewMode(mode);
    return true;
  }, [checkGate, setViewMode]);

  const handleOpenPicker = useCallback(
    (slot: PlannerMealSlot, date?: string) => {
      setActiveSlot(slot);
      if (date) setWeekPickerDate(date);
      else setWeekPickerDate('');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      pickerRef.current?.present();
    },
    []
  );

  const handleSelectRecipe = useCallback(
    (recipe: Recipe) => {
      if (!activeSlot) return;
      const targetDate = weekPickerDate || selectedDate;
      addMeal(targetDate, activeSlot, recipe);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    [activeSlot, selectedDate, weekPickerDate, addMeal]
  );

  const handleRemoveMeal = useCallback(
    (slot: PlannerMealSlot) => {
      removeMeal(selectedDate, slot);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [selectedDate, removeMeal]
  );

  const changeWeek = useCallback((newOffset: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setWeekOffset(newOffset);
    // Select center day of the new window
    const centerDate = addDays(new Date(), newOffset * 7);
    setSelectedDate(format(centerDate, 'yyyy-MM-dd'));
  }, [setWeekOffset, setSelectedDate]);

  const handlePrevWeek = useCallback(() => {
    changeWeek(weekOffset - 1);
  }, [weekOffset, changeWeek]);

  const handleNextWeek = useCallback(() => {
    changeWeek(weekOffset + 1);
  }, [weekOffset, changeWeek]);

  const handleSwipeWeek = useCallback((dir: number) => {
    changeWeek(weekOffset + dir);
  }, [weekOffset, changeWeek]);

  // Long-press on day pill → open action menu
  const handleDayLongPress = useCallback((date: string) => {
    setActionMenuDate(date);
    dayActionRef.current?.present();
  }, []);

  // Week view: empty slot tap → open picker for that date+slot
  const handleWeekEmptySlot = useCallback((date: string, slot: PlannerMealSlot) => {
    handleOpenPicker(slot, date);
  }, [handleOpenPicker]);

  // Action menu handlers
  const handleCopyDay = useCallback(() => {
    copyDay(actionMenuDate);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [actionMenuDate, copyDay]);

  const handlePasteDay = useCallback(() => {
    pasteDay(actionMenuDate);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [actionMenuDate, pasteDay]);

  const handleClearDay = useCallback(() => {
    clearDay(actionMenuDate);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  }, [actionMenuDate, clearDay]);

  const actionMenuDateLabel = actionMenuDate
    ? format(new Date(actionMenuDate + 'T12:00:00'), 'EEEE, MMM d')
    : '';

  return (
    <TabScreenTransition style={{ flex: 1, backgroundColor: C.background }}>
      <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
        {/* Title + Share */}
        <View style={styles.titleRow}>
          <Text style={styles.screenTitle}>Meal Planner</Text>
          <Pressable
            style={({ pressed }) => [styles.shareBtn, pressed && { opacity: 0.6 }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push({
                pathname: '/share-planner',
                params: {
                  mode: viewMode,
                  date: selectedDate,
                  weekOffset: String(weekOffset),
                },
              } as any);
            }}
          >
            <Ionicons name="share-outline" size={20} color={C.charcoal} />
          </Pressable>
        </View>

        {/* View mode toggle */}
        <ViewModeToggle mode={viewMode} onChangeMode={handleChangeViewMode} />

        {/* Week navigation */}
        <WeekHeader
          label={weekLabel}
          onPrev={handlePrevWeek}
          onNext={handleNextWeek}
        />

        {viewMode === 'day' ? (
          <>
            {/* Day selector — swipeable, today centered */}
            <DaySelector
              days={centeredDays}
              selectedDate={selectedDate}
              onSelect={setSelectedDate}
              onLongPress={handleDayLongPress}
              getFilledCount={getFilledSlotsCount}
              onSwipeWeek={handleSwipeWeek}
            />

            {/* Meal slots */}
            <ScrollView
              style={styles.slotsScroll}
              contentContainerStyle={[
                styles.slotsContent,
                { paddingBottom: bottomTabBarHeight + 24 },
              ]}
              showsVerticalScrollIndicator={false}
            >
              {/* Today's Plan Card — only if selected day is today and has meals */}
              {isSelectedToday && todayNutrition.filledSlots > 0 && (
                <TodaysPlanCard nutrition={todayNutrition} />
              )}

              {SLOTS.map((slot) => {
                const item = dayPlan[slot.key];
                return item ? (
                  <FilledSlotCard
                    key={slot.key}
                    slot={slot}
                    item={item}
                    onRemove={() => handleRemoveMeal(slot.key)}
                    onPress={() => router.push(`/recipe/${item.recipeId}` as any)}
                  />
                ) : (
                  <EmptySlotCard
                    key={slot.key}
                    slot={slot}
                    onAdd={() => handleOpenPicker(slot.key)}
                  />
                );
              })}
            </ScrollView>
          </>
        ) : (
          /* Week view */
          <WeekScheduleView
            days={weekDays}
            plans={plans}
            onEmptySlotPress={handleWeekEmptySlot}
          />
        )}
      </View>

      {/* Recipe Picker */}
      <RecipePickerSheet
        ref={pickerRef}
        slot={activeSlot}
        onSelect={handleSelectRecipe}
      />

      {/* Usage Limit Sheet */}
      <UsageLimitSheet
        ref={limitSheetRef}
        limitType={limitInfo.type}
        used={limitInfo.used}
        total={limitInfo.total}
      />

      {/* Day Action Menu */}
      <DayActionMenu
        ref={dayActionRef}
        dateLabel={actionMenuDateLabel}
        hasClipboard={!!clipboard}
        onCopy={handleCopyDay}
        onPaste={handlePasteDay}
        onClear={handleClearDay}
      />
    </TabScreenTransition>
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  screenTitle: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 28,
    color: C.charcoal,
  },
  shareBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.cardBg,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Week header
  weekHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  arrowPill: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.cardBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekLabel: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 16,
    color: C.charcoal,
    minWidth: 160,
    textAlign: 'center',
  },

  // Day selector
  dayRowClip: {
    overflow: 'hidden',
    marginBottom: 20,
  },
  dayRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 6,
  },
  dayPill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: C.ivory,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  dayPillActive: {
    backgroundColor: C.charcoal,
  },
  dayPillToday: {
    borderColor: C.terracotta,
  },
  dayLetter: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 11,
    color: C.muted,
    marginBottom: 2,
  },
  dayLetterActive: {
    color: 'rgba(255,255,255,0.6)',
  },
  dayNum: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 16,
    color: C.charcoal,
  },
  dayNumActive: {
    color: '#FFFFFF',
  },
  dotRow: {
    flexDirection: 'row',
    gap: 3,
    marginTop: 5,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.hairline,
  },
  dotFilled: {
    backgroundColor: C.gold,
  },

  // Slots scroll
  slotsScroll: {
    flex: 1,
  },
  slotsContent: {
    paddingHorizontal: 20,
    gap: 12,
  },

  // Empty card
  emptyCard: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: C.hairline,
    borderRadius: 20,
    backgroundColor: C.ivory,
  },
  emptyCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    gap: 14,
  },
  emptyCardText: {
    flex: 1,
  },
  emptyCardLabel: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 15,
    color: C.charcoal,
  },
  emptyCardHint: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 12,
    color: C.muted,
    marginTop: 1,
  },
  addCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Filled card
  filledCard: {
    backgroundColor: C.ivory,
    borderRadius: 20,
    padding: 14,
    shadowColor: '#1A1510',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  filledCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  filledThumb: {
    width: 60,
    height: 60,
    borderRadius: 14,
    backgroundColor: C.cardBg,
  },
  filledInfo: {
    flex: 1,
  },
  slotMicroLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 3,
  },
  slotMicroText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 11,
    color: C.gold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  filledTitle: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 15,
    color: C.charcoal,
    marginBottom: 2,
  },
  filledMeta: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 12,
    color: C.muted,
  },
  removeBtn: {
    padding: 4,
  },
});
