// ============================================
// AI SERVICE - Gemini API Integration
// ============================================

import { GoogleGenerativeAI } from '@google/generative-ai';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import type {
  ExtractedRecipe,
  SuggestedRecipe,
  FridgeScanResult,
  IngredientSubstitution,
  VoiceCommand,
  Ingredient
} from '../utils/types';

// ============================================
// HELPER: Parse JSON Response Safely
// ============================================
const parseAIResponse = (response: string, silent: boolean = false): any => {
  try {
    let cleaned = response.trim();
    cleaned = cleaned.replace(/^```json\s*/i, '');
    cleaned = cleaned.replace(/^```\s*/i, '');
    cleaned = cleaned.replace(/```\s*$/i, '');

    try {
      return JSON.parse(cleaned);
    } catch (error) {
      const start = cleaned.indexOf('{');
      if (start === -1) {
        throw error;
      }

      let depth = 0;
      let inString = false;
      let escape = false;
      let end = -1;

      for (let i = start; i < cleaned.length; i += 1) {
        const char = cleaned[i];

        if (escape) {
          escape = false;
          continue;
        }

        if (char === '\\') {
          if (inString) {
            escape = true;
          }
          continue;
        }

        if (char === '"') {
          inString = !inString;
          continue;
        }

        if (inString) {
          continue;
        }

        if (char === '{') {
          depth += 1;
        } else if (char === '}') {
          depth -= 1;
          if (depth === 0) {
            end = i;
          }
        }
      }

      if (end === -1) {
        throw error;
      }

      const recovered = cleaned.slice(start, end + 1);
      return JSON.parse(recovered);
    }
  } catch (error) {
    if (!silent) {
      console.error('Failed to parse AI response:', error);
      console.error('Raw response:', response);
    }
    throw new Error('Invalid JSON response from AI');
  }
};

// ============================================
// AI PROMPTS
// ============================================
const AI_PROMPTS = {

  extractRecipe: (transcript: string, userPreferences?: any) => {
    const preferencesText = userPreferences
      ? `\nUser preferences: ${JSON.stringify(userPreferences)}`
      : '';

    return `You are a professional recipe analyzer. Extract a structured recipe from the following video transcript.

${preferencesText}

TRANSCRIPT:
${transcript}

Return ONLY valid JSON (no markdown, no backticks) with this exact structure:
{
  "title": "Short recipe name (2-5 words max)",
  "description": "One short sentence max 15 words",
  "cuisine_type": "Italian/Mexican/Asian/etc or null",
  "difficulty": "beginner/intermediate/advanced",
  "prep_time_minutes": number (total hands-on prep before cooking starts),
  "cook_time_minutes": number (SUM of all step durations that involve heat/cooking/baking/simmering/resting),
  "total_time_minutes": number (prep_time + cook_time combined),
  "active_time_minutes": number (time actively doing something, not waiting),
  "servings": number,
  "ingredients": [
    {
      "name": "ingredient name (lowercase, singular)",
      "amount": number or null,
      "unit": "cup/tbsp/tsp/gram/piece/etc or null",
      "category": "produce/meat/dairy/pantry/spices/frozen/other",
      "notes": "optional preparation notes"
    }
  ],
  "steps": [
    {
      "step_number": number,
      "instruction": "clear, concise instruction",
      "duration_minutes": number or null,
      "temperature": "350F/180C/etc or null",
      "tip": "short pro chef tip for THIS step — sensory cues, heat tricks, or plating advice (or null if not needed)"
    }
  ],
  "nutrition_estimate": {
    "calories": number (REQUIRED - always estimate),
    "protein_g": number (REQUIRED - always estimate),
    "carbs_g": number (REQUIRED - always estimate),
    "fat_g": number (REQUIRED - always estimate)
  },
  "tips": ["helpful tip 1", "helpful tip 2"] or []
}

RULES:
1. Ingredient amounts must be numbers (use decimals like 0.5 for "half")
2. Convert all measurements to standard units
3. Group similar ingredients (e.g., "2 cloves garlic, minced" = {name: "garlic", amount: 2, unit: "clove", notes: "minced"})
4. Extract ALL timings mentioned (prep, cook, rest, marinate, etc)
5. Active time = time actually doing something (not waiting for oven)
6. Difficulty: beginner (5 steps or less, basic techniques), intermediate (6-10 steps or special equipment), advanced (11+ steps or complex techniques)
7. Category ingredients correctly for shopping list grouping
8. NUTRITION IS REQUIRED: Always estimate calories, protein, carbs, and fat based on ingredients - never leave null
9. Extract any temperature settings mentioned
10. Step tips must be PRO CHEF advice: sensory cues ("listen for the sizzle"), heat management ("lower heat if edges brown too fast"), texture tests ("should jiggle slightly in center"), or plating ideas. NEVER just repeat the instruction. Set tip to null if no useful pro insight exists for that step.

CRITICAL - STEP WRITING RULES:
- Each step = ONE single action. Max 1 sentence, under 20 words.
- Do NOT mention ingredient amounts in step text — amounts are displayed separately.
- Just use ingredient names: "Season chicken with salt and pepper" NOT "Season 2 chicken breasts with 1 tsp salt and ½ tsp pepper"
- If a step has multiple actions, SPLIT into separate steps.
- Start each step with a strong verb: Dice, Sauté, Fold, Whisk, Roast, etc.
- Bad: "Take the chicken out of the fridge, pat it dry with paper towels, and then season it generously on both sides with salt and pepper." (too long, multiple actions)
- Good: Step 1 "Pat chicken dry with paper towels." Step 2 "Season both sides with salt and pepper."

CRITICAL - STEP TIMING RULES:
- duration_minutes should ONLY be set for steps that require WAITING or PASSIVE COOKING time:
  ✓ "Bake for 25 minutes" → duration_minutes: 25
  ✓ "Simmer for 15 minutes" → duration_minutes: 15
  ✓ "Let rest for 10 minutes" → duration_minutes: 10
  ✓ "Marinate for 30 minutes" → duration_minutes: 30
  ✓ "Boil until tender, about 12 minutes" → duration_minutes: 12

- duration_minutes should be NULL for active cooking steps:
  ✗ "Chop the onions" → duration_minutes: null (no waiting)
  ✗ "Mix all ingredients together" → duration_minutes: null (active work)
  ✗ "Season with salt and pepper" → duration_minutes: null (instant)
  ✗ "Add the garlic and sauté until fragrant" → duration_minutes: null (quick active cooking)
  ✗ "Preheat oven to 350F" → duration_minutes: null (background task)

- Only include times that are SPECIFICALLY mentioned or clearly implied by the cooking method

CRITICAL - TIME ACCURACY:
- cook_time_minutes MUST equal the sum of all duration_minutes from the steps (every step that involves heat, baking, simmering, boiling, frying, resting, marinating)
- prep_time_minutes = estimate of hands-on chopping/mixing time BEFORE cooking starts (analyze the ingredients: more ingredients = more prep)
- total_time_minutes = prep_time_minutes + cook_time_minutes
- If a step says "cook 5 min each side" thats 10 min total. If "bake 25-30 min" use 28. Be precise, never guess round numbers.
- Example: sauté onions 5min + simmer sauce 20min + bake 25min = cook_time_minutes: 50

Be accurate and thorough. This data will be used for cooking guidance.`;
  },

  suggestRecipesFromFridge: (ingredients: string[], userPreferences?: any) => {
    // Generate randomization seed for variety
    const varietySeed = Math.floor(Math.random() * 1000);
    const cuisineRotation = ['Italian', 'Mexican', 'Asian', 'Mediterranean', 'American', 'Middle Eastern', 'Indian', 'French', 'Greek', 'Thai', 'Japanese', 'Korean'];
    const shuffledCuisines = cuisineRotation.sort(() => Math.random() - 0.5).slice(0, 5);

    // Recently suggested recipes to avoid
    const recentlyViewed = userPreferences?.recently_viewed_recipes || [];
    const recentlyRejected = userPreferences?.recently_rejected_recipes || [];
    const excludeRecipes = [...recentlyViewed, ...recentlyRejected];

    // Cooking style preferences
    const stylePreferences = userPreferences?.style_preferences || [];
    const styleText = stylePreferences.length > 0
      ? `User style preferences: ${stylePreferences.join(', ')}`
      : '';

    // Build comprehensive preferences text
    const preferencesText = userPreferences
      ? `
═══════════════════════════════════════════════════════════════
USER PROFILE & PREFERENCES
═══════════════════════════════════════════════════════════════
Dietary restrictions: ${userPreferences.dietary_restrictions?.join(', ') || 'none'}
Cooking skill level: ${userPreferences.skill_level || 'intermediate'}
Cooking style: ${userPreferences.cooking_style || 'any'}
${styleText}
Servings needed: ${userPreferences.default_servings || 2}
Maximum cooking time: ${userPreferences.max_time_minutes ? userPreferences.max_time_minutes + ' minutes' : 'flexible'}
Difficulty preference: ${userPreferences.difficulty_level || 'any'}
Meal type: ${userPreferences.meal_type?.toUpperCase() || 'ANY'}

${excludeRecipes.length > 0 ? `
═══════════════════════════════════════════════════════════════
RECIPES TO AVOID (recently shown/rejected):
${excludeRecipes.slice(0, 10).join(', ')}
DO NOT suggest any recipe with similar names or that is essentially the same dish.
═══════════════════════════════════════════════════════════════
` : ''}
`
      : '';

    // Quantity-aware ingredient formatting
    const ingredientsList = userPreferences?.ingredients_with_quantities
      ? userPreferences.ingredients_with_quantities.map((ing: any) =>
          `${ing.name}${ing.quantity ? ` (${ing.quantity})` : ''}${ing.expiring_soon ? ' ⚠️EXPIRING SOON' : ''}`
        ).join('\n- ')
      : ingredients.join(', ');

    const recipeCount = userPreferences?.recipe_count || 6;

    return `You are an innovative, world-class chef with expertise in multiple cuisines. Your goal is to create EXCITING, VARIED recipe suggestions that make the most of available ingredients.

═══════════════════════════════════════════════════════════════
AVAILABLE INGREDIENTS IN REFRIGERATOR/PANTRY:
═══════════════════════════════════════════════════════════════
${ingredientsList}

${preferencesText}

═══════════════════════════════════════════════════════════════
VARIETY GENERATION SEED: ${varietySeed}
PRIORITIZE CUISINES: ${shuffledCuisines.join(', ')}
═══════════════════════════════════════════════════════════════

Generate EXACTLY ${recipeCount} DISTINCTLY DIFFERENT recipes. Each recipe MUST be unique in:
- Cuisine type (use the prioritized cuisines above)
- Cooking method (vary between: grilled, baked, sautéed, steamed, raw, fried, braised, roasted)
- Flavor profile (rotate: savory, sweet, spicy, tangy, umami, herby, smoky)
- Texture (mix: crispy, creamy, crunchy, tender, chewy)

Return ONLY valid JSON (no markdown, no backticks):
{
  "recipes": [
    {
      "title": "Creative Recipe Name (2-5 words, be inventive!)",
      "description": "Enticing one-sentence description (max 15 words)",
      "cuisine_type": "Specific cuisine (Italian/Thai/Mexican/etc)",
      "cooking_method": "Primary method (grilled/baked/sautéed/etc)",
      "flavor_profile": "Main flavor (spicy/savory/sweet/tangy/umami)",
      "difficulty": "beginner/intermediate/advanced",
      "total_time_minutes": number,
      "servings": number,
      "calories_per_serving": number (REQUIRED - always estimate),
      "match_score": number (0-100, based on ingredient availability),
      "ingredients_you_have": ["ingredient1", "ingredient2"],
      "ingredients_you_need": ["ingredient3"] or [],
      "why_this_recipe": "Brief explanation of why this recipe works with these ingredients",
      "preview_steps": ["Step 1", "Step 2", "Step 3"] (first 3 steps only),
      "chef_tip": "One pro tip for this recipe"
    }
  ],
  "ingredient_highlights": {
    "star_ingredient": "The ingredient with most potential",
    "expiring_priority": ["ingredients to use first"],
    "creative_pairings": ["unexpected but delicious combinations"]
  }
}

═══════════════════════════════════════════════════════════════
CRITICAL REQUIREMENTS:
═══════════════════════════════════════════════════════════════

1. VARIETY IS MANDATORY:
   - Recipe 1: Different cuisine than Recipe 2, 3, 4...
   - Recipe 2: Different cooking method than Recipe 1, 3, 4...
   - Each recipe MUST feel like a completely different meal experience
   - NO TWO RECIPES should use the same primary protein preparation
   - Mix: 1 quick/easy + 1 comfort food + 1 healthy/light + 1 adventurous + others varied

2. INGREDIENT INTELLIGENCE:
   - Prioritize recipes using ingredients marked as "EXPIRING SOON"
   - Consider ingredient quantities when suggesting (don't suggest recipes needing 6 eggs if user has 2)
   - Maximize use of available ingredients (aim for 80%+ match)
   - Missing ingredients should be common pantry staples only

3. MEAL-TYPE SPECIFIC RULES:
${userPreferences?.meal_type === 'breakfast' ? `
   ★ BREAKFAST MODE ★
   - Time limit: 5-25 minutes MAX
   - Include: 2 savory options + 2 sweet options minimum
   - Variety: eggs-based, bread-based, fruit-based, dairy-based
   - Consider: Make-ahead options, one-pan meals, no-cook options
   - FORBIDDEN: Heavy dinners, slow-cooked meats, elaborate sauces
` : ''}
${userPreferences?.meal_type === 'lunch' ? `
   ★ LUNCH MODE ★
   - Time limit: 15-40 minutes MAX
   - Include: Mix of hot and cold options
   - Variety: Salads, sandwiches/wraps, bowls, light proteins
   - Consider: Meal-prep friendly, portable options
   - FORBIDDEN: Heavy roasts, multi-hour preparations
` : ''}
${userPreferences?.meal_type === 'dinner' ? `
   ★ DINNER MODE ★
   - Time limit: 20-60 minutes
   - Include: Mix of quick weeknight + special occasion options
   - Variety: One-pot meals, sheet pan dinners, traditional proteins
   - Consider: Family-style portions, impressive presentations
   - Include at least 1 vegetarian option if ingredients allow
` : ''}
${!userPreferences?.meal_type || userPreferences?.meal_type === 'any' ? `
   ★ ANY MEAL MODE ★
   - Suggest recipes spanning breakfast, lunch, and dinner
   - Vary complexity from quick snacks to full meals
` : ''}

4. STRICT COMPLIANCE:
   - Respect ALL dietary restrictions (${userPreferences?.dietary_restrictions?.join(', ') || 'none'})
   - Stay within time limit: ${userPreferences?.max_time_minutes || 'flexible'} minutes
   - Match difficulty: ${userPreferences?.difficulty_level || 'any'}
   - NEVER repeat recipes from the exclusion list

5. CREATIVITY ENCOURAGED:
   - Suggest at least 1 unexpected/creative combination
   - Include fusion options when ingredients allow
   - Think beyond obvious recipes

Sort by match_score (highest first), then by creativity.`;
  },

  suggestSubstitution: (ingredient: string, recipeContext: string) => {
    return `You are a culinary expert helping with ingredient substitutions.

MISSING INGREDIENT: ${ingredient}
RECIPE CONTEXT: ${recipeContext}

Suggest the BEST substitute that:
1. Won't significantly change the recipe outcome
2. Is commonly available
3. Has similar properties (texture, flavor, function)

Return ONLY valid JSON:
{
  "substitutes": [
    {
      "ingredient": "substitute name",
      "ratio": "1:1 or different ratio",
      "notes": "how it will affect the recipe",
      "confidence": "high/medium/low"
    }
  ],
  "recipe_adjustments": "any changes needed to steps" or null
}

If no good substitute exists, suggest simplified alternatives or return empty array.`;
  },

  scaleRecipe: (originalServings: number, newServings: number, ingredients: any[]) => {
    return `Scale this recipe from ${originalServings} servings to ${newServings} servings.

ORIGINAL INGREDIENTS:
${JSON.stringify(ingredients, null, 2)}

Return ONLY valid JSON with scaled amounts:
{
  "ingredients": [
    {
      "name": "same as original",
      "amount": scaled_number,
      "unit": "same as original or converted if needed",
      "category": "same as original",
      "notes": "conversion notes if amount changed significantly"
    }
  ],
  "notes": "any important notes about scaling (e.g., 'Don't scale salt 1:1, adjust to taste')"
}

RULES:
1. Scale proportionally but intelligently
2. Round to practical numbers (e.g., 2.7 eggs → 3 eggs)
3. Don't scale spices/seasonings linearly (use judgment)
4. Convert units if result is awkward (e.g., 0.125 cup → 2 tbsp)
5. Note if something shouldn't scale perfectly`;
  },

  analyzeFridgeImage: () => {
    return `Analyze this fridge/pantry photo and identify ALL visible cooking ingredients with their QUANTITIES.

Return JSON: {"items":[{"n":"name","c":"category","q":"quantity estimate"}],"count":N}

Categories: produce/meat/dairy/pantry/spices/condiment/beverage/other

CRITICAL QUANTITY RULES:
- ALWAYS estimate the quantity/amount you see
- For countable items: use numbers (e.g., "3", "5", "8-10")
- For liquids: estimate volume (e.g., "1 bottle", "half carton", "500ml")
- For produce: count individual items (e.g., "4 apples", "6 tomatoes", "2 bunches")
- For packaged items: note package size if visible (e.g., "1 lb bag", "500g package")
- For partial amounts: use descriptive terms (e.g., "half", "quarter", "about 1/3")
- If uncertain about exact count: use ranges (e.g., "5-7", "about 10")

OTHER RULES:
- Include ALL visible items, not just a few
- Be specific: "roma tomatoes" not just "tomatoes"
- Group identical items with total quantity: "6 eggs" not separate entries
- Include beverages useful for cooking (milk, wine, juice)
- Count carefully - accuracy in quantity is ESSENTIAL

Examples:
✓ {"n":"eggs","c":"dairy","q":"8"}
✓ {"n":"roma tomatoes","c":"produce","q":"5"}
✓ {"n":"milk","c":"dairy","q":"1 carton (about 1L)"}
✓ {"n":"apples","c":"produce","q":"4-5"}
✓ {"n":"bell peppers","c":"produce","q":"3 (1 red, 2 green)"}
✗ {"n":"eggs","c":"dairy","q":"some"} - TOO VAGUE
✗ {"n":"tomatoes","c":"produce","q":"1"} - NOT SPECIFIC ENOUGH

If unclear image: {"items":[],"count":0,"err":"unclear"}`;
  },

  parseVoiceCommand: (command: string, context: any) => {
    return `Parse this voice command during cooking.

COMMAND: "${command}"
CURRENT STEP: ${context.currentStep}
TOTAL STEPS: ${context.totalSteps}

Return ONLY valid JSON:
{
  "action": "next_step/previous_step/repeat_step/set_timer/pause_timer/cancel_timer/read_ingredients/help/unknown",
  "parameters": {
    "step_number": number or null,
    "timer_minutes": number or null,
    "timer_label": string or null
  },
  "confidence": "high/medium/low"
}

Common commands:
- "next" / "التالي" → next_step
- "repeat" / "كرر" → repeat_step
- "back" / "رجوع" → previous_step
- "timer 10 minutes" / "ضبط مؤقت 10 دقائق" → set_timer
- "stop timer" / "إيقاف المؤقت" → cancel_timer
- "what's next" / "إيش الخطوة الجاية" → next_step
- "ingredients" / "المكونات" → read_ingredients

Be flexible with natural language variations.`;
  },

  estimateNutrition: (ingredients: any[], servings: number) => {
    return `Estimate nutritional information PER SERVING for this recipe.

INGREDIENTS:
${JSON.stringify(ingredients, null, 2)}

SERVINGS: ${servings}

Return ONLY valid JSON:
{
  "per_serving": {
    "calories": number,
    "protein_g": number,
    "carbs_g": number,
    "fat_g": number,
    "fiber_g": number,
    "sugar_g": number,
    "sodium_mg": number
  },
  "total": {
    "calories": number,
    "protein_g": number,
    "carbs_g": number,
    "fat_g": number
  },
  "confidence": "high/medium/low",
  "notes": "any significant nutritional highlights"
}

Use standard nutritional databases and cooking knowledge. Be conservative with estimates.`;
  },

  extractRecipeFromDescription: (description: string, hashtags: string[]) => {
    const hashtagsText = hashtags.length > 0
      ? `\nHASHTAGS: ${hashtags.join(', ')}`
      : '';

    return `You are a professional recipe analyzer. Extract a structured recipe from this social media video description/caption.

DESCRIPTION:
${description}
${hashtagsText}

The description may be informal, use abbreviations, or be incomplete. Use your cooking knowledge to fill in reasonable details while staying true to what's written.

Return ONLY valid JSON (no markdown, no backticks) with this exact structure:
{
  "title": "Short recipe name (2-5 words max, infer if not explicit)",
  "description": "One short sentence max 15 words",
  "cuisine_type": "Italian/Mexican/Asian/etc or null",
  "difficulty": "beginner/intermediate/advanced",
  "prep_time_minutes": number (hands-on prep time before cooking),
  "cook_time_minutes": number (SUM of all step durations with heat/cooking/baking/resting),
  "total_time_minutes": number (prep + cook combined),
  "active_time_minutes": number,
  "servings": number (default to 2-4 if not specified),
  "ingredients": [
    {
      "name": "ingredient name (lowercase, singular)",
      "amount": number or null,
      "unit": "cup/tbsp/tsp/gram/piece/etc or null",
      "category": "produce/meat/dairy/pantry/spices/frozen/other",
      "notes": "optional preparation notes"
    }
  ],
  "steps": [
    {
      "step_number": number,
      "instruction": "clear, concise instruction",
      "duration_minutes": number or null,
      "temperature": "350F/180C/etc or null",
      "tip": "short pro chef tip for THIS step — sensory cues, heat tricks, or plating advice (or null if not needed)"
    }
  ],
  "nutrition_estimate": {
    "calories": number (REQUIRED - always estimate),
    "protein_g": number (REQUIRED - always estimate),
    "carbs_g": number (REQUIRED - always estimate),
    "fat_g": number (REQUIRED - always estimate)
  },
  "tips": ["helpful tip"] or []
}

RULES:
1. If ingredients are mentioned without amounts, estimate reasonable amounts
2. If steps aren't clear, infer logical cooking steps based on the ingredients
3. Use hashtags as hints for cuisine type and dish type
4. Be creative but practical - the recipe should be cookable
5. If the description is too vague, return partial data with what you can extract
6. Ingredient amounts must be numbers (use decimals like 0.5 for "half")
7. Category ingredients correctly for shopping list grouping
8. NUTRITION IS REQUIRED: Always estimate calories, protein, carbs, and fat - never leave null

STEP WRITING RULES:
- Each step = ONE single action. Max 1 sentence, under 20 words.
- Do NOT put ingredient amounts in step text — they are shown separately.
- Use ingredient names only: "Sauté onion and garlic until fragrant" NOT "Sauté 1 diced onion and 3 cloves of minced garlic in 2 tbsp olive oil until fragrant"
- If a step has multiple actions, split into separate steps.
- Start with a strong verb: Dice, Sauté, Fold, Whisk, Roast, etc.

STEP TIMING RULES:
- duration_minutes ONLY for steps requiring WAITING (baking, simmering, resting, marinating)
- duration_minutes = null for active steps (chopping, mixing, seasoning, sautéing)
- Only include times specifically mentioned or implied by cooking method

TIME ACCURACY:
- cook_time_minutes = sum of ALL duration_minutes from steps. Calculate it precisely from the steps you write.
- prep_time_minutes = estimate chopping/prep time based on number of ingredients (more ingredients = more prep)
- total_time_minutes = prep_time_minutes + cook_time_minutes. Never guess.`;
  },

  extractRecipeFromVideoFrames: (metadata?: { title?: string; description?: string; hashtags?: string[] }) => {
    const contextText = metadata?.title || metadata?.description
      ? `\nCONTEXT FROM VIDEO:\nTitle: ${metadata?.title || 'Unknown'}\nDescription: ${metadata?.description || 'None'}\nHashtags: ${metadata?.hashtags?.join(', ') || 'None'}`
      : '';

    return `You are analyzing a cooking video thumbnail/frame to identify the recipe being prepared.

Look carefully at the image and identify:
1. What dish is being prepared
2. Visible ingredients
3. Cooking method/technique
4. Equipment being used
${contextText}

Based on your analysis, create a complete recipe.

Return ONLY valid JSON (no markdown, no backticks) with this exact structure:
{
  "title": "Short recipe name (2-5 words max)",
  "description": "One short sentence max 15 words",
  "cuisine_type": "Italian/Mexican/Asian/etc or null",
  "difficulty": "beginner/intermediate/advanced",
  "prep_time_minutes": number (hands-on prep time),
  "cook_time_minutes": number (SUM of all step durations with heat/cooking),
  "total_time_minutes": number (prep + cook combined),
  "active_time_minutes": number,
  "servings": number,
  "ingredients": [
    {
      "name": "ingredient name",
      "amount": number or null,
      "unit": "cup/tbsp/tsp/gram/piece/etc or null",
      "category": "produce/meat/dairy/pantry/spices/frozen/other",
      "notes": "optional preparation notes"
    }
  ],
  "steps": [
    {
      "step_number": number,
      "instruction": "clear, concise instruction",
      "duration_minutes": number or null,
      "temperature": "350F/180C/etc or null",
      "tip": "short pro chef tip for THIS step — sensory cues, heat tricks, or plating advice (or null if not needed)"
    }
  ],
  "nutrition_estimate": {
    "calories": number (REQUIRED - always estimate based on visible ingredients),
    "protein_g": number (REQUIRED),
    "carbs_g": number (REQUIRED),
    "fat_g": number (REQUIRED)
  },
  "tips": ["helpful tip"] or [],
  "confidence": "high/medium/low"
}

RULES:
1. Only include ingredients you can clearly identify or reasonably infer
2. Provide standard recipe steps for the identified dish
3. Be honest about confidence level
4. If image is unclear or not food-related, return minimal data with low confidence
5. Use visible equipment as hints for cooking method
6. NUTRITION IS REQUIRED: Always estimate calories and macros based on the dish type

STEP WRITING RULES:
- Each step = ONE single action. Max 1 sentence, under 20 words.
- Do NOT put ingredient amounts in step text — they are shown separately.
- Use ingredient names only: "Toss vegetables with olive oil and seasoning."
- Split complex actions into multiple steps.
- Start with a strong verb: Dice, Sauté, Fold, Whisk, Roast, etc.

STEP TIMING RULES:
- duration_minutes ONLY for steps requiring WAITING (baking, simmering, resting, marinating)
- duration_minutes = null for active steps (chopping, mixing, seasoning, sautéing)
- Only include times for cooking methods that clearly require them

TIME ACCURACY:
- cook_time_minutes = sum of ALL duration_minutes from steps
- prep_time_minutes = estimate based on ingredient count
- total_time_minutes = prep + cook. Be precise, never round.`;
  },

  extractCookbookPages: () => {
    return `You are a professional recipe extraction expert. The user has photographed one or more pages
from a physical cookbook. Extract the complete recipe from these page images.

If the recipe spans multiple pages, combine all information into a single complete recipe.

MULTI-COMPONENT RECIPES: Many recipes include multiple components — a main dish plus sides,
sauces, dressings, garnishes, or accompaniments. If the cookbook page(s) contain multiple
components (e.g., "Grilled Chicken with Caesar Salad and Garlic Bread"), you MUST tag every
ingredient and step with a "group" field so they can be displayed separately.
- Use short, clear group names: "Grilled Chicken", "Caesar Salad", "Garlic Bread"
- If there is only ONE component (single dish, no sides), omit the "group" field entirely.
- Steps should be numbered sequentially across all components (1, 2, 3...) but grouped logically.

Return ONLY valid JSON with this exact structure:
{
  "title": "Short recipe name (2-5 words max)",
  "description": "One short sentence max 15 words",
  "cuisine_type": "Italian/Mexican/Asian/etc or null",
  "difficulty": "beginner/intermediate/advanced",
  "prep_time_minutes": number (hands-on prep time),
  "cook_time_minutes": number (SUM of all step durations with heat/cooking),
  "total_time_minutes": number (prep + cook combined),
  "active_time_minutes": number,
  "servings": number,
  "ingredients": [
    { "name": "ingredient name", "amount": number, "unit": "cup/tbsp/tsp/oz/lb/g/kg/ml/l/piece/clove/slice/bunch/can/package/pinch/dash/to taste", "category": "produce/meat/dairy/pantry/spices/frozen/beverage/condiment/other", "group": "Component Name (only if multi-component)" }
  ],
  "steps": [
    { "step_number": 1, "instruction": "Short single-action instruction, under 20 words", "duration_minutes": "number or null", "temperature": "350F/180C or null", "tip": "short pro chef tip — sensory cues, heat tricks, plating (or null)", "group": "Component Name (only if multi-component)" }
  ],
  "nutrition_estimate": { "calories": number, "protein_g": number, "carbs_g": number, "fat_g": number },
  "tips": ["Helpful tip 1", "Helpful tip 2"],
  "food_keywords": ["keyword1", "keyword2"]
}

IMPORTANT for steps: Each step = ONE single action. Max 1 sentence, under 20 words.
Do NOT put ingredient amounts in step text — amounts are displayed separately as pills.
Use ingredient names only: "Season chicken with salt and pepper" not "Season 2 chicken breasts with 1 tsp salt".
Split complex actions into multiple steps. Start with a strong verb: Dice, Sauté, Fold, Whisk, etc.
Only include "duration_minutes" when there's a meaningful wait (oven time, simmering, resting).
Only include "temperature" when relevant (oven temp, oil temp).

IMPORTANT for multi-component grouping:
- Look carefully for sections like "For the sauce:", "Salad:", "Dressing:", "Marinade:", "Side:", etc.
- Each distinct component gets its own group name.
- A single-dish recipe with NO sides or sub-recipes should have NO group fields at all.
- Examples of multi-component: "Steak with Chimichurri" → groups: "Steak", "Chimichurri".
  "Chicken Shawarma Plate" → groups: "Chicken Shawarma", "Garlic Sauce", "Pickled Onions".

IMPORTANT for ingredients category: ONLY use these exact values: produce, meat, dairy, pantry, spices, frozen, beverage, condiment, other.

IMPORTANT for title: Keep it short and specific — 2 to 4 words maximum.

IMPORTANT for time accuracy:
- cook_time_minutes MUST equal the sum of ALL duration_minutes from your steps (every step with heat/baking/simmering/resting)
- prep_time_minutes = estimate hands-on chopping/mixing time based on number of ingredients
- total_time_minutes = prep_time_minutes + cook_time_minutes exactly. Never guess round numbers.
- If a step says "cook 5 min each side" that's 10 min. If "bake 25-30 min" use 28. Be precise.

IMPORTANT for food_keywords: provide 2-3 simple, common food words that best describe what the final dish looks like.

If you cannot identify a complete recipe from the images, return:
{ "error": "Could not extract a recipe from these images. Please ensure the cookbook pages are clearly visible." }
`;
  },

  parseGroceryVoice: (voiceInput: string) => {
    return `Parse this voice input and extract grocery/shopping list items with quantities.

VOICE INPUT: "${voiceInput}"

Return ONLY valid JSON:
{
  "items": [
    {
      "name": "item name (lowercase, singular form)",
      "amount": number or null,
      "unit": "piece/kg/g/cup/tbsp/tsp/ml/liter/dozen/pack/bottle/can/bag/bunch/loaf/box" or null,
      "category": "produce/meat/dairy/pantry/spices/frozen/beverage/other"
    }
  ],
  "understood": true/false,
  "message": "confirmation message or clarification needed"
}

RULES:
1. Extract ALL items mentioned
2. Parse quantities: "one bread" = amount: 1, "two kilos of rice" = amount: 2, unit: "kg"
3. Handle natural language: "a dozen eggs" = amount: 12, "half kilo chicken" = amount: 0.5, unit: "kg"
4. If no quantity specified, set amount to null
5. Assign appropriate category for shopping list grouping
6. Set understood: false if input is unclear/gibberish
7. Message should confirm what was understood: "Added 2 loaves of bread and milk"

Examples:
- "I need bread and milk" → [{name:"bread",amount:null,category:"pantry"},{name:"milk",amount:null,category:"dairy"}]
- "get me 6 eggs and butter" → [{name:"egg",amount:6,category:"dairy"},{name:"butter",amount:null,category:"dairy"}]
- "two bottles of water and a pack of pasta" → [{name:"water",amount:2,unit:"bottle",category:"beverage"},{name:"pasta",amount:1,unit:"pack",category:"pantry"}]
- "chicken breast, tomatoes, and onions" → [{name:"chicken breast",amount:null,category:"meat"},{name:"tomato",amount:null,category:"produce"},{name:"onion",amount:null,category:"produce"}]
- "I want to buy some apples and bananas" → [{name:"apple",amount:null,category:"produce"},{name:"banana",amount:null,category:"produce"}]`;
  },

  processUserNotes: (notes: string, originalRecipe: any) => {
    return `A user made these notes after cooking a recipe. Extract useful modifications.

USER NOTES: "${notes}"

ORIGINAL RECIPE: ${originalRecipe.title}

Return ONLY valid JSON:
{
  "modifications": [
    {
      "type": "ingredient_change/technique_change/timing_change/seasoning_change",
      "original": "what was in recipe",
      "modified": "what user did instead",
      "impact": "positive/negative/neutral"
    }
  ],
  "overall_sentiment": "loved_it/liked_it/okay/disappointed",
  "key_takeaways": ["takeaway 1", "takeaway 2"],
  "should_save_as_variant": boolean (true if changes are significant)
}

Extract constructive feedback that could help the user or others.`;
  }
};

// Initialize Gemini client
const gemini = new GoogleGenerativeAI(process.env.EXPO_PUBLIC_GEMINI_API_KEY!);
const systemInstruction =
  'You are a helpful cooking assistant. Always return valid JSON without markdown formatting.';
const QUALITY_TEXT_MODEL_NAME = process.env.EXPO_PUBLIC_GEMINI_TEXT_MODEL || 'gemini-2.5-flash';
const FAST_TEXT_MODEL_NAME = process.env.EXPO_PUBLIC_GEMINI_FAST_TEXT_MODEL || 'gemini-2.5-flash-lite-preview-09-2025';
const FAST_VISION_MODEL_NAME = process.env.EXPO_PUBLIC_GEMINI_FAST_VISION_MODEL || FAST_TEXT_MODEL_NAME;
const IMAGE_MODEL_NAME = process.env.EXPO_PUBLIC_GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';

const qualityTextModel = gemini.getGenerativeModel({
  model: QUALITY_TEXT_MODEL_NAME,
  systemInstruction
});
const fastTextModel = gemini.getGenerativeModel({
  model: FAST_TEXT_MODEL_NAME,
  systemInstruction
});
const qualityVisionModel = gemini.getGenerativeModel({
  model: QUALITY_TEXT_MODEL_NAME,
  systemInstruction
});
const fastVisionModel = gemini.getGenerativeModel({
  model: FAST_VISION_MODEL_NAME,
  systemInstruction
});

type ModelSpeed = 'quality' | 'fast';
type GenerationOptions = {
  temperature?: number;
  maxOutputTokens?: number;
  responseMimeType?: string;
  mode?: ModelSpeed;
};

const withFallback = async (
  context: string,
  callPrimary: () => Promise<any>,
  callFallback?: (() => Promise<any>) | null
): Promise<string> => {
  try {
    const result = await callPrimary();
    return result.response.text();
  } catch (primaryError) {
    if (!callFallback) throw primaryError;
    console.warn(`[AI] ${context} failed on fast model, retrying with quality model`, primaryError);
    const fallbackResult = await callFallback();
    return fallbackResult.response.text();
  }
};

const generateText = async (
  prompt: string,
  options?: GenerationOptions
) => {
  const mode = options?.mode ?? 'quality';
  const model = mode === 'fast' ? fastTextModel : qualityTextModel;
  const fallbackModel = mode === 'fast' ? qualityTextModel : null;
  const request = {
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }]
      }
    ],
    generationConfig: {
      temperature: options?.temperature ?? 0.7,
      maxOutputTokens: options?.maxOutputTokens ?? 4000,
      responseMimeType: options?.responseMimeType
    }
  };

  return withFallback(
    `generateText (${mode})`,
    () => model.generateContent(request),
    fallbackModel ? () => fallbackModel.generateContent(request) : null
  );
};

