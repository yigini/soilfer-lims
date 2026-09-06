import names from '../../../server/data/analysisDisplayNames.json';

// Offline/legacy fallback only. Working screens resolve current catalogue names via context.
export const ANALYSIS_DISPLAY_NAMES = names;
export const getAnalysisDisplayName = (code, fallbackName) => {
    if (!code) return fallbackName || '—';
    if (typeof fallbackName === 'string' && fallbackName.trim() && fallbackName !== code && fallbackName !== `${code} Determination` && !/^https?:/i.test(fallbackName)) return fallbackName;
    return names[code] || 'Unconfigured parameter';
};
export default getAnalysisDisplayName;
