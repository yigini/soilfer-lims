/**
 * SoilFER LIMS - Authoritative Appearance & Theme Resolver
 *
 * Rules:
 * 1. Default everywhere is 'soilfer-classic' + 'light'.
 * 2. Operating system prefers-color-scheme is NEVER used to set theme.
 * 3. Precedence for Theme:
 *    - Preview / Session override (exact subjectId)
 *    - Saved personal theme (if set, null = follow default)
 *    - Laboratory default (if assigned and active)
 *    - Platform default
 *    - Built-in 'soilfer-classic'
 * 4. Precedence for Mode:
 *    - Preview / Session override (exact subjectId)
 *    - Explicit saved personal mode ('light' | 'dark', 'inherit' = follow default)
 *    - Laboratory default mode (if not 'inherit')
 *    - Platform default mode
 *    - Built-in 'light'
 * 5. Session overrides are scoped to the authenticated subjectId (or 'anonymous').
 * 6. Storage reads/writes are safely wrapped with memory fallback if storage is blocked.
 */

import {
    isValidThemeId,
    getTheme,
    DEFAULT_THEME_ID,
    DEFAULT_MODE
} from './themeCatalog';

export const STORAGE_KEY_SESSION_V2 = 'soilfer.appearance.session.v2';
export const STORAGE_KEY_SESSION_V1 = 'soilfer.appearance.session.v1';
export const LEGACY_STORAGE_KEY = 'darkMode';

// In-memory fallback if sessionStorage is blocked or throws
let memoryStorage = null;

/**
 * Validates whether a value is an accepted appearance mode ('light' | 'dark').
 */
export function isValidAppearance(val) {
    return val === 'light' || val === 'dark';
}

/**
 * Pure appearance & theme resolver.
 *
 * @param {Object} params
 * @param {boolean} [params.authenticated=false]
 * @param {string|null} [params.savedThemeId=null]
 * @param {string|null} [params.savedModePreference=null]
 * @param {string|null} [params.labDefaultThemeId=null]
 * @param {string|null} [params.labDefaultMode=null]
 * @param {string|null} [params.platformDefaultThemeId=null]
 * @param {string|null} [params.platformDefaultMode=null]
 * @param {Object|null} [params.sessionOverride=null] - { themeId, mode }
 * @param {Object|null} [params.previewOverride=null] - { themeId, mode }
 * @returns {{
 *   themeId: string,
 *   appearance: 'light' | 'dark',
 *   themeSource: 'preview' | 'session' | 'saved' | 'labDefault' | 'platformDefault' | 'default',
 *   modeSource: 'preview' | 'session' | 'saved' | 'labDefault' | 'platformDefault' | 'default',
 *   effectiveTheme: Object
 * }}
 */
