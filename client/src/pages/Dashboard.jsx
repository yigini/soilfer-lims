import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import DashboardShell from '../components/dashboard/DashboardShell';
import { Loader2, ShieldAlert } from 'lucide-react';

/**
 * Role configuration dictionary for all 10 canonical roles.
 * Provides explicit eyebrow, title, subtitle, primary action, shift notes, and deep-link shortcuts.
 */
const ROLE_CONFIGS = {
    SAMPLE_RECEPTION: {
        eyebrow: 'Laboratory intake',
        title: 'Sample reception desk',
        subtitle: 'Physical intake, custody verification, label generation, and specimen registration.',
        primaryAction: { label: 'Receive incoming shipment', route: '/reception' },
        shiftNotes: {
            title: 'Intake & Reception Policy',
            items: [
                'Verify container seal integrity and physical custody form before accepting samples.',
                'Expected field arrivals are not laboratory work until physically intaken.',
                'Drying and preparation gates become active after physical acceptance.'
            ]
        },
        shortcuts: [
            { label: 'Sample intake desk', route: '/reception', description: 'Register received shipments and print labels' },
            { label: 'Sample registry', route: '/samples', description: 'Search and inspect all intaken specimens' },
            { label: 'Consumables inventory', route: '/inventory', description: 'Check sampling bags and intake supplies' }
        ]
    },
    LAB_TECHNICIAN: {
        eyebrow: 'Analytical bench',
        title: 'Analytical workbench',
        subtitle: 'Method queues, batch runs, calibration verification, and instrument measurement entry.',
        primaryAction: { label: 'Open analytical workbench', route: '/workbench' },
        shiftNotes: {
            title: 'Bench Work Instructions',
            items: [
                'Check instrument qualification and calibration status before initiating analytical runs.',
                'Determinations are batched up to 40 samples per run with required QC controls.',
                'Complete drying and preparation checklists before recording wet chemistry results.'
            ]
        },
        shortcuts: [
            { label: 'Bench measurement workbench', route: '/workbench', description: 'Record determinations and review QC' },
            { label: 'Assigned tasks (My Work)', route: '/my-work', description: 'View individual assigned analyses' },
            { label: 'Laboratory equipment', route: '/equipment', description: 'Inspect instrument status and calibration dates' },
            { label: 'Chemicals & Reagents', route: '/inventory', description: 'Check standards and solution lots' }
        ]
    },
    LAB_MANAGER: {
        eyebrow: 'Laboratory management',
        title: 'Laboratory manager queue',
        subtitle: 'Intake approval, analytical assignment, submission review, and final result authorization.',
        primaryAction: { label: 'Open manager queue', route: '/manager-queue' },
        shiftNotes: {
            title: 'Manager Oversight & Review',
            items: [
                'Review QC batch control charts before accepting analytical submissions.',
                'Final sample approval requires all ordered work accepted and valid evidence.',
                'All-omitted orders require explicit administrative closure, not normal result approval.'
            ]
        },
        shortcuts: [
            { label: 'Manager decision queue', route: '/manager-queue', description: 'Review and approve pending work items' },
            { label: 'All laboratory samples', route: '/samples', description: 'Inspect sample progress and history' },
            { label: 'Staff & Authorizations', route: '/users', description: 'Manage operator assignments and permissions' },
            { label: 'Official reports', route: '/result-reports', description: 'Generate and publish analytical reports' }
        ]
    },
    MASTER_USER: {
        eyebrow: 'National program oversight',
        title: 'National master overview',
        subtitle: 'Cross-laboratory quality coordination, analytical throughput, and national program progress.',
        primaryAction: { label: 'View released reports', route: '/result-reports' },
        shiftNotes: {
            title: 'National Program Guidance',
            items: [
                'Oversees national laboratory network performance and QC exceptions.',
                'Switch laboratory scope using the selector above to inspect specific lab queues.',
                'Approved results must be published as official reports before external stakeholder release.'
            ]
        },
        shortcuts: [
            { label: 'Laboratory network', route: '/admin/labs', description: 'Inspect national laboratory facilities' },
            { label: 'Published reports', route: '/result-reports', description: 'Search and download released certificates' },
            { label: 'Project tracking', route: '/projects', description: 'Monitor project sampling and throughput' }
        ]
    },
    PROJECT_MANAGER: {
        eyebrow: 'Project coordination',
        title: 'Project sample portfolio',
        subtitle: 'Sample progress, analytical completion rates, and geospatial tracking for assigned projects.',
        primaryAction: { label: 'View project portfolio', route: '/projects' },
        shiftNotes: {
            title: 'Project Coordination Protocol',
            items: [
                'Monitors field sample progression across participating laboratories.',
                'Data results and spatial distributions are available once analytical work is accepted.',
                'Official reports can be distributed to stakeholders once published.'
            ]
        },
        shortcuts: [
            { label: 'Project overview', route: '/projects', description: 'Track sample milestones and delivery' },
            { label: 'Analytical results table', route: '/data-results', description: 'Explore tabular soil data' },
            { label: 'Result reports', route: '/result-reports', description: 'Browse and download published reports' }
        ]
    },
    AUDIT_USER: {
        eyebrow: 'Quality assurance & audit',
        title: 'Quality & audit overview',
        subtitle: 'Read-only quality assurance, result auditing, and regulatory compliance inspection.',
        primaryAction: { label: 'Inspect audit log', route: '/admin/audit' },
        shiftNotes: {
            title: 'Audit & Compliance Guidelines',
            items: [
                'Audit users maintain read-only inspection authority across quality records.',
                'Report publication and result modifications are strictly restricted to managers.',
                'Traceable amendment logs record all post-intake and post-approval adjustments.'
            ]
        },
        shortcuts: [
            { label: 'System audit trail', route: '/admin/audit', description: 'Inspect immutable system events and changes' },
            { label: 'Quality assurance view', route: '/qa', description: 'View QC exception queues and batch dispositions' },
            { label: 'Sample dossiers', route: '/samples', description: 'Inspect complete sample custody and analytical logs' }
        ]
    },
    SURVEYOR: {
        eyebrow: 'Field operations',
        title: 'Field sample registration',
        subtitle: 'Field sample collection tracking, GPS coordinates, and handover custody.',
        primaryAction: { label: 'Inspect registered samples', route: '/samples' },
        shiftNotes: {
            title: 'Field Sampling Instructions',
            items: [
                'Ensure field GPS coordinates are recorded for each collected soil specimen.',
                'Generate custody dispatch notes when handing shipments to laboratory transport.',
                'Samples remain in EXPECTED arrival status until physically received at the laboratory.'
            ]
        },
        shortcuts: [
            { label: 'My collected samples', route: '/samples', description: 'Track provenance and arrival status' },
            { label: 'Field sampling map', route: '/maps', description: 'Inspect geographic distribution of sampling sites' }
        ]
    },
    EXTERNAL_VIEWER: {
        eyebrow: 'Stakeholder portal',
        title: 'Partner data & reports',
        subtitle: 'Authorized access to published laboratory result reports and verified project datasets.',
        primaryAction: { label: 'Browse published reports', route: '/result-reports' },
        shiftNotes: {
            title: 'Partner Access Policy',
            items: [
                'Access is restricted to finalized, published laboratory certificates.',
                'Internal draft analyses, operator notes, and raw spectra are excluded from view.',
                'Published reports carry monotonic versioning and authorized electronic approval records.'
            ]
        },
        shortcuts: [
            { label: 'Official reports', route: '/result-reports', description: 'Download verified soil test certificates' },
            { label: 'About SoilFER', route: '/about', description: 'Read about project standards and methodologies' }
        ]
    },
    VIEWER: {
        eyebrow: 'General viewer',
        title: 'Laboratory progress viewer',
        subtitle: 'Read-only overview of completed analyses and published reports.',
        primaryAction: { label: 'View published reports', route: '/result-reports' },
        shiftNotes: {
            title: 'Viewer Guidelines',
            items: [
                'Read-only access to published laboratory output.',
                'Operational actions and result edits require elevated role authorization.'
            ]
        },
        shortcuts: [
            { label: 'Published reports', route: '/result-reports', description: 'Search released soil certificates' },
            { label: 'Sample tracking', route: '/samples', description: 'View sample progress states' }
        ]
    },
    SUPER_ADMIN: {
        eyebrow: 'System administration',
        title: 'System administrator dashboard',
        subtitle: 'Global laboratory network configuration, user access governance, and operational integrity.',
        primaryAction: { label: 'Laboratory facilities', route: '/admin/labs' },
        shiftNotes: {
            title: 'System Administration Governance',
            items: [
                'Global system administration spans all registered national laboratories.',
                'Switch active laboratory above to inspect facility-specific queues and workloads.',
                'Security pragmas enforce WAL mode, busy timeout, and foreign key integrity.'
            ]
        },
        shortcuts: [
            { label: 'Laboratory management', route: '/admin/labs', description: 'Manage national lab facilities' },
            { label: 'Methodologies & SOPs', route: '/admin/methods', description: 'Configure analytical methods' },
            { label: 'User accounts', route: '/users', description: 'Manage user credentials and role grants' },
            { label: 'Audit log', route: '/admin/audit', description: 'Review immutable security event logs' }
        ]
    }
};