const generateVision = async (
  prompt: string,
  imageBase64: string,
  options?: GenerationOptions
) => {
  const mode = options?.mode ?? 'quality';
  const model = mode === 'fast' ? fastVisionModel : qualityVisionModel;
  const fallbackModel = mode === 'fast' ? qualityVisionModel : null;
  const request = {
    contents: [
      {
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: imageBase64
            }
          },
          { text: prompt }
        ]
      }
    ],
    generationConfig: {
      temperature: options?.temperature ?? 0.5,
      maxOutputTokens: options?.maxOutputTokens ?? 2000,
      responseMimeType: options?.responseMimeType
    }
  };

  return withFallback(
    `generateVision (${mode})`,
    () => model.generateContent(request),
    fallbackModel ? () => fallbackModel.generateContent(request) : null
  );
};

const generateVisionMultiImage = async (
  prompt: string,
  imagesBase64: string[],
  options?: GenerationOptions
) => {
  const mode = options?.mode ?? 'quality';
  const model = mode === 'fast' ? fastVisionModel : qualityVisionModel;
  const fallbackModel = mode === 'fast' ? qualityVisionModel : null;
  const imageParts = imagesBase64.map(data => ({
    inlineData: { mimeType: 'image/jpeg' as const, data }
  }));
  const request = {
    contents: [{
      role: 'user',
      parts: [...imageParts, { text: prompt }]
    }],
    generationConfig: {
      temperature: options?.temperature ?? 0.4,
      maxOutputTokens: options?.maxOutputTokens ?? 16384,
      responseMimeType: options?.responseMimeType
    }
  };

  return withFallback(
    `generateVisionMultiImage (${mode})`,
    () => model.generateContent(request),
    fallbackModel ? () => fallbackModel.generateContent(request) : null
  );
};

