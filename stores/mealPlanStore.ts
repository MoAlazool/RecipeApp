import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import {
  startOfWeek,
  addDays,
  addWeeks,
  format,
  isToday,
} from 'date-fns';
import type {
  MealPlanDay,
  MealPlanItem,
  MealPlanViewMode,
  DayNutritionSummary,
  PlannerMealSlot,
  Recipe,
  SharedMealPlanData,
} from '@/utils/types';
import { queueMealPlanWidgetSync } from '@/services/mealPlanWidget.service';

// ============================================
// HELPERS
// ============================================

function recipeToMealItem(recipe: Recipe): MealPlanItem {
  return {
    id: Crypto.randomUUID(),
    recipeId: recipe.id,
    title: recipe.title,
    thumbnailUrl: recipe.thumbnail_url,
    totalTimeMinutes: recipe.total_time_minutes,
    calories: recipe.calories,
    difficulty: recipe.difficulty,
  };
}

function getWeekStart(weekOffset: number): Date {
  return startOfWeek(addWeeks(new Date(), weekOffset), { weekStartsOn: 1 });
}

// ============================================
// STORE INTERFACE
// ============================================

interface MealPlanState {
  // Persisted
  plans: Record<string, MealPlanDay>;

  // Transient (reset on restart)
  selectedDate: string;
  weekOffset: number;
  viewMode: MealPlanViewMode;
  clipboard: MealPlanDay | null;

  // Actions
  addMeal: (date: string, slot: PlannerMealSlot, recipe: Recipe) => void;
  removeMeal: (date: string, slot: PlannerMealSlot) => void;
  getMealsForDay: (date: string) => MealPlanDay;
  getWeekDays: () => { date: string; dayLabel: string; dayNumber: string; isToday: boolean }[];
  getFilledSlotsCount: (date: string) => number;
  clearDay: (date: string) => void;
  setSelectedDate: (date: string) => void;
  setWeekOffset: (offset: number) => void;
  setViewMode: (mode: MealPlanViewMode) => void;
  copyDay: (date: string) => void;
  pasteDay: (targetDate: string) => void;
  getDayNutrition: (date: string) => DayNutritionSummary;
  getWeekNutrition: () => { totalCalories: number; totalTimeMinutes: number; filledSlots: number };
  importMealPlan: (data: SharedMealPlanData) => number;
}

// ============================================
// STORE IMPLEMENTATION
// ============================================

const todayStr = format(new Date(), 'yyyy-MM-dd');

