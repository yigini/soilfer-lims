import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { useLanguage } from './LanguageContext';
import { clearStoredSessionOverride } from '../lib/appearance';
import { clearUserHelpCache } from '../services/offline/offlineDb';

const AuthContext = createContext();

// AUTHORITATIVE PERMISSION MATRIX (Client-Side Mirror of server/middleware/authMiddleware.js)
const PERMISSIONS = {
    // Samples
    'VIEW_SAMPLES': ['SUPER_ADMIN', 'MASTER_USER', 'PROJECT_MANAGER', 'LAB_MANAGER', 'SAMPLE_RECEPTION', 'LAB_TECHNICIAN', 'SURVEYOR', 'AUDIT_USER', 'EXTERNAL_VIEWER', 'VIEWER'],
    'CREATE_SAMPLE': ['SUPER_ADMIN', 'MASTER_USER', 'PROJECT_MANAGER', 'LAB_MANAGER', 'SAMPLE_RECEPTION', 'SURVEYOR'],
    'RECEIVE_SAMPLE': ['SUPER_ADMIN', 'MASTER_USER', 'LAB_MANAGER', 'SAMPLE_RECEPTION'],
    'ASSIGN_LAB_ID': ['SUPER_ADMIN', 'MASTER_USER', 'LAB_MANAGER', 'SAMPLE_RECEPTION'],
    'CHANGE_STATUS': ['SUPER_ADMIN', 'MASTER_USER', 'LAB_MANAGER', 'SAMPLE_RECEPTION', 'LAB_TECHNICIAN'],
    'EDIT_ANALYSES': ['SUPER_ADMIN', 'MASTER_USER', 'LAB_MANAGER', 'SAMPLE_RECEPTION'],

    // Results
    'ENTER_RESULTS': ['SUPER_ADMIN', 'LAB_MANAGER', 'LAB_TECHNICIAN'],
    'APPROVE_RESULTS': ['SUPER_ADMIN', 'MASTER_USER', 'LAB_MANAGER'],
    'BATCH_APPROVAL': ['SUPER_ADMIN', 'MASTER_USER', 'LAB_MANAGER'],

    // Inventory
    'VIEW_INVENTORY': ['SUPER_ADMIN', 'MASTER_USER', 'PROJECT_MANAGER', 'LAB_MANAGER', 'SAMPLE_RECEPTION', 'LAB_TECHNICIAN', 'AUDIT_USER', 'EXTERNAL_VIEWER', 'VIEWER'],
    'CONSUME_INVENTORY': ['SUPER_ADMIN', 'LAB_MANAGER', 'LAB_TECHNICIAN'],
    'MANAGE_INVENTORY': ['SUPER_ADMIN', 'MASTER_USER', 'LAB_MANAGER'],

    // Equipment
    'VIEW_EQUIPMENT': ['SUPER_ADMIN', 'MASTER_USER', 'PROJECT_MANAGER', 'LAB_MANAGER', 'SAMPLE_RECEPTION', 'LAB_TECHNICIAN', 'AUDIT_USER', 'VIEWER'],
    'MANAGE_EQUIPMENT': ['SUPER_ADMIN', 'LAB_MANAGER'],

    // Projects
    'MANAGE_PROJECTS': ['SUPER_ADMIN', 'MASTER_USER', 'PROJECT_MANAGER', 'LAB_MANAGER'],
    'ARCHIVE_PROJECTS': ['SUPER_ADMIN', 'MASTER_USER', 'LAB_MANAGER'],

    // Users
    'MANAGE_USERS': ['SUPER_ADMIN', 'MASTER_USER', 'LAB_MANAGER'],

    // Audit & Reports
    'VIEW_AUDIT': ['SUPER_ADMIN', 'MASTER_USER', 'LAB_MANAGER', 'AUDIT_USER'],
    'GENERATE_REPORT': ['SUPER_ADMIN', 'MASTER_USER', 'PROJECT_MANAGER', 'LAB_MANAGER', 'SAMPLE_RECEPTION', 'AUDIT_USER'],

    // System
    'MANAGE_ANALYSES': ['SUPER_ADMIN', 'LAB_MANAGER', 'MASTER_USER'],
    'MANAGE_BRANDING': ['SUPER_ADMIN', 'LAB_MANAGER', 'MASTER_USER']
};

