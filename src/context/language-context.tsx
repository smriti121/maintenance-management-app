import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

import { en, TranslationKeys } from '@/locales/en';
import { hi } from '@/locales/hi';

export type LanguageCode = 'en' | 'hi';

const LANGUAGE_STORAGE_KEY = '@fixflow_language_pref';

interface LanguageContextType {
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => Promise<void>;
  t: (keyPath: string, fallback?: string) => string;
  isHindi: boolean;
  translations: TranslationKeys;
}

const translationsMap: Record<LanguageCode, TranslationKeys> = {
  en,
  hi,
};

const LanguageContext = createContext<LanguageContextType>({
  language: 'en',
  setLanguage: async () => {},
  t: (keyPath: string, fallback?: string) => fallback || keyPath,
  isHindi: false,
  translations: en,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<LanguageCode>('en');

  useEffect(() => {
    async function loadSavedLanguage() {
      try {
        const savedLang = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
        if (savedLang === 'en' || savedLang === 'hi') {
          setLanguageState(savedLang);
        }
      } catch (err) {
        console.warn('Failed to load saved language preference:', err);
      }
    }
    loadSavedLanguage();
  }, []);

  const setLanguage = useCallback(async (newLang: LanguageCode) => {
    setLanguageState(newLang);
    try {
      await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, newLang);
    } catch (err) {
      console.warn('Failed to save language preference:', err);
    }
  }, []);

  const currentTranslations = translationsMap[language] || en;

  const t = useCallback(
    (keyPath: string, fallback?: string): string => {
      const keys = keyPath.split('.');
      let result: any = currentTranslations;

      for (const k of keys) {
        if (result && typeof result === 'object' && k in result) {
          result = result[k];
        } else {
          result = undefined;
          break;
        }
      }

      if (typeof result === 'string') {
        return result;
      }

      // Try English fallback if missing in Hindi
      if (language !== 'en') {
        let enResult: any = en;
        for (const k of keys) {
          if (enResult && typeof enResult === 'object' && k in enResult) {
            enResult = enResult[k];
          } else {
            enResult = undefined;
            break;
          }
        }
        if (typeof enResult === 'string') {
          return enResult;
        }
      }

      return fallback !== undefined ? fallback : keyPath;
    },
    [currentTranslations, language]
  );

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        t,
        isHindi: language === 'hi',
        translations: currentTranslations,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
