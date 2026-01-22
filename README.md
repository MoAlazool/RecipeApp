# Recipe App

Turn cooking videos and fridge photos into usable recipes with AI-powered extraction.

## Features

- **Video to Recipe** - Paste YouTube/TikTok/Instagram URL, AI extracts ingredients & steps
- **Fridge Scan** - Take a photo, get recipe ideas based on what you have
- **Smart Shopping Lists** - Auto-generate from recipes, grouped by section
- **Cooking Mode** - Step-by-step guidance with timers
- **Subscriptions** - RevenueCat paywall for premium features

## Tech Stack

- **Frontend**: React Native (Expo SDK 54), TypeScript
- **Backend**: Supabase (PostgreSQL + Auth)
- **AI**: Google Gemini
- **Payments**: RevenueCat

## Setup

```bash
# Install dependencies
npm install

# Add environment variables
cp .env.example .env

# Start dev server
npm start
```

## Common Commands

```bash
npm start            # Expo dev server
npm run ios          # Run iOS
npm run android      # Run Android
npm run web          # Run Web
npm run lint         # ESLint
npm run type-check   # TypeScript type check
```

## Environment Variables

```env
EXPO_PUBLIC_SUPABASE_URL=your-supabase-url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_GEMINI_API_KEY=your-gemini-key
EXPO_PUBLIC_TRANSCRIPT_API_URL=your-transcript-api
EXPO_PUBLIC_REVENUECAT_APPLE_KEY=your-rc-apple-key
EXPO_PUBLIC_REVENUECAT_GOOGLE_KEY=your-rc-google-key
```

## Project Structure

```
app/                  # Expo Router screens
components/           # UI components
services/             # Integrations (AI, Supabase, social)
stores/               # Zustand state
utils/                # Types & helpers
assets/               # Images, icons, splash
server/transcript-api # Optional FastAPI transcript service
```

## Notes

- Expo public env vars (`EXPO_PUBLIC_*`) are bundled at build time—don’t commit secrets.
- The optional transcript API improves YouTube extraction reliability.

## License

MIT
