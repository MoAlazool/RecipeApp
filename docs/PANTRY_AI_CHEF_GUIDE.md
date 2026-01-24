# Pantry & AI Chef Implementation Guide

## Overview

This feature adds **persistent fridge storage** and an **AI Chat Bot** for conversational recipe suggestions.

## Features Implemented

### 1. ✅ Saved Fridge Items (Pantry)

**What it does:**
- After scanning your fridge, all detected items are **saved to Firebase**
- Items persist across app sessions
- Users can see what's in their fridge at any time
- Items are used by AI Chef for personalized recipe suggestions

**Firebase Collection: `user_pantry`**
```typescript
{
  id: "user123",                    // User ID (document ID)
  user_id: "user123",
  items: [
    {
      id: "1234567890-0",
      name: "chicken breast",
      category: "meat",
      quantity_estimate: "1 lb",
      confidence: "high",
      added_at: "2026-01-23T...",
      is_available: true            // false when user marks as used
    },
    // ... more items
  ],
  last_scan_at: "2026-01-23T...",
  updated_at: "2026-01-23T..."
}
```

**How it works:**
```
User scans fridge
    ↓
AI detects ingredients
    ↓
User reviews items on screen
    ↓
User taps "Find Recipes"
    ↓
Items saved to Firebase (user_pantry collection)
    ↓
Scan also saved to history (fridge_scans collection)
    ↓
Navigate to recipe suggestions
```

### 2. ✅ AI Chef Chat Bot

**What it does:**
- Chat interface where users ask for recipes
- AI Chef sees what's in user's saved pantry
- Natural conversation: "I want pasta", "What can I make for dinner?"
- Suggests 2-3 recipes based on request + available ingredients
- Click recipe to view full details

**Location:** New tab "AI Chef" in bottom navigation

**Example Conversations:**

**User:** "What's in my fridge?"
**AI Chef:** "You have chicken breast, broccoli, rice, and soy sauce in your fridge. Would you like some recipe suggestions?"

**User:** "I want to cook pasta"
**AI Chef:** "Great! I can help you make pasta. Based on what you have, I suggest these recipes:"
- Chicken Pasta Primavera (85% match)
- Creamy Garlic Pasta (78% match)

**User:** "Something quick for dinner"
**AI Chef:** "Here are some quick dinner ideas using your ingredients:"
- Chicken Stir Fry (20 min, 92% match)
- Fried Rice (15 min, 88% match)

**User:** "I'm craving something spicy"
**AI Chef:** "Here are some spicy recipes you can make:"
- Spicy Chicken Bowl (25 min, 85% match)

### 3. ✅ Pantry Service

**Location:** `services/pantry.service.ts`

**Key Methods:**

```typescript
// Save fridge scan items
await pantryService.saveFridgeItems(detectedIngredients, imageUrl);

// Get user's pantry
const pantry = await pantryService.getPantry();

// Get available ingredients for AI
const ingredients = await pantryService.getAvailableIngredients();
// Returns: ["chicken", "broccoli", "rice"]

// Add item manually
await pantryService.addItem("tomatoes", "produce", "3");

// Mark item as used
await pantryService.markItemAsUsed(itemId);

// Remove item
await pantryService.removeItem(itemId);

// Clear all items
await pantryService.clearPantry();
```

## User Flow

### Scenario 1: Scan → Save → Chat

1. **User opens camera and scans fridge**
   - App detects ingredients: chicken, broccoli, rice, soy sauce

2. **User reviews items and taps "Find Recipes"**
   - Items automatically saved to Firebase `user_pantry`
   - Navigates to recipe results

3. **User browses recipes, then goes to AI Chef tab**
   - AI Chef shows: "4 items in your fridge"

4. **User asks: "I want to cook pasta"**
   - AI Chef responds with pasta recipes using saved ingredients
   - Even though they don't have pasta, AI suggests what to buy

5. **User taps a recipe**
   - Opens detail view with ingredients breakdown
   - Shows what they have vs what they need to buy

### Scenario 2: Direct Chat

1. **User opens AI Chef tab without scanning**
   - If pantry is empty: "Your fridge is empty. Scan to add items!"
   - If pantry has items: Shows item count

2. **User asks: "What can I make for dinner?"**
   - AI looks at saved pantry items
   - Suggests 2-3 dinner recipes

