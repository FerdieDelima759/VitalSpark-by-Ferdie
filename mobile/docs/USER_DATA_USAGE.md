# User Data Management - Usage Guide

This guide explains how to use the `useUserData` hook and `UserContext` to manage user profiles and roles in VitalSpark.

## Table of Contents

1. [Setup](#setup)
2. [UserContext](#usercontext)
3. [useUserData Hook](#useuserdata-hook)
4. [Examples](#examples)
5. [API Reference](#api-reference)

---

## Setup

### 1. Wrap Your App with UserProvider

First, wrap your app with the `UserProvider` in your root layout:

```tsx
// app/_layout.tsx
import { UserProvider } from '../contexts/UserContext';

export default function RootLayout() {
  return (
    <UserProvider>
      {/* Your app components */}
    </UserProvider>
  );
}
```

### 2. Import Required Types and Hooks

```tsx
import { useUserData } from '../hooks/useUserData';
import { useUserContext } from '../contexts/UserContext';
import { UserProfile, ProfileUpdatePayload } from '../types/UserProfile';
```

---

## UserContext

The `UserContext` provides global access to user data throughout your app.

### Available Properties

```tsx
const {
  userProfile,           // UserProfile | null
  userRole,              // UserRole | null
  loadingState,          // ProfileLoadingState
  setUserProfile,        // Function to update profile in context
  setUserRole,           // Function to update role in context
  refreshUserData,       // Function to refresh data from database
  clearUserData,         // Function to clear all user data
} = useUserContext();
```

### Example Usage

```tsx
import { useUserContext } from '../contexts/UserContext';

function ProfileScreen() {
  const { userProfile, loadingState } = useUserContext();

  if (loadingState.isLoading) {
    return <Text>Loading...</Text>;
  }

  if (!userProfile) {
    return <Text>No profile found</Text>;
  }

  return (
    <View>
      <Text>Name: {userProfile.full_name}</Text>
      <Text>Email: {userProfile.nickname}</Text>
    </View>
  );
}
```

---

## useUserData Hook

The `useUserData` hook provides functions for CRUD operations on user profiles and roles.

### Available Methods

#### Profile Operations
- `fetchUserProfile(userId: string)`
- `createUserProfile(profile: UserProfile)`
- `updateUserProfile(userId: string, updates: ProfileUpdatePayload)`
- `upsertUserProfile(profile: UserProfile)`
- `deleteUserProfile(userId: string)`

#### Role Operations
- `fetchUserRole(userId: string)`
- `createUserRole(role: UserRole)`
- `updateUserRole(userId: string, role: string)`
- `upsertUserRole(role: UserRole)`

---

## Examples

### Example 1: Create a New User Profile

```tsx
import { useUserData } from '../hooks/useUserData';
import { auth } from '../hooks/useAuth';

async function createProfile() {
  const { createUserProfile } = useUserData();
  const { data } = await auth.getCurrentUser();

  if (!data) return;

  const result = await createUserProfile({
    user_id: data.id,
    full_name: 'John Doe',
    nickname: 'johndoe',
    age_range: '25-34',
    gender: 'male',
    current_step: 1,
    is_onboarding_complete: false,
    plan_code: 'free',
  });

  if (result.success) {
    console.log('Profile created:', result.data);
  } else {
    console.error('Error:', result.error);
  }
}
```

### Example 2: Update User Profile

```tsx
import { useUserData } from '../hooks/useUserData';
import { useUserContext } from '../contexts/UserContext';

function UpdateProfileButton() {
  const { updateUserProfile, isLoading } = useUserData();
  const { userProfile } = useUserContext();

  const handleUpdate = async () => {
    if (!userProfile) return;

    const result = await updateUserProfile(userProfile.user_id, {
      fitness_goal: 'Build Muscle',
      fitness_level: 'Intermediate',
      workout_location: 'Gym',
    });

    if (result.success) {
      console.log('Profile updated successfully');
    }
  };

  return (
    <TouchableOpacity onPress={handleUpdate} disabled={isLoading}>
      <Text>{isLoading ? 'Updating...' : 'Update Profile'}</Text>
    </TouchableOpacity>
  );
}
```

### Example 3: Upsert User Profile (Create or Update)

```tsx
import { useUserData } from '../hooks/useUserData';

async function saveProfile(userId: string, profileData: Partial<UserProfile>) {
  const { upsertUserProfile } = useUserData();

  const result = await upsertUserProfile({
    user_id: userId,
    ...profileData,
  });

  if (result.success) {
    console.log('Profile saved:', result.data);
  } else {
    console.error('Error saving profile:', result.error);
  }
}
```

### Example 4: Manage User Role

```tsx
import { useUserData } from '../hooks/useUserData';

async function updateUserToAdmin(userId: string) {
  const { upsertUserRole } = useUserData();

  const result = await upsertUserRole({
    user_id: userId,
    role: 'admin',
  });

  if (result.success) {
    console.log('Role updated to admin');
  }
}
```

### Example 5: Complete Onboarding Flow

```tsx
import { useUserData } from '../hooks/useUserData';
import { useUserContext } from '../contexts/UserContext';

function OnboardingScreen() {
  const { updateUserProfile, isLoading } = useUserData();
  const { userProfile } = useUserContext();

  const completeOnboarding = async () => {
    if (!userProfile) return;

    const result = await updateUserProfile(userProfile.user_id, {
      current_step: 10,
      is_onboarding_complete: true,
    });

    if (result.success) {
      // Navigate to main app
      console.log('Onboarding completed!');
    }
  };

  return (
    <TouchableOpacity onPress={completeOnboarding} disabled={isLoading}>
      <Text>{isLoading ? 'Completing...' : 'Complete Onboarding'}</Text>
    </TouchableOpacity>
  );
}
```

### Example 6: Update Multiple Profile Sections

```tsx
import { useUserData } from '../hooks/useUserData';
import { FitnessPreferencesUpdate } from '../types/UserProfile';

async function updateFitnessPreferences(
  userId: string,
  preferences: FitnessPreferencesUpdate
) {
  const { updateUserProfile } = useUserData();

  const result = await updateUserProfile(userId, {
    fitness_goal: preferences.fitness_goal,
    fitness_level: preferences.fitness_level,
    workout_location: preferences.workout_location,
    equipment_list: preferences.equipment_list,
    workout_duration_minutes: preferences.workout_duration_minutes,
    weekly_frequency: preferences.weekly_frequency,
    target_muscle_groups: preferences.target_muscle_groups,
  });

  return result;
}
```

### Example 7: Fetch and Display Profile

```tsx
import { useEffect, useState } from 'react';
import { useUserData } from '../hooks/useUserData';
import { UserProfile } from '../types/UserProfile';

function UserProfileDisplay({ userId }: { userId: string }) {
  const { fetchUserProfile, isLoading, error } = useUserData();
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    async function loadProfile() {
      const result = await fetchUserProfile(userId);
      if (result.success && result.data) {
        setProfile(result.data);
      }
    }
    loadProfile();
  }, [userId]);

  if (isLoading) return <Text>Loading...</Text>;
  if (error) return <Text>Error: {error}</Text>;
  if (!profile) return <Text>No profile found</Text>;

  return (
    <View>
      <Text>Name: {profile.full_name}</Text>
      <Text>Goal: {profile.fitness_goal}</Text>
      <Text>Level: {profile.fitness_level}</Text>
    </View>
  );
}
```

---

## API Reference

### ProfileUpdateResponse

```typescript
interface ProfileUpdateResponse {
  success: boolean;
  error: string | null;
  data?: UserProfile;
}
```

### ProfileLoadingState

```typescript
interface ProfileLoadingState {
  isLoading: boolean;
  isUpdating: boolean;
  isSaving: boolean;
  error: string | null;
}
```

### UserProfile Fields

All fields in `UserProfile` are optional except `user_id`:

- **Core**: `id`, `created_at`, `user_id`, `updated_at`
- **Personal**: `current_mood`, `full_name`, `nickname`, `age_range`, `gender`
- **Onboarding**: `current_step`, `is_onboarding_complete`
- **Physical**: `height`, `weight`, `height_unit`, `weight_unit`
- **Location**: `country`, `region_province`
- **Fitness**: `fitness_goal`, `fitness_level`, `workout_location`, `equipment_list`, etc.
- **Nutrition**: `dietary_preference`, `meal_plan_duration`
- **Health**: `health_conditions`
- **Financial**: `weekly_budget`, `weekly_budget_currency`
- **Subscription**: `plan_code`

---

## Best Practices

1. **Always check for success**: Check the `success` property before accessing `data`
2. **Handle errors**: Display user-friendly error messages
3. **Use loading states**: Show loading indicators during operations
4. **Validate data**: Validate user input before sending to database
5. **Use TypeScript types**: Leverage the provided types for type safety
6. **Context for reading**: Use `useUserContext` for reading current user data
7. **Hook for mutations**: Use `useUserData` for create/update/delete operations
8. **Refresh after updates**: The hook automatically refreshes context after mutations

---

## Notes

- All profile operations automatically update the `UserContext` on success
- The `upsert` operations will create a new record if it doesn't exist, or update if it does
- Array fields like `equipment_list`, `weekly_frequency`, etc., should be passed as arrays of strings
- Timestamps (`created_at`, `updated_at`) are automatically managed
- The `user_id` should match the authenticated user's ID from Supabase Auth

