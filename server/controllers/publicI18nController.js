const prisma = require('../prisma');
const translationService = require('../services/TranslationService');

const DEFAULT_LANGUAGES = [
    { code: 'en', name: 'English', isDefault: true },
    { code: 'es', name: 'Español', isDefault: false },
    { code: 'es-419', name: 'Español (Latinoamérica)', isDefault: false },
    { code: 'fr', name: 'Français', isDefault: false },
    { code: 'pt', name: 'Português', isDefault: false }
];

exports.bootstrap = async (_req, res) => {
    try {
        const languagesFromDb = await prisma.language.findMany();

        // If DB is empty, maybe seed? For now use defaults (but mapped to DB shape)
        const languages = languagesFromDb.length > 0 ? languagesFromDb : DEFAULT_LANGUAGES;

        // Branding default language (if configured)
        let brandingDefaultLanguage = 'en';
        try {
            const settings = await prisma.systemSetting.findUnique({ where: { id: 'global' } });
            if (settings?.branding) {
                const branding = typeof settings.branding === 'string' ? JSON.parse(settings.branding) : settings.branding;
                brandingDefaultLanguage = branding?.defaultLanguage || brandingDefaultLanguage;
            }
        } catch {
            // ignore
        }

        const translations = {};

        // Fetch merged translations for each active language
        // This is a bit heavy if many languages, but bootstrap is cached/run once per load usually.
        // Parallelize
        await Promise.all(languages.map(async (l) => {
            translations[l.code] = await translationService.getMergedTranslations(l.code);
        }));

        res.json({
            brandingDefaultLanguage,
            languages: languages.map(l => ({
                code: l.code,
                name: l.name,
                isDefault: l.isDefault,
                isActive: l.isActive !== false
            })),
            translations // Structure: { en: { key: val, ... }, es: { ... } }
        });
    } catch (e) {
        console.error('[i18n.bootstrap] Failed:', e);
        res.status(500).json({ error: 'Failed to load i18n bootstrap' });
    }
};
