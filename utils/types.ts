// ============================================
// TYPESCRIPT TYPES - RECIPE APP
// ============================================

// ============================================
// USER TYPES
// ============================================
export interface User {
  id: string;
  email: string;
  full_name?: string;
  cooking_style?: CookingStyle;
  dietary_restrictions?: DietaryRestriction[];
  default_servings: number;
  is_premium: boolean;
  premium_expires_at?: string;
  weekly_recipe_count: number;
  weekly_scan_count: number;
  week_reset_at: string;
  created_at: string;
  updated_at: string;
}

export type CookingStyle = 'quick' | 'healthy' | 'budget' | 'protein' | 'gourmet';

export type DietaryRestriction =
  | 'vegetarian'
  | 'vegan'
  | 'gluten-free'
  | 'dairy-free'
  | 'nut-free'
  | 'halal'
  | 'kosher'
  | 'low-carb'
  | 'keto';

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'dessert';

// ============================================
// RECIPE TYPES
// ============================================
export interface Recipe {
  id: string;
  user_id: string;
  
  // Source
  source_type: RecipeSourceType;
  source_url?: string;
  video_id?: string;
  thumbnail_url?: string;
  
  // Details
  title: string;
  description?: string;
  cuisine_type?: string;
  difficulty: RecipeDifficulty;
  
  // Time
  prep_time_minutes?: number;
  cook_time_minutes?: number;
  total_time_minutes: number;
  active_time_minutes?: number;
  
  // Servings
  original_servings: number;
  current_servings: number;
  
  // Content
  ingredients: Ingredient[];
  steps: RecipeStep[];
  tools?: string[];

  // Nutrition
  calories?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
  
  // User data
  is_favorite: boolean;
  times_cooked: number;
  last_cooked_at?: string;
  user_notes?: string;
  user_rating?: number;
  user_modifications?: RecipeModification[];
  
  // AI processing
  transcript?: string;
  ai_processed_at?: string;
  
  created_at: string;
  updated_at: string;
}

export type RecipeSourceType = 'youtube' | 'manual' | 'fridge_scan' | 'tiktok' | 'instagram';

export type RecipeDifficulty = 'beginner' | 'intermediate' | 'advanced';

export interface Ingredient {
  name: string;
  amount?: number;
  unit?: IngredientUnit;
  category: IngredientCategory;
  notes?: string;
  checked?: boolean;
  is_optional?: boolean;
}

export type IngredientUnit = 
  | 'cup' | 'tbsp' | 'tsp' | 'oz' | 'lb' | 'g' | 'kg' | 'ml' | 'l'
  | 'piece' | 'clove' | 'slice' | 'bunch' | 'can' | 'package'
  | 'pinch' | 'dash' | 'to taste';

export type IngredientCategory = 
  | 'produce'
  | 'meat'
  | 'dairy'
  | 'pantry'
  | 'spices'
  | 'frozen'
  | 'beverage'
  | 'condiment'
  | 'other';

export interface RecipeStep {
  step_number: number;
  instruction: string;
  duration_minutes?: number;
  temperature?: string;
  timer_id?: string;
  image_url?: string;
  completed?: boolean;
}

export interface RecipeModification {
  type: 'ingredient' | 'technique' | 'timing' | 'seasoning';
  original: string;
  modified: string;
  impact: 'positive' | 'negative' | 'neutral';
}

// ============================================
// SHOPPING LIST TYPES
// ============================================
export interface ShoppingList {
  id: string;
  user_id: string;
  name: string;
  is_active: boolean;
  items?: ShoppingItem[];
  created_at: string;
  updated_at: string;
}

export interface ShoppingItem {
  id: string;
  list_id: string;
  recipe_id?: string;
  name: string;
  amount?: number;
  unit?: IngredientUnit;
  category: IngredientCategory;
  is_checked: boolean;
  created_at: string;
  updated_at: string;
}

export interface GroupedShoppingItems {
  [category: string]: ShoppingItem[];
}

// ============================================
// PANTRY TYPES
// ============================================
export interface PantryItem {
  id: string;
  user_id: string;
  name: string;
  amount?: number;
  unit?: IngredientUnit;
  category: IngredientCategory;
  expiry_date?: string;
  added_from: 'manual' | 'fridge_scan' | 'leftover';
  created_at: string;
  updated_at: string;
}

