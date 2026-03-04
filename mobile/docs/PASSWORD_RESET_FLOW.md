# Password Reset Deep Linking Flow

Complete implementation of password reset functionality with deep linking support for web, iOS, and Android platforms.

## Overview

The password reset flow allows users to securely reset their passwords by receiving a link via email. The system supports deep linking across all platforms, ensuring a seamless experience whether users access the app through web browsers or native mobile apps.

## Components

### 1. **Forgot Password Screen** (`app/(auth)/forgot-password.tsx`)
- User enters their email address
- Sends password reset email via Supabase
- Shows success/error toast notifications
- Auto-redirects back to login after 2 seconds on success

### 2. **Reset Password Screen** (`app/(auth)/reset-password.tsx`)
- Receives reset token from URL parameters (deep link)
- User enters new password and confirmation
- Validates password strength
- Updates password in Supabase
- Redirects to login on success

### 3. **Callback Handler** (`app/(auth)/callback.tsx`)
- Handles deep link redirects from email
- Detects recovery type (`type=recovery`)
- Sets session with access/refresh tokens
- Redirects to reset-password screen with token

### 4. **Updated Login Screen** (`app/(auth)/login.tsx`)
- "Forgot Password?" link navigates to forgot-password screen
- No longer shows placeholder alert

### 5. **Auth Service** (`hooks/useAuth.ts`)
- `sendPasswordResetEmail(email)` - Sends reset email
- `resetPassword({ token, newPassword })` - Updates password
- Proper error handling and validation

## Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         PASSWORD RESET FLOW                      │
└─────────────────────────────────────────────────────────────────┘

1. USER INITIATES RESET
   Login Screen → Click "Forgot Password?" → Navigate to Forgot Password

2. REQUEST RESET EMAIL
   Forgot Password Screen → Enter Email → Send Reset Email
   ↓
   Supabase sends email with deep link

3. DEEP LINK STRUCTURE
   Web:      https://yourdomain.com/(auth)/reset-password?token=xxx&type=recovery
   iOS:      vitalspark://(auth)/reset-password?token=xxx&type=recovery
   Android:  vitalspark://(auth)/reset-password?token=xxx&type=recovery

4. HANDLE DEEP LINK
   a) Web:
      - Supabase auto-detects hash in URL
      - Direct navigation to reset-password screen
      - Token extracted from URL params
   
   b) iOS/Android:
      - App opens via deep link
      - Callback handler processes tokens
      - Sets session with access/refresh tokens
      - Redirects to reset-password screen

5. RESET PASSWORD
   Reset Password Screen → Enter New Password → Submit
   ↓
   Password updated in Supabase
   ↓
   Success toast → Redirect to Login (2s delay)

6. LOGIN WITH NEW PASSWORD
   User logs in with new credentials
```

## Platform-Specific Implementation

### Web

**Deep Link Format:**
```
https://yourdomain.com/(auth)/reset-password?token=xxx&type=recovery#access_token=yyy&refresh_token=zzz
```

**Flow:**
1. User clicks reset link in email
2. Browser opens to reset-password URL
3. Supabase automatically handles hash parameters
4. Token extracted from URL query params
5. User enters new password and submits

**Configuration:**
- `detectSessionInUrl: true` in Supabase config
- Uses `window.location.origin` for redirect URI

### iOS

**Deep Link Format:**
```
vitalspark://(auth)/reset-password?token=xxx&type=recovery&access_token=yyy&refresh_token=zzz
```

**Flow:**
1. User taps reset link in email (iOS Mail app)
2. iOS opens VitalSpark app via custom URL scheme
3. Callback handler processes tokens
4. Session established with Supabase
5. Navigate to reset-password screen
6. User enters new password

**Configuration:**
- App scheme: `vitalspark`
- Associated domains: `applinks:vitalspark.app`
- Universal Links for better UX (optional)

### Android

**Deep Link Format:**
```
vitalspark://(auth)/reset-password?token=xxx&type=recovery&access_token=yyy&refresh_token=zzz
```

**Flow:**
1. User taps reset link in email (Gmail/other)
2. Android opens VitalSpark app via intent filter
3. Callback handler processes tokens
4. Session established with Supabase
5. Navigate to reset-password screen
6. User enters new password

**Configuration:**
- Package: `com.app.vitalspark`
- Scheme: `vitalspark`
- Intent filters in `app.json` for custom URL schemes
- Android App Links for better UX (optional)

## Code Examples

### Sending Password Reset Email

```typescript
import { auth } from "../../hooks/useAuth";

const handleSendResetEmail = async () => {
  const response = await auth.sendPasswordResetEmail("user@example.com");
  
  if (response.success) {
    console.log("Reset email sent!");
  } else {
    console.error("Error:", response.message);
  }
};
```

### Resetting Password with Token

```typescript
import { auth } from "../../hooks/useAuth";

const handleResetPassword = async (token: string, newPassword: string) => {
  const response = await auth.resetPassword({
    token,
    newPassword,
  });
  
  if (response.success) {
    console.log("Password reset successfully!");
  } else {
    console.error("Error:", response.message);
  }
};
```

### Navigating to Forgot Password

```typescript
import { useRouter } from "expo-router";

const router = useRouter();

