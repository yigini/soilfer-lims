import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ClipboardList, Clock, CheckCircle, AlertTriangle, ArrowRight,
    RefreshCw, FlaskConical, Zap, Activity, ArrowUpRight, Beaker
} from 'lucide-react';
import { useRealtimeData, formatLastUpdated } from '../../hooks/useRealtimeData';

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

const TechnicianDashboard = ({ user }) => {
    const navigate = useNavigate();
    const { data, loading, isLive, isStale, lastUpdated, refresh } = useRealtimeData('/api/dashboard/live', {
        interval: 15000,
        wsEvents: ['WORKITEM_CHANGED', 'WORKITEM_UPDATE'],
    });

    if (loading && !data) {
        return (
            <div className="flex items-center justify-center h-64 gap-3">
                <RefreshCw size={20} className="animate-spin text-blue-500" />
                <span className="text-gray-400 font-medium">Loading your workspace...</span>
            </div>
        );
    }

    const kpis = data?.kpis || {};
    const myQueue = data?.myQueue || [];
    const reanalysis = data?.reanalysis || [];
    const warnings = data?.warnings || [];

    return (
        <div className="space-y-6 pb-12">
            {/* ─── Header ─── */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-black text-sf-text">
                        My Workspace
                    </h2>
                    <p className="text-sm text-gray-500 mt-0.5">Welcome back, {user.name || user.username}</p>
                </div>
                <div className="flex items-center gap-3">
                    <LiveBadge isLive={isLive} isStale={isStale} lastUpdated={lastUpdated} />
                    <button onClick={refresh} className="p-2 rounded-lg hover:bg-sf-raised transition-colors" title="Refresh now">
                        <RefreshCw size={16} className="text-gray-400" />
                    </button>
                </div>
            </div>

            {/* ─── Urgent Banner ─── */}
            {warnings.length > 0 && (
                <div className="space-y-2">
                    {warnings.map((w, i) => (
                        <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-xl border bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300 animate-pulse">
                            <AlertTriangle size={16} className="shrink-0" />
                            <span className="text-sm font-bold">{w.message}</span>
                            <button
                                onClick={() => navigate('/my-work')}
                                className="ml-auto text-xs font-bold bg-red-500 text-white px-3 py-1 rounded-lg hover:bg-red-600 transition-colors flex items-center gap-1"
                            >
                                Fix Now <ArrowRight size={12} />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* ─── KPI Row ─── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-5 rounded-xl border bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">Assigned</span>
                        <ClipboardList size={16} className="text-blue-500 opacity-60" />
                    </div>
                    <span className="text-3xl font-black text-blue-700 dark:text-blue-300">{kpis.assignedToMe || 0}</span>
                </div>
                <div className="p-5 rounded-xl border bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-800">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold uppercase tracking-wider text-orange-600 dark:text-orange-400">In Progress</span>
                        <Activity size={16} className="text-orange-500 opacity-60" />
                    </div>
                    <span className="text-3xl font-black text-orange-700 dark:text-orange-300">{kpis.inProgress || 0}</span>
                </div>
                <div className="p-5 rounded-xl border bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Done Today</span>
                        <CheckCircle size={16} className="text-emerald-500 opacity-60" />
                    </div>
                    <span className="text-3xl font-black text-emerald-700 dark:text-emerald-300">{kpis.completedToday || 0}</span>
                </div>
                <div className={`p-5 rounded-xl border ${kpis.reanalysisRequired > 0
                    ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
                    : 'bg-gray-50 border-gray-200 dark:bg-gray-800 dark:border-gray-700'
                    }`}>
                    <div className="flex items-center justify-between mb-1">
                        <span className={`text-xs font-bold uppercase tracking-wider ${kpis.reanalysisRequired > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-500'
                            }`}>Reanalysis</span>
                        <Zap size={16} className={`opacity-60 ${kpis.reanalysisRequired > 0 ? 'text-red-500' : 'text-gray-400'}`} />
                    </div>
                    <span className={`text-3xl font-black ${kpis.reanalysisRequired > 0 ? 'text-red-700 dark:text-red-300' : 'text-sf-muted'
                        }`}>{kpis.reanalysisRequired || 0}</span>
                </div>
            </div>

            {/* ─── Reanalysis Items ─── */}
            {reanalysis.length > 0 && (
                <div className="rounded-xl border border-red-200 bg-red-50/50 dark:bg-red-900/10 dark:border-red-800 p-5">
                    <h3 className="text-base font-black text-red-800 dark:text-red-300 flex items-center gap-2 mb-3">
                        <Zap size={16} className="text-red-500" /> Reanalysis Required
                    </h3>
                    <div className="space-y-2">
                        {reanalysis.map(r => (
                            <button
                                key={r.id}
                                onClick={() => navigate(`/samples/${r.sampleId}`)}
                                className="w-full flex items-center justify-between p-3 rounded-lg bg-sf-surface border border-red-100 dark:border-red-900/40 hover:border-red-300 hover:shadow-sm transition-all text-left group"
                            >
                                <div className="min-w-0 flex-1">
                                    <div className="font-bold text-sm text-sf-text truncate">
                                        {r.labId || r.sampleId?.substring(0, 12)}
                                    </div>
                                    <div className="text-[10px] text-gray-400 mt-0.5">
                                        {r.analysis} • {r.reason || 'Manager requested reanalysis'}
                                    </div>
                                </div>
                                <ArrowRight size={14} className="text-gray-300 group-hover:text-red-500 transition-colors shrink-0 ml-2" />
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* ─── My Active Queue ─── */}
            <div className="card-base rounded-xl shadow-sm border p-5">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-black text-sf-text flex items-center gap-2">
                        <FlaskConical size={18} className="text-blue-500" /> My Active Queue
                    </h3>
                    <button onClick={() => navigate('/my-work')} className="text-xs text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1">
                        Full View <ArrowUpRight size={12} />
                    </button>
                </div>

                {myQueue.length > 0 ? (
                    <div className="space-y-2">
                        {myQueue.slice(0, 10).map(group => (
                            <button
                                key={group.sampleId}
                                onClick={() => navigate(`/samples/${group.sampleId}`)}
                                className="w-full flex items-center justify-between p-4 rounded-lg bg-sf-surface border border-sf-divider hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-sm transition-all text-left group"
                            >
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                    {group.priority === 'URGENT' && (
                                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
                                    )}
                                    <div className="min-w-0 flex-1">
                                        <div className="font-bold text-sm text-sf-text truncate">
                                            {group.labId || group.sampleId.substring(0, 12)}
                                        </div>
                                        <div className="text-[10px] text-gray-400 mt-0.5 truncate">
                                            {group.analyses?.join(', ')}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 shrink-0 ml-2">
                                    <div className="flex gap-1">
                                        {group.statuses?.map((st, j) => (
                                            <span key={j} className={`w-2 h-2 rounded-full ${st === 'COMPLETED' ? 'bg-emerald-400' :
                                                st === 'IN_PROGRESS' ? 'bg-orange-400 animate-pulse' :
                                                    'bg-gray-300'
                                                }`} />
                                        ))}
                                    </div>
                                    <span className="text-[10px] font-bold text-gray-400">
                                        {group.items?.length || 0} {group.items?.length === 1 ? 'task' : 'tasks'}
                                    </span>
                                    <ArrowRight size={14} className="text-gray-300 group-hover:text-blue-500 transition-colors" />
                                </div>
                            </button>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-12 text-gray-400 text-sm border border-dashed rounded-lg bg-sf-canvas">
                        <CheckCircle size={32} className="mx-auto mb-3 text-emerald-400" />
                        <p className="font-bold">All clear!</p>
                        <p className="text-[11px] mt-0.5">No active work items assigned to you</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TechnicianDashboard;