// ============================================
// COOKING SESSION TYPES
// ============================================
export interface CookingSession {
  id: string;
  user_id: string;
  recipe_id: string;
  recipe?: Recipe;
  current_step: number;
  servings_adjustment: number;
  active_timers: CookingTimer[];
  started_at: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface CookingTimer {
  timer_id: string;
  label: string;
  duration_seconds: number;
  started_at: string;
  is_active: boolean;
  notification_id?: string;
}

// ============================================
// AI RESPONSE TYPES
// ============================================
export interface ExtractedRecipe {
  title: string;
  description: string;
  cuisine_type?: string;
  difficulty: RecipeDifficulty;
  prep_time_minutes?: number;
  cook_time_minutes?: number;
  total_time_minutes: number;
  active_time_minutes: number;
  servings: number;
  ingredients: Ingredient[];
  steps: RecipeStep[];
  tools?: string[];
  nutrition_estimate?: {
    calories?: number;
    protein_g?: number;
    carbs_g?: number;
    fat_g?: number;
  };
  tips?: string[];
  image_url?: string;
}

export interface SuggestedRecipe {
  title: string;
  description: string;
  cuisine_type: string;
  difficulty: RecipeDifficulty;
  total_time_minutes: number;
  servings: number;
  match_score: number;
  ingredients_you_have: string[];
  ingredients_you_need: string[];
  preview_steps: string[];
  meal_type?: MealType;
  image_url?: string;
}

export interface DetectedIngredient {
  name: string;
  category: IngredientCategory;
  quantity_estimate: string;
  confidence: 'high' | 'medium' | 'low';
  confidence_percent?: number;
}

export interface FridgeScanResult {
  ingredients: DetectedIngredient[];
  total_items: number;
  notes?: string;
}

export interface FridgeScan {
  id: string;
  user_id: string;
  image_url?: string;
  ingredients: DetectedIngredient[];
  total_items: number;
  notes?: string;
  created_at: string;
}

export interface IngredientSubstitution {
  ingredient: string;
  ratio: string;
  notes: string;
  confidence: 'high' | 'medium' | 'low';
}

// ============================================
// VOICE CONTROL TYPES
// ============================================
export interface VoiceCommand {
  action: VoiceAction;
  parameters?: {
    step_number?: number;
    timer_minutes?: number;
    timer_label?: string;
  };
  confidence: 'high' | 'medium' | 'low';
}

export type VoiceAction = 
  | 'next_step'
  | 'previous_step'
  | 'repeat_step'
  | 'set_timer'
  | 'pause_timer'
  | 'cancel_timer'
  | 'read_ingredients'
  | 'help'
  | 'unknown';

// ============================================
// USAGE & LIMITS TYPES
// ============================================
export interface UsageLog {
  id: string;
  user_id: string;
  action_type: 'recipe_extract' | 'fridge_scan';
  week_number: number;
  year: number;
  created_at: string;
}

export interface UsageLimits {
  can_extract_recipe: boolean;
  can_scan_fridge: boolean;
  recipes_remaining: number;
  scans_remaining: number;
  reset_at: string;
}

// ============================================
// PREMIUM / PAYWALL TYPES
// ============================================
export interface SubscriptionPlan {
  id: string;
  name: 'Free' | 'Pro' | 'Pro+';
  price_monthly?: number;
  price_yearly?: number;
  features: PremiumFeature[];
  limits: {
    recipes_per_week?: number;
    scans_per_day?: number;
    saved_recipes?: number;
  };
}

export type PremiumFeature = 
  | 'unlimited_recipes'
  | 'unlimited_scans'
  | 'unlimited_saved'
  | 'smart_substitutions'
  | 'nutrition_info'
  | 'voice_mode'
  | 'meal_planner'
  | 'family_sharing'
  | 'priority_support';

// ============================================
// APP STATE TYPES
// ============================================
export interface AppState {
  user: User | null;
  isAuthenticated: boolean;
  currentRecipe: Recipe | null;
  cookingSession: CookingSession | null;
  shoppingList: ShoppingList | null;
  usageLimits: UsageLimits | null;
}

// ============================================
// API RESPONSE TYPES
// ============================================
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  per_page: number;
  has_more: boolean;
}

// ============================================
// FORM TYPES
// ============================================
export interface OnboardingForm {
  full_name: string;
  cooking_style?: CookingStyle;
  dietary_restrictions: DietaryRestriction[];
  default_servings: number;
}

export interface RecipeFilterOptions {
  difficulty?: RecipeDifficulty[];
  cuisine_type?: string[];
  max_time_minutes?: number;
  is_favorite?: boolean;
  source_type?: RecipeSourceType[];
}

export interface RecipeSortOption {
  field: 'created_at' | 'last_cooked_at' | 'times_cooked' | 'user_rating' | 'total_time_minutes';
  order: 'asc' | 'desc';
}

// ============================================
// UTILITY TYPES
// ============================================
export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

export interface ErrorState {
  message: string;
  code?: string;
  details?: any;
}

// ============================================
// CONSTANTS
// ============================================
export const FREE_PLAN_LIMITS = {
  recipes_per_week: 5,
  scans_per_day: 1,
  saved_recipes: 10
} as const;

export const PREMIUM_FEATURES: Record<PremiumFeature, string> = {
  unlimited_recipes: 'Unlimited recipe extractions',
  unlimited_scans: 'Unlimited fridge scans',
  unlimited_saved: 'Save unlimited recipes',
  smart_substitutions: 'AI ingredient substitutions',
  nutrition_info: 'Detailed nutrition information',
  voice_mode: 'Hands-free voice control',
  meal_planner: 'Weekly meal planner',
  family_sharing: 'Share with up to 5 family members',
  priority_support: '24/7 priority support'
} as const;

export const INGREDIENT_CATEGORIES: Record<IngredientCategory, string> = {
  produce: '🥬 Produce',
  meat: '🥩 Meat & Seafood',
  dairy: '🥛 Dairy',
  pantry: '🏺 Pantry',
  spices: '🌿 Spices & Herbs',
  frozen: '❄️ Frozen',
  beverage: '🥤 Beverages',
  condiment: '🍯 Condiments',
  other: '📦 Other'
} as const;
