# Project Overview

## Purpose
RecipeApp is a React Native (Expo) mobile app that turns cooking videos and fridge photos into usable recipes with AI, and helps users shop and cook through guided flows. The app includes AI recipe extraction, fridge scanning, AI chat for recipe ideas, shopping lists, and a step-by-step cooking mode with timers.

## Main Features (as implemented)
- Video to recipe extraction for YouTube, TikTok, and Instagram.
- Fridge scan flow: capture or select an image, analyze ingredients with AI, review items, and view suggested recipes.
- AI Chef chat screen for conversational recipe help and suggested recipes.
- Shopping list with categories, filters, and item management.
- Cooking mode with step-by-step guidance and timers.
- Authentication (email/password and Google OAuth) with profile management.
- Paywall and subscription handling via RevenueCat.
- Live Activities (iOS) for cooking timers.

## High-Level Architecture
- Expo Router provides file-based navigation and routing under `app/`.
- Zustand stores manage app state and persistence.
- Services encapsulate integrations (AI, Firebase, social platforms, RevenueCat, notifications).
- UI components live in `components/` and are reused across screens.
- Utilities and shared types live in `utils/` and `constants/`.
- Optional FastAPI server for YouTube transcript extraction exists under `server/transcript-api/`.

## Folder Structure
- `app/`: Expo Router screens and route groups.
  - `(tabs)/`: Tab screens (Recipes, AI Chef, Shopping, Profile, Add).
  - `auth/`: Authentication screens and OAuth callback.
  - `cooking/` and `recipe/`: Dynamic detail routes.
  - Other routes: onboarding, welcome, scan flows, paywall, results.
- `components/`: Reusable UI pieces.
  - `auth/`: Auth form inputs and buttons.
  - `cooking/`: Cooking timers and progress UI.
  - `layout/`: Screen layout helpers.
  - `navigation/`: Floating tab bar components.
  - `recipe/`: Recipe cards and ingredient/step lists.
  - `shopping/`: Shopping list modals.
  - `ui/`: Generic empty/loading components.
- `services/`: Integration layer.
  - `ai.service.ts`: Gemini integration and AI helpers.
  - `firebase.service.ts`: Auth, profiles, recipes, lists, scans, pantry, usage tracking.
  - `social.service.ts`, `youtube.service.ts`, `tiktok.service.ts`, `instagram.service.ts`: Video metadata and recipe extraction helpers.
  - `revenueCat.service.ts`: Subscription handling.
  - `notifications.service.ts`: Local notifications for timers.
  - `liveActivity.ts`: iOS Live Activity helpers.
  - `supabase.service.ts`: Supabase client and helpers (present but not referenced by app code).
- `stores/`: Zustand stores and persistence.
  - `authStore.ts`, `recipeStore.ts`, `shoppingStore.ts`, `cookingStore.ts`.
- `utils/`: Shared types, prompts, and helpers.
  - `types.ts`: App-wide TypeScript types.
  - `prompts.ts`: AI prompt templates and response parsing.
  - `ingredientEmojis.ts`, `recipePlaceholders.ts`.
- `hooks/`: Reusable hooks for layout, timers, and voice recognition.
- `constants/`: Layout and spacing constants.
- `assets/`: App icons and splash images.
- `ios/` and `android/`: Native project files and configuration.
- `server/transcript-api/`: Optional FastAPI service for transcripts.
- `docs/`: Project guides and migration notes.

## Key Screens
- `app/(tabs)/index.tsx`: Recipes home.
- `app/(tabs)/ai-chef.tsx`: AI Chef chat.
- `app/(tabs)/shopping.tsx`: Shopping list.
- `app/(tabs)/add.tsx`: Add recipe entry points.
- `app/(tabs)/profile.tsx`: Profile and account.
- `app/add-recipe.tsx`: Extract and create recipes from URLs or manual entry.
- `app/fridge-scan.tsx`: Capture image for fridge scan.
- `app/fridge-review.tsx`: Review detected ingredients.
- `app/recipe-results.tsx`: Suggested recipes from fridge scan.
- `app/recipe/[id].tsx`: Recipe detail.
- `app/cooking/[id].tsx`: Cooking mode with timers.
- `app/paywall.tsx`: Subscriptions and upgrades.
- `app/welcome.tsx` and `app/onboarding.tsx`: Entry flow.

## Navigation Structure
- Root layout: `app/_layout.tsx` sets theme, fonts, and stack.
- Auth gate: `app/index.tsx` redirects to `welcome` or `(tabs)`.
- Tabs: `app/(tabs)/_layout.tsx` renders the floating tab bar.
- Stack screens include auth, onboarding, recipe detail, cooking mode, scan flows, paywall, and recipe results.

## Shared Utilities and Styling
- Theme is defined in `app/_layout.tsx` and provided via `@rneui/themed`.
- Fonts: Plus Jakarta Sans and Noto Sans (loaded in the root layout).
- Layout helpers: `hooks/useScreenLayout.ts` and `constants/layout.ts` provide spacing and safe-area calculations.
- Common UI components in `components/` avoid repeated styling.

## Platform-Specific Notes
- iOS:
  - Live Activity widget implemented in `ios/LiveActivity/` (Swift/SwiftUI).
  - A SwiftUI floating bottom nav sample exists in `ios/RecipeApp/FloatingBottomNav.swift`.
  - App delegate and plist configuration live in `ios/RecipeApp/`.
- Android:
  - Manifests and resources live in `android/app/src/main/`.
  - Gradle configuration in `android/`.
- A config plugin exists at `plugins/withNoPushEntitlements.js`.

## Services and Data Flow
- AI: `services/ai.service.ts` uses Google Gemini for text and vision.
- Auth and data: `services/firebase.service.ts` handles auth, profiles, recipes, shopping lists, pantry, fridge scans, and usage tracking.
- Social extraction: `services/social.service.ts` orchestrates YouTube/TikTok/Instagram extraction helpers.
- Monetization: `services/revenueCat.service.ts` for subscriptions and entitlement checks.
- Notifications: `services/notifications.service.ts` for timer notifications.

## Documentation Files
See `docs/` for migration guides and setup notes. The root `README.md` provides a broad overview of features and stack.