const parseWithRepair = async (rawText: string, context: string = 'unknown') => {
  try {
    return parseAIResponse(rawText, true); // Silent mode for first attempt
  } catch (error) {
    const repairStartedAt = Date.now();
    console.warn(`[AI][Repair] ${context}: repairing truncated or malformed JSON response`);
    const repairPrompt = `Fix and complete the JSON below. Return only valid JSON, no markdown or extra text.\n\n${rawText}`;
    const repaired = await generateText(repairPrompt, {
      temperature: 0,
      maxOutputTokens: 8192, // Increased token limit for repair
      responseMimeType: 'application/json'
    });
    const result = parseAIResponse(repaired, false);
    console.log(`[AI][Repair] ${context}: repaired in ${Date.now() - repairStartedAt}ms`);
    return result;
  }
};

// ============================================
// FRIDGE SCAN HELPERS
// ============================================

// Map abbreviated response {"items":[{"n":"eggs","c":"dairy","q":"12"}]} to FridgeScanResult
const mapAbbreviatedFridgeResponse = (response: any): FridgeScanResult => ({
  ingredients: (response.items || []).map((item: any) => ({
    name: item.n || item.name || 'Unknown',
    category: item.c || item.category || 'other',
    quantity_estimate: item.q || item.qty || item.quantity_estimate || '1',
    confidence: 'high' as const
  })),
  total_items: response.count ?? response.total_items ?? response.items?.length ?? 0,
  notes: response.err || response.notes || undefined
});

