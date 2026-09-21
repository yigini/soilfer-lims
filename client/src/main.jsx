import React from 'react'
import ReactDOM from 'react-dom/client'
import * as ReactRouterDOM from 'react-router-dom'
const { BrowserRouter } = ReactRouterDOM
import App from './App.jsx'
import './index.css'
import { ThemeProvider } from './context/ThemeContext'
import { LanguageProvider } from './context/LanguageContext'
import { NotificationContext } from './context/NotificationContext'
import { AuthProvider } from './context/AuthContext'
import { DialogProvider } from './context/DialogContext'
import { AnalysisCatalogueProvider } from './context/AnalysisCatalogueContext'

import { clearStoredSessionOverride } from './lib/appearance';
import { AuthenticatedAppearanceBridge } from './components/AuthenticatedAppearanceBridge';

import axios from 'axios';
axios.defaults.baseURL = import.meta.env.DEV ? 'http://localhost:3000' : ''; // Use relative URLs in production
axios.interceptors.request.use(config => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

let isHandlingSessionExpiry = false;

axios.interceptors.response.use(
    response => response,
    error => {
        if (error.response && error.response.status === 401) {
            const reqUrl = error.config?.url || '';
            // Ignore 401 from login or register endpoints to avoid reload loops
            const isAuthEndpoint = reqUrl.includes('/api/auth/login') || reqUrl.includes('/api/auth/register');
            if (!isAuthEndpoint) {
                // Determine token used for this specific failing request
                const reqAuthHeader = error.config?.headers?.Authorization || error.config?.headers?.authorization;
                const requestToken = reqAuthHeader
                    ? (typeof reqAuthHeader === 'string' && reqAuthHeader.startsWith('Bearer ') ? reqAuthHeader.slice(7).trim() : null)
                    : null;
                const currentToken = localStorage.getItem('token');

                // Issue #111 Guard: If user has already logged in with a newer token,
                // do NOT allow a delayed 401 from an older request to wipe out the new active session!
                if (requestToken && currentToken && requestToken !== currentToken) {
                    console.warn('[AUTH] Ignored 401 from stale request with superseded token');
                    return Promise.reject(error);
                }

                if (currentToken && !isHandlingSessionExpiry) {
                    isHandlingSessionExpiry = true;
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    clearStoredSessionOverride();
                    delete axios.defaults.headers.common['Authorization'];
                    if (window.location.pathname !== '/login') {
                        window.location.href = '/login?expired=true';
                    } else {
                        isHandlingSessionExpiry = false;
                    }
                }
            }
        }
        return Promise.reject(error);
    }
);

// Automatically recover from stale chunks after a deployment or intermittent network drops
window.addEventListener('vite:preloadError', (event) => {
    const reloadKey = 'sf_chunk_reload_ts';
    const lastReload = sessionStorage.getItem(reloadKey);
    const now = Date.now();
    // Guard against reload loops: allow reload once per 15 seconds
    if (!lastReload || now - parseInt(lastReload, 10) > 15000) {
        sessionStorage.setItem(reloadKey, now.toString());
        window.location.reload();
    }
});

const isChunkLoadError = (error) => {
    if (!error) return false;
    const msg = (error.message || error.toString()).toLowerCase();
    return (
        msg.includes('failed to fetch dynamically imported module') ||
        msg.includes('importing a module script failed') ||
        msg.includes('error loading dynamically imported module') ||
        msg.includes('loading chunk') ||
        msg.includes('dynamically imported module')
    );
};

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, isChunkError: false };
    }
    static getDerivedStateFromError(error) {
        return {
            hasError: true,
            error,
            isChunkError: isChunkLoadError(error)
        };
    }
    componentDidCatch(error, errorInfo) {
        console.error("Uncaught application error:", error, errorInfo);
        if (isChunkLoadError(error)) {
            const reloadKey = 'sf_chunk_reload_ts';
            const lastReload = sessionStorage.getItem(reloadKey);
            const now = Date.now();
            if (!lastReload || now - parseInt(lastReload, 10) > 15000) {
                sessionStorage.setItem(reloadKey, now.toString());
                window.location.reload();
            }
        }
    }
    render() {
        if (this.state.hasError) {
            if (this.state.isChunkError) {
                return (
                    <div style={{
                        minHeight: '100vh',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: '#F5F3ED',
                        padding: 24,
                        fontFamily: 'Inter, system-ui, sans-serif'
                    }}>
                        <div style={{
                            maxWidth: 440,
                            width: '100%',
                            backgroundColor: '#FFFFFF',
                            borderRadius: 12,
                            padding: '32px 24px',
                            boxShadow: '0 4px 20px rgba(23,63,50,0.08)',
                            textAlign: 'center',
                            border: '1px solid #E5E7EB'
                        }}>
                            <div style={{
                                width: 52,
                                height: 52,
                                margin: '0 auto 16px',
                                borderRadius: '50%',
                                backgroundColor: '#E4F1F3',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#173F32',
                                fontSize: 24
                            }}>
                                ⟳
                            </div>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#173F32', marginBottom: 8 }}>
                                System Update Ready
                            </h2>
                            <p style={{ fontSize: '0.875rem', color: '#4B5563', lineHeight: 1.5, marginBottom: 24 }}>
                                A new version of SoilFER LIMS was deployed. Please refresh to load the latest modules.
                            </p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                <button
                                    onClick={() => {
                                        sessionStorage.setItem('sf_chunk_reload_ts', Date.now().toString());
                                        window.location.reload();
                                    }}
                                    style={{
                                        width: '100%',
                                        padding: '12px 16px',
                                        backgroundColor: '#173F32',
                                        color: '#FFFFFF',
                                        border: 'none',
                                        borderRadius: 8,
                                        fontWeight: 600,
                                        fontSize: '0.925rem',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Refresh Application
                                </button>
                                <button
                                    onClick={() => { window.location.href = '/'; }}
                                    style={{
                                        width: '100%',
                                        padding: '10px 16px',
                                        backgroundColor: 'transparent',
                                        color: '#4B5563',
                                        border: '1px solid #D1D5DB',
                                        borderRadius: 8,
                                        fontWeight: 500,
                                        fontSize: '0.875rem',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Return to Dashboard
                                </button>
                            </div>
                        </div>
                    </div>
                );
            }

            return (
                <div style={{
                    minHeight: '100vh',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#F5F3ED',
                    padding: 24,
                    fontFamily: 'Inter, system-ui, sans-serif'
                }}>
                    <div style={{
                        maxWidth: 520,
                        width: '100%',
                        backgroundColor: '#FFFFFF',
                        borderRadius: 12,
                        padding: '32px 24px',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
                        border: '1px solid #E5E7EB'
                    }}>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#945539', marginBottom: 8 }}>
                            Application Error
                        </h2>
                        <p style={{ fontSize: '0.875rem', color: '#4B5563', lineHeight: 1.5, marginBottom: 20 }}>
                            An unexpected issue occurred while rendering this view.
                        </p>
                        <pre style={{
                            fontSize: '0.75rem',
                            backgroundColor: '#F9FAFB',
                            padding: 12,
                            borderRadius: 6,
                            overflowX: 'auto',
                            color: '#DC2626',
                            border: '1px solid #F3F4F6',
                            marginBottom: 20
                        }}>
                            {this.state.error?.toString()}
                        </pre>
                        <button
                            onClick={() => window.location.reload()}
                            style={{
                                width: '100%',
                                padding: '12px 16px',
                                backgroundColor: '#173F32',
                                color: '#FFFFFF',
                                border: 'none',
                                borderRadius: 8,
                                fontWeight: 600,
                                cursor: 'pointer'
                            }}
                        >
                            Reload Application
                        </button>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <ErrorBoundary>
            <BrowserRouter>
                <ThemeProvider>
                    <LanguageProvider>
                        <AuthProvider>
                            <AuthenticatedAppearanceBridge />
                            <AnalysisCatalogueProvider>
                            <DialogProvider>
                                <App />
                            </DialogProvider>
                            </AnalysisCatalogueProvider>
                        </AuthProvider>
                    </LanguageProvider>
                </ThemeProvider>
            </BrowserRouter>
        </ErrorBoundary>
    </React.StrictMode>,
)
