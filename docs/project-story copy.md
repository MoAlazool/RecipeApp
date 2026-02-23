## Inspiration
The project was inspired by Eitan Bernath’s audience problem: people save recipes but rarely cook them.  
EITO was built to turn “I saw this” into “I cooked this” through one practical flow.

## What it does
EITO is an AI-powered cooking app that focuses on execution:

- Import recipes from YouTube, TikTok, Instagram, and recipe links
- Extract ingredients, steps, and also estimate **quantities/units**
- If description/text is missing, fallback to **AI vision analysis** of images/thumbnails
- Scan fridge photos and detect ingredients with quantity estimates
- Generate smart grocery lists
- Add grocery items using **voice input**
- Use Cook Mode with timers and voice commands
- Show live cooking progress on iOS via **Dynamic Island (Live Activity)**
- Include AI Chef chat for personalized suggestions
- Include in-app messaging/sharing to increase retention and user growth
- Use recipe/dish and ingredient visuals for clearer UX

## How i built it
Built **solo** end-to-end using:

- React Native + Expo + TypeScript
- Firebase (Auth, Firestore, Storage)
- Gemini AI (text + vision)
- RevenueCat for subscriptions and entitlement checks
- Zustand for app state
- iOS Live Activity integration for Dynamic Island

## Challenges i ran into
- Inconsistent social metadata (sometimes no useful description)
- Reliable quantity extraction from unstructured content
- Voice parsing for grocery in real-world conditions
- Keeping subscription state synced correctly
- Maintaining fast UX across AI + network flows

## Accomplishments that i'm proud of
- Delivered a working, monetizable MVP as a solo builder
- Implemented extraction fallback pipeline (description → vision → transcript/manual)
- Built quantity-aware recipe + grocery flow
- Added voice grocery input
- Added Cook Mode + Dynamic Island Live Activity
- Added chat/messages flow that supports organic growth

## What i learned
- Fallbacks are essential for production reliability
- Quantities/units are critical for real cooking usability
- Messaging and sharing can act as built-in growth loops
- Monetization works best when tied to high-intent actions

Product quality in this app can be summarized as:

$$
\text{User Value} = \text{Accuracy} \times \text{Speed} \times \text{Completion Rate}
$$

## What's next for EITO
- Improve extraction accuracy further
- Improve AI personalization from user context
- Expand collaboration/social cooking features
- Continue optimizing conversion and retention

## Thanks
Special thanks to **RevenueCat** for powering monetization and to **Shipyard** for creating this challenge and ecosystem.