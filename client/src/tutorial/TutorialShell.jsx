import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import './tutorial.css';
import { useTutorialSession, PATH_STOPS } from './useTutorialSession';
import { chapters } from './content/chapters';
import { foundations, f03PracticeSamples, glossaryEntriesByChapter } from './content/foundations';
import { useTutorialAuth } from './useTutorialAuth';

import PracticeIntake from './practice/PracticeIntake';
import PracticeReceipt from './practice/PracticeReceipt';
import PracticeAssignment from './practice/PracticeAssignment';
import PracticePreparation from './practice/PracticePreparation';
import PracticeWorksheetPH from './practice/PracticeWorksheetPH';
import PracticeTexture from './practice/PracticeTexture';
import PracticeSpectra from './practice/PracticeSpectra';
import PracticeReviewReturn from './practice/PracticeReviewReturn';
import PracticeResources from './practice/PracticeResources';

import en from './locales/en.json';
import es from './locales/es.json';
import es419 from './locales/es-419.json';
import fr from './locales/fr.json';
import pt from './locales/pt.json';

const LOCALES = {
    en,
    es,
    'es-419': es419,
    fr,
    pt
};

export default function TutorialShell({ onExit, onPause }) {
    const navigate = useNavigate();
    const location = useLocation();

    const {
        state,
        activeStops,
        setStep,
        setIntroStage,
        setPath,
        setRoleChoice,
        setSampleTube,
        setLanguage,
        markDone,
        nextStep,
        prevStep,
        skipLesson,
        updatePractice,
        updateF03,
        setSelectedSampleId,
        pause,
        resume,
        exitTutorial
    } = useTutorialSession(onExit, onPause);

    const {
        token,
        authStatus,
        verifiedUser,
        isAuthenticated,
        mustChangePassword,
        identityChanged,
        acknowledgeIdentityChange,
        hasPermission
    } = useTutorialAuth();

    const [mobileExpanded, setMobileExpanded] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [basicAnswer, setBasicAnswer] = useState(null);
    const [targetAnchorStatus, setTargetAnchorStatus] = useState('searching'); // 'searching' | 'found' | 'duplicate' | 'missing'
    const [showDraftDialog, setShowDraftDialog] = useState(false);
    const [pendingNavigateUrl, setPendingNavigateUrl] = useState(null);
    const [navNotice, setNavNotice] = useState(null);
    const coachTitleRef = useRef(null);
    const containerRef = useRef(null);
    const priorFocusRef = useRef(null);
    const isMountedRef = useRef(true);
    const sampleLookupAbortRef = useRef(null);
    const verifiedSampleRef = useRef(null); // { sampleId, humanInput, actorKey }
    const sampleCheckSeqRef = useRef(0);

    // Track outside-guide input edits and user confirmation revisions
    const outsideEditRevRef = useRef(0);
    const confirmedDraftRevRef = useRef(-1);

    useEffect(() => {
        const handleOutsideEdit = (e) => {
            const target = e.target;
            if (target && containerRef.current && containerRef.current.contains(target)) return;
            if (target && target.closest && target.closest('[data-sf-tutorial]')) return;
            outsideEditRevRef.current++;
        };
        document.addEventListener('input', handleOutsideEdit, true);
        document.addEventListener('change', handleOutsideEdit, true);
        return () => {
            document.removeEventListener('input', handleOutsideEdit, true);
            document.removeEventListener('change', handleOutsideEdit, true);
        };
    }, []);

    // Context refs to guard against stale closure variables across async lookup awaits
    const verifiedUserRef = useRef(verifiedUser);
    useEffect(() => {
        verifiedUserRef.current = verifiedUser;
    }, [verifiedUser]);

    const tokenRef = useRef(token);
    useEffect(() => {
        tokenRef.current = token;
    }, [token]);

    const locationPathRef = useRef(location.pathname);
    useEffect(() => {
        locationPathRef.current = location.pathname;
    }, [location.pathname]);

    const selectedSampleIdRef = useRef(state?.selectedSampleId);
    useEffect(() => {
        selectedSampleIdRef.current = state?.selectedSampleId;
    }, [state?.selectedSampleId]);

    // Cancel in-flight sample check and invalidate on unmount
    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
            if (sampleLookupAbortRef.current) {
                try { sampleLookupAbortRef.current.abort(); } catch {}
                sampleLookupAbortRef.current = null;
            }
            sampleCheckSeqRef.current++;
        };
    }, []);

    // A. Reset selection and acknowledge identity changes when actor/lab changes
    useEffect(() => {
        if (identityChanged) {
            acknowledgeIdentityChange();
        }
        if (setSelectedSampleId) {
            setSelectedSampleId(null);
        }
        verifiedSampleRef.current = null;
    }, [identityChanged, acknowledgeIdentityChange, verifiedUser?.id, verifiedUser?.labId]);

    // B. Invalidate and cancel in-flight sample lookup whenever sample input, chapter, URL, or actor changes
    // (Separated from selection-clearing so typing in the input field does not erase keystrokes)
    useEffect(() => {
        if (sampleLookupAbortRef.current) {
            try { sampleLookupAbortRef.current.abort(); } catch {}
            sampleLookupAbortRef.current = null;
        }
        sampleCheckSeqRef.current++;
        setNavNotice(null);
    }, [state?.selectedSampleId, state?.step, location.pathname, location.search, token, verifiedUser?.id, verifiedUser?.labId]);

    // Save previous active focus when entering tutorial
    useEffect(() => {
        priorFocusRef.current = document.activeElement;
        return () => {
            if (priorFocusRef.current && typeof priorFocusRef.current.focus === 'function') {
                try { priorFocusRef.current.focus(); } catch {}
            }
        };
    }, []);

    // Track live page inputs for controlled form draft protection
    const hasDirtyInputRef = useRef(false);
    useEffect(() => {
        const handleInput = (e) => {
            if (e.target && !e.target.closest('[data-sf-tutorial]')) {
                hasDirtyInputRef.current = true;
            }
        };
        const handleReset = (e) => {
            if (e.target && !e.target.closest('[data-sf-tutorial]')) {
                hasDirtyInputRef.current = false;
            }
        };
        window.addEventListener('input', handleInput, true);
        window.addEventListener('change', handleInput, true);
        window.addEventListener('submit', handleReset, true);
        window.addEventListener('reset', handleReset, true);
        return () => {
            window.removeEventListener('input', handleInput, true);
            window.removeEventListener('change', handleInput, true);
            window.removeEventListener('submit', handleReset, true);
            window.removeEventListener('reset', handleReset, true);
        };
    }, []);

    useEffect(() => {
        hasDirtyInputRef.current = false;
    }, [location.pathname]);

    // Active translation dictionary
    const dict = LOCALES[state?.language] || LOCALES.en;

    const [fallbackOccurred, setFallbackOccurred] = useState(false);
    const fallbackSeenRef = useRef(new Set());

    useEffect(() => {
        fallbackSeenRef.current.clear();
        setFallbackOccurred(false);
    }, [state?.language, state?.step, state?.introStage]);

    const t = useMemo(() => {
        return (keyPath, fallback = '') => {
            if (!keyPath) return fallback || '';
            const resolve = (obj, pArray) => {
                let curr = obj;
                for (const p of pArray) {
                    if (!curr || typeof curr !== 'object') return undefined;
                    curr = curr[p];
                }
                return curr;
            };

            const parts = keyPath.split('.');
            let val = resolve(dict, parts);
            if (val === undefined && dict?.common) {
                val = resolve(dict.common, parts);
            }
            if (val !== undefined) {
                return val;
            }

            // Key missing in active localized dictionary:
            // Attempt to resolve corresponding English root or common key before returning raw string
            let enVal = undefined;
            if (state?.language !== 'en' && LOCALES.en) {
                enVal = resolve(LOCALES.en, parts);
                if (enVal === undefined && LOCALES.en.common) {
                    enVal = resolve(LOCALES.en.common, parts);
                }
            }

            if (enVal !== undefined) {
                if (state?.language && state.language !== 'en' && !fallbackSeenRef.current.has(keyPath)) {
                    fallbackSeenRef.current.add(keyPath);
                    setTimeout(() => setFallbackOccurred(true), 0);
                }
                return enVal;
            }

            // If not found in English either, record fallback and return explicit fallback or raw keyPath
            if (state?.language && state.language !== 'en' && !fallbackSeenRef.current.has(keyPath)) {
                fallbackSeenRef.current.add(keyPath);
                setTimeout(() => setFallbackOccurred(true), 0);
            }
            return fallback || keyPath;
        };
    }, [dict, state?.language]);

    const {
        step = 0,
        introStage = 0,
        sampleTube = 1,
        path: chosenPath = 'full',
        done = [],
        skipped = [],
        practiceByTube = {}
    } = state || {};
    const isFoundation = step === 0 && introStage < 3;
    const isModalMode = step === 0; // Foundation & Chapter 0 are modal presentations
    const currentFoundation = isFoundation ? (foundations[introStage] || foundations[0]) : null;
    const currentChapter = chapters[step] || chapters[0];
    const currentTubePractice = (practiceByTube && (practiceByTube[sampleTube] || practiceByTube[1])) || {};

    const handleExit = () => {
        isMountedRef.current = false;
        if (sampleLookupAbortRef.current) {
            try { sampleLookupAbortRef.current.abort(); } catch {}
            sampleLookupAbortRef.current = null;
        }
        sampleCheckSeqRef.current++;
        verifiedSampleRef.current = null;
        exitTutorial();
    };

    const handlePause = () => {
        if (sampleLookupAbortRef.current) {
            try { sampleLookupAbortRef.current.abort(); } catch {}
            sampleLookupAbortRef.current = null;
        }
        sampleCheckSeqRef.current++;
        pause();
    };

    // Escape listener to pause
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && !state.paused && !mustChangePassword) {
                e.preventDefault();
                handlePause();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [state.paused, mustChangePassword]);

    // Modal Mode: Trap Tab/Shift+Tab focus
    useEffect(() => {
        if (!isModalMode || state.paused || mustChangePassword) return;

        const handleTabKey = (e) => {
            if (e.key !== 'Tab') return;
            const container = containerRef.current;
            if (!container) return;

            const focusables = container.querySelectorAll(
                'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
            );
            if (focusables.length === 0) return;

            const first = focusables[0];
            const last = focusables[focusables.length - 1];

            if (e.shiftKey) {
                if (document.activeElement === first) {
                    last.focus();
                    e.preventDefault();
                }
            } else {
                if (document.activeElement === last) {
                    first.focus();
                    e.preventDefault();
                }
            }
        };

        window.addEventListener('keydown', handleTabKey);
        return () => window.removeEventListener('keydown', handleTabKey);
    }, [isModalMode, state.paused, mustChangePassword]);

    // Focus title when step changes (guarded against hidden elements on mobile)
    useEffect(() => {
        if (mustChangePassword) return;
        if (coachTitleRef.current) {
            const el = coachTitleRef.current;
            const style = window.getComputedStyle(el);
            if (style.display !== 'none' && style.visibility !== 'hidden') {
                el.focus({ preventScroll: true });
            }
        }
    }, [step, introStage, mustChangePassword]);

    // Highlight target anchor on real page in docked mode (exact-one matching with 2.5s bounded retry)
    useEffect(() => {
        if (isModalMode || state.paused || mustChangePassword || chosenPath === 'quick') {
            setTargetAnchorStatus('missing');
            return;
        }

        const selector = currentChapter.targetAnchor;
        if (!selector) {
            setTargetAnchorStatus('missing');
            return;
        }

        let isMounted = true;
        let activeHighlightEl = null;
        const startTime = Date.now();
        const TIMEOUT_MS = 2500;
        let timerId = null;

        setTargetAnchorStatus('searching');

        const isVisible = (el) => {
            if (!el || !el.isConnected) return false;
            const style = window.getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
            const rect = el.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
        };

        const checkAnchor = () => {
            if (!isMounted) return;

            let allMatches = [];
            try {
                allMatches = Array.from(document.querySelectorAll(selector));
            } catch {
                setTargetAnchorStatus('missing');
                return;
            }

            const visibleMatches = allMatches.filter(isVisible);

            if (visibleMatches.length === 1) {
                const matchedEl = visibleMatches[0];
                if (activeHighlightEl && activeHighlightEl !== matchedEl) {
                    activeHighlightEl.classList.remove('sf-tutorial-target-highlight');
                }
                activeHighlightEl = matchedEl;
                matchedEl.classList.add('sf-tutorial-target-highlight');
                setTargetAnchorStatus('found');
                return;
            }

            if (visibleMatches.length > 1) {
                if (activeHighlightEl) {
                    activeHighlightEl.classList.remove('sf-tutorial-target-highlight');
                    activeHighlightEl = null;
                }
                setTargetAnchorStatus('duplicate');
                return;
            }

            // 0 visible matches: retry within bounded 2.5s window
            if (Date.now() - startTime < TIMEOUT_MS) {
                timerId = setTimeout(checkAnchor, 100);
            } else {
                if (activeHighlightEl) {
                    activeHighlightEl.classList.remove('sf-tutorial-target-highlight');
                    activeHighlightEl = null;
                }
                setTargetAnchorStatus('missing');
            }
        };

        checkAnchor();

        return () => {
            isMounted = false;
            if (timerId) clearTimeout(timerId);
            if (activeHighlightEl) {
                activeHighlightEl.classList.remove('sf-tutorial-target-highlight');
            }
        };
    }, [isModalMode, state.paused, currentChapter, location.pathname, location.search, mustChangePassword, chosenPath]);

    const viewedSet = useMemo(() => new Set(state?.viewed || []), [state?.viewed]);
    const practicedSet = useMemo(() => new Set(state?.practiced || []), [state?.practiced]);
    const skippedSet = useMemo(() => new Set(state?.skipped || []), [state?.skipped]);
    const doneSet = useMemo(() => new Set(state?.practiced || state?.done || []), [state?.practiced, state?.done]);

    if (!state.active || mustChangePassword) return null;

    if (state.paused) {
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
                    onClick={resume}
                >
                    {t('common.resume', 'Resume my visit →')}
                </button>
            </div>
        );
    }

    const getChapterStatus = (index) => {
        if (!activeStops.includes(index)) return 'unavailable';
        if (practicedSet.has(index)) return 'practiced';
        if (viewedSet.has(index)) return 'viewed';
        if (skippedSet.has(index)) return 'skipped';
        if (index === step) return 'current';
        return 'pending';
    };

    const getChapterStatusLabel = (status) => {
        switch (status) {
            case 'practiced': return t('common.statusPracticed', 'Practiced & completed');
            case 'viewed': return t('common.statusViewed', 'Viewed');
            case 'skipped': return t('common.statusSkipped', 'Skipped');
            case 'unavailable': return t('common.statusUnavailable', 'Not in current track');
            case 'current': return t('common.statusCurrent', 'Current step');
            default: return t('common.statusPending', 'Upcoming');
        }
    };

    const getChapterStatusIcon = (status, index) => {
        switch (status) {
            case 'practiced': return '✓';
            case 'viewed': return '👁';
            case 'skipped': return '↷';
            case 'unavailable': return '⊘';
            default: return String(index + 1).padStart(2, '0');
        }
    };

    const currentStopIndex = activeStops.indexOf(step);
    const isOffTrack = currentStopIndex === -1;
    const lastTrackIndex = activeStops.reduce((acc, s, idx) => (viewedSet.has(s) || practicedSet.has(s) || s === step ? idx : acc), 0);
    const displayStepNum = !isOffTrack ? currentStopIndex + 1 : lastTrackIndex + 1;
    const totalStops = activeStops.length;

    const titleText = isFoundation ? t(currentFoundation.titleKey) : t(currentChapter.titleKey);
    const copyText = isFoundation ? t(currentFoundation.copyKey) : t(currentChapter.copyKey);
    const whyText = isFoundation ? t(currentFoundation.whyKey) : t(currentChapter.whyKey);
    const nextBtnText = isFoundation ? t(currentFoundation.nextKey) : t(currentChapter.nextKey);
    const badgeText = isFoundation
        ? t('foundation.f01.subtitle', 'Start here · no account needed')
        : isOffTrack
            ? `${t(currentChapter.nameKey)} (${t('common.statusUnavailable', 'Outside current track')})`
            : t(currentChapter.nameKey);

    const glossaryList = glossaryEntriesByChapter[step] || glossaryEntriesByChapter.default;

    const handleAnswerCheck = (opt) => {
        const feedback = opt.isCorrect
            ? t(currentFoundation.feedbackCorrectKey)
            : t(currentFoundation.feedbackIncorrectKey);
        setBasicAnswer({
            isCorrect: opt.isCorrect,
            text: feedback
        });
    };

    // Filtered practice samples for F03
    const filteredF03Samples = f03PracticeSamples.filter(item => {
        const matchesFilter = state.f03Filter === 'all' || item.state.toLowerCase() === state.f03Filter.toLowerCase();
        const matchesSearch = !state.f03Search.trim() || item.id.toLowerCase().includes(state.f03Search.toLowerCase()) || item.fieldId.toLowerCase().includes(state.f03Search.toLowerCase());
        return matchesFilter && matchesSearch;
    });

    const hasDirtyDraft = () => {
        if (hasDirtyInputRef.current) return true;
        try {
            const inputs = document.querySelectorAll('input:not([type="hidden"]):not([readonly]):not([disabled]), textarea:not([readonly]):not([disabled]), select:not([disabled])');
            for (const input of inputs) {
                if (containerRef.current && containerRef.current.contains(input)) continue;
                if (input.closest('[data-sf-tutorial]')) continue;
                if (input.type === 'checkbox' || input.type === 'radio') {
                    if (input.checked !== input.defaultChecked) return true;
                } else if (input.value && input.value.trim() !== '') {
                    return true;
                }
            }
        } catch {}
        return false;
    };

    const isDraftUnconfirmed = () => {
        if (!hasDirtyDraft()) return false;
        return outsideEditRevRef.current !== confirmedDraftRevRef.current;
    };

    const performNavigation = async (customUrl = null) => {
        hasDirtyInputRef.current = false;
        if (customUrl) {
            navigate(customUrl);
            return;
        }

        // Ignore navigation if guide is unmounting or exited
        if (!isMountedRef.current) return;

        const startingPathname = location.pathname;
        const currentActor = verifiedUserRef.current;
        const actorKey = currentActor ? `${currentActor.id}:${currentActor.labId || ''}` : 'anonymous';
        const startingToken = tokenRef.current;

        if (currentChapter.resolveRoute) {
            if (currentChapter.id === 'trace') {
                const pathMatch = location.pathname.match(/\/samples\/([^\/]+)/);
                const querySampleId = new URLSearchParams(location.search).get('sampleId');
                let urlCandidate = null;
                try {
                    urlCandidate = pathMatch ? decodeURIComponent(pathMatch[1]) : (querySampleId || null);
                } catch {
                    urlCandidate = querySampleId || null;
                }

                // Selected sample from current user session
                let candidateId = (state.selectedSampleId && state.selectedSampleId.trim()) || null;

                // Fall back to urlCandidate only if no explicit selection in state
                if (!candidateId && urlCandidate) {
                    candidateId = urlCandidate;
                }

                if (!candidateId) {
                    setNavNotice(t('sampleRequiredNotice', 'Select an authorized sample from the laboratory list to view its workflow map. Docked guidance remains active.'));
                    return;
                }

                // Check if already verified for this exact actor
                if (verifiedSampleRef.current && (verifiedSampleRef.current.sampleId === candidateId || verifiedSampleRef.current.humanInput === candidateId) && verifiedSampleRef.current.actorKey === actorKey) {
                    const canonicalId = verifiedSampleRef.current.sampleId;
                    const targetPath = currentChapter.resolveRoute({ isAuthenticated, user: currentActor, authStatus, selectedSampleId: canonicalId });
                    if (targetPath && isMountedRef.current) {
                        const sep = targetPath.includes('?') ? '&' : '?';
                        const finalUrl = targetPath.includes('tutorialmode=') ? targetPath : `${targetPath}${sep}tutorialmode=true`;
                        if (isDraftUnconfirmed()) {
                            setPendingNavigateUrl(finalUrl);
                            setShowDraftDialog(true);
                            return;
                        }
                        navigate(finalUrl);
                    }
                    return;
                }

                // Invalidate any previous pending lookup
                if (sampleLookupAbortRef.current) {
                    try { sampleLookupAbortRef.current.abort(); } catch {}
                    sampleLookupAbortRef.current = null;
                }

                const abortController = new AbortController();
                sampleLookupAbortRef.current = abortController;
                const currentSeq = ++sampleCheckSeqRef.current;
                const startingCandidateId = candidateId;

                setNavNotice(t('sampleVerifying', 'Verifying sample access...'));

                try {
                    const headers = startingToken ? { Authorization: `Bearer ${startingToken}` } : {};
                    const res = await axios.get(`/api/samples/${encodeURIComponent(candidateId)}/detail`, {
                        headers,
                        signal: abortController.signal,
                        timeout: 6000
                    });

                    // Invalidate if sequence changed, request was aborted, or component unmounted/exited
                    if (sampleCheckSeqRef.current !== currentSeq || abortController.signal.aborted || !isMountedRef.current) {
                        return;
                    }

                    // Check that sample input has not changed while waiting for response
                    const currentSampleInput = (selectedSampleIdRef.current && selectedSampleIdRef.current.trim()) || null;
                    if (currentSampleInput !== null && currentSampleInput !== startingCandidateId) {
                        return;
                    }

                    // Check that route pathname has not changed while waiting for response
                    if (locationPathRef.current !== startingPathname) {
                        return;
                    }

                    // Check that verified actor has not changed while waiting for response
                    const freshActor = verifiedUserRef.current;
                    const freshActorKey = freshActor ? `${freshActor.id}:${freshActor.labId || ''}` : 'anonymous';
                    if (freshActorKey !== actorKey || tokenRef.current !== startingToken) {
                        return;
                    }

                    const canonicalSample = res.data?.sample;
                    const canonicalId = canonicalSample?.id;

                    if (res.status === 200 && canonicalId) {
                        verifiedSampleRef.current = {
                            sampleId: canonicalId,
                            humanInput: candidateId,
                            actorKey
                        };
                        setNavNotice(null);

                        const targetPath = currentChapter.resolveRoute({
                            isAuthenticated,
                            user: freshActor,
                            authStatus,
                            selectedSampleId: canonicalId
                        });

                        if (targetPath && isMountedRef.current) {
                            const sep = targetPath.includes('?') ? '&' : '?';
                            const finalUrl = targetPath.includes('tutorialmode=') ? targetPath : `${targetPath}${sep}tutorialmode=true`;

                            // Re-check live form dirty draft protection before navigating
                            if (isDraftUnconfirmed()) {
                                setPendingNavigateUrl(finalUrl);
                                setShowDraftDialog(true);
                                return;
                            }

                            navigate(finalUrl);
                        }
                    } else {
                        verifiedSampleRef.current = null;
                        setNavNotice(t('sampleCheckError', 'Unable to verify sample access. Select an authorized sample from your laboratory list.'));
                    }
                } catch (err) {
                    // Silent cancellation on abort / exit / context change
                    if (axios.isCancel(err) || err.name === 'CanceledError' || err.name === 'AbortError' || abortController.signal.aborted) {
                        return;
                    }
                    if (sampleCheckSeqRef.current !== currentSeq || !isMountedRef.current) {
                        return;
                    }
                    verifiedSampleRef.current = null;
                    const status = err.response?.status;
                    if (status === 403) {
                        setNavNotice(t('sampleForbiddenNotice', 'Access denied: Sample belongs to another laboratory or is not accessible under your current role. Select an authorized sample from your laboratory list.'));
                    } else if (status === 404) {
                        setNavNotice(t('sampleNotFoundNotice', 'Sample not found. Select an authorized sample from your laboratory list.'));
                    } else {
                        setNavNotice(t('sampleCheckError', 'Unable to verify sample access. Select an authorized sample from your laboratory list.'));
                    }
                } finally {
                    if (sampleLookupAbortRef.current === abortController) {
                        sampleLookupAbortRef.current = null;
                    }
                }
                return;
            }

            const targetPath = currentChapter.resolveRoute({ isAuthenticated, user: currentActor, authStatus, selectedSampleId: state.selectedSampleId });
            if (targetPath && isMountedRef.current) {
                const sep = targetPath.includes('?') ? '&' : '?';
                const finalUrl = targetPath.includes('tutorialmode=') ? targetPath : `${targetPath}${sep}tutorialmode=true`;
                if (isDraftUnconfirmed()) {
                    setPendingNavigateUrl(finalUrl);
                    setShowDraftDialog(true);
                    return;
                }
                navigate(finalUrl);
            }
            return;
        }

        const targetPath = currentChapter.route;
        if (targetPath && isMountedRef.current) {
            const sep = targetPath.includes('?') ? '&' : '?';
            const finalUrl = targetPath.includes('tutorialmode=') ? targetPath : `${targetPath}${sep}tutorialmode=true`;
            if (isDraftUnconfirmed()) {
                setPendingNavigateUrl(finalUrl);
                setShowDraftDialog(true);
                return;
            }
            navigate(finalUrl);
        }
    };

    const handleNavigateRealPage = async () => {
        if (!currentChapter.resolveRoute && !currentChapter.route) return;

        if (currentChapter.requiredPermission && !hasPermission(currentChapter.requiredPermission)) {
            setNavNotice(t('permissionDenied', 'Permission required to access this section.'));
            return;
        }
        setNavNotice(null);

        if (isDraftUnconfirmed()) {
            setPendingNavigateUrl(null);
            setShowDraftDialog(true);
            return;
        }

        await performNavigation();
    };

    const renderQuickOverviewDiagram = (chapterId) => {
        switch (chapterId) {
            case 'identity':
                return (
                    <div className="panel" style={{ background: '#fcfdfb', border: '1px solid #dce3da', padding: '12px', borderRadius: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ background: '#eaf4e9', padding: '10px', borderRadius: '8px', fontSize: '24px' }}>🔐</div>
                            <div style={{ fontSize: '12px', color: '#2d3748', flex: 1 }}>
                                <b style={{ color: '#213b32', display: 'block', marginBottom: '2px' }}>{t('quickOverview.identityTitle', 'Roles and access')}:</b>
                                {t('quickOverview.identityDesc', 'Each laboratory role has clear responsibilities, from receiving samples to recording tests and reviewing final results.')}
                            </div>
                        </div>
                    </div>
                );
            case 'field':
                return (
                    <div className="panel" style={{ background: '#fcfdfb', border: '1px solid #dce3da', padding: '12px', borderRadius: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ background: '#eaf4e9', padding: '10px', borderRadius: '8px', fontSize: '24px' }}>🌾</div>
                            <div style={{ fontSize: '12px', color: '#2d3748', flex: 1 }}>
                                <b style={{ color: '#213b32', display: 'block', marginBottom: '2px' }}>{t('quickOverview.fieldTitle', 'Field collection')}:</b>
                                {t('quickOverview.fieldDesc', 'Samples arrive with field identifiers and location notes, linking laboratory work back to where the soil was collected.')}
                            </div>
                        </div>
                    </div>
                );
            case 'intake':
                return (
                    <div className="panel" style={{ background: '#fcfdfb', border: '1px solid #dce3da', padding: '12px', borderRadius: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ background: '#eaf4e9', padding: '10px', borderRadius: '8px', fontSize: '24px' }}>⚖️</div>
                            <div style={{ fontSize: '12px', color: '#2d3748', flex: 1 }}>
                                <b style={{ color: '#213b32', display: 'block', marginBottom: '2px' }}>{t('quickOverview.intakeTitle', 'Sample intake')}:</b>
                                {t('quickOverview.intakeDesc', 'The laboratory checks the container, records an illustrative sample mass (such as 485.2 g), and confirms physical arrival.')}
                            </div>
                        </div>
                    </div>
                );
            case 'prepare':
                return (
                    <div className="panel" style={{ background: '#fcfdfb', border: '1px solid #dce3da', padding: '12px', borderRadius: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ background: '#eaf4e9', padding: '10px', borderRadius: '8px', fontSize: '24px' }}>🥣</div>
                            <div style={{ fontSize: '12px', color: '#2d3748', flex: 1 }}>
                                <b style={{ color: '#213b32', display: 'block', marginBottom: '2px' }}>{t('quickOverview.prepareTitle', 'Sample preparation')}:</b>
                                {t('quickOverview.prepareDesc', 'Soil samples are dried, crushed, and sieved so uniform test portions can be weighed for laboratory analysis.')}
                            </div>
                        </div>
                    </div>
                );
            case 'bench':
                return (
                    <div className="panel" style={{ background: '#fcfdfb', border: '1px solid #dce3da', padding: '12px', borderRadius: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ background: '#eaf4e9', padding: '10px', borderRadius: '8px', fontSize: '24px' }}>🧪</div>
                            <div style={{ fontSize: '12px', color: '#2d3748', flex: 1 }}>
                                <b style={{ color: '#213b32', display: 'block', marginBottom: '2px' }}>{t('quickOverview.benchTitle', 'Bench testing')}:</b>
                                {t('quickOverview.benchDesc', 'Technicians perform tests following the laboratory’s configured analytical methods and quality checks, recording measurements like pH.')}
                            </div>
                        </div>
                    </div>
                );
            case 'texture':
                return (
                    <div className="panel" style={{ background: '#fcfdfb', border: '1px solid #dce3da', padding: '12px', borderRadius: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ background: '#eaf4e9', padding: '10px', borderRadius: '8px', fontSize: '24px' }}>🔬</div>
                            <div style={{ fontSize: '12px', color: '#2d3748', flex: 1 }}>
                                <b style={{ color: '#213b32', display: 'block', marginBottom: '2px' }}>{t('quickOverview.textureTitle', 'Soil texture')}:</b>
                                {t('quickOverview.textureDesc', 'Measurements of sand, silt, and clay fractions are checked to ensure their sum closes to 100% for proper soil texture classification.')}
                            </div>
                        </div>
                    </div>
                );
            case 'review':
                return (
                    <div className="panel" style={{ background: '#fcfdfb', border: '1px solid #dce3da', padding: '12px', borderRadius: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ background: '#eaf4e9', padding: '10px', borderRadius: '8px', fontSize: '24px' }}>📋</div>
                            <div style={{ fontSize: '12px', color: '#2d3748', flex: 1 }}>
                                <b style={{ color: '#213b32', display: 'block', marginBottom: '2px' }}>{t('quickOverview.reviewTitle', 'Quality review')}:</b>
                                {t('quickOverview.reviewDesc', 'A supervisor or manager reviews the submitted measurements against quality thresholds before authorizing the report.')}
                            </div>
                        </div>
                    </div>
                );
            case 'finish':
                return (
                    <div className="panel" style={{ background: '#fcfdfb', border: '1px solid #dce3da', padding: '12px', borderRadius: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ background: '#eaf4e9', padding: '10px', borderRadius: '8px', fontSize: '24px' }}>✨</div>
                            <div style={{ fontSize: '12px', color: '#2d3748', flex: 1 }}>
                                <b style={{ color: '#213b32', display: 'block', marginBottom: '2px' }}>{t('quickOverview.finishTitle', 'Connected workflow')}:</b>
                                {t('quickOverview.finishDesc', 'From initial field collection to physical reception, bench analysis, and authorized reports, the platform keeps records connected.')}
                            </div>
                        </div>
                    </div>
                );
            default:
                return (
                    <div className="panel" style={{ background: '#fcfdfb', border: '1px solid #dce3da', padding: '12px', borderRadius: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ background: '#eaf4e9', padding: '10px', borderRadius: '8px', fontSize: '24px' }}>🏢</div>
                            <div style={{ fontSize: '12px', color: '#2d3748', flex: 1 }}>
                                <b style={{ color: '#213b32', display: 'block', marginBottom: '2px' }}>{t('quickOverview.defaultTitle', 'Laboratory overview')}:</b>
                                {t('quickOverview.defaultDesc', 'A connected record connecting sample arrivals, analytical tasks, and verified reports.')}
                            </div>
                        </div>
                    </div>
                );
        }
    };

    // =========================================================================
    // RENDER: Modal Mode (Step 0: Foundation F01-F03 and Chapter 0 Path Selection)
    // =========================================================================
    if (isModalMode) {
        return (
            <div
                id="soilfer-tutorial-overlay"
                data-sf-tutorial="root"
                role="dialog"
                aria-modal="true"
                aria-label={t('aria.coach', 'First-visit guide')}
                ref={containerRef}
                style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 8500,
                    background: '#eaece5',
                    color: '#213b32',
                    fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
                    fontSize: '15px',
                    lineHeight: 1.5,
                    overflowY: 'auto',
                    boxSizing: 'border-box'
                }}
            >
                {/* Top Preview Bar */}
                <div className="preview-bar">
                    <b>{t('common.previewBarTitle', 'FIRST-VISIT GUIDE · GUIDED PLATFORM WALKTHROUGH')}</b>
                    <span>{t('common.previewBarSubtitle', 'Practice exercises use synthetic example data · no LIMS records are changed')}</span>
                    <span className="date">{t('common.previewBarDate', '14 September 2026')}</span>
                </div>

                {/* Application Header Bar */}
                <header className="top">
                    <div className="brand">
                        <span className="mark" aria-hidden="true"></span>
                        SoilFER <span className="muted" style={{ fontWeight: 400 }}>LIMS</span>
                    </div>
                    <div className="top-tools">
                        {/* Language Selector */}
                        <label htmlFor="tutorial-language-select" className="small" style={{ marginRight: '4px', fontWeight: 600 }}>
                            {t('common.language', 'Language')}:
                        </label>
                        <select
                            id="tutorial-language-select"
                            value={state.language}
                            onChange={(e) => setLanguage(e.target.value)}
                            style={{ width: 'auto', padding: '6px 10px', minHeight: '34px', fontSize: '12px', marginRight: '8px' }}
                            aria-label={t('common.language', 'Language')}
                        >
                            <option value="en">English</option>
                            <option value="es">Español</option>
                            <option value="es-419">Español (América Latina)</option>
                            <option value="fr">Français</option>
                            <option value="pt">Português</option>
                        </select>

                        <button
                            type="button"
                            className="quiet"
                            id="pause"
                            onClick={handlePause}
                        >
                            {t('common.pause', 'Pause')}
                        </button>
                        <button
                            type="button"
                            id="exit"
                            onClick={handleExit}
                        >
                            {t('common.exitGuide', 'Exit guide ↗')}
                        </button>
                    </div>
                </header>

                {/* Main Modal Layout */}
                <div className="layout" id="layout">
                    {/* Chapter Sidebar */}
                    <nav className="chapters" aria-label={t('aria.chaptersNav', 'Tutorial chapters')} id="chapters">
                        <div className="caps">{t('common.capsFollowSample', 'Follow the sample')}</div>
                        {chapters.map((ch, i) => {
                            const isActive = i === step;
                            const status = getChapterStatus(i);
                            return (
                                <button
                                    key={ch.id}
                                    type="button"
                                    className={`chapter ${isActive ? 'active' : ''} ${status}`}
                                    data-step={i}
                                    data-status={status}
                                    aria-current={isActive ? 'step' : undefined}
                                    onClick={() => {
                                        setIntroStage(3);
                                        setStep(i);
                                    }}
                                >
                                    <i>{getChapterStatusIcon(status, i)}</i>
                                    <span>{t(ch.nameKey)}</span>
                                </button>
                            );
                        })}
                    </nav>

                    {/* Stage Presentation */}
                    <main className="stage">
                        <div className="stage-top">
                            <div>
                                <div className="caps">{t('common.capsGuidedVisit', 'A guided laboratory visit')}</div>
                                <p id="stageCaption">{t('common.stageSubtitle', 'One sample to follow. Five to keep in view.')}</p>
                            </div>
                            <div className="role">
                                <div className="avatar" id="avatar">
                                    {verifiedUser ? (verifiedUser.name ? verifiedUser.name[0] : 'U') : 'V'}
                                </div>
                                <div>
                                    <b id="roleLabel">
                                        {verifiedUser ? verifiedUser.name : t('roles.visitor', 'Visitor')}
                                    </b>
                                    <div className="muted small">
                                        {verifiedUser ? `${verifiedUser.role} · ${verifiedUser.labId || 'LAB'}` : t('common.previewPersona', 'Preview persona · not a signed-in account')}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="workspace">
                            {/* App Presentation Screen */}
                            <section className="app-frame" aria-label={t('aria.appFrame', 'Illustrative application screen')}>
                                <div className="frame-bar">
                                    <span className="route" id="route">
                                        {isFoundation ? '/login?tutorialmode=true&tour=first-visit' : currentChapter.route}
                                    </span>
                                    <span className="badge clay">{t('common.illustrativePage', 'Illustrative page')}</span>
                                </div>

                                <div className="page" id="page">
                                    {isFoundation ? (
                                        <>
                                            <div className="caps">{t(currentFoundation.subtitleKey)}</div>
                                            <h1 style={{ margin: '16px 0' }}>{t(currentFoundation.titleKey)}</h1>
                                            <p className="welcome-lead">
                                                {t(currentFoundation.leadKey)}
                                            </p>

                                            {introStage === 0 && (
                                                <div className="panel focus">
                                                    <h3>{t(currentFoundation.panelTitleKey)}</h3>
                                                    <div className="flow">
                                                        <div className="flow-node">
                                                            <b>1</b>
                                                            <strong>{t('foundation.f01.step1Title', 'Receive & identify')}</strong>
                                                            <span>{t('foundation.f01.step1Actor', 'Reception team')}</span>
                                                        </div>
                                                        <div className="flow-node">
                                                            <b>2</b>
                                                            <strong>{t('foundation.f01.step2Title', 'Prepare & analyse')}</strong>
                                                            <span>{t('foundation.f01.step2Actor', 'Technician')}</span>
                                                        </div>
                                                        <div className="flow-node">
                                                            <b>3</b>
                                                            <strong>{t('foundation.f01.step3Title', 'Check & report')}</strong>
                                                            <span>{t('foundation.f01.step3Actor', 'Reviewer')}</span>
                                                        </div>
                                                    </div>
                                                    <p className="small muted">
                                                        {t('foundation.f01.note', 'People perform the laboratory work. The platform keeps the connected records.')}
                                                    </p>
                                                </div>
                                            )}

                                            {introStage === 1 && (
                                                <>
                                                    <div className="panel">
                                                        <div className="row">
                                                            <h3>{t('foundation.f02.labTitle', 'Laboratory')}</h3>
                                                            <span className="muted small">{t('foundation.f02.labDesc', 'The facility and team handling the work')}</span>
                                                        </div>
                                                        <div className="row" style={{ marginTop: '12px' }}>
                                                            <h3>{t('foundation.f02.projectTitle', 'Project')}</h3>
                                                            <span className="muted small">{t('foundation.f02.projectDesc', 'Related samples and work across facilities')}</span>
                                                        </div>
                                                        <p className="notice">
                                                            {t('foundation.f02.projectNotice', 'A project may involve more than one laboratory.')}
                                                        </p>
                                                    </div>
                                                    <div className="panel focus">
                                                        <span className="badge clay">{t('foundation.f02.sampleBadge', 'Example sample · TRAIN-US-001')}</span>
                                                        <div className="flow">
                                                            <div className="flow-node">
                                                                <b>A</b>
                                                                <strong>{t('foundation.f02.node1Title', 'Sample record')}</strong>
                                                                <span>{t('foundation.f02.node1Desc', 'Identity & progress')}</span>
                                                            </div>
                                                            <div className="flow-node">
                                                                <b>B</b>
                                                                <strong>{t('foundation.f02.node2Title', 'Tasks & results')}</strong>
                                                                <span>{t('foundation.f02.node2Desc', 'pH · texture')}</span>
                                                            </div>
                                                            <div className="flow-node">
                                                                <b>C</b>
                                                                <strong>{t('foundation.f02.node3Title', 'Report')}</strong>
                                                                <span>{t('foundation.f02.node3Desc', 'Authorized results')}</span>
                                                            </div>
                                                        </div>
                                                        <p className="small muted">
                                                            {t('foundation.f02.note', 'The field identifier links to collection. The laboratory identifier helps you match the container to its record.')}
                                                        </p>
                                                    </div>
                                                </>
                                            )}

                                            {introStage === 2 && (
                                                <>
                                                    <div className="stack">
                                                        <div className="flow-node">
                                                            <b>⌂</b>
                                                            <strong>{t('foundation.f03.nodeHomeTitle', 'Home')}</strong>
                                                            <span>{t('foundation.f03.nodeHomeDesc', 'What needs attention')}</span>
                                                        </div>
                                                        <div className="flow-node">
                                                            <b>1</b>
                                                            <strong>{t('foundation.f03.nodeSamplesTitle', 'Samples')}</strong>
                                                            <span>{t('foundation.f03.nodeSamplesDesc', 'Find identity & history')}</span>
                                                        </div>
                                                        <div className="flow-node focus">
                                                            <b>2</b>
                                                            <strong>{t('foundation.f03.nodeWorkbenchTitle', 'Workbench')}</strong>
                                                            <span>{t('foundation.f03.nodeWorkbenchDesc', 'Record assigned work')}</span>
                                                        </div>
                                                        <div className="flow-node">
                                                            <b>3</b>
                                                            <strong>{t('foundation.f03.nodeReviewTitle', 'Review queue')}</strong>
                                                            <span>{t('foundation.f03.nodeReviewDesc', 'Check submitted work')}</span>
                                                        </div>
                                                        <div className="flow-node">
                                                            <b>?</b>
                                                            <strong>{t('foundation.f03.nodeReportsTitle', 'Reports & Help')}</strong>
                                                            <span>{t('foundation.f03.nodeReportsDesc', 'Find results & guidance')}</span>
                                                        </div>
                                                    </div>

                                                    {/* Interactive F03 Local Search/Filter Practice */}
                                                    <div className="panel focus" style={{ marginTop: '16px' }}>
                                                        <div className="row">
                                                            <h3>{t('chapters.welcome.title', 'Practice searching samples')}</h3>
                                                            <span className="badge clay">{t('common.practiceBadge', 'Practice only')}</span>
                                                        </div>
                                                        <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
                                                            <input
                                                                id="f03SearchInput"
                                                                value={state.f03Search}
                                                                onChange={(e) => updateF03('f03Search', e.target.value)}
                                                                placeholder={t('foundation.f03.searchPlaceholder', 'Search practice samples (e.g. TRAIN-US-001)...')}
                                                                style={{ flex: 1, minWidth: '200px' }}
                                                            />
                                                            <button
                                                                type="button"
                                                                id="f03FilterAll"
                                                                className={`quiet ${state.f03Filter === 'all' ? 'focus' : ''}`}
                                                                style={{ border: '1px solid #dce3da' }}
                                                                onClick={() => updateF03('f03Filter', 'all')}
                                                            >
                                                                {t('foundation.f03.filterAll', 'All')}
                                                            </button>
                                                            <button
                                                                type="button"
                                                                id="f03FilterExpected"
                                                                className={`quiet ${state.f03Filter === 'expected' ? 'focus' : ''}`}
                                                                style={{ border: '1px solid #dce3da' }}
                                                                onClick={() => updateF03('f03Filter', 'expected')}
                                                            >
                                                                {t('foundation.f03.filterExpected', 'Expected')}
                                                            </button>
                                                            <button
                                                                type="button"
                                                                id="f03FilterReceived"
                                                                className={`quiet ${state.f03Filter === 'received' ? 'focus' : ''}`}
                                                                style={{ border: '1px solid #dce3da' }}
                                                                onClick={() => updateF03('f03Filter', 'received')}
                                                            >
                                                                {t('foundation.f03.filterReceived', 'Received')}
                                                            </button>
                                                        </div>

                                                        <div className="table-wrap" style={{ marginTop: '12px' }}>
                                                            <table id="f03Table">
                                                                <thead>
                                                                    <tr>
                                                                        <th>{t('common.tableSampleId', 'Sample ID')}</th>
                                                                        <th>{t('common.tableFieldId', 'Field ID')}</th>
                                                                        <th>{t('common.tableState', 'State')}</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {filteredF03Samples.map(sample => (
                                                                        <tr
                                                                            key={sample.id}
                                                                            data-f03-sample-id={sample.id}
                                                                            style={{ cursor: 'pointer', background: state.f03SelectedId === sample.id ? '#edf4eb' : 'transparent' }}
                                                                            onClick={() => updateF03('f03SelectedId', sample.id)}
                                                                        >
                                                                            <td><b>{sample.id}</b></td>
                                                                            <td>{sample.fieldId}</td>
                                                                            <td><span className="badge">{t(sample.stateKey, sample.state)}</span></td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>

                                                        {state.f03SelectedId && (
                                                            <div id="f03SelectionDetails" className="status" style={{ marginTop: '10px' }}>
                                                                {t('foundation.f03.sampleSelected')
                                                                    .replace('{id}', state.f03SelectedId)
                                                                    .replace('{state}', t('common.stateVerified', 'Verified'))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </>
                                            )}

                                            {/* Comprehension Check */}
                                            <div className="panel" style={{ marginTop: '16px' }}>
                                                <h3>{t('common.quickCheckTitle', 'A quick check')}</h3>
                                                <p className="small muted">{t(currentFoundation.checkQuestionKey)}</p>
                                                <div className="row" style={{ marginTop: '12px', justifyContent: 'flex-start', gap: '8px' }}>
                                                    {currentFoundation.options.map(opt => (
                                                        <button
                                                            key={opt.id}
                                                            type="button"
                                                            data-answer={opt.isCorrect ? 'correct' : 'wrong'}
                                                            onClick={() => handleAnswerCheck(opt)}
                                                        >
                                                            {t(opt.textKey)}
                                                        </button>
                                                    ))}
                                                </div>
                                                <div
                                                    role="status"
                                                    id="basicAnswer"
                                                    className={`notice ${basicAnswer ? (basicAnswer.isCorrect ? 'status' : 'status error') : ''}`}
                                                >
                                                    {basicAnswer ? basicAnswer.text : ''}
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        /* Chapter 0: Welcome choices */
                                        <div className="login-grid">
                                            <div>
                                                <div className="caps">{t('common.capsWelcome', 'Welcome to SoilFER')}</div>
                                                <h1 style={{ marginTop: '15px' }}>{t('common.welcomeHeadline', 'From field to trusted result.')}</h1>
                                                <p className="welcome-lead" style={{ marginTop: '17px' }}>
                                                    {t('common.welcomeLead', 'A guided introduction to the people, steps and evidence behind every sample.')}
                                                </p>
                                                <div className="path-grid">
                                                    <button
                                                        type="button"
                                                        className={`path ${chosenPath === 'full' ? 'active' : ''}`}
                                                        data-path="full"
                                                        onClick={() => setPath('full')}
                                                    >
                                                        <span>{t('common.pathFullTitle', 'Follow a sample')}<small>{t('common.pathFullDesc', 'The full laboratory story')}</small></span>
                                                        <span>16–18 min →</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className={`path ${chosenPath === 'quick' ? 'active' : ''}`}
                                                        data-path="quick"
                                                        onClick={() => setPath('quick')}
                                                    >
                                                        <span>{t('common.pathQuickTitle', 'Show me the platform')}<small>{t('common.pathQuickDesc', 'A short first impression')}</small></span>
                                                        <span>3 min →</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className={`path ${chosenPath === 'role' ? 'active' : ''}`}
                                                        data-path="role"
                                                        onClick={() => setPath('role')}
                                                    >
                                                        <span>{t('common.pathRoleTitle', 'Learn my role')}<small>{t('common.pathRoleDesc', 'Start where your work happens')}</small></span>
                                                        <span>4–8 min →</span>
                                                    </button>
                                                </div>
                                                <div className="path-choice" id="pathInfo">
                                                    {chosenPath === 'quick'
                                                        ? t('common.pathInfoQuick', 'The next button will follow the short overview.')
                                                        : chosenPath === 'role'
                                                            ? t('common.pathInfoRole', 'Choose your role on the next screen.')
                                                            : t('common.pathInfoFull', 'The full laboratory story is selected.')}
                                                </div>
                                            </div>

                                            <div className="login-form">
                                                <h3 style={{ marginBottom: '18px' }}>{t('common.signInPrompt', 'Sign in to your laboratory')}</h3>
                                                <label className="label">
                                                    {t('common.loginSketchUsername', 'Username')}
                                                    <input disabled placeholder={t('common.loginSketchUsernamePlaceholder', 'Your assigned account')} />
                                                </label>
                                                <label className="label">
                                                    {t('common.loginSketchPassword', 'Password')}
                                                    <input disabled type="password" placeholder={t('common.loginSketchPasswordPlaceholder', 'Provided by your facilitator')} />
                                                </label>
                                                <button disabled className="primary">{t('common.loginSketchSignIn', 'Sign in')}</button>
                                                <p>{t('common.loginSketchNote', 'This is a sketch of the login flow. Real sign-in happens on the application page.')}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </section>

                            {/* Docked Coach Panel */}
                            <aside className="coach" aria-label={t('aria.coach', 'First-visit guide')}>
                                <div className="coach-top">
                                    <div className="row">
                                        <strong>{t('common.yourLabVisit', 'YOUR LAB VISIT')}</strong>
                                        <span id="position">
                                            {isFoundation
                                                ? t('foundation.basicsProgress', 'Basics {current} / {total}').replace('{current}', String(introStage + 1)).replace('{total}', '3')
                                                : isOffTrack
                                                    ? `${t('common.statusUnavailable', 'Outside current track')} (${String(displayStepNum).padStart(2, '0')} / ${String(totalStops).padStart(2, '0')})`
                                                    : `${String(displayStepNum).padStart(2, '0')} / ${String(totalStops).padStart(2, '0')}`}
                                        </span>
                                    </div>
                                    <div
                                        className="progress"
                                        role="progressbar"
                                        aria-label={t('aria.progress', 'Tutorial progress')}
                                        aria-valuemin="0"
                                        aria-valuemax={totalStops}
                                        aria-valuenow={Math.min(displayStepNum, totalStops)}
                                        id="progress"
                                    >
                                        <span
                                            id="progressFill"
                                            style={{ width: `${(Math.min(displayStepNum, totalStops) / totalStops) * 100}%` }}
                                        ></span>
                                    </div>
                                </div>

                                <div className="coach-body">
                                    <span className="badge" id="chapterBadge">{badgeText}</span>
                                    <h2 id="coachTitle" tabIndex="-1" ref={coachTitleRef}>
                                        {titleText}
                                    </h2>
                                    <p id="coachCopy">{copyText}</p>

                                    <details>
                                        <summary>{t('common.whyThisMatters', 'Why this matters')}</summary>
                                        <p id="why">{whyText}</p>
                                    </details>

                                    <details id="glossary" style={{ marginTop: '12px' }}>
                                        <summary>{t('common.wordsUsedHere', 'Words used here')}</summary>
                                        {glossaryList.map((item) => (
                                            <p key={item.term}>
                                                <b>{item.termKey ? t(item.termKey, item.term) : item.term}</b> · {t(item.meaningKey)}
                                            </p>
                                        ))}
                                    </details>

                                    <div className="lesson-complete" aria-live="polite" id="completion">
                                        {doneSet.has(step) ? t('common.lessonExplored', 'Lesson explored. You can revisit it.') : ''}
                                    </div>
                                </div>

                                <div className="coach-foot">
                                    <button
                                        type="button"
                                        className="primary"
                                        id="next"
                                        onClick={() => {
                                            setBasicAnswer(null);
                                            nextStep();
                                        }}
                                    >
                                        {nextBtnText}
                                    </button>
                                    <div className="row">
                                        <button
                                            type="button"
                                            className="quiet"
                                            id="back"
                                            disabled={step === 0 && introStage === 0}
                                            onClick={() => {
                                                setBasicAnswer(null);
                                                prevStep();
                                            }}
                                        >
                                            {t('common.back', '← Back')}
                                        </button>
                                        <button
                                            type="button"
                                            className="quiet"
                                            id="skip"
                                            onClick={() => {
                                                setBasicAnswer(null);
                                                skipLesson();
                                            }}
                                        >
                                            {isFoundation ? t('common.skipBasics', 'Skip basics') : t('common.skipLesson', 'Skip lesson')}
                                        </button>
                                    </div>
                                    {fallbackOccurred && (
                                        <div id="fallbackNoticeModal" className="muted" style={{ fontSize: '10px', marginTop: '6px', textAlign: 'center' }}>
                                            {t('common.fallbackNotice', 'Standard English fallback displayed for unverified terminology.')}
                                        </div>
                                    )}
                                </div>
                            </aside>
                        </div>

                        {/* Sample Tray */}
                        <div className="sample-tray">
                            <div>
                                <div className="caps">{t('common.practicePassport', 'Practice sample passport')}</div>
                                <span className="tray-id" id="passport">TRAIN-US-00{sampleTube}</span>
                                <span className="muted"> · {t('common.exampleProject', 'SOILFER-US example')}</span>
                            </div>
                            <div className="tubes" id="tubes">
                                {[1, 2, 3, 4, 5].map((n) => (
                                    <button
                                        key={n}
                                        type="button"
                                        className={`tube ${n === sampleTube ? 'active' : ''}`}
                                        data-sample={n}
                                        aria-label={t('aria.sampleTube', 'Focus practice sample {num}').replace('{num}', String(n))}
                                        aria-pressed={n === sampleTube}
                                        onClick={() => setSampleTube(n)}
                                    >
                                        00{n}
                                    </button>
                                ))}
                            </div>
                            <span className="badge clay" id="passportStage">
                                {step < 3 ? t('common.notRealRecord', 'Not a real record') : t('common.practiceContext', 'Practice context only')}
                            </span>
                        </div>

                        <p className="footer-note">{t('common.footerNote')}</p>
                    </main>
                </div>
            </div>
        );
    }

    // =========================================================================
    // RENDER: Docked Guide Mode (Step >= 1: Real Application Page is Visible!)
    // =========================================================================
    return (
        <div
            id="soilfer-tutorial-overlay"
            className={`docked ${location.pathname === '/login' ? 'on-login' : ''}`}
            data-sf-tutorial="root"
            aria-label={t('aria.coach', 'First-visit guide')}
            style={{
                fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
                fontSize: '15px',
                lineHeight: 1.5,
                boxSizing: 'border-box'
            }}
        >
            <aside
                className={`coach ${isCollapsed ? 'coach-collapsed' : ''} ${mobileExpanded ? 'mobile-expanded' : ''}`}
                style={{
                    background: '#fff',
                    border: '1px solid #cbd8c7',
                    borderRadius: isCollapsed ? '12px' : '16px',
                    display: 'flex',
                    flexDirection: 'column'
                }}
            >
                {isCollapsed ? (
                    <div
                        id="coachCollapsedBar"
                        role="region"
                        aria-label={t('coachCollapsed', 'Tutorial coach (collapsed)')}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '6px 10px',
                            background: '#ffffff',
                            borderRadius: '12px',
                            gap: '6px',
                            maxWidth: '100%',
                            boxSizing: 'border-box'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, flexShrink: 1, overflow: 'hidden' }}>
                            <span style={{ fontSize: '14px', flexShrink: 0 }}>🧭</span>
                            <span id="collapsedPosition" style={{ fontSize: '11px', fontWeight: 650, color: '#213b32', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {String(displayStepNum).padStart(2, '0')}/{String(totalStops).padStart(2, '0')} · {currentChapter.nameKey ? t(currentChapter.nameKey) : titleText}
                            </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                            <button
                                type="button"
                                id="expandCoachBtn"
                                className="primary small"
                                onClick={() => setIsCollapsed(false)}
                                title={t('expandGuide', 'Expand guide ↗')}
                                aria-expanded="false"
                                style={{ minHeight: '28px', padding: '3px 8px', fontSize: '11px', whiteSpace: 'nowrap' }}
                            >
                                {t('expandGuide', 'Expand ↗')}
                            </button>
                            <button
                                type="button"
                                id="pauseCollapsedBtn"
                                className="quiet small"
                                onClick={handlePause}
                                title={t('common.pause', 'Pause')}
                                style={{ minHeight: '28px', padding: '3px 6px', fontSize: '11px', whiteSpace: 'nowrap' }}
                            >
                                {t('common.pause', 'Pause')}
                            </button>
                            <button
                                type="button"
                                id="exitCollapsedBtn"
                                className="small"
                                onClick={handleExit}
                                title={t('common.exitGuide', 'Exit guide ↗')}
                                style={{ minHeight: '28px', padding: '3px 8px', fontSize: '11px', whiteSpace: 'nowrap' }}
                            >
                                {t('common.exit', 'Exit')} ✕
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Header Bar */}
                        <div
                            className="coach-top"
                            style={{
                                padding: '10px 14px',
                                borderBottom: '1px solid #dce3da',
                                background: '#fbfaf6',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '6px'
                            }}
                        >
                            {/* Row 1: Context (Badge, Position, Language Selector) */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, overflow: 'hidden' }}>
                                    <span className="badge" style={{ flexShrink: 0 }}>{badgeText}</span>
                                    <span id="position" style={{ fontSize: '11px', fontWeight: 700, color: '#66756e', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {isOffTrack
                                            ? `${t('common.statusUnavailable', 'Outside current track')} (${String(displayStepNum).padStart(2, '0')}/${String(totalStops).padStart(2, '0')})`
                                            : `${String(displayStepNum).padStart(2, '0')} / ${String(totalStops).padStart(2, '0')}`}
                                    </span>
                                </div>

                                {/* In-Guide Language Selector */}
                                <select
                                    value={state.language}
                                    onChange={(e) => setLanguage(e.target.value)}
                                    aria-label={t('common.language', 'Language')}
                                    style={{
                                        width: 'auto',
                                        padding: '2px 6px',
                                        minHeight: '28px',
                                        fontSize: '11px',
                                        flexShrink: 0
                                    }}
                                >
                                    <option value="en">EN</option>
                                    <option value="es">ES</option>
                                    <option value="es-419">ES-419</option>
                                    <option value="fr">FR</option>
                                    <option value="pt">PT</option>
                                </select>
                            </div>

                            {/* Row 2: Action Controls (Minimize, Pause, Exit) */}
                            <div
                                id="coachHeaderActions"
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'flex-end',
                                    gap: '6px',
                                    flexWrap: 'wrap'
                                }}
                            >
                                <button
                                    type="button"
                                    className="quiet small"
                                    id="collapseCoachBtn"
                                    onClick={() => setIsCollapsed(true)}
                                    title={t('collapseGuide', 'Collapse guide ↓')}
                                    aria-expanded="true"
                                    style={{ padding: '3px 8px', minHeight: '28px', fontSize: '11px', whiteSpace: 'nowrap' }}
                                >
                                    {t('collapse', 'Minimize')} —
                                </button>
                                <button
                                    type="button"
                                    className="quiet small"
                                    id="pause"
                                    onClick={handlePause}
                                    style={{ padding: '3px 8px', minHeight: '28px', fontSize: '11px', whiteSpace: 'nowrap' }}
                                >
                                    {t('common.pause', 'Pause')}
                                </button>
                                <button
                                    type="button"
                                    className="small"
                                    id="exit"
                                    onClick={handleExit}
                                    style={{ padding: '3px 10px', minHeight: '28px', fontSize: '11px', whiteSpace: 'nowrap' }}
                                >
                                    {t('common.exitGuide', 'Exit guide ↗')}
                                </button>
                            </div>

                            {/* Verified User / Persona Strip */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: '#66756e', marginTop: '2px' }}>
                                <div
                                    className="avatar"
                                    style={{ width: '22px', height: '22px', fontSize: '10px' }}
                                >
                                    {verifiedUser ? (verifiedUser.name ? verifiedUser.name[0] : 'U') : 'V'}
                                </div>
                                <div>
                                    <b>{verifiedUser ? verifiedUser.name : t('common.notSignedIn', 'Visitor (No account)')}</b>
                                    {verifiedUser && <span className="muted"> · {verifiedUser.role}</span>}
                                </div>
                            </div>

                        {/* Progress Bar */}
                    <div
                        className="progress"
                        role="progressbar"
                        aria-label={t('aria.progress', 'Tutorial progress')}
                        aria-valuemin="0"
                        aria-valuemax={totalStops}
                        aria-valuenow={Math.min(displayStepNum, totalStops)}
                        id="progress"
                        style={{ marginTop: '10px' }}
                    >
                        <span
                            id="progressFill"
                            style={{ width: `${(Math.min(displayStepNum, totalStops) / totalStops) * 100}%` }}
                        ></span>
                    </div>
                </div>

                {/* Body Content */}
                <div className="coach-body" style={{ padding: '18px 20px', flex: 1 }}>
                    <h2 id="coachTitle" tabIndex="-1" ref={coachTitleRef} style={{ fontSize: '20px', margin: '0 0 10px' }}>
                        {titleText}
                    </h2>
                    <p id="coachCopy" style={{ fontSize: '13px', color: '#53665a', lineHeight: 1.6 }}>
                        {copyText}
                    </p>

                    <details style={{ marginTop: '12px' }}>
                        <summary>{t('common.whyThisMatters', 'Why this matters')}</summary>
                        <p id="why" style={{ fontSize: '12px', marginTop: '6px' }}>{whyText}</p>
                    </details>

                    {/* Stage Orientation: Illustrated Overview for Quick Path vs Real Page Orientation for Full/Role Paths */}
                    {chosenPath === 'quick' ? (
                        <div
                            style={{
                                margin: '14px 0',
                                padding: '12px',
                                background: '#f4f7f2',
                                border: '1px solid #dce3da',
                                borderRadius: '8px',
                                fontSize: '12px'
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <span className="badge clay">{t('common.illustrativePage', 'Illustrative overview · no account needed')}</span>
                                <span className="small muted">{t(currentChapter.nameKey)}</span>
                            </div>
                            {renderQuickOverviewDiagram(currentChapter.id)}
                        </div>
                    ) : (
                        <div
                            style={{
                                margin: '14px 0',
                                padding: '12px',
                                background: '#f4f7f2',
                                border: '1px solid #dce3da',
                                borderRadius: '8px',
                                fontSize: '12px'
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                <span className="route" id="route" style={{ fontWeight: 600 }}>{currentChapter.routeDisplay || currentChapter.route}</span>
                                {(currentChapter.resolveRoute || currentChapter.route) && (
                                    <button
                                        type="button"
                                        className="quiet small"
                                        id="goToPage"
                                        onClick={handleNavigateRealPage}
                                        style={{ padding: '2px 8px', minHeight: '26px', color: '#245942', fontWeight: 700 }}
                                    >
                                        {t('goToPage', 'Go to page →')}
                                    </button>
                                )}
                            </div>

                            {/* Anchor Check Indicator */}
                            {targetAnchorStatus === 'found' && (
                                <div style={{ color: '#245942', fontWeight: 600, fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <span>✓</span> {t('targetHighlighted', 'Target element highlighted on this page')}
                                </div>
                            )}
                            {targetAnchorStatus === 'duplicate' && (
                                <div style={{ color: '#b45309', fontWeight: 600, fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <span>⚠</span> {t('duplicateAnchor', 'Multiple matching elements found. Target highlight disabled to prevent ambiguity.')}
                                </div>
                            )}
                            {targetAnchorStatus === 'missing' && (
                                <div className="muted" style={{ fontSize: '11px' }}>
                                    {t('missingAnchor', 'Target element not present on this page view. Docked guidance remains active.')}
                                </div>
                            )}

                            {navNotice && (
                                <div id="navNotice" style={{ marginTop: '8px', padding: '6px 8px', background: '#fee2e2', border: '1px solid #f87171', borderRadius: '4px', color: '#991b1b', fontSize: '11px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span>{navNotice}</span>
                                    <button type="button" onClick={() => setNavNotice(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold', color: '#991b1b' }}>✕</button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Step 1 Identity: Role Track Selector */}
                    {step === 1 && chosenPath !== 'quick' && (
                        <div className="panel" style={{ padding: '12px', marginTop: '10px' }}>
                            <div className="row">
                                <h3 style={{ fontSize: '13px' }}>{t('common.exploreRole', 'Explore a specific role')}</h3>
                                <span className="badge clay">{t('roleTrack', 'Role track')}</span>
                            </div>
                            <label className="label" htmlFor="roleSelect" style={{ marginTop: '8px' }}>
                                {t('common.chooseRoleTrack', 'Choose a role track:')}
                            </label>
                            <select
                                id="roleSelect"
                                value={state.roleChoice}
                                onChange={(e) => setRoleChoice(e.target.value)}
                                style={{ padding: '6px 8px', minHeight: '36px', fontSize: '13px' }}
                            >
                                <option value="reception">{t('common.roleReceptionOfficer', 'Reception officer')}</option>
                                <option value="technician">{t('common.roleLabTechnician', 'Laboratory technician')}</option>
                                <option value="manager">{t('common.roleLabManager', 'Laboratory manager')}</option>
                                <option value="coordinator">{t('common.roleProjectCoordinator', 'Project coordinator')}</option>
                                <option value="viewer">{t('common.roleViewerAuditor', 'Viewer / auditor')}</option>
                            </select>
                            <button
                                type="button"
                                className="primary"
                                id="roleGo"
                                style={{ marginTop: '10px', width: '100%', fontSize: '13px', padding: '8px' }}
                                onClick={() => {
                                    setPath('role');
                                    const stops = PATH_STOPS[`role_${state.roleChoice}`] || PATH_STOPS.full;
                                    setStep(stops[2] || 2);
                                }}
                            >
                                {t('common.startRoleTrack', 'Start this role track →')}
                            </button>
                        </div>
                    )}

                    {/* Step 13 Trace: Sample Map Selection */}
                    {currentChapter.id === 'trace' && (
                        <div className="panel" style={{ marginTop: '10px', padding: '12px' }}>
                            <div className="row">
                                <label htmlFor="sampleIdInput" className="label" style={{ margin: 0, fontWeight: 600 }}>
                                    {t('common.tableSampleId', 'Sample ID')}:
                                </label>
                                <span className="badge">{state.selectedSampleId || t('chapters.trace.noSampleSelected', 'None selected')}</span>
                            </div>
                            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                                <input
                                    id="sampleIdInput"
                                    value={state.selectedSampleId || ''}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        if (sampleLookupAbortRef.current) {
                                            try { sampleLookupAbortRef.current.abort(); } catch {}
                                            sampleLookupAbortRef.current = null;
                                        }
                                        sampleCheckSeqRef.current++;
                                        setNavNotice(null);
                                        if (setSelectedSampleId) setSelectedSampleId(val);
                                        else updateF03('selectedSampleId', val);
                                    }}
                                    placeholder={t('chapters.trace.inputPlaceholder', 'Enter authorized sample ID...')}
                                    style={{ flex: 1, minHeight: '30px', fontSize: '12px' }}
                                />
                                <button
                                    type="button"
                                    className="primary"
                                    id="viewSampleMapBtn"
                                    onClick={handleNavigateRealPage}
                                    style={{ padding: '4px 10px', fontSize: '12px' }}
                                >
                                    {t('chapters.trace.viewMap', 'View Map →')}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Guide-Owned Synthetic Practice Drawer */}
                    {currentChapter.practiceType && (
                        <div style={{ marginTop: '14px' }}>
                            <div className="badge clay practice-tag" style={{ marginBottom: '8px' }}>
                                {t('common.practiceBadge', 'Practice only · no LIMS writes')}
                            </div>

                            {currentChapter.practiceType === 'intake' && (
                                <PracticeIntake
                                    sample={sampleTube}
                                    mass={currentTubePractice.intakeMass}
                                    condition={currentTubePractice.condition}
                                    intakeStatusCode={currentTubePractice.intakeStatusCode}
                                    onUpdate={updatePractice}
                                    onMarkDone={() => markDone(step)}
                                    t={t}
                                />
                            )}

                            {currentChapter.practiceType === 'receipt' && (
                                <PracticeReceipt
                                    sample={{ id: `TRAIN-US-00${sampleTube}`, tube: sampleTube }}
                                    receiptStatusCode={currentTubePractice.receiptStatusCode}
                                    onUpdate={updatePractice}
                                    onMarkDone={() => markDone(step)}
                                    t={t}
                                />
                            )}

                            {currentChapter.practiceType === 'assignment' && (
                                <PracticeAssignment
                                    sample={{ id: `TRAIN-US-00${sampleTube}`, tube: sampleTube }}
                                    assignmentStatusCode={currentTubePractice.assignmentStatusCode}
                                    assignee={currentTubePractice.assignmentAssignee}
                                    onUpdate={updatePractice}
                                    onMarkDone={() => markDone(step)}
                                    t={t}
                                />
                            )}

                            {currentChapter.practiceType === 'prepare' && (
                                <PracticePreparation
                                    checks={currentTubePractice.checks}
                                    prepVerified={currentTubePractice.prepVerified}
                                    onUpdate={updatePractice}
                                    onMarkDone={() => markDone(step)}
                                    t={t}
                                />
                            )}

                            {currentChapter.practiceType === 'bench' && (
                                <PracticeWorksheetPH
                                    sample={sampleTube}
                                    benchValue={currentTubePractice.benchValue}
                                    benchStatusCode={currentTubePractice.benchStatusCode}
                                    onUpdate={updatePractice}
                                    onMarkDone={() => markDone(step)}
                                    t={t}
                                />
                            )}

                            {currentChapter.practiceType === 'texture' && (
                                <PracticeTexture
                                    texture={currentTubePractice.texture}
                                    onUpdate={updatePractice}
                                    onMarkDone={() => markDone(step)}
                                    t={t}
                                />
                            )}

                            {currentChapter.practiceType === 'spectra' && (
                                <PracticeSpectra
                                    sample={sampleTube}
                                    spectrumLoaded={currentTubePractice.spectrumLoaded}
                                    onUpdate={updatePractice}
                                    onMarkDone={() => markDone(step)}
                                    t={t}
                                />
                            )}

                            {currentChapter.practiceType === 'review' && (
                                <PracticeReviewReturn
                                    sample={sampleTube}
                                    reviewReason={currentTubePractice.reviewReason}
                                    reviewSubmitted={currentTubePractice.reviewSubmitted}
                                    onUpdate={updatePractice}
                                    onMarkDone={() => markDone(step)}
                                    t={t}
                                />
                            )}

                            {currentChapter.practiceType === 'resources' && (
                                <PracticeResources
                                    key={`practice-resources-${currentChapter.id}`}
                                    initialResource={currentChapter.id === 'inventory' ? 'inventory' : 'equipment'}
                                    onMarkDone={() => markDone(step)}
                                    t={t}
                                />
                            )}
                        </div>
                    )}

                    {/* Finish step: Next steps and Help links */}
                    {(currentChapter.id === 'finish' || step === chapters.length - 1) && (
                        <div className="panel focus" style={{ marginTop: '14px', padding: '12px' }}>
                            <h3 style={{ fontSize: '13px' }}>{t('beforeYouBegin', 'Before you begin testing')}</h3>
                            <div className="stack small" style={{ marginTop: '8px', fontSize: '12px' }}>
                                <p>{t('practice.finish.step1')}</p>
                                <p>{t('practice.finish.step2')}</p>
                                <p>{t('practice.finish.step3')}</p>
                            </div>
                            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                                <a
                                    href="/help"
                                    className="path"
                                    style={{ flex: 1, padding: '8px', fontSize: '12px', textAlign: 'center', textDecoration: 'none' }}
                                >
                                    {t('practice.finish.helpLink', 'Open Help Centre ↗')}
                                </a>
                                <a
                                    href="https://github.com/yigini/soilfer-lims/issues/new"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="path"
                                    style={{ flex: 1, padding: '8px', fontSize: '12px', textAlign: 'center', textDecoration: 'none' }}
                                >
                                    {t('practice.finish.reportLink', 'Report issue ↗')}
                                </a>
                            </div>
                        </div>
                    )}

                    {/* Sample Tube Selector */}
                    <div className="sample-tray" style={{ marginTop: '14px', padding: '10px 14px' }}>
                        <div>
                            <span className="tray-id" id="passport">TRAIN-US-00{sampleTube}</span>
                            <span className="muted" style={{ fontSize: '11px' }}> · {t('common.exampleProject')}</span>
                        </div>
                        <div className="tubes" id="tubes">
                            {[1, 2, 3, 4, 5].map((n) => (
                                <button
                                    key={n}
                                    type="button"
                                    className={`tube ${n === sampleTube ? 'active' : ''}`}
                                    data-sample={n}
                                    aria-label={t('aria.sampleTube', 'Focus practice sample {num}').replace('{num}', String(n))}
                                    aria-pressed={n === sampleTube}
                                    onClick={() => setSampleTube(n)}
                                    style={{ width: '32px', minHeight: '32px' }}
                                >
                                    00{n}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Curriculum Progress Index */}
                    <details id="curriculumIndex" style={{ marginTop: '12px' }}>
                        <summary style={{ fontSize: '12px', fontWeight: 600, color: '#245942', cursor: 'pointer' }}>
                            {t('common.allChapters', 'Curriculum chapters')} ({(state?.practiced || []).length} {t('common.practiced', 'practiced')}, {(state?.viewed || []).length} {t('common.viewed', 'viewed')})
                        </summary>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '8px' }}>
                            {chapters.map((ch, i) => {
                                const isActive = i === step;
                                const status = getChapterStatus(i);
                                return (
                                    <button
                                        key={ch.id}
                                        type="button"
                                        className={`chapter ${isActive ? 'active' : ''} ${status}`}
                                        data-step={i}
                                        data-status={status}
                                        onClick={() => setStep(i)}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            padding: '6px 10px',
                                            fontSize: '11px',
                                            borderRadius: '6px',
                                            border: isActive ? '1px solid #245942' : '1px solid #e5e7eb',
                                            background: isActive ? '#eaf2e7' : (status === 'practiced' ? '#f0fdf4' : (status === 'viewed' ? '#f8fafc' : '#fff')),
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <span style={{ fontWeight: 700, width: '18px', color: status === 'practiced' ? '#065f46' : (status === 'viewed' ? '#0369a1' : 'inherit') }}>
                                                {getChapterStatusIcon(status, i)}
                                            </span>
                                            <span>{t(ch.nameKey)}</span>
                                        </div>
                                        <span className="small muted">
                                            {getChapterStatusLabel(status)}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </details>

                    {/* Glossary */}
                    <details id="glossary" style={{ marginTop: '12px' }}>
                        <summary>{t('common.wordsUsedHere', 'Words used here')}</summary>
                        {glossaryList.map((item) => (
                            <p key={item.term} style={{ fontSize: '12px', marginTop: '6px' }}>
                                <b>{item.termKey ? t(item.termKey, item.term) : item.term}</b> · {t(item.meaningKey)}
                            </p>
                        ))}
                    </details>

                    <div className="lesson-complete" aria-live="polite" id="completion">
                        {doneSet.has(step) ? t('common.lessonExplored', 'Lesson explored. You can revisit it.') : ''}
                    </div>
                </div>

                {/* Footer Controls */}
                <div
                    className="coach-foot"
                    style={{
                        padding: '12px 18px',
                        borderTop: '1px solid #dce3da',
                        background: '#fbfaf6',
                        display: 'grid',
                        gap: '8px'
                    }}
                >
                    <button
                        type="button"
                        id="mobileToggle"
                        aria-expanded={mobileExpanded ? 'true' : 'false'}
                        onClick={() => setMobileExpanded(!mobileExpanded)}
                    >
                        {mobileExpanded
                            ? t('common.collapseGuide', 'Collapse guide ↓')
                            : t('common.readStepUp', 'Read this step ↑')}
                    </button>

                    <button
                        type="button"
                        className="primary"
                        id="next"
                        onClick={nextStep}
                    >
                        {nextBtnText}
                    </button>

                    <div className="row" style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <button
                            type="button"
                            className="quiet"
                            id="back"
                            onClick={prevStep}
                        >
                            {t('common.back', '← Back')}
                        </button>
                        <button
                            type="button"
                            className="quiet"
                            id="skip"
                            onClick={skipLesson}
                        >
                            {t('common.skipLesson', 'Skip lesson')}
                        </button>
                    </div>
                    {fallbackOccurred && (
                        <div id="fallbackNotice" className="muted" style={{ fontSize: '10px', marginTop: '8px', textAlign: 'center' }}>
                            {t('common.fallbackNotice', 'Standard English fallback displayed for unverified terminology.')}
                        </div>
                    )}
                </div>
                    </>
                )}
            </aside>

            {/* Draft Warning Confirmation Dialog */}
            {showDraftDialog && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.5)',
                        zIndex: 9999,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '16px'
                    }}
                    role="alertdialog"
                    aria-modal="true"
                    aria-labelledby="draft-warning-title"
                >
                    <div
                        style={{
                            background: '#ffffff',
                            borderRadius: '12px',
                            padding: '20px',
                            maxWidth: '440px',
                            width: '100%',
                            boxShadow: '0 8px 30px rgba(0,0,0,0.25)',
                            border: '1px solid #dce3da'
                        }}
                    >
                        <h4 id="draft-warning-title" style={{ margin: '0 0 10px', fontSize: '15px', fontWeight: 700, color: '#213b32' }}>
                            {t('unsavedDraftWarning', 'You have unsaved changes on this page. Discard changes and navigate to this lesson?')}
                        </h4>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '18px' }}>
                            <button
                                type="button"
                                className="quiet"
                                id="draftCancelBtn"
                                onClick={() => {
                                    setShowDraftDialog(false);
                                    setPendingNavigateUrl(null);
                                }}
                                style={{ padding: '6px 14px', fontSize: '13px' }}
                            >
                                {t('common.cancel', 'Cancel')}
                            </button>
                            <button
                                type="button"
                                className="primary"
                                id="draftDiscardBtn"
                                onClick={() => {
                                    confirmedDraftRevRef.current = outsideEditRevRef.current;
                                    setShowDraftDialog(false);
                                    const url = pendingNavigateUrl;
                                    setPendingNavigateUrl(null);
                                    performNavigation(url);
                                }}
                                style={{ padding: '6px 14px', fontSize: '13px' }}
                            >
                                {t('common.discardAndProceed', 'Discard & Proceed')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
