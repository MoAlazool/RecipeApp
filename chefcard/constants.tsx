
import { Recipe } from './types';

export const MOCK_RECIPES: Recipe[] = [
  {
    id: '1',
    name: 'Rustic Shakshuka',
    image: 'https://images.unsplash.com/photo-1590412200988-a436970781fa?auto=format&fit=crop&q=80&w=800',
    prepTime: '15 min',
    difficulty: 'Easy',
    matchPercentage: 95,
    isChefChoice: true,
    ingredients: [
      { name: 'Tomato', inStock: true },
      { name: 'Eggs', inStock: true },
      { name: 'Spinach', inStock: true },
      { name: 'Garlic', inStock: true },
      { name: 'Onion', inStock: false },
      { name: 'Chili', inStock: false }
    ]
  },
  {
    id: '2',
    name: 'Avocado Toast Elite',
    image: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&q=80&w=800',
    prepTime: '10 min',
    difficulty: 'Easy',
    matchPercentage: 88,
    isChefChoice: false,
    ingredients: [
      { name: 'Bread', inStock: true },
      { name: 'Avocado', inStock: true },
      { name: 'Lemon', inStock: true },
      { name: 'Radish', inStock: false }
    ]
  },
  {
    id: '3',
    name: 'Egg & Mushroom Crepe',
    image: 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&q=80&w=800',
    prepTime: '20 min',
    difficulty: 'Medium',
    matchPercentage: 92,
    isChefChoice: true,
    ingredients: [
      { name: 'Flour', inStock: true },
      { name: 'Milk', inStock: true },
      { name: 'Mushrooms', inStock: true },
      { name: 'Thyme', inStock: true }
    ]
  }
];
