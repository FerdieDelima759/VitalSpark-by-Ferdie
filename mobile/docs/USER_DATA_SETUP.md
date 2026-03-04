# User Data Management - Setup Summary

This document provides a complete overview of the user data management system created for VitalSpark.

## 📁 Files Created

### 1. Type Definitions
**File:** `VitalSpark/types/UserProfile.ts`

Contains all TypeScript interfaces and types for:
- `UserProfile` - Main user profile interface matching the `user_profile` table
- `UserRole` - User role interface matching the `user_role` table
- Helper types for profile sections (PersonalInfo, FitnessPreferences, etc.)
- Update payload types
- Response types
- Validation types
- Loading state types

### 2. Context Provider
**File:** `VitalSpark/contexts/UserContext.tsx`

Provides global state management for user data:
- Automatically fetches user profile and role on mount
- Listens to auth state changes
- Provides user data to all child components
- Handles loading and error states
- Includes refresh and clear functions

### 3. Custom Hook
**File:** `VitalSpark/hooks/useUserData.ts`

Provides CRUD operations for user profiles and roles:

**Profile Operations:**
- `fetchUserProfile(userId)` - Fetch profile by user ID
- `createUserProfile(profile)` - Create new profile
- `updateUserProfile(userId, updates)` - Update existing profile
- `upsertUserProfile(profile)` - Create or update profile
- `deleteUserProfile(userId)` - Delete profile

**Role Operations:**
- `fetchUserRole(userId)` - Fetch role by user ID
- `createUserRole(role)` - Create new role
- `updateUserRole(userId, role)` - Update existing role
- `upsertUserRole(role)` - Create or update role

### 4. Documentation
**Files:**
- `VitalSpark/docs/USER_DATA_USAGE.md` - Comprehensive usage guide with examples
- `VitalSpark/docs/USER_DATA_SETUP.md` - This file

### 5. Example Component
**File:** `VitalSpark/components/examples/UserProfileExample.tsx`

Two example components demonstrating:
- `UserProfileExample` - Full CRUD operations demo
- `OnboardingProgressExample` - Onboarding step tracking demo

---

## 🚀 Quick Start

### Step 1: Wrap Your App with UserProvider

Update your root layout file to include the `UserProvider`:

```tsx
// VitalSpark/app/_layout.tsx
import { UserProvider } from '../contexts/UserContext';

export default function RootLayout() {
  return (
    <UserProvider>
      <Stack>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="index" />
        {/* other screens */}
      </Stack>
    </UserProvider>
  );
}
```

### Step 2: Use in Your Components

```tsx
import { useUserContext } from '../contexts/UserContext';
import { useUserData } from '../hooks/useUserData';

function MyComponent() {
  // Access current user data
  const { userProfile, userRole, loadingState } = useUserContext();
  
  // Access CRUD operations
  const { updateUserProfile, isLoading } = useUserData();
  
  // Use them...
}
```

---

## 🗄️ Database Schema

### Table: `user_profile`

Key fields:
- `id` - UUID (auto-generated)
- `user_id` - UUID (required, links to auth.users)
- `full_name`, `nickname`, `age_range`, `gender`
- `current_step`, `is_onboarding_complete`
- `fitness_goal`, `fitness_level`, `workout_location`
- `equipment_list[]`, `weekly_frequency[]`, `target_muscle_groups[]`
- `dietary_preference`, `meal_plan_duration[]`
- `health_conditions[]`
- `height`, `weight`, `height_unit`, `weight_unit`
- `country`, `region_province`
- `weekly_budget`, `weekly_budget_currency`
- `plan_code`
- `biometrics_enabled`
- `preferred_language`

### Table: `user_role`

Fields:
- `user_id` - UUID (primary key)
- `role` - Text (default: 'member')

---

## 🔑 Key Features

### 1. Automatic Context Updates
All CRUD operations automatically update the context after successful mutations.

### 2. Type Safety
Full TypeScript support with comprehensive type definitions.

### 3. Error Handling
Consistent error handling across all operations with friendly error messages.

