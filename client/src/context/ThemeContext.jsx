import React, { createContext, useContext, useEffect, useState } from 'react';
import axios from 'axios';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
    // Branding theme (colors, title, etc.)
    const [theme, setTheme] = useState({
        colors: {
            primary: '#047857',
            secondary: '#111827',
            accent: '#D97706'
        },
        title: 'SoilFER LIMS',
        logoUrl: '/assets/img/soilfer-logo.png'
    });

    // Dark mode state
    const [darkMode, setDarkMode] = useState(() => {
        // Check localStorage first
        const saved = localStorage.getItem('darkMode');
        if (saved !== null) {
            return saved === 'true';
        }
        // Fall back to OS preference
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
    });

    const [loading, setLoading] = useState(true);

    // Load branding settings from backend
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
                    setTheme({ ...theme, ...settings.branding });
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

    // Apply dark mode class to document root
    useEffect(() => {
        const root = window.document.documentElement;
        if (darkMode) {
            root.classList.add('dark');
        } else {
            root.classList.remove('dark');
        }
        localStorage.setItem('darkMode', darkMode);
    }, [darkMode]);

    // Listen for OS preference changes
    useEffect(() => {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleChange = (e) => {
            // Only auto-switch if user hasn't manually set preference
            if (localStorage.getItem('darkMode') === null) {
                setDarkMode(e.matches);
            }
        };

        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, []);

    const updateCssVars = (colors) => {
        const root = document.documentElement;
        root.style.setProperty('--color-primary', colors.primary);
        root.style.setProperty('--color-secondary', colors.secondary);
    };

    const toggleDarkMode = () => {
        setDarkMode(prev => !prev);
    };

    return (
        <ThemeContext.Provider value={{ theme, loading, darkMode, toggleDarkMode }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => useContext(ThemeContext);
