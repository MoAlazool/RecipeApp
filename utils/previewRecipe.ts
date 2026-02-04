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
    return Object.fromEntries(
      Object.entries({
        id: '__preview__',
        user_id: '',
        title: r.title,
        description: r.description,
        cuisine_type: r.cuisine_type,
        difficulty: r.difficulty,
        prep_time_minutes: r.prep_time_minutes,
        cook_time_minutes: r.cook_time_minutes,
        total_time_minutes: r.total_time_minutes,
        active_time_minutes: r.active_time_minutes,
        original_servings: r.servings,
        current_servings: r.servings,
        ingredients: r.ingredients,
        steps: r.steps,
        source_type: 'ai_chef',
        thumbnail_url: _thumbnailUrl,
        calories: r.nutrition_estimate?.calories,
        protein_g: r.nutrition_estimate?.protein_g,
        carbs_g: r.nutrition_estimate?.carbs_g,
        fat_g: r.nutrition_estimate?.fat_g,
        is_favorite: false,
        times_cooked: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).filter(([, v]) => v !== undefined)
    ) as Recipe;
  },
  clear: () => {
    _preview = null;
    _thumbnailUrl = undefined;
  },
};
