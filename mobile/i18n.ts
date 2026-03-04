// i18n.ts
import i18n from 'i18next';
import { initReactI18next } from '@/node_modules/react-i18next';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Load resources
import en from './locales/en/common.json';
import es from './locales/es/common.json';
import fil from './locales/fil/common.json';

const STORAGE_KEY = 'app.language';

const resources = {
    en: { common: en },
    fil: { common: fil },
    es: { common: es },
};

// Platform-specific storage for language settings
const languageStorage = {
    async getItem(key: string): Promise<string | null> {
        try {
            if (Platform.OS === 'web') {
                if (typeof window !== 'undefined' && window.localStorage) {
                    return window.localStorage.getItem(key);
                }
                return null;
            } else {
                return await AsyncStorage.getItem(key);
            }
        } catch {
            return null;
        }
    },

    async setItem(key: string, value: string): Promise<void> {
        try {
            if (Platform.OS === 'web') {
                if (typeof window !== 'undefined' && window.localStorage) {
                    window.localStorage.setItem(key, value);
                }
            } else {
                await AsyncStorage.setItem(key, value);
            }
        } catch {
            // Ignore storage errors
        }
    }
};

const detectLanguage = async () => {
    try {
        const saved = await languageStorage.getItem(STORAGE_KEY);
        if (saved) return saved as 'en' | 'es' | 'fil';
    } catch { }
    // Requirement: default to English if no language was picked/saved
    return 'en';
};

export async function initI18n() {
    const lng = await detectLanguage();

    await i18n
        .use(initReactI18next)
        .init({
            compatibilityJSON: 'v4',
            lng,
            fallbackLng: 'en',
            resources,
            defaultNS: 'common',
            interpolation: {
                escapeValue: false, // React already escapes
            },
            returnNull: false
        });

    return i18n;
}

export async function setLanguage(lang: 'en' | 'fil' | 'es') {
    await i18n.changeLanguage(lang);
    await languageStorage.setItem(STORAGE_KEY, lang);
}

export default i18n;