// Try to salvage complete items from a truncated JSON response
const salvageTruncatedFridgeResponse = (rawText: string): FridgeScanResult | null => {
  try {
    // Try to find complete item objects in the truncated response
    const itemsMatch = rawText.match(/"items"\s*:\s*\[/);
    if (!itemsMatch) return null;

    const startIdx = rawText.indexOf('[', itemsMatch.index);
    if (startIdx === -1) return null;

    // Extract individual complete items using regex
    const itemPattern = /\{"n":"([^"]+)","c":"([^"]+)","q":"([^"]+)"\}/g;
    const items: Array<{ n: string; c: string; q: string }> = [];
    let match;

    while ((match = itemPattern.exec(rawText)) !== null) {
      items.push({ n: match[1], c: match[2], q: match[3] });
    }

    if (items.length === 0) return null;

    console.log(`Salvaged ${items.length} items from truncated response`);
    return mapAbbreviatedFridgeResponse({ items, count: items.length });
  } catch (e) {
    console.error('Failed to salvage truncated response:', e);
    return null;
  }
};

class AIService {

  // ============================================
  // EXTRACT RECIPE FROM VIDEO TRANSCRIPT
  // ============================================
  async extractRecipeFromTranscript(
    transcript: string,
    userPreferences?: any
  ): Promise<ExtractedRecipe> {
    try {
      const prompt = AI_PROMPTS.extractRecipe(transcript, userPreferences);

      const responseText = await generateText(prompt, {
        temperature: 0.5,
        maxOutputTokens: 6000,
        responseMimeType: 'application/json'
      });

      const extractedRecipe = await parseWithRepair(responseText);

      // Validate required fields
      if (!extractedRecipe.title || !extractedRecipe.ingredients || !extractedRecipe.steps) {
        throw new Error('Incomplete recipe data received from AI');
      }

      return extractedRecipe;
    } catch (error) {
      console.error('Failed to extract recipe:', error);
      throw new Error('Failed to extract recipe from transcript');
    }
  }

