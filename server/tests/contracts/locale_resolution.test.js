const {
    normalizeLocale,
    parseAcceptLanguage,
    resolveServerLocale,
    SUPPORTED_LOCALES
} = require('../../utils/localeResolver');

describe('Canonical 5-Locale Resolution Contract (Finding L09, L11)', () => {
    test('1. Exact 5 locales are supported', () => {
        expect(SUPPORTED_LOCALES).toEqual(['en', 'es', 'es-419', 'fr', 'pt']);
    });

    test('2. Latin American Spanish regions correctly normalize to es-419', () => {
        expect(normalizeLocale('es-GT')).toBe('es-419'); // Guatemala
        expect(normalizeLocale('es-HN')).toBe('es-419'); // Honduras
        expect(normalizeLocale('es-MX')).toBe('es-419'); // Mexico
        expect(normalizeLocale('es-CO')).toBe('es-419'); // Colombia
        expect(normalizeLocale('es-PE')).toBe('es-419'); // Peru
        expect(normalizeLocale('es-419')).toBe('es-419');
        expect(normalizeLocale('es_419')).toBe('es-419');
    });

    test('3. European Spanish normalizes to es', () => {
        expect(normalizeLocale('es-ES')).toBe('es');
        expect(normalizeLocale('es')).toBe('es');
    });

    test('4. Portuguese regions normalize to pt', () => {
        expect(normalizeLocale('pt-MZ')).toBe('pt'); // Mozambique
        expect(normalizeLocale('pt-BR')).toBe('pt'); // Brazil
        expect(normalizeLocale('pt-PT')).toBe('pt'); // Portugal
        expect(normalizeLocale('pt')).toBe('pt');
    });

    test('5. French regions normalize to fr', () => {
        expect(normalizeLocale('fr-FR')).toBe('fr');
        expect(normalizeLocale('fr-SN')).toBe('fr'); // Senegal
        expect(normalizeLocale('fr-CA')).toBe('fr');
        expect(normalizeLocale('fr')).toBe('fr');
    });

    test('6. English regions normalize to en', () => {
        expect(normalizeLocale('en-US')).toBe('en');
        expect(normalizeLocale('en-GB')).toBe('en');
        expect(normalizeLocale('en-KE')).toBe('en'); // Kenya
        expect(normalizeLocale('en-ZM')).toBe('en'); // Zambia
        expect(normalizeLocale('en')).toBe('en');
    });

    test('7. Unknown, empty, or malformed tags safely fall back to en without crashing or path injection', () => {
        expect(normalizeLocale(null)).toBe('en');
        expect(normalizeLocale('')).toBe('en');
        expect(normalizeLocale('de-DE')).toBe('en');
        expect(normalizeLocale('../../../etc/passwd')).toBe('en');
        expect(normalizeLocale('unknown-region')).toBe('en');
    });

    test('8. Accept-Language header parses quality weights deterministically', () => {
        const header = 'es-GT,es;q=0.8,en;q=0.5';
        expect(parseAcceptLanguage(header)).toBe('es-419');

        const header2 = 'fr-FR,fr;q=0.9,en;q=0.8';
        expect(parseAcceptLanguage(header2)).toBe('fr');

        const header3 = 'de,it;q=0.9,pt-MZ;q=0.8';
        expect(parseAcceptLanguage(header3)).toBe('pt');
    });

    test('9. Server resolution hierarchy enforces explicit header > user preference > lab default > accept-language > global default', () => {
        // Explicit header beats user preference
        expect(resolveServerLocale({
            explicitHeader: 'fr',
            userPreference: 'es',
            labDefault: 'en'
        })).toBe('fr');

        // User preference beats lab default
        expect(resolveServerLocale({
            explicitHeader: null,
            userPreference: 'pt',
            labDefault: 'en',
            acceptLanguage: 'es-GT'
        })).toBe('pt');

        // Lab default beats accept-language
        expect(resolveServerLocale({
            explicitHeader: null,
            userPreference: null,
            labDefault: 'es-419',
            acceptLanguage: 'en-US'
        })).toBe('es-419');

        // Accept-language beats global default
        expect(resolveServerLocale({
            explicitHeader: null,
            userPreference: null,
            labDefault: null,
            acceptLanguage: 'pt-BR,pt;q=0.9',
            globalDefault: 'en'
        })).toBe('pt');

        // Global default beats hardcoded fallback
        expect(resolveServerLocale({
            explicitHeader: null,
            userPreference: null,
            labDefault: null,
            acceptLanguage: null,
            globalDefault: 'es-419'
        })).toBe('es-419');
    });
});
