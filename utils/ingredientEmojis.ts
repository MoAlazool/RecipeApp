// ============================================
// INGREDIENT EMOJI MAPPING
// ============================================

import type { DimensionValue } from 'react-native';

export const INGREDIENT_EMOJIS: Record<string, string> = {
  // Produce - Vegetables
  tomato: '🍅',
  tomatoes: '🍅',
  spinach: '🥬',
  lettuce: '🥬',
  kale: '🥬',
  cabbage: '🥬',
  carrot: '🥕',
  carrots: '🥕',
  onion: '🧅',
  onions: '🧅',
  garlic: '🧄',
  potato: '🥔',
  potatoes: '🥔',
  corn: '🌽',
  broccoli: '🥦',
  cucumber: '🥒',
  zucchini: '🥒',
  pepper: '🫑',
  'bell pepper': '🫑',
  'green pepper': '🫑',
  'red pepper': '🌶️',
  chili: '🌶️',
  jalapeño: '🌶️',
  eggplant: '🍆',
  mushroom: '🍄',
  mushrooms: '🍄',
  avocado: '🥑',
  celery: '🥬',
  asparagus: '🥦',
  peas: '🫛',
  'green beans': '🫛',
  beans: '🫘',

  // Produce - Fruits
  apple: '🍎',
  apples: '🍎',
  banana: '🍌',
  bananas: '🍌',
  orange: '🍊',
  oranges: '🍊',
  lemon: '🍋',
  lemons: '🍋',
  lime: '🍋',
  grape: '🍇',
  grapes: '🍇',
  strawberry: '🍓',
  strawberries: '🍓',
  blueberry: '🫐',
  blueberries: '🫐',
  watermelon: '🍉',
  melon: '🍈',
  peach: '🍑',
  pear: '🍐',
  cherry: '🍒',
  cherries: '🍒',
  pineapple: '🍍',
  mango: '🥭',
  coconut: '🥥',
  kiwi: '🥝',

  // Dairy
  milk: '🥛',
  cheese: '🧀',
  butter: '🧈',
  egg: '🥚',
  eggs: '🥚',
  yogurt: '🥛',
  cream: '🥛',
  'sour cream': '🥛',
  'cream cheese': '🧀',
  parmesan: '🧀',
  mozzarella: '🧀',
  cheddar: '🧀',

  // Meat & Protein
  chicken: '🍗',
  'chicken breast': '🍗',
  'chicken thigh': '🍗',
  turkey: '🦃',
  beef: '🥩',
  steak: '🥩',
  'ground beef': '🥩',
  pork: '🥓',
  bacon: '🥓',
  ham: '🥓',
  sausage: '🌭',
  lamb: '🍖',
  fish: '🐟',
  salmon: '🐟',
  tuna: '🐟',
  shrimp: '🦐',
  crab: '🦀',
  lobster: '🦞',
  tofu: '🧈',

  // Bread & Grains
  bread: '🍞',
  toast: '🍞',
  rice: '🍚',
  pasta: '🍝',
  noodles: '🍜',
  'spaghetti': '🍝',
  flour: '🌾',
  oats: '🌾',
  cereal: '🥣',

  // Pantry
  oil: '🫒',
  'olive oil': '🫒',
  'vegetable oil': '🫒',
  honey: '🍯',
  sugar: '🍬',
  salt: '🧂',
  vinegar: '🫒',
  'soy sauce': '🥢',

  // Condiments
  ketchup: '🍅',
  mustard: '🟡',
  mayonnaise: '🥚',
  'hot sauce': '🌶️',

  // Beverages
  coffee: '☕',
  tea: '🍵',
  juice: '🧃',
  water: '💧',
  wine: '🍷',
  beer: '🍺',

  // Nuts & Seeds
  peanut: '🥜',
  peanuts: '🥜',
  almond: '🌰',
  almonds: '🌰',
  walnut: '🌰',
  walnuts: '🌰',
  cashew: '🌰',
  cashews: '🌰',

  // Herbs & Spices
  basil: '🌿',
  mint: '🌿',
  parsley: '🌿',
  cilantro: '🌿',
  oregano: '🌿',
  thyme: '🌿',
  rosemary: '🌿',
  ginger: '🫚',
  cinnamon: '🟤',

  // Default
  default: '🥗',
};

/**
 * Get emoji for an ingredient by name
 */
export function getIngredientEmoji(name: string): string {
  const key = name.toLowerCase().trim();

  // Try exact match first
  if (INGREDIENT_EMOJIS[key]) {
    return INGREDIENT_EMOJIS[key];
  }

  // Try partial match
  for (const [ingredientKey, emoji] of Object.entries(INGREDIENT_EMOJIS)) {
    if (key.includes(ingredientKey) || ingredientKey.includes(key)) {
      return emoji;
    }
  }

  return INGREDIENT_EMOJIS.default;
}

/**
 * Convert confidence level to percentage
 */
export function confidenceToPercent(confidence: 'high' | 'medium' | 'low'): number {
  switch (confidence) {
    case 'high':
      return 97;
    case 'medium':
      return 85;
    case 'low':
      return 68;
    default:
      return 85;
  }
}

// Background colors for ingredient cards (light mode)
export const CATEGORY_BG_COLORS: Record<string, string> = {
  produce: '#F0FDF4',
  meat: '#FEF2F2',
  dairy: '#FFF7ED',
  pantry: '#FFFBEB',
  spices: '#ECFDF5',
  frozen: '#EFF6FF',
  beverage: '#F0F9FF',
  condiment: '#FEF3C7',
  other: '#F9FAFB',
};

// Background colors for ingredient cards (dark mode)
export const CATEGORY_DARK_BG_COLORS: Record<string, string> = {
  produce: 'rgba(34, 197, 94, 0.1)',
  meat: 'rgba(239, 68, 68, 0.1)',
  dairy: 'rgba(249, 115, 22, 0.1)',
  pantry: 'rgba(234, 179, 8, 0.1)',
  spices: 'rgba(16, 185, 129, 0.1)',
  frozen: 'rgba(59, 130, 246, 0.1)',
  beverage: 'rgba(14, 165, 233, 0.1)',
  condiment: 'rgba(245, 158, 11, 0.1)',
  other: 'rgba(156, 163, 175, 0.1)',
};

/**
 * Get background colors for an ingredient card
 */
export function getIngredientColors(category: string): {
  bgColor: string;
  darkBgColor: string;
} {
  return {
    bgColor: CATEGORY_BG_COLORS[category] || '#F9FAFB',
    darkBgColor: CATEGORY_DARK_BG_COLORS[category] || 'rgba(156, 163, 175, 0.1)',
  };
}

/**
 * Generate a random position for marker display on the image
 */
export function generateMarkerPosition(
  index: number,
  total: number
): { top: DimensionValue; left: DimensionValue } {
  const cols = Math.ceil(Math.sqrt(total));
  const row = Math.floor(index / cols);
  const col = index % cols;

  const cellWidth = 60 / cols;
  const cellHeight = 40 / Math.ceil(total / cols);

  const baseTop = 25 + row * cellHeight;
  const baseLeft = 20 + col * cellWidth;

  const randomTop = baseTop + Math.random() * (cellHeight * 0.5);
  const randomLeft = baseLeft + Math.random() * (cellWidth * 0.5);

  return {
    top: `${Math.min(65, Math.max(25, randomTop))}%` as DimensionValue,
    left: `${Math.min(80, Math.max(15, randomLeft))}%` as DimensionValue,
  };
}
