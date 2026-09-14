import React, { useState, useEffect, useMemo, useRef } from 'react';
import './tutorial.css';
import { useTutorialSession } from './useTutorialSession';
import { chapters } from './content/chapters';
import { foundations, glossaryEntriesByChapter } from './content/foundations';

import PracticeIntake from './practice/PracticeIntake';
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

export default function TutorialShell() {
    const {
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
    } = useTutorialSession();

    const [mobileExpanded, setMobileExpanded] = useState(false);
    const [basicAnswer, setBasicAnswer] = useState(null); // { isCorrect: boolean, text: string }
    const coachTitleRef = useRef(null);

    // Escape listener to pause
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && !state.paused) {
                pause();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [state.paused, pause]);

    // Focus title when step changes
    useEffect(() => {
        if (coachTitleRef.current) {
            coachTitleRef.current.focus({ preventScroll: true });
        }
    }, [state.step, state.introStage]);

    // Active translation dictionary
    const dict = LOCALES[state.language] || LOCALES.en;

    const t = useMemo(() => {
        return (keyPath, fallback = '') => {
            const parts = keyPath.split('.');
            let curr = dict;
            for (const p of parts) {
                if (!curr || typeof curr !== 'object') return fallback || keyPath;
                curr = curr[p];
            }
            return curr !== undefined ? curr : (fallback || keyPath);
        };
    }, [dict]);

    if (!state.active) return null;

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
                        zIndex: 99999,
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

    const { step, introStage, sampleTube, path: chosenPath, done, skipped } = state;
    const isFoundation = step === 0 && introStage < 3;
    const currentFoundation = isFoundation ? foundations[introStage] : null;
    const currentChapter = chapters[step] || chapters[0];

    // Navigation logic
    const handleNext = () => {
        setBasicAnswer(null);
        if (step === 0 && introStage < 3) {
            setIntroStage(introStage + 1);
            return;
        }

        markDone(step);

        if (step === 11) {
            setStep(0);
            setIntroStage(0);
        } else if (chosenPath === 'quick') {
            const quickStops = [0, 1, 2, 3, 5, 7, 9, 10, 11];
            const nextStop = quickStops.find(i => i > step) ?? 11;
            setStep(nextStop);
        } else {
            setStep(step + 1);
        }
    };

    const handleBack = () => {
        setBasicAnswer(null);
        if (step === 0 && introStage > 0) {
            setIntroStage(introStage - 1);
        } else {
            setStep(Math.max(0, step - 1));
        }
    };

    const handleSkip = () => {
        setBasicAnswer(null);
        if (step === 0 && introStage < 3) {
            setIntroStage(3); // Skip straight to welcome choices
            return;
        }
        markSkipped(step);
        setStep(Math.min(11, step + 1));
    };

    const handleAnswerCheck = (opt) => {
        const feedback = opt.isCorrect
            ? t(currentFoundation.feedbackCorrectKey)
            : t(currentFoundation.feedbackIncorrectKey);
        setBasicAnswer({
            isCorrect: opt.isCorrect,
            text: feedback
        });
    };

    const doneSet = new Set(done);
    const titleText = isFoundation ? t(currentFoundation.titleKey) : t(currentChapter.titleKey);
    const copyText = isFoundation ? t(currentFoundation.copyKey) : t(currentChapter.copyKey);
    const whyText = isFoundation ? t(currentFoundation.whyKey) : t(currentChapter.whyKey);
    const nextBtnText = isFoundation ? t(currentFoundation.nextKey) : t(currentChapter.nextKey);
    const badgeText = isFoundation ? t('foundation.f01.subtitle', 'Start here · no account needed') : t(currentChapter.nameKey);

    const glossaryList = glossaryEntriesByChapter[step] || glossaryEntriesByChapter.default;

    return (
        <div
            id="soilfer-tutorial-overlay"
            data-sf-tutorial="root"
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 99998,
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
                <b>{t('common.previewBarTitle', 'DESIGN PREVIEW · NOT THE LIVE LIMS')}</b>
                <span>{t('common.previewBarSubtitle', 'Interactive sketches · all records and actions are simulated')}</span>
                <span className="date">{t('common.previewBarDate', '14 September 2026')}</span>
            </div>

            {/* Application Header Bar */}
            <header className="top">
                <div className="brand">
                    <span className="mark" aria-hidden="true"></span>
                    SoilFER <span className="muted" style={{ fontWeight: 400 }}>LIMS</span>
                </div>
                <div className="top-tools">
                    <span className="badge">{t('common.previewBarTitle', 'First-visit guide')}</span>
                    <button
                        type="button"
                        className="quiet"
                        id="pause"
                        onClick={pause}
                    >
                        {t('common.pause', 'Pause')}
                    </button>
                    <button
                        type="button"
                        id="exit"
                        onClick={exitTutorial}
                    >
                        {t('common.exitGuide', 'Exit guide ↗')}
                    </button>
                </div>
            </header>

            {/* Layout Body */}
            <div className="layout" id="layout">
                {/* Chapters Navigation */}
                <nav className="chapters" aria-label="Tutorial chapters" id="chapters">
                    <div className="caps">Follow the sample</div>
                    {chapters.map((ch, i) => {
                        const isActive = i === step;
                        const isDone = doneSet.has(i);
                        return (
                            <button
                                key={ch.id}
                                type="button"
                                className={`chapter ${isActive ? 'active' : ''} ${isDone ? 'done' : ''}`}
                                data-step={i}
                                aria-current={isActive ? 'step' : undefined}
                                onClick={() => {
                                    setStep(i);
                                    setBasicAnswer(null);
                                    if (i === 0) setIntroStage(3);
                                }}
                            >
                                <i>{isDone ? '✓' : String(i + 1).padStart(2, '0')}</i>
                                <span>{t(ch.nameKey)}</span>
                            </button>
                        );
                    })}
                    <div className="sideFoot">
                        <strong>You set the pace.</strong>
                        Skip a lesson, pause the guide, or return to a chapter.
                    </div>
                </nav>

                {/* Main Interactive Stage */}
                <main className="stage">
                    <div className="stage-top">
                        <div>
                            <div className="caps">A guided laboratory visit</div>
                            <p id="stageCaption">{t('common.stageSubtitle', 'One sample to follow. Five to keep in view.')}</p>
                        </div>
                        <div className="role">
                            <div className="avatar" id="avatar">
                                {isFoundation ? 'V' : t(currentChapter.roleKey)[0]}
                            </div>
                            <div>
                                <b id="roleLabel">{isFoundation ? t('roles.visitor', 'Visitor') : t(currentChapter.roleKey)}</b>
                                <div className="muted small">{t('common.previewPersona', 'Preview persona · not a signed-in account')}</div>
                            </div>
                        </div>
                    </div>

                    <div className="workspace">
                        {/* Illustrative Application Screen */}
                        <section className="app-frame" aria-label="Illustrative application screen">
                            <div className="frame-bar">
                                <span className="route" id="route">
                                    {isFoundation ? '/login?tutorialmode=true' : currentChapter.route}
                                </span>
                                <span className="badge clay">{t('common.illustrativePage', 'Illustrative page')}</span>
                            </div>

                            <div className="page" id="page">
                                {/* Screen Contents Based on Step */}
                                {isFoundation ? (
                                    <>
                                        <div className="caps">{t(currentFoundation.subtitleKey)}</div>
                                        <h1 style={{ margin: '16px 0' }}>{t(currentFoundation.titleKey)}</h1>
                                        <p className="welcome-lead">
                                            <b>LIMS</b> means <b>Laboratory Information Management System</b>. {t(currentFoundation.leadKey)}
                                        </p>

                                        {introStage === 0 && (
                                            <div className="panel focus">
                                                <h3>{t(currentFoundation.panelTitleKey)}</h3>
                                                <div className="flow">
                                                    <div className="flow-node"><b>1</b><strong>Receive & identify</strong><span>Reception team</span></div>
                                                    <div className="flow-node"><b>2</b><strong>Prepare & analyse</strong><span>Technician</span></div>
                                                    <div className="flow-node"><b>3</b><strong>Check & report</strong><span>Reviewer</span></div>
                                                </div>
                                                <p className="small muted">People perform the laboratory work. The platform keeps the connected records.</p>
                                            </div>
                                        )}

                                        {introStage === 1 && (
                                            <>
                                                <div className="panel">
                                                    <div className="row"><h3>Laboratory</h3><span className="muted small">The facility and team</span></div>
                                                    <div className="row" style={{ marginTop: '12px' }}><h3>Project</h3><span className="muted small">Related samples and work</span></div>
                                                    <p className="notice">A project may involve more than one laboratory.</p>
                                                </div>
                                                <div className="panel focus">
                                                    <span className="badge clay">Example sample · TRAIN-US-001</span>
                                                    <div className="flow">
                                                        <div className="flow-node"><b>A</b><strong>Sample record</strong><span>Identity & progress</span></div>
                                                        <div className="flow-node"><b>B</b><strong>Tasks & results</strong><span>pH · texture</span></div>
                                                        <div className="flow-node"><b>C</b><strong>Report</strong><span>Authorized results</span></div>
                                                    </div>
                                                    <p className="small muted">The field identifier links to collection. The laboratory identifier helps you match the container to its record.</p>
                                                </div>
                                            </>
                                        )}

                                        {introStage === 2 && (
                                            <div className="stack">
                                                <div className="flow-node"><b>⌂</b><strong>Home</strong><span>What needs attention</span></div>
                                                <div className="flow-node"><b>1</b><strong>Samples</strong><span>Find identity & history</span></div>
                                                <div className="flow-node focus"><b>2</b><strong>Workbench</strong><span>Record assigned work</span></div>
                                                <div className="flow-node"><b>3</b><strong>Review queue</strong><span>Check submitted work</span></div>
                                                <div className="flow-node"><b>?</b><strong>Reports & Help</strong><span>Find results & guidance</span></div>
                                            </div>
                                        )}

                                        {/* Comprehension Check */}
                                        <div className="panel">
                                            <h3>A quick check</h3>
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
                                    <>
                                        {/* Chapter 0 (Welcome choice screen) */}
                                        {step === 0 && (
                                            <>
                                                <div className="login-grid">
                                                    <div>
                                                        <div className="caps">Welcome to SoilFER</div>
                                                        <h1 style={{ marginTop: '15px' }}>From field to<br />trusted result.</h1>
                                                        <p className="welcome-lead" style={{ marginTop: '17px' }}>
                                                            A guided introduction to the people, steps and evidence behind every sample.
                                                        </p>
                                                        <div className="path-grid">
                                                            <button
                                                                type="button"
                                                                className={`path ${chosenPath === 'full' ? 'active' : ''}`}
                                                                data-path="full"
                                                                onClick={() => setPath('full')}
                                                            >
                                                                <span>Follow a sample<small>The full laboratory story</small></span>
                                                                <span>16–18 min →</span>
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className={`path ${chosenPath === 'quick' ? 'active' : ''}`}
                                                                data-path="quick"
                                                                onClick={() => setPath('quick')}
                                                            >
                                                                <span>Show me the platform<small>A short first impression</small></span>
                                                                <span>3 min →</span>
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className={`path ${chosenPath === 'role' ? 'active' : ''}`}
                                                                data-path="role"
                                                                onClick={() => setPath('role')}
                                                            >
                                                                <span>Learn my role<small>Start where your work happens</small></span>
                                                                <span>4–8 min →</span>
                                                            </button>
                                                        </div>
                                                        <div className="path-choice" id="pathInfo">
                                                            {chosenPath === 'quick'
                                                                ? 'The next button will follow the short overview.'
                                                                : chosenPath === 'role'
                                                                    ? 'Choose your role on the next screen.'
                                                                    : 'The full laboratory story is selected.'}
                                                        </div>
                                                    </div>

                                                    <div className="login-form">
                                                        <h3 style={{ marginBottom: '18px' }}>Sign in to your laboratory</h3>
                                                        <label className="label">
                                                            Username
                                                            <input disabled placeholder="Your assigned account" />
                                                        </label>
                                                        <label className="label">
                                                            Password
                                                            <input disabled type="password" placeholder="Provided by your facilitator" />
                                                        </label>
                                                        <button disabled className="primary">Sign in</button>
                                                        <p>This is a sketch of the existing login screen. No credentials are entered or sent in this preview.</p>
                                                    </div>
                                                </div>

                                                <div className="horizon">
                                                    <svg viewBox="0 0 700 120" preserveAspectRatio="none" aria-hidden="true">
                                                        <path fill="#bec8a2" d="M0 48Q140 5 300 46T700 23V120H0Z" />
                                                        <path fill="#d6b489" d="M0 70Q220 33 430 68T700 58V120H0Z" />
                                                        <path fill="#a77a53" d="M0 94Q130 55 370 88T700 82V120H0Z" />
                                                        <path fill="#725239" d="M0 110Q180 88 420 112T700 105V120H0Z" />
                                                    </svg>
                                                </div>
                                            </>
                                        )}

                                        {/* Chapter 1: Identity */}
                                        {step === 1 && (
                                            <>
                                                <div className="caps">The team behind a sample</div>
                                                <h2>Different roles. One handover.</h2>
                                                <p className="muted">These are learning personas, not permission changes.</p>
                                                <div className="stack">
                                                    <div className="flow-node focus"><b>1</b><strong>Reception</strong><span>Arrival & identity</span></div>
                                                    <div className="flow-node"><b>2</b><strong>Technician</strong><span>Preparation & analysis</span></div>
                                                    <div className="flow-node"><b>3</b><strong>Lab manager</strong><span>Review & release</span></div>
                                                </div>
                                                <div className="panel">
                                                    <div className="row">
                                                        <h3>Your learning path</h3>
                                                        <span className="badge clay">Preview selection</span>
                                                    </div>
                                                    <label className="label" htmlFor="roleSelect">Choose a role to explore</label>
                                                    <select
                                                        id="roleSelect"
                                                        value={state.roleChoice}
                                                        onChange={(e) => setRoleChoice(e.target.value)}
                                                    >
                                                        <option value="3">Reception officer</option>
                                                        <option value="4">Laboratory technician</option>
                                                        <option value="8">Laboratory manager</option>
                                                        <option value="2">Project coordinator</option>
                                                        <option value="9">Viewer / auditor</option>
                                                    </select>
                                                    <button
                                                        type="button"
                                                        className="primary"
                                                        id="roleGo"
                                                        style={{ marginTop: '13px' }}
                                                        onClick={() => {
                                                            const targetStep = Number(state.roleChoice) || 3;
                                                            setStep(targetStep);
                                                        }}
                                                    >
                                                        Explore this role →
                                                    </button>
                                                    <p className="notice">In the actual guide, account switching uses normal logout and login. Passwords are supplied separately.</p>
                                                </div>
                                            </>
                                        )}

                                        {/* Chapter 2: Field */}
                                        {step === 2 && (
                                            <>
                                                <div className="caps">Project · SOILFER-US example</div>
                                                <h2>From the field, with context.</h2>
                                                <p className="muted">Illustrative project summary, not current production counts.</p>
                                                <div className="metric-grid">
                                                    <div className="metric focus"><strong>5</strong><span>Expected samples</span></div>
                                                    <div className="metric"><strong>0</strong><span>Physically received</span></div>
                                                    <div className="metric"><strong>0</strong><span>Released results</span></div>
                                                </div>
                                                <div className="panel">
                                                    <div className="row">
                                                        <h3>Field provenance</h3>
                                                        <span className="badge">Kobo example</span>
                                                    </div>
                                                    <p className="small muted">Field ID · Collection record · Site / location · Source reference</p>
                                                    <div className="table-wrap" style={{ marginTop: '12px' }}>
                                                        <table>
                                                            <thead>
                                                                <tr>
                                                                    <th>Practice sample</th>
                                                                    <th>Field identifier</th>
                                                                    <th>State</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {[1, 2, 3, 4, 5].map(n => (
                                                                    <tr key={n}>
                                                                        <td><b>TRAIN-US-00{n}</b></td>
                                                                        <td>GTM-DEMO-{100 + n}</td>
                                                                        <td><span className="badge">Expected</span></td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                                <p className="notice">No field collection, import or connector call occurs in this preview.</p>
                                            </>
                                        )}

                                        {/* Chapter 3: Intake */}
                                        {step === 3 && (
                                            <>
                                                <div className="badge clay practice-tag">{t('practice.tag')}</div>
                                                <div className="caps">Receive one sample</div>
                                                <h2>TRAIN-US-00{sampleTube}</h2>
                                                <p className="muted">Field ID GTM-DEMO-{100 + sampleTube} · SOILFER-US example · Guatemala demonstration site</p>
                                                <PracticeIntake
                                                    sample={sampleTube}
                                                    mass={state.intakeMass}
                                                    condition={state.condition}
                                                    onUpdate={updatePractice}
                                                    onMarkDone={() => markDone(3)}
                                                    t={t}
                                                />
                                                <p className="notice">A real receipt records custody and arrival. This button only checks the exercise above.</p>
                                            </>
                                        )}

                                        {/* Chapter 4: Prepare */}
                                        {step === 4 && (
                                            <>
                                                <div className="badge clay practice-tag">{t('practice.tag')}</div>
                                                <div className="caps">Technician · procedural work</div>
                                                <h2>Prepare the material.</h2>
                                                <p className="muted">TRAIN-US-00{sampleTube} · illustrative preparation checkpoint</p>
                                                <PracticePreparation
                                                    checks={state.checks}
                                                    onUpdate={updatePractice}
                                                    onMarkDone={() => markDone(4)}
                                                    t={t}
                                                />
                                                <p className="notice">In the real lab, follow the configured SOP. Physical drying is not accelerated by a tutorial.</p>
                                            </>
                                        )}

                                        {/* Chapter 5: Bench */}
                                        {step === 5 && (
                                            <>
                                                <div className="badge clay practice-tag">{t('practice.tag')}</div>
                                                <div className="row">
                                                    <div>
                                                        <div className="caps">Method worksheet</div>
                                                        <h2>pH in water</h2>
                                                    </div>
                                                    <span className="badge">5 practice samples</span>
                                                </div>
                                                <p className="muted" style={{ marginTop: '12px' }}>Same method, stable sample rows, one clear handover.</p>
                                                <PracticeWorksheetPH
                                                    sample={sampleTube}
                                                    benchValue={state.benchValue}
                                                    onUpdate={updatePractice}
                                                    onMarkDone={() => markDone(5)}
                                                    t={t}
                                                />
                                            </>
                                        )}

                                        {/* Chapter 6: Texture */}
                                        {step === 6 && (
                                            <>
                                                <div className="badge clay practice-tag">{t('practice.tag')}</div>
                                                <div className="caps">Grouped determination</div>
                                                <h2>Soil texture fractions</h2>
                                                <p className="muted">TRAIN-US-00{sampleTube} · one result with three components</p>
                                                <PracticeTexture
                                                    texture={state.texture}
                                                    onUpdate={updatePractice}
                                                    onMarkDone={() => markDone(6)}
                                                    t={t}
                                                />
                                            </>
                                        )}

                                        {/* Chapter 7: Spectra */}
                                        {step === 7 && (
                                            <>
                                                <div className="badge clay practice-tag">{t('practice.tag')}</div>
                                                <div className="caps">MIR / NIR · evidence first</div>
                                                <h2>More than a single number.</h2>
                                                <p className="muted">Inspect the source, sample link and signal before review.</p>
                                                <PracticeSpectra
                                                    sample={sampleTube}
                                                    spectrumLoaded={state.spectrumLoaded}
                                                    onUpdate={updatePractice}
                                                    onMarkDone={() => markDone(7)}
                                                    t={t}
                                                />
                                            </>
                                        )}

                                        {/* Chapter 8: Review */}
                                        {step === 8 && (
                                            <>
                                                <div className="badge clay practice-tag">{t('practice.tag')}</div>
                                                <div className="caps">Manager · submitted package</div>
                                                <h2>A clear review handover.</h2>
                                                <p className="muted">Illustrative submitted result. No actual approval occurs here.</p>
                                                <PracticeReviewReturn
                                                    sample={sampleTube}
                                                    reviewReason={state.reviewReason}
                                                    onUpdate={updatePractice}
                                                    onMarkDone={() => markDone(8)}
                                                    t={t}
                                                />
                                            </>
                                        )}

                                        {/* Chapter 9: Trace */}
                                        {step === 9 && (
                                            <>
                                                <div className="caps">Traceability · illustrative history</div>
                                                <h2>See how each step connects.</h2>
                                                <p className="muted">The real map reflects authoritative records and dependencies.</p>
                                                <div className="flow">
                                                    <div className="flow-node"><b>1</b><strong>Arrival</strong><span>Identity & custody</span></div>
                                                    <div className="flow-node"><b>2</b><strong>Preparation</strong><span>Configured evidence</span></div>
                                                    <div className="flow-node focus"><b>3</b><strong>Analysis → review</strong><span>Result & decision</span></div>
                                                    <div className="flow-node"><b>4</b><strong>Report release</strong><span>Version & history</span></div>
                                                </div>
                                                <div className="panel">
                                                    <div className="row">
                                                        <h3>Report passport</h3>
                                                        <span className="badge clay">Example only</span>
                                                    </div>
                                                    <div className="split small" style={{ marginTop: '14px' }}>
                                                        <div><b>Result</b><br />Method, unit and revision</div>
                                                        <div><b>Trace</b><br />Recorded by, reviewed by, released version</div>
                                                    </div>
                                                </div>
                                                <p className="notice">No report generated, released, shared or printed by this preview.</p>
                                            </>
                                        )}

                                        {/* Chapter 10: Resources */}
                                        {step === 10 && (
                                            <>
                                                <div className="caps">The wider laboratory</div>
                                                <h2>Everything has a place.</h2>
                                                <p className="muted">Choose a connection to see what the first-time guide explains.</p>
                                                <PracticeResources
                                                    onMarkDone={() => markDone(10)}
                                                    t={t}
                                                />
                                            </>
                                        )}

                                        {/* Chapter 11: Finish */}
                                        {step === 11 && (
                                            <>
                                                <div className="caps">The next step is yours</div>
                                                <h1 style={{ margin: '18px 0' }}>Know your role.<br />Follow the evidence.</h1>
                                                <p className="muted">You do not need to remember every menu. Start with the next task assigned to you.</p>
                                                <div className="panel focus">
                                                    <h3>Before you begin testing</h3>
                                                    <div className="stack small" style={{ marginTop: '15px' }}>
                                                        <p>01 &nbsp; Confirm your account, laboratory and testing role.</p>
                                                        <p>02 &nbsp; Use only the designated test samples.</p>
                                                        <p>03 &nbsp; Report one distinct problem per GitHub issue.</p>
                                                    </div>
                                                </div>
                                                <div className="panel">
                                                    <h3>Your visit</h3>
                                                    <p className="small muted">
                                                        {done.length} lessons explored · {skipped.length} skipped<br />
                                                        Practice activity is learning progress, not laboratory completion.
                                                    </p>
                                                </div>
                                                <p className="notice">This design preview has no connection to LIMS. The Help Centre remains the reference for detailed instructions.</p>
                                            </>
                                        )}
                                    </>
                                )}
                            </div>
                        </section>

                        {/* Docked Coach Aside */}
                        <aside className={`coach ${mobileExpanded ? 'mobile-expanded' : ''}`} aria-label="First-visit guide">
                            <div className="coach-top">
                                <div className="row">
                                    <strong>{t('common.yourLabVisit', 'YOUR LAB VISIT')}</strong>
                                    <span id="position">
                                        {isFoundation
                                            ? `Basics ${introStage + 1} / 3`
                                            : `${String(step + 1).padStart(2, '0')} / ${chapters.length}`}
                                    </span>
                                </div>
                                <div
                                    className="progress"
                                    role="progressbar"
                                    aria-label="Tutorial progress"
                                    aria-valuemin="0"
                                    aria-valuemax="12"
                                    aria-valuenow={step + 1}
                                    id="progress"
                                >
                                    <span
                                        id="progressFill"
                                        style={{ width: `${((step + 1) / chapters.length) * 100}%` }}
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
                                            <b>{item.term}</b> · {t(item.meaningKey)}
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
                                    onClick={handleNext}
                                >
                                    {nextBtnText}
                                </button>

                                <div className="row">
                                    <button
                                        type="button"
                                        className="quiet"
                                        id="back"
                                        disabled={step === 0 && introStage === 0}
                                        onClick={handleBack}
                                    >
                                        {t('common.back', '← Back')}
                                    </button>
                                    <button
                                        type="button"
                                        className="quiet"
                                        id="skip"
                                        onClick={handleSkip}
                                    >
                                        {isFoundation ? t('common.skipBasics', 'Skip basics') : t('common.skipLesson', 'Skip lesson')}
                                    </button>
                                </div>
                            </div>
                        </aside>
                    </div>

                    {/* Bottom Practice Sample Passport Tray */}
                    <div className="sample-tray">
                        <div>
                            <div className="caps">{t('common.practicePassport', 'Practice sample passport')}</div>
                            <span className="tray-id" id="passport">TRAIN-US-00{sampleTube}</span>
                            <span className="muted"> · {t('common.exampleProject', 'SOILFER-US example')}</span>
                        </div>
                        <div className="tubes" id="tubes">
                            {[1, 2, 3, 4, 5].map(n => (
                                <button
                                    key={n}
                                    type="button"
                                    className={`tube ${n === sampleTube ? 'active' : ''}`}
                                    data-sample={n}
                                    aria-label={`Focus practice sample ${n}`}
                                    aria-pressed={n === sampleTube ? 'true' : 'false'}
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

                    <p className="footer-note">
                        {t('common.footerNote', 'First-visit guide available in English, Spanish, Latin American Spanish, French, and Portuguese.')}
                    </p>
                </main>
            </div>
        </div>
    );
}
