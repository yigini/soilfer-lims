import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
    Search,
    Compass,
    PackageCheck,
    FlaskConical,
    ClipboardCheck,
    Microscope,
    DownloadCloud,
    Network,
    Settings2,
    HelpCircle,
    ChevronRight,
    ArrowRight,
    ArrowLeft,
    Clock,
    Send,
    X,
    CheckCircle2,
    AlertCircle,
    Loader2,
    WifiOff,
    Mail,
    Building2,
    ExternalLink,
    BookOpen,
    Layers,
    LifeBuoy,
    CheckSquare,
    Flame,
    FileText,
    ShieldCheck,
    UserCheck,
    RefreshCw
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import helpClientService from '../../services/helpClientService';
import clsx from 'clsx';

const ROLE_DEFINITIONS = [
    { id: 'LAB_TECHNICIAN', label: 'Laboratory technician', tasks: ['bench-batch', 'prep-drying', 'method-spectral-import'] },
    { id: 'SAMPLE_RECEPTION', label: 'Intake officer', tasks: ['intake-project', 'intake-draft', 'intake-location'] },
    { id: 'LAB_MANAGER', label: 'Laboratory manager', tasks: ['review-submission', 'review-assign', 'review-final'] },
    { id: 'PROJECT_MANAGER', label: 'Project manager', tasks: ['connect-project', 'connect-progress', 'connect-sis'] },
    { id: 'SURVEYOR', label: 'Field surveyor', tasks: ['connect-surveyor', 'connect-kobo', 'connect-field-fix'] },
    { id: 'AUDIT_USER', label: 'Quality & audit reader', tasks: ['quality-audit', 'quality-qc', 'quality-history'] },
    { id: 'VIEWER', label: 'Laboratory viewer', tasks: ['start-viewer', 'tracking-find', 'review-report'] },
    { id: 'EXTERNAL_VIEWER', label: 'External report viewer', tasks: ['review-share', 'review-report', 'start-viewer'] },
    { id: 'MASTER_USER', label: 'Platform coordinator', tasks: ['admin-catalogue', 'admin-translation', 'admin-help'] },
    { id: 'SUPER_ADMIN', label: 'System administrator', tasks: ['admin-users', 'admin-labs', 'admin-integrations'] }
];

const TOPIC_ICONS = {
    start: Compass,
    intake: PackageCheck,
    tracking: Network,
    preparation: CheckSquare,
    bench: FlaskConical,
    methods: Microscope,
    review: ClipboardCheck,
    assets: Microscope,
    offline: DownloadCloud,
    connect: Network,
    admin: Settings2,
    quality: ShieldCheck
};

