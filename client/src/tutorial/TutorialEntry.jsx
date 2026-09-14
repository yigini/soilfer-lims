import React, { useState, useEffect } from 'react';

const TutorialShell = React.lazy(() => import('./TutorialShell'));

class TutorialErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        console.error('Tutorial Error Boundary caught an error:', error, errorInfo);
        try {
            sessionStorage.removeItem('soilfer_tutorial_v1');
        } catch {}
    }

    render() {
        if (this.state.hasError) {
            return null; // Gracefully unmount without crashing the main application
        }
        return this.props.children;
    }
}

export default function TutorialEntry() {
    const [shouldMount, setShouldMount] = useState(false);

    useEffect(() => {
        const checkTutorialMode = () => {
            try {
                const search = new URLSearchParams(window.location.search);
                const tutorialMode = search.get('tutorialmode');
                if (tutorialMode === 'false') {
                    sessionStorage.removeItem('soilfer_tutorial_v1');
                    setShouldMount(false);
                    return;
                }

                if (tutorialMode === 'true') {
                    setShouldMount(true);
                    return;
                }

                const saved = sessionStorage.getItem('soilfer_tutorial_v1');
                if (saved) {
                    const parsed = JSON.parse(saved);
                    if (parsed && parsed.active) {
                        setShouldMount(true);
                        return;
                    }
                }
            } catch {}
            setShouldMount(false);
        };

        checkTutorialMode();

        // Listen to popstate in case SPA navigation or history changes update the URL query
        window.addEventListener('popstate', checkTutorialMode);
        return () => window.removeEventListener('popstate', checkTutorialMode);
    }, []);

    if (!shouldMount) return null;

    return (
        <TutorialErrorBoundary>
            <React.Suspense fallback={null}>
                <TutorialShell />
            </React.Suspense>
        </TutorialErrorBoundary>
    );
}
