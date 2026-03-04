/**
 * Test utility to verify Supabase connection
 * Run this to ensure your setup is working correctly
 */

import { supabase } from './supabase';

export async function testSupabaseConnection(): Promise<boolean> {
    try {
        console.log('🧪 Testing Supabase connection...');

        // Test 1: Check if client is initialized
        if (!supabase) {
            console.error('❌ Supabase client is not initialized');
            return false;
        }
        console.log('✅ Supabase client initialized');

        // Test 2: Check environment variables
        const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
        const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

        if (!url || url.includes('your-project-url')) {
            console.error('❌ EXPO_PUBLIC_SUPABASE_URL not configured correctly');
            return false;
        }
        console.log('✅ Supabase URL configured');

        if (!key || key.includes('your-anon-key')) {
            console.error('❌ EXPO_PUBLIC_SUPABASE_ANON_KEY not configured correctly');
            return false;
        }
        console.log('✅ Supabase anon key configured');

        // Test 3: Try to get session (should work even if no user is logged in)
        const { data, error } = await supabase.auth.getSession();

        if (error) {
            console.error('❌ Failed to connect to Supabase:', error.message);
            return false;
        }

        console.log('✅ Successfully connected to Supabase!');
        console.log(`   Session exists: ${data.session ? 'Yes' : 'No'}`);

        if (data.session) {
            console.log(`   User: ${data.session.user.email}`);
        }

        return true;
    } catch (err) {
        console.error('❌ Error testing Supabase connection:', err);
        return false;
    }
}

/**
 * Usage in your app:
 * 
 * import { testSupabaseConnection } from '@/utils/test_supabase_connection';
 * 
 * // In your root layout or app entry point
 * useEffect(() => {
 *   testSupabaseConnection();
 * }, []);
 */

