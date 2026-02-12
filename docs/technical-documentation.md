# EITO - Technical Documentation

**RevenueCat Shipyard 2026 Submission**

> EITO is an AI-powered cooking companion for iOS. It extracts recipes from TikTok, YouTube, Instagram, websites, and physical cookbooks using AI vision. Users can scan their fridge to discover what they can cook with what they already have, plan meals for the week, get personalized suggestions from an AI chef, and follow step-by-step cooking instructions with voice commands and built-in timers. Social features like in-app messaging and recipe sharing drive organic growth.

---

## Table of Contents

1. [Tech Stack](#tech-stack)
2. [Architecture](#architecture)
3. [RevenueCat Implementation](#revenuecat-implementation)

---

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| **Framework** | React Native | 0.81.5 |
| **Platform** | Expo (Managed + Custom Dev Client) | SDK 54 |
| **Router** | Expo Router (file-based) | 6.x |
| **Language** | TypeScript | 5.9 |
| **State Management** | Zustand (with persist middleware) | 5.x |
| **Backend / Auth** | Firebase (Auth, Firestore, Storage) | 12.8 |
| **AI Engine** | Google Gemini 2.5 Flash (text + vision) | via `@google/generative-ai` |
| **Payments** | RevenueCat (`react-native-purchases`) | 8.2 |
| **Animations** | React Native Reanimated 4.1 + Animated API | |
| **Gestures** | React Native Gesture Handler 2.28 | |
| **Notifications** | Expo Notifications | 0.32 |
| **Live Activities** | expo-live-activity + native Swift WidgetKit | 0.4 |
| **Speech Recognition** | expo-speech-recognition | 3.1 |
| **Camera** | Expo Camera | 17.x |
| **Build System** | EAS Build + EAS Submit | |

---

## Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────┐
│                    EITO Mobile App                   │
│               (React Native + Expo 54)               │
├──────────┬──────────┬──────────┬────────────────────┤
│  Screens │Components│  Hooks   │    Navigation      │
│ (app/)   │          │          │  (Expo Router)     │
├──────────┴──────────┴──────────┴────────────────────┤
│                   Zustand Stores                     │
│  authStore · recipeStore · shoppingStore ·           │
│  messagingStore · mealPlanStore · cookingStore        │
├─────────────────────────────────────────────────────┤
│                   Service Layer                      │
│  firebase · ai · revenueCat · messaging ·            │
│  tiktok · youtube · instagram · social · pantry      │
├────────────┬────────────────────┬───────────────────┤
│  Firebase  │   Google Gemini    │   RevenueCat      │
│  Auth      │   2.5 Flash        │   Purchases SDK   │
│  Firestore │   (Text + Vision)  │   (iOS) │
│  Storage   │                    │                   │
└────────────┴────────────────────┴───────────────────┘
```

### State Management

All client-side state is managed through **Zustand** stores with AsyncStorage persistence:

| Store | Purpose |
|---|---|
| `authStore` | User session, authentication, profile sync |
| `recipeStore` | Recipe CRUD, AI image generation, favorites |
| `shoppingStore` | Shopping list management, grocery items |
| `messagingStore` | Real-time conversations, messages, unread counts |
| `mealPlanStore` | Weekly meal planning, drag-and-drop scheduling |
| `cookingStore` | Active cooking session, step tracking, timers |

### Navigation

EITO uses **Expo Router v6** with file-based routing. The app has 5 main tabs and 20+ screens:

**Tab Bar (FloatingTabBar):**
- Home (recipe feed)
- Messages (real-time chat)
- Planner (weekly meal plan)
- Shopping (grocery lists)
- Profile

**Modal Screens:** Paywall, Add Recipe, Fridge Scan, Cookbook Scan, Cooking Mode, AI Chef Chat, Edit Profile, Share Recipe, Share to Story, Share Meal Plan, etc.

---

## RevenueCat Implementation

RevenueCat is deeply integrated into EITO and powers the entire monetization experience. It is not a surface-level paywall - it is woven into the app lifecycle from the moment the user opens the app to every AI-powered feature they interact with.

**Package:** `react-native-purchases` v8.2.0

---

### The User Journey with RevenueCat

**Step 1: First Launch**

When a new user opens EITO and signs up, the app immediately configures RevenueCat with the Apple API key and logs the user in using their Firebase Auth user ID. This creates a 1:1 identity link between the user's Firebase account and their RevenueCat customer profile. From this point on, RevenueCat tracks everything about this user's subscription lifecycle.

**Step 2: Using Free Features**

The user starts exploring - they scan their fridge, save a recipe from TikTok, or ask the AI chef for ideas. Each of these actions passes through a **usage gate**. The gate checks the user's `is_premium` field (which is kept in sync with RevenueCat). Since they're a free user, the gate counts their usage:

- 5 fridge scans per week
- 5 recipe saves per week
- 3 AI chef conversations per day
- Weekly meal planner is locked entirely

The user doesn't notice any of this until they approach a limit.

**Step 3: Hitting a Limit**

When the user tries to scan their fridge for the 6th time that week, the gate blocks the action and presents a **bottom sheet** that says: "You've used 5 of 5 scans this week." The sheet shows their exact usage and has a prominent "Upgrade to Pro" button. This is the natural, non-intrusive moment where RevenueCat's paywall enters the picture.

**Step 4: The Paywall**

The paywall opens as a full-screen modal. Here's what happens behind the scenes:

- The screen fetches offerings via `getOfferings()`, with retry and `syncAttributesAndOfferingsIfNeeded()` to recover from stale/missing dashboard mappings.
- Monthly/yearly plans are resolved through a deterministic resolver shared across pricing and purchase:
  1. `packageType` (`MONTHLY` / `ANNUAL`)
  2. RevenueCat default package identifiers (`$rc_monthly` / `$rc_annual`)
  3. Exact match against configured product IDs from env
  4. Heuristic product identifier match (`month` vs `year|annual`)
- It reads localized prices from StoreKit through RevenueCat (currency is store-driven, not hardcoded in app logic).
- It checks introductory eligibility (`checkTrialOrIntroductoryPriceEligibility`) for the yearly product and adapts CTA/trial copy.
- If no matching package is found, the app falls back to direct store products with:
  `Purchases.getProducts([configuredProductId], Purchases.PRODUCT_CATEGORY.SUBSCRIPTION)`.

**Step 5: Making a Purchase**

When the user taps "Get started for free" or "Subscribe Now":

1. The app first tries to purchase through the RevenueCat **offering package** (the preferred path, since it respects all dashboard configuration).
2. If package resolution fails, it fetches a fallback store product from explicit env-based product IDs, then purchases via `purchaseStoreProduct()`.
3. If fallback product fetch fails, the app runs `getPurchaseReadiness(plan)` and shows a stage-specific error (API key missing, offering missing, product ID mapping issue, or store product mismatch).
4. If the user dismisses the Apple payment sheet, RevenueCat returns `userCancelled`; the app exits gracefully without showing a hard error.
5. On successful purchase, the app reads `CustomerInfo`, verifies entitlements, extracts expiration date, updates Firebase (`is_premium`, `premium_expires_at`), and syncs usage state.
6. The user sees a success alert and can jump into the Pro hub.

**Step 6: Subscription Lifecycle (Background)**

While the user goes about their day, RevenueCat is working in the background. A `CustomerInfoUpdateListener` is registered at app launch and fires whenever anything changes:

- **Renewal** - Subscription auto-renews → listener confirms entitlements are still active → no action needed
- **Expiry** - User's subscription lapses → listener detects no active entitlement → Firebase profile updated to `is_premium: false` → usage gates re-engage on next use
- **Cancellation** - User cancels but is still in their paid period → no change until expiry
- **Billing issue** - Payment fails → RevenueCat handles retry logic → app state updates when resolved

The user never needs to "refresh" or re-open the app for their status to update. It's all automatic.

---

### Products & Entitlements

| Product ID | Type | Price | Trial |
|---|---|---|---|
| `EITO_monthly` | Auto-Renewable Subscription (Monthly) | Store-localized | Intro offer from App Store Connect (if configured) |
| `EITO_yearly` | Auto-Renewable Subscription (Annual) | Store-localized | Intro offer from App Store Connect (if configured) |

**Subscription Group:** "EITO Pro"

**Entitlement IDs:** `pro`, `premium`, `EITO Pro` - The app checks all three with case-insensitive matching so it works regardless of how the entitlement is named in the RevenueCat dashboard.

**StoreKit Testing:** A local `Products.storekit` file is included for sandbox testing in Xcode, mirroring the live App Store Connect products with matching product IDs and introductory offer periods.

### Runtime Configuration (Required)

RevenueCat product resolution is now explicit and env-driven. For release builds, the app expects:

- `EXPO_PUBLIC_REVENUECAT_APPLE_KEY`
- `EXPO_PUBLIC_REVENUECAT_GOOGLE_KEY`
- `EXPO_PUBLIC_REVENUECAT_IOS_MONTHLY_PRODUCT_ID`
- `EXPO_PUBLIC_REVENUECAT_IOS_YEARLY_PRODUCT_ID`
- `EXPO_PUBLIC_REVENUECAT_ANDROID_MONTHLY_PRODUCT_ID`
- `EXPO_PUBLIC_REVENUECAT_ANDROID_YEARLY_PRODUCT_ID`
- `EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_IDS` (comma-separated; defaults to `pro,premium,EITO Pro` if omitted)

The app no longer relies on hidden in-code product ID defaults for purchase fallback paths.

---

### RevenueCat + Firebase: Bidirectional Sync

This is the most important architectural decision in EITO's payment system.

**The problem:** RevenueCat is the source of truth for subscription status, but the app also needs to check premium status in Firebase (for Firestore security rules, usage counters, and fast local checks). If only one system has the status, they can drift apart.

**The solution:** Every app launch, EITO reconciles the two:

```
App Launch → RevenueCat says premium? → Firebase says premium?

  YES / NO  → Update Firebase to premium (with expiration date)
  NO  / YES → Downgrade Firebase to free
  YES / YES → Already in sync, do nothing
  NO  / NO  → Already in sync, do nothing
```

Then the real-time listener keeps them synced for the rest of the session. This means:
- If a user subscribes on a different device, the next app launch on this device will pick it up
- If RevenueCat processes a cancellation while the app is in the background, the listener catches it when the app resumes
- If Firebase's `is_premium` gets corrupted somehow, the next launch fixes it

Additionally, app startup logs a one-time purchase readiness snapshot for both plans (`monthly`, `yearly`) to make TestFlight configuration debugging actionable.

---

### Where the Paywall Appears

The paywall is triggered from **5 different places** in the app, all through natural usage moments:

1. **Fridge Scan Limit** - User hits 5 scans/week → bottom sheet → paywall
2. **Recipe Save Limit** - User hits 5 saves/week → bottom sheet → paywall
3. **AI Chef Chat Limit** - User hits 3 chats/day → bottom sheet → paywall
4. **Week Planner Access** - User taps the planner tab → bottom sheet says "Pro only" → paywall
5. **Profile Screen** - A direct "Upgrade to Pro" button for users who want to subscribe proactively

Each entry point opens the same paywall screen, and RevenueCat handles the rest.

---

### Restore Purchases

A "Restore Purchases" link is always visible at the bottom of the paywall. When tapped:
1. The app calls RevenueCat's `restorePurchases()`
2. RevenueCat checks with Apple for any existing subscriptions tied to this Apple ID
3. The returned `CustomerInfo` is checked for active entitlements
4. If found: Firebase profile is updated to premium, the user sees "Your purchases have been restored!"
5. If not found: "No purchases found" is shown

This handles the case where a user reinstalls the app, switches devices, or previously subscribed with a different Firebase account but the same Apple ID.

---

### Error Handling

RevenueCat integration is designed to **never break the app**, even when things go wrong:

- **Offline / No Network** - If the device is offline when RevenueCat tries to log in or fetch offerings, the error is swallowed as a warning. The app continues using the last-known premium status from the persisted Firebase profile. When connectivity returns, the next interaction will reconcile.

- **Offerings Not Configured** - The SDK first retries and runs `syncAttributesAndOfferingsIfNeeded()`. If still empty, the app attempts direct product fetch by configured IDs before failing.

- **Configuration / Mapping Diagnostics** - `getPurchaseReadiness(plan)` returns structured issues:
  `MISSING_API_KEY`, `MISSING_PRODUCT_IDS`, `NO_CURRENT_OFFERING`, `NO_MATCHING_PACKAGE`, `NO_STORE_PRODUCTS`.
  The paywall maps these to targeted user/developer-facing alerts instead of showing a generic App Store connectivity message for all failures.

- **User Cancels Payment** - When the user dismisses the Apple payment sheet, the SDK signals cancellation. The app catches this gracefully and keeps the paywall open - no error alert, no crash.

- **Custom SDK Log Handler** - RevenueCat logs are routed through a custom handler. Expected transient failures (network issues, offerings config issues, user-cancelled purchase) are downgraded to warnings to reduce noisy dev redboxes while preserving debugging visibility.

---

*Built by Eitan & Tank for RevenueCat Shipyard 2026*