3. **User likes a recipe and saves it**
   - Recipe added to "My Recipes" collection

### Scenario 3: Manage Pantry

1. **User manually adds items**
   ```typescript
   await pantryService.addItem("eggs", "dairy", "12");
   ```

2. **User marks items as used after cooking**
   ```typescript
   await pantryService.markItemAsUsed(itemId);
   ```

3. **Items with `is_available: false` don't show in AI suggestions**

## Firebase Security Rules

Add these rules to Firestore:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // ... existing rules

    // User pantry - users can only access their own pantry
    match /user_pantry/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## Live Activity Integration (iOS)

The saved pantry items can be shown in iOS Live Activity:

```swift
// In LiveActivity/LiveActivityView.swift
struct PantryActivityView: View {
    let items: [String]

    var body: some View {
        HStack {
            Image(systemName: "refrigerator")
            Text("\(items.count) items")
            // Show first 3 items
            Text(items.prefix(3).joined(separator: ", "))
        }
    }
}
```

**To activate:**
```typescript
import { LiveActivity } from '@/services/liveActivity';

// After saving pantry
const pantry = await pantryService.getPantry();
LiveActivity.updatePantry({
  itemCount: pantry.items.length,
  items: pantry.items.map(i => i.name),
});
```

## UI Components

### AI Chef Screen (`app/(tabs)/ai-chef.tsx`)

**Features:**
- Chat interface with message bubbles
- User messages on right (red)
- AI messages on left (gray)
- Recipe cards in AI responses (clickable)
- Suggestion chips: "What's in my fridge?", "I want pasta"
- Loading indicator while AI thinks
- Refresh button to reload pantry items

**Styling:**
```typescript
const COLORS = {
  primary: '#FF4B2B',       // User messages, send button
  olive: '#606C38',         // Match percentage badges
  charcoal: '#121417',      // Text
  backgroundLight: '#FDFDFD',
  backgroundDark: '#1A1210',
};
```

### Message Format

```typescript
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;              // Text message
  timestamp: Date;
  recipes?: SuggestedRecipe[];  // Optional recipe suggestions
}
```

## AI Service Integration

**Method:** `aiService.chatWithChef(userRequest, availableIngredients)`

**Input:**
```typescript
const userRequest = "I want to cook pasta";
const availableIngredients = ["chicken", "broccoli", "rice"];
```

**Output:**
```typescript
{
  message: "Great! I can help you make pasta. Based on what you have, I suggest these recipes:",
  recipes: [
    {
      title: "Chicken Pasta Primavera",
      difficulty: "beginner",
      total_time_minutes: 30,
      match_score: 85,
      ingredients_you_have: ["chicken", "broccoli"],
      ingredients_you_need: ["pasta", "cream", "parmesan"],
      // ... more fields
    }
  ]
}
```

## Error Handling

### No Pantry Items

```typescript
if (pantryItems.length === 0) {
  return {
    message: "I don't see any ingredients in your fridge yet. Would you like to scan your fridge first?",
    recipes: []
  };
}
```

### AI Service Error

```typescript
try {
  const response = await aiService.chatWithChef(input, pantryItems);
} catch (error) {
  // Show error message
  const errorMessage: Message = {
    id: Date.now().toString(),
    role: 'assistant',
    content: 'Sorry, I encountered an error. Please try again.',
    timestamp: new Date(),
  };
}
```

### Firebase Save Error

```typescript
try {
  await pantryService.saveFridgeItems(ingredients);
} catch (error) {
  // Still navigate to results even if save fails
  console.error('Failed to save pantry:', error);
  router.push('/recipe-results');
}
```

## Testing

### Test Pantry Service

```typescript
// 1. Scan fridge
const detectedIngredients = [
  { name: "chicken", category: "meat", quantity_estimate: "1 lb", confidence: "high" },
  { name: "broccoli", category: "produce", quantity_estimate: "2 cups", confidence: "high" }
];

await pantryService.saveFridgeItems(detectedIngredients);

// 2. Check Firebase
// Go to Firestore → user_pantry → [your_user_id]
// Should see items array with 2 items

// 3. Get pantry
const pantry = await pantryService.getPantry();
console.log(pantry.items.length); // 2

// 4. Get available ingredients
const ingredients = await pantryService.getAvailableIngredients();
console.log(ingredients); // ["chicken", "broccoli"]
```

