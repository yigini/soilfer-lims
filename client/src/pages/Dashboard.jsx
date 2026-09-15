import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import DashboardShell from '../components/dashboard/DashboardShell';
import { useLanguage } from '../context/LanguageContext';
import { getRoleConfig } from '../utils/dashboardConfig';
import { Loader2, ShieldAlert } from 'lucide-react';

export default function Dashboard() {
    const { user, token: ctxToken } = useAuth();
    const { t } = useLanguage();
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
    const fetchScopeOptions = useCallback(async () => {
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

    useEffect(() => {
        fetchScopeOptions();
    }, [fetchScopeOptions]);

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
                    <span className="text-xs font-bold uppercase tracking-widest text-gray-400">{t('dashboard.shell.authenticating', 'Authenticating…')}</span>
                </div>
            </div>
        );
    }

    // Guard: Canonical role registry check (Fail Closed)
    const roleConfig = user?.role ? getRoleConfig(user.role, t) : null;
    if (!roleConfig) {
        return (
            <div className="max-w-xl mx-auto my-12 p-6 rounded-2xl bg-sf-surface border border-sf-divider shadow-sm text-center">
                <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto mb-4" />
                <h1 className="text-xl font-bold text-sf-text">
                    {t('dashboard.shell.unrecognizedRoleTitle', 'Unrecognized Access Role')}
                </h1>
                <p className="text-sm text-sf-muted mt-2">
                    {t('dashboard.shell.unrecognizedRoleDesc', 'Your assigned account role ({role}) is not registered in the canonical SoilFER LIMS RBAC matrix.', { role: user.role || 'NONE' })}
                </p>
                <p className="text-xs text-sf-muted mt-3">
                    {t('dashboard.shell.unrecognizedRoleContact', 'Please contact your system administrator to assign an authorized operational role.')}
                </p>
            </div>
        );
    }

    // Loading error state on initial bundle
    if (homeError && !homeData) {
        // Extract friendly error message, guarding against HTML error responses (e.g. proxy 500 error pages)
        let errorMsg = homeError?.response?.data?.error || homeError?.response?.data?.message;
        if (!errorMsg || typeof errorMsg !== 'string' || errorMsg.trim().startsWith('<')) {
            if (homeError?.response?.status >= 500) {
                errorMsg = t('dashboard.shell.serverTemporarilyUnavailable', 'The server is temporarily unavailable. Please click Retry in a moment.');
            } else {
                errorMsg = homeError?.message || t('dashboard.shell.errorLoadingData', 'An error occurred while loading dashboard data.');
            }
        }

        const handleRetry = () => {
            fetchDashboardHome(false);
            fetchScopeOptions();
        };

        return (
            <div className="max-w-xl mx-auto my-12 p-6 rounded-2xl bg-sf-surface border border-red-200 dark:border-red-800 shadow-sm text-center">
                <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto mb-4" />
                <h1 className="text-xl font-bold text-sf-text">
                    {t('dashboard.shell.unableToLoad', 'Unable to load dashboard')}
                </h1>
                <p className="text-sm text-sf-muted mt-2">
                    {errorMsg}
                </p>
                <button
                    onClick={handleRetry}
                    className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
                >
                    {t('common.retry', 'Retry')}
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
                    <span className="text-xs font-bold uppercase tracking-widest text-gray-400">{t('dashboard.shell.loadingDashboard', 'Loading Dashboard…')}</span>
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
    const queueTitle = currentMetric ? currentMetric.label : t('dashboard.shell.activeWorkQueue', 'Active Work Queue');
    const queueSubtitle = currentMetric
        ? t('dashboard.shell.trackingItems', `Tracking ${currentMetric.value ?? 0} ${currentMetric.unit || 'items'} in current authorized scope`, { count: currentMetric.value ?? 0, unit: currentMetric.unit || 'items' })
        : t('dashboard.shell.liveRecords', 'Live records in authorized laboratory scope');

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
