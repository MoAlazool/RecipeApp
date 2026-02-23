# EITO — Project Story

## Inspiration

As a solo developer who cooks daily, I kept running into the same problem: I'd save a recipe from TikTok or YouTube, then never actually cook it. The gap between "I saw this" and "I cooked this" was too wide — no structured ingredients, no step-by-step flow, no grocery list.

Then I noticed Eitan Bernath's audience has the exact same problem at scale: people save recipes but rarely cook them. EITO was built to close that gap through one practical flow — from link to plate.

## What It Does

EITO is an AI-powered cooking app that focuses on execution, not just discovery:

- Import recipes from **YouTube, TikTok, Instagram, and recipe websites** — paste a link, get a full recipe
- Extract ingredients, steps, and estimate **quantities/units** using Gemini AI (text + vision)
- If description/text is missing, fallback to **AI vision analysis** of images/thumbnails — a 3-tier extraction pipeline
- **Scan fridge photos** and detect ingredients with quantity estimates, then generate 6 recipe suggestions
- **Scan cookbook pages** with camera OCR and extract structured recipes
- Generate smart **grocery lists** grouped by category (produce, meat, dairy, pantry)
- Add grocery items using **voice input** — speak naturally and items are parsed automatically
- **Cook Mode** with step-by-step navigation, multiple simultaneous timers, voice commands, and ingredient scaling
- Show live cooking progress on iOS via **Dynamic Island (Live Activity)** with deep-link tap-to-resume
- **AI Chef chat** for personalized cooking suggestions and guidance
- **In-app messaging** (1-on-1 and group chats) with recipe/meal-plan/grocery-list sharing for organic user growth
- **Meal planner** with weekly view, 4 meal slots per day, and nutrition tracking
- **RevenueCat-powered metered freemium**: 5 recipes/week, 3 fridge scans/week, 20 AI chats/week — Pro unlocks unlimited

## How I Built It

Built **solo**, end-to-end — from Xcode builds and Firestore security rules to the RevenueCat subscription pipeline. The full codebase includes **40+ screens, 10 Zustand stores, and 15 service modules**.

**Tech stack:**
- **React Native + Expo + TypeScript** — file-based routing via Expo Router
- **Firebase** (Auth, Firestore, Storage) — user profiles, recipes, real-time messaging, usage counters
- **Google Gemini AI** (text + vision) — multi-modal recipe extraction and AI chef chat
- **RevenueCat v8** — singleton service class with 4-step package resolution, 3-layer entitlement verification, real-time subscription listener, and fallback purchase handling
- **Zustand** — 10 persisted stores covering auth, recipes, cooking, shopping, meal planning, messaging, usage, cookbooks, preferences, and pro showcase
- **iOS Live Activity** — native SwiftUI widget for Dynamic Island with deep-link resume
- **Xcode / TestFlight** — native iOS builds shipped and tested via TestFlight

## Challenges I Ran Into

- **Inconsistent social metadata** — TikTok/Instagram posts sometimes have no useful description, so I built a 3-tier fallback: description → vision analysis → transcript/manual entry
- **Reliable quantity extraction** — unstructured content rarely includes exact measurements; Gemini AI estimates quantities with unit normalization
- **Voice parsing for grocery** — real-world speech is messy; built natural language parsing that handles "I want to buy honey and milk and some bread"
- **Keeping subscription state synced** — solved with a **3-layer premium check** (Zustand → Firebase → RevenueCat) ensuring no paying customer is ever wrongly gated. On every app launch, premium status is reconciled bidirectionally between RevenueCat and Firebase
- **RevenueCat package resolution** — different App Store Connect configurations can return unexpected package structures; built a **4-step fallback resolver** (packageType → RC identifier → product ID → regex heuristic) so purchases never fail due to mapping issues
- **Maintaining fast UX across AI + network flows** — optimistic updates with rollback, double-tap prevention locks, and retry logic with incremental delays

## Accomplishments That I'm Proud Of

- Delivered a **working, monetizable MVP as a solo builder** — 40+ screens, production-ready
- Implemented a **3-tier extraction fallback pipeline** (description → vision → transcript/manual) that handles edge cases across 5+ platforms
- Built a **hardened RevenueCat integration** with 4-step package resolution, 3-layer entitlement verification, real-time listener, and readiness diagnostics that show the exact failure reason instead of generic errors
- Built **quantity-aware recipe + grocery flow** — from extraction to categorized shopping list
- Added **voice grocery input** with natural language parsing
- Added **Cook Mode + Dynamic Island Live Activity** — hands-free cooking with lock screen progress
- Added **real-time messaging** that supports organic growth through recipe/plan/list sharing
- Zero false negatives on premium gating — the `useUsageGate` hook double-checks RevenueCat directly before ever blocking a user

## What I Learned

- **Fallbacks are essential** for production reliability — no single extraction method works for all content
- **Quantities and units** are critical for real cooking usability — a recipe without "2 cups" is just a list of words
- **Messaging and sharing** can act as built-in growth loops — users invite others naturally by sharing recipes and meal plans
- **Monetization works best** when tied to high-intent actions — the paywall appears at usage limits, not on app launch
- **RevenueCat's architecture** made subscription management reliable — the listener-based sync, customer info updates, and entitlement checks removed the complexity of building billing infrastructure from scratch

Product quality in this app can be summarized as:

$$
\text{User Value} = \text{Accuracy} \times \text{Speed} \times \text{Completion Rate}
$$

## What's Next for EITO

- Improve extraction accuracy with fine-tuned prompts and more vision fallbacks
- Add AI personalization from user cooking history and dietary preferences
- Expand collaboration features — cook together in real-time, shared meal planning
- Optimize conversion and retention using RevenueCat analytics and A/B testing offerings
- Android launch

## Thanks

Special thanks to **RevenueCat** for powering monetization — the SDK, dashboard, and entitlement system made it possible to build a production-grade subscription pipeline as a solo developer. And thanks to **Shipyard** for creating this challenge and ecosystem.
