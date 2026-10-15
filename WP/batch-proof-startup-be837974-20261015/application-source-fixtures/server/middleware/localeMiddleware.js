const { resolveLocale } = require('../utils/localeResolver');
const translationService = require('../services/TranslationService');
const { formatMessage } = require('../utils/messageFormatter');

/**
 * Middleware to resolve the current locale for the request.
 * Priority:
 * 1. Session Header Override (x-app-locale)
 * 2. Authenticated User Preference (req.user.language)
 * 3. Lab Default (if user belongs to lab)
 * 4. Accept-Language Header (with weighted quality parsing)
 * 5. Default 'en'
 */
const localeMiddleware = async (req, res, next) => {
    try {
        const appLocale = req.headers['x-app-locale'];
        const userLanguage = req.user?.language;
        const acceptLanguage = req.headers['accept-language'];

        const resolved = resolveLocale({
            sessionOverride: appLocale,
            userPreference: userLanguage,
            acceptLanguage,
            fallbackLocale: 'en'
        });

        req.locale = resolved;

        // Helper to get translated message on server side with ICU MessageFormat
        req.t = async (key, params = {}) => {
            const catalog = await translationService.getMergedTranslations(req.locale);
            let val = catalog[key] || key;
            return formatMessage(val, params, req.locale);
        };

        next();
    } catch (error) {
        console.error('[LocaleMiddleware] Error', error);
        req.locale = 'en';
        next();
    }
};

module.exports = localeMiddleware;
