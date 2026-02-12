import { Linking, Platform } from 'react-native';
import type { Recipe } from '@/utils/types';

const WIDGET_SYNC_PATH = 'widget-sync-saved';
const WIDGET_SYNC_SCHEME = 'recipeapp://';
const MAX_WIDGET_RECIPES = 20;

type SavedRecipeWidgetItem = {
  id: string;
  title: string;
  thumbnailUrl?: string;
  totalTimeMinutes?: number;
  difficulty?: string;
  isFavorite: boolean;
  createdAt?: string;
};

type SavedRecipesWidgetPayload = {
  version: 1;
  generatedAt: number;
  recipes: SavedRecipeWidgetItem[];
};

let lastPayload = '';
let syncTimeout: ReturnType<typeof setTimeout> | null = null;

function rankRecipe(recipe: Recipe): number {
  const favoriteBoost = recipe.is_favorite ? 1000 : 0;
  const savedCopyBoost = recipe.original_recipe_id ? 250 : 0;
  const createdAtMs = recipe.created_at ? Date.parse(recipe.created_at) || 0 : 0;
  return favoriteBoost + savedCopyBoost + createdAtMs / 1000;
}

function toWidgetPayload(recipes: Recipe[]): SavedRecipesWidgetPayload {
  const normalized = recipes
    .filter((recipe) => recipe?.id && recipe?.title?.trim())
    .slice()
    .sort((a, b) => rankRecipe(b) - rankRecipe(a))
    .slice(0, MAX_WIDGET_RECIPES)
    .map<SavedRecipeWidgetItem>((recipe) => ({
      id: recipe.id,
      title: recipe.title.trim().slice(0, 44),
      thumbnailUrl: recipe.thumbnail_url?.startsWith('http') ? recipe.thumbnail_url : undefined,
      totalTimeMinutes: recipe.total_time_minutes || undefined,
      difficulty: recipe.difficulty || undefined,
      isFavorite: !!recipe.is_favorite,
      createdAt: recipe.created_at,
    }));

  return {
    version: 1,
    generatedAt: Date.now(),
    recipes: normalized,
  };
}

export function queueSavedRecipesWidgetSync(recipes: Recipe[]) {
  if (Platform.OS !== 'ios') return;

  const payload = JSON.stringify(toWidgetPayload(recipes));
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
        // Ignore sync errors to avoid blocking recipe actions.
      });
  }, 250);
}
