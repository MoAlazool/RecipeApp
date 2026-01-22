import { create } from 'zustand';
import type { CookingSession, CookingTimer, Recipe } from '@/utils/types';

interface CookingState {
  session: CookingSession | null;
  recipe: Recipe | null;
  currentStep: number;
  timers: CookingTimer[];
  isVoiceEnabled: boolean;
  isPaused: boolean;

  startSession: (recipe: Recipe) => void;
  endSession: () => void;
  nextStep: () => void;
  previousStep: () => void;
  goToStep: (step: number) => void;

  addTimer: (label: string, durationSeconds: number) => string;
  setTimerNotification: (timerId: string, notificationId: string | null) => void;
  removeTimer: (timerId: string) => void;
  pauseTimer: (timerId: string) => void;
  resumeTimer: (timerId: string) => void;

  toggleVoice: () => void;
  togglePause: () => void;
}

export const useCookingStore = create<CookingState>((set, get) => ({
  session: null,
  recipe: null,
  currentStep: 0,
  timers: [],
  isVoiceEnabled: true,
  isPaused: false,

  startSession: (recipe: Recipe) => {
    const session: CookingSession = {
      id: Date.now().toString(),
      user_id: '',
      recipe_id: recipe.id,
      recipe,
      current_step: 0,
      servings_adjustment: recipe.current_servings / recipe.original_servings,
      active_timers: [],
      started_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    set({
      session,
      recipe,
      currentStep: 0,
      timers: [],
      isPaused: false,
    });
  },

  endSession: () => {
    set({
      session: null,
      recipe: null,
      currentStep: 0,
      timers: [],
      isPaused: false,
    });
  },

  nextStep: () => {
    const { recipe, currentStep } = get();
    if (recipe && currentStep < recipe.steps.length - 1) {
      set({ currentStep: currentStep + 1 });
    }
  },

  previousStep: () => {
    const { currentStep } = get();
    if (currentStep > 0) {
      set({ currentStep: currentStep - 1 });
    }
  },

  goToStep: (step: number) => {
    const { recipe } = get();
    if (recipe && step >= 0 && step < recipe.steps.length) {
      set({ currentStep: step });
    }
  },

  addTimer: (label: string, durationSeconds: number) => {
    const timer: CookingTimer = {
      timer_id: Date.now().toString(),
      label,
      duration_seconds: durationSeconds,
      started_at: new Date().toISOString(),
      is_active: true,
    };

    set((state) => ({
      timers: [...state.timers, timer],
    }));

    return timer.timer_id;
  },

  setTimerNotification: (timerId: string, notificationId: string | null) => {
    set((state) => ({
      timers: state.timers.map((timer) =>
        timer.timer_id === timerId
          ? { ...timer, notification_id: notificationId ?? undefined }
          : timer
      ),
    }));
  },

  removeTimer: (timerId: string) => {
    set((state) => ({
      timers: state.timers.filter((t) => t.timer_id !== timerId),
    }));
  },

  pauseTimer: (timerId: string) => {
    set((state) => ({
      timers: state.timers.map((t) =>
        t.timer_id === timerId ? { ...t, is_active: false } : t
      ),
    }));
  },

  resumeTimer: (timerId: string) => {
    set((state) => ({
      timers: state.timers.map((t) =>
        t.timer_id === timerId
          ? { ...t, is_active: true, started_at: new Date().toISOString() }
          : t
      ),
    }));
  },

  toggleVoice: () => {
    set((state) => ({ isVoiceEnabled: !state.isVoiceEnabled }));
  },

  togglePause: () => {
    set((state) => ({ isPaused: !state.isPaused }));
  },
}));
