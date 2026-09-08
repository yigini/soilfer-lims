/**
 * SoilFER LIMS Canonical Locale Resolver & Preference Engine (CommonJS / Server)
 * Supports exact 5 locales: en, es, es-419, fr, pt
 */

const SUPPORTED_LOCALES = ['en', 'es', 'es-419', 'fr', 'pt'];
const CANONICAL_LOCALES = SUPPORTED_LOCALES;
const DEFAULT_LOCALE = 'en';

const LOCALE_METADATA = {
    en: { code: 'en', name: 'English', nativeName: 'English', dir: 'ltr' },
    es: { code: 'es', name: 'Spanish', nativeName: 'Español', dir: 'ltr' },
    'es-419': { code: 'es-419', name: 'Spanish (Latin America)', nativeName: 'Español (Latinoamérica)', dir: 'ltr' },
    fr: { code: 'fr', name: 'French', nativeName: 'Français', dir: 'ltr' },
    pt: { code: 'pt', name: 'Portuguese', nativeName: 'Português', dir: 'ltr' }
};

const LATAM_COUNTRIES = new Set([
    '419', 'AR', 'ARG', 'BO', 'BOL', 'CL', 'CHL', 'CO', 'COL', 'CR', 'CRI',
    'CU', 'CUB', 'DO', 'DOM', 'EC', 'ECU', 'SV', 'SLV', 'GT', 'GTM',
    'HN', 'HND', 'MX', 'MEX', 'NI', 'NIC', 'PA', 'PAN', 'PY', 'PRY',
    'PE', 'PER', 'PR', 'PRI', 'UY', 'URY', 'VE', 'VEN'
]);

function normalizeLocale(tag) {
    if (!tag || typeof tag !== 'string') return DEFAULT_LOCALE;

    const clean = tag.trim().toLowerCase();
    if (SUPPORTED_LOCALES.includes(clean)) return clean;

    if (clean === 'es-419' || clean === 'es_419' || clean === 'es-latinamerica' || clean === 'es-419-latam') {
        return 'es-419';
    }

    const parts = clean.split(/[-_]/);
    const lang = parts[0];
    const region = (parts[1] || '').toUpperCase();

    if (lang === 'es') {
        if (LATAM_COUNTRIES.has(region)) {
            return 'es-419';
        }
        if (region === 'ES') {
            return 'es';
        }
        return 'es-419';
    }

    if (lang === 'pt') return 'pt';
    if (lang === 'fr') return 'fr';
    if (lang === 'en') return 'en';

    return DEFAULT_LOCALE;
}

function parseAcceptLanguage(header) {
    if (!header || typeof header !== 'string') return null;

    const tags = header.split(',').map(part => {
        const [tag, qPart] = part.trim().split(';');
        let q = 1.0;
        if (qPart && qPart.trim().startsWith('q=')) {
            q = parseFloat(qPart.trim().substring(2)) || 0;
        }
        return { tag: tag.trim(), q };
    }).sort((a, b) => b.q - a.q);

    for (const item of tags) {
        const matched = matchSupportedLocale(item.tag);
        if (matched) return matched;
    }
    return DEFAULT_LOCALE;
}

function matchSupportedLocale(tag) {
    if (!tag || typeof tag !== 'string') return null;
    const clean = tag.trim().toLowerCase();
    if (SUPPORTED_LOCALES.includes(clean)) return clean;
    if (clean === 'es-419' || clean === 'es_419' || clean === 'es-latinamerica' || clean === 'es-419-latam') {
        return 'es-419';
    }

    const parts = clean.split(/[-_]/);
    const lang = parts[0];
    const region = (parts[1] || '').toUpperCase();

    if (lang === 'es') {
        if (LATAM_COUNTRIES.has(region)) return 'es-419';
        if (region === 'ES') return 'es';
        return 'es-419';
    }
    if (lang === 'pt') return 'pt';
    if (lang === 'fr') return 'fr';
    if (lang === 'en') return 'en';
    return null;
}

function resolveServerLocale({
    rawInput = null,
    explicitHeader = null,
    sessionOverride = null,
    userPreference = null,
    labDefault = null,
    acceptLanguage = null,
    globalDefault = null,
    fallbackLocale = 'en'
} = {}) {
    if (rawInput) return normalizeLocale(rawInput);
    const header = explicitHeader || sessionOverride;
    if (header) return normalizeLocale(header);
    if (userPreference) return normalizeLocale(userPreference);
    if (labDefault) return normalizeLocale(labDefault);
    if (acceptLanguage) return parseAcceptLanguage(acceptLanguage) || normalizeLocale(fallbackLocale);
    if (globalDefault) return normalizeLocale(globalDefault);
    return normalizeLocale(fallbackLocale);
}

module.exports = {
    matchSupportedLocale,
    SUPPORTED_LOCALES,
    CANONICAL_LOCALES,
    DEFAULT_LOCALE,
    LOCALE_METADATA,
    normalizeLocale,
    canonicalLocale: normalizeLocale,
    parseAcceptLanguage,
    resolveServerLocale,
    resolveLocale: resolveServerLocale
};
