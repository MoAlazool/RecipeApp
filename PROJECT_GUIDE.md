# RecipeApp Project Guide (A to Z)

This document explains the project end‑to‑end: what it is, how it works, and where everything lives in the codebase.

## 1) What this app does
RecipeApp turns cooking videos and fridge photos into usable recipes.

Core features:
- Video → Recipe (YouTube/TikTok/Instagram): AI extracts ingredients + steps.
- Fridge Scan: photo analysis → detected ingredients → AI recipe ideas.
- Shopping List: build lists from recipes or manual entry, grouped by aisle.
- Cooking Mode: step‑by‑step guidance with voice + timers.
- Auth + Profile: email/password or Google OAuth.
- Paywall: RevenueCat subscriptions (Pro features).

## 2) Tech stack
- Frontend: React Native (Expo SDK 54), TypeScript, Expo Router
- UI: @rneui/themed + custom components
- State: Zustand + AsyncStorage persistence
- Backend: Supabase (Postgres + Auth)
- AI: Google Gemini (via @google/generative-ai)
- Payments: RevenueCat (react-native-purchases)
- Optional microservice: FastAPI YouTube transcript API

## 3) Architecture at a glance

Data flow (high level):
- UI screens in `app/` → call Zustand stores in `stores/` → call services in `services/`.
- `services/` are the integration boundary: Supabase, AI (Gemini), social platform scraping, RevenueCat.
- AI extraction returns structured JSON; UI previews and stores it in Supabase.

Key runtime layers:
- Routing: Expo Router (`app/` file‑based routes).
- State: Zustand stores + AsyncStorage persistence.
- Network: Axios (social APIs), Supabase client, Gemini client.
- Native device: Camera, Image Picker, Speech, Haptics, etc.

## 4) App routing & screens (Expo Router)

Top‑level routing:
- `app/index.tsx`: redirects to `/welcome` when logged out, `/ (tabs )` when logged in.
- `app/_layout.tsx`: global theme, font loading, navigation stack, and modal screens.

Tab routes (`app/(tabs)/`):
- `index.tsx`: Recipes home (search, recent, saved list).
- `add.tsx`: Entry point to add recipes (YouTube/TikTok/Instagram/manual).
- `shopping.tsx`: Shopping list with grouping, swipe actions, quick add.
- `profile.tsx`: User profile, preferences, paywall entry, sign out.

Standalone routes:
- `welcome.tsx`: marketing/welcome screen.
- `onboarding.tsx`: intro slides → signup.
- `auth/index.tsx`: sign in/sign up + password reset + Google OAuth.
- `auth/callback.tsx`: OAuth redirect handler.
- `add-recipe.tsx`: AI extraction flow (URL input, progress, manual fallback, preview).
- `recipe/[id].tsx`: Recipe details + ingredients/steps + shopping list export.
- `cooking/[id].tsx`: Cooking mode (step navigation, timers, voice).
- `fridge-scan.tsx`: camera or gallery input.
- `fridge-review.tsx`: AI detection review, edit, and “Find Recipes”.
- `recipe-results.tsx`: AI recipe ideas for fridge ingredients.
- `paywall.tsx`: RevenueCat purchase/restore.

## 5) Key user flows

### 5.1 Video → Recipe (YouTube/TikTok/Instagram)
1. User opens `Add` tab → selects source.
2. `app/add-recipe.tsx` calls `socialService.extractRecipe()`.
3. Social service:
   - YouTube: fetch transcript → `aiService.extractRecipeFromTranscript()`.
   - TikTok/Instagram: scrape description → `aiService.extractRecipeFromDescription()`.
4. If extraction fails:
   - Offer manual description input.
   - Optional “Vision” fallback using video thumbnail.
5. Preview shown via `components/recipe/RecipePreview.tsx`.
6. Save → `stores/recipeStore.addRecipe()` → `supabaseService.createRecipe()`.

