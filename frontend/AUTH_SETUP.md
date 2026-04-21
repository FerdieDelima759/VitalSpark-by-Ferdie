# Authentication Setup (Frontend)

This document describes how authentication works in the **frontend** app (`frontend/`) using Supabase Auth + React context.

## Auth Architecture

- `src/lib/api/supabase.ts`
  - Creates the Supabase browser client.
  - Handles auth session storage and token refresh behavior.
  - Provides `getRedirectUri()` used by sign-up/password reset flows.
  - Includes recovery helpers like `clearAuthStorage()`.
- `src/contexts/AuthContext.tsx`
  - Source of truth for auth state in UI (`session`, `user`, `isLoading`, `isAuthenticated`).
  - Initializes session on app load and subscribes to `onAuthStateChange`.
  - Handles inactivity auto sign-out (1 hour idle) and timeout fallbacks.
- `src/hooks/useAuth.ts`
  - Wraps auth operations (`signIn`, `signUp`, reset password, update password, signOut).
  - Returns user-friendly error messages for common Supabase auth failures.

## Providers and Route Guards

- `src/app/layout.tsx`
  - Wraps app with `<AuthProvider>` globally.
- `src/app/(main)/layout.tsx`
  - Redirects unauthenticated users to `/auth/login`.
  - Checks onboarding status and routes users to the correct onboarding step.
  - Redirects onboarding-complete users without a saved plan to `/onboarding/generate-workout`.

## Auth Pages

Under `src/app/auth/`:

- `/auth/login`
- `/auth/signup`
- `/auth/forgot-password`
- `/auth/reset-password`
- `/auth/callback`
- `/auth/email-verify`
- `/auth/logout`

## Required Environment Variables

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Additional Variable Used in Current Frontend

```env
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_key
```

This key is used by backend-side admin helper logic in the current implementation. Treat it as highly sensitive and avoid exposing it outside trusted environments.

## Auth Flow (Frontend)

1. User opens app.
2. `AuthProvider` restores session via Supabase.
3. If not authenticated, `(main)` layout redirects to `/auth/login`.
4. After sign-in:
   - app reads `user_profile.is_onboarding_complete` and `current_step`
   - incomplete users are redirected to onboarding step routes
   - complete users continue to main pages (or workout generation if no plan yet)
5. On inactivity timeout, user is signed out and redirected to login with reason flag.

## Password and Validation Rules

From `useAuth.ts`:

- Minimum 6 characters
- Must contain at least one number
- Must contain at least one uppercase letter
- Must contain at least one lowercase letter

## Common Troubleshooting

- **"Missing Supabase environment variables"**
  - Confirm `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` exist in `.env.local`.
- **Login succeeds but session looks broken**
  - Clear local storage keys and retry; `clearAuthStorage()` logic exists for recovery.
- **Redirect issues after sign-up/reset**
  - Confirm site URL and redirect URLs in Supabase dashboard match your local/dev domain.
- **Unexpected logout**
  - Check inactivity timeout behavior (1 hour idle) and token refresh/network reliability.
