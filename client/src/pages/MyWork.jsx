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
            <span className="text-[10px] text-gray-400">{formatLastUpdated(lastUpdated)}</span>
        )}
    </div>
);

const MyWork = () => {
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
            setMeta(workRes.data.meta || { total: items.length, totalPages: 1 });
            setReanalysis(Array.isArray(reanalysisRes.data) ? reanalysisRes.data : []);

            // Group by sample
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
                        hasActive: ['ASSIGNED', 'PENDING', 'IN_PROGRESS'].includes(item.status),
                        hasCompleted: item.status === 'COMPLETED',
                        hasReanalysis: item.status === 'REANALYSIS_REQUIRED',
                        priority: item.priority,
                        createdAt: item.createdAt,
                        completedCount: item.status === 'COMPLETED' ? 1 : 0,
                        totalCount: 1,
                    };
                } else {
                    groups[key].items.push(item);
                    if (!groups[key].analyses.includes(item.analysis)) groups[key].analyses.push(item.analysis);
                    groups[key].totalCount++;
                    if (['ASSIGNED', 'PENDING', 'IN_PROGRESS'].includes(item.status)) groups[key].hasActive = true;
                    if (item.status === 'COMPLETED') { groups[key].hasCompleted = true; groups[key].completedCount++; }
                    if (item.status === 'REANALYSIS_REQUIRED') groups[key].hasReanalysis = true;
                    if (item.priority === 'URGENT') groups[key].priority = 'URGENT';
                }
            });

            setWork(Object.values(groups));
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

    const activeWork = work.filter(g => g.hasActive || g.hasReanalysis);
    const completedWork = work.filter(g => !g.hasActive && !g.hasReanalysis && g.hasCompleted);
    const reanalysisCount = work.filter(g => g.hasReanalysis).length;
    const currentList = activeTab === 'active' ? activeWork : completedWork;

    // KPIs
    const totalActive = activeWork.reduce((sum, g) => sum + g.items.filter(i => ['ASSIGNED', 'PENDING', 'IN_PROGRESS'].includes(i.status)).length, 0);
    const totalInProgress = activeWork.reduce((sum, g) => sum + g.items.filter(i => i.status === 'IN_PROGRESS').length, 0);
    const totalCompleted = completedWork.reduce((sum, g) => sum + g.completedCount, 0);
    const totalReanalysis = work.filter(g => g.hasReanalysis).reduce((sum, g) => sum + g.items.filter(i => i.status === 'REANALYSIS_REQUIRED').length, 0);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64 gap-3">
                <RefreshCw size={20} className="animate-spin text-blue-500" />
                <span className="text-gray-400 font-medium">Loading your work...</span>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-6xl mx-auto space-y-6 pb-12">
            {/* ─── Header ─── */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 dark:text-gray-100">My Work</h1>
                    <p className="text-sm text-gray-500 mt-0.5">Welcome back, {user.name || user.username}</p>
                </div>
                <div className="flex items-center gap-3">
                    <LiveBadge isLive={isLive} isStale={isStale} lastUpdated={lastUpdated} />
                    <button onClick={fetchMyWork} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" title="Refresh now">
                        <RefreshCw size={16} className="text-gray-400" />
                    </button>
                </div>
            </div>

            {/* ─── Reanalysis Banner ─── */}
            {totalReanalysis > 0 && (
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl border bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300">
                    <Zap size={16} className="shrink-0 animate-pulse" />
                    <span className="text-sm font-bold">{totalReanalysis} item(s) require reanalysis</span>
                    <span className="text-xs text-red-500">Needs immediate attention</span>
                </div>
            )}

            {/* ─── KPI Row ─── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-4 rounded-xl border bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">Active Tasks</span>
                        <ClipboardList size={14} className="text-blue-500 opacity-60" />
                    </div>
                    <span className="text-2xl font-black text-blue-700 dark:text-blue-300">{totalActive}</span>
                </div>
                <div className="p-4 rounded-xl border bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-800">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-orange-600 dark:text-orange-400">In Progress</span>
                        <Activity size={14} className="text-orange-500 opacity-60" />
                    </div>
                    <span className="text-2xl font-black text-orange-700 dark:text-orange-300">{totalInProgress}</span>
                </div>
                <div className="p-4 rounded-xl border bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Completed</span>
                        <CheckCircle size={14} className="text-emerald-500 opacity-60" />
                    </div>
                    <span className="text-2xl font-black text-emerald-700 dark:text-emerald-300">{totalCompleted}</span>
                </div>
                <div className={`p-4 rounded-xl border ${totalReanalysis > 0 ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800' : 'bg-gray-50 border-gray-200 dark:bg-gray-800 dark:border-gray-700'}`}>
                    <div className="flex items-center justify-between mb-1">
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${totalReanalysis > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-500'}`}>Reanalysis</span>
                        <Zap size={14} className={`opacity-60 ${totalReanalysis > 0 ? 'text-red-500' : 'text-gray-400'}`} />
                    </div>
                    <span className={`text-2xl font-black ${totalReanalysis > 0 ? 'text-red-700 dark:text-red-300' : 'text-gray-600 dark:text-gray-400'}`}>{totalReanalysis}</span>
                </div>
            </div>

            {/* ─── Tabs ─── */}
            <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 w-fit">
                <button
                    onClick={() => setActiveTab('active')}
                    className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'active'
                            ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                >
                    Active ({activeWork.length})
                </button>
                <button
                    onClick={() => setActiveTab('completed')}
                    className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'completed'
                            ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                >
                    Completed ({completedWork.length})
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
                            <button
                                key={group.sampleId}
                                onClick={() => navigate(`/samples/${group.sampleId}`)}
                                className="w-full flex items-center justify-between p-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md transition-all text-left group"
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
                                        ) : (
                                            <CheckCircle size={14} className="text-emerald-500" />
                                        )}
                                    </div>

                                    {/* Sample info */}
                                    <div className="min-w-0 flex-1">
                                        <div className="font-bold text-sm text-gray-800 dark:text-gray-200 truncate">
                                            {group.labId || group.sampleId.substring(0, 12)}
                                        </div>
                                        <div className="text-[10px] text-gray-400 mt-0.5 truncate">
                                            {group.analyses?.join(', ')}
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
                                            <span className="text-[10px] font-bold text-gray-400 w-8 text-right">{group.completedCount}/{group.totalCount}</span>
                                        </div>
                                    </div>

                                    {/* Status badges */}
                                    {group.hasReanalysis && (
                                        <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">Redo</span>
                                    )}
                                    {group.priority === 'URGENT' && (
                                        <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-red-500 text-white">Urgent</span>
                                    )}

                                    <ArrowRight size={14} className="text-gray-300 group-hover:text-blue-500 transition-colors" />
                                </div>
                            </button>
                        );
                    })
                ) : (
                    <div className="text-center py-16 text-gray-400 text-sm border border-dashed rounded-xl bg-gray-50/50 dark:bg-gray-800/50">
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
                        <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="p-2 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50">
                            <ArrowLeft size={16} />
                        </button>
                        <button disabled={page >= meta.totalPages} onClick={() => setPage(p => p + 1)} className="p-2 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50">
                            <ArrowRight size={16} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MyWork;