  // ============================================
  // ANALYZE FRIDGE IMAGE
  // ============================================
  async analyzeFridgeImage(imageBase64: string): Promise<FridgeScanResult> {
    const startedAt = Date.now();
    try {
      const prompt = AI_PROMPTS.analyzeFridgeImage();

      const responseText = await generateVision(prompt, imageBase64, {
        maxOutputTokens: 2048,
        temperature: 0.2,
        responseMimeType: 'application/json',
        mode: 'fast'
      });

      // Check if response looks truncated (doesn't end with proper JSON closing)
      const trimmed = responseText.trim();
      if (!trimmed.endsWith('}')) {
        console.warn('Detected truncated response, attempting salvage...');
        const salvaged = salvageTruncatedFridgeResponse(responseText);
        if (salvaged && salvaged.ingredients.length > 0) {
          console.log(`[Perf][AI] Fridge analyze completed in ${Date.now() - startedAt}ms (salvaged)`);
          return salvaged;
        }
        // If salvage failed, try repair
      }

      let result;
      try {
        result = await parseWithRepair(responseText, 'analyzeFridgeImage');
      } catch (parseError) {
        // Last resort: try to salvage from raw text
        const salvaged = salvageTruncatedFridgeResponse(responseText);
        if (salvaged && salvaged.ingredients.length > 0) {
          console.log(`[Perf][AI] Fridge analyze completed in ${Date.now() - startedAt}ms (salvaged-after-parse)`);
          return salvaged;
        }
        throw parseError;
      }

      // Check for error in response
      if (result.err || result.error) {
        throw new Error(result.err || result.error);
      }

      // Map abbreviated format to FridgeScanResult
      // Handle both abbreviated (items/n/c/q) and full format (ingredients/name/category/quantity_estimate)
      if (result.items) {
        const mapped = mapAbbreviatedFridgeResponse(result);
        console.log(`[Perf][AI] Fridge analyze completed in ${Date.now() - startedAt}ms`);
        return mapped;
      }

      console.log(`[Perf][AI] Fridge analyze completed in ${Date.now() - startedAt}ms`);
      return result;
    } catch (error) {
      console.error('Failed to analyze fridge image:', error);
      throw new Error('Failed to analyze fridge image');
    }
  }

  // ============================================
  // SUGGEST RECIPES FROM AVAILABLE INGREDIENTS
  // ============================================
  async suggestRecipesFromIngredients(
    ingredients: string[],
    userPreferences?: any
  ): Promise<SuggestedRecipe[]> {
    const startedAt = Date.now();
    try {
      const prompt = AI_PROMPTS.suggestRecipesFromFridge(ingredients, userPreferences);

      const responseText = await generateText(prompt, {
        temperature: 0.8,
        maxOutputTokens: 8192,
        responseMimeType: 'application/json'
      });

      console.log('AI Recipe Response:', responseText.substring(0, 500));

      const result = await parseWithRepair(responseText, 'suggestRecipesFromIngredients');

      console.log('Parsed result keys:', Object.keys(result));
      console.log('Recipes count:', result.recipes?.length ?? 'undefined');

      if (!result.recipes || !Array.isArray(result.recipes)) {
        console.error('Invalid recipes response:', result);
        throw new Error('AI did not return valid recipes');
      }

      console.log(`[Perf][AI] Suggest recipes completed in ${Date.now() - startedAt}ms`);
      return result.recipes;
    } catch (error) {
      console.error('Failed to suggest recipes:', error);
      throw new Error('Failed to suggest recipes from ingredients');
    }
  }

