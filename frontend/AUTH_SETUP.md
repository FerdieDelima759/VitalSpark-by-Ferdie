# Authentication Setup - Frontend

This document describes the authentication setup for the VitalSpark frontend application.

## Structure

### API Configuration
- **Location**: `src/lib/api/supabase.ts`
- **Description**: Simplified Supabase client for web-only (no React Native dependencies)
- **Environment Variables Required**:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Types
- **Location**: `src/types/`
- **Files**:
  - `auth.ts` - Authentication-related types
  - `UserProfile.ts` - User profile types

### Contexts
- **Location**: `src/contexts/AuthContext.tsx`
- **Description**: React context for managing authentication state
- **Usage**: Wrap your app with `<AuthProvider>` in the root layout

### Hooks
- **Location**: `src/hooks/useAuth.ts`
- **Description**: Authentication methods (sign in, sign up, password reset, etc.)
- **Exports**: 
  - `auth` - Singleton instance with authentication methods
  - Also available as React hook: `useAuth()` from `@/contexts/AuthContext`

### Components
- **Location**: `src/components/`
- **Files**:
  - `Toast.tsx` - Toast notification component
  - `Dialog.tsx` - Modal dialog component

### Auth Pages
- **Location**: `src/app/auth/`
- **Pages**:
  - `/auth/login` - Login page
  - `/auth/signup` - Sign up page
  - `/auth/forgot-password` - Password reset request page
  - `/auth/reset-password` - Password reset page
  - `/auth/callback` - OAuth/callback handler
  - `/auth/email-verify` - Email verification status page

## Setup Instructions

1. **Install dependencies** (already done):
   ```bash
   npm install @supabase/supabase-js
   ```

2. **Set up environment variables**:
   Create a `.env.local` file in the `frontend` directory:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

3. **The AuthProvider is already configured** in `src/app/layout.tsx`

## Usage

### Using the auth hook in components:
```typescript
import { auth } from '@/hooks/useAuth';

// Sign in
const response = await auth.signIn({ email, password });

// Sign up
const response = await auth.signUp({ email, password });

// Password reset
const response = await auth.sendPasswordResetEmail(email);
```

### Using the Auth context:
```typescript
import { useAuth } from '@/contexts/AuthContext';

function MyComponent() {
  const { user, isAuthenticated, isLoading, signOut } = useAuth();
  
  if (isLoading) return <div>Loading...</div>;
  if (!isAuthenticated) return <div>Please log in</div>;
  
  return <div>Welcome, {user?.email}</div>;
}
```

## Differences from Mobile App

1. **No Platform checks** - Web-only, simplified code
2. **Web-specific components** - Using HTML/CSS instead of React Native components
3. **Next.js routing** - Using Next.js App Router instead of Expo Router
4. **Tailwind CSS** - Using Tailwind for styling instead of React Native StyleSheet
5. **Simplified storage** - Using `localStorage` directly instead of custom storage adapter

## Notes

- All API calls are client-side (using Supabase JS client)
- Authentication state is managed through React Context
- Password validation rules: minimum 6 characters, at least one uppercase, lowercase, and number
- Email validation uses standard regex pattern

