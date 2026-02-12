<style>
  body { font-family: Georgia, serif; line-height: 1.7; color: #1A1510; max-width: 720px; margin: 0 auto; padding: 40px 20px; }
  h1 { font-size: 26px; text-align: center; margin-bottom: 4px; }
  h2 { font-size: 16px; color: #8A8578; border-bottom: 1px solid #E5E2DC; padding-bottom: 6px; margin-top: 32px; }
  .subtitle { text-align: center; color: #8A8578; font-size: 14px; margin-bottom: 36px; }
  p { font-size: 14px; text-align: justify; }
  ul { font-size: 14px; }
  li { margin-bottom: 4px; }
  .highlight { background: #FDF8E8; border-left: 3px solid #D4AF37; padding: 12px 16px; margin: 16px 0; font-size: 13px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; margin: 12px 0; }
  th { background: #F5F3EE; text-align: left; padding: 8px 10px; border-bottom: 2px solid #D4AF37; }
  td { padding: 8px 10px; border-bottom: 1px solid #E5E2DC; }
  .footer { text-align: center; color: #8A8578; font-size: 11px; margin-top: 40px; border-top: 1px solid #E5E2DC; padding-top: 12px; }
</style>

# RecipeApp

<div class="subtitle">Written Proposal — February 2026</div>

## The Problem

Home cooking should be simple, but it isn't. Every day, millions of people face the same frustrating cycle: staring at a fridge full of ingredients with no idea what to make, scrolling endlessly through recipe websites cluttered with ads and life stories, and struggling to plan meals for the week without wasting food or time.

The existing solutions are fragmented. Recipe apps give you recipes but don't know what's in your kitchen. Meal planners help you organize but don't inspire. AI assistants can suggest ideas but lack the structured format cooks actually need — ingredients, steps, timers, and nutritional information all in one place.

The result is that people default to ordering takeout, wasting groceries, or cooking the same three meals on repeat. This isn't just a convenience problem — it affects health, household budgets, and the joy of cooking itself.

## Target Audience

RecipeApp is designed for **home cooks aged 22–45** who want to eat better without spending hours planning and searching. Our core users fall into three segments:

- **Busy professionals** who want quick, healthy meals and hate meal planning. They scan their fridge, get instant recipe suggestions, and cook with hands-free guided mode.

- **Health-conscious individuals** tracking nutrition, managing dietary restrictions (halal, gluten-free, keto, etc.), and looking for variety without the research overhead.

- **Social cooks** who share recipes with friends and family, exchange meal plans, and discover new dishes through their community.

What unites these users is a desire for **intelligent simplicity** — they want an app that understands what they have, knows what they like, and gives them exactly what they need to start cooking in seconds.

<div class="highlight">
<strong>Key insight:</strong> Our users don't want more recipes. They want the right recipe, right now, based on what's already in their kitchen — with zero friction from discovery to dinner.
</div>

## The Solution

RecipeApp combines computer vision, AI, and thoughtful design into a single cooking companion:

- **Fridge & Cookbook Scanning** — Point your camera at your fridge or a cookbook page. AI identifies ingredients or extracts the full recipe instantly.

- **AI Chef Chat** — A conversational assistant that suggests recipes based on your preferences, dietary needs, available ingredients, and time constraints.

- **Smart Meal Planner** — Day and week planning with drag-and-drop, nutritional totals, and one-tap sharing with family or friends.

- **Guided Cooking Mode** — Step-by-step instructions with built-in timers, voice commands, and hands-free operation for when your hands are covered in flour.

- **Social Features** — Share recipes and meal plans through real-time messaging. Save dishes from friends directly to your collection.

## Monetization Strategy

RecipeApp follows a **freemium model** with a generous free tier that drives organic growth and a Pro subscription for power users.

### Free Tier
All users get unlimited saved recipes, basic meal planning (day view), cooking mode, and full social features (messaging, sharing). AI features are gated: **5 recipe scans per week** and **3 AI Chef messages per day** — enough to experience the value, not enough to satisfy a daily cook.

### Pro Subscription

| Plan | Price | Effective Monthly |
|------|-------|-------------------|
| Monthly | $4.99/month | $4.99 |
| Annual | $29.99/year | $2.50 |

Pro unlocks **unlimited scans, unlimited AI Chef, full week meal planner, AI image generation, and unlimited website recipe extraction**. Annual plans include a 7-day free trial.

### Unit Economics

Our AI infrastructure runs on **Google Gemini 2.5 Flash**, keeping per-user costs exceptionally low:

| User Type | Monthly Cost to Serve |
|-----------|-----------------------|
| Free user | ~$0.03 – $0.05 |
| Pro user (heavy) | ~$0.80 |

After Apple's 15% Small Business commission, monthly Pro subscribers generate **$4.24 in revenue against $0.80 in cost — an 81% margin**. Annual subscribers yield a 62% margin even at the discounted rate.

### Growth Strategy

Free social features (messaging, recipe sharing, meal plan sharing) serve as the primary organic growth engine. When a user shares a meal plan, the recipient must download the app to view it — creating a natural viral loop at zero acquisition cost. The free tier is deliberately generous enough that casual users never feel restricted, while daily cooks quickly hit the scan and AI limits that make Pro indispensable.

<div class="footer">
RecipeApp — Built by Mohamed Al-Azool — com.moalazool.recipeapp
</div>
