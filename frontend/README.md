# VitalSpark Frontend

Frontend app for the VitalSpark platform, built with Next.js (App Router), React, TypeScript, and Tailwind CSS.

## Stack

- Next.js `16`
- React `19`
- TypeScript
- Tailwind CSS `4`
- Supabase (`@supabase/supabase-js`)
- OpenAI + Google GenAI integrations for AI features

## Prerequisites

- Node.js `20+` (recommended LTS)
- npm (project currently includes `package-lock.json`)
- A Supabase project (URL + keys)
- OpenAI API key for text/voice generation routes
- (Optional) Google Cloud credentials for image generation route

## Installation

From the `frontend/` directory:

```bash
npm install
```

## Environment Variables

Create `frontend/.env.local` and add:

```env
# Supabase (required)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_SUPABASE_SERVICE_KEY=your_supabase_service_key

# OpenAI (required for AI workout/meal/tts features)
OPENAI_API_KEY=your_openai_api_key
# Optional fallback currently used by some client/server utilities
NEXT_PUBLIC_OPENAI_API_KEY=your_openai_api_key

# Optional runtime tuning / debug flags
NEXT_PUBLIC_AI_LOGS=false
NEXT_PUBLIC_DAY_GEN_CONCURRENCY=2
NEXT_PUBLIC_SUPABASE_FETCH_TIMEOUT_MS=15000
NEXT_PUBLIC_IMAGE_GEN_EXERCISE_DELAY_MIN_MS=1800
NEXT_PUBLIC_IMAGE_GEN_EXERCISE_DELAY_MAX_MS=3200
NEXT_PUBLIC_IMAGE_GEN_DAY_PAUSE_MS=20000
NEXT_PUBLIC_IMAGE_GEN_QUOTA_PAUSE_MS=1800000
NEXT_PUBLIC_IMAGE_GEN_VERBOSE_LOGS=false

# Optional: Google Cloud image generation
GOOGLE_CLOUD_PROJECT=your_project_id
GOOGLE_CLOUD_LOCATION=global
GOOGLE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}'
# OR use file credentials path
GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/credentials.json
```

## Run the App

```bash
npm run dev
```

App runs on:

- [http://localhost:3000](http://localhost:3000)

## Scripts

- `npm run dev` - start local development server
- `npm run build` - production build
- `npm run start` - run built app
- `npm run lint` - run ESLint checks

## Frontend Structure (High Level)

- `src/app/` - routes, layouts, API route handlers
- `src/components/` - shared UI components
- `src/contexts/` - app-level React contexts/state
- `src/hooks/` - reusable hooks
- `src/lib/` - API clients and AI helpers
- `src/types/` - TypeScript models/interfaces
- `public/` - static assets (images/audio)

## Authentication Notes

- Auth relies on Supabase and app context setup in the frontend.
- Main auth pages are under `src/app/auth/` (`login`, `signup`, `forgot-password`, `reset-password`, `callback`, `email-verify`).
- For more auth-specific implementation details, see `frontend/AUTH_SETUP.md`.

## Developer Reminders

- Keep secrets in `.env.local` only. Never commit API keys.
- Prefer `OPENAI_API_KEY` for server-side routes; keep `NEXT_PUBLIC_*` values safe for client exposure.
- Run `npm run lint` before opening PRs.
- If new env vars are introduced in code, update this README immediately.
- Some AI/image features can be rate-limited; use delay variables above to reduce quota errors during testing.

## Troubleshooting

- **Missing Supabase variables**: auth/data features fail to initialize.
- **Missing OpenAI key**: workout/meal generation or TTS endpoints return key configuration errors.
- **Google image generation failing**: verify service account JSON/path and project/location values.
- **Build errors after dependency changes**: remove `node_modules` and reinstall with `npm install`.
