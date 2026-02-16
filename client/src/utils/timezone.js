/**
 * Timezone Utilities
 * Auto-detect user timezone and format timestamps accordingly
 */

const getLocale = () => {
    try {
        return localStorage.getItem('locale') || navigator.language || 'en';
    } catch {
        return 'en';
    }
};

/**
 * Get the user's browser timezone
 * @returns {string} IANA timezone identifier (e.g., "Europe/Paris")
 */
export const getUserTimezone = () => {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
};

/**
 * Get timezone abbreviation (e.g., "CET", "EST")
 * @returns {string} Timezone abbreviation
 */
export const getTimezoneAbbr = () => {
    const date = new Date();
    const formatter = new Intl.DateTimeFormat(getLocale(), {
        timeZoneName: 'short'
    });
    const parts = formatter.formatToParts(date);
    const timeZonePart = parts.find(part => part.type === 'timeZoneName');
    return timeZonePart ? timeZonePart.value : '';
};

/**
 * Get timezone offset string (e.g., "+01:00", "-05:00")
 * @returns {string} Timezone offset
 */
export const getTimezoneOffset = () => {
    const offset = -new Date().getTimezoneOffset();
    const hours = Math.floor(Math.abs(offset) / 60);
    const minutes = Math.abs(offset) % 60;
    const sign = offset >= 0 ? '+' : '-';
    return `${sign}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

/**
 * Format a UTC timestamp to user's local timezone
 * @param {string|Date} utcDate - UTC date string or Date object
 * @param {string} format - Format type: 'full', 'date', 'time', 'datetime', 'relative'
 * @returns {string} Formatted date string
 */
export const formatTimestamp = (utcDate, format = 'datetime') => {
    if (!utcDate) return '';

    const date = typeof utcDate === 'string' ? new Date(utcDate) : utcDate;

    if (isNaN(date.getTime())) return 'Invalid Date';

    const options = {
        timeZone: getUserTimezone()
    };

    switch (format) {
        case 'full':
            return new Intl.DateTimeFormat(getLocale(), {
                ...options,
                dateStyle: 'full',
                timeStyle: 'long'
            }).format(date);

        case 'date':
            return new Intl.DateTimeFormat(getLocale(), {
                ...options,
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            }).format(date);

        case 'time':
            return new Intl.DateTimeFormat(getLocale(), {
                ...options,
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            }).format(date);

        case 'datetime':
            return new Intl.DateTimeFormat(getLocale(), {
                ...options,
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            }).format(date);

        case 'relative':
            return formatRelativeTime(date);

        default:
            return date.toLocaleString(getLocale(), options);
    }
};

/**
 * Format timestamp with timezone indicator
 * @param {string|Date} utcDate - UTC date string or Date object
 * @returns {string} Formatted date with timezone (e.g., "2026-01-27 09:47 CET")
 */
export const formatTimestampWithTZ = (utcDate) => {
    if (!utcDate) return '';

    const date = typeof utcDate === 'string' ? new Date(utcDate) : utcDate;

    if (isNaN(date.getTime())) return 'Invalid Date';

    const formatted = new Intl.DateTimeFormat(getLocale(), {
        timeZone: getUserTimezone(),
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short'
    }).format(date);

    return formatted;
};

/**
 * Format relative time (e.g., "2 hours ago", "in 3 days")
 * @param {Date} date - Date to format
 * @returns {string} Relative time string
 */
const formatRelativeTime = (date) => {
    const now = new Date();
    const diffMs = date - now;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    const rtf = new Intl.RelativeTimeFormat(getLocale(), { numeric: 'auto' });

    if (Math.abs(diffDay) >= 1) {
        return rtf.format(diffDay, 'day');
    } else if (Math.abs(diffHour) >= 1) {
        return rtf.format(diffHour, 'hour');
    } else if (Math.abs(diffMin) >= 1) {
        return rtf.format(diffMin, 'minute');
    } else {
        return rtf.format(diffSec, 'second');
    }
};

/**
 * Get timezone info object
 * @returns {object} Timezone information
 */
export const getTimezoneInfo = () => {
    return {
        timezone: getUserTimezone(),
        abbreviation: getTimezoneAbbr(),
        offset: getTimezoneOffset()
    };
};
