import type { ExtractedRecipe, Recipe } from './types';

let _preview: ExtractedRecipe | null = null;
let _thumbnailUrl: string | undefined;

export const previewRecipe = {
  set: (recipe: ExtractedRecipe, thumbnailUrl?: string) => {
    _preview = recipe;
    _thumbnailUrl = thumbnailUrl;
  },
  get: (): Recipe | null => {
    if (!_preview) return null;
    const r = _preview;
    const now = new Date().toISOString();
    const recipe: Recipe = {
      id: '__preview__',
      user_id: '',
      source_type: 'ai_chef',
      title: r.title,
      difficulty: r.difficulty,
      total_time_minutes: r.total_time_minutes,
      original_servings: r.servings,
      current_servings: r.servings,
      ingredients: r.ingredients,
      steps: r.steps,
      is_favorite: false,
      times_cooked: 0,
      created_at: now,
      updated_at: now,
    };

    if (r.description !== undefined) recipe.description = r.description;
    if (r.cuisine_type !== undefined) recipe.cuisine_type = r.cuisine_type;
    if (r.prep_time_minutes !== undefined) recipe.prep_time_minutes = r.prep_time_minutes;
    if (r.cook_time_minutes !== undefined) recipe.cook_time_minutes = r.cook_time_minutes;
    if (r.active_time_minutes !== undefined) recipe.active_time_minutes = r.active_time_minutes;
    if (_thumbnailUrl !== undefined) recipe.thumbnail_url = _thumbnailUrl;
    if (r.nutrition_estimate?.calories !== undefined) recipe.calories = r.nutrition_estimate.calories;
    if (r.nutrition_estimate?.protein_g !== undefined) recipe.protein_g = r.nutrition_estimate.protein_g;
    if (r.nutrition_estimate?.carbs_g !== undefined) recipe.carbs_g = r.nutrition_estimate.carbs_g;
    if (r.nutrition_estimate?.fat_g !== undefined) recipe.fat_g = r.nutrition_estimate.fat_g;

    return recipe;
  },
  clear: () => {
    _preview = null;
    _thumbnailUrl = undefined;
  },
};
