/**
 * Example component to test OpenAI connection
 * 
 * Usage:
 * 1. Make sure you have EXPO_PUBLIC_OPENAI_API_KEY in your .env.local file
 * 2. Import this component in any screen to test the connection
 * 3. The test will run automatically when the component mounts
 */

import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { testOpenAIConnectionFull } from '../utils/test_openai_connection';

export function OpenAITestExample() {
    const [isTesting, setIsTesting] = useState(true);
    const [testResult, setTestResult] = useState<{
        success: boolean;
        message?: string;
    } | null>(null);

    useEffect(() => {
        async function runTest() {
            setIsTesting(true);
            const result = await testOpenAIConnectionFull();
            setTestResult({
                success: result,
                message: result
                    ? 'OpenAI connection successful!'
                    : 'OpenAI connection failed. Check console for details.'
            });
            setIsTesting(false);
        }
        runTest();
    }, []);

    return (
        <View style={styles.container}>
            <Text style={styles.title}>OpenAI Connection Test</Text>
            {isTesting ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#007AFF" />
                    <Text style={styles.loadingText}>Testing connection...</Text>
                </View>
            ) : (
                <View style={styles.resultContainer}>
                    <Text
                        style={[
                            styles.resultText,
                            testResult?.success ? styles.success : styles.error
                        ]}
                    >
                        {testResult?.success ? '✅' : '❌'} {testResult?.message}
                    </Text>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        padding: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 20,
    },
    loadingContainer: {
        alignItems: 'center',
        gap: 10,
    },
    loadingText: {
        fontSize: 16,
        color: '#666',
    },
    resultContainer: {
        padding: 15,
        borderRadius: 8,
        backgroundColor: '#f5f5f5',
    },
    resultText: {
        fontSize: 16,
        textAlign: 'center',
    },
    success: {
        color: '#28a745',
    },
    error: {
        color: '#dc3545',
    },
});

