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

    // Default branding metadata for instant clean resets on scope change
    const defaultBranding = useMemo(() => ({
        colors: {
            primary: '#276B51',
            secondary: '#111827',
            accent: '#D97706'
        },
        title: 'SoilFER LIMS',
        logoUrl: '/assets/img/logo-light.png'
    }), []);

    // Abort controller reference for cleaning up stale fetch requests
    const abortControllerRef = useRef(null);
    const contextGenerationRef = useRef(0);
    const authSubjectRef = useRef(authSubject);
    authSubjectRef.current = authSubject;

    // Synchronize authenticated user state from AuthProvider / bridge
    const syncAuthUser = useCallback((user) => {
        const prevAuth = authSubjectRef.current;
        const incomingId = (user && user.id) ? String(user.id) : null;
        const prevId = prevAuth.authenticated ? prevAuth.userId : null;
        const isScopeChange = (incomingId !== prevId) || ((user?.labId || null) !== prevAuth.labId);

        if (isScopeChange) {
            // Scope change: increment generation so any in-flight requests for prior user/lab are ignored
            contextGenerationRef.current += 1;

            // Clear preview override immediately
            setPreviewOverride(null);

            // Reset serverContext immediately to avoid retaining former laboratory default/authority
            setServerContext({
                labDefault: null,
                platformDefault: {
                    themeId: DEFAULT_THEME_ID,
                    defaultMode: DEFAULT_MODE,
                    revision: 1
                },
                canAdoptLabDefault: false,
                canAdoptPlatformDefault: false
            });

            // Reset branding immediately
            setTheme(defaultBranding);

            if (incomingId) {
                const subjectId = incomingId;
                const userThemeId = isValidThemeId(user.uiThemeId) ? user.uiThemeId : null;
                // Retain valid mode inherit over legacy dark
                const userModePref = (user.uiModePreference === 'inherit' || user.uiModePreference === 'light' || user.uiModePreference === 'dark')
                    ? user.uiModePreference
                    : (user.themePreference === 'dark' ? 'dark' : 'light');

                const existingSession = getStoredSessionOverride(subjectId);
                const nextAuth = {
                    authenticated: true,
                    userId: subjectId,
                    role: user.role,
                    labId: user.labId || null,
                    savedThemeId: userThemeId,
                    savedModePreference: userModePref,
                    revision: user.uiAppearanceRevision || 0
                };
                authSubjectRef.current = nextAuth;
                setAuthSubject(nextAuth);
                setSessionOverrideState(existingSession);
            } else {
                // Anonymous / signed out
                clearStoredSessionOverride();
                setSessionOverrideState(null);
                const nextAuth = {
                    authenticated: false,
                    userId: 'anonymous',
                    role: 'ANONYMOUS',
                    labId: null,
                    savedThemeId: null,
                    savedModePreference: 'light',
                    revision: 0
                };
                authSubjectRef.current = nextAuth;
                setAuthSubject(nextAuth);
            }
        } else {
            // Same-user, same-lab metadata refresh:
            // Do NOT increment contextGenerationRef.current to avoid discarding required in-flight fetches!
            const incomingRev = user.uiAppearanceRevision ?? 0;
            let finalThemeId = prevAuth.savedThemeId;
            let finalModePref = prevAuth.savedModePreference;
            let finalRev = prevAuth.revision;

            if (incomingRev > prevAuth.revision) {
                finalThemeId = isValidThemeId(user.uiThemeId) ? user.uiThemeId : null;
                finalModePref = (user.uiModePreference === 'inherit' || user.uiModePreference === 'light' || user.uiModePreference === 'dark')
                    ? user.uiModePreference
                    : (user.themePreference === 'dark' ? 'dark' : 'light');
                finalRev = incomingRev;
            } else if (incomingRev === prevAuth.revision) {
                if (user.uiThemeId !== undefined) {
                    finalThemeId = isValidThemeId(user.uiThemeId) ? user.uiThemeId : null;
                }
                if (user.uiModePreference !== undefined && ['inherit', 'light', 'dark'].includes(user.uiModePreference)) {
                    finalModePref = user.uiModePreference;
                }
            }
            // If incomingRev < prevAuth.revision: preserve prevAuth savedThemeId, savedModePreference, revision

            const nextAuth = {
                ...prevAuth,
                role: user.role,
                labId: user.labId || null,
                savedThemeId: finalThemeId,
                savedModePreference: finalModePref,
                revision: finalRev
            };
            authSubjectRef.current = nextAuth;
            setAuthSubject(nextAuth);
        }
    }, [defaultBranding]);

    // Fetch authoritative server context on auth change
    const fetchAppearanceContext = useCallback(async (queryLabId = null) => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        const controller = new AbortController();
        abortControllerRef.current = controller;
        const currentGen = ++contextGenerationRef.current;
        const initiatingUserId = authSubjectRef.current.userId;

        const token = localStorage.getItem('token');
        if (!token) {
            try {
                const res = await axios.get('/api/appearance/public', { signal: controller.signal });
                if (currentGen !== contextGenerationRef.current || initiatingUserId !== authSubjectRef.current.userId) return;
                const pub = res.data?.data || res.data;
                setServerContext(prev => ({
                    ...prev,
                    labDefault: null,
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
                if (currentGen === contextGenerationRef.current && initiatingUserId === authSubjectRef.current.userId) {
                    setLoading(false);
                }
            }
            return;
        }

        try {
            const url = queryLabId ? `/api/appearance/context?labId=${encodeURIComponent(queryLabId)}` : '/api/appearance/context';
            const res = await axios.get(url, { signal: controller.signal });
            if (currentGen !== contextGenerationRef.current || initiatingUserId !== authSubjectRef.current.userId) return;
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
                    const nextAuth = {
                        ...authSubjectRef.current,
                        savedThemeId: data.personal.themeId,
                        savedModePreference: data.personal.modePreference,
                        revision: data.personal.revision
                    };
                    authSubjectRef.current = nextAuth;
                    setAuthSubject(nextAuth);
                }
            }
        } catch (e) {
            if (!axios.isCancel(e)) {
                console.warn('[THEME] Could not load appearance context:', e.message);
            }
        } finally {
            if (currentGen === contextGenerationRef.current && initiatingUserId === authSubjectRef.current.userId) {
                setLoading(false);
            }
        }
    }, []);

    useEffect(() => {
        fetchAppearanceContext();
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, [authSubject.userId, authSubject.labId, fetchAppearanceContext]);

    // Load laboratory branding settings (titles, logos, branding metadata)
    useEffect(() => {
        const initiatingUserId = authSubjectRef.current.userId;
        const initiatingGen = contextGenerationRef.current;
        const loadBranding = async () => {
            const token = localStorage.getItem('token');
            if (!token) return;

            try {
                const res = await axios.get('/api/admin/settings');
                if (initiatingUserId !== authSubjectRef.current.userId || initiatingGen !== contextGenerationRef.current) return;
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
        const currentAuth = authSubjectRef.current;
        const initiatingUserId = currentAuth.userId;
        const initiatingGen = contextGenerationRef.current;

        const payload = {
            appearance: {
                themeId: themeId === undefined ? currentAuth.savedThemeId : themeId,
                modePreference: modePreference === undefined ? currentAuth.savedModePreference : modePreference,
                expectedRevision: expectedRevision !== undefined ? expectedRevision : currentAuth.revision
            }
        };

        try {
            const res = await axios.patch('/api/auth/preferences', payload);
            const data = res.data?.data || res.data;

            // Guard against stale response if user or generation changed
            if (initiatingUserId !== authSubjectRef.current.userId || initiatingGen !== contextGenerationRef.current) {
                return null;
            }

            // Clear preview & session overrides so saved values immediately take effect
            setPreviewOverride(null);
            clearStoredSessionOverride();
            setSessionOverrideState(null);

            if (data?.appearance) {
                const nextAuth = {
                    ...authSubjectRef.current,
                    savedThemeId: data.appearance.themeId,
                    savedModePreference: data.appearance.modePreference,
                    revision: data.appearance.revision
                };
                authSubjectRef.current = nextAuth;
                setAuthSubject(nextAuth);

                // Synchronize to localStorage
                try {
                    const storedUser = localStorage.getItem('user');
                    if (storedUser) {
                        const parsed = JSON.parse(storedUser);
                        if (String(parsed.id) === String(initiatingUserId)) {
                            parsed.uiThemeId = data.appearance.themeId;
                            parsed.uiModePreference = data.appearance.modePreference;
                            parsed.uiAppearanceRevision = data.appearance.revision;
                            if (data.themePreference !== undefined) {
                                parsed.themePreference = data.themePreference;
                            }
                            localStorage.setItem('user', JSON.stringify(parsed));
                        }
                    }
                } catch {
                    // Ignore storage error
                }

                if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
                    try {
                        window.dispatchEvent(new CustomEvent('soilfer:appearance-saved', {
                            detail: {
                                userId: initiatingUserId,
                                themeId: data.appearance.themeId,
                                modePreference: data.appearance.modePreference,
                                revision: data.appearance.revision
                            }
                        }));
                    } catch {
                        // Ignore dispatch error
                    }
                }
            }

            return data;
        } catch (err) {
            if (initiatingUserId !== authSubjectRef.current.userId || initiatingGen !== contextGenerationRef.current) {
                return null;
            }
            throw err;
        }
    }, []);

    // Adopt laboratory default (LAB_MANAGER for own lab, or SUPER_ADMIN)
    const adoptLabDefault = useCallback(async ({ labId, themeId, defaultMode, expectedRevision }) => {
        const currentAuth = authSubjectRef.current;
        const targetLabId = labId || currentAuth.labId;
        if (!targetLabId) {
            throw new Error('No laboratory specified for default adoption.');
        }

        const initiatingUserId = currentAuth.userId;
        const initiatingGen = contextGenerationRef.current;

        let targetRevision = expectedRevision;
        if (targetRevision === undefined) {
            if (serverContext.labDefault && serverContext.labDefault.labId === targetLabId) {
                targetRevision = serverContext.labDefault.revision;
            } else {
                const labRes = await axios.get(`/api/labs/${encodeURIComponent(targetLabId)}/appearance`);
                if (labRes.data?.data?.revision !== undefined) {
                    targetRevision = labRes.data.data.revision;
                } else {
                    throw new Error('Failed to resolve target laboratory appearance revision.');
                }
            }
        }

        const payload = {
            themeId,
            defaultMode: defaultMode || 'inherit',
            expectedRevision: targetRevision
        };

        try {
            const res = await axios.patch(`/api/labs/${encodeURIComponent(targetLabId)}/appearance`, payload);
            const data = res.data?.data || res.data;

            if (initiatingUserId !== authSubjectRef.current.userId || initiatingGen !== contextGenerationRef.current) {
                return null;
            }

            setPreviewOverride(null);
            // Only refresh user context if adopting for user's own assigned lab
            if (targetLabId === authSubjectRef.current.labId) {
                await fetchAppearanceContext();
            }
            return data;
        } catch (err) {
            if (initiatingUserId !== authSubjectRef.current.userId || initiatingGen !== contextGenerationRef.current) {
                return null;
            }
            throw err;
        }
    }, [serverContext.labDefault, fetchAppearanceContext]);

    // Adopt platform-wide default (SUPER_ADMIN only)
    const adoptPlatformDefault = useCallback(async ({ themeId, defaultMode, expectedRevision }) => {
        const currentAuth = authSubjectRef.current;
        const initiatingUserId = currentAuth.userId;
        const initiatingGen = contextGenerationRef.current;

        const targetRevision = expectedRevision !== undefined ? expectedRevision : (serverContext.platformDefault?.revision ?? 1);
        const payload = {
            themeId,
            defaultMode: defaultMode || 'light',
            expectedRevision: targetRevision
        };

        try {
            const res = await axios.patch('/api/admin/appearance', payload);
            const data = res.data?.data || res.data;

            if (initiatingUserId !== authSubjectRef.current.userId || initiatingGen !== contextGenerationRef.current) {
                return null;
            }

            setPreviewOverride(null);
            await fetchAppearanceContext();
            return data;
        } catch (err) {
            if (initiatingUserId !== authSubjectRef.current.userId || initiatingGen !== contextGenerationRef.current) {
                return null;
            }
            throw err;
        }
    }, [serverContext.platformDefault?.revision, fetchAppearanceContext]);

    // Reset personal preferences to inherit
    const resetPersonalToDefault = useCallback(async () => {
        return await savePersonalPreferences({
            themeId: null,
            modePreference: 'inherit'
        });
    }, [savePersonalPreferences]);

    // Fetch appearance for specific laboratory without replacing current user appearance context
    const getLabAppearance = useCallback(async (labId) => {
        if (!labId) return null;
        try {
            const res = await axios.get(`/api/labs/${encodeURIComponent(labId)}/appearance`);
            return res.data?.data || null;
        } catch (err) {
            console.warn('[THEME] Could not fetch target lab appearance:', err.message);
            throw err;
        }
    }, []);

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
        getLabAppearance,
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
        getLabAppearance,
        syncAuthUser
    ]);

    return (
        <ThemeContext.Provider value={contextValue}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => useContext(ThemeContext);
