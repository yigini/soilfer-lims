import { useState, useEffect, useCallback, useMemo } from 'react';
import { normalizeLocale, resolveLocale } from '../lib/localeResolver';

export const STORAGE_KEY = 'soilfer_tutorial_v1';
export const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours maximum lifetime

export const PATH_STOPS = {
    full: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    quick: [0, 1, 2, 3, 8, 9, 12, 15],
    role_reception: [0, 1, 2, 3, 4, 15],
    role_technician: [0, 1, 5, 6, 7, 8, 9, 10, 11, 15],
    role_manager: [0, 1, 5, 12, 13, 14, 15],
    role_coordinator: [0, 1, 2, 5, 13, 14, 15],
    role_viewer: [0, 1, 13, 14, 15]
};

const DEFAULT_PRACTICE_BY_TUBE = {
    1: { intakeMass: '485.2', condition: 'intact', intakeStatusCode: 'initial', checks: [false, false, false], prepVerified: false, benchValue: '6.85', benchStatusCode: 'initial', texture: [35, 35, 30], spectrumLoaded: false, reviewReason: '', reviewSubmitted: false },
    2: { intakeMass: '', condition: 'intact', intakeStatusCode: 'initial', checks: [false, false, false], prepVerified: false, benchValue: '', benchStatusCode: 'initial', texture: ['', '', ''], spectrumLoaded: false, reviewReason: '', reviewSubmitted: false },
    3: { intakeMass: '', condition: 'intact', intakeStatusCode: 'initial', checks: [false, false, false], prepVerified: false, benchValue: '', benchStatusCode: 'initial', texture: ['', '', ''], spectrumLoaded: false, reviewReason: '', reviewSubmitted: false },
    4: { intakeMass: '', condition: 'intact', intakeStatusCode: 'initial', checks: [false, false, false], prepVerified: false, benchValue: '', benchStatusCode: 'initial', texture: ['', '', ''], spectrumLoaded: false, reviewReason: '', reviewSubmitted: false },
    5: { intakeMass: '', condition: 'intact', intakeStatusCode: 'initial', checks: [false, false, false], prepVerified: false, benchValue: '', benchStatusCode: 'initial', texture: ['', '', ''], spectrumLoaded: false, reviewReason: '', reviewSubmitted: false }
};

export function isSessionExpired(session) {
    if (!session) return true;
    const activity = session.lastActivityAt || session.timestamp || 0;
    return Date.now() - activity > SESSION_TTL_MS;
}

export function getStoredSession() {
    try {
        const raw = sessionStorage.getItem(STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (!isSessionExpired(parsed)) {
                return parsed;
            } else {
                sessionStorage.removeItem(STORAGE_KEY);
            }
        }
    } catch {}
    return null;
}

function resolveInitialLocale() {
    try {
        const sessionOverride = typeof window !== 'undefined' ? sessionStorage.getItem('soilfer_locale_override') : null;
        if (sessionOverride) return normalizeLocale(sessionOverride);

        const storedLocale = typeof localStorage !== 'undefined' ? localStorage.getItem('locale') : null;
        if (storedLocale) return normalizeLocale(storedLocale);

        const search = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
        const langParam = search ? search.get('lang') : null;
        if (langParam) return normalizeLocale(langParam);
    } catch {}
    return 'en';
}

