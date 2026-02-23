# EITO — Written Proposal for RevenueCat Shipyard 2026

EITO is an AI cooking product that converts social content and kitchen context into cookable outcomes.

## The Problem

Home cooking has no shortage of inspiration, but it still has an execution problem. People can find endless recipes on YouTube, TikTok, Instagram, and websites, yet still struggle to answer: "What can I cook tonight with what I have?"

The first friction is discovery overload. Social and blog content is built for engagement, not operational cooking. Users still have to extract ingredients, rewrite steps, adjust servings, and set timers themselves.

The second friction is kitchen reality mismatch. Most recipe content assumes ideal pantry conditions. Real users open their fridge and see partial ingredients, leftovers, and constraints. Existing recipe tools rarely start from kitchen reality, so users either postpone cooking or substitute ingredients without confidence.

The third friction is workflow fragmentation. Idea generation, recipe capture, planning, shopping, and guided cooking usually live in separate tools. Each handoff adds friction and drop-off.

The consequence is predictable: food waste increases, users repeat the same safe meals, and takeout becomes the default fallback even when people intend to cook at home.

## Target Audience

EITO is built for decision-speed home cooks who value practical outcomes more than content browsing.

The primary segment is busy home cooks, especially young professionals and small families, who need fast dinner decisions after work. They are not looking for culinary entertainment; they want reliable execution in a short time window.

The secondary segment is health- and budget-aware cooks who need constraint-aware guidance. They care about nutrition, ingredient efficiency, and reducing grocery waste.

A key behavioral trigger for both groups is arriving from social recipe content with high intent but low structure. They discover ideas in creator ecosystems, then need immediate conversion into an actionable plan: ingredient list, steps, and a path to cook now.

## Why This Product Is Different

EITO is differentiated by being execution-first across inputs, not channel-first.

First, it supports multi-input ingestion in one product. Users can start from YouTube, TikTok, Instagram, or website links, and also from kitchen-first inputs like fridge and cookbook scans. This matters because real cooking intent starts from different contexts on different days.

Second, EITO closes the execution chain inside one system. Recipe extraction is not the endpoint; users move directly into save flows, shopping preparation, and guided cooking with step progression and timers.

Third, EITO includes social sharing and messaging as part of utility, not as a separate social layer. Recipe and planning interactions can circulate between users, creating organic product loops without relying only on paid acquisition.

This combination is practical and measurable: less context switching, faster time-to-cook, and higher chance that inspiration turns into an actual meal.

## Monetization Strategy (RevenueCat-Centric)

EITO uses a freemium model with usage-gated AI moments. The goal is to let users experience clear value quickly, then convert at natural intent peaks rather than through aggressive interruption.

The free tier is intentionally usable, but bounded:

- 5 recipe actions per week
- 3 fridge scans per week
- 20 AI chef chats per week

The Pro tier removes these limits and unlocks premium planning and assistance capabilities, including advanced planning access, nutrition detail visibility, and voice-oriented cooking support.

Pricing is currently configured as:

- Monthly: $3.99
- Yearly: $29.99
- Yearly introductory trial: 7 days

Pricing and displayed amounts are storefront-localized at runtime, so localized pricing may vary by storefront.

RevenueCat is the operational center of this model. The paywall is not positioned as a static page; it is triggered at intent peaks:

- when a free usage limit is reached (scan, recipe, or chat),
- when a user attempts week planner access gated for Pro.

This improves conversion quality because the upgrade context is tied to immediate value demand, not abstract feature marketing. In addition, purchase and restore paths are both available, which lowers friction for users moving across devices or reinstalling.

## Unit Economics and Sustainability

EITO is designed to keep variable AI cost low enough that the free tier remains viable while paid conversion scales margin.

Internal cost modeling (documented in project monetization notes) assumes low per-action inference cost using Gemini 2.5 Flash, with lightweight backend overhead.

At portfolio level, conservative monthly estimates place casual free users around a few cents of cost and heavy Pro users around ~$0.80 in monthly variable cost. This keeps the free cohort economically supportable as a conversion funnel, rather than a margin drain.

On the revenue side, with a $3.99 monthly plan and standard small-business platform fee assumptions, net receipts are approximately $3.39 before infrastructure costs. Even against heavy-user cost assumptions, gross margin remains healthy. The $29.99 yearly plan reinforces retention while preserving strong margins.

The strategic result is a model with three positive properties: user value is obvious, conversion moments are behavior-driven, and unit economics remain resilient at higher usage intensity.

## Closing: Why RevenueCat Judges Should Care

EITO is not presenting monetization as a mockup. It is implemented as production-oriented payment infrastructure integrated with product behavior.

The RevenueCat layer includes structured offering/package resolution, fallback product handling when mapping issues occur, and readiness diagnostics for configuration failures. Subscription state is reconciled with app profile state, and customer info updates are handled through listener-based synchronization.

The purchase lifecycle includes both direct paywall purchase and restore flows, with graceful handling for cancellation and transient network conditions. This reduces failure risk in real environments and improves trust in premium entitlements.

From a founder perspective, the objective is clear: build the most practical AI cooking execution product in its category, with monetization that is fair to users and durable for the business. RevenueCat is central to making that objective reliable at scale.

— Mohamed Al-Azool, Founder, EITO (`com.moalazool.recipeapp`)
