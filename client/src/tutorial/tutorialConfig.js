// Module-local availability and retirement configuration
// Allows temporary availability control and clean retirement without altering backend rules.

export const TUTORIAL_CONFIG = {
    // Master availability flag for the tutorial module
    // Default-off build setting: enabled only when VITE_TUTORIAL_ENABLED is explicitly true.
    // Evaluates to false by default when absent or unset.
    enabled: typeof import.meta.env !== 'undefined' && import.meta.env.VITE_TUTORIAL_ENABLED !== undefined
        ? (import.meta.env.VITE_TUTORIAL_ENABLED === 'true' || import.meta.env.VITE_TUTORIAL_ENABLED === true)
        : false,
    // Optional retirement date (ISO string or timestamp). If Date.now() > retiredAt, guide is retired.
    // Default null means active while enabled.
    retiredAt: null
};

export function isTutorialAvailable() {
    if (!TUTORIAL_CONFIG.enabled) return false;
    if (TUTORIAL_CONFIG.retiredAt && Date.now() > new Date(TUTORIAL_CONFIG.retiredAt).getTime()) {
        return false;
    }
    // Check runtime window override or session disable flag for tests / dynamic toggle
    if (typeof window !== 'undefined') {
        if (window.__SOILFER_TUTORIAL_DISABLED__ === true) return false;
        try {
            if (sessionStorage.getItem('soilfer_tutorial_disabled') === 'true') return false;
        } catch {}
    }
    return true;
}
