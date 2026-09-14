import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { STORAGE_KEY, getStoredSession, isSessionExpired } from './useTutorialSession';

const TutorialShell = React.lazy(() => import('./TutorialShell'));

class TutorialErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        console.error('Tutorial Error Boundary caught an error:', error, errorInfo);
        try {
            sessionStorage.removeItem(STORAGE_KEY);
        } catch {}
    }

    render() {
        if (this.state.hasError) {
            return null; // Gracefully unmount without crashing the main application
        }
        return this.props.children;
    }
}

export default function TutorialGate() {
    const location = useLocation();
    const navigate = useNavigate();
    const { locale } = useLanguage();
    const [mode, setMode] = useState('none'); // 'none' | 'chip' | 'full'
    const isSameDocumentActiveRef = useRef(false);

    useEffect(() => {
        const search = new URLSearchParams(location.search);
        const tutorialMode = search.get('tutorialmode');

        if (tutorialMode === 'false') {
            try { sessionStorage.removeItem(STORAGE_KEY); } catch {}
            isSameDocumentActiveRef.current = false;
            setMode('none');
            return;
        }

        if (tutorialMode === 'true') {
            const stored = getStoredSession();
            if (stored && isSessionExpired(stored)) {
                try { sessionStorage.removeItem(STORAGE_KEY); } catch {}
                isSameDocumentActiveRef.current = false;
                setMode('none');
                return;
            }
            isSameDocumentActiveRef.current = true;
            setMode('full');
            return;
        }

        // No tutorialmode parameter in URL
        // If this is a same-document SPA navigation and the guide was active in this session:
        if (isSameDocumentActiveRef.current) {
            const stored = getStoredSession();
            if (stored && stored.active && !stored.paused && !isSessionExpired(stored)) {
                setMode('full');
                return;
            }
        }

        // Otherwise, it is an unflagged document visit. Inspect session:
        const stored = getStoredSession();
        if (stored && stored.active && !isSessionExpired(stored)) {
            // Unflagged document load with existing active session shows Resume invitation chip,
            // never an unsolicited full overlay
            setMode('chip');
        } else {
            setMode('none');
        }
    }, [location.pathname, location.search]);

    const handleResume = () => {
        const stored = getStoredSession();
        if (!stored || isSessionExpired(stored)) {
            try { sessionStorage.removeItem(STORAGE_KEY); } catch {}
            setMode('none');
            return;
        }
        stored.paused = false;
        stored.lastActivityAt = Date.now();
        try {
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
        } catch {}
        isSameDocumentActiveRef.current = true;
        setMode('full');

        // Add tutorialmode=true to current URL
        const params = new URLSearchParams(location.search);
        params.set('tutorialmode', 'true');
        navigate(`${location.pathname}?${params.toString()}`, { replace: true });
    };

    const handleExit = () => {
        try { sessionStorage.removeItem(STORAGE_KEY); } catch {}
        isSameDocumentActiveRef.current = false;
        setMode('none');
        const params = new URLSearchParams(location.search);
        params.delete('tutorialmode');
        params.delete('tour');
        const qs = params.toString();
        const nextUrl = location.pathname + (qs ? `?${qs}` : '') + location.hash;
        navigate(nextUrl, { replace: true });
    };

    if (mode === 'none') {
        return null; // Zero lazy chunk loaded for ordinary visits
    }

    if (mode === 'chip') {
        const resumeLabels = {
            en: 'Resume guide →',
            es: 'Reanudar guía →',
            'es-419': 'Reanudar guía →',
            fr: 'Reprendre le guide →',
            pt: 'Retomar guia →'
        };
        const stored = getStoredSession();
        const activeLang = stored?.language || locale;
        const label = resumeLabels[activeLang] || resumeLabels.en;

        return (
            <div data-sf-tutorial="root">
                <button
                    type="button"
                    id="resume"
                    style={{
                        position: 'fixed',
                        bottom: '20px',
                        right: '20px',
                        zIndex: 8500,
                        background: '#245942',
                        color: 'white',
                        border: '2px solid #fff',
                        borderRadius: '24px',
                        padding: '10px 18px',
                        fontSize: '13px',
                        fontWeight: 700,
                        boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        cursor: 'pointer'
                    }}
                    onClick={handleResume}
                >
                    {label}
                </button>
            </div>
        );
    }

    return (
        <TutorialErrorBoundary>
            <React.Suspense fallback={null}>
                <TutorialShell
                    onExit={handleExit}
                />
            </React.Suspense>
        </TutorialErrorBoundary>
    );
}