export function resolveThemeAppearance({
    authenticated = false,
    savedThemeId = null,
    savedModePreference = null,
    labDefaultThemeId = null,
    labDefaultMode = null,
    platformDefaultThemeId = null,
    platformDefaultMode = null,
    sessionOverride = null,
    previewOverride = null
} = {}) {
    let resolvedThemeId = null;
    let themeSource = 'default';

    let resolvedMode = null;
    let modeSource = 'default';

    // 1. Preview override wins over everything while active
    if (previewOverride) {
        if (isValidThemeId(previewOverride.themeId)) {
            resolvedThemeId = previewOverride.themeId;
            themeSource = 'preview';
        }
        if (isValidAppearance(previewOverride.mode)) {
            resolvedMode = previewOverride.mode;
            modeSource = 'preview';
        }
    }

    // 2. Session override for current tab (if theme or mode not set by preview)
    if (sessionOverride) {
        if (!resolvedThemeId && isValidThemeId(sessionOverride.themeId)) {
            resolvedThemeId = sessionOverride.themeId;
            themeSource = 'session';
        }
        if (!resolvedMode && isValidAppearance(sessionOverride.mode)) {
            resolvedMode = sessionOverride.mode;
            modeSource = 'session';
        }
    }

    // 3. Saved personal preferences (if authenticated)
    if (authenticated) {
        if (!resolvedThemeId && isValidThemeId(savedThemeId)) {
            resolvedThemeId = savedThemeId;
            themeSource = 'saved';
        }
        if (!resolvedMode && isValidAppearance(savedModePreference)) {
            resolvedMode = savedModePreference;
            modeSource = 'saved';
        }
    }

    // 4. Laboratory default
    if (!resolvedThemeId && isValidThemeId(labDefaultThemeId)) {
        resolvedThemeId = labDefaultThemeId;
        themeSource = 'labDefault';
    }
    if (!resolvedMode && isValidAppearance(labDefaultMode)) {
        resolvedMode = labDefaultMode;
        modeSource = 'labDefault';
    }

    // 5. Platform default
    if (!resolvedThemeId && isValidThemeId(platformDefaultThemeId)) {
        resolvedThemeId = platformDefaultThemeId;
        themeSource = 'platformDefault';
    }
    if (!resolvedMode && isValidAppearance(platformDefaultMode)) {
        resolvedMode = platformDefaultMode;
        modeSource = 'platformDefault';
    }

    // 6. Built-in fallback
    if (!resolvedThemeId) {
        resolvedThemeId = DEFAULT_THEME_ID;
        themeSource = 'default';
    }
    if (!resolvedMode) {
        resolvedMode = DEFAULT_MODE;
        modeSource = 'default';
    }

    const effectiveTheme = getTheme(resolvedThemeId);

    return {
        themeId: resolvedThemeId,
        appearance: resolvedMode,
        themeSource,
        modeSource,
        effectiveTheme
    };
}

/**
 * Compatibility wrapper for prior resolveAppearance signature.
 */
export function resolveAppearance({ authenticated = false, savedPreference = null, sessionOverride = null } = {}) {
    const sessionMode = typeof sessionOverride === 'string'
        ? sessionOverride
        : sessionOverride?.mode;

    const sessionThemeId = typeof sessionOverride === 'object'
        ? sessionOverride?.themeId
        : null;

    const res = resolveThemeAppearance({
        authenticated,
        savedModePreference: savedPreference,
        sessionOverride: (sessionMode || sessionThemeId) ? { mode: sessionMode, themeId: sessionThemeId } : null
    });

    return {
        appearance: res.appearance,
        themeId: res.themeId,
        source: res.modeSource === 'preview' || res.modeSource === 'session' ? 'session' : (res.modeSource === 'saved' ? 'saved' : 'default'),
        themeSource: res.themeSource,
        modeSource: res.modeSource
    };
}

/**
 * Safely reads the session override for the given subjectId from sessionStorage.
 * Supports transparent migration from v1 records.
 *
 * @param {string} subjectId - User ID or 'anonymous'
 * @returns {{ themeId: string|null, mode: string|null }|null}
 */
export function getStoredSessionOverride(subjectId = 'anonymous') {
    try {
        let raw = null;
        if (typeof window !== 'undefined' && window.sessionStorage) {
            raw = window.sessionStorage.getItem(STORAGE_KEY_SESSION_V2);
        } else {
            raw = memoryStorage;
        }

        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object' && parsed.subjectId === subjectId) {
                const themeId = isValidThemeId(parsed.themeId) ? parsed.themeId : null;
                const mode = isValidAppearance(parsed.mode) ? parsed.mode : null;
                if (themeId || mode) {
                    return { themeId, mode };
                }
            }
        }

        // Migration check from v1 session override
        if (typeof window !== 'undefined' && window.sessionStorage) {
            const rawV1 = window.sessionStorage.getItem(STORAGE_KEY_SESSION_V1);
            if (rawV1) {
                const parsedV1 = JSON.parse(rawV1);
                if (parsedV1 && parsedV1.subjectId === subjectId && isValidAppearance(parsedV1.value)) {
                    const migrated = { themeId: null, mode: parsedV1.value };
                    setStoredSessionOverride(subjectId, migrated);
                    window.sessionStorage.removeItem(STORAGE_KEY_SESSION_V1);
                    return migrated;
                }
            }
        }

        return null;
    } catch {
        return null;
    }
}

