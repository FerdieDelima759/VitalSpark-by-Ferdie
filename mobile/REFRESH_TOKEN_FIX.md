# Refresh Token Error Fix

## Problem

The application was experiencing an `AuthApiError: Invalid Refresh Token: Refresh Token Not Found` error when starting up. This error occurred because Supabase was attempting to automatically restore a session from storage, but encountered an invalid or corrupted refresh token.

## Root Cause

The error typically happens when:

1. An invalid or expired session is stored in localStorage/AsyncStorage
2. The storage adapter doesn't properly validate stored data
3. Session refresh fails but the invalid session remains in storage
4. The app tries to restore the invalid session on subsequent launches

## Solution Implemented

### 1. Enhanced Storage Adapter (`utils/supabase.ts`)

Added robust error handling and validation to the custom storage adapter:

- **JSON Validation**: Validates that stored values are valid JSON before returning them
- **Automatic Cleanup**: Automatically removes invalid/corrupted data from storage
- **Error Catching**: Wraps all storage operations in try-catch blocks to prevent crashes
- **Graceful Degradation**: Returns null instead of throwing errors when storage is unavailable

```typescript
getItem: async (key: string) => {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const value = window.localStorage.getItem(key);
      if (value) {
        try {
          JSON.parse(value); // Validate JSON
          return value;
        } catch (parseError) {
          window.localStorage.removeItem(key); // Remove invalid data
          return null;
        }
      }
      return value;
    }
    return null;
  } catch (error) {
    console.error("Error getting item from storage:", error);
    return null;
  }
};
```

### 2. Session Validation on Startup

Added automatic invalid session detection and cleanup:

- **Session Check**: Validates the stored session when the app initializes
- **Automatic Signout**: Clears invalid sessions automatically
- **Platform-Specific**: Handles both web and native platforms appropriately

```typescript
const clearInvalidSession = async () => {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.warn("Invalid session detected, clearing...", error.message);
      await supabase.auth.signOut();
    }
  } catch (error) {
    console.error("Error checking session:", error);
    await supabase.auth.signOut();
  }
};
```

### 3. Auth State Monitoring

Added event listener to monitor authentication state changes:

- Logs successful token refreshes
- Tracks sign-in/sign-out events
- Helps with debugging authentication issues

### 4. User-Friendly Error Messages (`hooks/useAuth.ts`)

Enhanced error message mapping to provide clear feedback to users:

```typescript
'Invalid Refresh Token': 'Your session has expired. Please sign in again.',
'Refresh Token Not Found': 'Your session has expired. Please sign in again.',
'refresh_token_not_found': 'Your session has expired. Please sign in again.',
```

### 5. Utility Function for Manual Storage Clearing

Added `clearAuthStorage()` function for manual session cleanup:

```typescript
export const clearAuthStorage = async (): Promise<void> => {
  await supabase.auth.signOut();
  // Clears all known Supabase auth storage keys
};
```

## Benefits

1. **No More Startup Crashes**: Invalid sessions are automatically cleared
2. **Better User Experience**: Clear error messages instead of technical jargon
3. **Automatic Recovery**: App self-heals from corrupted session state
4. **Platform Agnostic**: Works on both web and native platforms
5. **Debugging Support**: Console logs help identify auth issues

## Testing

To verify the fix works:

1. **Test Normal Flow**: Sign up → Sign in → Verify session persists
2. **Test Invalid Session**:
   - Open browser DevTools → Application → Local Storage
   - Manually corrupt the Supabase auth token
   - Refresh the page → App should clear invalid session without crashing
3. **Test Session Expiry**: Wait for token to expire → App should handle gracefully

## Usage

### Automatic (Default)

The fix works automatically - no code changes needed in components.

### Manual Session Clearing (Optional)

If you need to manually clear sessions (e.g., for logout or debugging):

```typescript
import { clearAuthStorage } from "../utils/supabase";

// In your component or function
await clearAuthStorage();
```

## Files Modified

1. `utils/supabase.ts` - Enhanced storage adapter and session validation
2. `hooks/useAuth.ts` - Improved error message handling

## Prevention

To prevent similar issues in the future:

1. Always validate data before storing in localStorage/AsyncStorage
2. Implement proper error handling in storage adapters
3. Clear invalid sessions automatically on startup
4. Use environment-specific storage strategies
5. Monitor auth state changes for debugging

## Additional Notes

- The fix is backward compatible with existing authentication flows
- No changes required to environment variables or Supabase configuration
- Works with Supabase's automatic token refresh mechanism
- Handles both web (localStorage) and native (AsyncStorage) platforms

## Troubleshooting

If you still experience refresh token errors:

1. **Clear Browser Cache**: Clear all site data for your app
2. **Check Environment Variables**: Ensure EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY are correct
3. **Manual Storage Clear**: Run `clearAuthStorage()` manually
4. **Check Supabase Dashboard**: Verify auth settings in your Supabase project
5. **Review Console Logs**: Look for session-related warnings/errors

---

**Last Updated**: November 5, 2025
**Status**: ✅ Fixed and Tested
