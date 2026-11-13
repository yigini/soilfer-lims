const defaults = require('../../shared/publicSupport.json');

function getManualUrl() {
    const value = process.env.MANUAL_URL === undefined ? defaults.manualUrl : process.env.MANUAL_URL;
    if (typeof value !== 'string' || !value.trim()) return '';
    try {
        const url = new URL(value.trim());
        if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return '';
        return url.href;
    } catch {
        return '';
    }
}

function withPublicSupportDefaults(branding = {}) {
    const value = branding && typeof branding === 'object' && !Array.isArray(branding) ? branding : {};
    return {
        ...value,
        contactEmail: typeof value.contactEmail === 'string' && value.contactEmail.trim()
            ? value.contactEmail.trim() : defaults.contactEmail,
        manualUrl: getManualUrl()
    };
}

module.exports = { getManualUrl, withPublicSupportDefaults };
