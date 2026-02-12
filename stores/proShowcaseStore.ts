import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface ProShowcaseState {
  showTab: boolean;
  userId: string | null;
  triggerForUser: (userId: string) => void;
  consumeForUser: (userId: string) => void;
  reset: () => void;
}

export const useProShowcaseStore = create<ProShowcaseState>()(
  persist(
    (set) => ({
      showTab: false,
      userId: null,

      triggerForUser: (userId: string) => set({ showTab: true, userId }),

      consumeForUser: (userId: string) =>
        set((state) => {
          if (!state.showTab || state.userId !== userId) return state;
          return { showTab: false, userId };
        }),

      reset: () => set({ showTab: false, userId: null }),
    }),
    {
      name: 'pro-showcase-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        showTab: state.showTab,
        userId: state.userId,
      }),
    }
  )
);

export default useProShowcaseStore;
