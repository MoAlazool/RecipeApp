import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { firebaseService } from '@/services/firebase.service';
import { youtubeService, getYouTubeThumbnail } from '@/services/youtube.service';
import { socialService } from '@/services/social.service';
import type { Recipe, ExtractedRecipe, RecipeSourceType } from '@/utils/types';

interface RecipeState {
  recipes: Recipe[];
  currentRecipe: Recipe | null;
  isLoading: boolean;
  error: string | null;

  fetchRecipes: () => Promise<void>;
  getRecipe: (id: string) => Promise<Recipe | null>;
  addRecipe: (recipe: ExtractedRecipe, sourceUrl?: string, thumbnailUrl?: string, sourceType?: RecipeSourceType) => Promise<Recipe>;
  updateRecipe: (id: string, updates: Partial<Recipe>) => Promise<void>;
  deleteRecipe: (id: string) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  setCurrentRecipe: (recipe: Recipe | null) => void;
  clearError: () => void;
  clearAll: () => void;
}

export const useRecipeStore = create<RecipeState>()(
  persist(
    (set, get) => ({
      recipes: [],
      currentRecipe: null,
      isLoading: false,
      error: null,

      fetchRecipes: async () => {
        try {
          set({ isLoading: true, error: null });
          const recipes = await firebaseService.getRecipes();
          set({ recipes, isLoading: false });
        } catch (error: any) {
          set({
            error: error.message || 'Failed to fetch recipes',
            isLoading: false,
          });
        }
      },

      getRecipe: async (id: string) => {
        try {
          const cached = get().recipes.find((r) => r.id === id);
          if (cached) {
            set({ currentRecipe: cached });
            return cached;
          }

          const recipe = await firebaseService.getRecipe(id);
          if (recipe) {
            set({ currentRecipe: recipe });
          }
          return recipe;
        } catch (error) {
          console.error('Get recipe error:', error);
          return null;
        }
      },

      addRecipe: async (extractedRecipe: ExtractedRecipe, sourceUrl?: string, providedThumbnailUrl?: string, providedSourceType?: RecipeSourceType) => {
        try {
          set({ isLoading: true, error: null });

          // Detect platform and extract video ID and thumbnail
          let thumbnailUrl: string | undefined = providedThumbnailUrl;
          let videoId: string | undefined;
          let sourceType: RecipeSourceType = providedSourceType || 'manual';

          if (sourceUrl) {
            const platform = socialService.detectPlatform(sourceUrl);
            // Only override sourceType if one wasn't explicitly provided
            if (!providedSourceType) {
              sourceType = socialService.getSourceType(platform);
            }

            // Get video metadata for thumbnail and ID
            const metadata = await socialService.getVideoMetadata(sourceUrl);
            if (metadata) {
              videoId = metadata.videoId;
              // Only use metadata thumbnail if no thumbnail was provided
              if (!thumbnailUrl) {
                thumbnailUrl = metadata.thumbnailUrl;
              }
            }

            // Fallback for YouTube thumbnails if metadata fetch failed
            if (!thumbnailUrl && platform === 'youtube') {
              const ytVideoId = youtubeService.extractVideoId(sourceUrl);
              if (ytVideoId) {
                videoId = ytVideoId;
                thumbnailUrl = getYouTubeThumbnail(ytVideoId, 'high');
              }
            }
          }

          // Map ExtractedRecipe to database schema
          // Filter out undefined values to avoid Firebase errors
          const recipeData: Partial<Recipe> = {
            title: extractedRecipe.title,
            description: extractedRecipe.description,
            cuisine_type: extractedRecipe.cuisine_type,
            difficulty: extractedRecipe.difficulty,
            prep_time_minutes: extractedRecipe.prep_time_minutes,
            cook_time_minutes: extractedRecipe.cook_time_minutes,
            total_time_minutes: extractedRecipe.total_time_minutes,
            active_time_minutes: extractedRecipe.active_time_minutes,
            original_servings: extractedRecipe.servings,
            current_servings: extractedRecipe.servings,
            ingredients: extractedRecipe.ingredients,
            steps: extractedRecipe.steps,
            tools: extractedRecipe.tools,
            ...(sourceUrl && { source_url: sourceUrl }),
            source_type: sourceType,
            ...(thumbnailUrl && { thumbnail_url: thumbnailUrl }),
            ...(videoId && { video_id: videoId }),
            // Flatten nutrition_estimate to individual columns
            ...(extractedRecipe.nutrition_estimate?.calories && { calories: extractedRecipe.nutrition_estimate.calories }),
            ...(extractedRecipe.nutrition_estimate?.protein_g && { protein_g: extractedRecipe.nutrition_estimate.protein_g }),
            ...(extractedRecipe.nutrition_estimate?.carbs_g && { carbs_g: extractedRecipe.nutrition_estimate.carbs_g }),
            ...(extractedRecipe.nutrition_estimate?.fat_g && { fat_g: extractedRecipe.nutrition_estimate.fat_g }),
          };

          const recipe = await firebaseService.createRecipe(recipeData);

          set((state) => ({
            recipes: [recipe, ...state.recipes],
            isLoading: false,
          }));

          return recipe;
        } catch (error: any) {
          set({
            error: error.message || 'Failed to add recipe',
            isLoading: false,
          });
          throw error;
        }
      },

      updateRecipe: async (id: string, updates: Partial<Recipe>) => {
        try {
          await firebaseService.updateRecipe(id, updates);

          set((state) => ({
            recipes: state.recipes.map((r) =>
              r.id === id ? { ...r, ...updates } : r
            ),
            currentRecipe:
              state.currentRecipe?.id === id
                ? { ...state.currentRecipe, ...updates }
                : state.currentRecipe,
          }));
        } catch (error) {
          console.error('Update recipe error:', error);
          throw error;
        }
      },

      deleteRecipe: async (id: string) => {
        try {
          console.log('[RecipeStore] Starting delete for recipe:', id);

          // Step 1: Delete from Firebase
          console.log('[RecipeStore] Deleting from Firebase...');
          await firebaseService.deleteRecipe(id);
          console.log('[RecipeStore] ✓ Deleted from Firebase');

          // Step 2: Update local app state immediately
          console.log('[RecipeStore] Removing from local app state...');
          set((state) => ({
            recipes: state.recipes.filter((r) => r.id !== id),
            currentRecipe:
              state.currentRecipe?.id === id ? null : state.currentRecipe,
          }));
          console.log('[RecipeStore] ✓ Removed from local app state');

          // Step 3: Refresh from database to ensure sync
          console.log('[RecipeStore] Syncing with Firebase...');
          await get().fetchRecipes();
          console.log('[RecipeStore] ✓ Synced with Firebase');
          console.log('[RecipeStore] Delete completed successfully');
        } catch (error) {
          console.error('[RecipeStore] Delete recipe error:', error);
          throw error;
        }
      },

      toggleFavorite: async (id: string) => {
        const recipe = get().recipes.find((r) => r.id === id);
        if (recipe) {
          await get().updateRecipe(id, { is_favorite: !recipe.is_favorite });
        }
      },

      setCurrentRecipe: (recipe: Recipe | null) => {
        set({ currentRecipe: recipe });
      },

      clearError: () => set({ error: null }),

      clearAll: () => {
        // Clear persisted storage
        AsyncStorage.removeItem('recipe-storage');
        set({
          recipes: [],
          currentRecipe: null,
          isLoading: false,
          error: null,
        });
      },
    }),
    {
      name: 'recipe-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        recipes: state.recipes,
      }),
    }
  )
);