const handleForgotPassword = () => {
  router.push("/(auth)/forgot-password");
};
```

## Deep Link Configuration

### app.json

Already configured with:
- **Scheme:** `vitalspark`
- **iOS Associated Domains:** `applinks:vitalspark.app`
- **Android Intent Filters:** For custom URL schemes

### Supabase Configuration

**Email Template Variables:**
- `{{ .ConfirmationURL }}` - Contains the full deep link
- Supabase automatically appends tokens to the redirect URI

**In Supabase Dashboard:**
1. Go to Authentication → URL Configuration
2. Set Site URL: `https://yourdomain.com`
3. Add Redirect URLs:
   - `https://yourdomain.com/(auth)/reset-password`
   - `vitalspark://(auth)/reset-password`
   - `http://localhost:8081/(auth)/reset-password` (dev)

## Testing

### Testing on Web (Desktop)

1. Open app in browser
2. Click "Forgot Password?" on login
3. Enter email and submit
4. Check email for reset link
5. Click link → Opens reset-password page
6. Enter new password → Success

### Testing on Web (Mobile Device)

1. Open app in mobile browser
2. Will redirect to download-app page
3. Testing requires disabling mobile redirect temporarily

### Testing on iOS Simulator

1. Build and run app in simulator
2. Navigate to forgot-password
3. Enter email and submit
4. Open email in simulator
5. Tap reset link → Opens app via deep link
6. Enter new password

**Note:** Email links in simulator may need special handling. Use `xcrun simctl openurl booted "vitalspark://(auth)/reset-password?token=xxx"` for testing.

### Testing on Android Emulator

1. Build and run app in emulator
2. Navigate to forgot-password
3. Enter email and submit
4. Open email (use Gmail app in emulator)
5. Tap reset link → Opens app via intent
6. Enter new password

**Note:** Test deep link with:
```bash
adb shell am start -W -a android.intent.action.VIEW -d "vitalspark://(auth)/reset-password?token=xxx"
```

## Security Considerations

### Token Handling
- Tokens are passed via URL parameters
- Tokens are single-use and expire after a set time
- Supabase manages token validation
- Session is established before password update

### Password Validation
- Minimum 6 characters (configurable in `auth.validatePassword`)
- Password must match confirmation
- Client-side validation before API call

### Error Handling
- Invalid/expired tokens show error message
- Network errors handled gracefully
- User redirected to appropriate screens on failure

## Troubleshooting

### Deep Links Not Opening App

**iOS:**
- Verify URL scheme in `app.json` matches
- Check Associated Domains configuration
- Ensure app is installed on device
- Try Universal Links instead of custom schemes

**Android:**
- Verify intent filters in `app.json`
- Check package name matches
- Ensure app is installed
- Use `adb` commands to test manually

### Web Links Not Working

- Check Supabase redirect URLs configuration
- Verify `detectSessionInUrl: true` in Supabase config
- Check browser console for errors
- Ensure proper HTTPS in production

### Token Not Found

- Check URL parameters are being passed correctly
- Verify Supabase email template includes `{{ .ConfirmationURL }}`
- Check callback handler is setting session properly
- Look for token extraction errors in console

## Production Checklist

- [ ] Update store URLs in Supabase Dashboard
- [ ] Configure production domain in Supabase
- [ ] Add all redirect URLs to Supabase allowlist
- [ ] Test deep links on physical devices (iOS/Android)
- [ ] Verify email templates have correct links
- [ ] Test with real email providers (Gmail, Outlook, etc.)
- [ ] Implement rate limiting for reset requests
- [ ] Add analytics tracking for reset flow
- [ ] Test on various screen sizes (responsive)
- [ ] Handle offline scenarios gracefully

## Files Modified/Created

### Created:
- `app/(auth)/forgot-password.tsx` - Email input screen
- `app/(auth)/reset-password.tsx` - Password reset form
- `docs/PASSWORD_RESET_FLOW.md` - This documentation

### Modified:
- `hooks/useAuth.ts` - Added password reset methods
- `utils/supabase.ts` - Updated `getRedirectUri` for routes
- `app/(auth)/callback.tsx` - Handle recovery type
- `app/(auth)/login.tsx` - Navigate to forgot-password

## API Methods

### auth.sendPasswordResetEmail(email: string)

Sends password reset email to user.

**Parameters:**
- `email` - User's email address

**Returns:**
```typescript
{
  success: boolean,
  message: string,
  error?: string
}
```

### auth.resetPassword({ token, newPassword })

Updates user password with reset token.

**Parameters:**
- `token` - Reset token from URL
- `newPassword` - New password

**Returns:**
```typescript
{
  success: boolean,
  message: string,
  data?: { user },
  error?: string
}
```

## URL Examples

### Development
```
Web:     http://localhost:8081/(auth)/reset-password
iOS:     vitalspark://(auth)/reset-password
Android: vitalspark://(auth)/reset-password
```

### Production
```
Web:     https://vitalspark.app/(auth)/reset-password
iOS:     vitalspark://(auth)/reset-password (or Universal Link)
Android: vitalspark://(auth)/reset-password (or App Link)
```

## Future Enhancements

- Add password strength indicator
- Implement rate limiting UI feedback
- Add "Resend reset email" option
- Show password requirements dynamically
- Add biometric authentication option
- Implement session timeout warnings
- Add two-factor authentication support

