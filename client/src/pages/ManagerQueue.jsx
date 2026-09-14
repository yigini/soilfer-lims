import { useAnalysisNames } from '../context/AnalysisCatalogueContext';
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
    ShieldCheck, UserPlus, FileText, CheckCircle, AlertOctagon,
    ArrowRight, ArrowLeft, Loader, Clock, Calendar, FlaskConical,
    Microscope, Building2, AlertTriangle, MoreHorizontal, RefreshCw
} from 'lucide-react';
import { useRealtimeData, formatLastUpdated } from '../hooks/useRealtimeData';
import { useLanguage } from '../context/LanguageContext';
import { useNotifications } from '../context/NotificationContext';

const QUEUE_Tabs = {
    INTAKE: 'intake',
    ASSIGN: 'assign',
    REVIEW: 'review',
    APPROVE: 'approve'
};

// ─── Live Indicator ───
const LiveBadge = ({ isLive, isStale, lastUpdated, t }) => (
    <div className="flex items-center gap-2">
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${isStale ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
            : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
            }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isStale ? 'bg-amber-500' : isLive ? 'bg-emerald-500 animate-pulse' : 'bg-emerald-500'
                }`} />
            {isStale ? t('queue.stale', 'Stale') : t('queue.live', 'Live')}
        </div>
        {lastUpdated && (
            <span className="text-[10px] text-sf-muted">{formatLastUpdated(lastUpdated)}</span>
        )}
    </div>
);

const ManagerQueue = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { t } = useLanguage();

    const laneParam = (searchParams.get('lane') || searchParams.get('tab') || '').toLowerCase();
    const initialTab = Object.values(QUEUE_Tabs).includes(laneParam) ? laneParam : QUEUE_Tabs.INTAKE;
    const [activeTab, setActiveTab] = useState(initialTab);
    const [userSelected, setUserSelected] = useState(Boolean(laneParam));

    // Data States
    const [data, setData] = useState([]);
    const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Live counts from dashboard API for tab badges
    const { data: liveData, isLive, isStale, lastUpdated, refresh: refreshLive } = useRealtimeData('/api/dashboard/live', {
        interval: 15000,
        wsEvents: ['WORKITEM_CHANGED', 'WORKITEM_UPDATE'],
    });

    const handleTabChange = (newTab) => {
        setActiveTab(newTab);
        setUserSelected(true);
        setSearchParams({ lane: newTab }, { replace: true });
    };

    // If unparameterized, prioritize highest actionable lane once live data arrives
    useEffect(() => {
        if (!laneParam && !userSelected && liveData?.kpis) {
            const { awaitingReview, unassignedTasks, pendingIntakes, pendingApproval } = liveData.kpis;
            if (pendingApproval > 0) {
                setActiveTab(QUEUE_Tabs.APPROVE);
                setUserSelected(true);
            } else if (awaitingReview > 0) {
                setActiveTab(QUEUE_Tabs.REVIEW);
                setUserSelected(true);
            } else if (unassignedTasks > 0) {
                setActiveTab(QUEUE_Tabs.ASSIGN);
                setUserSelected(true);
            } else if (pendingIntakes > 0) {
                setActiveTab(QUEUE_Tabs.INTAKE);
                setUserSelected(true);
            }
        }
    }, [liveData, laneParam, userSelected]);

    // Fetch Trigger — now also polls
    const fetchQueueData = useCallback(async (page = 1) => {
        setLoading(true);
        setError(null);
        try {
            let endpoint = '';
            let params = { page, limit: 20 };

            switch (activeTab) {
                case QUEUE_Tabs.INTAKE:
                    endpoint = '/api/samples';
                    params.status = 'RECEIVED,COLLECTED';
                    break;
                case QUEUE_Tabs.ASSIGN:
                    endpoint = '/api/work';
                    params.status = 'NOT_ASSIGNED';
                    break;
                case QUEUE_Tabs.REVIEW:
                    endpoint = '/api/submissions';
                    break;
                case QUEUE_Tabs.APPROVE:
                    endpoint = '/api/dashboard/queues/manager.finalApproval';
                    break;
            }

            const res = await axios.get(endpoint, { params });

            if (res.data.rows && activeTab === QUEUE_Tabs.APPROVE) {
                const total = res.data.total || res.data.rows.length;
                const limit = params.limit || 20;
                setData(res.data.rows.map(r => ({
                    id: r.sampleId || r.key,
                    sampleId: r.sampleId || r.key,
                    labId: r.title,
                    originalId: r.key,
                    analysis: r.context,
                    status: r.status,
                    createdAt: new Date().toISOString()
                })));
                setMeta({
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit) || 1
                });
                return;
            }

            const result = res.data.data ? res.data : { data: res.data, meta: { page: 1, limit: 100, total: res.data.length, totalPages: 1 } };

            // Client-side filtering logic
            if (activeTab === QUEUE_Tabs.APPROVE) {
                result.data = result.data.filter(s => s.dryingStatus === 'DONE' && s.preparationStatus === 'DONE');
            }
            if (activeTab === QUEUE_Tabs.REVIEW) {
                result.data = result.data.filter(s => s.status === 'PENDING_REVIEW');

                const groups = {};
                result.data.forEach(sub => {
                    const sId = sub.sampleId;
                    if (!groups[sId]) {
                        groups[sId] = {
                            ...sub,
                            submissionIds: [sub.id],
                            taskCount: sub.workItemCount || 0,
                            isAggregated: true,
                            types: [sub.type]
                        };
                    } else {
                        groups[sId].submissionIds.push(sub.id);
                        groups[sId].taskCount += (sub.workItemCount || 0);
                        if (!groups[sId].types.includes(sub.type)) {
                            groups[sId].types.push(sub.type);
                        }
                        if (new Date(sub.submittedAt) > new Date(groups[sId].submittedAt)) {
                            groups[sId].submittedAt = sub.submittedAt;
                            groups[sId].submittedBy = sub.submittedBy;
                        }
                    }
                });
                result.data = Object.values(groups);
            }

            let finalData = result.data;

            // Aggregation logic for Assign tab
            if (activeTab === QUEUE_Tabs.ASSIGN) {
                const groups = {};
                finalData.forEach(item => {
                    if (!groups[item.sampleId]) {
                        groups[item.sampleId] = {
                            ...item,
                            analyses: [item.analysis],
                            itemIds: [item.id],
                            count: 1,
                            isAggregated: true
                        };
                    } else {
                        groups[item.sampleId].analyses.push(item.analysis);
                        groups[item.sampleId].itemIds.push(item.id);
                        groups[item.sampleId].count++;
                    }
                });
                finalData = Object.values(groups);
            }

            setData(finalData);
            // Recalculate meta from filtered/grouped data for accurate pagination
            const correctedTotal = finalData.length;
            const correctedTotalPages = Math.max(1, Math.ceil(correctedTotal / 20));
            setMeta({
                ...(result.meta || { page, limit: 20 }),
                page,
                total: correctedTotal,
                totalPages: correctedTotalPages
            });

        } catch (e) {
            console.error("Queue fetch failed", e);
            setError(t('queue.loadError', 'Failed to load queue. Please try again.'));
        } finally {
            setLoading(false);
        }
    }, [activeTab]);

    useEffect(() => {
        fetchQueueData(1);
    }, [activeTab, fetchQueueData]);

    // WebSocket-driven queue refresh (replaces old 15s polling)
    const { subscribeToEvent } = useNotifications();
    useEffect(() => {
        if (!subscribeToEvent) return;
        let debounceTimer = null;
        const debouncedRefresh = () => {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                fetchQueueData(meta.page);
            }, 500);
        };
        const unsubs = [
            subscribeToEvent('WORKITEM_CHANGED', debouncedRefresh),
            subscribeToEvent('WORKITEM_UPDATE', debouncedRefresh),
        ];
        return () => {
            if (debounceTimer) clearTimeout(debounceTimer);
            unsubs.forEach(u => u && u());
        };
    }, [subscribeToEvent, fetchQueueData, meta.page]);

    const handlePageChange = (newPage) => {
        if (newPage > 0 && newPage <= meta.totalPages) {
            fetchQueueData(newPage);
        }
    };

    // Tab badge counts from live data
    const tabCounts = {
        intake: liveData?.kpis?.pendingIntakes || 0,
        assign: liveData?.kpis?.unassignedTasks || 0,
        review: liveData?.kpis?.awaitingReview || 0,
        approve: 0, // we don't track this in live endpoint currently
    };

    const TabButton = ({ id, icon: Icon, label }) => {
        const count = tabCounts[id];
        return (
            <button
                onClick={() => handleTabChange(id)}
                className={`flex items-center gap-2 px-4 sm:px-6 py-3 sm:py-4 border-b-2 font-medium transition-colors relative whitespace-nowrap touch-target ${activeTab === id
                    ? 'border-sf-emerald text-sf-emerald bg-emerald-50/50 dark:bg-emerald-950/20 font-bold'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-sf-raised/30'
                    }`}
            >
                <Icon size={18} />
                {label}
                {count > 0 && (
                    <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-black ${activeTab === id
                        ? 'bg-sf-emerald text-white'
                        : 'bg-sf-raised text-sf-muted'
                        }`}>
                        {count}
                    </span>
                )}
            </button>
        );
    };

    return (
        <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6 sm:space-y-8" data-tour="manager-queue-container">
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-sf-text">{t('queue.title', 'Manager Queue')}</h1>
                    <p className="text-gray-500">{t('queue.subtitle', 'Operational Dashboard')}</p>
                </div>
                <div className="flex items-center gap-3">
                    <LiveBadge isLive={isLive} isStale={isStale} lastUpdated={lastUpdated} t={t} />
                    <button onClick={() => { refreshLive(); fetchQueueData(meta.page); }} className="p-2 rounded-lg hover:bg-sf-raised transition-colors" title="Refresh now" aria-label="Refresh queue">
                        <RefreshCw size={16} className="text-gray-400" />
                    </button>
                </div>
            </header>

            <div className="bg-sf-surface rounded-xl shadow-sm border border-sf-divider overflow-hidden min-h-[600px] flex flex-col">
                {/* TABS */}
                <div className="flex border-b border-sf-divider overflow-x-auto">
                    <TabButton id={QUEUE_Tabs.INTAKE} icon={AlertOctagon} label={t('queue.tabIntake', 'New (Intake)')} />
                    <TabButton id={QUEUE_Tabs.ASSIGN} icon={UserPlus} label={t('queue.tabAssign', 'Assign Work')} />
                    <TabButton id={QUEUE_Tabs.REVIEW} icon={FileText} label={t('queue.tabReview', 'Review Submissions')} />
                    <TabButton id={QUEUE_Tabs.APPROVE} icon={ShieldCheck} label={t('queue.tabApprove', 'Final Approvals')} />
                </div>

                {/* CONTENT */}
                <div className="flex-1 p-6 relative bg-sf-canvas">
                    {loading && (
                        <div className="absolute inset-0 bg-sf-surface/50 flex items-center justify-center z-10 backdrop-blur-sm">
                            <Loader className="animate-spin text-indigo-600" size={32} />
                        </div>
                    )}

                    {error && (
                        <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg mb-4 border border-red-200 dark:border-red-800">
                            {error}
                        </div>
                    )}

                    {!loading && data.length === 0 && (
                        <div className="h-64 flex flex-col items-center justify-center text-sf-muted italic">
                            <CheckCircle size={48} className="mb-4 text-sf-muted/40" />
                            <p>{t('queue.empty', 'Queue is empty. Good job!')}</p>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {data.map(item => (
                            <QueueCard key={item.id} item={item} type={activeTab} navigate={navigate} t={t} />
                        ))}
                    </div>
                </div>

                {/* PAGINATION */}
                {meta && meta.totalPages > 1 && (
                    <div className="px-6 py-4 border-t border-sf-divider bg-sf-surface flex items-center justify-between">
                        <span className="text-sm text-gray-500">
                            Page {meta.page} of {meta.totalPages} ({meta.total} items)
                        </span>
                        <div className="flex gap-2">
                            <button
                                disabled={meta.page === 1}
                                onClick={() => handlePageChange(meta.page - 1)}
                                className="p-2 border rounded hover:bg-sf-raised disabled:opacity-50"
                            >
                                <ArrowLeft size={16} />
                            </button>
                            <button
                                disabled={meta.page === meta.totalPages}
                                onClick={() => handlePageChange(meta.page + 1)}
                                className="p-2 border rounded hover:bg-sf-raised disabled:opacity-50"
                            >
                                <ArrowRight size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// Internal Component for Card Rendering
const QueueCard = ({ item, type, navigate, t }) => {
    const getAnalysisDisplayName = useAnalysisNames();
    const config = {
        intake: {
            icon: FlaskConical,
            color: 'text-blue-600',
            bg: 'bg-blue-100 dark:bg-blue-900/40',
            label: t('queue.cardNewSample', 'New Sample'),
            action: t('queue.cardReviewIntake', 'Review Intake')
        },
        assign: {
            icon: Microscope,
            color: 'text-purple-600',
            bg: 'bg-purple-100 dark:bg-purple-900/40',
            label: t('queue.cardAnalysisPending', 'Analysis Pending'),
            action: t('queue.cardAssignTech', 'Assign Tech')
        },
        review: {
            icon: FileText,
            color: 'text-orange-600',
            bg: 'bg-orange-100 dark:bg-orange-900/40',
            label: t('queue.cardResultsPending', 'Results Pending'),
            action: t('queue.cardReview', 'Review')
        },
        approve: {
            icon: ShieldCheck,
            color: 'text-green-600',
            bg: 'bg-green-100 dark:bg-green-900/40',
            label: t('queue.cardFinalApproval', 'Final Approval'),
            action: t('queue.cardApprove', 'Approve')
        }
    }[type];

    const Icon = config.icon;

    const title = (type === 'assign' || type === 'review')
        ? `Sample ${item.sampleId || item.id}`
        : (item.labId || (String(item.originalId) || item.type));
    const subtitle = type === 'assign'
        ? (item.analyses ? item.analyses.map(a => getAnalysisDisplayName(a)).join(', ') : t('queue.noAnalyses', 'No analyses'))
        : (type === 'review' && item.isAggregated)
            ? `${item.types?.map(t => getAnalysisDisplayName(t)).join('/') || ''} ${t('queue.cardReview', 'Review')}`
            : (item.clientName || (item.analysis ? getAnalysisDisplayName(item.analysis) : t('queue.unknownClient', 'Unknown Client')));
    const date = new Date(item.createdAt || item.receptionDate).toLocaleDateString();

    const isUrgent = item.priority === 'URGENT' || (item.tags && item.tags.includes('URGENT'));
    const targetUrl = type === 'review'
        ? `/samples/${item.sampleId || item.id}?tab=review`
        : `/samples/${item.sampleId || item.id}`;

    return (
        <button
            onClick={() => navigate(targetUrl)}
            className="group bg-sf-surface rounded-xl border border-sf-divider shadow-sm hover:shadow-md hover:border-sf-emerald transition-all cursor-pointer flex flex-col relative overflow-hidden text-left w-full focus:outline-none focus:ring-2 focus:ring-sf-emerald"
            aria-label={`${config.label}: ${title}`}
        >
            {isUrgent && <div className="absolute top-0 right-0 bg-red-500 text-white text-[10px] uppercase font-bold px-2 py-0.5 rounded-bl-lg z-10">{t('queue.urgent', 'Urgent')}</div>}

            <div className="p-5 flex-1">
                <div className="flex justify-between items-start mb-4">
                    <div className={`p-3 rounded-lg ${config.bg} ${config.color}`}>
                        <Icon size={20} />
                    </div>
                    <div className="text-right">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-sf-muted bg-sf-canvas px-2 py-1 rounded-full">
                            {config.label}
                        </span>
                    </div>
                </div>

                <div className="mb-4">
                    <h3 className="font-bold text-sf-text text-lg truncate leading-tight" title={title}>{title}</h3>
                    {(item.originalId || item.sampleId) && (
                        <div className="text-[10px] text-sf-muted font-mono mt-0.5 uppercase tracking-tighter">
                            ID: {item.originalId || item.sampleId}
                        </div>
                    )}
                    <div className="text-[11px] text-sf-muted font-bold mt-2 min-h-[1.5rem] line-clamp-2">
                        {subtitle}
                    </div>
                    {item.isAggregated && (
                        <div className="text-[10px] text-sf-muted uppercase tracking-wider mt-1 font-bold">
                            {(item.itemIds?.length || item.taskCount || 0)} {t('queue.tasksPending', 'Tasks Pending')}
                        </div>
                    )}
                </div>

                {type === 'approve' && (
                    <div className="flex gap-2 mb-4">
                        <span className="text-[10px] bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-1 rounded font-bold border border-green-100 dark:border-green-800">DRY: OK</span>
                        <span className="text-[10px] bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-1 rounded font-bold border border-green-100 dark:border-green-800">PREP: OK</span>
                    </div>
                )}

                {type === 'review' && (
                    <div className="flex gap-2 mb-4">
                        <span className="text-[10px] bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 px-2 py-1 rounded font-bold border border-orange-100 dark:border-orange-800">
                            By: {item.submittedBy || 'Tech'}
                        </span>
                    </div>
                )}
            </div>

            <div className="px-5 py-3 border-t border-sf-divider bg-sf-canvas flex justify-between items-center group-hover:bg-sf-raised transition-colors">
                <div className="flex items-center gap-1.5 text-xs text-sf-muted font-medium">
                    <Calendar size={12} />
                    {date}
                </div>
                <div className="flex items-center gap-1 text-xs font-bold text-sf-emerald opacity-0 group-hover:opacity-100 transition-opacity -translate-x-2 group-hover:translate-x-0 duration-300">
                    {config.action} <ArrowRight size={12} />
                </div>
            </div>
        </button>
    );
};

export default ManagerQueue;
