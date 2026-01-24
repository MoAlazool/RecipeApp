
export interface Ingredient {
  name: string;
  inStock: boolean;
}

export interface Recipe {
  id: string;
  name: string;
  image: string;
  prepTime: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  matchPercentage: number;
  isChefChoice: boolean;
  ingredients: Ingredient[];
}

export type MealType = 'Breakfast' | 'Lunch' | 'Dinner';

export interface AppState {
  currentMealType: MealType;
  savedRecipes: string[];
  skippedRecipes: string[];
}