  // ============================================
  // EXPAND SUGGESTED RECIPE TO FULL RECIPE
  // ============================================
  async expandRecipeFromSuggestion(
    suggestedRecipe: SuggestedRecipe
  ): Promise<ExtractedRecipe> {
    const startedAt = Date.now();
    try {
      const prompt = `You are a professional chef. Convert this recipe suggestion into a complete, detailed recipe with full cooking instructions.

Recipe to expand:
Title: ${suggestedRecipe.title}
Description: ${suggestedRecipe.description}
Cuisine: ${suggestedRecipe.cuisine_type}
Difficulty: ${suggestedRecipe.difficulty}
Time: ${suggestedRecipe.total_time_minutes} minutes
Servings: ${suggestedRecipe.servings}
Ingredients you have: ${suggestedRecipe.ingredients_you_have.join(', ')}
Ingredients needed: ${suggestedRecipe.ingredients_you_need.join(', ')}
Preview steps: ${suggestedRecipe.preview_steps.join(' ')}

Generate a complete recipe with:
1. Full ingredients list with amounts and units
2. Detailed, chef-quality cooking steps — one action per step, 15-30 words. Write like a mentor chef teaching a student: include sensory cues (sounds, colors, textures), visual doneness indicators, and WHY each step matters. Add a "tip" field for pro techniques. Include "ingredients_used" listing the ingredient names used in that step.
3. Prep and cook times
4. Tips if helpful
5. Nutrition estimate

Return as JSON in this exact format:
{
  "title": "Recipe Name",
  "description": "Brief description",
  "cuisine_type": "cuisine",
  "difficulty": "beginner|intermediate|advanced",
  "prep_time_minutes": 15,
  "cook_time_minutes": 30,
  "total_time_minutes": 45,
  "active_time_minutes": 20,
  "servings": 4,
  "ingredients": [
    {
      "name": "ingredient name",
      "amount": 2,
      "unit": "cups",
      "category": "produce|meat|dairy|pantry|spices|frozen|beverage|condiment|other",
      "notes": "optional note"
    }
  ],
  "steps": [
    {
      "step_number": 1,
      "instruction": "Pat chicken completely dry — this is the secret to a crispy golden sear.",
      "duration_minutes": null,
      "temperature": null,
      "ingredients_used": ["chicken breast"],
      "tip": "Moisture is the enemy of browning. The drier the surface, the better the crust."
    },
    {
      "step_number": 2,
      "instruction": "Season generously on both sides with salt and pepper, pressing the spices in gently.",
      "duration_minutes": null,
      "temperature": null,
      "ingredients_used": ["salt", "black pepper"],
      "tip": null
    },
    {
      "step_number": 3,
      "instruction": "Roast in a preheated oven until the skin turns deep golden and juices run clear.",
      "duration_minutes": 25,
      "temperature": "200°C",
      "ingredients_used": ["chicken breast"],
      "tip": "Don't open the oven door for the first 15 minutes — let the heat build up."
    },
    {
      "step_number": 4,
      "instruction": "Rest on a cutting board — this lets the juices redistribute for a moist, tender result.",
      "duration_minutes": 5,
      "temperature": null,
      "ingredients_used": ["chicken breast"],
      "tip": "Tent loosely with foil to keep warm while resting."
    }
  ],
  "nutrition_estimate": {
    "calories": 350,
    "protein_g": 25,
    "carbs_g": 40,
    "fat_g": 12
  },
  "tips": ["Helpful tip 1", "Helpful tip 2"],
  "image_url": "https://example.com/food-image.jpg (provide a real public image URL that shows this dish)"
}

IMPORTANT for title: Keep the recipe title short and specific (2-4 words max). Examples: "Garlic Butter Chicken", "Creamy Tomato Pasta". Do NOT write long titles.

IMPORTANT for description: Write an enticing 1-2 sentence description that makes the reader hungry. Use sensory language — mention textures, aromas, or flavors. Examples: "Tender chicken thighs glazed in a sticky honey-garlic sauce with a kick of chili heat.", "A velvety risotto with earthy mushrooms and a shower of aged parmesan."

IMPORTANT for steps: Write like a Michelin-star chef mentoring a home cook.
- Each step = ONE action, 1-2 sentences, 15-30 words. Be descriptive, not robotic.
- Include sensory cues: "until edges turn golden brown", "when it sizzles and pops", "until fragrant, about 30 seconds".
- Include visual doneness indicators: "the sauce should coat the back of a spoon", "bubbles should slow down".
- Explain WHY when it helps: "— this creates a flavor base for the sauce", "— resting lets juices redistribute".
- Add a "tip" field (string or null) with pro chef techniques when helpful: knife skills, timing tricks, flavor boosts, common mistakes to avoid.
- Do NOT put ingredient amounts in step text — amounts are shown separately. Use ingredient names only.
- Split complex actions into separate steps. Start each step with a strong verb.
- Include "ingredients_used" array for each step.
- Only include "duration_minutes" for meaningful wait times (baking, simmering, resting, marinating).
- Only include "temperature" when a specific heat setting is involved.

IMPORTANT for ingredients category: ONLY use one of these exact values: "produce", "meat", "dairy", "pantry", "spices", "frozen", "beverage", "condiment", "other". Do not invent new categories.

IMPORTANT for time accuracy:
- cook_time_minutes = SUM of all duration_minutes from the steps. Calculate precisely from the steps you write.
- prep_time_minutes = estimate of hands-on chopping/mixing time before cooking starts (more ingredients = more prep).
- total_time_minutes = prep_time_minutes + cook_time_minutes exactly. Never round up or pad.
- If steps add up to 22 minutes, say 22, not 30. Be honest — a simple pasta is 15-20 min, not 60.
- If a step says "cook 5 min each side" = 10 min total. If "bake 25-30 min" use 28.`;

      const responseText = await generateText(prompt, {
        temperature: 0.7,
        maxOutputTokens: 4096,
        responseMimeType: 'application/json',
        mode: 'fast'
      });

      const result = await parseWithRepair(responseText, 'expandRecipeFromSuggestion');

      // Validate required fields
      if (!result.title || !result.ingredients || !result.steps) {
        throw new Error('AI did not return a complete recipe');
      }

      console.log(`[Perf][AI] Expand recipe completed in ${Date.now() - startedAt}ms`);
      return result as ExtractedRecipe;
    } catch (error) {
      console.error('Failed to expand recipe:', error);
      throw new Error('Failed to generate full recipe details');
    }
  }

  // ============================================
  // AI CHEF CHAT - Conversational Recipe Suggestions
  // ============================================
  async chatWithChef(
    userRequest: string,
    availableIngredients: string[]
  ): Promise<{ message: string; recipes?: any[] }> {
    try {
      const prompt = `You are a friendly AI Chef assistant. The user has these ingredients in their fridge: ${availableIngredients.join(', ')}.

User request: "${userRequest}"

Provide:
1. A friendly conversational response (2-3 sentences)
2. 2-3 COMPLETE recipe suggestions with full ingredients, steps, and nutrition

Return as JSON:
{
  "message": "Your conversational response here",
  "recipes": [
    {
      "title": "Recipe Name",
      "description": "Brief description",
      "cuisine_type": "Italian",
      "difficulty": "beginner",
      "prep_time_minutes": 10,
      "cook_time_minutes": 20,
      "total_time_minutes": 30,
      "active_time_minutes": 15,
      "servings": 4,
      "match_score": 85,
      "ingredients_you_have": ["chicken", "rice"],
      "ingredients_you_need": ["soy sauce"],
      "ingredients": [
        { "name": "chicken breast", "amount": 2, "unit": "pieces", "category": "meat" },
        { "name": "rice", "amount": 1, "unit": "cup", "category": "pantry" },
        { "name": "soy sauce", "amount": 2, "unit": "tbsp", "category": "condiment" }
      ],
      "steps": [
        { "step_number": 1, "instruction": "Pat chicken dry with paper towels.", "ingredients_used": ["chicken breast"] },
        { "step_number": 2, "instruction": "Season both sides with salt and pepper.", "ingredients_used": ["salt", "black pepper"] },
        { "step_number": 3, "instruction": "Preheat oven and position rack in center.", "temperature": "200°C" },
        { "step_number": 4, "instruction": "Place chicken in oiled baking dish and roast until done.", "duration_minutes": 25, "temperature": "200°C", "ingredients_used": ["chicken breast", "olive oil"] },
        { "step_number": 5, "instruction": "Rest chicken on cutting board before slicing.", "duration_minutes": 5 }
      ],
      "nutrition_estimate": { "calories": 350, "protein_g": 25, "carbs_g": 40, "fat_g": 12 },
      "tips": ["Tip 1", "Tip 2"],
      "meal_type": "dinner",
      "food_keywords": ["chicken", "rice"]
    }
  ]
}

If they're just asking what's in their fridge or making small talk, set recipes to an empty array.

IMPORTANT for title: Keep the recipe title short and specific (2-4 words max). Examples: "Garlic Butter Chicken", "Creamy Tomato Pasta", "Beef Stir Fry". Do NOT write long titles like "Delicious Homemade Creamy Garlic Butter Chicken with Herbs". Same for description — keep it to one short sentence.

IMPORTANT for steps: Each step = ONE action, max 1 sentence, under 20 words. Do NOT put ingredient amounts in step text — amounts are shown separately. Use ingredient names only (e.g., "Sauté onion and garlic until fragrant" NOT "Sauté 1 diced onion and 3 minced garlic cloves in 2 tbsp olive oil"). Split complex actions into separate steps. Start each step with a strong verb. Include "ingredients_used" as an array of ingredient names used in that step. Only include "duration_minutes" when the step involves meaningful waiting time (baking, simmering, resting, marinating, boiling, etc.). Do NOT add duration to quick actions like chopping, seasoning, or mixing. Only include "temperature" when the step involves heat at a specific temperature (oven, stovetop setting, grill, etc.).

IMPORTANT for ingredients category: ONLY use one of these exact values: "produce", "meat", "dairy", "pantry", "spices", "frozen", "beverage", "condiment", "other". Do not invent new categories.

IMPORTANT for time accuracy: prep_time_minutes, cook_time_minutes, and total_time_minutes MUST be realistic and precise based on the actual steps. Calculate them by adding up the real durations from each step — do NOT round up or pad the time. If the steps add up to 22 minutes, say 22, not 30. total_time_minutes = prep_time_minutes + cook_time_minutes. Be honest — a simple pasta is 15-20 min, not 60.

IMPORTANT for food_keywords: provide 2-3 simple, common food words that best describe what the final dish looks like (e.g., ["ice cream", "dessert"], ["pasta", "carbonara"], ["chicken", "stir fry"], ["burger", "beef"], ["salad", "vegetable"], ["cake", "chocolate"], ["soup", "curry"]). Use generic food category words, not brand names.`;

      const responseText = await generateText(prompt, {
        temperature: 0.8,
        maxOutputTokens: 16384,
        responseMimeType: 'application/json'
      });

      const result = await parseWithRepair(responseText);

      return {
        message: result.message || "I'm here to help with recipes!",
        recipes: result.recipes || [],
      };
    } catch (error) {
      console.error('Failed to chat with chef:', error);
      return {
        message: "Sorry, I'm having trouble right now. Please try again!",
        recipes: [],
      };
    }
  }