/**
 * Persists a session override for the current tab.
 *
 * @param {string} subjectId - User ID or 'anonymous'
 * @param {Object} override - { themeId?: string|null, mode?: string|null }
 */
export function setStoredSessionOverride(subjectId = 'anonymous', override = {}) {
    const themeId = isValidThemeId(override.themeId) ? override.themeId : null;
    const mode = isValidAppearance(override.mode) ? override.mode : null;

    if (!themeId && !mode) {
        clearStoredSessionOverride();
        return;
    }

    const payload = JSON.stringify({
        subjectId,
        themeId,
        mode,
        timestamp: Date.now()
    });

    try {
        if (typeof window !== 'undefined' && window.sessionStorage) {
            window.sessionStorage.setItem(STORAGE_KEY_SESSION_V2, payload);
        }
    } catch {
        // Storage might be disabled/quota exceeded
    }
    memoryStorage = payload;
}

/**
 * Clears the session override from sessionStorage and memory.
 */
export function clearStoredSessionOverride() {
    try {
        if (typeof window !== 'undefined' && window.sessionStorage) {
            window.sessionStorage.removeItem(STORAGE_KEY_SESSION_V2);
            window.sessionStorage.removeItem(STORAGE_KEY_SESSION_V1);
        }
    } catch {
        // Ignore errors
    }
    memoryStorage = null;
}

/**
 * Cleans up legacy darkMode localStorage key.
 */
export function clearLegacyThemeStorage() {
    try {
        if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.removeItem(LEGACY_STORAGE_KEY);
        }
    } catch {
        // Ignore errors
    }
}

/**
 * Applies theme and appearance to document root:
 * - data-theme="<themeId>"
 * - data-appearance="light|dark"
 * - class="dark" (Tailwind dark: selector compatibility)
 * - color-scheme: light|dark
 * - theme-color meta tag
 *
 * @param {'light'|'dark'|Object} appearance - mode or { appearance, themeId }
 * @param {string} [themeId]
 */
export function applyRootAppearance(appearance, themeId = null) {
    if (typeof window === 'undefined' || !window.document?.documentElement) return;

    let mode = 'light';
    let tid = DEFAULT_THEME_ID;

    if (typeof appearance === 'object' && appearance !== null) {
        mode = isValidAppearance(appearance.appearance) ? appearance.appearance : (isValidAppearance(appearance.mode) ? appearance.mode : 'light');
        tid = isValidThemeId(appearance.themeId) ? appearance.themeId : DEFAULT_THEME_ID;
    } else {
        mode = isValidAppearance(appearance) ? appearance : 'light';
        tid = isValidThemeId(themeId) ? themeId : DEFAULT_THEME_ID;
    }

    const root = window.document.documentElement;

    root.setAttribute('data-theme', tid);
    root.setAttribute('data-appearance', mode);
    root.style.colorScheme = mode;

    if (mode === 'dark') {
        root.classList.add('dark');
    } else {
        root.classList.remove('dark');
    }

    // Update browser theme-color meta tag to match the active theme's browser theme
    try {
        const themeDef = getTheme(tid);
        const browserTheme = themeDef ? (mode === 'dark' ? themeDef.dark.browserTheme : themeDef.light.browserTheme) : (mode === 'dark' ? '#25282B' : '#F5F3ED');

        let meta = document.querySelector('meta[name="theme-color"]');
        if (!meta) {
            meta = document.createElement('meta');
            meta.setAttribute('name', 'theme-color');
            document.head.appendChild(meta);
        }
        meta.setAttribute('content', browserTheme);
    } catch {
        // Ignore meta tag errors in non-standard environments
    }
}
