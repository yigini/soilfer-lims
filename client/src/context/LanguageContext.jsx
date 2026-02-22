import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import enTranslations from '../translations/en.json';
import frTranslations from '../translations/fr.json';
import esTranslations from '../translations/es.json';
import es419Translations from '../translations/es-419.json';
import ptTranslations from '../translations/pt.json';

const LanguageContext = createContext();

// --- Helpers ---------------------------------------------------------------
const flattenObject = (obj, prefix = '', out = {}) => {
    Object.entries(obj || {}).forEach(([k, v]) => {
        const key = prefix ? `${prefix}.${k}` : k;
        if (v && typeof v === 'object' && !Array.isArray(v)) {
            flattenObject(v, key, out);
        } else {
            out[key] = v;
        }
    });
    return out;
};

const buildLocale = (nested) => ({
    nested,
    flat: flattenObject(nested)
});

const DEFAULT_TRANSLATIONS = {
    en: buildLocale(enTranslations),
    fr: buildLocale(frTranslations),
    es: buildLocale(esTranslations),
    'es-419': buildLocale(es419Translations),
    pt: buildLocale(ptTranslations)
};

const DEFAULT_LANG_LIST = [
    { code: 'en', name: 'English' },
    { code: 'es', name: 'Español' },
    { code: 'es-419', name: 'Español (Latinoamérica)' },
    { code: 'fr', name: 'Français' },
    { code: 'pt', name: 'Português' }
];

const normalizeLocale = (code) => {
    if (!code) return 'en';
    const lower = code.toLowerCase();
    if (DEFAULT_TRANSLATIONS[lower]) return lower;
    const short = lower.split('-')[0];
    return DEFAULT_TRANSLATIONS[short] ? short : 'en';
};

const applyParams = (value, params = {}) => {
    if (typeof value !== 'string') return value;
    return value.replace(/{{\s*(\w+)\s*}}/g, (_, key) =>
        params[key] !== undefined && params[key] !== null ? String(params[key]) : ''
    );
};

// --- Provider -------------------------------------------------------------
export const LanguageProvider = ({ children }) => {
    const [locale, setLocale] = useState(normalizeLocale(localStorage.getItem('locale') || 'en'));
    const [translations, setTranslations] = useState(DEFAULT_TRANSLATIONS);
    const [loading, setLoading] = useState(true);
    const [availableLanguages, setAvailableLanguages] = useState(DEFAULT_LANG_LIST);

    useEffect(() => {
        fetchLanguages();
    }, []);

    useEffect(() => {
        localStorage.setItem('locale', locale);
    }, [locale]);

    const mergeLocale = (code, incoming) => {
        const base = DEFAULT_TRANSLATIONS[code] || DEFAULT_TRANSLATIONS[normalizeLocale(code)] || DEFAULT_TRANSLATIONS.en;
        const incomingFlat = buildLocale(incoming || {}).flat;
        return {
            nested: base.nested,
            flat: { ...base.flat, ...incomingFlat }
        };
    };

    const fetchLanguages = async () => {
        try {
            // Public bootstrap for pre-auth screens
            const res = await axios.get('/api/public/i18n/bootstrap');
            const { languages = [], translations: payload = {}, brandingDefaultLanguage } = res.data || {};

            if (languages.length > 0) {
                setAvailableLanguages(languages);
                const defaultFromBranding = normalizeLocale(brandingDefaultLanguage);
                if (!localStorage.getItem('locale')) {
                    setLocale(defaultFromBranding);
                }
            }

            const merged = { ...DEFAULT_TRANSLATIONS };
            Object.entries(payload).forEach(([code, nestedObj]) => {
                merged[code] = mergeLocale(code, nestedObj);
            });
            setTranslations(merged);
        } catch (e) {
            // Fallback to admin endpoint when authenticated (post-login refresh)
            try {
                const adminRes = await axios.get('/api/admin/languages');
                const merged = { ...DEFAULT_TRANSLATIONS };
                const langList = adminRes.data?.data || adminRes.data || [];
                if (langList.length > 0) {
                    setAvailableLanguages(langList.map(l => ({ code: l.code, name: l.name, isDefault: l.isDefault })));
                }
                langList.forEach(l => {
                    merged[l.code] = mergeLocale(l.code, l.translations || {});
                });
                setTranslations(merged);
            } catch (inner) {
                if (inner.response?.status !== 401) {
                    console.warn('Could not load languages from backend, using defaults', inner.message);
                }
            }
        } finally {
            setLoading(false);
        }
    };

    const t = useMemo(() => {
        return (key, paramsOrFallback = {}) => {
            // Support t('key', 'Fallback String') as well as t('key', { param: 'value' })
            const fallback = typeof paramsOrFallback === 'string' ? paramsOrFallback : null;
            const params = typeof paramsOrFallback === 'object' ? paramsOrFallback : {};

            const normalized = normalizeLocale(locale);
            const localePack = translations[normalized];
            const fallbackPack = translations.en;
            if (!localePack) return fallback || key;

            const value =
                localePack.flat[key] ??
                fallbackPack.flat[key] ??
                fallback ??
                key;

            return applyParams(value, params) || fallback || key;
        };
    }, [locale, translations]);

    const changeLanguage = (lang) => {
        setLocale(normalizeLocale(lang));
    };

    return (
        <LanguageContext.Provider value={{ locale, t, changeLanguage, reloadLanguages: fetchLanguages, availableLanguages }}>
            {loading ? <div className="h-screen flex items-center justify-center">Loading LIMS...</div> : children}
        </LanguageContext.Provider>
    );
};

export const useLanguage = () => useContext(LanguageContext);