export const useMealPlanStore = create<MealPlanState>()(
  persist(
    (set, get) => ({
      plans: {},
      selectedDate: todayStr,
      weekOffset: 0,
      viewMode: 'day' as MealPlanViewMode,
      clipboard: null,

      addMeal: (date, slot, recipe) => {
        const item = recipeToMealItem(recipe);
        set((state) => {
          const day = state.plans[date] || { date };
          return {
            plans: {
              ...state.plans,
              [date]: { ...day, [slot]: item },
            },
          };
        });
        queueMealPlanWidgetSync(get().plans, get().weekOffset);
      },

      removeMeal: (date, slot) => {
        set((state) => {
          const day = state.plans[date];
          if (!day) return state;
          const updated = { ...day, [slot]: undefined };
          return {
            plans: { ...state.plans, [date]: updated },
          };
        });
        queueMealPlanWidgetSync(get().plans, get().weekOffset);
      },

      getMealsForDay: (date) => {
        return get().plans[date] || { date };
      },

      getWeekDays: () => {
        const weekStart = getWeekStart(get().weekOffset);
        return Array.from({ length: 7 }, (_, i) => {
          const d = addDays(weekStart, i);
          return {
            date: format(d, 'yyyy-MM-dd'),
            dayLabel: format(d, 'EEEEE'), // M, T, W, ...
            dayNumber: format(d, 'd'),
            isToday: isToday(d),
          };
        });
      },

      getFilledSlotsCount: (date) => {
        const day = get().plans[date];
        if (!day) return 0;
        const slots: PlannerMealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack'];
        return slots.filter((s) => !!day[s]).length;
      },

      clearDay: (date) => {
        set((state) => {
          const { [date]: _, ...rest } = state.plans;
          return { plans: rest };
        });
        queueMealPlanWidgetSync(get().plans, get().weekOffset);
      },

      setSelectedDate: (date) => set({ selectedDate: date }),

      setWeekOffset: (offset) => {
        const weekStart = getWeekStart(offset);
        set({
          weekOffset: offset,
          selectedDate: format(
            isToday(weekStart) ? new Date() : weekStart,
            'yyyy-MM-dd'
          ),
        });
        queueMealPlanWidgetSync(get().plans, offset);
      },

      setViewMode: (mode) => set({ viewMode: mode }),

      copyDay: (date) => {
        const day = get().plans[date];
        if (!day) {
          set({ clipboard: { date } });
          return;
        }
        set({ clipboard: { ...day } });
      },

      pasteDay: (targetDate) => {
        const { clipboard } = get();
        if (!clipboard) return;

        const slots: PlannerMealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack'];
        const newDay: MealPlanDay = { date: targetDate };
        for (const slot of slots) {
          const item = clipboard[slot];
          if (item) {
            newDay[slot] = { ...item, id: Crypto.randomUUID() };
          }
        }

        set((state) => ({
          plans: { ...state.plans, [targetDate]: newDay },
          clipboard: null,
        }));
        queueMealPlanWidgetSync(get().plans, get().weekOffset);
      },

      getDayNutrition: (date) => {
        const day = get().plans[date];
        const slots: PlannerMealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack'];
        let totalCalories = 0;
        let totalTimeMinutes = 0;
        let filledSlots = 0;
        let firstRecipeId: string | null = null;

        for (const slot of slots) {
          const item = day?.[slot];
          if (item) {
            filledSlots++;
            totalCalories += item.calories || 0;
            totalTimeMinutes += item.totalTimeMinutes || 0;
            if (!firstRecipeId) firstRecipeId = item.recipeId;
          }
        }

        return { totalCalories, totalTimeMinutes, filledSlots, firstRecipeId };
      },

      getWeekNutrition: () => {
        const state = get();
        const days = state.getWeekDays();
        let totalCalories = 0;
        let totalTimeMinutes = 0;
        let filledSlots = 0;
        const slots: PlannerMealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack'];

        for (const d of days) {
          const day = state.plans[d.date];
          if (!day) continue;
          for (const slot of slots) {
            const item = day[slot];
            if (item) {
              filledSlots++;
              totalCalories += item.calories || 0;
              totalTimeMinutes += item.totalTimeMinutes || 0;
            }
          }
        }

        return { totalCalories, totalTimeMinutes, filledSlots };
      },

      importMealPlan: (data) => {
        const slots: PlannerMealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack'];
        let imported = 0;

        const importMeals = (date: string, meals: { slot: PlannerMealSlot; title: string; thumbnailUrl?: string; timeMinutes?: number; calories?: number; recipeId?: string; difficulty?: string }[]) => {
          set((state) => {
            const day: MealPlanDay = { ...state.plans[date] || { date } };
            for (const meal of meals) {
              if (slots.includes(meal.slot)) {
                day[meal.slot] = {
                  id: Crypto.randomUUID(),
                  recipeId: meal.recipeId || `shared_${Crypto.randomUUID()}`,
                  title: meal.title,
                  thumbnailUrl: meal.thumbnailUrl,
                  totalTimeMinutes: meal.timeMinutes || 0,
                  calories: meal.calories,
                  difficulty: (meal.difficulty as any) || 'beginner',
                };
                imported++;
              }
            }
            return { plans: { ...state.plans, [date]: day } };
          });
        };

        if (data.type === 'day' && data.date && data.meals) {
          importMeals(data.date, data.meals);
        } else if (data.type === 'week' && data.daySummaries) {
          for (const day of data.daySummaries) {
            if (day.date && day.meals && day.meals.length > 0) {
              importMeals(day.date, day.meals);
            }
          }
        }

        queueMealPlanWidgetSync(get().plans, get().weekOffset);
        return imported;
      },
    }),
    {
      name: 'meal-plan-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        plans: state.plans,
      }),
      onRehydrateStorage: () => (state, error) => {
        if (!error && state) {
          queueMealPlanWidgetSync(state.plans, 0);
        }
      },
    }
  )
);
