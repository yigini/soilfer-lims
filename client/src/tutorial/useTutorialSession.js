import { useState, useEffect, useCallback, useMemo } from 'react';
import { normalizeLocale } from '../lib/localeResolver';

export const STORAGE_KEY = 'soilfer_tutorial_v1';
export const MAX_AGE_MS = 8 * 60 * 60 * 1000; // 8 hours

export const PATH_STOPS = {
    full: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    quick: [0, 1, 2, 3, 5, 7, 9, 10, 11],
    role_reception: [0, 1, 2, 3, 11],
    role_technician: [0, 1, 4, 5, 6, 7, 11],
    role_manager: [0, 1, 8, 9, 10, 11],
    role_coordinator: [0, 1, 2, 9, 10, 11],
    role_viewer: [0, 1, 9, 10, 11]
};

const DEFAULT_PRACTICE_BY_TUBE = {
    1: { intakeMass: '485.2', condition: 'intact', checks: [false, false, false], benchValue: '6.85', texture: [35, 35, 30], spectrumLoaded: false, reviewReason: '' },
    2: { intakeMass: '', condition: 'intact', checks: [false, false, false], benchValue: '', texture: ['', '', ''], spectrumLoaded: false, reviewReason: '' },
    3: { intakeMass: '', condition: 'intact', checks: [false, false, false], benchValue: '', texture: ['', '', ''], spectrumLoaded: false, reviewReason: '' },
    4: { intakeMass: '', condition: 'intact', checks: [false, false, false], benchValue: '', texture: ['', '', ''], spectrumLoaded: false, reviewReason: '' },
    5: { intakeMass: '', condition: 'intact', checks: [false, false, false], benchValue: '', texture: ['', '', ''], spectrumLoaded: false, reviewReason: '' }
};

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

function resolveInitialLocale() {
    try {
        const search = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
        const langParam = search ? search.get('lang') : null;
        if (langParam) return normalizeLocale(langParam);

        const appLang = typeof localStorage !== 'undefined' ? localStorage.getItem('language') : null;
        if (appLang) return normalizeLocale(appLang);
    } catch {}
    return 'en';
}