### Test AI Chef

1. Open AI Chef tab
2. Should show "4 items in your fridge" (or however many you have)
3. Type: "I want pasta"
4. Should get conversational response + 2-3 recipe suggestions
5. Tap a recipe → Should open detail view
6. Go back, try: "What's in my fridge?"
7. Should list your saved items

### Test Integration

```bash
# Full flow test
1. Scan fridge (camera)
2. Review items
3. Tap "Find Recipes"
   → Items saved to Firebase ✓
4. Browse recipes
5. Go to AI Chef tab
   → Shows item count ✓
6. Ask "What can I make for dinner?"
   → AI responds with recipes using saved items ✓
7. Tap recipe
   → Detail view opens ✓
8. Save recipe
   → Added to collection ✓
```

## Performance Considerations

### Caching

```typescript
// Cache pantry in memory
let cachedPantry: UserPantry | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getPantryWithCache() {
  const now = Date.now();
  if (cachedPantry && (now - cacheTimestamp) < CACHE_TTL) {
    return cachedPantry;
  }

  cachedPantry = await pantryService.getPantry();
  cacheTimestamp = now;
  return cachedPantry;
}
```

### Debounce Chat Requests

```typescript
// Prevent rapid-fire messages
const [isLoading, setIsLoading] = useState(false);

const handleSend = async () => {
  if (isLoading) return; // Block duplicate requests

  setIsLoading(true);
  try {
    await aiService.chatWithChef(input, pantryItems);
  } finally {
    setIsLoading(false);
  }
};
```

## Future Enhancements

### 1. Pantry Management Screen

Add dedicated screen to view/edit pantry:
- List all items with categories
- Swipe to delete
- Pull to refresh
- Add items manually
- Mark as used/available

### 2. Smart Expiration Tracking

```typescript
interface PantryItem {
  // ... existing fields
  expires_at?: string;
  days_until_expiry?: number;
}

// Show warnings
if (item.days_until_expiry <= 3) {
  // Highlight in red, suggest recipes using it
}
```

### 3. Shopping List Integration

```typescript
// When viewing recipe detail
const neededItems = recipe.ingredients_you_need;

// Add to shopping list
await shoppingStore.addItemsFromRecipe(neededItems, recipeId);
```

### 4. Voice Input for AI Chef

```typescript
import * as Speech from 'expo-speech';
import { Audio } from 'expo-av';

// Voice input button
<Pressable onPress={handleVoiceInput}>
  <Ionicons name="mic" size={24} />
</Pressable>
```

### 5. Recipe History

Track which recipes user made with specific pantry items:
```typescript
{
  recipe_id: "abc123",
  cooked_at: "2026-01-23",
  ingredients_used: ["chicken", "broccoli"],
  user_rating: 5
}
```

## Troubleshooting

### Issue: Pantry items not showing

**Check:**
1. User is authenticated
2. Items were saved: `await pantryService.getPantry()`
3. Firestore rules allow read access
4. Items have `is_available: true`

### Issue: AI Chat not working

**Check:**
1. Gemini API key is set: `EXPO_PUBLIC_GEMINI_API_KEY`
2. Pantry has items: `pantryItems.length > 0`
3. Network connection is active
4. Check console for AI service errors

### Issue: Firebase save failing

**Check:**
1. Firebase initialized correctly
2. User is authenticated
3. Firestore security rules are correct
4. User has write permission to `user_pantry` collection

## Summary

This feature creates a **persistent ingredient storage system** that:
- ✅ Saves fridge scan results to Firebase
- ✅ Provides AI chat interface for recipe requests
- ✅ Suggests personalized recipes based on available ingredients
- ✅ Works across app sessions (data persists)
- ✅ Integrates with existing recipe detail and save flow

**User Benefit:**
- No need to rescan fridge every time
- Natural conversation with AI for recipe ideas
- Personalized suggestions based on what they actually have
- Quick access to pantry status

---

**Files Created:**
1. `services/pantry.service.ts` - Pantry management
2. `app/(tabs)/ai-chef.tsx` - Chat interface

**Files Modified:**
3. `services/firebase.service.ts` - Added pantry methods
4. `services/ai.service.ts` - Added chatWithChef method
5. `app/fridge-review.tsx` - Save items after scan
6. `app/(tabs)/_layout.tsx` - Added AI Chef tab
