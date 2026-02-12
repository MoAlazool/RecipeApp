import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { firebaseService } from '@/services/firebase.service';
import { youtubeService, getYouTubeThumbnail } from '@/services/youtube.service';
import { socialService } from '@/services/social.service';
import { aiService } from '@/services/ai.service';
import { queueSavedRecipesWidgetSync } from '@/services/savedRecipesWidget.service';
import type { Recipe, ExtractedRecipe, RecipeSourceType } from '@/utils/types';

// Lazy import to avoid circular dependency
const getAuthStore = () => require('@/stores/authStore').useAuthStore;

const AI_IMAGE_SOURCE_TYPES: RecipeSourceType[] = ['fridge_scan', 'cookbook_scan'];

interface RecipeState {
  recipes: Recipe[];
  currentRecipe: Recipe | null;
  isLoading: boolean;
  error: string | null;
  generatingImageIds: string[]; // Track recipes currently generating images

  fetchRecipes: () => Promise<void>;
  getRecipe: (id: string) => Promise<Recipe | null>;
  addRecipe: (recipe: ExtractedRecipe, sourceUrl?: string, thumbnailUrl?: string, sourceType?: RecipeSourceType) => Promise<Recipe>;
  updateRecipe: (id: string, updates: Partial<Recipe>) => Promise<void>;
  deleteRecipe: (id: string) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  saveRecipeToMyList: (recipe: Recipe) => Promise<Recipe>;
  setCurrentRecipe: (recipe: Recipe | null) => void;
  generateRecipeImage: (recipeId: string, recipeTitle: string) => Promise<void>;
  isGeneratingImage: (recipeId: string) => boolean;
  prefetchRecipes: (ids: string[]) => Promise<void>;
  clearError: () => void;
  clearAll: () => void;
}

// In-memory cache for externally fetched recipes (not shown in user's collection)
const _externalCache = new Map<string, Recipe>();

