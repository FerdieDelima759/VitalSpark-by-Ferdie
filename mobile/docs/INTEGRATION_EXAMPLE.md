# Integration Example - Adding UserProvider to Your App

This guide shows how to integrate the `UserProvider` into your existing VitalSpark app.

## Step 1: Update Root Layout

Wrap your root layout with the `UserProvider`:

**File:** `VitalSpark/app/_layout.tsx`

```tsx
import { Stack } from "expo-router";
import { UserProvider } from "../contexts/UserContext";

export default function RootLayout() {
  return (
    <UserProvider>
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="(auth)" />
      </Stack>
    </UserProvider>
  );
}
```

## Step 2: Use in Your Screens

### Example: Profile Screen

```tsx
// VitalSpark/app/profile.tsx
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useUserContext } from '../contexts/UserContext';
import { useUserData } from '../hooks/useUserData';

export default function ProfileScreen() {
  const { userProfile, loadingState } = useUserContext();
  const { updateUserProfile } = useUserData();

  if (loadingState.isLoading) {
    return (
      <View>
        <Text>Loading...</Text>
      </View>
    );
  }

  if (!userProfile) {
    return (
      <View>
        <Text>No profile found</Text>
      </View>
    );
  }

  return (
    <View style={{ padding: 20 }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold' }}>
        {userProfile.full_name || 'User Profile'}
      </Text>
      <Text>Nickname: {userProfile.nickname}</Text>
      <Text>Goal: {userProfile.fitness_goal}</Text>
      <Text>Level: {userProfile.fitness_level}</Text>
    </View>
  );
}
```

### Example: Onboarding Screen

```tsx
// VitalSpark/app/(auth)/onboarding.tsx
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useUserContext } from '../../contexts/UserContext';
import { useUserData } from '../../hooks/useUserData';
import { auth } from '../../hooks/useAuth';

export default function OnboardingScreen() {
  const router = useRouter();
  const { userProfile } = useUserContext();
  const { upsertUserProfile } = useUserData();
  
  const [fullName, setFullName] = useState('');
  const [fitnessGoal, setFitnessGoal] = useState('');

  const handleComplete = async () => {
    const { data: user } = await auth.getCurrentUser();
    if (!user) return;

    const result = await upsertUserProfile({
      user_id: user.id,
      full_name: fullName,
      fitness_goal: fitnessGoal,
      current_step: (userProfile?.current_step || 0) + 1,
      is_onboarding_complete: false,
    });

    if (result.success) {
      router.push('/next-step');
    }
  };

  return (
    <View style={{ padding: 20 }}>
      <Text style={{ fontSize: 24, marginBottom: 20 }}>Tell us about yourself</Text>
      
      <TextInput
        placeholder="Full Name"
        value={fullName}
        onChangeText={setFullName}
        style={{ borderWidth: 1, padding: 10, marginBottom: 15 }}
      />
      
      <TextInput
        placeholder="Fitness Goal"
        value={fitnessGoal}
        onChangeText={setFitnessGoal}
        style={{ borderWidth: 1, padding: 10, marginBottom: 15 }}
      />
      
      <TouchableOpacity
        onPress={handleComplete}
        style={{ backgroundColor: '#007AFF', padding: 15, borderRadius: 8 }}
      >
        <Text style={{ color: 'white', textAlign: 'center' }}>Continue</Text>
      </TouchableOpacity>
    </View>
  );
}
```

### Example: Settings Screen

```tsx
// VitalSpark/app/settings.tsx
import React from 'react';
import { View, Text, Switch } from 'react-native';
import { useUserContext } from '../contexts/UserContext';
import { useUserData } from '../hooks/useUserData';

export default function SettingsScreen() {
  const { userProfile } = useUserContext();
  const { updateUserProfile } = useUserData();

  const toggleBiometrics = async (value: boolean) => {
    if (!userProfile) return;

    await updateUserProfile(userProfile.user_id, {
      biometrics_enabled: value,
    });
  };

  if (!userProfile) {
    return <Text>Loading...</Text>;
  }

  return (
    <View style={{ padding: 20 }}>
      <Text style={{ fontSize: 24, marginBottom: 20 }}>Settings</Text>
      
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 }}>
        <Text>Biometric Authentication</Text>
        <Switch
          value={userProfile.biometrics_enabled || false}
          onValueChange={toggleBiometrics}
        />
      </View>

      <Text>Language: {userProfile.preferred_language || 'English'}</Text>
      <Text>Plan: {userProfile.plan_code || 'free'}</Text>
    </View>
  );
}
```

