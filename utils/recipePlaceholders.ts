/**
 * Get fallback image for recipe based on title, ingredients, or cuisine type
 */
export function getRecipePlaceholderImage(
  recipeName?: string,
  cuisineType?: string,
  ingredients?: string[]
): string {
  const name = recipeName?.toLowerCase() || '';
  const cuisine = cuisineType?.toLowerCase() || '';
  const ingredientsList = ingredients?.map(i => i.toLowerCase()).join(' ') || '';

  // Map common food types to curated Unsplash images (direct links, no API needed)
  const imageMap: Record<string, string> = {
    // Breakfast
    'pancake': 'https://images.unsplash.com/photo-1506084868230-bb9d95c24759?w=800&q=80',
    'waffle': 'https://images.unsplash.com/photo-1562376552-0d160a2f238d?w=800&q=80',
    'egg': 'https://images.unsplash.com/photo-1482049016688-2d3e1b311543?w=800&q=80',
    'omelette': 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80',
    'french toast': 'https://images.unsplash.com/photo-1484723091739-30a097e8f929?w=800&q=80',
    'breakfast': 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=800&q=80',

    // Pasta & Italian
    'pasta': 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=800&q=80',
    'spaghetti': 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=800&q=80',
    'pizza': 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800&q=80',
    'lasagna': 'https://images.unsplash.com/photo-1574894709920-11b28e7367e3?w=800&q=80',
    'carbonara': 'https://images.unsplash.com/photo-1612874742237-6526221588e3?w=800&q=80',
    'italian': 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=800&q=80',

    // Asian
    'rice': 'https://images.unsplash.com/photo-1516684732162-798a0062be99?w=800&q=80',
    'stir fry': 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800&q=80',
    'fried rice': 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800&q=80',
    'sushi': 'https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=800&q=80',
    'ramen': 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=800&q=80',
    'curry': 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=800&q=80',
    'pad thai': 'https://images.unsplash.com/photo-1559314809-0d155014e29e?w=800&q=80',
    'asian': 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800&q=80',

    // Mexican
    'taco': 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=800&q=80',
    'burrito': 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=800&q=80',
    'quesadilla': 'https://images.unsplash.com/photo-1618040996337-56904b7850b9?w=800&q=80',
    'enchilada': 'https://images.unsplash.com/photo-1599974789516-ca649c61a83c?w=800&q=80',
    'mexican': 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=800&q=80',

    // Meat dishes
    'chicken': 'https://images.unsplash.com/photo-1598103442097-8b74394b95c6?w=800&q=80',
    'beef': 'https://images.unsplash.com/photo-1558030006-450675393462?w=800&q=80',
    'steak': 'https://images.unsplash.com/photo-1600891964092-4316c288032e?w=800&q=80',
    'pork': 'https://images.unsplash.com/photo-1602470520998-f4a52199a3d6?w=800&q=80',
    'lamb': 'https://images.unsplash.com/photo-1574672280600-4accfa5b6f98?w=800&q=80',

    // Seafood
    'fish': 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=800&q=80',
    'salmon': 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=800&q=80',
    'shrimp': 'https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?w=800&q=80',
    'seafood': 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=800&q=80',

    // Vegetarian/Salads
    'salad': 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&q=80',
    'vegetable': 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800&q=80',
    'vegan': 'https://images.unsplash.com/photo-1547592180-85f173990554?w=800&q=80',
    'tofu': 'https://images.unsplash.com/photo-1546549032-9571cd6b27df?w=800&q=80',

    // Soup/Stew
    'soup': 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800&q=80',
    'stew': 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=800&q=80',
    'chili': 'https://images.unsplash.com/photo-1574894709920-11b28e7367e3?w=800&q=80',

    // Desserts
    'cake': 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=800&q=80',
    'cookie': 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=800&q=80',
    'brownie': 'https://images.unsplash.com/photo-1607920591413-4ec007e70023?w=800&q=80',
    'ice cream': 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=800&q=80',
    'cheesecake': 'https://images.unsplash.com/photo-1533134486753-c833f0ed4866?w=800&q=80',

    // Sandwiches/Burgers
    'sandwich': 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=800&q=80',
    'burger': 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&q=80',
    'wrap': 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=800&q=80',
  };

  // Check recipe name first
  for (const [key, url] of Object.entries(imageMap)) {
    if (name.includes(key)) {
      return url;
    }
  }

  // Check cuisine type
  for (const [key, url] of Object.entries(imageMap)) {
    if (cuisine.includes(key)) {
      return url;
    }
  }

  // Check ingredients
  for (const [key, url] of Object.entries(imageMap)) {
    if (ingredientsList.includes(key)) {
      return url;
    }
  }

  // Generic food fallback
  return 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80';
}

/**
 * Validate if an image URL is likely to work
 */
export function isValidImageUrl(url?: string | null): boolean {
  if (!url) return false;

  // Check if it's a proper URL
  try {
    const urlObj = new URL(url);
    // Must be http or https
    if (!['http:', 'https:'].includes(urlObj.protocol)) return false;
    // Must have a path
    if (urlObj.pathname === '/') return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Get recipe image with fallback logic
 */
export function getRecipeImage(
  aiImageUrl?: string | null,
  recipeName?: string,
  cuisineType?: string,
  ingredients?: string[]
): string {
  // Try AI-provided image first
  if (isValidImageUrl(aiImageUrl)) {
    return aiImageUrl!;
  }

  // Fall back to smart placeholder
  return getRecipePlaceholderImage(recipeName, cuisineType, ingredients);
}
