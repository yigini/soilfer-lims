import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import enTranslations from '../translations/en.json';
import frTranslations from '../translations/fr.json';
import esTranslations from '../translations/es.json';
import es419Translations from '../translations/es-419.json';
import ptTranslations from '../translations/pt.json';
import { resolveLocale, CANONICAL_LOCALES, getLocaleMetadata } from '../lib/localeResolver';
import { formatMessage, parseLaboratoryNumber } from '../utils/messageFormatter';

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
    { code: 'es-419', name: 'Español (América Latina)' },
    { code: 'fr', name: 'Français' },
    { code: 'pt', name: 'Português' }
];

const getInitialLocale = () => {
    const sessionOverride = typeof window !== 'undefined' ? sessionStorage.getItem('soilfer_locale_override') : null;
    const storedLocale = typeof window !== 'undefined' ? localStorage.getItem('locale') : null;
    return resolveLocale({
        sessionOverride,
        userPreference: storedLocale,
        acceptLanguage: typeof navigator !== 'undefined' ? navigator.language : null,
        fallbackLocale: 'en'
    });
};

// --- Provider -------------------------------------------------------------
export const LanguageProvider = ({ children }) => {
    const [locale, setLocale] = useState(getInitialLocale);
    const [translations, setTranslations] = useState(DEFAULT_TRANSLATIONS);
    const [loading, setLoading] = useState(true);
    const [availableLanguages, setAvailableLanguages] = useState(DEFAULT_LANG_LIST);

    // Sync html attributes and axios header on locale change
    useEffect(() => {
        if (typeof document !== 'undefined') {
            document.documentElement.lang = locale;
            document.documentElement.dir = 'ltr';
        }
        if (typeof axios !== 'undefined' && axios.defaults) {
            axios.defaults.headers.common['X-App-Locale'] = locale;
        }
    }, [locale]);

    useEffect(() => {
        fetchLanguages();
    }, []);

    const mergeLocale = (code, incoming) => {
        const canonical = resolveLocale({ rawInput: code });
        const base = DEFAULT_TRANSLATIONS[canonical] || DEFAULT_TRANSLATIONS.en;
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
                const hasSessionOverride = typeof window !== 'undefined' && sessionStorage.getItem('soilfer_locale_override');
                const hasStoredLocale = typeof window !== 'undefined' && localStorage.getItem('locale');
                if (!hasSessionOverride && !hasStoredLocale && brandingDefaultLanguage) {
                    const resolvedDefault = resolveLocale({ rawInput: brandingDefaultLanguage });
                    setLocale(resolvedDefault);
                }
            }

            const merged = { ...DEFAULT_TRANSLATIONS };
            Object.entries(payload).forEach(([code, nestedObj]) => {
                const canonical = resolveLocale({ rawInput: code });
                merged[canonical] = mergeLocale(canonical, nestedObj);
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
                    const canonical = resolveLocale({ rawInput: l.code });
                    merged[canonical] = mergeLocale(canonical, l.translations || {});
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

    const changeLanguage = useCallback((lang, options = {}) => {
        const canonical = resolveLocale({ rawInput: lang });
        if (typeof window !== 'undefined') {
            sessionStorage.setItem('soilfer_locale_override', canonical);
            localStorage.setItem('locale', canonical);
        }
        setLocale(canonical);
    }, []);

    const t = useMemo(() => {
        return (key, paramsOrFallback = {}, maybeFallback = null) => {
            let fallback = null;
            let params = {};

            if (typeof paramsOrFallback === 'string') {
                fallback = paramsOrFallback;
                if (typeof maybeFallback === 'object' && maybeFallback !== null) {
                    params = maybeFallback;
                }
            } else if (typeof paramsOrFallback === 'object' && paramsOrFallback !== null) {
                params = paramsOrFallback;
                if (typeof maybeFallback === 'string') {
                    fallback = maybeFallback;
                }
            }

            const current = resolveLocale({ rawInput: locale });
            const localePack = translations[current];
            const fallbackEsPack = current === 'es-419' ? translations['es'] : null;
            const fallbackEnPack = translations['en'];

            let foundVal = localePack?.flat?.[key];
            if ((foundVal === undefined || foundVal === null) && fallbackEsPack) {
                foundVal = fallbackEsPack?.flat?.[key];
            }
            if (foundVal === undefined || foundVal === null) {
                foundVal = fallbackEnPack?.flat?.[key];
            }

            if (foundVal !== undefined && foundVal !== null) {
                return formatMessage(foundVal, params, current);
            }

            if (fallback) {
                return formatMessage(fallback, params, current);
            }

            return key;
        };
    }, [locale, translations]);

    const localeMeta = useMemo(() => getLocaleMetadata(locale), [locale]);

    return (
        <LanguageContext.Provider value={{
            locale,
            t,
            changeLanguage,
            reloadLanguages: fetchLanguages,
            availableLanguages,
            parseNumber: parseLaboratoryNumber,
            localeMeta
        }}>
            {loading ? <div className="h-screen flex items-center justify-center text-sf-muted font-medium">Loading LIMS...</div> : children}
        </LanguageContext.Provider>
    );
};

export const useLanguage = () => useContext(LanguageContext);