export const AuthProvider = ({ children }) => {
    const { changeLanguage } = useLanguage();
    const [token, setToken] = useState(() => {
        try {
            return localStorage.getItem('token') || null;
        } catch {
            return null;
        }
    });
    const [user, setUser] = useState(() => {
        try {
            const storedToken = localStorage.getItem('token');
            if (storedToken) {
                axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
            }
            return JSON.parse(localStorage.getItem('user')) || null;
        } catch {
            return null;
        }
    });

    // Revalidate session on mount with server (Source of Truth)
    useEffect(() => {
        const storedToken = localStorage.getItem('token');
        if (storedToken) {
            axios.get('/api/auth/me')
                .then(res => {
                    const freshUser = res.data?.data || res.data;
                    if (freshUser && freshUser.id) {
                        setUser(freshUser);
                        localStorage.setItem('user', JSON.stringify(freshUser));
                        if (freshUser.language) {
                            const sessionOverride = typeof window !== 'undefined' ? sessionStorage.getItem('soilfer_locale_override') : null;
                            if (!sessionOverride) {
                                changeLanguage(freshUser.language);
                            }
                        }
                    }
                })
                .catch(err => {
                    if (err.response?.status === 401 || err.response?.status === 403) {
                        logout();
                    }
                });
        }
    }, []);

    useEffect(() => {
        if (user && user.language) {
            const sessionOverride = typeof window !== 'undefined' ? sessionStorage.getItem('soilfer_locale_override') : null;
            if (!sessionOverride) {
                changeLanguage(user.language);
            }
        }
    }, [user?.language]);

    const login = async (username, password) => {
        try {
            const res = await axios.post('/api/auth/login', { username, password });
            const payload = res.data?.data || res.data;
            const { token: newToken, user: userData } = payload;
            localStorage.setItem('token', newToken);
            localStorage.setItem('user', JSON.stringify(userData));
            axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
            setToken(newToken);
            setUser(userData);
            return userData;
        } catch (error) {
            console.error("Login failed", error);
            throw error;
        }
    };

    const logout = () => {
        if (user?.id) {
            clearUserHelpCache({ userId: user.id }).catch(() => {});
        }
        clearStoredSessionOverride();
        try {
            sessionStorage.removeItem('soilfer_locale_override');
        } catch {}
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        delete axios.defaults.headers.common['Authorization'];
        setToken(null);
        setUser(null);
    };

    const updateUserPreferences = (preferencesOrTheme, maybeLang) => {
        setUser(prev => {
            if (!prev) return prev;
            let newTheme = prev.themePreference;
            let newLang = prev.language;

            if (typeof preferencesOrTheme === 'object' && preferencesOrTheme !== null) {
                if (preferencesOrTheme.themePreference !== undefined) newTheme = preferencesOrTheme.themePreference;
                if (preferencesOrTheme.language !== undefined) newLang = preferencesOrTheme.language;
            } else if (typeof preferencesOrTheme === 'string') {
                newTheme = preferencesOrTheme;
                if (maybeLang) newLang = maybeLang;
            }

            const updated = { ...prev, themePreference: newTheme, language: newLang };
            try {
                localStorage.setItem('user', JSON.stringify(updated));
            } catch {
                // Ignore storage error
            }
            return updated;
        });
    };

    const hasAccess = (scopeType, scopeValue) => {
        if (!user) return false;
        if (user.role === 'SUPER_ADMIN') return true;

        if (scopeType === 'country') {
            if (!user.countries || user.countries.length === 0) return true;
            return user.countries.includes(scopeValue);
        }

        if (scopeType === 'project') {
            if (!user.projects || user.projects.length === 0) return true;
            return user.projects.includes(scopeValue);
        }

        return true;
    };

    const hasPermission = (permissionKey) => {
        if (!user) return false;
        if (user.role === 'SUPER_ADMIN') return true;

        // Preferred: Direct check against server-evaluated permissions array
        if (Array.isArray(user.permissions)) {
            return user.permissions.includes(permissionKey);
        }

        // Fallback for offline cache / initial render
        const allowedRoles = PERMISSIONS[permissionKey];
        if (!allowedRoles) return false;
        return allowedRoles.includes(user.role);
    };

    return (
        <AuthContext.Provider value={{ user, token, login, logout, hasAccess, hasPermission, updateUserPreferences }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
