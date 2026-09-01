import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider } from './context/ThemeContext'
import { LanguageProvider } from './context/LanguageContext'
import { AuthProvider } from './context/AuthContext'
import { DialogProvider } from './context/DialogContext'

import axios from 'axios';
axios.defaults.baseURL = import.meta.env.DEV ? 'http://localhost:3000' : ''; // Use relative URLs in production
axios.interceptors.request.use(config => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

axios.interceptors.response.use(
    response => response,
    error => {
        if (error.response && error.response.status === 401) {
            // Ignore 401 from login or verify-token endpoints to avoid reload loops
            const isAuthEndpoint = error.config?.url?.includes('/api/auth/login');
            if (!isAuthEndpoint && localStorage.getItem('token')) {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                delete axios.defaults.headers.common['Authorization'];
                if (window.location.pathname !== '/login') {
                    window.location.href = '/login?expired=true';
                }
            }
        }
        return Promise.reject(error);
    }
);

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }
    static getDerivedStateFromError(error) { return { hasError: true, error }; }
    componentDidCatch(error, errorInfo) { console.error("Uncaught error:", error, errorInfo); }
    render() {
        if (this.state.hasError) return <div style={{ padding: 20, color: 'red' }}><h1>Something went wrong.</h1><pre>{this.state.error?.toString()}</pre></div>;
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
                            <DialogProvider>
                                <App />
                            </DialogProvider>
                        </AuthProvider>
                    </LanguageProvider>
                </ThemeProvider>
            </BrowserRouter>
        </ErrorBoundary>
    </React.StrictMode>,
)
