// Map of food keywords to curated Unsplash images (direct links, no API needed)
// Sorted by specificity — more specific terms first to ensure best match
const IMAGE_MAP: [string, string][] = [
  // === Specific dishes (multi-word, check first) ===
  ['ice cream', 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=800&q=80'],
  ['fried rice', 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800&q=80'],
  ['stir fry', 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800&q=80'],
  ['french toast', 'https://images.unsplash.com/photo-1484723091739-30a097e8f929?w=800&q=80'],
  ['pad thai', 'https://images.unsplash.com/photo-1559314809-0d155014e29e?w=800&q=80'],
  ['fried chicken', 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=800&q=80'],
  ['grilled cheese', 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=800&q=80'],
  ['mac and cheese', 'https://images.unsplash.com/photo-1543339494-b4cd4f7ba686?w=800&q=80'],
  ['peanut butter', 'https://images.unsplash.com/photo-1598511757337-fe2cafc31ba0?w=800&q=80'],
  ['banana bread', 'https://images.unsplash.com/photo-1605090930601-67be84af1890?w=800&q=80'],
  ['mashed potato', 'https://images.unsplash.com/photo-1600984575359-310ae7b6e7c2?w=800&q=80'],
  ['hot dog', 'https://images.unsplash.com/photo-1612392062126-00a69a643c2a?w=800&q=80'],
  ['spring roll', 'https://images.unsplash.com/photo-1607330289024-1535c6b4e1c1?w=800&q=80'],
  ['panna cotta', 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=800&q=80'],
  ['creme brulee', 'https://images.unsplash.com/photo-1470124182917-cc6e71b22ecc?w=800&q=80'],
  ['chicken wing', 'https://images.unsplash.com/photo-1608039755401-742074f0548d?w=800&q=80'],
  ['pulled pork', 'https://images.unsplash.com/photo-1623653387945-2fd25214f8fc?w=800&q=80'],

  // === Breakfast ===
  ['pancake', 'https://images.unsplash.com/photo-1506084868230-bb9d95c24759?w=800&q=80'],
  ['waffle', 'https://images.unsplash.com/photo-1562376552-0d160a2f238d?w=800&q=80'],
  ['omelette', 'https://images.unsplash.com/photo-1510693206972-df098062cb71?w=800&q=80'],
  ['omelet', 'https://images.unsplash.com/photo-1510693206972-df098062cb71?w=800&q=80'],
  ['scramble', 'https://images.unsplash.com/photo-1482049016688-2d3e1b311543?w=800&q=80'],
  ['granola', 'https://images.unsplash.com/photo-1517093157656-b9eccef91cb1?w=800&q=80'],
  ['smoothie', 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=800&q=80'],
  ['cereal', 'https://images.unsplash.com/photo-1517093157656-b9eccef91cb1?w=800&q=80'],
  ['porridge', 'https://images.unsplash.com/photo-1517673132405-a56a62b18caf?w=800&q=80'],
  ['oatmeal', 'https://images.unsplash.com/photo-1517673132405-a56a62b18caf?w=800&q=80'],
  ['breakfast', 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=800&q=80'],
  ['brunch', 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=800&q=80'],
  ['egg', 'https://images.unsplash.com/photo-1482049016688-2d3e1b311543?w=800&q=80'],

  // === Pasta & Italian ===
  ['carbonara', 'https://images.unsplash.com/photo-1612874742237-6526221588e3?w=800&q=80'],
  ['lasagna', 'https://images.unsplash.com/photo-1574894709920-11b28e7367e3?w=800&q=80'],
  ['spaghetti', 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=800&q=80'],
  ['fettuccine', 'https://images.unsplash.com/photo-1612874742237-6526221588e3?w=800&q=80'],
  ['penne', 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=800&q=80'],
  ['ravioli', 'https://images.unsplash.com/photo-1587740908075-9e245070dfaa?w=800&q=80'],
  ['gnocchi', 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=800&q=80'],
  ['risotto', 'https://images.unsplash.com/photo-1633964913295-ceb43826e7c1?w=800&q=80'],
  ['bolognese', 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=800&q=80'],
  ['alfredo', 'https://images.unsplash.com/photo-1612874742237-6526221588e3?w=800&q=80'],
  ['pesto', 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=800&q=80'],
  ['bruschetta', 'https://images.unsplash.com/photo-1572695157366-5e585ab2b69f?w=800&q=80'],
  ['pizza', 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800&q=80'],
  ['pasta', 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=800&q=80'],
  ['noodle', 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=800&q=80'],
  ['italian', 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=800&q=80'],

  // === Asian ===
  ['sushi', 'https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=800&q=80'],
  ['ramen', 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=800&q=80'],
  ['pho', 'https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?w=800&q=80'],
  ['dim sum', 'https://images.unsplash.com/photo-1563245372-f21724e3856d?w=800&q=80'],
  ['dumpling', 'https://images.unsplash.com/photo-1563245372-f21724e3856d?w=800&q=80'],
  ['gyoza', 'https://images.unsplash.com/photo-1563245372-f21724e3856d?w=800&q=80'],
  ['teriyaki', 'https://images.unsplash.com/photo-1598103442097-8b74394b95c6?w=800&q=80'],
  ['tempura', 'https://images.unsplash.com/photo-1615361200141-f45040f367be?w=800&q=80'],
  ['wonton', 'https://images.unsplash.com/photo-1563245372-f21724e3856d?w=800&q=80'],
  ['bibimbap', 'https://images.unsplash.com/photo-1590301157890-4810ed352733?w=800&q=80'],
  ['kimchi', 'https://images.unsplash.com/photo-1590301157890-4810ed352733?w=800&q=80'],
  ['thai', 'https://images.unsplash.com/photo-1559314809-0d155014e29e?w=800&q=80'],
  ['chinese', 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800&q=80'],
  ['japanese', 'https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=800&q=80'],
  ['korean', 'https://images.unsplash.com/photo-1590301157890-4810ed352733?w=800&q=80'],
  ['curry', 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=800&q=80'],
  ['rice', 'https://images.unsplash.com/photo-1516684732162-798a0062be99?w=800&q=80'],
  ['asian', 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800&q=80'],

  // === Mexican / Latin ===
  ['taco', 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=800&q=80'],
  ['burrito', 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=800&q=80'],
  ['quesadilla', 'https://images.unsplash.com/photo-1618040996337-56904b7850b9?w=800&q=80'],
  ['enchilada', 'https://images.unsplash.com/photo-1599974789516-ca649c61a83c?w=800&q=80'],
  ['nachos', 'https://images.unsplash.com/photo-1582169296194-e4d644c48063?w=800&q=80'],
  ['guacamole', 'https://images.unsplash.com/photo-1600891964092-4316c288032e?w=800&q=80'],
  ['salsa', 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=800&q=80'],
  ['mexican', 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=800&q=80'],

  // === Middle Eastern / Mediterranean ===
  ['hummus', 'https://images.unsplash.com/photo-1577805947697-89e18249d767?w=800&q=80'],
  ['falafel', 'https://images.unsplash.com/photo-1593001874117-c99c800e3eb6?w=800&q=80'],
  ['shawarma', 'https://images.unsplash.com/photo-1561651188-d207bbec4ec3?w=800&q=80'],
  ['kebab', 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=800&q=80'],
  ['pita', 'https://images.unsplash.com/photo-1577805947697-89e18249d767?w=800&q=80'],
  ['greek', 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&q=80'],
  ['mediterranean', 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&q=80'],
  ['kabsa', 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800&q=80'],
  ['biryani', 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800&q=80'],
  ['mansaf', 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800&q=80'],
  ['schnitzel', 'https://images.unsplash.com/photo-1600891964092-4316c288032e?w=800&q=80'],

  // === Indian ===
  ['tikka', 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800&q=80'],
  ['masala', 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800&q=80'],
  ['naan', 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800&q=80'],
  ['tandoori', 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800&q=80'],
  ['dal', 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=800&q=80'],
  ['paneer', 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=800&q=80'],
  ['indian', 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800&q=80'],

  // === Meat dishes ===
  ['steak', 'https://images.unsplash.com/photo-1600891964092-4316c288032e?w=800&q=80'],
  ['roast', 'https://images.unsplash.com/photo-1558030006-450675393462?w=800&q=80'],
  ['ribs', 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800&q=80'],
  ['meatball', 'https://images.unsplash.com/photo-1529042410759-befb1204b468?w=800&q=80'],
  ['meatloaf', 'https://images.unsplash.com/photo-1558030006-450675393462?w=800&q=80'],
  ['chicken', 'https://images.unsplash.com/photo-1598103442097-8b74394b95c6?w=800&q=80'],
  ['beef', 'https://images.unsplash.com/photo-1558030006-450675393462?w=800&q=80'],
  ['pork', 'https://images.unsplash.com/photo-1602470520998-f4a52199a3d6?w=800&q=80'],
  ['lamb', 'https://images.unsplash.com/photo-1574672280600-4accfa5b6f98?w=800&q=80'],
  ['turkey', 'https://images.unsplash.com/photo-1574672280600-4accfa5b6f98?w=800&q=80'],
  ['duck', 'https://images.unsplash.com/photo-1574672280600-4accfa5b6f98?w=800&q=80'],
  ['bacon', 'https://images.unsplash.com/photo-1606851094655-b4e0a7d0e983?w=800&q=80'],
  ['sausage', 'https://images.unsplash.com/photo-1606851094655-b4e0a7d0e983?w=800&q=80'],

  // === Seafood ===
  ['salmon', 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=800&q=80'],
  ['tuna', 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=800&q=80'],
  ['shrimp', 'https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?w=800&q=80'],
  ['prawn', 'https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?w=800&q=80'],
  ['lobster', 'https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?w=800&q=80'],
  ['crab', 'https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?w=800&q=80'],
  ['fish', 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=800&q=80'],
  ['seafood', 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=800&q=80'],

  // === Vegetarian / Salads ===
  ['salad', 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&q=80'],
  ['vegetable', 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800&q=80'],
  ['veggie', 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800&q=80'],
  ['vegan', 'https://images.unsplash.com/photo-1547592180-85f173990554?w=800&q=80'],
  ['tofu', 'https://images.unsplash.com/photo-1546549032-9571cd6b27df?w=800&q=80'],
  ['avocado', 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&q=80'],
  ['mushroom', 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80'],

  // === Soup / Stew ===
  ['chowder', 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800&q=80'],
  ['soup', 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800&q=80'],
  ['stew', 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=800&q=80'],
  ['chili', 'https://images.unsplash.com/photo-1574894709920-11b28e7367e3?w=800&q=80'],
  ['broth', 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800&q=80'],

  // === Desserts & Sweets ===
  ['cheesecake', 'https://images.unsplash.com/photo-1533134486753-c833f0ed4866?w=800&q=80'],
  ['chocolate', 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=800&q=80'],
  ['brownie', 'https://images.unsplash.com/photo-1607920591413-4ec007e70023?w=800&q=80'],
  ['cookie', 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=800&q=80'],
  ['cupcake', 'https://images.unsplash.com/photo-1519869325930-281384150729?w=800&q=80'],
  ['muffin', 'https://images.unsplash.com/photo-1607958996333-41aef7caefaa?w=800&q=80'],
  ['donut', 'https://images.unsplash.com/photo-1551024601-bec78aea704b?w=800&q=80'],
  ['doughnut', 'https://images.unsplash.com/photo-1551024601-bec78aea704b?w=800&q=80'],
  ['pie', 'https://images.unsplash.com/photo-1535920527002-b35e96722eb9?w=800&q=80'],
  ['tart', 'https://images.unsplash.com/photo-1535920527002-b35e96722eb9?w=800&q=80'],
  ['pudding', 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=800&q=80'],
  ['mousse', 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=800&q=80'],
  ['tiramisu', 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=800&q=80'],
  ['macaron', 'https://images.unsplash.com/photo-1569864358642-9d1684040f43?w=800&q=80'],
  ['croissant', 'https://images.unsplash.com/photo-1555507036-ab1f4038024a?w=800&q=80'],
  ['pastry', 'https://images.unsplash.com/photo-1555507036-ab1f4038024a?w=800&q=80'],
  ['gelato', 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=800&q=80'],
  ['sorbet', 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=800&q=80'],
  ['frozen', 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=800&q=80'],
  ['popsicle', 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=800&q=80'],
  ['cake', 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=800&q=80'],
  ['dessert', 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=800&q=80'],
  ['sweet', 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=800&q=80'],

  // === Sandwiches / Burgers ===
  ['burger', 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&q=80'],
  ['sandwich', 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=800&q=80'],
  ['wrap', 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=800&q=80'],
  ['panini', 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=800&q=80'],
  ['sub', 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=800&q=80'],

  // === Drinks ===
  ['coffee', 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=800&q=80'],
  ['tea', 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=800&q=80'],
  ['juice', 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=800&q=80'],
  ['lemonade', 'https://images.unsplash.com/photo-1621263764928-df1444c5e859?w=800&q=80'],
  ['cocktail', 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=800&q=80'],
  ['milkshake', 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=800&q=80'],
  ['shake', 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=800&q=80'],
  ['drink', 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=800&q=80'],

  // === Bread / Baked ===
  ['bread', 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800&q=80'],
  ['toast', 'https://images.unsplash.com/photo-1484723091739-30a097e8f929?w=800&q=80'],
  ['biscuit', 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800&q=80'],
  ['scone', 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800&q=80'],
  ['baking', 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800&q=80'],

  // === Snacks ===
  ['popcorn', 'https://images.unsplash.com/photo-1585652757141-8837d027aa04?w=800&q=80'],
  ['chips', 'https://images.unsplash.com/photo-1582169296194-e4d644c48063?w=800&q=80'],
  ['fries', 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=800&q=80'],
  ['snack', 'https://images.unsplash.com/photo-1585652757141-8837d027aa04?w=800&q=80'],

  // === Broad meal types (last resort) ===
  ['dinner', 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80'],
  ['lunch', 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80'],
  ['appetizer', 'https://images.unsplash.com/photo-1572695157366-5e585ab2b69f?w=800&q=80'],
  ['side', 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800&q=80'],
];

/**
 * Find the best matching image from a search string
 */
function findMatch(text: string): string | null {
  if (!text) return null;
  const lower = text.toLowerCase();
  for (const [key, url] of IMAGE_MAP) {
    if (lower.includes(key)) {
      return url;
    }
  }
  return null;
}

/**
 * Get fallback image for recipe based on title, keywords, cuisine, or ingredients
 */
export function getRecipePlaceholderImage(
  recipeName?: string,
  cuisineType?: string,
  ingredients?: string[],
  foodKeywords?: string[]
): string {
  // 1. Check food_keywords from AI (most accurate)
  if (foodKeywords && foodKeywords.length > 0) {
    for (const keyword of foodKeywords) {
      const match = findMatch(keyword);
      if (match) return match;
    }
  }

  // 2. Check recipe name
  const nameMatch = findMatch(recipeName || '');
  if (nameMatch) return nameMatch;

  // 3. Check cuisine type
  const cuisineMatch = findMatch(cuisineType || '');
  if (cuisineMatch) return cuisineMatch;

  // 4. Check ingredients
  if (ingredients && ingredients.length > 0) {
    const ingredientText = ingredients.map((i) => i.toLowerCase()).join(' ');
    const ingredientMatch = findMatch(ingredientText);
    if (ingredientMatch) return ingredientMatch;
  }

  // Generic food fallback
  return 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80';
}

/**
 * Validate if an image URL is likely to work
 */
export function isValidImageUrl(url?: string | null): boolean {
  if (!url) return false;
  try {
    const urlObj = new URL(url);
    if (!['http:', 'https:'].includes(urlObj.protocol)) return false;
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
  ingredients?: string[],
  foodKeywords?: string[]
): string {
  // Try AI-provided image first (only if it's a real URL, not hallucinated)
  if (isValidImageUrl(aiImageUrl) && !aiImageUrl!.includes('example.com')) {
    return aiImageUrl!;
  }

  // Fall back to smart placeholder
  return getRecipePlaceholderImage(recipeName, cuisineType, ingredients, foodKeywords);
}