## Step 3: Initialize Profile After Signup

Update your signup flow to create a user profile:

```tsx
// In your signup screen
import { auth } from '../hooks/useAuth';
import { useUserData } from '../hooks/useUserData';

const handleSignup = async (email: string, password: string, fullName: string) => {
  // Sign up the user
  const signupResult = await auth.signUp({
    email,
    password,
    fullName,
  });

  if (!signupResult.success || !signupResult.data?.user) {
    return;
  }

  // Create user profile
  const { createUserProfile, createUserRole } = useUserData();
  
  await createUserProfile({
    user_id: signupResult.data.user.id,
    full_name: fullName,
    current_step: 1,
    is_onboarding_complete: false,
    plan_code: 'free',
  });

  await createUserRole({
    user_id: signupResult.data.user.id,
    role: 'member',
  });

  // Navigate to onboarding
  router.push('/onboarding');
};
```

## Step 4: Protect Routes Based on Profile

```tsx
// VitalSpark/app/index.tsx
import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useUserContext } from '../contexts/UserContext';
import { auth } from '../hooks/useAuth';

export default function IndexScreen() {
  const router = useRouter();
  const { userProfile, loadingState } = useUserContext();

  useEffect(() => {
    async function checkAuth() {
      const { data: user } = await auth.getCurrentUser();
      
      if (!user) {
        router.replace('/(auth)/login');
        return;
      }

      if (!userProfile) {
        router.replace('/(auth)/onboarding');
        return;
      }

      if (!userProfile.is_onboarding_complete) {
        router.replace('/(auth)/onboarding');
        return;
      }

      router.replace('/home');
    }

    if (!loadingState.isLoading) {
      checkAuth();
    }
  }, [loadingState.isLoading, userProfile]);

  return null; // or a loading screen
}
```

## Step 5: Role-Based Access Control

```tsx
// VitalSpark/components/AdminOnly.tsx
import React from 'react';
import { View, Text } from 'react-native';
import { useUserContext } from '../contexts/UserContext';

interface AdminOnlyProps {
  children: React.ReactNode;
}

export function AdminOnly({ children }: AdminOnlyProps) {
  const { userRole } = useUserContext();

  if (!userRole || userRole.role !== 'admin') {
    return (
      <View>
        <Text>Access Denied: Admin Only</Text>
      </View>
    );
  }

  return <>{children}</>;
}

// Usage:
// <AdminOnly>
//   <AdminPanel />
// </AdminOnly>
```

## Common Patterns

### Check if user has completed onboarding

```tsx
const { userProfile } = useUserContext();
const hasCompletedOnboarding = userProfile?.is_onboarding_complete || false;
```

### Update user preferences

```tsx
const { updateUserProfile } = useUserData();

const savePreferences = async (userId: string) => {
  await updateUserProfile(userId, {
    preferred_language: 'es',
    fitness_goal: 'Lose Weight',
    workout_location: 'Home',
  });
};
```

### Get current user data

```tsx
const { userProfile, userRole, loadingState } = useUserContext();

// userProfile contains all profile data
// userRole contains role information
// loadingState tells you loading status
```

## Testing Your Integration

1. Sign up a new user
2. Verify profile is created in Supabase
3. Update profile fields
4. Check that context updates automatically
5. Test onboarding flow
6. Verify role-based access control

## Troubleshooting

**Issue:** Profile not loading after login
- **Solution:** Make sure UserProvider wraps your entire app

**Issue:** Updates not reflecting immediately
- **Solution:** The hook automatically calls `refreshUserData()` after mutations

**Issue:** TypeScript errors
- **Solution:** Make sure you import types from `types/UserProfile`

---

✅ Your user data management system is now fully integrated!