### 5.2 Fridge scan → Recipe ideas
1. `app/fridge-scan.tsx` captures or picks image.
2. `app/fridge-review.tsx` converts image to base64 and calls `aiService.analyzeFridgeImage()`.
3. Detected ingredients displayed for review; user can remove items.
4. “Find Recipes” → `app/recipe-results.tsx` → `aiService.suggestRecipesFromIngredients()`.
5. **Advanced Filtering**: The results screen includes a comprehensive filter bottom sheet with:
    - Sort By: Relevance, Time, Match %.
    - Dietary Preferences: Vegan, Keto, Gluten-Free, etc.
    - Prep Time: Interactive slider (0-60+ mins).
    - Difficulty: Tiered signal bar icons (Easy, Intermediate, Expert).
    - Kitchen Tools: Filter by available equipment (Air Fryer, Oven, Blender, etc.).
6. **AI Integration**: The filter parameters are passed to Gemini to ensure suggested recipes strictly respect time, difficulty, and tool constraints.

Note: `recipe-results.tsx` currently maps AI suggestions to UI‑only cards and uses placeholder IDs. It does not save recipes to Supabase.

### 5.3 Cooking mode
1. From a saved recipe: `recipe/[id].tsx` → “Start Cooking”.
2. `stores/cookingStore` starts a session with timers and step state.
3. `cooking/[id].tsx` uses `expo-speech` to read steps and supports timers.

### 5.4 Shopping list
1. From recipe detail: “Add All to Shopping List”.
2. `useShoppingStore.addItemsFromRecipe()` creates items and syncs to Supabase if list is a real UUID.
3. Shopping UI supports:
   - Category grouping and sorting.
   - Swipe actions (urgent, delete).
   - Bulk clear of checked items.
   - Quick add + Add Item modal.

### 5.5 Auth + Profile
- Email/password sign up and sign in (Supabase).
- Google OAuth uses Expo AuthSession + Supabase.
- Profile pulls `profiles` table and persists in `authStore`.

### 5.6 Paywall (RevenueCat)
- `paywall.tsx` loads offerings and purchases a monthly/annual package.
- Successful purchase updates `profiles.is_premium` in Supabase.

## 6) State management (Zustand stores)

- `stores/authStore.ts`: session, profile, sign in/out, OAuth, profile updates.
- `stores/recipeStore.ts`: recipe CRUD, favorites, local caching.
- `stores/shoppingStore.ts`: shopping list, items, grouping, sorting, persistence.
- `stores/cookingStore.ts`: cooking session, step navigation, timers, voice toggle.

Persistence:
- `auth-storage`, `recipe-storage`, `shopping-storage-v2` in AsyncStorage.
- `recipeStore` persists recipes list only.
- `shoppingStore` persists list metadata and items.

## 7) Services (integrations layer)

- `services/ai.service.ts`: Gemini integration (text + vision). Handles JSON repair and parsing.
- `services/social.service.ts`: orchestrates platform detection and extraction strategy.
- `services/youtube.service.ts`: transcript + metadata (via external transcript API or oEmbed).
- `services/tiktok.service.ts`: TikTok oEmbed + URL resolution.
- `services/instagram.service.ts`: scrape OpenGraph meta tags.
- `services/supabase.service.ts`: auth + profiles + recipes + shopping + scans.
- `services/revenueCat.service.ts`: subscriptions and entitlements.

## 8) Data model (inferred from Supabase usage)

Supabase tables expected:
- `profiles`: user profile fields (premium, limits, preferences).
- `recipes`: saved recipes (ingredients + steps JSON).
- `shopping_lists`: active list per user.
- `shopping_items`: items linked to list (and optional recipe).
- `fridge_scans`: saved scan results.

Data types defined in `utils/types.ts`.

## 9) AI layer details

Models:
- Uses Gemini via `@google/generative-ai`.
- Both text and vision calls use model `gemini-2.5-flash`.

Prompt design:
- `utils/prompts.ts` defines structured JSON outputs.
- Responses are parsed with `parseAIResponse()` and repaired if needed.

Fallback strategy for extraction:
1. Transcript/description extraction.
2. Vision fallback (thumbnail).
3. Manual text input.

## 10) Components library (UI building blocks)

Notable components:
- Recipe: `RecipeCard`, `RecipePreview`, `IngredientList`, `StepList`, `ServingAdjuster`.
- Cooking: `CookingProgress`, `CookingTimer`.
- Auth: `FormInput`, `PrimaryButton`.
- Shopping: `AddItemModal`.
- UX: `EmptyState`, `LoadingOverlay`, `RecipeLoadingAnimation`.
- Navigation: `RecipeHeader` (custom header buttons for recipe detail).

