# Sign Up Screen Setup Guide

## Overview

The sign up screen has been created with the same responsive design as the login screen, including full support for Supabase email confirmation with deep linking.

## What Was Implemented

### 1. **Sign Up Screen (`app/(auth)/signup.tsx`)**

- ✅ Same responsive design as login (scales for small and large screens)
- ✅ Three input fields:
  - Email
  - Create Password
  - Confirm Password
- ✅ Full form validation:
  - Email validation
  - Password matching
  - Minimum password length (6 characters)
- ✅ Show/Hide toggle for both password fields
- ✅ Responsive scaling for all screen sizes:
  - Small screens (< 1280 x 800): Scales down to 65% minimum
  - Medium screens (1280 x 800 - 1440 x 1024): 100% baseline
  - Large screens (>= 1440 x 1024): Scales up to 150% maximum
- ✅ Web-specific features:
  - No focus rings on inputs
  - Autofill colors removed

### 2. **Deep Linking Support**

Following the [Supabase Native Mobile Deep Linking Guide](https://supabase.com/docs/guides/auth/native-mobile-deep-linking?utm_source=expo&utm_medium=referral&utm_term=expo-react-native):

#### Updated Files:

- **`utils/supabase.ts`**
  - Added `expo-linking` for deep linking (web-compatible)
  - Created `getRedirectUri()` function for cross-platform deep linking
  - Handles web URLs and native app schemes automatically
  - Updated Supabase client configuration for session detection

- **`hooks/useAuth.ts`**
  - Updated `signUp()` method to include `emailRedirectTo` option
  - Email confirmation links now redirect back to the app

- **`app/(auth)/callback.tsx`** ✨ NEW
  - Handles email verification redirects from Supabase
  - Processes authentication tokens from callback URL
  - Platform-specific handling (web vs native)
  - Automatically sets session after email verification
  - Simple loading screen while processing
  - Redirects to email-verify screen with status

- **`app/(auth)/email-verify.tsx`** ✨ NEW
  - Beautiful email verification result screen with gradient background
  - Two states: Success or Error
  - Shows success checkmark or error alert icon
  - Displays appropriate success/error messages
  - 3-second countdown timer before redirecting to login
  - Receives status and message via route params

- **`app.json`**
  - Updated scheme to `vitalspark` (consistent across platforms)
  - Added iOS associated domains for universal links
  - Android intent filters already configured

### 3. **Navigation Updates**

- Login screen now navigates to signup screen (instead of showing alert)
- Signup screen navigates back to login after successful registration

### 4. **Email Verification Flow**

When a user signs up, here's what happens:

1. **User submits signup form** → `auth.signUp()` is called
2. **Supabase sends verification email** → Contains a magic link with auth tokens
3. **User clicks email link** → Opens the app at `vitalspark://(auth)/callback` or `exp://[ip]/--(auth)/callback`
4. **Callback handler activates** → `app/(auth)/callback.tsx` processes the tokens
5. **Session established** → User is authenticated
6. **Redirect to verification screen** → `app/(auth)/email-verify.tsx` shows success/error
7. **Countdown timer** → 3-second countdown before redirect
8. **Redirect to login** → User can now sign in with verified account

**Separation of Concerns:**

- **`(auth)/callback.tsx`**: Handles auth logic only (token processing, session setup)
- **`(auth)/email-verify.tsx`**: Handles UI/UX only (success/error display, countdown)

**Features:**

- ✅ Web-based email verification (automatic hash fragment detection)
- ✅ Native deep link verification (manual token extraction)
- ✅ Password recovery redirects
- ✅ Error handling with custom error messages
- ✅ Beautiful UI with success checkmark or error alert
- ✅ Animated countdown timer (3 seconds) before redirecting
- ✅ Clean separation between logic and presentation

## Setup Instructions

### Supabase Configuration

You need to add the redirect URLs to your Supabase project:

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **Authentication** → **URL Configuration**
4. Add these redirect URLs:

For development:

```
vitalspark://(auth)/callback
exp://localhost:8081/(auth)/callback
exp://192.168.1.60:8081/(auth)/callback
http://localhost:8081/(auth)/callback
http://192.168.1.60:8081/(auth)/callback
```

**Note**: Replace `192.168.1.60` with your actual local IP address (shown in Expo CLI when you run `npm start`)

For production (replace with your actual domains):

```
vitalspark://(auth)/callback
https://yourdomain.com/(auth)/callback
```

5. Save the changes

### App Configuration

The deep linking scheme is already configured in `app.json`:

- **Scheme**: `vitalspark`
- **iOS**: Associated domains configured
- **Android**: Intent filters configured

### Testing Deep Linking

#### On Development:

1. Start your app: `npm start`
2. Sign up with a valid email
3. Check your email for the confirmation link
4. Click the confirmation link
5. The app should open and handle the authentication

#### On Web:

- Email confirmation will redirect to the web URL you configured
- Session will be automatically restored

#### On Mobile (iOS/Android):

- Email confirmation will trigger the deep link
- App will open and handle the authentication token

## User Flow

1. **User clicks "Create an account" on login screen**
   → Navigates to signup screen

2. **User fills in email, password, and confirm password**
   → Client-side validation runs

3. **User submits the form**
   → API call to Supabase with `emailRedirectTo` parameter

4. **Supabase sends confirmation email**
   → Email contains deep link to app

5. **User clicks link in email**
   → App opens via deep linking
   → Session is automatically created

6. **User is redirected to login screen**
   → Can now sign in with verified account

## Password Requirements

- Minimum 6 characters (enforced by Supabase)
- Both password fields must match

## Error Handling

The signup screen handles:

- Missing fields
- Invalid email format
- Password mismatch
- Weak passwords
- Network errors
- Supabase errors (with friendly messages)

## Troubleshooting

### "Unmatched Route" Error

If you see an error like `exp://192.168.1.60:8081/(auth)/callback` showing "page could not be found":

1. **Verify the callback route exists**: Make sure `app/(auth)/callback.tsx` file is present
2. **Restart Expo**: Stop and restart with `npm start --clear`
3. **Check Supabase URLs**: Verify your IP address is added in Supabase Dashboard → Authentication → URL Configuration (use `/(auth)/callback` to match the route structure)
4. **Clear app cache**:
   - iOS: Delete app and reinstall
   - Android: Clear app data
   - Web: Clear browser cache

### Email Not Arriving

1. Check spam/junk folder
2. Verify email in Supabase Dashboard → Authentication → Users
3. Check Supabase email settings

### Deep Link Not Opening App

1. **iOS**: Make sure associated domains are configured in `app.json`
2. **Android**: Verify intent filters in `app.json`
3. **Development**: Use the Expo Go app or development build

## Package Dependencies

- ✅ `expo-linking` - Used for deep linking (already installed, web-compatible)
- ✅ `expo-web-browser` - Already installed
- ✅ `@supabase/supabase-js` - Already installed
- ✅ `@react-native-async-storage/async-storage` - Already installed

## Next Steps

1. **Configure Supabase redirect URLs** (see instructions above)
2. **Test the signup flow** on your development environment
3. **Create email confirmation callback handler** (if needed for custom UI)
4. **Configure email templates** in Supabase dashboard (optional)

## References

- [Supabase Deep Linking Documentation](https://supabase.com/docs/guides/auth/native-mobile-deep-linking?utm_source=expo&utm_medium=referral&utm_term=expo-react-native)
- [Expo Linking Documentation](https://docs.expo.dev/guides/linking/)
- [Expo Linking API Reference](https://docs.expo.dev/versions/latest/sdk/linking/)
