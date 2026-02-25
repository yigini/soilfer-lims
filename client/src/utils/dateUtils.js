/**
 * Centralized date formatting utility for consistent date display.
 * Uses Intl.DateTimeFormat for locale-aware formatting.
 */

/**
 * Format a date value into a human-readable string.
 * @param {string|Date|number} value - Date string, Date object, or timestamp
 * @param {'short'|'medium'|'long'|'iso'|'relative'} [style='medium'] - Format style
 * @param {string} [locale] - BCP 47 locale string (defaults to browser locale)
 * @returns {string} Formatted date string, or '—' for invalid input
 */
export function formatDate(value, style = 'medium', locale) {
    if (!value) return '—';

    const date = value instanceof Date ? value : new Date(value);
    if (isNaN(date.getTime())) return '—';

    switch (style) {
        case 'short':
            // e.g. "25/02/2026"
            return date.toLocaleDateString(locale);

        case 'medium':
            // e.g. "25 Feb 2026"
            return date.toLocaleDateString(locale, {
                day: 'numeric', month: 'short', year: 'numeric'
            });

        case 'long':
            // e.g. "February 25, 2026 11:36 PM"
            return date.toLocaleString(locale, {
                day: 'numeric', month: 'long', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
            });

        case 'iso':
            // e.g. "2026-02-25"
            return date.toISOString().split('T')[0];

        case 'relative': {
            const now = new Date();
            const diffMs = now - date;
            const diffMin = Math.floor(diffMs / 60000);
            const diffHrs = Math.floor(diffMs / 3600000);
            const diffDays = Math.floor(diffMs / 86400000);

            if (diffMin < 1) return 'Just now';
            if (diffMin < 60) return `${diffMin}m ago`;
            if (diffHrs < 24) return `${diffHrs}h ago`;
            if (diffDays < 7) return `${diffDays}d ago`;
            if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
            return date.toLocaleDateString(locale, {
                day: 'numeric', month: 'short', year: 'numeric'
            });
        }

        default:
            return date.toLocaleDateString(locale);
    }
}

/**
 * Format a date as time only.
 * @param {string|Date|number} value
 * @param {string} [locale]
 * @returns {string}
 */
export function formatTime(value, locale) {
    if (!value) return '—';
    const date = value instanceof Date ? value : new Date(value);
    if (isNaN(date.getTime())) return '—';
    return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
}
