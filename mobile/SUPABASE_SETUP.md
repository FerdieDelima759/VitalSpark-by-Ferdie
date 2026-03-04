# Supabase Setup Guide for VitalSpark

Complete guide to set up and use Supabase in your VitalSpark mobile app.

## 🚀 Quick Start

### 1. Create a Supabase Project

1. Visit [database.new](https://database.new)
2. Create a new project
3. Wait for the project to be provisioned (~2 minutes)

### 2. Get Your Credentials

1. In your Supabase dashboard, go to **Settings** → **API**
2. Copy the following values:
   - **Project URL** (looks like `https://xxxxx.supabase.co`)
   - **anon public** key (a long JWT token)

### 3. Configure Environment Variables

1. Open the `.env.local` file in the `mobile` directory
2. Update with your actual credentials:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

3. **Never commit** `.env.local` to version control! (It's already in `.gitignore`)

### 4. Restart Your Dev Server

After updating `.env.local`, restart your Expo development server:

```bash
cd mobile
npm start
```

## 📦 What's Already Installed

The following packages have been installed and configured:

- ✅ `@supabase/supabase-js` (v2.57.4) - Supabase client library
- ✅ `expo-sqlite` - Required for localStorage polyfill in React Native
- ✅ `expo-secure-store` - For secure token storage

## 📁 Project Structure

```
mobile/
├── utils/
│   ├── supabase.ts              # Supabase client configuration
│   ├── supabase_example.ts      # Example helper functions
│   └── README.md                # Utils documentation
├── hooks/
│   └── use_supabase_auth.example.ts  # Example auth hook
├── app/
│   └── (auth)/
│       └── login.example.tsx    # Example login screen
├── env.d.ts                     # TypeScript environment types
├── .env.local                   # Your credentials (DO NOT COMMIT)
└── .env.example                 # Template for others
```

## 💻 Usage Examples

### Basic Usage - Import the Client

```typescript
import { supabase } from "@/utils/supabase";

// Now you can use supabase in any component
```

### Example 1: User Authentication

```typescript
// Sign up
const { data, error } = await supabase.auth.signUp({
  email: "user@example.com",
  password: "secure-password",
});

// Sign in
const { data, error } = await supabase.auth.signInWithPassword({
  email: "user@example.com",
  password: "secure-password",
});

// Sign out
await supabase.auth.signOut();
```

### Example 2: Database Queries

```typescript
// Select data
const { data, error } = await supabase.from("users").select("*");

// Insert data
const { data, error } = await supabase
  .from("users")
  .insert({ name: "John Doe", email: "john@example.com" });

// Update data
const { data, error } = await supabase
  .from("users")
  .update({ name: "Jane Doe" })
  .eq("id", userId);

// Delete data
const { data, error } = await supabase.from("users").delete().eq("id", userId);
```

### Example 3: Using the Auth Hook

```typescript
import { useSupabaseAuth } from '@/hooks/use_supabase_auth';

function ProfileScreen() {
  const { user, isLoading, isAuthenticated, signOut } = useSupabaseAuth();

  if (isLoading) return <ActivityIndicator />;
  if (!isAuthenticated) return <SignInPrompt />;

  return (
    <View>
      <Text>Welcome, {user?.email}</Text>
      <Button title="Sign Out" onPress={signOut} />
    </View>
  );
}
```

### Example 4: Realtime Subscriptions

```typescript
// Subscribe to changes on a table
const channel = supabase
  .channel("workouts-changes")
  .on(
    "postgres_changes",
    { event: "*", schema: "public", table: "workouts" },
    (payload) => {
      console.log("Change received!", payload);
    }
  )
  .subscribe();

// Unsubscribe when component unmounts
return () => {
  supabase.removeChannel(channel);
};
```

## 🔒 Security Best Practices

### Row Level Security (RLS)

**Always enable RLS on your tables!** This is crucial for security.

1. Go to your Supabase dashboard
2. Navigate to **Database** → **Tables**
3. For each table, click **Enable RLS**
4. Create policies to control access

Example policy (in SQL Editor):

```sql
-- Allow users to read only their own data
CREATE POLICY "Users can read own data"
ON users
FOR SELECT
USING (auth.uid() = id);

-- Allow users to update only their own data
CREATE POLICY "Users can update own data"
ON users
FOR UPDATE
USING (auth.uid() = id);
```

### Environment Variables

- ✅ **DO** use `EXPO_PUBLIC_` prefix for client-side variables
- ✅ **DO** commit `.env.example` with placeholder values
- ❌ **DON'T** commit `.env.local` with real credentials
- ❌ **DON'T** use `service_role` key in client-side code
- ❌ **DON'T** hardcode credentials in your source files

## 🗄️ Database Setup

### Create Your First Table

1. Go to **Database** → **Tables** in Supabase dashboard
2. Click **Create a new table**
3. Example table structure:

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can read own data"
ON users FOR SELECT
USING (auth.uid() = id);
```

## 🔄 Deep Linking for OAuth

Your `app.json` already has deep linking configured:

```json
"scheme": "vitalspark"
"android": {
  "intentFilters": [
    {
      "action": "VIEW",
      "data": [
        {
          "scheme": "vitalspark",
          "host": "auth"
        }
      ]
    }
  ]
}
```

This allows OAuth providers (Google, Apple, etc.) to redirect back to your app.

## 🧪 Testing Your Setup

Create a simple test file to verify everything works:

```typescript
// test_supabase.ts
import { supabase } from "./utils/supabase";

export async function testSupabaseConnection() {
  try {
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      console.error("❌ Supabase connection failed:", error.message);
      return false;
    }

    console.log("✅ Supabase connected successfully!");
    return true;
  } catch (err) {
    console.error("❌ Error testing Supabase:", err);
    return false;
  }
}
```

## 📚 Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Expo + Supabase Guide](https://docs.expo.dev/guides/using-supabase/)
- [Supabase Auth Docs](https://supabase.com/docs/guides/auth)
- [Supabase Database Docs](https://supabase.com/docs/guides/database)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)

## 🆘 Troubleshooting

### "Missing Supabase environment variables" Error

- Make sure `.env.local` exists and has the correct variables
- Restart your dev server after changing `.env.local`
- Variables must start with `EXPO_PUBLIC_` prefix

### Auth Not Working

- Check that your Supabase project is active
- Verify your API keys are correct
- Enable the auth providers you want to use in Supabase dashboard

### Database Queries Failing

- Ensure Row Level Security policies are set up correctly
- Check that the user is authenticated
- Verify table and column names match your database schema

## 🎯 Next Steps

1. ✅ Configure your `.env.local` with real credentials
2. ✅ Create your database tables in Supabase
3. ✅ Enable RLS and create security policies
4. ✅ Test the connection using the examples provided
5. ✅ Integrate authentication into your app
6. ✅ Start building your features!

---

**Happy coding! 🚀**
