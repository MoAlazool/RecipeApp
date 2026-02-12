import React, { useRef, useEffect } from 'react';
import { View, ScrollView, Pressable, Dimensions, StyleSheet } from 'react-native';
import { Text } from '@rneui/themed';
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useBottomTabBarHeight } from '@/hooks/useBottomTabBarHeight';
import type { MealPlanDay, MealPlanItem, PlannerMealSlot } from '@/utils/types';

// ============================================================
// LAYOUT
// ============================================================

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const OUTER_PAD = 20;
const CARD_PAD = 14;
const GRID_GAP = 10;
const SLOT_WIDTH = (SCREEN_WIDTH - OUTER_PAD * 2 - CARD_PAD * 2 - GRID_GAP) / 2;
const SLOT_HEIGHT = 88;

// ============================================================
// DESIGN TOKENS
// ============================================================

const C = {
  charcoal: '#1A1510',
  gold: '#D4AF37',
  terracotta: '#C66E4E',
  muted: '#8A8578',
  hairline: 'rgba(26, 21, 16, 0.08)',
  cardBg: '#F5F3EE',
  ivory: '#FFFFFF',
};

const SLOT_CONFIG: {
  key: PlannerMealSlot;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  accent: string;
}[] = [
  { key: 'breakfast', label: 'Breakfast', icon: 'sunny-outline', tint: '#FFF7ED', accent: '#FB923C' },
  { key: 'lunch', label: 'Lunch', icon: 'restaurant-outline', tint: '#F0FDF4', accent: '#4ADE80' },
  { key: 'dinner', label: 'Dinner', icon: 'moon-outline', tint: '#EFF6FF', accent: '#60A5FA' },
  { key: 'snack', label: 'Snack', icon: 'cafe-outline', tint: '#FFFBEB', accent: '#D4AF37' },
];

// ============================================================
// PROPS
// ============================================================

interface WeekScheduleViewProps {
  days: { date: string; dayLabel: string; dayNumber: string; isToday: boolean }[];
  plans: Record<string, MealPlanDay>;
  onEmptySlotPress: (date: string, slot: PlannerMealSlot) => void;
}

// ============================================================
// FILLED SLOT — overlay card with image
// ============================================================

function FilledSlot({
  item,
  slot,
  onPress,
}: {
  item: MealPlanItem;
  slot: (typeof SLOT_CONFIG)[0];
  onPress: () => void;
}) {
  const hasImage = !!item.thumbnailUrl;
  const timeLabel =
    item.totalTimeMinutes < 60
      ? `${item.totalTimeMinutes} min`
      : `${Math.round((item.totalTimeMinutes / 60) * 2) / 2} hr`;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.slot,
        { backgroundColor: hasImage ? C.cardBg : slot.tint },
        pressed && { opacity: 0.8 },
      ]}
      onPress={onPress}
    >
      {hasImage ? (
        <>
          <ExpoImage
            source={{ uri: item.thumbnailUrl }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
          <LinearGradient
            colors={['transparent', 'rgba(26, 21, 16, 0.75)']}
            locations={[0.25, 1]}
            style={StyleSheet.absoluteFill}
          />
        </>
      ) : (
        <View style={styles.noImageBg}>
          <Ionicons name={slot.icon} size={30} color={slot.accent} />
        </View>
      )}

      {/* Meal type badge */}
      <View style={[styles.mealBadge, { backgroundColor: slot.accent }]}>
        <Ionicons name={slot.icon} size={10} color="#FFF" />
      </View>

      {/* Bottom text */}
      <View style={styles.slotBottom}>
        <Text
          style={[styles.slotTitle, !hasImage && { color: C.charcoal }]}
          numberOfLines={1}
        >
          {item.title}
        </Text>
        <Text style={[styles.slotMeta, !hasImage && { color: C.muted }]}>
          {timeLabel}
        </Text>
      </View>
    </Pressable>
  );
}

// ============================================================
// EMPTY SLOT — dashed placeholder
// ============================================================

function EmptySlot({
  slot,
  onPress,
}: {
  slot: (typeof SLOT_CONFIG)[0];
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.emptySlot, pressed && { opacity: 0.6 }]}
      onPress={onPress}
    >
      <Ionicons name={slot.icon as any} size={18} color={C.muted} style={{ opacity: 0.35 }} />
      <View style={styles.addCircle}>
        <Ionicons name="add" size={14} color={C.gold} />
      </View>
      <Text style={styles.emptyLabel}>{slot.label}</Text>
    </Pressable>
  );
}

// ============================================================
// DAY SECTION — header + 2×2 grid
// ============================================================

