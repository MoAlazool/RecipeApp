import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { firebaseService } from '@/services/firebase.service';
import { FREE_PLAN_LIMITS } from '@/utils/types';

// Lazy import to avoid circular dependency
const getAuthStore = () => require('@/stores/authStore').useAuthStore;

type UsageType = 'recipe' | 'scan' | 'ai_chat';

// Serialize syncs — only one runs at a time, later callers reuse the active promise
let _activeSyncPromise: Promise<void> | null = null;

interface UsageState {
  recipesUsed: number;
  scansUsed: number;
  chatsUsed: number;
  weekResetAt: string | null;
  isLoaded: boolean;
  _incrementLock: Record<UsageType, boolean>;

  // Getters
  getRecipesRemaining: () => number;
  getScansRemaining: () => number;
  getChatsRemaining: () => number;
  canUse: (type: UsageType) => boolean;
  getDaysUntilReset: () => number;

  // Actions
  syncFromFirebase: () => Promise<void>;
  incrementUsage: (type: UsageType) => Promise<void>;
  clearAll: () => void;
}

export const useUsageStore = create<UsageState>()(
  persist(
    (set, get) => ({
      recipesUsed: 0,
      scansUsed: 0,
      chatsUsed: 0,
      weekResetAt: null,
      isLoaded: false,
      _incrementLock: { recipe: false, scan: false, ai_chat: false },

      getRecipesRemaining: () => {
        const user = getAuthStore().getState().user;
        if (user?.is_premium) return 999;
        return Math.max(0, FREE_PLAN_LIMITS.recipes_per_week - get().recipesUsed);
      },

      getScansRemaining: () => {
        const user = getAuthStore().getState().user;
        if (user?.is_premium) return 999;
        return Math.max(0, FREE_PLAN_LIMITS.scans_per_week - get().scansUsed);
      },

      getChatsRemaining: () => {
        const user = getAuthStore().getState().user;
        if (user?.is_premium) return 999;
        return Math.max(0, FREE_PLAN_LIMITS.ai_chats_per_week - get().chatsUsed);
      },

      canUse: (type: UsageType) => {
        const user = getAuthStore().getState().user;
        if (user?.is_premium) return true;

        switch (type) {
          case 'recipe':
            return get().getRecipesRemaining() > 0;
          case 'scan':
            return get().getScansRemaining() > 0;
          case 'ai_chat':
            return get().getChatsRemaining() > 0;
          default:
            return false;
        }
      },

      getDaysUntilReset: () => {
        const { weekResetAt } = get();
        if (!weekResetAt) return 7;
        const resetDate = new Date(weekResetAt);
        const nextReset = new Date(resetDate.getTime() + 7 * 24 * 60 * 60 * 1000);
        const now = new Date();
        const diff = Math.ceil((nextReset.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return Math.max(0, Math.min(7, diff));
      },

      syncFromFirebase: async () => {
        // If a sync is already running, wait for it. If it didn't load
        // (e.g. Firebase Auth wasn't ready), fall through to try again.
        if (_activeSyncPromise) {
          await _activeSyncPromise;
          if (get().isLoaded) return;
        }

        _activeSyncPromise = (async () => {
          try {
            // Check session first — if Firebase Auth hasn't restored yet,
            // skip rather than setting wrong data (remaining=0 → used=max).
            // Cached data from persist will continue to display instead.
            const session = await firebaseService.getSession();
            if (!session) return;

            const limits = await firebaseService.checkUsageLimits();
            const profile = await firebaseService.getProfile(session.user.id);
            const weekResetAt = profile?.week_reset_at || null;

            set({
              recipesUsed: Math.max(0, FREE_PLAN_LIMITS.recipes_per_week - limits.recipesRemaining),
              scansUsed: Math.max(0, FREE_PLAN_LIMITS.scans_per_week - limits.scansRemaining),
              chatsUsed: Math.max(0, FREE_PLAN_LIMITS.ai_chats_per_week - limits.chatsRemaining),
              weekResetAt,
              isLoaded: true,
            });
          } catch (error) {
            console.error('Usage sync error:', error);
            set({ isLoaded: true });
          } finally {
            _activeSyncPromise = null;
          }
        })();

        await _activeSyncPromise;
      },

      incrementUsage: async (type: UsageType) => {
        const state = get();

        // Prevent double-tap
        if (state._incrementLock[type]) return;
        set({ _incrementLock: { ...state._incrementLock, [type]: true } });

        // Optimistic update
        const prevRecipes = state.recipesUsed;
        const prevScans = state.scansUsed;
        const prevChats = state.chatsUsed;

        switch (type) {
          case 'recipe':
            set({ recipesUsed: prevRecipes + 1 });
            break;
          case 'scan':
            set({ scansUsed: prevScans + 1 });
            break;
          case 'ai_chat':
            set({ chatsUsed: prevChats + 1 });
            break;
        }

        try {
          await firebaseService.incrementUsage(type);
        } catch (error) {
          // Rollback on failure
          console.error('Failed to increment usage, rolling back:', error);
          set({
            recipesUsed: prevRecipes,
            scansUsed: prevScans,
            chatsUsed: prevChats,
          });
        } finally {
          set((s) => ({
            _incrementLock: { ...s._incrementLock, [type]: false },
          }));
        }
      },

      clearAll: () => {
        AsyncStorage.removeItem('usage-storage');
        set({
          recipesUsed: 0,
          scansUsed: 0,
          chatsUsed: 0,
          weekResetAt: null,
          isLoaded: false,
          _incrementLock: { recipe: false, scan: false, ai_chat: false },
        });
      },
    }),
    {
      name: 'usage-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        recipesUsed: state.recipesUsed,
        scansUsed: state.scansUsed,
        chatsUsed: state.chatsUsed,
        weekResetAt: state.weekResetAt,
        isLoaded: state.isLoaded,
      }),
    }
  )
);
