import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
    FlaskConical, Wind, Hammer, CheckCircle, ArrowUpRight,
    RefreshCw, ArrowRight, Plus, UserPlus, TrendingUp, Clock
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

const ReceptionDashboard = ({ user }) => {
    const navigate = useNavigate();
    const { data, loading, isLive, isStale, lastUpdated, refresh } = useRealtimeData('/api/dashboard/live', {
        interval: 15000,
    });

    if (loading && !data) {
        return (
            <div className="flex items-center justify-center h-64 gap-3">
                <RefreshCw size={20} className="animate-spin text-blue-500" />
                <span className="text-gray-400 font-medium">Loading reception console...</span>
            </div>
        );
    }

    const kpis = data?.kpis || {};
    const recentIntakes = data?.recentIntakes || [];

    // Pipeline counts
    const received = kpis.receivedToday || 0;
    const drying = kpis.pendingDrying || 0;
    const preparation = kpis.pendingPreparation || 0;
    const total = kpis.totalProcessed || 0;

    return (
        <div className="space-y-6 pb-12">
            {/* ─── Header ─── */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-black text-gray-900 dark:text-gray-100">Reception Console</h2>
                    <p className="text-sm text-gray-500 mt-0.5">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                </div>
                <div className="flex items-center gap-3">
                    <LiveBadge isLive={isLive} isStale={isStale} lastUpdated={lastUpdated} />
                    <button onClick={refresh} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" title="Refresh now">
                        <RefreshCw size={16} className="text-gray-400" />
                    </button>
                </div>
            </div>

            {/* ─── Quick Actions ─── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                    onClick={() => navigate('/reception')}
                    className="flex items-center gap-4 p-6 rounded-xl border-2 border-dashed border-blue-300 bg-blue-50/50 dark:bg-blue-900/10 dark:border-blue-700 hover:border-blue-500 hover:bg-blue-100/50 transition-all group"
                >
                    <div className="p-4 rounded-xl bg-blue-500 text-white shadow-lg shadow-blue-500/30 group-hover:scale-110 transition-transform">
                        <Plus size={24} />
                    </div>
                    <div className="text-left">
                        <div className="text-lg font-black text-blue-700 dark:text-blue-300">New Sample Intake</div>
                        <div className="text-xs text-gray-500 mt-0.5">Full registration via project form</div>
                    </div>
                </button>
                <button
                    onClick={() => navigate('/reception?mode=WALK_IN')}
                    className="flex items-center gap-4 p-6 rounded-xl border-2 border-dashed border-emerald-300 bg-emerald-50/50 dark:bg-emerald-900/10 dark:border-emerald-700 hover:border-emerald-500 hover:bg-emerald-100/50 transition-all group"
                >
                    <div className="p-4 rounded-xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 group-hover:scale-110 transition-transform">
                        <UserPlus size={24} />
                    </div>
                    <div className="text-left">
                        <div className="text-lg font-black text-emerald-700 dark:text-emerald-300">Quick Walk-in Entry</div>
                        <div className="text-xs text-gray-500 mt-0.5">Fast entry for walk-in clients</div>
                    </div>
                </button>
            </div>

            {/* ─── KPI Row ─── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-5 rounded-xl border bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">Today</span>
                        <FlaskConical size={16} className="text-blue-500 opacity-60" />
                    </div>
                    <span className="text-3xl font-black text-blue-700 dark:text-blue-300">{received}</span>
                    <span className="text-[10px] text-gray-400 block mt-0.5">samples received</span>
                </div>
                <div className="p-5 rounded-xl border bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">Drying</span>
                        <Wind size={16} className="text-amber-500 opacity-60" />
                    </div>
                    <span className="text-3xl font-black text-amber-700 dark:text-amber-300">{drying}</span>
                    <span className="text-[10px] text-gray-400 block mt-0.5">pending</span>
                </div>
                <div className="p-5 rounded-xl border bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-800">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold uppercase tracking-wider text-orange-600 dark:text-orange-400">Preparation</span>
                        <Hammer size={16} className="text-orange-500 opacity-60" />
                    </div>
                    <span className="text-3xl font-black text-orange-700 dark:text-orange-300">{preparation}</span>
                    <span className="text-[10px] text-gray-400 block mt-0.5">pending</span>
                </div>
                <div className="p-5 rounded-xl border bg-gray-50 border-gray-200 dark:bg-gray-800 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold uppercase tracking-wider text-gray-500">All Time</span>
                        <TrendingUp size={16} className="text-gray-400 opacity-60" />
                    </div>
                    <span className="text-3xl font-black text-gray-700 dark:text-gray-300">{total}</span>
                    <span className="text-[10px] text-gray-400 block mt-0.5">total samples</span>
                </div>
            </div>

            {/* ─── Sample Pipeline Funnel ─── */}
            <div className="card-base rounded-xl shadow-sm border p-5">
                <h3 className="text-base font-black text-gray-900 dark:text-gray-100 mb-4">Sample Pipeline</h3>
                <div className="flex items-center justify-center gap-2">
                    {[
                        { label: 'Received', count: received, color: 'bg-blue-500', textColor: 'text-blue-700' },
                        null,
                        { label: 'Drying', count: drying, color: 'bg-amber-500', textColor: 'text-amber-700' },
                        null,
                        { label: 'Preparation', count: preparation, color: 'bg-orange-500', textColor: 'text-orange-700' },
                        null,
                        { label: 'Analysis', count: '→', color: 'bg-emerald-500', textColor: 'text-emerald-700' },
                    ].map((step, i) => step ? (
                        <div key={i} className="text-center">
                            <div className={`${step.color} text-white font-black text-lg w-14 h-14 rounded-xl flex items-center justify-center shadow-sm`}>
                                {step.count}
                            </div>
                            <div className={`text-[10px] font-bold uppercase tracking-wider mt-2 ${step.textColor}`}>{step.label}</div>
                        </div>
                    ) : (
                        <ArrowRight key={i} size={16} className="text-gray-300 mx-1 shrink-0" />
                    ))}
                </div>
            </div>

            {/* ─── My Recent Intakes ─── */}
            <div className="card-base rounded-xl shadow-sm border p-5">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-black text-gray-900 dark:text-gray-100 flex items-center gap-2">
                        <Clock size={18} className="text-blue-500" /> Today's Submissions
                    </h3>
                    <button onClick={() => navigate('/samples')} className="text-xs text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1">
                        All Samples <ArrowUpRight size={12} />
                    </button>
                </div>
                {recentIntakes.length > 0 ? (
                    <div className="space-y-2">
                        {recentIntakes.map(s => {
                            const statusColor = s.status === 'RECEIVED' ? 'bg-blue-100 text-blue-700'
                                : s.status === 'PROCESSING' ? 'bg-orange-100 text-orange-700'
                                    : 'bg-gray-100 text-gray-700';
                            return (
                                <button
                                    key={s.id}
                                    onClick={() => navigate(`/samples/${s.id}`)}
                                    className="w-full flex items-center justify-between p-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-sm transition-all text-left group"
                                >
                                    <div className="min-w-0 flex-1">
                                        <div className="font-bold text-sm text-gray-800 dark:text-gray-200 truncate">
                                            {s.labId || s.originalId?.substring(0, 12)}
                                        </div>
                                        <div className="text-[10px] text-gray-400 mt-0.5 truncate">
                                            {s.projectCode || 'Unknown'} • {s.receivedBy || 'Intake'} • {new Date(s.receptionDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0 ml-2">
                                        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${statusColor}`}>
                                            {s.status?.replace('_', ' ')}
                                        </span>
                                        <ArrowRight size={14} className="text-gray-300 group-hover:text-blue-500 transition-colors" />
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                ) : (
                    <div className="text-center py-8 text-gray-400 text-sm border border-dashed rounded-lg bg-gray-50/50 dark:bg-gray-800/50">
                        <FlaskConical size={24} className="mx-auto mb-2 text-gray-300" />
                        No samples received today yet
                    </div>
                )}
            </div>
        </div>
    );
};

export default ReceptionDashboard;