export default function Dashboard() {
    const { user, token: ctxToken } = useAuth();
    const token = ctxToken || (typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null) || '';
    const { subscribeToEvent } = useNotifications();
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();

    // Query params
    const paramQueue = searchParams.get('queue') || '';
    const paramLabId = searchParams.get('labId') || '';
    const paramProjectId = searchParams.get('projectId') || '';
    const paramPage = parseInt(searchParams.get('page') || '1', 10);

    // Dashboard State
    const [homeData, setHomeData] = useState(null);
    const [activeQueue, setActiveQueue] = useState(paramQueue);
    const [queueData, setQueueData] = useState({
        rows: [],
        total: 0,
        page: 1,
        pageSize: 10,
        hasMore: false,
        unit: 'items'
    });

    const [isLoadingHome, setIsLoadingHome] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isLoadingQueue, setIsLoadingQueue] = useState(false);
    const [homeError, setHomeError] = useState(null);
    const [queueError, setQueueError] = useState(null);
    const [lastUpdated, setLastUpdated] = useState(null);

    // Multi-lab options
    const [labs, setLabs] = useState([]);
    const [projects, setProjects] = useState([]);

    const reqCounter = useRef(0);

    // 1. Fetch available labs & projects for selector (multi-lab roles)
    useEffect(() => {
        const authToken = token || (typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null);
        if (!user) return;
        if (['SUPER_ADMIN', 'MASTER_USER'].includes(user.role)) {
            const headers = authToken ? { Authorization: `Bearer ${authToken}` } : {};
            axios.get('/api/labs', { headers })
                .then(res => setLabs(Array.isArray(res.data) ? res.data : []))
                .catch(() => setLabs([]));

            axios.get('/api/projects', { headers })
                .then(res => setProjects(Array.isArray(res.data) ? res.data : []))
                .catch(() => setProjects([]));
        }
    }, [user, token]);

    // 2. Fetch Home Dashboard Bundle
    const fetchDashboardHome = useCallback(async (isBackground = false) => {
        const authToken = token || (typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null);
        if (!user) return;
        const currentReq = ++reqCounter.current;

        if (!isBackground) setIsLoadingHome(true);
        else setIsRefreshing(true);
        setHomeError(null);

        try {
            const params = {};
            if (paramLabId) params.labId = paramLabId;
            if (paramProjectId) params.projectId = paramProjectId;

            const headers = authToken ? { Authorization: `Bearer ${authToken}` } : {};
            const res = await axios.get('/api/dashboard/home', {
                params,
                headers
            });

            if (currentReq !== reqCounter.current) return; // Stale response

            const data = res.data;
            setHomeData(data);
            setLastUpdated(data.asOf || new Date().toISOString());

            // Choose default queue: explicit param > recommendedQueue > first metric queue
            const chosenQueue = paramQueue || data.recommendedQueue || data.metrics?.[0]?.queueKey || '';
            setActiveQueue(chosenQueue);

            // If the home preview matches the active queue, populate immediately
            if (data.preview && data.preview.queueKey === chosenQueue && paramPage === 1) {
                setQueueData({
                    rows: data.preview.rows || [],
                    total: data.preview.total || 0,
                    page: data.preview.page || 1,
                    pageSize: data.preview.pageSize || 10,
                    hasMore: Boolean(data.preview.hasMore),
                    unit: data.preview.unit || 'items'
                });
            }
        } catch (err) {
            if (currentReq === reqCounter.current) {
                console.error('[Dashboard] Failed to fetch home data:', err);
                setHomeError(err);
            }
        } finally {
            if (currentReq === reqCounter.current) {
                setIsLoadingHome(false);
                setIsRefreshing(false);
            }
        }
    }, [user, token, paramLabId, paramProjectId, paramQueue, paramPage]);

    // Initial and param change trigger
    useEffect(() => {
        fetchDashboardHome();
    }, [fetchDashboardHome]);

    // 3. Fetch Specific Queue Rows (when changing queue tab or pagination)
    const fetchQueueRows = useCallback(async (queueKey, page = 1) => {
        const authToken = token || (typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null);
        if (!queueKey || !user) return;

        setIsLoadingQueue(true);
        setQueueError(null);

        try {
            const params = {
                page,
                pageSize: 10
            };
            if (paramLabId) params.labId = paramLabId;
            if (paramProjectId) params.projectId = paramProjectId;

            const headers = authToken ? { Authorization: `Bearer ${authToken}` } : {};
            const res = await axios.get(`/api/dashboard/queues/${queueKey}`, {
                params,
                headers
            });

            setQueueData({
                rows: res.data.rows || [],
                total: res.data.total || 0,
                page: res.data.page || page,
                pageSize: res.data.pageSize || 10,
                hasMore: Boolean(res.data.hasMore),
                unit: res.data.unit || 'items'
            });
        } catch (err) {
            console.error(`[Dashboard] Failed to fetch queue rows for ${queueKey}:`, err);
            setQueueError(err);
        } finally {
            setIsLoadingQueue(false);
        }
    }, [user, token, paramLabId, paramProjectId]);

    // Trigger queue fetch when activeQueue or page changes (if not already hydrated by preview)
    useEffect(() => {
        if (!activeQueue || !homeData) return;
        // Avoid redundant fetch if home preview already matched
        if (homeData.preview?.queueKey === activeQueue && queueData.page === paramPage && queueData.rows.length > 0) {
            return;
        }
        fetchQueueRows(activeQueue, paramPage);
    }, [activeQueue, paramPage, homeData, fetchQueueRows]);

    // 4. Real-time WebSocket Event Subscription
    useEffect(() => {
        if (!subscribeToEvent) return;

        const handleEvent = () => {
            fetchDashboardHome(true);
        };

        const unsubs = [
            subscribeToEvent('WORKITEM_UPDATE', handleEvent),
            subscribeToEvent('SAMPLE_RECEIVED', handleEvent),
            subscribeToEvent('SAMPLE_ACCEPTED', handleEvent),
            subscribeToEvent('SAMPLE_APPROVED', handleEvent),
            subscribeToEvent('DASHBOARD_REFRESH', handleEvent),
            subscribeToEvent('REPORT_PUBLISHED', handleEvent)
        ];

        return () => {
            unsubs.forEach(u => typeof u === 'function' && u());
        };
    }, [subscribeToEvent, fetchDashboardHome]);

    // Queue selection handler
    const handleSelectQueue = (newQueueKey) => {
        setActiveQueue(newQueueKey);
        const newParams = new URLSearchParams(searchParams);
        newParams.set('queue', newQueueKey);
        newParams.set('page', '1');
        setSearchParams(newParams);
    };

    // Pagination handler
    const handlePageChange = (newPage) => {
        const newParams = new URLSearchParams(searchParams);
        newParams.set('page', String(newPage));
        setSearchParams(newParams);
    };

    // Scope selection handlers (SUPER_ADMIN / MASTER_USER)
    const handleSelectLab = (labId) => {
        const newParams = new URLSearchParams(searchParams);
        if (labId) newParams.set('labId', labId);
        else newParams.delete('labId');
        newParams.set('page', '1');
        setSearchParams(newParams);
    };

    const handleSelectProject = (projectId) => {
        const newParams = new URLSearchParams(searchParams);
        if (projectId) newParams.set('projectId', projectId);
        else newParams.delete('projectId');
        newParams.set('page', '1');
        setSearchParams(newParams);
    };

    // Guard: Auth check
    if (!user) {
        return (
            <div className="flex items-center justify-center min-h-[50vh] p-8">
                <div className="flex flex-col items-center gap-3 text-emerald-600">
                    <Loader2 className="w-8 h-8 animate-spin" />
                    <span className="text-xs font-bold uppercase tracking-widest text-gray-400">Authenticating…</span>
                </div>
            </div>
        );
    }

    // Guard: Canonical role registry check (Fail Closed)
    const roleConfig = ROLE_CONFIGS[user.role];
    if (!roleConfig) {
        return (
            <div className="max-w-xl mx-auto my-12 p-6 rounded-2xl bg-sf-surface border border-sf-divider shadow-sm text-center">
                <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto mb-4" />
                <h1 className="text-xl font-bold text-sf-text">
                    Unrecognized Access Role
                </h1>
                <p className="text-sm text-sf-muted mt-2">
                    Your assigned account role (<code className="font-mono text-rose-600">{user.role || 'NONE'}</code>) is not registered in the canonical SoilFER LIMS RBAC matrix.
                </p>
                <p className="text-xs text-sf-muted mt-3">
                    Please contact your system administrator to assign an authorized operational role.
                </p>
            </div>
        );
    }

    // Loading error state on initial bundle
    if (homeError && !homeData) {
        return (
            <div className="max-w-xl mx-auto my-12 p-6 rounded-2xl bg-sf-surface border border-red-200 dark:border-red-800 shadow-sm text-center">
                <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto mb-4" />
                <h1 className="text-xl font-bold text-sf-text">
                    Unable to load dashboard
                </h1>
                <p className="text-sm text-sf-muted mt-2">
                    {homeError?.response?.data?.error || homeError?.response?.data?.message || homeError?.message || 'An error occurred while loading the dashboard data.'}
                </p>
                <button
                    onClick={() => fetchDashboardHome(false)}
                    className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-emerald-600 hover:bg-emerald-700"
                >
                    Retry
                </button>
            </div>
        );
    }

    // Loading initial home bundle
    if (isLoadingHome && !homeData) {
        return (
            <div className="flex items-center justify-center min-h-[50vh] p-8">
                <div className="flex flex-col items-center gap-3 text-emerald-600">
                    <Loader2 className="w-8 h-8 animate-spin" />
                    <span className="text-xs font-bold uppercase tracking-widest text-gray-400">Loading Dashboard…</span>
                </div>
            </div>
        );
    }

    // Available queue tabs from metrics
    const availableQueues = (homeData?.metrics || [])
        .filter(m => m.queueKey)
        .map(m => ({
            key: m.queueKey,
            label: m.label,
            count: m.value
        }));

    // Find current active queue metric for header title
    const currentMetric = (homeData?.metrics || []).find(m => m.queueKey === activeQueue);
    const queueTitle = currentMetric ? currentMetric.label : 'Active Work Queue';
    const queueSubtitle = currentMetric
        ? `Tracking ${currentMetric.value ?? 0} ${currentMetric.unit || 'items'} in current authorized scope`
        : 'Live records in authorized laboratory scope';

    return (
        <DashboardShell
            role={user.role}
            eyebrow={roleConfig.eyebrow}
            title={roleConfig.title}
            subtitle={roleConfig.subtitle}
            primaryAction={roleConfig.primaryAction}
            statusDate={homeData?.scope?.localDate ? `${homeData.scope.localDate} · ${homeData.scope.timezone || 'Local'}` : ''}
            freshnessStatus={isRefreshing ? 'loading' : (homeError ? 'stale' : 'live')}
            lastUpdated={lastUpdated}
            onRefresh={() => fetchDashboardHome(true)}
            isRefreshing={isRefreshing}
            scope={homeData?.scope || {}}
            labs={labs}
            projects={projects}
            selectedLabId={paramLabId}
            selectedProjectId={paramProjectId}
            onSelectLab={handleSelectLab}
            onSelectProject={handleSelectProject}
            metrics={homeData?.metrics || []}
            activeQueue={activeQueue}
            onSelectQueue={handleSelectQueue}
            queueTitle={queueTitle}
            queueSubtitle={queueSubtitle}
            availableQueues={availableQueues}
            queueRows={queueData.rows}
            queueTotal={queueData.total}
            queuePage={queueData.page}
            queuePageSize={queueData.pageSize}
            queueHasMore={queueData.hasMore}
            onQueuePageChange={handlePageChange}
            isQueueLoading={isLoadingQueue}
            queueError={queueError}
            onRetryQueue={() => fetchQueueRows(activeQueue, queueData.page)}
            shiftNotes={roleConfig.shiftNotes}
            shortcuts={roleConfig.shortcuts}
        />
    );
}
