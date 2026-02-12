import { addDays, addWeeks, format, startOfWeek } from 'date-fns';
import { Linking, Platform } from 'react-native';
import type { MealPlanDay, PlannerMealSlot } from '@/utils/types';

const WIDGET_SYNC_PATH = 'widget-sync';
const WIDGET_SYNC_SCHEME = 'recipeapp://';

const SLOT_ORDER: PlannerMealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack'];

type WidgetMeal = {
  slot: PlannerMealSlot;
  title: string;
  recipeId?: string;
  thumbnailUrl?: string;
  timeMinutes?: number;
  calories?: number;
  difficulty?: string;
};

type WidgetDay = {
  date: string;
  filledSlots: number;
  meals: WidgetMeal[];
};

type WidgetWeekPayload = {
  version: 1;
  weekStart: string;
  generatedAt: number;
  days: WidgetDay[];
};

let lastPayload = '';
let syncTimeout: ReturnType<typeof setTimeout> | null = null;

function toWidgetWeekPayload(plans: Record<string, MealPlanDay>, weekOffset = 0): WidgetWeekPayload {
  const weekStartDate = startOfWeek(addWeeks(new Date(), weekOffset), { weekStartsOn: 1 });

  const days: WidgetDay[] = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(weekStartDate, index);
    const dateKey = format(date, 'yyyy-MM-dd');
    const dayPlan = plans[dateKey];

    const meals: WidgetMeal[] = SLOT_ORDER.flatMap((slot) => {
      const meal = dayPlan?.[slot];
      if (!meal) return [];

      return [{
        slot,
        title: meal.title.trim().slice(0, 28),
        recipeId: meal.recipeId,
        thumbnailUrl: meal.thumbnailUrl?.startsWith('http') ? meal.thumbnailUrl : undefined,
        timeMinutes: meal.totalTimeMinutes || undefined,
        calories: meal.calories || undefined,
        difficulty: meal.difficulty || undefined,
      }];
    });

    return {
      date: dateKey,
      filledSlots: meals.length,
      meals,
    };
  });

  return {
    version: 1,
    weekStart: format(weekStartDate, 'yyyy-MM-dd'),
    generatedAt: Date.now(),
    days,
  };
}

export function queueMealPlanWidgetSync(plans: Record<string, MealPlanDay>, weekOffset = 0) {
  if (Platform.OS !== 'ios') return;

  const payload = JSON.stringify(toWidgetWeekPayload(plans, weekOffset));
  if (payload === lastPayload) return;

  if (syncTimeout) {
    clearTimeout(syncTimeout);
  }

  syncTimeout = setTimeout(() => {
    const encoded = encodeURIComponent(payload);
    const deepLink = `${WIDGET_SYNC_SCHEME}${WIDGET_SYNC_PATH}?payload=${encoded}`;

    Linking.openURL(deepLink)
      .then(() => {
        lastPayload = payload;
      })
      .catch(() => {
        // Ignore deep-link sync errors to avoid impacting planner actions.
      });
  }, 250);
}