export const useRecipeStore = create<RecipeState>()(
  persist(
    (set, get) => ({
      recipes: [],
      currentRecipe: null,
      isLoading: false,
      error: null,
      generatingImageIds: [],

      fetchRecipes: async () => {
        try {
          set({ isLoading: true, error: null });
          const recipes = await firebaseService.getRecipes();
          set({ recipes, isLoading: false });
          queueSavedRecipesWidgetSync(recipes);
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

          // Check external cache (shared/imported recipes)
          const ext = _externalCache.get(id);
          if (ext) {
            set({ currentRecipe: ext });
            return ext;
          }

          const recipe = await firebaseService.getRecipe(id);
          if (recipe) {
            _externalCache.set(recipe.id, recipe);
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

          // Use image_url from extracted recipe as final fallback (e.g., from website scraping)
          if (!thumbnailUrl && extractedRecipe.image_url) {
            thumbnailUrl = extractedRecipe.image_url;
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

          // Don't save base64 to Firestore (exceeds 1MB field limit) — upload in background
          const pendingBase64 = thumbnailUrl?.startsWith('data:') ? thumbnailUrl : null;
          if (pendingBase64) {
            delete recipeData.thumbnail_url;
          }

          // Save recipe to Firestore first (fast) — don't block on image upload
          const recipe = await firebaseService.createRecipe(recipeData);

          // Keep base64 in local state so the image shows immediately in the UI
          const localRecipe = pendingBase64
            ? { ...recipe, thumbnail_url: pendingBase64 }
            : recipe;

          set((state) => ({
            recipes: [localRecipe, ...state.recipes],
            isLoading: false,
          }));
          queueSavedRecipesWidgetSync(get().recipes);

          // Upload image to Storage in background, then update the recipe
          if (pendingBase64) {
            const base64Data = pendingBase64.split(',')[1];
            const userId = getAuthStore().getState().user?.id;
            const storagePath = `recipes/${userId}/${Date.now()}_ai.jpg`;
            firebaseService.uploadBase64Image(base64Data, storagePath).then((downloadUrl) => {
              firebaseService.updateRecipeThumbnail(recipe.id, downloadUrl).catch(() => {});
              // Update local state
              set((state) => ({
                recipes: state.recipes.map((r) =>
                  r.id === recipe.id ? { ...r, thumbnail_url: downloadUrl } : r
                ),
              }));
            }).catch((e) => {
              console.warn('Background image upload failed:', e);
            });
          } else if (!thumbnailUrl && AI_IMAGE_SOURCE_TYPES.includes(sourceType)) {
            // Generate + upload AI image in background
            aiService.generateRecipeImage(extractedRecipe.title).then((base64Image) => {
              const userId = getAuthStore().getState().user?.id;
              const storagePath = `recipes/${userId}/${Date.now()}_ai.jpg`;
              return firebaseService.uploadBase64Image(base64Image, storagePath);
            }).then((downloadUrl) => {
              firebaseService.updateRecipeThumbnail(recipe.id, downloadUrl).catch(() => {});
              set((state) => ({
                recipes: state.recipes.map((r) =>
                  r.id === recipe.id ? { ...r, thumbnail_url: downloadUrl } : r
                ),
              }));
            }).catch((e) => {
              console.warn('Background AI image generation failed:', e);
            });
          }

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
          queueSavedRecipesWidgetSync(get().recipes);
        } catch (error) {
          console.error('Update recipe error:', error);
          throw error;
        }
      },

      deleteRecipe: async (id: string) => {
        try {
          console.log('[RecipeStore] Starting delete for recipe:', id);

          // Update local state immediately so the UI feels instant
          set((state) => ({
            recipes: state.recipes.filter((r) => r.id !== id),
            currentRecipe:
              state.currentRecipe?.id === id ? null : state.currentRecipe,
          }));
          queueSavedRecipesWidgetSync(get().recipes);
          console.log('[RecipeStore] ✓ Removed from local app state');

          // Delete from Firebase in the background
          firebaseService.deleteRecipe(id).then(() => {
            console.log('[RecipeStore] ✓ Deleted from Firebase');
          }).catch((error) => {
            console.error('[RecipeStore] Firebase delete failed:', error);
          });
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

      saveRecipeToMyList: async (recipe: Recipe) => {
        try {
          set({ isLoading: true, error: null });

          // Create a copy of the recipe without the id and user_id
          // The firebaseService.createRecipe will assign the new user_id
          const recipeCopy: Partial<Recipe> = Object.fromEntries(
            Object.entries({
              title: recipe.title,
              description: recipe.description,
              cuisine_type: recipe.cuisine_type,
              difficulty: recipe.difficulty,
              prep_time_minutes: recipe.prep_time_minutes,
              cook_time_minutes: recipe.cook_time_minutes,
              total_time_minutes: recipe.total_time_minutes,
              active_time_minutes: recipe.active_time_minutes,
              original_servings: recipe.original_servings,
              current_servings: recipe.current_servings,
              ingredients: recipe.ingredients,
              steps: recipe.steps,
              source_url: recipe.source_url,
              source_type: recipe.source_type,
              thumbnail_url: recipe.thumbnail_url,
              video_id: recipe.video_id,
              calories: recipe.calories,
              protein_g: recipe.protein_g,
              carbs_g: recipe.carbs_g,
              fat_g: recipe.fat_g,
              is_favorite: false,
              times_cooked: 0,
              original_recipe_id: recipe.id, // Track the original recipe for "already saved" detection
            }).filter(([, v]) => v !== undefined)
          );

          const savedRecipe = await firebaseService.createRecipe(recipeCopy);

          set((state) => ({
            recipes: [savedRecipe, ...state.recipes],
            isLoading: false,
          }));
          queueSavedRecipesWidgetSync(get().recipes);

          return savedRecipe;
        } catch (error: any) {
          set({
            error: error.message || 'Failed to save recipe',
            isLoading: false,
          });
          throw error;
        }
      },

      setCurrentRecipe: (recipe: Recipe | null) => {
        set({ currentRecipe: recipe });
      },

      generateRecipeImage: async (recipeId: string, recipeTitle: string) => {
        // Check if already generating
        if (get().generatingImageIds.includes(recipeId)) return;

        // Add to generating list
        set((state) => ({
          generatingImageIds: [...state.generatingImageIds, recipeId],
        }));

        try {
          const base64Image = await aiService.generateRecipeImage(recipeTitle);
          const userId = getAuthStore().getState().user?.id;
          const storagePath = `recipes/${userId}/${recipeId}_ai_${Date.now()}.jpg`;
          const downloadUrl = await firebaseService.uploadBase64Image(base64Image, storagePath);

          // Update recipe with new image
          await get().updateRecipe(recipeId, { thumbnail_url: downloadUrl });
        } catch (error) {
          console.error('Failed to generate recipe image:', error);
        } finally {
          // Remove from generating list
          set((state) => ({
            generatingImageIds: state.generatingImageIds.filter((id) => id !== recipeId),
          }));
        }
      },

      isGeneratingImage: (recipeId: string) => {
        return get().generatingImageIds.includes(recipeId);
      },

      prefetchRecipes: async (ids: string[]) => {
        const ownIds = new Set(get().recipes.map((r) => r.id));
        const missing = ids.filter((id) => id && !id.startsWith('shared_') && !ownIds.has(id) && !_externalCache.has(id));
        if (missing.length === 0) return;
        const fetched = await Promise.all(
          missing.map((id) => firebaseService.getRecipe(id).catch(() => null))
        );
        for (const r of fetched) {
          if (r) _externalCache.set(r.id, r);
        }
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
        queueSavedRecipesWidgetSync([]);
      },
    }),
    {
      name: 'recipe-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        recipes: state.recipes,
      }),
      onRehydrateStorage: () => (state, error) => {
        if (!error && state) {
          queueSavedRecipesWidgetSync(state.recipes);
        }
      },
    }
  )
);