function DaySection({
  day,
  plan,
  onEmptySlotPress,
  index,
}: {
  day: WeekScheduleViewProps['days'][0];
  plan: MealPlanDay;
  onEmptySlotPress: WeekScheduleViewProps['onEmptySlotPress'];
  index: number;
}) {
  const router = useRouter();
  const filledCount = SLOT_CONFIG.filter((s) => plan?.[s.key]).length;

  const dayName = (() => {
    try {
      return new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(
        new Date(day.date + 'T12:00:00')
      );
    } catch {
      return day.dayLabel;
    }
  })();

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 50)
        .springify()
        .damping(18)}
      style={[styles.daySection, day.isToday && styles.daySectionToday]}
    >
      {/* Gold accent bar for today */}
      {day.isToday && <View style={styles.todayAccent} />}

      {/* Header */}
      <View style={styles.dayHeader}>
        <View style={styles.dayInfo}>
          {day.isToday && (
            <View style={styles.todayPill}>
              <Text style={styles.todayPillText}>Today</Text>
            </View>
          )}
          <Text style={[styles.dayName, day.isToday && styles.dayNameToday]}>
            {dayName}
          </Text>
          <Text style={[styles.dayNum, day.isToday && styles.dayNumToday]}>
            {day.dayNumber}
          </Text>
        </View>
        {/* Progress dots */}
        <View style={styles.progressRow}>
          {SLOT_CONFIG.map((s) => (
            <View
              key={s.key}
              style={[
                styles.progressDot,
                plan?.[s.key] ? { backgroundColor: s.accent } : {},
              ]}
            />
          ))}
          <Text style={styles.progressLabel}>{filledCount}/4</Text>
        </View>
      </View>

      {/* 2×2 meal grid */}
      <View style={styles.slotsGrid}>
        <View style={styles.slotsRow}>
          {SLOT_CONFIG.slice(0, 2).map((slot) => {
            const item = plan?.[slot.key];
            return item ? (
              <FilledSlot
                key={slot.key}
                item={item}
                slot={slot}
                onPress={() => router.push(`/recipe/${item.recipeId}`)}
              />
            ) : (
              <EmptySlot
                key={slot.key}
                slot={slot}
                onPress={() => onEmptySlotPress(day.date, slot.key)}
              />
            );
          })}
        </View>
        <View style={styles.slotsRow}>
          {SLOT_CONFIG.slice(2, 4).map((slot) => {
            const item = plan?.[slot.key];
            return item ? (
              <FilledSlot
                key={slot.key}
                item={item}
                slot={slot}
                onPress={() => router.push(`/recipe/${item.recipeId}`)}
              />
            ) : (
              <EmptySlot
                key={slot.key}
                slot={slot}
                onPress={() => onEmptySlotPress(day.date, slot.key)}
              />
            );
          })}
        </View>
      </View>
    </Animated.View>
  );
}

// ============================================================
// MAIN — vertical scroll of day cards
// ============================================================

export default function WeekScheduleView({
  days,
  plans,
  onEmptySlotPress,
}: WeekScheduleViewProps) {
  const bottomTabBarHeight = useBottomTabBarHeight();
  const scrollRef = useRef<ScrollView>(null);

  // Auto-scroll to today's card on mount
  useEffect(() => {
    const todayIdx = days.findIndex((d) => d.isToday);
    if (todayIdx > 0) {
      const sectionHeight = SLOT_HEIGHT * 2 + GRID_GAP + 40 + CARD_PAD * 2 + 14;
      const offset = Math.max(0, todayIdx * sectionHeight - 20);
      setTimeout(() => scrollRef.current?.scrollTo({ y: offset, animated: true }), 200);
    }
  }, [days]);

  return (
    <ScrollView
      ref={scrollRef}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[
        styles.scrollContent,
        { paddingBottom: bottomTabBarHeight + 24 },
      ]}
    >
      {days.map((day, index) => (
        <DaySection
          key={day.date}
          day={day}
          plan={plans[day.date] || ({ date: day.date } as MealPlanDay)}
          onEmptySlotPress={onEmptySlotPress}
          index={index}
        />
      ))}
    </ScrollView>
  );
}

// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: OUTER_PAD,
    gap: 14,
    paddingTop: 4,
  },

  // ── Day section card ──
  daySection: {
    backgroundColor: C.ivory,
    borderRadius: 20,
    padding: CARD_PAD,
    overflow: 'hidden',
    shadowColor: '#1A1510',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  daySectionToday: {
    backgroundColor: '#FFFDF7',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
  },
  todayAccent: {
    position: 'absolute',
    left: 0,
    top: 16,
    bottom: 16,
    width: 3,
    borderRadius: 1.5,
    backgroundColor: C.gold,
  },

  // ── Day header ──
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  dayInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  todayPill: {
    backgroundColor: C.gold,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  todayPillText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 10,
    color: '#FFF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dayName: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 15,
    color: C.charcoal,
  },
  dayNameToday: {
    color: C.gold,
  },
  dayNum: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 15,
    color: C.muted,
  },
  dayNumToday: {
    color: C.charcoal,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  progressDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(26, 21, 16, 0.08)',
  },
  progressLabel: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 11,
    color: C.muted,
    marginLeft: 4,
  },

  // ── Slots grid ──
  slotsGrid: {
    gap: GRID_GAP,
  },
  slotsRow: {
    flexDirection: 'row',
    gap: GRID_GAP,
  },

  // ── Filled slot ──
  slot: {
    flex: 1,
    height: SLOT_HEIGHT,
    borderRadius: 16,
    overflow: 'hidden',
  },
  mealBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noImageBg: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.15,
  },
  slotBottom: {
    position: 'absolute',
    bottom: 8,
    left: 10,
    right: 10,
  },
  slotTitle: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13,
    color: '#FFF',
    lineHeight: 17,
  },
  slotMeta: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 1,
  },

  // ── Empty slot ──
  emptySlot: {
    flex: 1,
    height: SLOT_HEIGHT,
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(26, 21, 16, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: C.ivory,
  },
  addCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyLabel: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 11,
    color: C.muted,
  },
});
