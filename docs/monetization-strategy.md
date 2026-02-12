# RecipeApp — Monetization Strategy

---

## Freemium Model: "RecipeApp Pro"

### Free Tier (Hook users in)
- **5 recipe scans/week** (fridge + cookbook combined)
- **3 AI Chef messages/day**
- **Unlimited** saved recipes
- **Basic meal planner** (day view only)
- **Cooking mode**
- Social features (messaging, sharing)

### Pro Tier — $4.99/month or $29.99/year
- **Unlimited** recipe scans
- **Unlimited** AI Chef conversations
- **Full meal planner** (day + week view)
- **AI recipe image generation**
- **Website recipe extraction** (unlimited)
- **No ads**
- Priority support
- 7-day free trial on annual plan

---

## Cost Analysis Per User Action

| Feature                  | What Happens              | Cost Per Call |
|--------------------------|---------------------------|---------------|
| Fridge / Cookbook scan    | Vision API (image→recipe) | ~$0.002       |
| AI Chef chat             | Text generation           | ~$0.001       |
| Recipe from video/website| Text extraction           | ~$0.001       |
| AI image generation      | Gemini image gen          | ~$0.003       |
| Firebase Firestore       | Reads / writes            | ~$0.0001      |
| Cloud Function (notifs)  | Per message               | ~$0.0000004   |

*All AI powered by Gemini 2.5 Flash — $0.15/M input tokens, $0.60/M output tokens*

---

## Monthly Cost Per User (Estimated)

| User Type            | Usage Pattern                     | Your Cost  |
|----------------------|-----------------------------------|------------|
| Free user (casual)   | 5 scans, 10 AI chats, basic       | ~$0.03/mo  |
| Free user (active)   | 5 scans, 20 AI chats              | ~$0.05/mo  |
| Pro user (active)    | 30 scans, 100 AI chats, images    | ~$0.40/mo  |
| Pro user (heavy)     | 60 scans, 200 AI chats, images    | ~$0.80/mo  |

---

## Revenue vs Cost

*Apple Small Business Program: 15% commission*

| Plan              | Price    | You Receive | Heaviest User Cost | Profit Margin |
|-------------------|----------|-------------|--------------------| --------------|
| Monthly           | $4.99/mo | ~$4.24/mo   | $0.80              | **81%**       |
| Annual            | $29.99/yr| ~$2.12/mo   | $0.80              | **62%**       |

---

## Why This Model Works

1. **Scans & AI are the highest-value features** — they cost you money (API calls) and users love them. Perfect gate.

2. **Meal planner week view** is a power-user feature — people who plan weekly are committed and will pay.

3. **Social features stay free** — this drives growth (users invite friends to share recipes/plans).

4. **Saved recipes stay free** — don't punish users for building their collection, that creates lock-in.

5. **Free users cost almost nothing** (~$0.03-0.05/mo) — they're not a burden, they're future paying customers.

---

## Pricing Rationale

- **$4.99/month** is impulse-buy territory for a cooking app
- **$29.99/year** (~$2.50/month) gives a strong incentive to go annual = better retention
- **7-day free trial** on annual plan reduces friction for first-time subscribers

---

## RevenueCat Setup Checklist

- [ ] Create Apple API key in RevenueCat dashboard (starts with `appl_`)
- [ ] Create products in App Store Connect with canonical IDs: `EITO_monthly`, `EITO_yearly`
- [ ] Add products to RevenueCat Product Catalog
- [ ] Create Offering with Monthly + Annual packages
- [ ] Create "pro" entitlement in RevenueCat (or keep `EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_IDS` updated)
- [ ] Set these env vars for the build target (local + EAS/TestFlight): `EXPO_PUBLIC_REVENUECAT_APPLE_KEY`, `EXPO_PUBLIC_REVENUECAT_IOS_MONTHLY_PRODUCT_ID`, `EXPO_PUBLIC_REVENUECAT_IOS_YEARLY_PRODUCT_ID`, `EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_IDS`
- [ ] Implement usage gates in app (scan limits, AI chat limits)
- [ ] Design and build paywall screen