### 4. Loading States
Multiple loading state indicators:
- `isLoading` - Initial data fetch
- `isUpdating` - During updates
- `isSaving` - During saves

### 5. Upsert Operations
Smart upsert operations that create or update based on existence.

### 6. Auth Integration
Automatic syncing with Supabase auth state changes.

---

## 📋 Common Use Cases

### Creating a Profile After Signup

```tsx
async function initializeUserProfile(userId: string) {
  const { createUserProfile, createUserRole } = useUserData();
  
  // Create profile
  await createUserProfile({
    user_id: userId,
    current_step: 1,
    is_onboarding_complete: false,
    plan_code: 'free',
  });
  
  // Create role
  await createUserRole({
    user_id: userId,
    role: 'member',
  });
}
```

### Updating Onboarding Progress

```tsx
async function completeOnboardingStep(userId: string, step: number) {
  const { updateUserProfile } = useUserData();
  
  await updateUserProfile(userId, {
    current_step: step,
    is_onboarding_complete: step >= 10,
  });
}
```

### Updating Fitness Preferences

```tsx
async function saveFitnessPreferences(userId: string) {
  const { updateUserProfile } = useUserData();
  
  await updateUserProfile(userId, {
    fitness_goal: 'Build Muscle',
    fitness_level: 'Intermediate',
    workout_location: 'Gym',
    equipment_list: ['Dumbbells', 'Barbell', 'Bench'],
    workout_duration_minutes: 60,
    weekly_frequency: ['Monday', 'Wednesday', 'Friday'],
    target_muscle_groups: ['Chest', 'Back', 'Legs'],
  });
}
```

### Checking User Role

```tsx
function ProtectedComponent() {
  const { userRole } = useUserContext();
  
  if (userRole?.role !== 'admin') {
    return <Text>Access Denied</Text>;
  }
  
  return <AdminPanel />;
}
```

---

## 🔐 Required Supabase Policies

Make sure you have the following RLS policies on your Supabase tables:

### user_profile Table

```sql
-- Allow users to read their own profile
CREATE POLICY "Users can view own profile"
ON user_profile FOR SELECT
USING (auth.uid() = user_id);

-- Allow users to insert their own profile
CREATE POLICY "Users can insert own profile"
ON user_profile FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own profile
CREATE POLICY "Users can update own profile"
ON user_profile FOR UPDATE
USING (auth.uid() = user_id);
```

### user_role Table

```sql
-- Allow users to read their own role
CREATE POLICY "Users can view own role"
ON user_role FOR SELECT
USING (auth.uid() = user_id);

-- Allow users to insert their own role
CREATE POLICY "Users can insert own role"
ON user_role FOR INSERT
WITH CHECK (auth.uid() = user_id);
```

---

## 🧪 Testing

Test each operation:

1. **Create Profile**: Sign up a new user and create their profile
2. **Fetch Profile**: Load user data on app start
3. **Update Profile**: Modify user preferences
4. **Upsert Profile**: Handle both new and existing users
5. **Role Management**: Assign and check user roles

---

## 📚 Additional Resources

- [Usage Guide](./USER_DATA_USAGE.md) - Detailed usage examples
- [Example Component](../components/examples/UserProfileExample.tsx) - Working demo
- [Type Definitions](../types/UserProfile.ts) - Full type reference

---

## 🐛 Troubleshooting

### Profile not loading
- Check if user is authenticated
- Verify RLS policies are set up
- Check console for error messages

### Updates not reflecting
- Ensure `user_id` matches authenticated user
- Check network tab for failed requests
- Verify table structure matches schema

### TypeScript errors
- Ensure all imports are correct
- Check that types match table schema
- Run `npm run type-check`

---

## ✅ Next Steps

1. Set up Supabase RLS policies
2. Wrap your app with `UserProvider`
3. Start using `useUserContext` and `useUserData` in your components
4. Test CRUD operations
5. Implement onboarding flow using profile updates

---

**Created:** November 6, 2025  
**Version:** 1.0.0  
**Status:** ✅ Ready for use

