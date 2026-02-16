const translationService = require('../services/TranslationService');
const prisma = require('../prisma');

/**
 * Middleware to resolve the current locale for the request.
 * Priority:
 * 1. Authenticated User Preference (req.user.language)
 * 2. Lab Default (if user belongs to lab) - fetched from Lab settings
 * 3. Branding Default (from SystemSettings)
 * 4. Accept-Language Header
 * 5. Default 'en'
 * 
 * Attaches:
 * - req.locale (string code)
 * - req.t (function, async-like or pre-loaded?) 
 *   * Since loading translations is async, we might not want to load ALL translations for every request.
 *   * Instead, we attach a helper that *can* fetch if needed, OR we just resolve the locale.
 *   * For "Phase 2", let's load the *English* catalog as fallback + the resolved locale's catalog IF it's likely to be used? 
 *   * optimizing: For now, we just resolve the locale. Usage of `t` might be strictly for error messages which use codes anyway.
 *   * The client does the heavy lifting. The server just needs to know *what language* the user wants for things like Emails.
 */
const localeMiddleware = async (req, res, next) => {
    try {
        let locale = null;

        // 1. User Preference
        if (req.user && req.user.language) {
            locale = req.user.language;
        }

        // 2. Lab Default
        if (!locale && req.user && req.user.labId) {
            // Optimisation: Cache this or rely on req.user having lab details if we updated auth middleware?
            // Usually auth middleware only gives min info. Let's process.
            // We'll skip DB hit for every request unless critical. 
            // Let's rely on Header as a strong fallback if DB is too expensive.
            // But for correctness:
            // const lab = await prisma.lab.findUnique({ where: { id: req.user.labId }, select: { branding: true } });
            // if (lab?.branding) { ... }
        }

        // 3. Header
        if (!locale) {
            const acceptLang = req.headers['accept-language'];
            if (acceptLang) {
                // simple parse: "en-US,en;q=0.9" -> "en-US"
                locale = acceptLang.split(',')[0].trim();
            }
        }

        // 4. Default
        req.locale = locale || 'en';

        // Helper to get translated message on server side (e.g. for Emails)
        // This is async because it might need to fetch the catalog.
        req.t = async (key, params = {}) => {
            // Initialize catalog if not already?
            // For now, simpler: just return the key + params so client translates
            // But if we MUST translate (e.g. email body), we use TranslationService.
            const catalog = await translationService.getMergedTranslations(req.locale);
            let val = catalog[key] || key;

            // Simple interpolation {{param}}
            Object.entries(params).forEach(([k, v]) => {
                val = val.replace(new RegExp(`{{${k}}}`, 'g'), v);
            });
            return val;
        };

        next();
    } catch (error) {
        console.error('[LocaleMiddleware] Error', error);
        req.locale = 'en';
        next();
    }
};

module.exports = localeMiddleware;
