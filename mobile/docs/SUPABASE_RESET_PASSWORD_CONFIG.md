# Supabase Password Reset Configuration Guide

This guide explains how to properly configure Supabase for password reset deep linking across all platforms.

## Issue: "Invalid Links for Reset Password"

If you're getting invalid links, follow this configuration guide carefully.

## Supabase Dashboard Configuration

### 1. Navigate to Authentication Settings

1. Open your Supabase project dashboard
2. Go to **Authentication** → **URL Configuration**

### 2. Configure Site URL

Set your **Site URL** to your production domain:

**For Development:**
```
http://localhost:8081
```

**For Production:**
```
https://yourdomain.com
```

### 3. Configure Redirect URLs

Add ALL of the following URLs to **Redirect URLs**:

**For Development:**
```
http://localhost:8081/(auth)/callback
http://localhost:8081/(auth)/reset-password
vitalspark://(auth)/callback
vitalspark://(auth)/reset-password
exp://localhost:8081
```

**For Production:**
```
https://yourdomain.com/(auth)/callback
https://yourdomain.com/(auth)/reset-password
vitalspark://(auth)/callback
vitalspark://(auth)/reset-password
```

**Important Notes:**
- Click the "+" button to add each URL separately
- Include both callback AND reset-password URLs
- Include BOTH http/https AND vitalspark:// schemes
- Save changes after adding all URLs

### 4. Email Template Configuration

1. Go to **Authentication** → **Email Templates**
2. Select **Reset Password** template
3. Ensure the email uses `{{ .ConfirmationURL }}` variable

**Example Email Template:**
```html
<h2>Reset Your Password</h2>
<p>Click the link below to reset your password:</p>
<p><a href="{{ .ConfirmationURL }}">Reset Password</a></p>
<p>If you didn't request this, please ignore this email.</p>
<p>This link expires in 1 hour.</p>
```

## Platform-Specific Configuration

### Web Configuration

**What Supabase sends:**
```
https://yourdomain.com/(auth)/callback#access_token=xxx&refresh_token=yyy&type=recovery
```

**How it works:**
1. User clicks link in email
2. Browser opens to callback URL
3. Supabase auto-detects hash parameters
4. Callback handler checks for `type=recovery` in hash
5. Routes to reset-password screen
6. Session is already established

**No additional configuration needed** - works out of the box!

### iOS Configuration

**What Supabase sends:**
```
vitalspark://(auth)/callback?access_token=xxx&refresh_token=yyy&type=recovery
```

**app.json configuration:**
```json
{
  "expo": {
    "scheme": "vitalspark",
    "ios": {
      "bundleIdentifier": "com.app.vitalspark",
      "associatedDomains": ["applinks:vitalspark.app"]
    }
  }
}
```

**How it works:**
1. User taps link in email app
2. iOS opens VitalSpark app via custom URL scheme
3. Callback handler receives tokens
4. Sets session with tokens
5. Routes to reset-password screen

**Already configured!** ✅

### Android Configuration

**What Supabase sends:**
```
vitalspark://(auth)/callback?access_token=xxx&refresh_token=yyy&type=recovery
```

**app.json configuration:**
```json
{
  "android": {
    "package": "com.app.vitalspark",
    "intentFilters": [
      {
        "action": "VIEW",
        "data": [
          {
            "scheme": "vitalspark",
            "host": "auth",
            "pathPrefix": "/"
          }
        ],
        "category": ["BROWSABLE", "DEFAULT"]
      }
    ]
  }
}
```

**How it works:**
1. User taps link in email app
2. Android opens VitalSpark app via intent filter
3. Callback handler receives tokens
4. Sets session with tokens
5. Routes to reset-password screen

**Already configured!** ✅

## Testing the Configuration

### Test on Web (Easiest)

1. Open your app in a browser
2. Navigate to forgot-password
3. Enter your email
4. Check your email inbox
5. Click the reset link
6. Should redirect to reset-password screen
7. Enter new password and submit

