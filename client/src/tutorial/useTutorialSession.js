import { useState, useEffect, useCallback } from 'react';
import { normalizeLocale } from '../lib/localeResolver';

const STORAGE_KEY = 'soilfer_tutorial_v1';
const MAX_AGE_MS = 8 * 60 * 60 * 1000; // 8 hours

function getInitialSession() {
    try {
        const raw = sessionStorage.getItem(STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Date.now() - (parsed.timestamp || 0) < MAX_AGE_MS) {
                return parsed;
            }
        }
    } catch {}
    return null;
}

export function useTutorialSession() {
    const [state, setState] = useState(() => {
        const saved = getInitialSession();
        const search = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
        const tutorialModeParam = search ? search.get('tutorialmode') : null;
        const langParam = search ? search.get('lang') : null;

        const isOptInUrl = tutorialModeParam === 'true';
        const isExplicitDisable = tutorialModeParam === 'false';

        if (isExplicitDisable) {
            try { sessionStorage.removeItem(STORAGE_KEY); } catch {}
            return { active: false };
        }

        if (isOptInUrl || (saved && saved.active)) {
            return {
                active: true,
                step: saved?.step ?? 0,
                introStage: saved?.introStage ?? 0,
                path: saved?.path ?? 'full',
                sampleTube: saved?.sampleTube ?? 1,
                roleChoice: saved?.roleChoice ?? 'reception',
                done: saved?.done ?? [],
                skipped: saved?.skipped ?? [],
                paused: saved?.paused ?? false,
                language: normalizeLocale(langParam || saved?.language || 'en'),
                // Practice states
                intakeMass: saved?.intakeMass ?? '485.2',
                condition: saved?.condition ?? 'intact',
                checks: saved?.checks ?? [false, false, false],
                benchValue: saved?.benchValue ?? '6.85',
                texture: saved?.texture ?? [35, 35, 30],
                spectrumLoaded: saved?.spectrumLoaded ?? false,
                reviewReason: saved?.reviewReason ?? '',
                timestamp: Date.now()
            };
        }

        return { active: false };
    });

    useEffect(() => {
        if (!state.active) {
            try { sessionStorage.removeItem(STORAGE_KEY); } catch {}
            return;
        }
        try {
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, timestamp: Date.now() }));
        } catch {}
    }, [state]);

    const setStep = useCallback((step) => {
        setState(prev => ({ ...prev, step }));
    }, []);

    const setIntroStage = useCallback((introStage) => {
        setState(prev => ({ ...prev, introStage }));
    }, []);

    const setPath = useCallback((path) => {
        setState(prev => ({ ...prev, path }));
    }, []);

    const setSampleTube = useCallback((sampleTube) => {
        setState(prev => ({ ...prev, sampleTube }));
    }, []);

    const setRoleChoice = useCallback((roleChoice) => {
        setState(prev => ({ ...prev, roleChoice }));
    }, []);

    const setLanguage = useCallback((language) => {
        setState(prev => ({ ...prev, language: normalizeLocale(language) }));
    }, []);

    const markDone = useCallback((stepIndex) => {
        setState(prev => {
            const doneSet = new Set(prev.done);
            doneSet.add(stepIndex);
            return { ...prev, done: Array.from(doneSet) };
        });
    }, []);

    const markSkipped = useCallback((stepIndex) => {
        setState(prev => {
            const skippedSet = new Set(prev.skipped);
            skippedSet.add(stepIndex);
            return { ...prev, skipped: Array.from(skippedSet) };
        });
    }, []);

    const pause = useCallback(() => {
        setState(prev => ({ ...prev, paused: true }));
    }, []);

    const resume = useCallback(() => {
        setState(prev => ({ ...prev, paused: false }));
    }, []);

    const updatePractice = useCallback((field, value) => {
        setState(prev => ({ ...prev, [field]: value }));
    }, []);

    const exitTutorial = useCallback(() => {
        try { sessionStorage.removeItem(STORAGE_KEY); } catch {}
        // Remove tutorial params from current URL without reload
        if (typeof window !== 'undefined' && window.history && window.location) {
            const url = new URL(window.location.href);
            url.searchParams.delete('tutorialmode');
            url.searchParams.delete('tour');
            window.history.replaceState({}, '', url.pathname + (url.search ? url.search : '') + url.hash);
        }
        setState({ active: false });
    }, []);

    return {
        state,
        setStep,
        setIntroStage,
        setPath,
        setSampleTube,
        setRoleChoice,
        setLanguage,
        markDone,
        markSkipped,
        pause,
        resume,
        updatePractice,
        exitTutorial
    };
}
