import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import enTranslations from '../translations/en.json';
import frTranslations from '../translations/fr.json';
import esTranslations from '../translations/es.json';
import ptTranslations from '../translations/pt.json';

const LanguageContext = createContext();

// Default translations (fallback if backend fails)
const DEFAULT_TRANSLATIONS = {
    en: enTranslations,
    fr: frTranslations,
    es: esTranslations,
    pt: ptTranslations
};

export const LanguageProvider = ({ children }) => {
    const [locale, setLocale] = useState(localStorage.getItem('locale') || 'en');
    const [translations, setTranslations] = useState(DEFAULT_TRANSLATIONS);
    const [loading, setLoading] = useState(true);
    const [availableLanguages, setAvailableLanguages] = useState([
        { code: 'en', name: 'English' },
        { code: 'es', name: 'Español' },
        { code: 'fr', name: 'Français' },
        { code: 'pt', name: 'Português' }
    ]);

    useEffect(() => {
        fetchLanguages();
    }, []);

    // Save locale preference
    useEffect(() => {
        localStorage.setItem('locale', locale);
    }, [locale]);

    const fetchLanguages = async () => {
        try {
            const res = await axios.get('/api/admin/languages');
            // Build available languages list from DB
            if (res.data && res.data.length > 0) {
                setAvailableLanguages(res.data.map(l => ({ code: l.code, name: l.name, isDefault: l.isDefault })));
            }
            // Transform array to object { en: {...}, es: {...} }
            const langMap = {};
            res.data.forEach(l => {
                langMap[l.code] = { ...DEFAULT_TRANSLATIONS[l.code], ...(l.translations || {}) };
            });
            // Merge with defaults to ensure all keys exist
            setTranslations({ ...DEFAULT_TRANSLATIONS, ...langMap });
        } catch (e) {
            if (e.response?.status !== 401) {
                console.warn("Could not load languages from backend, using defaults", e.message);
            }
            // Keep using DEFAULT_TRANSLATIONS and default availableLanguages
        } finally {
            setLoading(false);
        }
    };

    const t = (key) => {
        if (!translations[locale]) return key;

        // Support nested keys like "admin.title"
        const keys = key.split('.');
        let value = translations[locale];

        for (const k of keys) {
            if (value && typeof value === 'object') {
                value = value[k];
            } else {
                return key; // Key not found, return original
            }
        }

        return value || key;
    };

    const changeLanguage = (lang) => {
        setLocale(lang);
    };

    return (
        <LanguageContext.Provider value={{ locale, t, changeLanguage, reloadLanguages: fetchLanguages, availableLanguages }}>
            {loading ? <div className="h-screen flex items-center justify-center">Loading LIMS...</div> : children}
        </LanguageContext.Provider>
    );
};

export const useLanguage = () => useContext(LanguageContext);