**If it doesn't work:**
- Check browser console for errors
- Verify Supabase redirect URLs include your localhost URL
- Check that email template has `{{ .ConfirmationURL }}`

### Test on Native (iOS/Android)

**Option 1: Using Email**
1. Build and install app on device
2. Navigate to forgot-password in app
3. Enter your email
4. Open email on the SAME device
5. Tap the reset link
6. App should open to reset-password screen

**Option 2: Using Terminal Commands**

**iOS Simulator:**
```bash
xcrun simctl openurl booted "vitalspark://(auth)/callback?access_token=test&refresh_token=test&type=recovery"
```

**Android Emulator:**
```bash
adb shell am start -W -a android.intent.action.VIEW -d "vitalspark://(auth)/callback?access_token=test&refresh_token=test&type=recovery"
```

## Common Issues and Solutions

### Issue 1: "Invalid Link" Toast on All Platforms

**Cause:** Redirect URLs not added to Supabase

**Solution:**
1. Go to Supabase Dashboard → Authentication → URL Configuration
2. Add ALL redirect URLs listed above
3. Make sure to include both `callback` and `reset-password` routes
4. Save changes and try again

### Issue 2: Web Links Don't Work

**Cause:** Site URL not set correctly

**Solution:**
1. Check Supabase Site URL matches your domain
2. For dev: `http://localhost:8081`
3. For prod: `https://yourdomain.com`
4. No trailing slash!

### Issue 3: Email Links Go to Wrong URL

**Cause:** Email template not configured correctly

**Solution:**
1. Go to Authentication → Email Templates
2. Click "Reset Password"
3. Verify it uses `{{ .ConfirmationURL }}`
4. Not `{{ .SiteURL }}` or hardcoded URL

### Issue 4: Native Apps Don't Open

**Cause:** Deep linking not configured

**Solution:**
- iOS: Run `npx expo prebuild` to generate native files
- Android: Check intent filters in AndroidManifest.xml
- Both: Verify app is installed on device
- Test with terminal commands first

### Issue 5: Session Not Found

**Cause:** Tokens expired or invalid

**Solution:**
- Request a new reset link (tokens expire after 1 hour)
- Check Supabase logs for authentication errors
- Verify email was sent successfully

## Environment Variables

Ensure these are set in your `.env.local`:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

**Verify:**
- No quotes around values
- URL starts with `https://`
- Keys are correct (from Supabase dashboard)

## Verification Checklist

Before testing, verify:

- [ ] Supabase Site URL is set correctly
- [ ] All redirect URLs added to Supabase (both callback and reset-password)
- [ ] Email template uses `{{ .ConfirmationURL }}`
- [ ] Environment variables are set
- [ ] App scheme is `vitalspark` in app.json
- [ ] Bundle identifiers match (iOS/Android)
- [ ] Deep linking is working (test with terminal commands)

## Debug Mode

To see what's happening, check console logs:

**Web (Browser Console):**
```javascript
// Should see:
"Session established successfully"
"Password recovery detected, redirecting to reset-password"
```

**Native (Terminal/Logcat):**
```
// Should see:
"Password recovery callback"
"Email verified and session established!"
```

## Still Not Working?

### Quick Fix: Direct Link Method

If callback routing is still failing, you can use direct routing:

**Update `sendPasswordResetEmail` in `hooks/useAuth.ts`:**
```typescript
const redirectTo = Platform.OS === 'web' 
  ? `${window.location.origin}/(auth)/reset-password`
  : 'vitalspark://(auth)/reset-password';

const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
  redirectTo: redirectTo,
});
```

This bypasses the callback handler and goes directly to reset-password.

## Support Resources

- Supabase Docs: https://supabase.com/docs/guides/auth/passwords
- Expo Linking: https://docs.expo.dev/guides/linking/
- Deep Linking: https://reactnavigation.org/docs/deep-linking/

## Testing Email Templates

To test email links without sending real emails:

1. Go to Supabase → Authentication → Users
2. Click on a test user
3. Click "Send password recovery email"
4. Check the URL that would be sent
5. Verify it matches your expected format