export function useTutorialSession(onExitCallback, onPauseCallback) {
    const [state, setState] = useState(() => {
        const saved = getInitialSession();
        const search = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
        const tutorialModeParam = search ? search.get('tutorialmode') : null;

        const isOptInUrl = tutorialModeParam === 'true';
        const isExplicitDisable = tutorialModeParam === 'false';

        if (isExplicitDisable) {
            try { sessionStorage.removeItem(STORAGE_KEY); } catch {}
            return {
                active: false,
                step: 0,
                introStage: 0,
                path: 'full',
                roleChoice: 'reception',
                sampleTube: 1,
                done: [],
                skipped: [],
                paused: false,
                language: 'en',
                practiceByTube: DEFAULT_PRACTICE_BY_TUBE,
                f03Search: '',
                f03Filter: 'all',
                f03SelectedId: null,
                equipmentStatus: 'ready',
                inventoryLot: 'LOT-2026-08',
                timestamp: Date.now()
            };
        }

        const initialLanguage = resolveInitialLocale();

        return {
            active: isOptInUrl || Boolean(saved && saved.active),
            step: saved?.step ?? 0,
            introStage: saved?.introStage ?? 0,
            path: saved?.path ?? 'full',
            roleChoice: saved?.roleChoice ?? 'reception',
            sampleTube: saved?.sampleTube ?? 1,
            done: saved?.done ?? [],
            skipped: saved?.skipped ?? [],
            paused: isOptInUrl ? false : (saved?.paused ?? false),
            language: saved?.language ? normalizeLocale(saved.language) : initialLanguage,
            practiceByTube: saved?.practiceByTube ?? DEFAULT_PRACTICE_BY_TUBE,
            f03Search: saved?.f03Search ?? '',
            f03Filter: saved?.f03Filter ?? 'all',
            f03SelectedId: saved?.f03SelectedId ?? null,
            equipmentStatus: saved?.equipmentStatus ?? 'ready',
            inventoryLot: saved?.inventoryLot ?? 'LOT-2026-08',
            timestamp: Date.now()
        };
    });

    // Save session state to sessionStorage
    useEffect(() => {
        if (!state.active) {
            try { sessionStorage.removeItem(STORAGE_KEY); } catch {}
            return;
        }
        try {
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, timestamp: Date.now() }));
        } catch {}
    }, [state]);

    // Active path stops
    const activeStops = useMemo(() => {
        if (state.path === 'quick') return PATH_STOPS.quick;
        if (state.path === 'role') {
            const roleKey = `role_${state.roleChoice}`;
            return PATH_STOPS[roleKey] || PATH_STOPS.full;
        }
        return PATH_STOPS.full;
    }, [state.path, state.roleChoice]);

    const setStep = useCallback((step) => {
        setState(prev => ({ ...prev, step }));
    }, []);

    const setIntroStage = useCallback((introStage) => {
        setState(prev => ({ ...prev, introStage }));
    }, []);

    const setPath = useCallback((path) => {
        setState(prev => ({ ...prev, path }));
    }, []);

    const setRoleChoice = useCallback((roleChoice) => {
        setState(prev => ({ ...prev, roleChoice }));
    }, []);

    const setSampleTube = useCallback((sampleTube) => {
        setState(prev => ({ ...prev, sampleTube }));
    }, []);

    const setLanguage = useCallback((lang) => {
        const normalized = normalizeLocale(lang);
        setState(prev => ({ ...prev, language: normalized }));
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

    const nextStep = useCallback(() => {
        setState(prev => {
            // If in foundation
            if (prev.step === 0 && prev.introStage < 3) {
                return { ...prev, introStage: prev.introStage + 1 };
            }

            const doneSet = new Set(prev.done);
            doneSet.add(prev.step);

            const stops = activeStops;
            const currentIndex = stops.indexOf(prev.step);
            let nextChapter = prev.step + 1;

            if (currentIndex !== -1 && currentIndex < stops.length - 1) {
                nextChapter = stops[currentIndex + 1];
            } else if (prev.step >= 11) {
                // Restart to beginning
                return { ...prev, step: 0, introStage: 0, done: Array.from(doneSet) };
            }

            return {
                ...prev,
                step: Math.min(11, nextChapter),
                done: Array.from(doneSet)
            };
        });
    }, [activeStops]);

    const prevStep = useCallback(() => {
        setState(prev => {
            if (prev.step === 0 && prev.introStage > 0) {
                return { ...prev, introStage: prev.introStage - 1 };
            }
            const stops = activeStops;
            const currentIndex = stops.indexOf(prev.step);
            if (currentIndex > 0) {
                return { ...prev, step: stops[currentIndex - 1] };
            }
            return { ...prev, step: Math.max(0, prev.step - 1) };
        });
    }, [activeStops]);

    const skipLesson = useCallback(() => {
        setState(prev => {
            if (prev.step === 0 && prev.introStage < 3) {
                return { ...prev, introStage: 3 }; // Jump straight to path selection
            }
            const skippedSet = new Set(prev.skipped);
            skippedSet.add(prev.step);

            const stops = activeStops;
            const currentIndex = stops.indexOf(prev.step);
            let nextChapter = prev.step + 1;
            if (currentIndex !== -1 && currentIndex < stops.length - 1) {
                nextChapter = stops[currentIndex + 1];
            }

            return {
                ...prev,
                step: Math.min(11, nextChapter),
                skipped: Array.from(skippedSet)
            };
        });
    }, [activeStops]);

    const updatePractice = useCallback((field, value) => {
        setState(prev => {
            const tube = prev.sampleTube || 1;
            const currentTubePractice = prev.practiceByTube[tube] || DEFAULT_PRACTICE_BY_TUBE[tube];
            return {
                ...prev,
                practiceByTube: {
                    ...prev.practiceByTube,
                    [tube]: {
                        ...currentTubePractice,
                        [field]: value
                    }
                }
            };
        });
    }, []);

    const updateF03 = useCallback((field, value) => {
        setState(prev => ({ ...prev, [field]: value }));
    }, []);

    const pause = useCallback(() => {
        setState(prev => {
            const updated = { ...prev, paused: true };
            try {
                sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...updated, timestamp: Date.now() }));
            } catch {}
            return updated;
        });
    }, []);

    const resume = useCallback(() => {
        setState(prev => {
            const updated = { ...prev, paused: false };
            try {
                sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...updated, timestamp: Date.now() }));
            } catch {}
            return updated;
        });
    }, []);

    const exitTutorial = useCallback(() => {
        try {
            sessionStorage.removeItem(STORAGE_KEY);
        } catch {}

        if (typeof window !== 'undefined' && window.history && window.location) {
            const url = new URL(window.location.href);
            url.searchParams.delete('tutorialmode');
            url.searchParams.delete('tour');
            url.searchParams.delete('lang');
            window.history.replaceState({}, '', url.pathname + (url.search ? url.search : '') + url.hash);
        }

        setState(prev => ({ ...prev, active: false }));

        if (typeof onExitCallback === 'function') {
            onExitCallback();
        }
        window.dispatchEvent(new Event('soilfer_tutorial_update'));
    }, [onExitCallback]);

    return {
        state,
        activeStops,
        setStep,
        setIntroStage,
        setPath,
        setRoleChoice,
        setSampleTube,
        setLanguage,
        markDone,
        markSkipped,
        nextStep,
        prevStep,
        skipLesson,
        updatePractice,
        updateF03,
        pause,
        resume,
        exitTutorial
    };
}
