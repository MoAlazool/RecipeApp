# EITO - Technical Documentation

**RevenueCat Shipyard 2026 Submission**

> EITO turns cooking inspiration into action. Scan a recipe video, snap your fridge, and go from "I saw this" to "it's on the table."

---

## Table of Contents

1. [App Overview](#app-overview)
2. [Tech Stack](#tech-stack)
3. [Architecture](#architecture)
4. [Feature Breakdown](#feature-breakdown)
5. [RevenueCat Implementation](#revenuecat-implementation)
6. [Monetization Strategy](#monetization-strategy)
7. [Data Flow](#data-flow)

---

## App Overview

**EITO** is an iOS app that bridges the gap between recipe inspiration and actually cooking. Users save recipes from TikTok, YouTube, Instagram, or physical cookbooks, generate grocery lists, scan their fridge with AI to find what they can make, and cook hands-free with voice commands and Live Activities on the Dynamic Island. When they're done, they can share beautiful branded recipe cards to Instagram Stories, send recipes to friends in-app, or share meal plans - turning every user into a growth channel.

- **App Name:** EITO
- **Bundle ID:** `com.moalazool.recipeapp`
- **Platform:** iOS
- **App Store ID:** 6758878627

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
| **Graphics** | Shopify React Native Skia 2.2 | |
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

## Feature Breakdown

### 1. Multi-Source Recipe Import
- **TikTok** - Resolve short URLs, extract metadata, parse video descriptions
- **YouTube** - Video ID extraction, transcript-based recipe parsing
- **Instagram** - Reels and post support
- **Website URLs** - Generic web recipe extraction
- **Cookbook Scanner** - Multi-page OCR via Gemini Vision (multi-image)
- **Manual Entry** - Add recipes by hand
- Every imported recipe can be **shared to Instagram Stories** as a branded card, **sent to friends** in-app, or shared to any app via the iOS share sheet

### 2. AI-Powered Fridge Scan
- Camera captures fridge/pantry photos
- Gemini 2.5 Flash Vision identifies ingredients with quantities
- AI suggests recipes based on what you have (match scoring, cuisine variety)
- Supports dietary restrictions and cooking preferences

### 3. AI Chef Chat
- Conversational recipe assistant powered by Gemini
- Considers user's available ingredients from fridge scans
- Generates complete recipes with nutrition estimates
- Usage-gated for free tier (3 chats/day)

### 4. Hands-Free Cooking Mode
- Step-by-step guided cooking with swipe gestures (Reanimated)
- **Voice Commands** via `expo-speech-recognition`: "next", "back", "timer", "stop"
- Per-step timers with local notifications and vibration alerts
- **iOS Live Activities** (Dynamic Island) showing current step + timer countdown
- Ingredient cards auto-matched per step with emoji/image indicators
- Recipe source video quick-link for reference
- After cooking, users can **share the recipe to Instagram Stories** or send it to friends - turning every cooking session into a potential viral moment

### 5. AI Recipe Image Generation
- Gemini 2.5 Flash generates styled food photos for recipes without thumbnails
- Uses a plate template image for consistent composition
- Background upload to Firebase Storage after generation

### 6. Smart Shopping Lists
- Auto-generated from recipe ingredients
- Voice input for adding items (parsed by Gemini)
- Check-off and manual editing

### 7. Weekly Meal Planner (Pro)
- Drag-and-drop recipes into breakfast/lunch/dinner/snack slots
- Daily nutrition summary
- **Shareable meal plans** - Send your full weekly plan to friends in-app so they can view, save individual recipes, or cook together
- Week-by-week navigation

### 8. Social & Messaging
- Real-time 1:1 and group chat via Firestore `onSnapshot`
- **In-app recipe sharing** - Send any recipe to friends with a single tap; recipients can view, save, and cook it instantly
- **Meal plan sharing** - Share your weekly meal plan in conversations so friends can cook together
- User profiles and user search
- Push notifications for new messages
- Mute notifications

### 9. Share to Instagram Stories & External Sharing
- **Share to Story** generates a branded, high-resolution recipe card (16:9 story format) using `react-native-view-shot`
- Card includes recipe photo, title, cooking time, difficulty, ingredient count, a user-selectable caption, and EITO branding with a "GET" badge linking to the App Store
- Users can save the image to their camera roll then open Instagram directly, or share via the iOS share sheet to any app (WhatsApp, X, Messages, etc.)
- A share-text with the recipe name and App Store link is automatically copied to clipboard for link stickers
- This makes every recipe a potential discovery moment for new users

### 10. Recipe Modification via AI
- "Make it spicier", "translate to Arabic", "make it vegan"
- AI rewrites recipe with modified ingredients and steps
- Ingredient substitution suggestions

---

## RevenueCat Implementation

RevenueCat is deeply integrated into EITO and powers the entire monetization experience. It is not a surface-level paywall - it is woven into the app lifecycle from the moment the user opens the app to every AI-powered feature they interact with.

**Package:** `react-native-purchases` v8.2.0

---

### How RevenueCat Lives in the App

RevenueCat touches **6 distinct areas** of EITO:

1. **App Launch** - RevenueCat initializes, syncs with the user's Firebase identity, and reconciles subscription status every time the app opens.
2. **Feature Gates** - Every AI-powered feature (fridge scan, recipe generation, AI chef chat, meal planner) checks the user's RevenueCat entitlement before proceeding.
3. **Paywall** - A custom-designed paywall fetches live pricing, detects trial eligibility, and handles the full purchase flow through RevenueCat.
4. **Real-Time Sync** - A background listener keeps subscription status synced across RevenueCat, Firebase, and the app's local state at all times.
5. **Usage Tracking** - Free-tier limits are enforced through a gate system that routes users to the paywall when they hit their cap.
6. **Session Teardown** - On logout, RevenueCat is cleanly disconnected in a specific order to prevent crashes.

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

- The screen calls RevenueCat's `getOfferings()` to fetch the current offering configured in the RevenueCat dashboard.
- It extracts the monthly and yearly packages from the offering, reading their **localized prices** directly from App Store Connect (so a user in Saudi Arabia sees SAR, a user in the US sees USD - all handled by RevenueCat).
- It calls `checkTrialOrIntroductoryPriceEligibility()` to determine if this user is eligible for the **3-day free trial**. If yes, the button says "Get started for free" and the plan cards mention "after free trial." If the user already used their trial, it says "Subscribe Now."
- The yearly plan card calculates the per-month equivalent from the actual store price and shows a "Save 37%" badge.

If the offering fetch fails (network issues, dashboard misconfiguration), the paywall **does not break**. It falls back to hardcoded USD prices so the user always sees a functional screen.

**Step 5: Making a Purchase**

When the user taps "Get started for free" or "Subscribe Now":

1. The app first tries to purchase through the RevenueCat **offering package** (the preferred path, since it respects all dashboard configuration).
2. If the offering was empty for some reason, it falls back to fetching the product directly by its known product ID (`EITO_monthly` or `EITO_yearly`) using `getProducts()`, then purchases via `purchaseStoreProduct()`.
3. If the user dismisses the Apple payment sheet, RevenueCat's SDK flags this as `userCancelled`. The app catches this and simply returns the user to the paywall - no error shown, they can try again.
4. On successful purchase, the app reads the returned `CustomerInfo`, checks for active entitlements, extracts the subscription expiration date, and immediately updates the Firebase user profile with `is_premium: true` and the expiration date.
5. The user sees a "Welcome to Pro!" alert and is returned to whatever they were doing - now with all limits removed.

**Step 6: Living as a Pro User**

From this point on, every usage gate in the app checks `is_premium` and instantly returns `true` - no network call, no delay. The user gets:
- Unlimited fridge scans and recipe saves
- Unlimited AI chef conversations
- Full access to the weekly meal planner
- All future premium features

**Step 7: Subscription Lifecycle (Background)**

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
| `EITO_monthly` | Auto-Renewable Subscription (Monthly) | $3.99/mo | 3-day free trial |
| `EITO_yearly` | Auto-Renewable Subscription (Annual) | $29.99/yr ($2.50/mo equivalent) | 3-day free trial |

**Subscription Group:** "EITO Pro"

**Entitlement IDs:** `pro`, `premium`, `EITO Pro` - The app checks all three with case-insensitive matching so it works regardless of how the entitlement is named in the RevenueCat dashboard.

**StoreKit Testing:** A local `Products.storekit` file is included for sandbox testing in Xcode, mirroring the live App Store Connect products with matching product IDs and introductory offer periods.

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

- **Offerings Not Configured** - If the RevenueCat dashboard offerings are empty or misconfigured, the app first tries `syncAttributesAndOfferingsIfNeeded()` to force a refresh. If still empty, the paywall falls back to fetching products directly by their known product IDs. If even that fails, it shows an informative alert explaining the situation.

- **User Cancels Payment** - When the user dismisses the Apple payment sheet, the SDK signals cancellation. The app catches this gracefully and keeps the paywall open - no error alert, no crash.

- **Custom SDK Log Handler** - All RevenueCat SDK log messages are routed through a custom handler. Known transient errors (offerings config issues, network connectivity, purchase cancellation) are silenced from triggering error overlays during development, while still being logged to the console for debugging.

---

### Logout & Teardown

When a user signs out, the app cleans up RevenueCat in a specific order:

1. **Remove the subscription listener** - Stops the real-time sync so it doesn't fire during teardown
2. **Clear all local app data** - Recipes, messages, shopping lists are wiped
3. **Reset auth state** - The app considers the user logged out
4. **Firebase sign out** - Revokes the Firebase auth session
5. **RevenueCat logout** - Clears the RevenueCat customer identity

This order is intentional. If Firebase auth were revoked first, the Firestore real-time listeners would fire with permission-denied errors. By removing listeners first, the teardown is clean and crash-free.

---

## Monetization Strategy

### The Core Idea

EITO's monetization is built around one principle: **let the user fall in love with the product before asking them to pay.**

Free users get full access to the core cooking experience - recipe import, cooking mode with voice commands, shopping lists, and messaging. They can genuinely use the app every day. But the AI-powered features that make EITO addictive (fridge scanning, recipe generation, AI chef chat) are capped just enough that power users naturally hit the wall and want more.

---

### Free vs. Pro

| | Free | EITO Pro |
|---|---|---|
| **Recipe Import** (TikTok, YouTube, Instagram, Cookbook, URL) | 5 saves/week | Unlimited |
| **AI Fridge Scan** | 5 scans/week | Unlimited |
| **AI Chef Chat** | 3 conversations/day | Unlimited |
| **Cooking Mode** (voice commands, timers, Live Activity) | Full access | Full access |
| **Shopping Lists** | Full access | Full access |
| **Messaging** (share recipes with friends) | Full access | Full access |
| **Weekly Meal Planner** | Locked | Full access |
| **Price** | Free | $3.99/mo or $29.99/yr |
| **Free Trial** | - | 3 days |

---

### Why This Works: The Engagement Loop

The key insight is that **the more someone uses EITO, the more they need Pro.** Here's the loop:

```
Discover a recipe on TikTok
  → Save it to EITO (uses 1 of 5 weekly saves)
    → Scan your fridge to check ingredients (uses 1 of 5 weekly scans)
      → Ask AI chef "what can I make tonight?" (uses 1 of 3 daily chats)
        → Cook with hands-free mode (free, unlimited)
          → Share the result to Instagram Story (free, brings new users)
            → Friend downloads EITO → cycle repeats
```

Each step deepens engagement, and three of those steps are gated. A casual user who cooks 2-3 times a week stays within free limits. But someone who's cooking daily - the exact user who would pay - hits the paywall naturally within the first week.

---

### The AI Chef Chat: Retention Engine

The AI Chef Chat is not just a feature - it's the retention engine that drives subscriptions. Here's why:

- It's **conversational and personal.** Users ask things like "what can I make with what's in my fridge?" or "give me something quick for dinner" and get tailored recipes instantly. This creates a habit.
- It **considers your actual ingredients.** The chat knows what you scanned in your fridge, so suggestions feel like a personal chef rather than a generic recipe search.
- It's capped at **3 conversations per day** for free users. Three is enough to experience the magic, but not enough for someone who starts relying on it daily. That's the exact moment they subscribe.
- Once subscribed, the unlimited chat becomes their daily kitchen companion - making cancellation feel like losing something they depend on.

---

### Viral Growth: Share to Instagram Stories

EITO has a built-in **Share to Story** feature that generates a beautifully designed, branded story card from any recipe. The card includes:

- The recipe photo as the full background
- Recipe title, cooking time, difficulty, and calorie count
- A custom caption the user can pick ("Cooking this today!", "Must try this!", etc.)
- EITO branding with the app logo and App Store link

Users can share this card directly to **Instagram Stories**, save it to their camera roll, or share it to any app via the iOS share sheet. Every shared story is organic advertising - their followers see a beautiful recipe card with EITO branding and can download the app directly.

This turns every Pro user into a distribution channel. The more they cook, the more they share. The more they share, the more new users discover EITO.

---

### Share Recipes In-App

Beyond social media, users can share recipes directly with friends inside EITO's messaging system. When someone receives a shared recipe, they can:
- View the full recipe with ingredients, steps, and nutrition
- Save it to their own collection (uses a save from their weekly limit)
- Cook it together in real-time

This creates a social loop: one user discovers a recipe → shares it with a friend → the friend saves it → hits their free limit → subscribes.

---

### Revenue Flow

```
User taps "Subscribe" on Paywall
  └─ RevenueCat SDK handles Apple payment via StoreKit
       └─ RevenueCat processes the transaction → entitlement activated
            └─ CustomerInfo listener fires in-app
                 └─ App updates Firebase profile (is_premium = true)
                      └─ All usage gates removed instantly for this user
```

---

## Data Flow

### Recipe Import (TikTok Example)

```
1. User pastes TikTok URL
2. tiktok.service resolves short URL → full video URL
3. social.service extracts video metadata (title, description, thumbnails)
4. ai.service sends description to Gemini 2.5 Flash
5. Gemini returns structured recipe JSON (ingredients, steps, nutrition)
6. recipeStore saves to Firestore with thumbnail
7. If no thumbnail: ai.service generates one via Gemini image generation
8. Image uploaded to Firebase Storage in background
```

### Fridge-to-Table Flow

```
1. User photographs fridge → expo-camera
2. Image sent to Gemini Vision → ingredient list with quantities
3. User reviews/edits detected ingredients
4. AI suggests 6 recipes sorted by match score + variety
5. User selects a recipe → AI expands to full recipe with steps
6. Recipe saved → ingredients auto-added to shopping list
7. User enters Cooking Mode → voice + swipe + timers + Live Activity
```

### Share-to-Story Flow

```
1. User taps "Share" on any recipe
2. ShareToStorySheet opens with a live preview of the branded story card
3. User picks a caption from preset options (e.g., "Cooking this today!")
4. User taps "Share to Instagram":
   a. react-native-view-shot captures full-resolution PNG of the story card
   b. App Store link + recipe name copied to clipboard
   c. Image saved to camera roll via expo-media-library
   d. Instagram Stories camera opens automatically
5. Or user taps "Share to Other Apps" → iOS share sheet with recipe text + App Store link
```

### In-App Recipe Sharing Flow

```
1. User taps "Share" on a recipe → selects a friend or conversation
2. Recipe reference sent as a message in Firestore
3. Recipient gets a push notification with the recipe name
4. Recipient opens the message → views full recipe inline
5. Recipient can save to their own collection (counts toward free-tier limit)
```

---

*Built by Eitan & Tank for RevenueCat Shipyard 2026*
