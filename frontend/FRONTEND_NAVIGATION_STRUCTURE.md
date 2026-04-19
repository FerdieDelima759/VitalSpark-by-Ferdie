# Frontend Structure and Navigation Map

This document maps the frontend route structure and expected user navigation flow, from onboarding to daily use.

## Route Groups Overview

- `src/app/auth/*` - authentication entry and recovery flows
- `src/app/onboarding/*` - onboarding questionnaire and initial generation
- `src/app/(main)/*` - regular end-user app experience
- `src/app/admin/*` - admin management interfaces
- `src/app/api/*` - Next.js route handlers for AI and backend-integrated actions

## Primary User Journey

1. **Auth**
   - User lands on auth routes (`/auth/login`, `/auth/signup`, etc.) if not authenticated.
2. **Onboarding**
   - User is routed step-by-step through onboarding pages.
3. **Workout Generation**
   - User reaches `/onboarding/generate-workout` when profile setup is complete.
4. **Main App**
   - User enters `(main)` routes such as personal dashboard, workouts, meals, and profile pages.
5. **Session/Workout Execution**
   - User navigates to exercise session pages from workout details/plans.

## Onboarding Flow (Ordered)

Onboarding step order in current frontend logic:

1. `/onboarding/language`
2. `/onboarding/mood`
3. `/onboarding/profile`
4. `/onboarding/location`
5. `/onboarding/height`
6. `/onboarding/weight`
7. `/onboarding/fitness`
8. `/onboarding/target-muscle-group`
9. `/onboarding/dietary`
10. `/onboarding/finish`
11. `/onboarding/generate-workout`

Layout behavior:

- `src/app/onboarding/layout.tsx` controls onboarding header, step tracking, and back behavior.
- Header is hidden on `finish` and `generate-workout`.

## Main User Navigation (`(main)` routes)

Core pages:

- `/` (inside `(main)` group root)
- `/personal`
- `/personal/workout/details`
- `/personal/workout/exercises/session`
- `/personal/coach/workout`
- `/personal/coach/workout/details`
- `/workouts`
- `/workouts/details`
- `/workouts/exercise/session`
- `/meals`
- `/meals/plan`
- `/meals/workout/plan/[id]`
- `/my-profile`
- `/manage-profile`

Layout behavior:

- `src/app/(main)/layout.tsx` enforces auth checks and onboarding redirects.
- Bottom navigation is shown on most pages and hidden on exercise session routes.

## Admin Navigation (`/admin`)

Main admin areas:

- `/admin`
- `/admin/users`
- `/admin/subscriptions`
- `/admin/coach/*`
- `/admin/general/*`

Examples:

- Coach workout plans and day/exercise editors:
  - `/admin/coach/workout/plans`
  - `/admin/coach/workout/plans/[id]/daily`
  - `/admin/coach/workout/plans/[id]/daily/[dailyPlanId]/exercises`
- Coach nutrition:
  - `/admin/coach/nutrition`
  - `/admin/coach/nutrition/meal/plan`
  - `/admin/coach/nutrition/meal/[mealPlanId]`
- General workout and nutrition libraries:
  - `/admin/general/workouts`
  - `/admin/general/workouts/exercises`
  - `/admin/general/nutrition/*`

## API Route Handlers (`/api`)

Frontend-served API handlers used by UI features:

- `/api/generate-day-workout`
- `/api/generate-day-workout-rpe`
- `/api/generate-exercise-description`
- `/api/generate-image`
- `/api/google-tts`
- `/api/openai-tts`
- `/api/regenerate-meal`
- `/api/rest-day-message`

## Navigation and Maintenance Notes

- Keep route changes synchronized with:
  - onboarding step mapping in `src/app/(main)/layout.tsx`
  - onboarding header route-step map in `src/app/onboarding/layout.tsx`
- When adding/removing pages, update this document and any guard/redirect logic.
- Validate major route changes with `npm run build` to catch type and route issues early.