  // ============================================
  // MODIFY RECIPE - Generate a new version
  // ============================================
  async modifyRecipe(
    modification: string,
    originalRecipe: {
      title: string;
      ingredients: { name: string; amount?: number; unit?: string; category: string }[];
      steps: { step_number: number; instruction: string; duration_minutes?: number | null; temperature?: string | null }[];
      description?: string;
      cuisine_type?: string;
      servings?: number;
    }
  ): Promise<ExtractedRecipe> {
    try {
      const ingredientList = originalRecipe.ingredients
        .map(i => [i.amount, i.unit, i.name].filter(Boolean).join(' '))
        .join('\n- ');

      const stepList = originalRecipe.steps
        .map(s => {
          let line = `${s.step_number}. ${s.instruction}`;
          if (s.duration_minutes) line += ` [${s.duration_minutes} min]`;
          if (s.temperature) line += ` [${s.temperature}]`;
          return line;
        })
        .join('\n');

      const prompt = `You are a professional chef assistant. The user wants to modify this recipe.

Original Recipe: ${originalRecipe.title}
${originalRecipe.description ? `Description: ${originalRecipe.description}` : ''}
${originalRecipe.cuisine_type ? `Cuisine: ${originalRecipe.cuisine_type}` : ''}
Servings: ${originalRecipe.servings || 4}

Original Ingredients:
- ${ingredientList}

Original Steps:
${stepList}

User's request: "${modification}"

FIRST: Check if the user's request is CLEAR and ACTIONABLE.
If the request is:
- Incomplete (e.g., "i want to", "can you", "please")
- Gibberish or random letters (e.g., "asdf", "j", "xxx")
- Too vague to understand (e.g., "change it", "fix")
- Not related to modifying the recipe

Then return this JSON:
{
  "error": true,
  "message": "I didn't understand your request. Please be specific about what you'd like to change. For example: 'make it spicier', 'translate to Arabic', 'add more vegetables', or 'simplify the steps'."
}

If the request IS clear and actionable, you can:
- Add, remove, or edit ANY steps
- Add, remove, or change ANY ingredients
- Change the language/translation of steps (if asked)
- Completely rewrite the recipe (if asked)
- Simplify or expand the recipe
- Change cooking methods, techniques, or equipment
- Adjust servings, timing, or difficulty
- Make the recipe fit dietary restrictions
- Convert to a different cuisine style

Return the modified recipe as JSON:
{
  "title": "Recipe Title (2-4 words)",
  "description": "One short sentence",
  "cuisine_type": "cuisine or null",
  "difficulty": "beginner|intermediate|advanced",
  "prep_time_minutes": number,
  "cook_time_minutes": number,
  "total_time_minutes": number,
  "active_time_minutes": number,
  "servings": number,
  "ingredients": [
    { "name": "ingredient", "amount": number, "unit": "unit", "category": "produce|meat|dairy|pantry|spices|frozen|beverage|condiment|other" }
  ],
  "steps": [
    { "step_number": 1, "instruction": "Short single action, under 20 words.", "duration_minutes": "number or null", "temperature": "200°C or null", "tip": "short pro chef tip — sensory cues, heat tricks, or plating advice (or null)" }
  ],
  "nutrition_estimate": { "calories": number, "protein_g": number, "carbs_g": number, "fat_g": number },
  "tips": ["tip1"]
}

FORMATTING RULES:
- Steps: Each step = ONE action, max 1 sentence, under 20 words. No ingredient amounts in step text. Start with a verb.
- Step tips: Add a short pro chef tip when useful — sensory cues ("listen for the sizzle"), heat tricks, texture tests. Set tip to null if no useful insight exists for that step.
- Title: short (2-4 words), should reflect any changes made.
- ALWAYS estimate nutrition.

STEP TIMING RULES:
- duration_minutes ONLY for steps requiring WAITING (baking, simmering, resting, marinating, boiling). Example: "Bake until golden." → duration_minutes: 25
- duration_minutes = null for active steps (chopping, mixing, seasoning, quick sautéing). Example: "Dice the onion." → duration_minutes: null
- temperature ONLY when a specific heat setting is involved (oven temp, grill temp). Otherwise null.

TIME ACCURACY:
- cook_time_minutes = SUM of all duration_minutes from the steps. Calculate precisely.
- prep_time_minutes = estimate of hands-on chopping/mixing time before cooking starts.
- total_time_minutes = prep_time_minutes + cook_time_minutes exactly.
- If a step says "cook 5 min each side" = 10 min total. If "bake 25-30 min" use 28. Be precise, never guess round numbers.`;

      const responseText = await generateText(prompt, {
        temperature: 0.7,
        maxOutputTokens: 8192,
        responseMimeType: 'application/json'
      });

      const result = await parseWithRepair(responseText);

      // Check if AI returned an error (unclear request)
      if (result.error) {
        throw new Error(result.message || "I didn't understand your request. Please be more specific.");
      }

      if (!result.title || !result.ingredients || !result.steps) {
        throw new Error('AI did not return a complete modified recipe');
      }

      return result as ExtractedRecipe;
    } catch (error: any) {
      console.error('Failed to modify recipe:', error);
      // Re-throw with the original message if it's a clear error message
      throw new Error(error?.message || 'Failed to generate modified recipe');
    }
  }

  // ============================================
  // ASK ABOUT RECIPE - Contextual Q&A
  // ============================================
  async askAboutRecipe(
    question: string,
    recipeContext: {
      title: string;
      ingredients: { name: string; amount?: number; unit?: string }[];
      steps: { step_number: number; instruction: string }[];
      description?: string;
      cuisine_type?: string;
    }
  ): Promise<{ answer: string }> {
    try {
      const ingredientList = recipeContext.ingredients
        .map(i => [i.amount, i.unit, i.name].filter(Boolean).join(' '))
        .join('\n- ');

      const stepList = recipeContext.steps
        .map(s => `${s.step_number}. ${s.instruction}`)
        .join('\n');

      const prompt = `You are a professional chef assistant. The user is viewing a recipe and has a question about it. Answer concisely in 2-5 sentences. Be practical, helpful, and specific to this recipe.

Recipe: ${recipeContext.title}
${recipeContext.description ? `Description: ${recipeContext.description}` : ''}
${recipeContext.cuisine_type ? `Cuisine: ${recipeContext.cuisine_type}` : ''}

Ingredients:
- ${ingredientList}

Steps:
${stepList}

User question: "${question}"

Return as JSON:
{"answer": "Your concise answer here"}`;

      const responseText = await generateText(prompt, {
        temperature: 0.6,
        maxOutputTokens: 1024,
        responseMimeType: 'application/json'
      });

      const result = await parseWithRepair(responseText);

      return {
        answer: result.answer || "Sorry, I couldn't answer that. Please try rephrasing your question."
      };
    } catch (error) {
      console.error('Failed to ask about recipe:', error);
      return {
        answer: "I'm having trouble right now. Please try again in a moment."
      };
    }
  }

  // ============================================
  // SUGGEST INGREDIENT SUBSTITUTION
  // ============================================
  async suggestSubstitution(
    ingredient: string,
    recipeContext: string
  ): Promise<IngredientSubstitution[]> {
    try {
      const prompt = AI_PROMPTS.suggestSubstitution(ingredient, recipeContext);

      const responseText = await generateText(prompt, {
        temperature: 0.6,
        maxOutputTokens: 1000,
        responseMimeType: 'application/json'
      });

      const result = await parseWithRepair(responseText);

      return result.substitutes || [];
    } catch (error) {
      console.error('Failed to suggest substitution:', error);
      throw new Error('Failed to suggest ingredient substitution');
    }
  }

  // ============================================
  // SCALE RECIPE
  // ============================================
  async scaleRecipe(
    originalServings: number,
    newServings: number,
    ingredients: Ingredient[]
  ): Promise<{ ingredients: Ingredient[]; notes?: string }> {
    try {
      const prompt = AI_PROMPTS.scaleRecipe(originalServings, newServings, ingredients);

      const responseText = await generateText(prompt, {
        temperature: 0.3,
        maxOutputTokens: 2000,
        responseMimeType: 'application/json'
      });

      const result = await parseWithRepair(responseText);

      return {
        ingredients: result.ingredients,
        notes: result.notes
      };
    } catch (error) {
      console.error('Failed to scale recipe:', error);
      throw new Error('Failed to scale recipe');
    }
  }

  // ============================================
  // PARSE VOICE COMMAND
  // ============================================
  async parseVoiceCommand(
    command: string,
    context: { currentStep: number; totalSteps: number }
  ): Promise<VoiceCommand> {
    try {
      const prompt = AI_PROMPTS.parseVoiceCommand(command, context);

      const responseText = await generateText(prompt, {
        temperature: 0.3,
        maxOutputTokens: 500,
        responseMimeType: 'application/json'
      });

      const result = await parseWithRepair(responseText);

      return result;
    } catch (error) {
      console.error('Failed to parse voice command:', error);
      // Return unknown command on error
      return {
        action: 'unknown',
        confidence: 'low'
      };
    }
  }

  // ============================================
  // ESTIMATE NUTRITION (if not in transcript)
  // ============================================
  async estimateNutrition(
    ingredients: Ingredient[],
    servings: number
  ): Promise<any> {
    try {
      const prompt = AI_PROMPTS.estimateNutrition(ingredients, servings);

      const responseText = await generateText(prompt, {
        temperature: 0.4,
        maxOutputTokens: 1000,
        responseMimeType: 'application/json'
      });

      const result = await parseWithRepair(responseText);

      return result;
    } catch (error) {
      console.error('Failed to estimate nutrition:', error);
      return null;
    }
  }