## 11) Hooks
- `hooks/useTimer.ts`: reusable countdown timer.
- `hooks/useVoiceRecognition.ts`: speech wrapper (text‑to‑speech, placeholder for recognition).

## 12) Utilities
- `utils/types.ts`: core types, constants, plan limits.
- `utils/prompts.ts`: Gemini prompts + JSON parsing repair.
- `utils/ingredientEmojis.ts`: ingredient → emoji mapping, colors, and marker layout.

## 13) Server: transcript API (optional)
Path: `server/transcript-api/`

Purpose:
- Self‑hosted FastAPI service that fetches YouTube transcripts.
- Uses `youtube-transcript-api`, with `yt-dlp` fallback for hard cases.

Set env in the app:
- `EXPO_PUBLIC_TRANSCRIPT_API_URL=https://.../api/transcript`

See `server/transcript-api/README.md` for setup.

## 14) Configuration & build

- `app.json`: Expo app config, permissions, scheme, icons, etc.
- `eas.json`: EAS build profiles.
- `babel.config.js`: Expo + Reanimated plugin.
- `metro.config.js`: Expo default Metro config.
- `tsconfig.json`: strict TS, path aliases (`@/`).

Scripts (`package.json`):
- `npm start` → `expo start`
- `npm run android` → `expo run:android`
- `npm run ios` → `expo run:ios`
- `npm run web` → web build

## 15) Environment variables
Used in code:
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_GEMINI_API_KEY`
- `EXPO_PUBLIC_TRANSCRIPT_API_URL`
- `EXPO_PUBLIC_REVENUECAT_APPLE_KEY`
- `EXPO_PUBLIC_REVENUECAT_GOOGLE_KEY`

`EXPO_PUBLIC_*` variables are bundled into the app at build time.

## 16) Assets
- `assets/`: app icons, splash, and any bundled images.
- Images used in onboarding/welcome are remote URLs hard‑coded in screens.

## 17) Known limitations / TODOs (from code)
- Manual recipe entry route exists, but `add-recipe.tsx` still starts with URL input. Manual entry is currently used only as a fallback when AI extraction fails.
- Fridge Review has a “Add item” button with a TODO stub.
- Fridge‑based recipe suggestions are UI‑only cards and not saved as real recipes.

## 18) Troubleshooting
- Blank screen on launch: check font loading in `app/_layout.tsx` and confirm Google fonts package installed.
- YouTube transcripts failing: set `EXPO_PUBLIC_TRANSCRIPT_API_URL` to the FastAPI service or verify it is reachable.
- Google OAuth redirects not working: ensure `app.json` `scheme` is `recipeapp` and Supabase OAuth redirect URL matches.
- RevenueCat not initializing: verify platform‑specific API keys in env.

## 19) Where to change things quickly
- Colors/theme: `app/_layout.tsx` (RNEUI theme colors + spacing).
- Home UI: `app/(tabs)/index.tsx`.
- Add recipe flow: `app/add-recipe.tsx`, `services/social.service.ts`.
- AI prompt behavior: `utils/prompts.ts`.
- Data models: `utils/types.ts`.
- Supabase queries: `services/supabase.service.ts`.

## 20) Recent UI/UX Refinements

The project recently underwent a significant UI/UX overhaul on the Recipe Results screen to match premium design specifications:
- **Filter Modal**: A full redesign of the filter settings using a bottom-sheet pattern with custom pills, sliders, and difficulty cards.
- **Iconography**: Switched difficulty and kitchen tool icons to `MaterialCommunityIcons` for better reliability and a modern "signal bar" aesthetic.
- **Button Design**: Updated the "Apply Filters" action with a capsule-shaped design and a primary colored glow shadow.
- **Screen Layout**: Removed the bottom tab bar from the results screen to provide more space for recipe browsing.
- **AI Prompt Hardening**: Improved prompt templates in `utils/prompts.ts` to strictly enforce user preferences for cooking time and difficulty tiers.

---

If you want, tell me which section you want expanded (e.g., “data model”, “AI prompts”, “shopping list logic”) and I’ll go deeper.