export const HelpCentre = () => {
    const { t, locale } = useLanguage();
    const { user } = useAuth();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    // Active screen: 'home' | 'problem' | 'learn' | 'library' | 'faq'
    const currentTab = searchParams.get('tab') || 'home';
    const activeTopic = searchParams.get('topic') || 'all';

    // User's effective role or reading persona
    const initialRole = useMemo(() => {
        const userRole = user?.role ? user.role.toUpperCase() : 'LAB_TECHNICIAN';
        const found = ROLE_DEFINITIONS.find(r => r.id === userRole);
        return found ? found.id : 'LAB_TECHNICIAN';
    }, [user?.role]);

    const [selectedRole, setSelectedRole] = useState(initialRole);
    const [topics, setTopics] = useState([]);
    const [allArticles, setAllArticles] = useState([]);
    const [faqs, setFaqs] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [loading, setLoading] = useState(true);
    const [isOffline, setIsOffline] = useState(false);
    const [lastSync, setLastSync] = useState(null);

    // Problem Solver state
    const [problemStep, setProblemStep] = useState('start');

    // Support Modal State (Finding 8 truthful flow)
    const [isSupportOpen, setIsSupportOpen] = useState(false);
    const [supportConfig, setSupportConfig] = useState(null);
    const [loadingSupport, setLoadingSupport] = useState(false);
    const [supportSubject, setSupportSubject] = useState('');
    const [supportText, setSupportText] = useState('');
    const [supportStatus, setSupportStatus] = useState(null);

    // Fetch topics, articles and FAQs on mount or locale change
    useEffect(() => {
        let isMounted = true;
        setLoading(true);

        Promise.all([
            helpClientService.getTopics({ locale, user }),
            helpClientService.getArticles({ locale, user }),
            helpClientService.getFaqs({ locale, user })
        ])
            .then(([topicsRes, articlesRes, faqsRes]) => {
                if (!isMounted) return;
                setTopics(topicsRes.topics || []);
                setAllArticles(articlesRes.articles || []);
                setFaqs(faqsRes.faqs || []);
                setIsOffline(topicsRes.isOffline || articlesRes.isOffline || false);
                setLastSync(topicsRes.lastSync || articlesRes.lastSync || null);
            })
            .catch(err => {
                console.warn('[HELP_CENTRE] Failed to load help data:', err.message);
            })
            .finally(() => {
                if (isMounted) setLoading(false);
            });

        return () => { isMounted = false; };
    }, [locale, user]);

    // Live search debounced
    useEffect(() => {
        const query = searchQuery.trim();
        if (!query) {
            setSearchResults([]);
            setIsSearching(false);
            return;
        }

        const timer = setTimeout(() => {
            setIsSearching(true);
            helpClientService.searchHelp({ query, locale, user })
                .then(res => {
                    setSearchResults(res.results || []);
                    if (res.isOffline) setIsOffline(true);
                })
                .catch(err => {
                    console.warn('[HELP_CENTRE] Search failed:', err.message);
                })
                .finally(() => {
                    setIsSearching(false);
                });
        }, 200);

        return () => clearTimeout(timer);
    }, [searchQuery, locale, user]);

    const handleTabChange = (newTab, topicId = null) => {
        const params = new URLSearchParams(searchParams);
        params.set('tab', newTab);
        if (topicId) {
            params.set('topic', topicId);
        } else if (newTab !== 'library') {
            params.delete('topic');
        }
        setSearchParams(params);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // Load support config when opening modal
    const handleOpenSupport = async () => {
        setIsSupportOpen(true);
        setLoadingSupport(true);
        setSupportStatus(null);
        try {
            const res = await helpClientService.getSupportConfig(user);
            setSupportConfig(res);
        } catch (e) {
            setSupportConfig({ isConfigured: false });
        } finally {
            setLoadingSupport(false);
        }
    };

    const handleSupportSubmit = (e) => {
        e.preventDefault();
        if (!supportText.trim()) {
            setSupportStatus({ error: true, message: 'Please enter a description of the issue or question.' });
            return;
        }

        if (supportConfig?.support?.contactMethod === 'EMAIL') {
            const email = supportConfig.support.contactValue;
            const subject = encodeURIComponent(`[SoilFER LIMS Support] ${supportSubject || 'Laboratory Issue'} (${user?.labId || 'General'})`);
            const body = encodeURIComponent(
                `User: ${user?.username || 'Anonymous'}\n` +
                `Lab: ${user?.labId || 'Unassigned'}\n` +
                `URL: ${window.location.href}\n` +
                `Time: ${new Date().toISOString()}\n\n` +
                `Description:\n${supportText}`
            );
            window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
            setSupportStatus({
                error: false,
                message: 'Your email application was opened with this draft. Please review and send it from your email client.'
            });
        } else {
            setSupportStatus({
                error: false,
                message: 'Support request prepared for laboratory supervisor review.'
            });
        }
    };

    // Current role definition
    const activeRoleDef = useMemo(() => {
        return ROLE_DEFINITIONS.find(r => r.id === selectedRole) || ROLE_DEFINITIONS[0];
    }, [selectedRole]);

    // Primary tasks for current role
    const roleTasks = useMemo(() => {
        return activeRoleDef.tasks.map(id => {
            const art = allArticles.find(a => a.id === id);
            return art || { id, title: id.replace(/-/g, ' '), summary: 'Detailed task procedure.' };
        });
    }, [activeRoleDef, allArticles]);

    // Filtered articles for library
    const filteredLibraryArticles = useMemo(() => {
        let items = allArticles;
        if (activeTopic !== 'all') {
            items = items.filter(a => a.category === activeTopic);
        }
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            items = items.filter(a =>
                (a.title && a.title.toLowerCase().includes(q)) ||
                (a.summary && a.summary.toLowerCase().includes(q)) ||
                (a.id && a.id.toLowerCase().includes(q))
            );
        }
        return items;
    }, [allArticles, activeTopic, searchQuery]);

    // Role figures
    const renderRoleFigure = () => {
        if (selectedRole === 'LAB_TECHNICIAN') {
            return (
                <div className="p-4 rounded-xl bg-sf-primary/5 border border-sf-primary/20 space-y-3" role="img" aria-label="Synthetic batch example: 40 rows checked, 38 matched drafts and two excluded rows">
                    <div className="flex items-center justify-between text-xs font-bold text-sf-primary tracking-wide uppercase">
                        <span>EXAMPLE · pH WORKSHEET</span>
                        <span>40-row batch</span>
                    </div>
                    <div className="bg-sf-surface rounded-lg border border-sf-divider p-2.5 space-y-1.5 text-xs font-mono">
                        <div className="grid grid-cols-3 font-bold text-[11px] text-sf-muted pb-1 border-b border-sf-divider">
                            <span>Sample</span>
                            <span>pH</span>
                            <span>Preview</span>
                        </div>
                        <div className="grid grid-cols-3 items-center py-0.5">
                            <b>DEMO-001</b>
                            <span>6.42</span>
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold">Matched</span>
                        </div>
                        <div className="grid grid-cols-3 items-center py-0.5">
                            <b>DEMO-002</b>
                            <span>5.88</span>
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold">Matched</span>
                        </div>
                        <div className="grid grid-cols-3 items-center py-0.5">
                            <b>DEMO-039</b>
                            <span>6.15</span>
                            <span className="text-amber-600 dark:text-amber-400 font-bold">Blocked</span>
                        </div>
                        <div className="grid grid-cols-3 items-center py-0.5">
                            <b>DEMO-040</b>
                            <span>—</span>
                            <span className="text-amber-600 dark:text-amber-400 font-bold">No value</span>
                        </div>
                    </div>
                    <p className="text-[11px] text-sf-muted leading-tight">
                        4 of 40 rows shown · 38 matched · 2 excluded.<br />
                        Applying values creates drafts. Submission comes later.
                    </p>
                </div>
            );
        }

        const roleFigureData = {
            SAMPLE_RECEPTION: {
                title: 'SAMPLE RECEIPT',
                steps: ['1 · Match the physical label', '2 · Check condition & analyses', '3 · Verify the receipt'],
                caption: 'A project record is not proof of physical receipt.'
            },
            LAB_MANAGER: {
                title: 'REVIEWER HANDOFF',
                steps: ['1 · Find the submitted version', '2 · Inspect evidence & exceptions', '3 · Accept or return with a reason'],
                caption: 'Final approval and report release are separate decisions.'
            },
            PROJECT_MANAGER: {
                title: 'PROJECT PROGRESS',
                steps: ['Field records → laboratory receipt', 'Laboratory work → reviewed results', 'Released report → external delivery'],
                caption: 'Follow the owner and evidence at each handoff.'
            },
            SURVEYOR: {
                title: 'FIELD TO LAB',
                steps: ['Capture the field sample record', 'Check identity and source location', 'Follow the laboratory handover'],
                caption: 'Importing field data does not receive the physical sample.'
            }
        };

        const item = roleFigureData[selectedRole] || {
            title: 'TRACEABLE LABORATORY WORK',
            steps: ['Know your permitted scope', 'Follow the current record and version', 'Verify the outcome and next owner'],
            caption: 'Reading another role’s guide does not alter your permissions.'
        };

        return (
            <div className="p-4 rounded-xl bg-sf-primary/5 border border-sf-primary/20 space-y-3">
                <div className="text-xs font-bold text-sf-primary tracking-wide uppercase">{item.title}</div>
                <div className="bg-sf-surface rounded-lg border border-sf-divider p-3 space-y-2 text-xs">
                    {item.steps.map((st, i) => (
                        <div key={i} className="py-1 border-b border-sf-divider last:border-0 font-medium text-sf-text">
                            {st}
                        </div>
                    ))}
                </div>
                <p className="text-[11px] text-sf-muted leading-tight">{item.caption}</p>
            </div>
        );
    };

    // Render Home View ("My Tasks")
    const renderHomeView = () => {
        const leadTask = roleTasks[0];
        const secondaryTasks = roleTasks.slice(1);

        return (
            <div className="space-y-8 animate-fadeIn">
                {/* Intro Header */}
                <div className="space-y-2">
                    <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-sf-primary/10 text-sf-primary text-xs font-bold uppercase tracking-wider">
                        <span>{activeRoleDef.label}</span>
                        <span>•</span>
                        <span>{t('help.home', 'My Tasks')}</span>
                    </div>
                    <h1 className="text-2xl md:text-3xl font-black text-sf-text tracking-tight">
                        {selectedRole === 'LAB_TECHNICIAN' && t('help.benchTitle', 'At the bench')}
                        {selectedRole === 'SAMPLE_RECEPTION' && t('help.intakeTitle', 'At the intake desk')}
                        {selectedRole === 'LAB_MANAGER' && t('help.managerTitle', 'Managing laboratory work')}
                        {!['LAB_TECHNICIAN', 'SAMPLE_RECEPTION', 'LAB_MANAGER'].includes(selectedRole) && t('help.roleTitle', 'Your work, explained')}
                    </h1>
                    <p className="text-sm text-sf-muted max-w-2xl leading-relaxed">
                        {t('help.intro', 'Find the right action, understand what it changes, and know when your work is finished.')}
                    </p>
                </div>

                {/* Primary Feature Card */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-6 rounded-2xl bg-sf-surface border border-sf-divider border-t-4 border-t-sf-primary shadow-sm">
                    <div className="lg:col-span-7 flex flex-col justify-between space-y-4">
                        <div className="space-y-2">
                            <span className="text-[11px] font-bold text-sf-primary uppercase tracking-wider">
                                A useful place to start
                            </span>
                            <h2 className="text-xl md:text-2xl font-bold text-sf-text">
                                {leadTask.title}
                            </h2>
                            <p className="text-sm text-sf-muted leading-relaxed">
                                {leadTask.summary}
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 pt-2">
                            <Link
                                to={`/help/articles/${leadTask.id}`}
                                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sf-primary text-white font-bold text-xs hover:bg-sf-primary/90 transition-colors shadow-sm"
                            >
                                <span>{t('help.readGuide', 'Read the guide')}</span>
                                <ArrowRight size={14} />
                            </Link>
                            <button
                                type="button"
                                onClick={() => handleTabChange('learn')}
                                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sf-surface border border-sf-divider text-sf-text font-bold text-xs hover:bg-sf-hover transition-colors"
                            >
                                <Layers size={14} />
                                <span>{t('help.learnSamples', 'Learn with 5 example samples')}</span>
                            </button>
                        </div>
                    </div>
                    <div className="lg:col-span-5">
                        {renderRoleFigure()}
                    </div>
                </div>

                {/* Two-Column Section: Secondary Tasks & Problem Solving */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Other Useful Tasks */}
                    <div className="p-5 rounded-2xl bg-sf-surface border border-sf-divider space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-base font-bold text-sf-text">
                                {t('help.otherTasks', 'Other useful tasks')}
                            </h3>
                            <span className="text-xs text-sf-muted font-medium">
                                {activeRoleDef.label}
                            </span>
                        </div>
                        <div className="divide-y divide-sf-divider/50">
                            {secondaryTasks.map((task, idx) => (
                                <Link
                                    key={task.id}
                                    to={`/help/articles/${task.id}`}
                                    className="flex items-start gap-3 py-3 group hover:bg-sf-hover/50 -mx-2 px-2 rounded-xl transition-colors"
                                >
                                    <span className="w-6 h-6 rounded-full bg-sf-primary/10 text-sf-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                                        {idx + 1}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-xs font-bold text-sf-text group-hover:text-sf-primary transition-colors line-clamp-1">
                                            {task.title}
                                        </div>
                                        <p className="text-[11px] text-sf-muted line-clamp-1 mt-0.5">
                                            {task.summary}
                                        </p>
                                    </div>
                                    <ChevronRight size={14} className="text-sf-muted group-hover:text-sf-primary shrink-0 mt-1" />
                                </Link>
                            ))}
                        </div>
                    </div>

                    {/* Something Not Working? */}
                    <div className="p-5 rounded-2xl bg-sf-surface border border-sf-divider space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-base font-bold text-sf-text">
                                {t('help.stuck', 'Something not working?')}
                            </h3>
                            <button
                                type="button"
                                onClick={() => handleTabChange('problem')}
                                className="text-xs font-bold text-sf-primary hover:underline"
                            >
                                {t('help.problemSolver', 'Decision tree →')}
                            </button>
                        </div>
                        <div className="space-y-2">
                            {[
                                { symptom: 'My result is saved, but the manager cannot see it', target: 'result' },
                                { symptom: 'Preparation still looks incomplete', target: 'prep' },
                                { symptom: 'I have pending work on this device', target: 'offline' }
                            ].map((item, idx) => (
                                <button
                                    key={idx}
                                    type="button"
                                    onClick={() => {
                                        setProblemStep(item.target);
                                        handleTabChange('problem');
                                    }}
                                    className="w-full flex items-center justify-between p-3 rounded-xl border border-sf-divider hover:border-sf-primary/40 hover:bg-sf-hover text-left transition-all text-xs font-semibold text-sf-text group"
                                >
                                    <span className="line-clamp-1">{item.symptom}</span>
                                    <ArrowRight size={14} className="text-sf-muted group-hover:text-sf-primary shrink-0 ml-2" />
                                </button>
                            ))}
                        </div>
                        <p className="text-[11px] text-sf-muted leading-relaxed">
                            Start with what you can see. The guide explains the next safe action and who can help.
                        </p>
                    </div>
                </div>

                {/* Workflow Connectivity Footer */}
                <div className="p-5 rounded-2xl bg-sf-surface border border-sf-divider space-y-3">
                    <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-sf-muted">
                            How laboratory work connects
                        </h4>
                        <span className="text-[11px] text-sf-primary font-bold">Standard Analytical Lifecycle</span>
                    </div>
                    <div className="flex items-center gap-2 overflow-x-auto py-1 text-xs">
                        {[
                            { step: 'Receive', id: 'intake-project' },
                            { step: 'Prepare', id: 'prep-drying' },
                            { step: 'Record & submit', id: 'bench-batch' },
                            { step: 'Review', id: 'review-submission' },
                            { step: 'Release report', id: 'review-report' }
                        ].map((node, n) => (
                            <React.Fragment key={node.id}>
                                {n > 0 && <span className="text-sf-muted shrink-0">→</span>}
                                <Link
                                    to={`/help/articles/${node.id}`}
                                    className="px-3 py-1.5 rounded-lg border border-sf-divider bg-sf-inset hover:bg-sf-hover text-sf-text font-semibold shrink-0 transition-colors"
                                >
                                    {node.step}
                                </Link>
                            </React.Fragment>
                        ))}
                    </div>
                </div>
            </div>
        );
    };

    // Render Problem Solver ("Solve a Problem")
    const renderProblemSolver = () => {
        const problemOutcomes = {
            draft: {
                title: 'A draft has not reached the manager',
                steps: [
                    'Check that the values and required metadata are correct in Worksheet.',
                    'Select the intended rows, open Review Completion and record the eligible determinations.',
                    'Open Ready to Submit, check the analyses included and submit the selected samples for review.',
                    'Verify the server confirmation in Sent & Completed.'
                ],
                owner: 'Technician → laboratory reviewer after submission',
                guide: 'bench-batch'
            },
            recorded: {
                title: 'The reviewer handoff is still needed',
                steps: [
                    'Open Ready to Submit in Workbench.',
                    'Check the intended sample, included determinations and FULL or PARTIAL scope.',
                    'Confirm Submit N Samples for Review and verify the server receipt.'
                ],
                owner: 'Technician submits; the manager then reviews.',
                guide: 'bench-batch'
            },
            submitted: {
                title: 'Use the receipt to trace the submitted work',
                steps: [
                    'Check that the receipt belongs to the same sample, task version and laboratory.',
                    'Ask the manager to inspect Review Submissions with the relevant filters.',
                    'If a server-confirmed submission is still absent, preserve the receipt and report the discrepancy.'
                ],
                owner: 'Laboratory manager, then platform support if views disagree.',
                guide: 'review-submission'
            },
            receipt: {
                title: 'Keep the receipt; do not repeat physical completion',
                steps: [
                    'Compare the sample, task and attempt on the receipt with the current task.',
                    'Check whether the label means awaiting a later review rather than awaiting confirmation.',
                    'If the same confirmed attempt remains incomplete, preserve the receipt and report the contradictory state.'
                ],
                owner: 'Laboratory manager or support checks the conflicting state.',
                guide: 'prep-receipt'
            },
            noreceipt: {
                title: 'First establish whether confirmation was accepted',
                steps: [
                    'Checking the physical checklist does not itself confirm completion.',
                    'Inspect the task and any pending local operation before trying again.',
                    'Use Confirm Complete only for an eligible unconfirmed task; verify its resulting receipt.'
                ],
                owner: 'Technician verifies; manager/support resolves uncertain state.',
                guide: 'prep-drying'
            },
            offline: {
                title: 'Keep this device and its pending work intact',
                steps: [
                    'Reconnect and use the same authorized account and laboratory.',
                    'Inspect each queued operation, its status and any server receipt.',
                    'Resolve conflicts through the supported recovery flow. Do not clear storage or reinstall.',
                    'Check resulting server state and receipts before counting work as submitted.'
                ],
                owner: 'Technician reconciles supported operations; unresolved conflicts go to manager.',
                guide: 'offline-sync'
            },
            uncertain: {
                title: 'Gather what the screen actually confirms',
                steps: [
                    'Record the sample identifier, task, visible state and any receipt or queue status.',
                    'Distinguish a local save indicator from a server confirmation and reviewer submission.',
                    'Follow the state guide with your manager. Avoid a second completion attempt while outcome is unknown.'
                ],
                owner: 'Technician and laboratory manager',
                guide: 'prep-receipt'
            }
        };

        let head = 'What are you trying to resolve?';
        let choices = [];

        if (problemStep === 'start') {
            head = 'What are you trying to resolve?';
            choices = [
                { id: 'result', title: 'My manager cannot see my results', desc: 'I have entered values, but there is no review item.' },
                { id: 'prep', title: 'Preparation still looks incomplete', desc: 'I confirmed the work, but another page disagrees.' },
                { id: 'offline', title: 'Work is waiting to synchronize', desc: 'This device has saved or pending operations.' }
            ];
        } else if (problemStep === 'result') {
            head = 'What does Workbench show for this work?';
            choices = [
                { id: 'draft', title: 'Draft or saved values', desc: 'I have entered or pasted values.' },
                { id: 'recorded', title: 'Recorded determinations', desc: 'Recording finished; I have not verified submission.' },
                { id: 'submitted', title: 'Submitted with a server receipt', desc: 'The application confirmed reviewer submission.' },
                { id: 'uncertain', title: 'I cannot tell', desc: 'Help me identify the visible evidence.' }
            ];
        } else if (problemStep === 'prep') {
            head = 'Can you find a confirmation receipt?';
            choices = [
                { id: 'receipt', title: 'Yes, for this task and attempt', desc: 'There is a confirmation time and receipt ID.' },
                { id: 'noreceipt', title: 'No receipt is visible', desc: 'I can see checks or a completion badge only.' },
                { id: 'uncertain', title: 'I cannot tell', desc: 'I need help comparing the task and receipt.' }
            ];
        }

        const outcome = problemOutcomes[problemStep];

        return (
            <div className="max-w-2xl mx-auto space-y-6 animate-fadeIn py-4">
                <div className="space-y-1 text-center">
                    <div className="text-xs font-bold text-sf-primary uppercase tracking-wider">
                        Troubleshooting · One Question At A Time
                    </div>
                    <h2 className="text-2xl font-black text-sf-text">Start with what you can see</h2>
                    <p className="text-xs text-sf-muted">
                        Find the cause without repeating laboratory work or altering results.
                    </p>
                </div>

                <div className="p-6 rounded-2xl bg-sf-surface border border-sf-divider shadow-sm space-y-5">
                    <div className="space-y-1">
                        <span className="text-[11px] font-bold text-sf-muted uppercase tracking-wider">
                            {problemStep === 'start' ? 'Step 1' : outcome ? 'Resolution' : 'Step 2'}
                        </span>
                        <h3 className="text-lg font-bold text-sf-text">{head}</h3>
                    </div>

                    {choices.length > 0 && (
                        <div className="space-y-3">
                            {choices.map(c => (
                                <button
                                    key={c.id}
                                    type="button"
                                    onClick={() => setProblemStep(c.id)}
                                    className="w-full text-left p-4 rounded-xl border border-sf-divider bg-sf-surface hover:border-sf-primary/40 hover:bg-sf-hover transition-all group"
                                >
                                    <div className="font-bold text-sm text-sf-text group-hover:text-sf-primary transition-colors">
                                        {c.title}
                                    </div>
                                    <p className="text-xs text-sf-muted mt-1">{c.desc}</p>
                                </button>
                            ))}
                        </div>
                    )}

                    {outcome && (
                        <div className="space-y-4 p-5 rounded-xl bg-sf-primary/5 border border-sf-primary/20">
                            <h4 className="text-base font-bold text-sf-primary">{outcome.title}</h4>
                            <ol className="space-y-2 text-xs text-sf-text">
                                {outcome.steps.map((st, i) => (
                                    <li key={i} className="flex items-start gap-2">
                                        <span className="font-bold text-sf-primary">{i + 1}.</span>
                                        <span className="leading-relaxed">{st}</span>
                                    </li>
                                ))}
                            </ol>
                            <div className="pt-2 text-xs">
                                <span className="font-bold text-sf-muted">Who helps next: </span>
                                <span className="font-semibold text-sf-text">{outcome.owner}</span>
                            </div>
                            <div className="pt-2">
                                <Link
                                    to={`/help/articles/${outcome.guide}`}
                                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-sf-primary text-white font-bold text-xs hover:bg-sf-primary/90 transition-colors shadow-sm"
                                >
                                    <span>Open the detailed instructions</span>
                                    <ArrowRight size={14} />
                                </Link>
                            </div>
                        </div>
                    )}

                    <div className="flex items-center justify-between pt-4 border-t border-sf-divider text-xs">
                        {problemStep !== 'start' ? (
                            <button
                                type="button"
                                onClick={() => setProblemStep('start')}
                                className="text-sf-primary font-bold hover:underline"
                            >
                                ← Start over
                            </button>
                        ) : <span />}
                        <button
                            type="button"
                            onClick={() => handleTabChange('library')}
                            className="text-sf-muted hover:text-sf-text"
                        >
                            Browse all help
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    // Render Learning Path ("Learn the Workflow")
    const renderLearnView = () => {
        const journeySteps = [
            {
                num: '1',
                title: 'Receive project sample',
                id: 'intake-project',
                role: 'SAMPLE_RECEPTION',
                summary: 'Match physical material DEMO-001 with expected KoBo/field records. Record mass, inspect packaging, verify analysis selection, and print official label.',
                rule: 'A KoBo submission alone is not physical receipt.'
            },
            {
                num: '2',
                title: 'Confirm sample drying and preparation',
                id: 'prep-drying',
                role: 'LAB_TECHNICIAN',
                summary: 'Carry out physical drying and grinding protocol. Complete operational checklist, click Confirm Complete, and verify receipt ID.',
                rule: 'Checking a box does not confirm completion until the server receipt exists.'
            },
            {
                num: '3',
                title: 'Record batch determinations at bench',
                id: 'bench-batch',
                role: 'LAB_TECHNICIAN',
                summary: 'Open Worksheet, paste analytical observations for DEMO-001 through DEMO-040. Isolate 2 excluded rows, review completion, and click Ready to Submit.',
                rule: 'Saved drafts are private to the technician; submit them for reviewer handoff.'
            },
            {
                num: '4',
                title: 'Review submitted results',
                id: 'review-submission',
                role: 'LAB_MANAGER',
                summary: 'Inspect submitted versions in Manager Queue. Review QC controls and test values. Accept verified items or return with specific correction reason.',
                rule: 'Review decisions are logged immutably in the audit trail.'
            },
            {
                num: '5',
                title: 'Release approved certificate of analysis',
                id: 'review-report',
                role: 'LAB_MANAGER',
                summary: 'Generate the final result report. Confirm units, methodology references, texture classification, and release certificate to project.',
                rule: 'Released reports cannot be edited in place; use authorized amendment.'
            }
        ];

        return (
            <div className="max-w-3xl mx-auto space-y-6 animate-fadeIn py-4">
                <div className="space-y-1">
                    <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-sf-primary/10 text-sf-primary text-xs font-bold uppercase tracking-wider">
                        <span>Workflow Learning Path</span>
                        <span>•</span>
                        <span>Synthetic Project Journey</span>
                    </div>
                    <h2 className="text-2xl font-black text-sf-text">Follow five samples from receipt to release</h2>
                    <p className="text-sm text-sf-muted leading-relaxed">
                        Trace synthetic samples DEMO-001 through DEMO-005 through each operational gate. Understand what changes in the database and who acts next.
                    </p>
                </div>

                <div className="space-y-4">
                    {journeySteps.map((st) => (
                        <div key={st.num} className="p-5 rounded-2xl bg-sf-surface border border-sf-divider shadow-sm space-y-3">
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex items-center gap-3">
                                    <span className="w-8 h-8 rounded-full bg-sf-primary/10 text-sf-primary font-black flex items-center justify-center text-sm">
                                        {st.num}
                                    </span>
                                    <div>
                                        <h3 className="font-bold text-base text-sf-text">{st.title}</h3>
                                        <span className="text-[11px] font-semibold text-sf-muted">{st.role}</span>
                                    </div>
                                </div>
                                <Link
                                    to={`/help/articles/${st.id}`}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-sf-divider bg-sf-inset hover:bg-sf-hover text-xs font-bold text-sf-text transition-colors"
                                >
                                    <span>Read guide</span>
                                    <ExternalLink size={12} />
                                </Link>
                            </div>
                            <p className="text-xs text-sf-muted leading-relaxed pl-11">
                                {st.summary}
                            </p>
                            <div className="ml-11 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-900 dark:text-amber-200">
                                <strong>Key boundary: </strong>{st.rule}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    // Render Full Library ("Browse the Guide")
    const renderLibraryView = () => {
        return (
            <div className="space-y-6 animate-fadeIn">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-2xl font-black text-sf-text">
                            {searchQuery ? 'Search results' : 'Browse the laboratory guide'}
                        </h2>
                        <p className="text-xs text-sf-muted mt-0.5">
                            {filteredLibraryArticles.length} guides available across 12 topics
                        </p>
                    </div>

                    {/* Topic Filter Dropdown */}
                    <div className="flex items-center gap-2">
                        <label htmlFor="lib-topic" className="text-xs font-semibold text-sf-muted">Topic:</label>
                        <select
                            id="lib-topic"
                            value={activeTopic}
                            onChange={(e) => handleTabChange('library', e.target.value)}
                            className="bg-sf-surface border border-sf-divider text-sf-text text-xs rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sf-primary"
                        >
                            <option value="all">All 12 topics</option>
                            {topics.map(t => (
                                <option key={t.id} value={t.id}>{t.title}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Article Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredLibraryArticles.map(art => (
                        <Link
                            key={art.id}
                            to={`/help/articles/${art.id}`}
                            className="flex flex-col justify-between p-4 rounded-xl bg-sf-surface border border-sf-divider hover:border-sf-primary/40 hover:shadow-md transition-all group"
                        >
                            <div className="space-y-2">
                                <div className="flex items-center justify-between text-[10px] text-sf-muted">
                                    <span className="font-semibold capitalize">{art.category}</span>
                                    <span>{art.minutes || 3} min</span>
                                </div>
                                <h3 className="font-bold text-sm text-sf-text group-hover:text-sf-primary transition-colors line-clamp-2">
                                    {art.title}
                                </h3>
                                <p className="text-xs text-sf-muted line-clamp-3 leading-relaxed">
                                    {art.summary}
                                </p>
                            </div>
                            <div className="pt-3 mt-3 border-t border-sf-divider/50 flex items-center justify-between text-[11px]">
                                <span className="text-sf-primary font-bold group-hover:underline">Read guide →</span>
                                <span className="text-[10px] text-sf-muted font-mono">{art.id}</span>
                            </div>
                        </Link>
                    ))}
                </div>

                {filteredLibraryArticles.length === 0 && (
                    <div className="text-center py-12 bg-sf-surface border border-sf-divider rounded-2xl p-6 space-y-3">
                        <AlertCircle size={28} className="mx-auto text-sf-muted" />
                        <h3 className="text-base font-bold text-sf-text">No articles found</h3>
                        <p className="text-xs text-sf-muted max-w-sm mx-auto">
                            Try broadening your search term or select "All 12 topics" from the filter.
                        </p>
                    </div>
                )}
            </div>
        );
    };

    // Render FAQ & Reference View
    const renderFaqView = () => {
        return (
            <div className="max-w-3xl mx-auto space-y-6 animate-fadeIn py-4">
                <div className="space-y-1">
                    <div className="text-xs font-bold text-sf-primary uppercase tracking-wider">
                        Knowledge Base · Frequently Asked Questions
                    </div>
                    <h2 className="text-2xl font-black text-sf-text">Symptoms & Quick Resolutions</h2>
                    <p className="text-xs text-sf-muted">
                        Derived directly from verified problem resolution blocks across all laboratory procedures.
                    </p>
                </div>

                <div className="space-y-3">
                    {faqs.map((faq) => (
                        <div key={faq.id} className="p-4 rounded-xl bg-sf-surface border border-sf-divider space-y-2">
                            <div className="flex items-start justify-between gap-3">
                                <h3 className="font-bold text-sm text-sf-text flex items-center gap-2">
                                    <HelpCircle size={15} className="text-sf-primary shrink-0" />
                                    <span>{faq.question}</span>
                                </h3>
                                <Link
                                    to={`/help/articles/${faq.articleId}`}
                                    className="text-xs font-bold text-sf-primary hover:underline shrink-0"
                                >
                                    Read guide →
                                </Link>
                            </div>
                            <div className="pl-6 space-y-1.5 text-xs text-sf-muted">
                                <p><strong className="text-sf-text">Why it happens: </strong>{faq.cause}</p>
                                <p><strong className="text-sf-text">What to do: </strong>{faq.action}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-sf-canvas pb-20" data-tour="help-container">
            {/* Offline Status Notice */}
            {isOffline && (
                <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-2 text-xs text-amber-900 dark:text-amber-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <WifiOff size={14} className="text-amber-600 dark:text-amber-400" />
                        <span className="font-bold">Offline Guidance Pack</span>
                        <span className="opacity-85">— Viewing downloaded laboratory guidance.</span>
                    </div>
                    {lastSync && (
                        <span className="text-[11px] opacity-75">
                            Last synced: {new Date(lastSync).toLocaleDateString()}
                        </span>
                    )}
                </div>
            )}

            {/* Header / Brand & Search Bar */}
            <header className="bg-sf-surface border-b border-sf-divider py-4 px-4 md:px-8 sticky top-0 z-20 shadow-xs">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <img
                            src="/assets/img/soilfer-logo.png"
                            alt="SoilFER"
                            className="h-9 object-contain dark:bg-white dark:p-1 dark:rounded-md"
                            onError={(e) => { e.target.style.display = 'none'; }}
                        />
                        <div className="border-l border-sf-divider pl-3">
                            <span className="font-black text-base text-sf-text tracking-tight block">
                                Help & lab guide
                            </span>
                            <span className="text-[10px] font-semibold text-sf-muted uppercase tracking-wider block">
                                Practical Handbook v2
                            </span>
                        </div>
                    </div>

                    {/* Search Field */}
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-sf-muted w-4 h-4 pointer-events-none" />
                        <input
                            type="search"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search tasks, questions or messages…"
                            className="w-full pl-9 pr-8 py-2 rounded-xl bg-sf-inset border border-sf-divider text-sf-text placeholder-sf-muted text-xs focus:outline-none focus:ring-2 focus:ring-sf-primary"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => setSearchQuery('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-sf-muted hover:text-sf-text"
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>

                    {/* Role Filter Selector */}
                    <div className="flex items-center gap-2 shrink-0">
                        <label htmlFor="role-select" className="text-xs font-semibold text-sf-muted">Role:</label>
                        <select
                            id="role-select"
                            value={selectedRole}
                            onChange={(e) => setSelectedRole(e.target.value)}
                            className="bg-sf-inset border border-sf-divider text-sf-text text-xs rounded-xl px-3 py-2 font-medium focus:outline-none focus:ring-2 focus:ring-sf-primary"
                            title="Reading filter only — does not alter user authorization"
                        >
                            {ROLE_DEFINITIONS.map(r => (
                                <option key={r.id} value={r.id}>{r.label}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </header>

            {/* Main Content Layout with Left Sidebar */}
            <div className="max-w-7xl mx-auto px-4 md:px-8 pt-6 grid grid-cols-1 md:grid-cols-12 gap-8">
                {/* Left Navigation Sidebar */}
                <aside className="md:col-span-3 space-y-6">
                    <nav className="p-3 rounded-2xl bg-sf-surface border border-sf-divider space-y-1 text-xs font-semibold" aria-label="Help navigation">
                        {[
                            { id: 'home', label: 'My tasks', icon: Compass },
                            { id: 'problem', label: 'Solve a problem', icon: AlertCircle },
                            { id: 'learn', label: 'Learn the workflow', icon: Layers },
                            { id: 'library', label: 'Browse the guide', icon: BookOpen },
                            { id: 'faq', label: 'FAQ & Reference', icon: HelpCircle }
                        ].map(item => {
                            const Icon = item.icon;
                            const isActive = currentTab === item.id;
                            return (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => handleTabChange(item.id)}
                                    className={clsx(
                                        'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-colors',
                                        isActive
                                            ? 'bg-sf-primary/10 text-sf-primary font-bold'
                                            : 'text-sf-text hover:bg-sf-hover'
                                    )}
                                >
                                    <Icon size={16} className={clsx(isActive ? 'text-sf-primary' : 'text-sf-muted')} />
                                    <span>{item.label}</span>
                                </button>
                            );
                        })}
                    </nav>

                    {/* Topics Tree */}
                    <div className="p-4 rounded-2xl bg-sf-surface border border-sf-divider space-y-3">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-sf-muted">
                            Guide Topics
                        </div>
                        <div className="space-y-1 text-xs">
                            {topics.map(t => {
                                const Icon = TOPIC_ICONS[t.id] || BookOpen;
                                const isSelected = currentTab === 'library' && activeTopic === t.id;
                                return (
                                    <button
                                        key={t.id}
                                        type="button"
                                        onClick={() => handleTabChange('library', t.id)}
                                        className={clsx(
                                            'w-full flex items-center justify-between p-2 rounded-lg text-left transition-colors',
                                            isSelected
                                                ? 'bg-sf-primary/10 text-sf-primary font-bold'
                                                : 'text-sf-text hover:bg-sf-hover'
                                        )}
                                    >
                                        <div className="flex items-center gap-2 truncate">
                                            <Icon size={13} className="text-sf-muted shrink-0" />
                                            <span className="truncate">{t.title}</span>
                                        </div>
                                        <span className="text-[10px] text-sf-muted ml-2">{t.articleCount}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Contact Support Trigger */}
                    <div className="p-4 rounded-2xl bg-sf-primary/5 border border-sf-primary/20 space-y-2 text-xs text-center">
                        <LifeBuoy size={20} className="mx-auto text-sf-primary" />
                        <h4 className="font-bold text-sf-text">Need local assistance?</h4>
                        <p className="text-[11px] text-sf-muted">
                            Draft a support message with verified context for your laboratory supervisor.
                        </p>
                        <button
                            type="button"
                            onClick={handleOpenSupport}
                            className="w-full mt-1 px-3 py-2 rounded-xl bg-sf-surface border border-sf-divider hover:bg-sf-hover text-xs font-bold text-sf-text transition-colors"
                        >
                            Contact support
                        </button>
                    </div>
                </aside>

                {/* Main Dynamic View */}
                <main className="md:col-span-9 min-w-0" id="main" tabIndex="-1">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 text-sf-muted space-y-2">
                            <Loader2 size={24} className="animate-spin text-sf-primary" />
                            <span className="text-xs">Loading laboratory guidance…</span>
                        </div>
                    ) : (
                        <>
                            {currentTab === 'home' && renderHomeView()}
                            {currentTab === 'problem' && renderProblemSolver()}
                            {currentTab === 'learn' && renderLearnView()}
                            {currentTab === 'library' && renderLibraryView()}
                            {currentTab === 'faq' && renderFaqView()}
                        </>
                    )}
                </main>
            </div>

            {/* Support Dialog (Finding 8 truthful flow) */}
            {isSupportOpen && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="support-dialog-title"
                >
                    <div className="bg-sf-surface border border-sf-divider rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4 animate-scaleUp">
                        <div className="flex items-center justify-between pb-3 border-b border-sf-divider">
                            <div className="flex items-center gap-2">
                                <Mail size={18} className="text-sf-primary" />
                                <h3 id="support-dialog-title" className="font-bold text-base text-sf-text">
                                    Laboratory Support Request
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsSupportOpen(false)}
                                className="p-1 rounded-lg text-sf-muted hover:text-sf-text"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {loadingSupport ? (
                            <div className="py-8 text-center text-xs text-sf-muted flex items-center justify-center gap-2">
                                <Loader2 size={16} className="animate-spin text-sf-primary" />
                                <span>Loading support directory…</span>
                            </div>
                        ) : supportConfig?.isConfigured ? (
                            <form onSubmit={handleSupportSubmit} className="space-y-4 text-xs">
                                <div className="p-3 bg-sf-inset rounded-xl border border-sf-divider space-y-1">
                                    <div className="font-bold text-sf-text">Contact: {supportConfig.support.supportName}</div>
                                    <div className="text-sf-muted text-[11px]">Method: {supportConfig.support.contactMethod} ({supportConfig.support.contactValue})</div>
                                </div>
                                <div className="space-y-1">
                                    <label htmlFor="sup-sub" className="font-semibold text-sf-text">Subject</label>
                                    <input
                                        id="sup-sub"
                                        type="text"
                                        value={supportSubject}
                                        onChange={(e) => setSupportSubject(e.target.value)}
                                        placeholder="e.g. Blocker on drying confirmation receipt"
                                        className="w-full px-3 py-2 rounded-xl bg-sf-inset border border-sf-divider text-sf-text focus:outline-none focus:ring-2 focus:ring-sf-primary"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label htmlFor="sup-text" className="font-semibold text-sf-text">Description</label>
                                    <textarea
                                        id="sup-text"
                                        rows={4}
                                        value={supportText}
                                        onChange={(e) => setSupportText(e.target.value)}
                                        placeholder="Describe what you observed, the sample or task ID, and what happened."
                                        className="w-full px-3 py-2 rounded-xl bg-sf-inset border border-sf-divider text-sf-text focus:outline-none focus:ring-2 focus:ring-sf-primary"
                                    />
                                </div>

                                {supportStatus && (
                                    <div className={clsx(
                                        'p-3 rounded-xl text-xs',
                                        supportStatus.error ? 'bg-red-500/10 text-red-900 border border-red-500/30' : 'bg-emerald-500/10 text-emerald-900 border border-emerald-500/30'
                                    )}>
                                        {supportStatus.message}
                                    </div>
                                )}

                                <div className="flex items-center justify-end gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setIsSupportOpen(false)}
                                        className="px-4 py-2 rounded-xl border border-sf-divider text-sf-text font-bold"
                                    >
                                        Close
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-4 py-2 rounded-xl bg-sf-primary text-white font-bold hover:bg-sf-primary/90"
                                    >
                                        Prepare Draft
                                    </button>
                                </div>
                            </form>
                        ) : (
                            <div className="py-6 text-center text-xs text-sf-muted space-y-2">
                                <p>No direct support channel configured for this laboratory.</p>
                                <p>Please notify your laboratory manager or lead analyst directly.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default HelpCentre;
