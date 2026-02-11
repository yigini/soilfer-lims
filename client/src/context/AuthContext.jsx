import React, { createContext, useContext, useState } from 'react';
import axios from 'axios';

const AuthContext = createContext();

// AUTHORITATIVE PERMISSION MATRIX (Client-Side Mirror of server/middleware/authMiddleware.js)
const PERMISSIONS = {
    // Samples
    'VIEW_SAMPLES': ['SUPER_ADMIN', 'MASTER_USER', 'PROJECT_MANAGER', 'LAB_MANAGER', 'SAMPLE_RECEPTION', 'LAB_TECHNICIAN', 'SURVEYOR', 'VIEWER'],
    'CREATE_SAMPLE': ['SUPER_ADMIN', 'MASTER_USER', 'PROJECT_MANAGER', 'LAB_MANAGER', 'SAMPLE_RECEPTION', 'SURVEYOR'],
    'RECEIVE_SAMPLE': ['SUPER_ADMIN', 'MASTER_USER', 'LAB_MANAGER', 'SAMPLE_RECEPTION'],
    'ASSIGN_LAB_ID': ['SUPER_ADMIN', 'MASTER_USER', 'LAB_MANAGER', 'SAMPLE_RECEPTION'],
    'CHANGE_STATUS': ['SUPER_ADMIN', 'MASTER_USER', 'LAB_MANAGER', 'SAMPLE_RECEPTION', 'LAB_TECHNICIAN'],

    // Results
    'ENTER_RESULTS': ['SUPER_ADMIN', 'LAB_MANAGER', 'LAB_TECHNICIAN'],
    'APPROVE_RESULTS': ['SUPER_ADMIN', 'LAB_MANAGER'],
    'BATCH_APPROVAL': ['SUPER_ADMIN', 'LAB_MANAGER'],

    // Inventory
    'VIEW_INVENTORY': ['SUPER_ADMIN', 'MASTER_USER', 'PROJECT_MANAGER', 'LAB_MANAGER', 'SAMPLE_RECEPTION', 'LAB_TECHNICIAN', 'VIEWER'],
    'CONSUME_INVENTORY': ['SUPER_ADMIN', 'LAB_MANAGER', 'LAB_TECHNICIAN'],
    'MANAGE_INVENTORY': ['SUPER_ADMIN', 'MASTER_USER', 'LAB_MANAGER'],

    // Projects
    'MANAGE_PROJECTS': ['SUPER_ADMIN', 'MASTER_USER', 'PROJECT_MANAGER', 'LAB_MANAGER'],
    'ARCHIVE_PROJECTS': ['SUPER_ADMIN', 'MASTER_USER', 'LAB_MANAGER'],

    // Users
    'MANAGE_USERS': ['SUPER_ADMIN', 'MASTER_USER', 'LAB_MANAGER'],

    // System
    'MANAGE_ANALYSES': ['SUPER_ADMIN', 'LAB_MANAGER', 'MASTER_USER'],
    'MANAGE_EQUIPMENT': ['SUPER_ADMIN', 'LAB_MANAGER'],
    'MANAGE_BRANDING': ['SUPER_ADMIN', 'LAB_MANAGER']
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(() => {
        try {
            const token = localStorage.getItem('token');
            if (token) {
                axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
            }
            return JSON.parse(localStorage.getItem('user')) || null;
        } catch {
            return null;
        }
    });

    const login = async (username, password) => {
        try {
            const res = await axios.post('/api/auth/login', { username, password });
            const { token, user: userData } = res.data;
            localStorage.setItem('token', token);
            localStorage.setItem('user', JSON.stringify(userData));
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
            setUser(userData);
            return userData;
        } catch (error) {
            console.error("Login failed", error);
            throw error;
        }
    };

    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        delete axios.defaults.headers.common['Authorization'];
        setUser(null);
        window.location.href = '/login';
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
        const allowedRoles = PERMISSIONS[permissionKey];
        if (!allowedRoles) return false;
        return allowedRoles.includes(user.role);
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, hasAccess, hasPermission }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
