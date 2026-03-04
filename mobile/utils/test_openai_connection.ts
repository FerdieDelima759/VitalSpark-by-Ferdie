/**
 * Test utility to verify OpenAI connection
 * Run this to ensure your setup is working correctly
 */

import { openai, isOpenAIAvailable, testOpenAIConnection } from '../lib/openai';

export async function testOpenAIConnectionFull(): Promise<boolean> {
    try {
        console.log('🧪 Testing OpenAI connection...');

        // Test 1: Check if client is initialized
        if (!openai) {
            console.error('❌ OpenAI client is not initialized');
            console.error('   Please set EXPO_PUBLIC_OPENAI_API_KEY in your .env.local file');
            return false;
        }
        console.log('✅ OpenAI client initialized');

        // Test 2: Check environment variable
        const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;

        if (!apiKey || apiKey.trim() === '') {
            console.error('❌ EXPO_PUBLIC_OPENAI_API_KEY not configured');
            console.error('   Please add EXPO_PUBLIC_OPENAI_API_KEY=your-api-key to .env.local');
            return false;
        }

        if (apiKey.includes('your-api-key') || apiKey.includes('sk-') === false) {
            console.warn('⚠️  EXPO_PUBLIC_OPENAI_API_KEY may not be configured correctly');
            console.warn('   Expected format: sk-...');
        }
        console.log('✅ OpenAI API key configured');

        // Test 3: Check if service is available
        console.log('🔄 Checking OpenAI service availability...');
        const isAvailable = await isOpenAIAvailable();

        if (!isAvailable) {
            console.error('❌ OpenAI service is not available');
            return false;
        }
        console.log('✅ OpenAI service is available');

        // Test 4: Test actual API call
        console.log('🔄 Testing OpenAI API call...');
        const testResult = await testOpenAIConnection();

        if (!testResult.success) {
            console.error('❌ OpenAI API test failed:', testResult.error);
            return false;
        }

        console.log('✅ Successfully connected to OpenAI!');
        console.log(`   Test response: "${testResult.message}"`);

        return true;
    } catch (err: any) {
        console.error('❌ Error testing OpenAI connection:', err?.message || err);
        return false;
    }
}

/**
 * Usage in your app:
 * 
 * import { testOpenAIConnectionFull } from '@/utils/test_openai_connection';
 * 
 * // In your root layout or app entry point
 * useEffect(() => {
 *   testOpenAIConnectionFull();
 * }, []);
 */

