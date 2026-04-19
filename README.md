# VitalSpark by Ferdie

VitalSpark is a fitness and wellness app designed to help users train smarter, recover better, and build sustainable habits. This repository contains the source code and development files for the VitalSpark platform.

## Features

- Smart workout generation
- Recovery and mindfulness tools
- Progress tracking
- Nutrition and habit support

## Collaborators

- Ferdinand Delima (Owner)
- Katrina Amores (Contributor)

## Repository layout

The web application lives in **`frontend/`** (Next.js App Router). Setup, environment variables, and scripts documented below assume you work from that folder unless noted.

## Frontend documentation

| Document | Description |
| -------- | ----------- |
| **[frontend/FRONTEND_NAVIGATION_STRUCTURE.md](frontend/FRONTEND_NAVIGATION_STRUCTURE.md)** | Route map and user flow: onboarding → main app → admin and API routes |
| **[frontend/AUTH_SETUP.md](frontend/AUTH_SETUP.md)** | Supabase auth, providers, guards, and env vars |

## Frontend stack

- Next.js `16`
- React `19`
- TypeScript
- Tailwind CSS `4`
- Supabase (`@supabase/supabase-js`)
- OpenAI + Google GenAI integrations for AI features

### Hosting & tooling

- Vercel (hosting)
- GitHub (version control)

## Prerequisites

- Node.js `20+` (recommended LTS)
- npm (the frontend includes `package-lock.json`)
- A Supabase project (URL + keys)
- OpenAI API key for text/voice generation routes
- (Optional) Google Cloud credentials for image generation route

## Installation

From the repository root:

```bash
cd frontend
npm install
```

## Environment variables

Create **`frontend/.env.local`**:

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

## Run the app

```bash
cd frontend
npm run dev
```

The app runs at [http://localhost:3000](http://localhost:3000).

## Scripts (`frontend/`)

- `npm run dev` — local development server
- `npm run build` — production build
- `npm run start` — run production build locally
- `npm run lint` — ESLint

## Frontend folder structure (high level)

Paths are under `frontend/`:

- `src/app/` — routes, layouts, API route handlers
- `src/components/` — shared UI components
- `src/contexts/` — app-level React contexts
- `src/hooks/` — reusable hooks
- `src/lib/` — API clients and AI helpers
- `src/types/` — TypeScript models/interfaces
- `public/` — static assets (images/audio)

## Authentication (overview)

- Auth uses Supabase and React context in the frontend.
- Auth pages live under `frontend/src/app/auth/` (`login`, `signup`, `forgot-password`, `reset-password`, `callback`, `email-verify`, etc.).
- Details: **[frontend/AUTH_SETUP.md](frontend/AUTH_SETUP.md)**.

## Developer reminders

- Keep secrets in `frontend/.env.local` only. Never commit API keys.
- Prefer `OPENAI_API_KEY` for server-side routes; treat `NEXT_PUBLIC_*` as client-exposed.
- Run `npm run lint` in `frontend/` before opening PRs.
- When adding new env vars in code, update this README.
- AI/image features can be rate-limited; use the optional delay/quota variables above during testing.

## Troubleshooting

- **Missing Supabase variables**: auth/data features fail to initialize.
- **Missing OpenAI key**: workout/meal generation or TTS endpoints return configuration errors.
- **Google image generation failing**: verify service account JSON/path and project/location values.
- **Build errors after dependency changes**: in `frontend/`, remove `node_modules` and run `npm install` again.
