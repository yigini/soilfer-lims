import { useAnalysisNames } from '../context/AnalysisCatalogueContext';
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import {
    FlaskConical, ArrowRight, CheckCircle, Clock, Loader,
    ArrowLeft, ChevronRight, AlertTriangle, Zap, Activity,
    RefreshCw, ClipboardList, ArrowUpRight, Filter
} from 'lucide-react';
import { formatLastUpdated } from '../hooks/useRealtimeData';

// ─── Live Indicator ───
const LiveBadge = ({ isLive, isStale, lastUpdated }) => (
    <div className="flex items-center gap-2">
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${isStale ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
            : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
            }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isStale ? 'bg-amber-500' : isLive ? 'bg-emerald-500 animate-pulse' : 'bg-emerald-500'
                }`} />
            {isStale ? 'Stale' : 'Live'}
        </div>
        {lastUpdated && (
            <span className="text-[10px] text-sf-muted">{formatLastUpdated(lastUpdated)}</span>
        )}
    </div>
);

const MyWork = () => {
    const getAnalysisDisplayName = useAnalysisNames();
    const { user } = useAuth();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('active');
    const [work, setWork] = useState([]);
    const [reanalysis, setReanalysis] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [meta, setMeta] = useState({ total: 0, totalPages: 1 });
    const [lastUpdated, setLastUpdated] = useState(null);
    const [isLive, setIsLive] = useState(false);
    const [isStale, setIsStale] = useState(false);

    const fetchMyWork = useCallback(async () => {
        try {
            const [workRes, reanalysisRes] = await Promise.all([
                axios.get(`/api/work?assignedTo=${user.username}&page=${page}&limit=50`),
                axios.get('/api/submissions/reanalysis').catch(() => ({ data: [] }))
            ]);

            const items = workRes.data.data || workRes.data || [];
            setReanalysis(Array.isArray(reanalysisRes.data) ? reanalysisRes.data : []);

            // Group
            const groups = {};
            items.forEach(item => {
                const key = item.sampleId;
                if (!groups[key]) {
                    groups[key] = {
                        sampleId: key,
                        labId: item.labId || key,
                        items: [item],
                        analyses: [item.analysis],
                        status: item.status,
                        priority: item.priority,
                        createdAt: item.createdAt,
                    };
                } else {
                    groups[key].items.push(item);
                    if (!groups[key].analyses.includes(item.analysis)) groups[key].analyses.push(item.analysis);
                    if (item.priority === 'URGENT') groups[key].priority = 'URGENT';
                }
            });

            const completedStatuses = ['ACCEPTED', 'COMPLETED', 'APPROVED', 'SUBMITTED', 'SUBMITTED_FOR_REVIEW', 'UNDER_REVIEW'];
            const reanalysisStatuses = ['REANALYSIS_REQUIRED', 'REJECTED', 'FAILED'];
            const activeStatuses = ['ASSIGNED', 'PENDING', 'IN_PROGRESS'];

            const grouped = Object.values(groups).map(g => {
                const totalCount = g.items.length;
                const completedCount = g.items.filter(i => completedStatuses.includes(i.status)).length;
                const hasReanalysis = g.items.some(i => reanalysisStatuses.includes(i.status));
                const hasActive = g.items.some(i => activeStatuses.includes(i.status));
                const hasRecorded = g.items.some(i => i.status === 'COMPLETED');
                return {
                    ...g,
                    totalCount,
                    completedCount,
                    hasReanalysis,
                    hasActive,
                    hasRecorded
                };
            });

            setWork(grouped);
            setMeta({
                total: grouped.length,
                totalPages: Math.max(1, Math.ceil(grouped.length / 50))
            });
            setLastUpdated(new Date());
            setIsStale(false);
            setIsLive(true);
            setTimeout(() => setIsLive(false), 1000);
        } catch (e) {
            console.error('Failed to fetch work', e);
        } finally {
            setLoading(false);
        }
    }, [user.username, page]);

    useEffect(() => {
        fetchMyWork();
    }, [fetchMyWork]);

    // Auto-refresh every 15s
    useEffect(() => {
        const interval = setInterval(fetchMyWork, 15000);
        return () => clearInterval(interval);
    }, [fetchMyWork]);

    // Staleness detection
    useEffect(() => {
        if (!lastUpdated) return;
        const interval = setInterval(() => {
            if (Date.now() - lastUpdated.getTime() > 60000) setIsStale(true);
        }, 5000);
        return () => clearInterval(interval);
    }, [lastUpdated]);

    // ─── 6 Canonical Lifecycle Buckets ───
    const activeWork = work.filter(g => g.items.some(i => ['ASSIGNED', 'PENDING', 'IN_PROGRESS'].includes(i.status)));
    const recordedWork = work.filter(g => g.items.some(i => i.status === 'COMPLETED'));
    const reviewWork = work.filter(g => g.items.some(i => ['SUBMITTED', 'SUBMITTED_FOR_REVIEW', 'UNDER_REVIEW'].includes(i.status)));
    const redoWork = work.filter(g => g.items.some(i => ['REANALYSIS_REQUIRED', 'REJECTED', 'FAILED'].includes(i.status)));
    const acceptedWork = work.filter(g => g.items.some(i => ['ACCEPTED', 'APPROVED'].includes(i.status)));
    const waivedWork = work.filter(g => g.items.some(i => ['WAIVED', 'CANCELLED'].includes(i.status)));

    let currentList = activeWork;
    if (activeTab === 'recorded') currentList = recordedWork;
    else if (activeTab === 'review') currentList = reviewWork;
    else if (activeTab === 'redo') currentList = redoWork;
    else if (activeTab === 'accepted') currentList = acceptedWork;
    else if (activeTab === 'waived') currentList = waivedWork;

    // KPIs
    const totalActive = activeWork.reduce((sum, g) => sum + g.items.filter(i => ['ASSIGNED', 'PENDING', 'IN_PROGRESS'].includes(i.status)).length, 0);
    const totalRecorded = recordedWork.reduce((sum, g) => sum + g.items.filter(i => i.status === 'COMPLETED').length, 0);
    const totalReview = reviewWork.reduce((sum, g) => sum + g.items.filter(i => ['SUBMITTED', 'SUBMITTED_FOR_REVIEW', 'UNDER_REVIEW'].includes(i.status)).length, 0);
    const totalRedo = redoWork.reduce((sum, g) => sum + g.items.filter(i => ['REANALYSIS_REQUIRED', 'REJECTED', 'FAILED'].includes(i.status)).length, 0);
    const totalAccepted = acceptedWork.reduce((sum, g) => sum + g.items.filter(i => ['ACCEPTED', 'APPROVED'].includes(i.status)).length, 0);
    const totalWaived = waivedWork.reduce((sum, g) => sum + g.items.filter(i => ['WAIVED', 'CANCELLED'].includes(i.status)).length, 0);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64 gap-3">
                <RefreshCw size={20} className="animate-spin text-blue-500" />
                <span className="text-sf-muted font-medium">Loading your work...</span>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-6xl mx-auto space-y-6 pb-12">
            {/* ─── Header ─── */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-sf-text">My Work</h1>
                    <p className="text-sm text-gray-500 mt-0.5">Welcome back, {user.name || user.username}</p>
                </div>
                <div className="flex items-center gap-3">
                    <LiveBadge isLive={isLive} isStale={isStale} lastUpdated={lastUpdated} />
                    <button onClick={fetchMyWork} className="p-2 rounded-lg hover:bg-sf-raised transition-colors" title="Refresh now">
                        <RefreshCw size={16} className="text-sf-muted" />
                    </button>
                </div>
            </div>

            {/* ─── Reanalysis Banner ─── */}
            {totalRedo > 0 && (
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl border bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300">
                    <Zap size={16} className="shrink-0 animate-pulse" />
                    <span className="text-sm font-bold">{totalRedo} item(s) require reanalysis / redo</span>
                    <span className="text-xs text-red-500">Needs immediate attention</span>
                </div>
            )}

            {/* ─── KPI Row ─── */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="p-4 rounded-xl border bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">Active</span>
                        <ClipboardList size={14} className="text-blue-500 opacity-60" />
                    </div>
                    <span className="text-2xl font-black text-blue-700 dark:text-blue-300">{totalActive}</span>
                </div>
                <div className="p-4 rounded-xl border bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">Recorded</span>
                        <CheckCircle size={14} className="text-amber-500 opacity-60" />
                    </div>
                    <span className="text-2xl font-black text-amber-700 dark:text-amber-300">{totalRecorded}</span>
                </div>
                <div className="p-4 rounded-xl border bg-purple-50 border-purple-200 dark:bg-purple-900/20 dark:border-purple-800">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">Awaiting Review</span>
                        <Clock size={14} className="text-purple-500 opacity-60" />
                    </div>
                    <span className="text-2xl font-black text-purple-700 dark:text-purple-300">{totalReview}</span>
                </div>
                <div className={`p-4 rounded-xl border ${totalRedo > 0 ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800' : 'bg-gray-50 border-gray-200 dark:bg-gray-800 dark:border-gray-700'}`}>
                    <div className="flex items-center justify-between mb-1">
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${totalRedo > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-500'}`}>Needs Redo</span>
                        <Zap size={14} className={`opacity-60 ${totalRedo > 0 ? 'text-red-500' : 'text-gray-400'}`} />
                    </div>
                    <span className={`text-2xl font-black ${totalRedo > 0 ? 'text-red-700 dark:text-red-300' : 'text-sf-muted'}`}>{totalRedo}</span>
                </div>
                <div className="p-4 rounded-xl border bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Accepted</span>
                        <CheckCircle size={14} className="text-emerald-500 opacity-60" />
                    </div>
                    <span className="text-2xl font-black text-emerald-700 dark:text-emerald-300">{totalAccepted}</span>
                </div>
                <div className="p-4 rounded-xl border bg-gray-50 border-gray-200 dark:bg-gray-800 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Waived</span>
                        <Filter size={14} className="text-gray-400 opacity-60" />
                    </div>
                    <span className="text-2xl font-black text-sf-muted">{totalWaived}</span>
                </div>
            </div>

            {/* ─── Canonical Tabs ─── */}
            <div className="flex gap-1 bg-sf-raised rounded-lg p-1 w-fit overflow-x-auto">
                <button
                    onClick={() => setActiveTab('active')}
                    className={`px-3.5 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === 'active'
                        ? 'bg-white dark:bg-gray-700 text-sf-text shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                        }`}
                >
                    Active ({activeWork.length})
                </button>
                <button
                    onClick={() => setActiveTab('recorded')}
                    className={`px-3.5 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === 'recorded'
                        ? 'bg-white dark:bg-gray-700 text-amber-700 dark:text-amber-300 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                        }`}
                >
                    Ready to Submit ({recordedWork.length})
                </button>
                <button
                    onClick={() => setActiveTab('review')}
                    className={`px-3.5 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === 'review'
                        ? 'bg-white dark:bg-gray-700 text-sf-text shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                        }`}
                >
                    Awaiting Review ({reviewWork.length})
                </button>
                <button
                    onClick={() => setActiveTab('redo')}
                    className={`px-3.5 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === 'redo'
                        ? 'bg-white dark:bg-gray-700 text-red-600 dark:text-red-400 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                        }`}
                >
                    Needs Redo ({redoWork.length})
                </button>
                <button
                    onClick={() => setActiveTab('accepted')}
                    className={`px-3.5 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === 'accepted'
                        ? 'bg-white dark:bg-gray-700 text-emerald-600 dark:text-emerald-400 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                        }`}
                >
                    Accepted ({acceptedWork.length})
                </button>
                <button
                    onClick={() => setActiveTab('waived')}
                    className={`px-3.5 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === 'waived'
                        ? 'bg-white dark:bg-gray-700 text-sf-text shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                        }`}
                >
                    Waived ({waivedWork.length})
                </button>
            </div>

            {/* ─── Work List ─── */}
            <div className="space-y-2">
                {currentList.length > 0 ? (
                    currentList.sort((a, b) => {
                        // Urgent first, then reanalysis, then by date
                        if (a.priority === 'URGENT' && b.priority !== 'URGENT') return -1;
                        if (b.priority === 'URGENT' && a.priority !== 'URGENT') return 1;
                        if (a.hasReanalysis && !b.hasReanalysis) return -1;
                        if (b.hasReanalysis && !a.hasReanalysis) return 1;
                        return new Date(b.createdAt) - new Date(a.createdAt);
                    }).map(group => {
                        const progress = group.totalCount > 0 ? Math.round((group.completedCount / group.totalCount) * 100) : 0;
                        return (
                            <div
                                key={group.sampleId}
                                onClick={() => {
                                    if (['active', 'recorded', 'redo'].includes(activeTab) || group.hasActive || group.hasReanalysis || group.hasRecorded) {
                                        navigate(`/workbench?sampleId=${encodeURIComponent(group.sampleId)}&analysis=${encodeURIComponent(group.analyses[0] || '')}`);
                                    } else {
                                        navigate(`/samples/${group.sampleId}`);
                                    }
                                }}
                                className="w-full flex items-center justify-between p-4 rounded-xl bg-sf-surface border border-sf-divider hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md transition-all text-left group cursor-pointer"
                            >
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                    {/* Priority/Status indicator */}
                                    <div className="shrink-0">
                                        {group.priority === 'URGENT' ? (
                                            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse block" />
                                        ) : group.hasReanalysis ? (
                                            <Zap size={14} className="text-red-500" />
                                        ) : group.hasActive ? (
                                            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 block" />
                                        ) : group.hasRecorded ? (
                                            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 block" />
                                        ) : (
                                            <CheckCircle size={14} className="text-emerald-500" />
                                        )}
                                    </div>

                                    {/* Sample info */}
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-sm text-sf-text truncate">
                                                {group.labId || group.sampleId.substring(0, 12)}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    navigate(`/samples/${group.sampleId}`);
                                                }}
                                                className="text-[10px] text-blue-500 hover:underline shrink-0"
                                                title="View sample record"
                                            >
                                                Details
                                            </button>
                                        </div>
                                        <div className="text-[10px] text-sf-muted mt-0.5 truncate">
                                            {group.analyses?.map(a => getAnalysisDisplayName(a)).join(', ')}
                                        </div>
                                    </div>
                                </div>

                                {/* Right side — progress + status */}
                                <div className="flex items-center gap-4 shrink-0 ml-3">
                                    {/* Progress bar */}
                                    <div className="hidden md:block w-24">
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all ${progress === 100 ? 'bg-emerald-500' : progress > 0 ? 'bg-blue-500' : 'bg-gray-300'
                                                        }`}
                                                    style={{ width: `${progress}%` }}
                                                />
                                            </div>
                                            <span className="text-[10px] font-bold text-sf-muted w-8 text-right">{group.completedCount}/{group.totalCount}</span>
                                        </div>
                                    </div>

                                    {/* Status badges */}
                                    {group.hasRecorded && (
                                        <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">Recorded</span>
                                    )}
                                    {group.hasReanalysis && (
                                        <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">Redo</span>
                                    )}
                                    {group.priority === 'URGENT' && (
                                        <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-red-500 text-white">Urgent</span>
                                    )}

                                    <div className="flex items-center gap-1 text-xs font-semibold text-gray-400 group-hover:text-blue-500 transition-colors">
                                        <span className="hidden sm:inline text-[11px]">
                                            {['active', 'recorded', 'redo'].includes(activeTab) || group.hasActive || group.hasReanalysis || group.hasRecorded ? 'Workbench' : 'View'}
                                        </span>
                                        <ArrowRight size={14} />
                                    </div>
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div className="text-center py-16 text-sf-muted text-sm border border-dashed rounded-xl bg-sf-canvas">
                        <CheckCircle size={32} className="mx-auto mb-3 text-emerald-400" />
                        <p className="font-bold text-base">{activeTab === 'active' ? 'All clear!' : 'Nothing completed yet'}</p>
                        <p className="text-[11px] mt-1">{activeTab === 'active' ? 'No active work items — check back soon' : 'Completed work will appear here'}</p>
                    </div>
                )}
            </div>

            {/* ─── Pagination ─── */}
            {meta.totalPages > 1 && (
                <div className="flex items-center justify-between pt-4">
                    <span className="text-sm text-gray-500">Page {page} of {meta.totalPages}</span>
                    <div className="flex gap-2">
                        <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="p-2 border rounded-lg hover:bg-sf-raised disabled:opacity-50">
                            <ArrowLeft size={16} />
                        </button>
                        <button disabled={page >= meta.totalPages} onClick={() => setPage(p => p + 1)} className="p-2 border rounded-lg hover:bg-sf-raised disabled:opacity-50">
                            <ArrowRight size={16} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MyWork;
