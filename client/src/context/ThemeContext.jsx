import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import axios from 'axios';
import {
    resolveAppearance,
    getStoredSessionOverride,
    setStoredSessionOverride,
    clearStoredSessionOverride,
    clearLegacyThemeStorage,
    applyRootAppearance,
    isValidAppearance
} from '../lib/appearance';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
    // Branding theme (colors, title, logoUrl) - preserved for laboratory branding customization
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

    // Current authenticated identity context
    const [authSubject, setAuthSubject] = useState({
        authenticated: false,
        userId: 'anonymous',
        savedPreference: 'light'
    });

    // Session override state for current tab (null = no override, 'light', or 'dark')
    const [sessionOverride, setSessionOverrideState] = useState(() => {
        // Clear legacy unapproved localStorage key
        clearLegacyThemeStorage();
        // Check sessionStorage for anonymous or pre-existing session override
        return getStoredSessionOverride('anonymous');
    });

    // Saved account preference state
    const [savedAppearance, setSavedAppearanceState] = useState('light');

    // Synchronize authenticated user identity & preference from AuthProvider
    const syncAuthUser = useCallback((user) => {
        if (user && user.id) {
            const subjectId = String(user.id);
            const userPref = isValidAppearance(user.themePreference) ? user.themePreference : 'light';
            const existingOverride = getStoredSessionOverride(subjectId);

            setAuthSubject({
                authenticated: true,
                userId: subjectId,
                savedPreference: userPref
            });
            setSavedAppearanceState(userPref);
            setSessionOverrideState(existingOverride);
        } else {
            // Anonymous / logged out
            const anonOverride = getStoredSessionOverride('anonymous');
            setAuthSubject({
                authenticated: false,
                userId: 'anonymous',
                savedPreference: 'light'
            });
            setSavedAppearanceState('light');
            setSessionOverrideState(anonOverride);
        }
    }, []);

    // Resolve effective appearance based on strict precedence:
    // sessionOverride ?? savedPreference ?? 'light'
    const resolved = useMemo(() => {
        return resolveAppearance({
            authenticated: authSubject.authenticated,
            savedPreference: authSubject.savedPreference,
            sessionOverride
        });
    }, [authSubject.authenticated, authSubject.savedPreference, sessionOverride]);

    const appearance = resolved.appearance;
    const appearanceSource = resolved.source;
    const darkMode = appearance === 'dark';

    // Apply document root classes and meta tags whenever effective appearance changes
    useEffect(() => {
        applyRootAppearance(appearance);
    }, [appearance]);

    // Load laboratory branding settings
    useEffect(() => {
        const loadSettings = async () => {
            const token = localStorage.getItem('token');
            if (!token) {
                setLoading(false);
                return;
            }

            try {
                const res = await axios.get('/api/admin/settings');
                const settings = res.data?.data || res.data;
                if (settings.branding) {
                    setTheme(prev => ({ ...prev, ...settings.branding }));
                    if (settings.branding.colors) {
                        updateCssVars(settings.branding.colors);
                    }
                }
            } catch (e) {
                if (e.response?.status !== 401 && e.response?.status !== 403) {
                    console.warn('Failed to load theme settings', e.message);
                }
            } finally {
                setLoading(false);
            }
        };
        loadSettings();
    }, []);

    const updateCssVars = (colors) => {
        const root = document.documentElement;
        if (colors.primary) root.style.setProperty('--color-primary', colors.primary);
        if (colors.secondary) root.style.setProperty('--color-secondary', colors.secondary);
    };

    // Header session appearance switch (does NOT persist to server profile)
    const setSessionAppearance = useCallback((mode) => {
        if (!isValidAppearance(mode)) return;
        setStoredSessionOverride(authSubject.userId, mode);
        setSessionOverrideState(mode);
    }, [authSubject.userId]);

    // Revert to saved profile default by clearing session override
    const clearSessionAppearance = useCallback(() => {
        clearStoredSessionOverride();
        setSessionOverrideState(null);
    }, []);

    // Toggle session appearance between light and dark
    const toggleDarkMode = useCallback(() => {
        const nextMode = appearance === 'dark' ? 'light' : 'dark';
        setSessionAppearance(nextMode);
    }, [appearance, setSessionAppearance]);

    // Set saved preference in memory (called after successful Profile API save)
    const setSavedAppearance = useCallback((mode) => {
        if (!isValidAppearance(mode)) return;
        // Clearing session override ensures saved preference immediately applies
        clearStoredSessionOverride();
        setSessionOverrideState(null);
        setSavedAppearanceState(mode);
        setAuthSubject(prev => ({
            ...prev,
            savedPreference: mode
        }));
    }, []);

    const contextValue = useMemo(() => ({
        theme,
        loading,
        darkMode,
        appearance,
        savedAppearance,
        appearanceSource,
        setSessionAppearance,
        clearSessionAppearance,
        toggleDarkMode,
        setSavedAppearance,
        syncAuthUser
    }), [
        theme,
        loading,
        darkMode,
        appearance,
        savedAppearance,
        appearanceSource,
        setSessionAppearance,
        clearSessionAppearance,
        toggleDarkMode,
        setSavedAppearance,
        syncAuthUser
    ]);

    return (
        <ThemeContext.Provider value={contextValue}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => useContext(ThemeContext);
