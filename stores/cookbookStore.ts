import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { firebaseService } from '@/services/firebase.service';
import type { Cookbook } from '@/utils/types';

interface CookbookState {
  cookbooks: Cookbook[];
  isLoading: boolean;

  fetchCookbooks: () => Promise<void>;
  createCookbook: (name: string, emoji?: string) => Promise<Cookbook>;
  deleteCookbook: (id: string) => Promise<void>;
  addRecipeToCookbook: (cookbookId: string, recipeId: string) => Promise<void>;
  removeRecipeFromCookbook: (cookbookId: string, recipeId: string) => Promise<void>;
  getCookbooksForRecipe: (recipeId: string) => Cookbook[];
  clearAll: () => void;
}

export const useCookbookStore = create<CookbookState>()(
  persist(
    (set, get) => ({
      cookbooks: [],
      isLoading: false,

      fetchCookbooks: async () => {
        try {
          set({ isLoading: true });
          const cookbooks = await firebaseService.getCookbooks();
          set({ cookbooks, isLoading: false });
        } catch (error) {
          console.error('Failed to fetch cookbooks:', error);
          set({ isLoading: false });
        }
      },

      createCookbook: async (name, emoji) => {
        const cookbook = await firebaseService.createCookbook({ name, emoji });
        set((state) => ({
          cookbooks: [cookbook, ...state.cookbooks],
        }));
        return cookbook;
      },

      deleteCookbook: async (id) => {
        await firebaseService.deleteCookbook(id);
        set((state) => ({
          cookbooks: state.cookbooks.filter((c) => c.id !== id),
        }));
      },

      addRecipeToCookbook: async (cookbookId, recipeId) => {
        await firebaseService.addRecipeToCookbook(cookbookId, recipeId);
        set((state) => ({
          cookbooks: state.cookbooks.map((c) =>
            c.id === cookbookId
              ? { ...c, recipe_ids: [...c.recipe_ids, recipeId], updated_at: new Date().toISOString() }
              : c
          ),
        }));
      },

      removeRecipeFromCookbook: async (cookbookId, recipeId) => {
        await firebaseService.removeRecipeFromCookbook(cookbookId, recipeId);
        set((state) => ({
          cookbooks: state.cookbooks.map((c) =>
            c.id === cookbookId
              ? { ...c, recipe_ids: c.recipe_ids.filter((id) => id !== recipeId), updated_at: new Date().toISOString() }
              : c
          ),
        }));
      },

      getCookbooksForRecipe: (recipeId) => {
        return get().cookbooks.filter((c) => c.recipe_ids.includes(recipeId));
      },

      clearAll: () => {
        set({ cookbooks: [], isLoading: false });
      },
    }),
    {
      name: 'cookbook-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        cookbooks: state.cookbooks,
      }),
    }
  )
);
