// ============================================
// AI PROMPTS FOR RECIPE APP
// ============================================

export const AI_PROMPTS = {

  // ============================================
  // EXTRACT RECIPE FROM TRANSCRIPT
  // ============================================
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
  "title": "Recipe name",
  "description": "Brief description (1-2 sentences)",
  "cuisine_type": "Italian/Mexican/Asian/etc or null",
  "difficulty": "beginner/intermediate/advanced",
  "prep_time_minutes": number or null,
  "cook_time_minutes": number or null,
  "total_time_minutes": number,
  "active_time_minutes": number (time actively cooking, not waiting),
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
      "duration_minutes": number or null (if step has waiting/cooking time),
      "temperature": "350F/180C/etc or null"
    }
  ],
  "nutrition_estimate": {
    "calories": number or null,
    "protein_g": number or null,
    "carbs_g": number or null,
    "fat_g": number or null
  },
  "tools": ["pan", "knife", "bowl", "spoon", "oven"] or [],
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
8. If nutrition isn't mentioned, make reasonable estimates based on ingredients
9. Steps should be action-oriented and clear
10. Extract any temperature settings mentioned

Be accurate and thorough. This data will be used for cooking guidance.`;
  },

  // ============================================
  // FRIDGE SCAN - SUGGEST RECIPES
  // ============================================
  suggestRecipesFromFridge: (ingredients: string[], userPreferences?: any) => {
    const preferencesText = userPreferences
      ? `\nUser dietary restrictions: ${userPreferences.dietary_restrictions?.join(', ') || 'none'}
User cooking style: ${userPreferences.cooking_style || 'any'}
Servings needed: ${userPreferences.default_servings || 2}
Maximum time: ${userPreferences.max_time_minutes ? userPreferences.max_time_minutes + ' minutes' : 'any'}
Difficulty limit: ${userPreferences.difficulty_level || 'any'}
Kitchen Tools Available: ${userPreferences.kitchen_tools?.join(', ') || 'Any standard tools'}
Meal type: ${userPreferences.meal_type || 'any'}`
      : '';

    return `You are a creative chef helping someone cook with what they have.

AVAILABLE INGREDIENTS:
${ingredients.join(', ')}
${preferencesText}

Suggest 3-5 recipes that can be made with MOST of these ingredients. It's okay if 1-2 common pantry items are missing (salt, pepper, oil, etc).

Return ONLY valid JSON (no markdown, no backticks) with this structure:
{
  "recipes": [
    {
      "title": "Recipe name",
      "description": "Why this recipe works with these ingredients",
      "cuisine_type": "Italian/Mexican/etc",
      "difficulty": "beginner/intermediate/advanced",
      "total_time_minutes": number,
      "servings": number,
      "match_score": number (0-100, how well it matches available ingredients),
      "ingredients_you_have": ["ingredient1", "ingredient2"],
      "ingredients_you_need": ["ingredient3"] or [],
      "preview_steps": ["Step 1", "Step 2", "Step 3"] (first 3 steps only)
    }
  ]
}

RULES:
1. Prioritize recipes with 80%+ match (few missing ingredients)
2. Variety: suggest different types (quick meal, hearty dish, healthy option)
3. Respect dietary restrictions STRICTLY
4. Match cooking style preference when possible
5. STRICTLY respect the maximum time limit if specified
6. STRICTLY respect the difficulty limit if specified
7. Be creative but practical
8. Missing ingredients should be common and easy to get

Sort recipes by match_score (highest first).`;
  },

  // ============================================
  // SUGGEST INGREDIENT SUBSTITUTION
  // ============================================
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

  // ============================================
  // SCALE RECIPE
  // ============================================
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

  // ============================================
  // ANALYZE FRIDGE IMAGE (Vision)
  // ============================================
  analyzeFridgeImage: () => {
    return `Analyze this fridge/pantry photo and identify ALL visible cooking ingredients.

Return JSON: {"items":[{"n":"name","c":"category","q":"qty"}],"count":N}

Categories: produce/meat/dairy/pantry/spices/condiment/beverage/other
Rules:
- Include ALL visible items, not just a few
- Be specific: "roma tomatoes" not just "tomatoes"
- Group identical items with quantity: "6 eggs" not separate entries
- Include beverages useful for cooking (milk, wine, juice)
If unclear image: {"items":[],"count":0,"err":"unclear"}`;
  },

  // ============================================
  // VOICE COMMAND PARSING
  // ============================================
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

  // ============================================
  // EXTRACT NUTRITIONAL INFO (if not in transcript)
  // ============================================
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

  // ============================================
  // EXTRACT RECIPE FROM SOCIAL MEDIA DESCRIPTION
  // ============================================
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
  "title": "Recipe name (infer from description if not explicit)",
  "description": "Brief description (1-2 sentences)",
  "cuisine_type": "Italian/Mexican/Asian/etc or null",
  "difficulty": "beginner/intermediate/advanced",
  "prep_time_minutes": number or null,
  "cook_time_minutes": number or null,
  "total_time_minutes": number (estimate if not provided),
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
      "temperature": "350F/180C/etc or null"
    }
  ],
  "nutrition_estimate": {
    "calories": number or null,
    "protein_g": number or null,
    "carbs_g": number or null,
    "fat_g": number or null
  },
  "tools": ["pan", "knife", etc] or [],
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
8. If nutrition isn't mentioned, make reasonable estimates based on ingredients`;
  },

  // ============================================
  // EXTRACT RECIPE FROM VIDEO FRAMES (VISION)
  // ============================================
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
  "title": "Recipe name",
  "description": "Brief description based on what you see",
  "cuisine_type": "Italian/Mexican/Asian/etc or null",
  "difficulty": "beginner/intermediate/advanced",
  "prep_time_minutes": number or null,
  "cook_time_minutes": number or null,
  "total_time_minutes": number,
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
      "temperature": "350F/180C/etc or null"
    }
  ],
  "nutrition_estimate": {
    "calories": number or null,
    "protein_g": number or null,
    "carbs_g": number or null,
    "fat_g": number or null
  },
  "tools": ["pan", "knife", etc] or [],
  "tips": ["helpful tip"] or [],
  "confidence": "high/medium/low"
}

RULES:
1. Only include ingredients you can clearly identify or reasonably infer
2. Provide standard recipe steps for the identified dish
3. Be honest about confidence level
4. If image is unclear or not food-related, return minimal data with low confidence
5. Use visible equipment as hints for cooking method`;
  },

  // ============================================
  // IMPROVE USER RECIPE NOTES
  // ============================================
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

// ============================================
// HELPER: Parse JSON Response Safely
// ============================================
export const parseAIResponse = (response: string): any => {
  try {
    // Remove markdown code blocks if present
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
    console.error('Failed to parse AI response:', error);
    console.error('Raw response:', response);
    throw new Error('Invalid JSON response from AI');
  }
};