export function useTutorialSession(onExitCallback, onPauseCallback) {
    const [state, setState] = useState(() => {
        const saved = getStoredSession();
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
                timestamp: Date.now(),
                lastActivityAt: Date.now()
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
            timestamp: saved?.timestamp ?? Date.now(),
            lastActivityAt: Date.now()
        };
    });

    // Save session state to sessionStorage
    useEffect(() => {
        if (!state.active) {
            try { sessionStorage.removeItem(STORAGE_KEY); } catch {}
            return;
        }
        try {
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
                ...state,
                lastActivityAt: Date.now()
            }));
        } catch {}
    }, [state]);

    // Active timer check for session expiry
    useEffect(() => {
        const checkExpiry = () => {
            try {
                const raw = sessionStorage.getItem(STORAGE_KEY);
                if (raw) {
                    const parsed = JSON.parse(raw);
                    if (isSessionExpired(parsed)) {
                        sessionStorage.removeItem(STORAGE_KEY);
                        setState(prev => ({ ...prev, active: false }));
                        if (typeof onExitCallback === 'function') onExitCallback();
                    }
                }
            } catch {}
        };

        const timer = setInterval(checkExpiry, 30000); // Check every 30s
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                checkExpiry();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            clearInterval(timer);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [onExitCallback]);

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
        setState(prev => {
            if (isSessionExpired(prev)) return { ...prev, active: false };
            return { ...prev, step, lastActivityAt: Date.now() };
        });
    }, []);

    const setIntroStage = useCallback((introStage) => {
        setState(prev => {
            if (isSessionExpired(prev)) return { ...prev, active: false };
            return { ...prev, introStage, lastActivityAt: Date.now() };
        });
    }, []);

    const setPath = useCallback((path) => {
        setState(prev => {
            if (isSessionExpired(prev)) return { ...prev, active: false };
            return { ...prev, path, lastActivityAt: Date.now() };
        });
    }, []);

    const setRoleChoice = useCallback((roleChoice) => {
        setState(prev => {
            if (isSessionExpired(prev)) return { ...prev, active: false };
            return { ...prev, roleChoice, lastActivityAt: Date.now() };
        });
    }, []);

    const setSampleTube = useCallback((sampleTube) => {
        setState(prev => {
            if (isSessionExpired(prev)) return { ...prev, active: false };
            return { ...prev, sampleTube, lastActivityAt: Date.now() };
        });
    }, []);

    const setLanguage = useCallback((lang) => {
        const normalized = normalizeLocale(lang);
        setState(prev => ({ ...prev, language: normalized, lastActivityAt: Date.now() }));
    }, []);

    const markDone = useCallback((stepIndex) => {
        setState(prev => {
            const doneSet = new Set(prev.done);
            doneSet.add(stepIndex);
            return { ...prev, done: Array.from(doneSet), lastActivityAt: Date.now() };
        });
    }, []);

    const markSkipped = useCallback((stepIndex) => {
        setState(prev => {
            const skippedSet = new Set(prev.skipped);
            skippedSet.add(stepIndex);
            return { ...prev, skipped: Array.from(skippedSet), lastActivityAt: Date.now() };
        });
    }, []);

    const nextStep = useCallback(() => {
        setState(prev => {
            if (prev.step === 0 && prev.introStage < 3) {
                return { ...prev, introStage: prev.introStage + 1, lastActivityAt: Date.now() };
            }

            const doneSet = new Set(prev.done);
            doneSet.add(prev.step);

            const stops = activeStops;
            const currentIndex = stops.indexOf(prev.step);
            let nextChapter = prev.step + 1;

            if (currentIndex !== -1 && currentIndex < stops.length - 1) {
                nextChapter = stops[currentIndex + 1];
            } else if (prev.step >= 15) {
                return { ...prev, step: 0, introStage: 0, done: Array.from(doneSet), lastActivityAt: Date.now() };
            }

            return {
                ...prev,
                step: Math.min(15, nextChapter),
                done: Array.from(doneSet),
                lastActivityAt: Date.now()
            };
        });
    }, [activeStops]);

    const prevStep = useCallback(() => {
        setState(prev => {
            if (prev.step === 0 && prev.introStage > 0) {
                return { ...prev, introStage: prev.introStage - 1, lastActivityAt: Date.now() };
            }

            const stops = activeStops;
            const currentIndex = stops.indexOf(prev.step);
            let prevChapter = prev.step - 1;

            if (currentIndex > 0) {
                prevChapter = stops[currentIndex - 1];
            }

            return {
                ...prev,
                step: Math.max(0, prevChapter),
                lastActivityAt: Date.now()
            };
        });
    }, [activeStops]);

    const skipLesson = useCallback(() => {
        setState(prev => {
            const skippedSet = new Set(prev.skipped);
            skippedSet.add(prev.step);

            const stops = activeStops;
            const currentIndex = stops.indexOf(prev.step);
            let nextChapter = prev.step + 1;

            if (currentIndex !== -1 && currentIndex < stops.length - 1) {
                nextChapter = stops[currentIndex + 1];
            } else if (prev.step >= 15) {
                return { ...prev, step: 0, introStage: 0, skipped: Array.from(skippedSet), lastActivityAt: Date.now() };
            }

            return {
                ...prev,
                step: Math.min(15, nextChapter),
                skipped: Array.from(skippedSet),
                lastActivityAt: Date.now()
            };
        });
    }, [activeStops]);

    const pause = useCallback(() => {
        setState(prev => ({ ...prev, paused: true, lastActivityAt: Date.now() }));
        if (typeof onPauseCallback === 'function') onPauseCallback();
    }, [onPauseCallback]);

    const resume = useCallback(() => {
        const stored = getStoredSession();
        if (isSessionExpired(stored)) {
            sessionStorage.removeItem(STORAGE_KEY);
            setState(prev => ({ ...prev, active: false }));
            return false;
        }
        setState(prev => ({ ...prev, active: true, paused: false, lastActivityAt: Date.now() }));
        return true;
    }, []);

    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                const stored = getStoredSession();
                if (!stored || isSessionExpired(stored)) {
                    try { sessionStorage.removeItem(STORAGE_KEY); } catch {}
                    setState(prev => ({ ...prev, active: false }));
                }
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, []);

    const exit = useCallback(() => {
        try { sessionStorage.removeItem(STORAGE_KEY); } catch {}
        setState(prev => ({
            ...prev,
            active: false,
            paused: false,
            step: 0,
            introStage: 0
        }));
        if (typeof window !== 'undefined' && window.location) {
            try {
                const url = new URL(window.location.href);
                url.searchParams.delete('tutorialmode');
                url.searchParams.delete('tour');
                const newQs = url.searchParams.toString();
                const newUrl = url.pathname + (newQs ? `?${newQs}` : '') + url.hash;
                window.history.replaceState(null, '', newUrl);
            } catch {}
        }
        if (typeof onExitCallback === 'function') onExitCallback();
    }, [onExitCallback]);

    // Practice updates keyed by tube identity (tubes 1-5)
    const updatePracticeForCurrentTube = useCallback((field, value) => {
        setState(prev => {
            if (isSessionExpired(prev)) {
                try { sessionStorage.removeItem(STORAGE_KEY); } catch {}
                return { ...prev, active: false };
            }
            const tube = prev.sampleTube || 1;
            const currentTubeData = prev.practiceByTube?.[tube] || DEFAULT_PRACTICE_BY_TUBE[tube];
            return {
                ...prev,
                lastActivityAt: Date.now(),
                practiceByTube: {
                    ...prev.practiceByTube,
                    [tube]: {
                        ...currentTubeData,
                        [field]: value
                    }
                }
            };
        });
    }, []);

    // F03 interactive search / filter
    const setF03Search = useCallback((f03Search) => {
        setState(prev => ({ ...prev, f03Search, lastActivityAt: Date.now() }));
    }, []);

    const setF03Filter = useCallback((f03Filter) => {
        setState(prev => ({ ...prev, f03Filter, lastActivityAt: Date.now() }));
    }, []);

    const setF03SelectedId = useCallback((f03SelectedId) => {
        setState(prev => ({ ...prev, f03SelectedId, lastActivityAt: Date.now() }));
    }, []);

    const setEquipmentStatus = useCallback((equipmentStatus) => {
        setState(prev => ({ ...prev, equipmentStatus, lastActivityAt: Date.now() }));
    }, []);

    const setInventoryLot = useCallback((inventoryLot) => {
        setState(prev => ({ ...prev, inventoryLot, lastActivityAt: Date.now() }));
    }, []);

    const currentTubePractice = state.practiceByTube?.[state.sampleTube] || DEFAULT_PRACTICE_BY_TUBE[state.sampleTube || 1];

    return {
        state,
        session: state,
        activeStops,
        currentTubePractice,
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
        pause,
        resume,
        exit,
        exitTutorial: exit,
        updatePractice: updatePracticeForCurrentTube,
        updatePracticeForCurrentTube,
        updateF03: (updater) => {
            if (typeof updater === 'function') {
                setState(prev => ({ ...prev, ...updater(prev), lastActivityAt: Date.now() }));
            }
        },
        setF03Search,
        setF03Filter,
        setF03SelectedId,
        setEquipmentStatus,
        setInventoryLot
    };
}
