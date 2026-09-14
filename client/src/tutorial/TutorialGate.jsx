import React, { useState, useEffect } from 'react';

const TutorialShell = React.lazy(() => import('./TutorialShell'));

const STORAGE_KEY = 'soilfer_tutorial_v1';
const MAX_AGE_MS = 8 * 60 * 60 * 1000; // 8 hours

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
    const [mode, setMode] = useState('none'); // 'none' | 'chip' | 'full'

    useEffect(() => {
        const evaluateMode = () => {
            try {
                const search = new URLSearchParams(window.location.search);
                const tutorialMode = search.get('tutorialmode');

                if (tutorialMode === 'false') {
                    sessionStorage.removeItem(STORAGE_KEY);
                    setMode('none');
                    return;
                }

                if (tutorialMode === 'true') {
                    setMode('full');
                    return;
                }

                // If no tutorialmode query parameter, inspect session
                const raw = sessionStorage.getItem(STORAGE_KEY);
                if (raw) {
                    const parsed = JSON.parse(raw);
                    if (parsed && parsed.active && (Date.now() - (parsed.timestamp || 0) < MAX_AGE_MS)) {
                        // Unflagged document load with existing session shows Resume invitation chip,
                        // never an unsolicited full overlay
                        setMode('chip');
                        return;
                    } else {
                        sessionStorage.removeItem(STORAGE_KEY);
                    }
                }
            } catch {
                try { sessionStorage.removeItem(STORAGE_KEY); } catch {}
            }
            setMode('none');
        };

        evaluateMode();

        // Custom event so same-document navigations or exits can update the gate immediately
        const handleCustomUpdate = () => evaluateMode();

        window.addEventListener('popstate', evaluateMode);
        window.addEventListener('hashchange', evaluateMode);
        window.addEventListener('soilfer_tutorial_update', handleCustomUpdate);

        return () => {
            window.removeEventListener('popstate', evaluateMode);
            window.removeEventListener('hashchange', evaluateMode);
            window.removeEventListener('soilfer_tutorial_update', handleCustomUpdate);
        };
    }, []);

    const handleResume = () => {
        try {
            const raw = sessionStorage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                parsed.paused = false;
                sessionStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
            }
        } catch {}
        setMode('full');
    };

    if (mode === 'none') {
        return null; // Zero lazy chunk loaded for ordinary visits
    }

    if (mode === 'chip') {
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
                    Resume guide →
                </button>
            </div>
        );
    }

    return (
        <TutorialErrorBoundary>
            <React.Suspense fallback={null}>
                <TutorialShell
                    onExit={() => setMode('none')}
                />
            </React.Suspense>
        </TutorialErrorBoundary>
    );
}
