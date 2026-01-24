// ============================================
// AI SERVICE - Gemini API Integration
// ============================================

import { GoogleGenerativeAI } from '@google/generative-ai';
import { AI_PROMPTS, parseAIResponse } from '../utils/prompts';
import type {
  ExtractedRecipe,
  SuggestedRecipe,
  FridgeScanResult,
  IngredientSubstitution,
  VoiceCommand,
  Ingredient
} from '../utils/types';

// Initialize Gemini client
const gemini = new GoogleGenerativeAI(process.env.EXPO_PUBLIC_GEMINI_API_KEY!);
const systemInstruction =
  'You are a helpful cooking assistant. Always return valid JSON without markdown formatting.';
const textModel = gemini.getGenerativeModel({
  model: 'gemini-2.5-flash',
  systemInstruction
});
const visionModel = gemini.getGenerativeModel({
  model: 'gemini-2.5-flash',
  systemInstruction
});

const generateText = async (
  prompt: string,
  options?: { temperature?: number; maxOutputTokens?: number; responseMimeType?: string }
) => {
  const result = await textModel.generateContent({
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
  });

  return result.response.text();
};

const generateVision = async (
  prompt: string,
  imageBase64: string,
  options?: { temperature?: number; maxOutputTokens?: number; responseMimeType?: string }
) => {
  const result = await visionModel.generateContent({
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
  });

  return result.response.text();
};

const parseWithRepair = async (rawText: string) => {
  try {
    return parseAIResponse(rawText, true); // Silent mode for first attempt
  } catch (error) {
    console.log('Repairing truncated or malformed JSON response...');
    const repairPrompt = `Fix and complete the JSON below. Return only valid JSON, no markdown or extra text.\n\n${rawText}`;
    const repaired = await generateText(repairPrompt, {
      temperature: 0,
      maxOutputTokens: 8192, // Increased token limit for repair
      responseMimeType: 'application/json'
    });
    const result = parseAIResponse(repaired, false);
    console.log('Successfully repaired JSON response');
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
    try {
      const prompt = AI_PROMPTS.analyzeFridgeImage();

      const responseText = await generateVision(prompt, imageBase64, {
        maxOutputTokens: 8192,
        temperature: 0.2,
        responseMimeType: 'application/json'
      });

      // Check if response looks truncated (doesn't end with proper JSON closing)
      const trimmed = responseText.trim();
      if (!trimmed.endsWith('}')) {
        console.warn('Detected truncated response, attempting salvage...');
        const salvaged = salvageTruncatedFridgeResponse(responseText);
        if (salvaged && salvaged.ingredients.length > 0) {
          return salvaged;
        }
        // If salvage failed, try repair
      }

      let result;
      try {
        result = await parseWithRepair(responseText);
      } catch (parseError) {
        // Last resort: try to salvage from raw text
        const salvaged = salvageTruncatedFridgeResponse(responseText);
        if (salvaged && salvaged.ingredients.length > 0) {
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
        return mapAbbreviatedFridgeResponse(result);
      }

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
    try {
      const prompt = AI_PROMPTS.suggestRecipesFromFridge(ingredients, userPreferences);

      const responseText = await generateText(prompt, {
        temperature: 0.8,
        maxOutputTokens: 8192,
        responseMimeType: 'application/json'
      });

      console.log('AI Recipe Response:', responseText.substring(0, 500));

      const result = await parseWithRepair(responseText);

      console.log('Parsed result keys:', Object.keys(result));
      console.log('Recipes count:', result.recipes?.length ?? 'undefined');

      if (!result.recipes || !Array.isArray(result.recipes)) {
        console.error('Invalid recipes response:', result);
        throw new Error('AI did not return valid recipes');
      }

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
2. Detailed step-by-step cooking instructions (numbered)
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
      "instruction": "Detailed instruction",
      "duration_minutes": 5,
      "temperature": "350°F"
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
}`;

      const responseText = await generateText(prompt, {
        temperature: 0.7,
        maxOutputTokens: 8192,
        responseMimeType: 'application/json'
      });

      const result = await parseWithRepair(responseText);

      // Validate required fields
      if (!result.title || !result.ingredients || !result.steps) {
        throw new Error('AI did not return a complete recipe');
      }

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
  ): Promise<{ message: string; recipes?: SuggestedRecipe[] }> {
    try {
      const prompt = `You are a friendly AI Chef assistant. The user has these ingredients in their fridge: ${availableIngredients.join(', ')}.

User request: "${userRequest}"

Based on what they have and what they're asking for, provide:
1. A friendly conversational response (2-3 sentences)
2. 2-3 recipe suggestions that match their request and use their available ingredients

If they're asking what's in their fridge, list the ingredients.
If they want a specific dish (pasta, breakfast, etc.), suggest recipes for that.
If they ask what they can make, suggest based on what they have.

Return as JSON:
{
  "message": "Your conversational response here",
  "recipes": [
    {
      "title": "Recipe Name",
      "description": "Brief description",
      "cuisine_type": "Italian",
      "difficulty": "beginner",
      "total_time_minutes": 30,
      "servings": 4,
      "match_score": 85,
      "ingredients_you_have": ["chicken", "rice"],
      "ingredients_you_need": ["soy sauce", "garlic"],
      "preview_steps": ["Step 1", "Step 2"],
      "meal_type": "dinner",
      "image_url": "https://example.com/recipe-image.jpg (provide a real public image URL that shows this dish)"
    }
  ]
}

If they're just asking what's in their fridge or making small talk, set recipes to an empty array.`;

      const responseText = await generateText(prompt, {
        temperature: 0.8,
        maxOutputTokens: 4000,
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
      const prompt = AI_PROMPTS.extractRecipeFromDescription(description, hashtags);

      const responseText = await generateText(prompt, {
        temperature: 0.6,
        maxOutputTokens: 6000,
        responseMimeType: 'application/json'
      });

      const extractedRecipe = await parseWithRepair(responseText);

      // Validate required fields
      if (!extractedRecipe.title || !extractedRecipe.ingredients || !extractedRecipe.steps) {
        throw new Error('Incomplete recipe data extracted from description');
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
