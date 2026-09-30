/**
 * SoilFER LIMS - Unified Theme & Appearance Provider
 *
 * Implements Phase 3 Resolver & State Contract:
 * - Single source of truth for sitewide theme and mode
 * - Strict precedence: Preview -> Session -> Saved -> Lab Default -> Platform Default -> Classic Light
 * - Reversible full-screen preview with work preservation (no full tree remount)
 * - Authority-checked adoption for LAB_MANAGER and SUPER_ADMIN
 * - In-memory fallback and identity-safe session storage
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import axios from 'axios';
import {
    resolveThemeAppearance,
    getStoredSessionOverride,
    setStoredSessionOverride,
    clearStoredSessionOverride,
    clearLegacyThemeStorage,
    applyRootAppearance,
    isValidAppearance
} from '../lib/appearance';
import {
    isValidThemeId,
    getTheme,
    DEFAULT_THEME_ID,
    DEFAULT_MODE,
    THEMES,
    THEME_ALLOWLIST,
    getPublishedThemeList
} from '../lib/themeCatalog';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
    // Laboratory branding metadata (title, logo, custom non-critical decorative accents)
    const [theme, setTheme] = useState({
        colors: {
            primary: '#276B51',
            secondary: '#111827',
            accent: '#D97706'
        },
        title: 'SoilFER LIMS',
        logoUrl: '/assets/img/logo-light.png'
    });

    const [loading, setLoading] = useState(true);

    // Current authenticated identity & personal preferences
    const [authSubject, setAuthSubject] = useState({
        authenticated: false,
        userId: 'anonymous',
        role: 'ANONYMOUS',
        labId: null,
        savedThemeId: null,
        savedModePreference: 'light',
        revision: 0
    });

    // Remote appearance context loaded from server
    const [serverContext, setServerContext] = useState({
        labDefault: null,
        platformDefault: {
            themeId: DEFAULT_THEME_ID,
            defaultMode: DEFAULT_MODE,
            revision: 1
        },
        canAdoptLabDefault: false,
        canAdoptPlatformDefault: false
    });

    // Reversible Full-Screen Preview Override: { themeId, mode } | null
    const [previewOverride, setPreviewOverride] = useState(null);

    // Current tab session override: { themeId, mode } | null
    const [sessionOverride, setSessionOverrideState] = useState(() => {
        clearLegacyThemeStorage();
        return getStoredSessionOverride('anonymous');
    });

    // Abort controller reference for cleaning up stale fetch requests
    const abortControllerRef = useRef(null);

    // Synchronize authenticated user state from AuthProvider / bridge
    const syncAuthUser = useCallback((user) => {
        if (user && user.id) {
            const subjectId = String(user.id);
            const userThemeId = isValidThemeId(user.uiThemeId) ? user.uiThemeId : null;
            const userModePref = (user.uiModePreference === 'light' || user.uiModePreference === 'dark')
                ? user.uiModePreference
                : (user.themePreference === 'dark' ? 'dark' : (user.uiModePreference === 'inherit' ? 'inherit' : 'light'));

            const existingSession = getStoredSessionOverride(subjectId);

            setAuthSubject({
                authenticated: true,
                userId: subjectId,
                role: user.role,
                labId: user.labId || null,
                savedThemeId: userThemeId,
                savedModePreference: userModePref,
                revision: user.uiAppearanceRevision || 0
            });
            setSessionOverrideState(existingSession);
        } else {
            // Anonymous / signed out
            const anonSession = getStoredSessionOverride('anonymous');
            setAuthSubject({
                authenticated: false,
                userId: 'anonymous',
                role: 'ANONYMOUS',
                labId: null,
                savedThemeId: null,
                savedModePreference: 'light',
                revision: 0
            });
            setSessionOverrideState(anonSession);
            setPreviewOverride(null);
        }
    }, []);

    // Fetch authoritative server context on auth change
    const fetchAppearanceContext = useCallback(async (queryLabId = null) => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        const controller = new AbortController();
        abortControllerRef.current = controller;

        const token = localStorage.getItem('token');
        if (!token) {
            try {
                const res = await axios.get('/api/appearance/public', { signal: controller.signal });
                const pub = res.data?.data || res.data;
                setServerContext(prev => ({
                    ...prev,
                    platformDefault: {
                        themeId: pub.themeId || DEFAULT_THEME_ID,
                        defaultMode: pub.appearance || DEFAULT_MODE,
                        revision: pub.revision || 1
                    }
                }));
            } catch (e) {
                if (!axios.isCancel(e)) {
                    // Safe fallback
                }
            } finally {
                setLoading(false);
            }
            return;
        }

        try {
            const url = queryLabId ? `/api/appearance/context?labId=${encodeURIComponent(queryLabId)}` : '/api/appearance/context';
            const res = await axios.get(url, { signal: controller.signal });
            const data = res.data?.data || res.data;

            if (data) {
                setServerContext({
                    labDefault: data.labDefault || null,
                    platformDefault: data.platformDefault || {
                        themeId: DEFAULT_THEME_ID,
                        defaultMode: DEFAULT_MODE,
                        revision: 1
                    },
                    canAdoptLabDefault: !!data.canAdoptLabDefault,
                    canAdoptPlatformDefault: !!data.canAdoptPlatformDefault
                });

                if (data.personal) {
                    setAuthSubject(prev => ({
                        ...prev,
                        savedThemeId: data.personal.themeId,
                        savedModePreference: data.personal.modePreference,
                        revision: data.personal.revision
                    }));
                }
            }
        } catch (e) {
            if (!axios.isCancel(e)) {
                console.warn('[THEME] Could not load appearance context:', e.message);
            }
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAppearanceContext();
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, [authSubject.userId, fetchAppearanceContext]);

    // Load laboratory branding settings (titles, logos, branding metadata)
    useEffect(() => {
        const loadBranding = async () => {
            const token = localStorage.getItem('token');
            if (!token) return;

            try {
                const res = await axios.get('/api/admin/settings');
                const settings = res.data?.data || res.data;
                if (settings?.branding) {
                    setTheme(prev => ({ ...prev, ...settings.branding }));
                }
            } catch (e) {
                // Ignore 401/403
            }
        };
        loadBranding();
    }, [authSubject.userId]);

    // Resolve authoritative effective appearance
    const resolved = useMemo(() => {
        return resolveThemeAppearance({
            authenticated: authSubject.authenticated,
            savedThemeId: authSubject.savedThemeId,
            savedModePreference: authSubject.savedModePreference,
            labDefaultThemeId: serverContext.labDefault?.themeId,
            labDefaultMode: serverContext.labDefault?.defaultMode,
            platformDefaultThemeId: serverContext.platformDefault?.themeId,
            platformDefaultMode: serverContext.platformDefault?.defaultMode,
            sessionOverride,
            previewOverride
        });
    }, [
        authSubject.authenticated,
        authSubject.savedThemeId,
        authSubject.savedModePreference,
        serverContext.labDefault,
        serverContext.platformDefault,
        sessionOverride,
        previewOverride
    ]);

    const activeThemeId = resolved.themeId;
    const appearance = resolved.appearance;
    const themeSource = resolved.themeSource;
    const modeSource = resolved.modeSource;
    const activeTheme = resolved.effectiveTheme;
    const isDarkMode = appearance === 'dark';
    const isPreviewActive = themeSource === 'preview' || modeSource === 'preview';

    // Apply document root attributes and browser theme color on every effective change
    useEffect(() => {
        applyRootAppearance({ appearance, themeId: activeThemeId });
    }, [appearance, activeThemeId]);

    // Start / Update Reversible Full-Screen Preview
    const setPreviewTheme = useCallback(({ themeId, mode }) => {
        setPreviewOverride({
            themeId: isValidThemeId(themeId) ? themeId : null,
            mode: isValidAppearance(mode) ? mode : null
        });
    }, []);

    // Exit Reversible Preview and return to authoritative state
    const clearPreviewTheme = useCallback(() => {
        setPreviewOverride(null);
    }, []);

    // Set temporary session override for current tab
    const setSessionAppearance = useCallback(({ themeId, mode }) => {
        const newOverride = {
            themeId: isValidThemeId(themeId) ? themeId : (sessionOverride?.themeId || null),
            mode: isValidAppearance(mode) ? mode : (sessionOverride?.mode || null)
        };
        setStoredSessionOverride(authSubject.userId, newOverride);
        setSessionOverrideState(newOverride);
    }, [authSubject.userId, sessionOverride]);

    // Clear session override (revert current tab to saved/default)
    const clearSessionAppearance = useCallback(() => {
        clearStoredSessionOverride();
        setSessionOverrideState(null);
    }, []);

    // Quick toggle between Light and Dark for current tab
    const toggleDarkMode = useCallback(() => {
        const nextMode = appearance === 'dark' ? 'light' : 'dark';
        setSessionAppearance({ mode: nextMode });
    }, [appearance, setSessionAppearance]);

    // Save personal preferences to server profile
    const savePersonalPreferences = useCallback(async ({ themeId, modePreference, expectedRevision }) => {
        const payload = {
            appearance: {
                themeId: themeId === undefined ? authSubject.savedThemeId : themeId,
                modePreference: modePreference === undefined ? authSubject.savedModePreference : modePreference,
                expectedRevision: expectedRevision !== undefined ? expectedRevision : authSubject.revision
            }
        };

        const res = await axios.patch('/api/auth/preferences', payload);
        const data = res.data?.data || res.data;

        // Clear preview & session overrides so saved values immediately take effect
        setPreviewOverride(null);
        clearStoredSessionOverride();
        setSessionOverrideState(null);

        if (data?.appearance) {
            setAuthSubject(prev => ({
                ...prev,
                savedThemeId: data.appearance.themeId,
                savedModePreference: data.appearance.modePreference,
                revision: data.appearance.revision
            }));
        }

        return data;
    }, [authSubject.savedThemeId, authSubject.savedModePreference, authSubject.revision]);

    // Adopt laboratory default (LAB_MANAGER for own lab, or SUPER_ADMIN)
    const adoptLabDefault = useCallback(async ({ labId, themeId, defaultMode, expectedRevision }) => {
        const targetLabId = labId || authSubject.labId;
        if (!targetLabId) {
            throw new Error('No laboratory specified for default adoption.');
        }

        const payload = {
            themeId,
            defaultMode: defaultMode || 'inherit',
            expectedRevision: expectedRevision !== undefined ? expectedRevision : serverContext.labDefault?.revision
        };

        const res = await axios.patch(`/api/labs/${encodeURIComponent(targetLabId)}/appearance`, payload);
        const data = res.data?.data || res.data;

        setPreviewOverride(null);
        await fetchAppearanceContext(targetLabId);
        return data;
    }, [authSubject.labId, serverContext.labDefault?.revision, fetchAppearanceContext]);

    // Adopt platform-wide default (SUPER_ADMIN only)
    const adoptPlatformDefault = useCallback(async ({ themeId, defaultMode, expectedRevision }) => {
        const payload = {
            themeId,
            defaultMode: defaultMode || 'light',
            expectedRevision: expectedRevision !== undefined ? expectedRevision : serverContext.platformDefault?.revision
        };

        const res = await axios.patch('/api/admin/appearance', payload);
        const data = res.data?.data || res.data;

        setPreviewOverride(null);
        await fetchAppearanceContext();
        return data;
    }, [serverContext.platformDefault?.revision, fetchAppearanceContext]);

    // Reset personal preferences to inherit
    const resetPersonalToDefault = useCallback(async () => {
        return await savePersonalPreferences({
            themeId: null,
            modePreference: 'inherit'
        });
    }, [savePersonalPreferences]);

    const contextValue = useMemo(() => ({
        theme,
        loading,
        activeThemeId,
        appearance,
        darkMode: isDarkMode,
        themeSource,
        modeSource,
        activeTheme,
        isPreviewActive,
        previewOverride,
        sessionOverride,
        authSubject,
        serverContext,
        themes: THEMES,
        publishedThemes: getPublishedThemeList(),
        setPreviewTheme,
        clearPreviewTheme,
        setSessionAppearance,
        clearSessionAppearance,
        toggleDarkMode,
        savePersonalPreferences,
        adoptLabDefault,
        adoptPlatformDefault,
        resetPersonalToDefault,
        fetchAppearanceContext,
        syncAuthUser
    }), [
        theme,
        loading,
        activeThemeId,
        appearance,
        isDarkMode,
        themeSource,
        modeSource,
        activeTheme,
        isPreviewActive,
        previewOverride,
        sessionOverride,
        authSubject,
        serverContext,
        setPreviewTheme,
        clearPreviewTheme,
        setSessionAppearance,
        clearSessionAppearance,
        toggleDarkMode,
        savePersonalPreferences,
        adoptLabDefault,
        adoptPlatformDefault,
        resetPersonalToDefault,
        fetchAppearanceContext,
        syncAuthUser
    ]);

    return (
        <ThemeContext.Provider value={contextValue}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => useContext(ThemeContext);
