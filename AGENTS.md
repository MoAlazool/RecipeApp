# Repository Guidelines

## Project Structure & Module Organization
- `app/` holds Expo Router screens and route groups (e.g., `app/(tabs)/`, `app/auth/`).
- `components/` contains reusable UI pieces (cards, lists, inputs).
- `services/` is the integration layer (Supabase, Gemini, social scraping, RevenueCat).
- `stores/` contains Zustand state and persistence setup.
- `utils/` houses shared types, prompts, and helpers.
- `assets/` stores bundled images and app icons.
- `server/transcript-api/` is an optional FastAPI service for YouTube transcripts.

## Build, Test, and Development Commands
- `npm install` installs dependencies.
- `npm start` launches the Expo dev server.
- `npm run ios` / `npm run android` run native builds via Expo.
- `npm run web` starts the web target.
- `npm run lint` runs ESLint across the repo.
- `npm run type-check` runs TypeScript type checks.
- `npm run build:ios` / `npm run build:android` trigger EAS builds.

## Coding Style & Naming Conventions
- Language: TypeScript with Expo Router.
- Indentation: 2 spaces (follow existing files).
- File naming: `kebab-case` for route files (Expo Router), `PascalCase` for components.
- Prefer named exports for shared utilities and components.
- Keep integration logic in `services/`, UI in `components/`, state in `stores/`.

## Testing Guidelines
- No dedicated test framework is configured in this repo yet.
- Use `npm run type-check` and `npm run lint` as the baseline quality gates.
- If you add tests, colocate near features and document the runner in this file.

## Commit & Pull Request Guidelines
- Commit messages are short, imperative, and often prefixed (e.g., `Fix:`, `Refactor:`, `Update:`).
- Keep commits scoped to a single change when possible.
- PRs should include:
  - A concise description of the change.
  - Screenshots or screen recordings for UI changes.
  - Notes on impacted routes or services (e.g., `app/add-recipe.tsx`, `services/ai.service.ts`).

## Security & Configuration Tips
- Copy `.env.example` to `.env` and set `EXPO_PUBLIC_*` keys before running.
- Do not commit secrets; Expo public env vars are bundled at build time.
- If YouTube transcripts fail, configure `EXPO_PUBLIC_TRANSCRIPT_API_URL` to the optional service.
