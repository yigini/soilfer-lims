/**
 * Authoritative Appearance Resolver & Session Preference Contract
 *
 * Rules:
 * 1. Default everywhere is 'light'.
 * 2. Operating system prefers-color-scheme is NEVER used to set theme.
 * 3. Legacy localStorage.darkMode is NEVER used or migrated into profile preferences.
 * 4. Precedence:
 *    - Authenticated: sessionOverride ?? savedPreference ?? 'light'
 *    - Anonymous:     sessionOverride ?? 'light'
 * 5. Session overrides are scoped to the authenticated subjectId (or 'anonymous').
 *    If the active identity changes (logout, login as another user), overrides are invalidated.
 * 6. Storage reads/writes are safely wrapped with memory fallback if storage is blocked.
 */

export const STORAGE_KEY_SESSION_V1 = 'soilfer.appearance.session.v1';
export const LEGACY_STORAGE_KEY = 'darkMode';

// In-memory fallback if sessionStorage is blocked or throws
let memoryStorage = null;

/**
 * Validates whether a given value is an accepted appearance mode ('light' | 'dark').
 */
export function isValidAppearance(val) {
    return val === 'light' || val === 'dark';
}

/**
 * Pure appearance resolver.
 *
 * @param {Object} params
 * @param {boolean} [params.authenticated=false]
 * @param {string|null} [params.savedPreference=null]
 * @param {string|null} [params.sessionOverride=null]
 * @returns {{ appearance: 'light' | 'dark', source: 'session' | 'saved' | 'default' }}
 */
export function resolveAppearance({ authenticated = false, savedPreference = null, sessionOverride = null } = {}) {
    // 1. Session override wins for this active tab
    if (isValidAppearance(sessionOverride)) {
        return {
            appearance: sessionOverride,
            source: 'session'
        };
    }

    // 2. Saved account preference applies if authenticated
    if (authenticated && isValidAppearance(savedPreference)) {
        return {
            appearance: savedPreference,
            source: 'saved'
        };
    }

    // 3. Explicit product default is always 'light'
    return {
        appearance: 'light',
        source: 'default'
    };
}

/**
 * Safely reads the session override for the given subjectId from sessionStorage (or memory fallback).
 *
 * @param {string} subjectId - User ID or 'anonymous'
 * @returns {string|null} - 'light', 'dark', or null if unset or mismatched
 */
export function getStoredSessionOverride(subjectId = 'anonymous') {
    try {
        let raw = null;
        if (typeof window !== 'undefined' && window.sessionStorage) {
            raw = window.sessionStorage.getItem(STORAGE_KEY_SESSION_V1);
        } else {
            raw = memoryStorage;
        }

        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return null;

        // Ensure override belongs to the exact current subjectId
        if (parsed.subjectId === subjectId && isValidAppearance(parsed.value)) {
            return parsed.value;
        }

        // Mismatched subject: purge invalid session override
        clearStoredSessionOverride();
        return null;
    } catch {
        if (memoryStorage) {
            try {
                const parsed = JSON.parse(memoryStorage);
                if (parsed?.subjectId === subjectId && isValidAppearance(parsed?.value)) {
                    return parsed.value;
                }
            } catch {
                memoryStorage = null;
            }
        }
        return null;
    }
}

/**
 * Persists a session override for the current tab.
 *
 * @param {string} subjectId - User ID or 'anonymous'
 * @param {'light'|'dark'} value
 */
export function setStoredSessionOverride(subjectId = 'anonymous', value) {
    if (!isValidAppearance(value)) return;

    const payload = JSON.stringify({
        subjectId,
        value,
        timestamp: Date.now()
    });

    try {
        if (typeof window !== 'undefined' && window.sessionStorage) {
            window.sessionStorage.setItem(STORAGE_KEY_SESSION_V1, payload);
        }
    } catch {
        // Storage might be disabled/quota exceeded; fallback to memory
    }
    memoryStorage = payload;
}

/**
 * Clears the session override from sessionStorage and memory.
 */
export function clearStoredSessionOverride() {
    try {
        if (typeof window !== 'undefined' && window.sessionStorage) {
            window.sessionStorage.removeItem(STORAGE_KEY_SESSION_V1);
        }
    } catch {
        // Ignore errors
    }
    memoryStorage = null;
}

/**
 * Cleans up legacy darkMode localStorage key to prevent unapproved defaults.
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
 * Applies appearance to document root:
 * - data-appearance="light|dark"
 * - class="dark" (compatibility with Tailwind dark: selectors)
 * - color-scheme: light|dark
 * - theme-color meta tag
 *
 * @param {'light'|'dark'} appearance
 */
export function applyRootAppearance(appearance) {
    if (typeof window === 'undefined' || !window.document?.documentElement) return;
    const effective = isValidAppearance(appearance) ? appearance : 'light';
    const root = window.document.documentElement;

    root.setAttribute('data-appearance', effective);
    root.style.colorScheme = effective;

    if (effective === 'dark') {
        root.classList.add('dark');
    } else {
        root.classList.remove('dark');
    }

    // Update browser theme-color meta tag if present
    try {
        let meta = document.querySelector('meta[name="theme-color"]');
        if (!meta) {
            meta = document.createElement('meta');
            meta.setAttribute('name', 'theme-color');
            document.head.appendChild(meta);
        }
        meta.setAttribute('content', effective === 'dark' ? '#25282B' : '#F4F6F5');
    } catch {
        // Ignore meta tag errors in non-standard environments
    }
}