  // ============================================
  // PARSE GROCERY ITEMS FROM VOICE INPUT
  // ============================================
  async parseGroceryVoice(voiceInput: string): Promise<{
    items: Array<{
      name: string;
      amount?: number;
      unit?: string;
      category: string;
    }>;
    understood: boolean;
    message: string;
  }> {
    try {
      const prompt = AI_PROMPTS.parseGroceryVoice(voiceInput);

      const responseText = await generateText(prompt, {
        temperature: 0.3,
        maxOutputTokens: 1500,
        responseMimeType: 'application/json'
      });

      const result = await parseWithRepair(responseText);

      return {
        items: result.items || [],
        understood: result.understood ?? true,
        message: result.message || 'Items added'
      };
    } catch (error) {
      console.error('Failed to parse grocery voice:', error);
      return {
        items: [],
        understood: false,
        message: "Sorry, I couldn't understand that. Please try again."
      };
    }
  }

  // ============================================
  // PROCESS USER RECIPE NOTES
  // ============================================
  async processUserNotes(
    notes: string,
    originalRecipe: any
  ): Promise<any> {
    try {
      const prompt = AI_PROMPTS.processUserNotes(notes, originalRecipe);

      const responseText = await generateText(prompt, {
        temperature: 0.5,
        maxOutputTokens: 1500,
        responseMimeType: 'application/json'
      });

      const result = await parseWithRepair(responseText);

      return result;
    } catch (error) {
      console.error('Failed to process user notes:', error);
      return null;
    }
  }

  // ============================================
  // EXTRACT RECIPE FROM SOCIAL MEDIA DESCRIPTION
  // ============================================
  async extractRecipeFromDescription(
    description: string,
    hashtags: string[] = []
  ): Promise<ExtractedRecipe> {
    try {
      // Truncate very long descriptions to avoid token limits
      const maxDescLength = 8000;
      const truncatedDesc = description.length > maxDescLength
        ? description.substring(0, maxDescLength) + '...'
        : description;

      console.log('[AI] Extracting recipe from description, length:', truncatedDesc.length);

      const prompt = AI_PROMPTS.extractRecipeFromDescription(truncatedDesc, hashtags);

      const responseText = await generateText(prompt, {
        temperature: 0.6,
        maxOutputTokens: 8000,
        responseMimeType: 'application/json'
      });

      console.log('[AI] Response length:', responseText?.length || 0);

      const extractedRecipe = await parseWithRepair(responseText);

      console.log('[AI] Parsed recipe:', {
        hasTitle: !!extractedRecipe?.title,
        ingredientsCount: extractedRecipe?.ingredients?.length || 0,
        stepsCount: extractedRecipe?.steps?.length || 0,
      });

      // Ensure arrays are proper arrays
      if (!Array.isArray(extractedRecipe.ingredients)) {
        extractedRecipe.ingredients = [];
      }
      if (!Array.isArray(extractedRecipe.steps)) {
        extractedRecipe.steps = [];
      }

      // Validate required fields - need at least a title and some content
      if (!extractedRecipe.title) {
        console.error('[AI] No title found in recipe');
        throw new Error('Could not find recipe title in the content');
      }

      if (extractedRecipe.ingredients.length === 0 && extractedRecipe.steps.length === 0) {
        console.error('[AI] No ingredients or steps found');
        throw new Error('Could not find recipe ingredients or instructions in the content');
      }

      // If we have a title and at least some content, return what we have
      // Add default steps if none found but we have ingredients
      if (extractedRecipe.steps.length === 0 && extractedRecipe.ingredients.length > 0) {
        extractedRecipe.steps = [{
          step_number: 1,
          instruction: 'Follow the recipe instructions to prepare this dish.',
          duration_minutes: null,
          temperature: null,
          tip: null,
        }];
      }

      return extractedRecipe;
    } catch (error) {
      console.error('Failed to extract recipe from description:', error);
      throw new Error('Failed to extract recipe from description');
    }
  }

  // ============================================
  // EXTRACT RECIPE FROM VIDEO FRAMES (VISION)
  // ============================================
  async extractRecipeFromVideoFrames(
    frameUrls: string[],
    metadata?: { title?: string; description?: string; hashtags?: string[] }
  ): Promise<ExtractedRecipe> {
    try {
      if (!frameUrls || frameUrls.length === 0) {
        throw new Error('No video frames provided');
      }

      // Use the first frame/thumbnail for analysis
      const thumbnailUrl = frameUrls[0];

      // Fetch the image and convert to base64
      const response = await fetch(thumbnailUrl);
      if (!response.ok) {
        throw new Error('Failed to fetch video thumbnail');
      }

      const blob = await response.blob();
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          // Remove the data URL prefix to get just the base64
          const base64Data = result.split(',')[1];
          resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      const prompt = AI_PROMPTS.extractRecipeFromVideoFrames(metadata);

      const responseText = await generateVision(prompt, base64, {
        temperature: 0.6,
        maxOutputTokens: 6000,
        responseMimeType: 'application/json'
      });

      const extractedRecipe = await parseWithRepair(responseText);

      // Validate required fields
      if (!extractedRecipe.title) {
        throw new Error('Could not identify recipe from video frame');
      }

      // Ensure we have at least basic structure
      if (!extractedRecipe.ingredients) {
        extractedRecipe.ingredients = [];
      }
      if (!extractedRecipe.steps) {
        extractedRecipe.steps = [];
      }

      return extractedRecipe;
    } catch (error) {
      console.error('Failed to extract recipe from video frames:', error);
      throw new Error('Failed to analyze video for recipe');
    }
  }

  // ============================================
  // EXTRACT RECIPE FROM COOKBOOK PAGES (VISION)
  // ============================================
  async extractRecipeFromCookbookPages(pageUris: string[]): Promise<ExtractedRecipe> {
    try {
      if (!pageUris || pageUris.length === 0) {
        throw new Error('No cookbook page images provided');
      }

      // Convert URIs to base64
      const base64Images = await Promise.all(
        pageUris.map(async (uri) => {
          const base64 = await FileSystem.readAsStringAsync(uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          return base64;
        })
      );

      const prompt = AI_PROMPTS.extractCookbookPages();

      const rawText = await generateVisionMultiImage(prompt, base64Images, {
        temperature: 0.3,
        maxOutputTokens: 16384,
        responseMimeType: 'application/json',
      });

      const parsed = await parseWithRepair(rawText);

      // Check for error response from AI
      if (parsed.error) {
        throw new Error(parsed.error);
      }

      // Validate required fields
      if (!parsed.title || !parsed.ingredients || !parsed.steps) {
        throw new Error('Could not extract a complete recipe from these images');
      }

      return parsed as ExtractedRecipe;
    } catch (error) {
      console.error('Failed to extract recipe from cookbook pages:', error);
      throw error instanceof Error ? error : new Error('Failed to extract recipe from cookbook pages');
    }
  }

  // ============================================
  // GENERATE RECIPE IMAGE (Gemini image-to-image with fixed plate)
  // ============================================
  private _plateBase64: string | null = null;

  private async getPlateBase64(): Promise<string> {
    if (this._plateBase64) return this._plateBase64;
    const asset = Asset.fromModule(require('../assets/images/plate.png'));
    await asset.downloadAsync();
    this._plateBase64 = await FileSystem.readAsStringAsync(asset.localUri!, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return this._plateBase64;
  }

  async generateRecipeImage(recipeName: string): Promise<string> {
    try {
      const plateBase64 = await this.getPlateBase64();

      const prompt = `Place beautifully styled "${recipeName}" on this plate. Rules:
- Use this image as a STYLE REFERENCE for composition, angle, lighting, and background only
- You MUST change the plate shape and color to best match the dish (e.g. deep bowl for soup, wide white plate for steak, dark ceramic for sushi, elegant small plate for dessert)
- Keep the EXACT same pure white background, top-down flat lay angle, and soft studio lighting
- Only the plate with food — no props, utensils, napkins, or background elements
- Food should look fresh, appetizing, and professionally styled like a magazine photo
- Do not add any text or labels`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(IMAGE_MODEL_NAME)}:generateContent?key=${process.env.EXPO_PUBLIC_GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                {
                  inlineData: {
                    mimeType: 'image/png',
                    data: plateBase64,
                  },
                },
                { text: prompt },
              ],
            }],
            generationConfig: {
              responseModalities: ['IMAGE', 'TEXT'],
            },
          }),
        }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error?.message || `Image generation failed: ${response.status}`);
      }

      const data = await response.json();
      const imagePart = data.candidates?.[0]?.content?.parts?.find(
        (p: any) => p.inlineData?.mimeType?.startsWith('image/')
      );

      if (!imagePart?.inlineData?.data) {
        throw new Error('Image generation failed — no image in response');
      }

      return imagePart.inlineData.data;
    } catch (error) {
      console.error('Failed to generate recipe image:', error);
      throw new Error('Failed to generate recipe image');
    }
  }

  // ============================================
  // BATCH PROCESSING (for multiple recipes)
  // ============================================
  async batchExtractRecipes(
    transcripts: { id: string; transcript: string }[],
    userPreferences?: any
  ): Promise<{ id: string; recipe?: ExtractedRecipe; error?: string }[]> {
    const results = [];

    for (const item of transcripts) {
      try {
        const recipe = await this.extractRecipeFromTranscript(
          item.transcript,
          userPreferences
        );
        results.push({ id: item.id, recipe });
      } catch (error) {
        results.push({
          id: item.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return results;
  }
}

// Export singleton instance
export const aiService = new AIService();

// Export class for testing
export default AIService;
