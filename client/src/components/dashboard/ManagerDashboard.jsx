import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Activity, Users, CheckSquare, ChevronDown, ChevronRight, Clock, Eye,
    AlertCircle, FileInput, AlertTriangle, BarChart3, ArrowRight, RefreshCw,
    FlaskConical, Zap, CheckCircle, UserCheck, TrendingUp, ArrowUpRight
} from 'lucide-react';
import { useRealtimeData, formatLastUpdated } from '../../hooks/useRealtimeData';
import InfoTooltip from '../common/InfoTooltip';

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

// ─── KPI Card ───
const KpiCard = ({ label, value, icon: Icon, color, bgColor, onClick, tooltip, change }) => (
    <button
        onClick={onClick}
        className={`p-5 rounded-xl border transition-all hover:shadow-md hover:scale-[1.02] active:scale-[0.98] text-left w-full ${bgColor}`}
    >
        <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
                <span className={`text-xs font-bold uppercase tracking-wider ${color}`}>{label}</span>
                {tooltip && <InfoTooltip text={tooltip} />}
            </div>
            <Icon size={16} className={`${color} opacity-60`} />
        </div>
        <div className="flex items-end gap-2">
            <span className={`text-3xl font-black ${color}`}>{value}</span>
            {change !== undefined && change !== 0 && (
                <span className={`text-[10px] font-bold mb-1 ${change > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {change > 0 ? '↑' : '↓'}{Math.abs(change)}
                </span>
            )}
        </div>
    </button>
);

// ─── Warning Banner ───
const WarningBanner = ({ warnings }) => {
    if (!warnings || warnings.length === 0) return null;
    return (
        <div className="space-y-2">
            {warnings.map((w, i) => (
                <div key={i} className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${w.severity === 'HIGH'
                    ? 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300'
                    : 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-300'
                    }`}>
                    <AlertTriangle size={16} className="shrink-0" />
                    <span className="text-sm font-semibold">{w.message}</span>
                </div>
            ))}
        </div>
    );
};

const ManagerDashboard = ({ user }) => {
    const navigate = useNavigate();
    const { data, loading, isLive, isStale, lastUpdated, refresh } = useRealtimeData('/api/dashboard/live', {
        interval: 15000,
        wsEvents: ['WORKITEM_CHANGED', 'WORKITEM_UPDATE'],
    });

    // Assignment state (kept local since it's interactive)
    const [expandedSamples, setExpandedSamples] = useState([]);

    if (loading && !data) {
        return (
            <div className="flex items-center justify-center h-64 gap-3">
                <RefreshCw size={20} className="animate-spin text-blue-500" />
                <span className="text-gray-400 font-medium">Loading dashboard...</span>
            </div>
        );
    }

    const kpis = data?.kpis || {};
    const intakeQueue = data?.intakeQueue || [];
    const reviewQueue = data?.reviewQueue || [];
    const oversight = data?.oversight || [];
    const techWorkload = data?.techWorkload || [];
    const recentActivity = data?.recentActivity || [];
    const warnings = data?.warnings || [];

    return (
        <div className="space-y-6 pb-12">
            {/* ─── Header ─── */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-black text-gray-900 dark:text-gray-100">
                        Manager Command Centre
                    </h2>
                    <p className="text-sm text-gray-500 mt-0.5">{user.labId || user.countries?.[0] || 'All Labs'}</p>
                </div>
                <div className="flex items-center gap-3">
                    <LiveBadge isLive={isLive} isStale={isStale} lastUpdated={lastUpdated} />
                    <button onClick={refresh} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" title="Refresh now">
                        <RefreshCw size={16} className="text-gray-400" />
                    </button>
                </div>
            </div>

            {/* ─── Warnings ─── */}
            <WarningBanner warnings={warnings} />

            {/* ─── KPI Grid ─── */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <KpiCard
                    label="Pending Intake"
                    value={kpis.pendingIntakes || 0}
                    icon={FileInput}
                    color="text-purple-700 dark:text-purple-300"
                    bgColor="bg-purple-50 border-purple-200 dark:bg-purple-900/20 dark:border-purple-800"
                    onClick={() => navigate('/manager-queue')}
                    tooltip="Samples received but not yet accepted by a manager"
                />
                <KpiCard
                    label="Unassigned"
                    value={kpis.unassignedTasks || 0}
                    icon={Users}
                    color="text-blue-700 dark:text-blue-300"
                    bgColor="bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800"
                    onClick={() => navigate('/manager-queue')}
                    tooltip="Work items not yet assigned to a technician"
                />
                <KpiCard
                    label="In Progress"
                    value={kpis.inProgress || 0}
                    icon={Activity}
                    color="text-orange-700 dark:text-orange-300"
                    bgColor="bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-800"
                    tooltip="Samples currently being processed or analyzed"
                />
                <KpiCard
                    label="Awaiting Review"
                    value={kpis.awaitingReview || 0}
                    icon={Eye}
                    color="text-amber-700 dark:text-amber-300"
                    bgColor="bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800"
                    onClick={() => navigate('/manager-queue')}
                    tooltip="Submissions from technicians pending manager review"
                />
                <KpiCard
                    label="Completed Today"
                    value={kpis.completedToday || 0}
                    icon={CheckCircle}
                    color="text-emerald-700 dark:text-emerald-300"
                    bgColor="bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800"
                    tooltip="Samples that completed analysis today"
                />
                <KpiCard
                    label="Total Samples"
                    value={kpis.totalSamples || 0}
                    icon={FlaskConical}
                    color="text-gray-700 dark:text-gray-300"
                    bgColor="bg-gray-50 border-gray-200 dark:bg-gray-800 dark:border-gray-700"
                    onClick={() => navigate('/samples')}
                    tooltip="Total number of samples in the system"
                />
            </div>

            {/* ─── Main Grid: 2 columns ─── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* ─── LEFT: Intake Queue ─── */}
                <div className="card-base rounded-xl shadow-sm border p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-black text-gray-900 dark:text-gray-100 flex items-center gap-2">
                            <FileInput size={18} className="text-purple-500" /> Intake Queue
                        </h3>
                        <button onClick={() => navigate('/manager-queue')} className="text-xs text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1">
                            View All <ArrowUpRight size={12} />
                        </button>
                    </div>
                    {intakeQueue.length > 0 ? (
                        <div className="space-y-2">
                            {intakeQueue.slice(0, 6).map(s => (
                                <button
                                    key={s.id}
                                    onClick={() => navigate(`/samples/${s.id}`)}
                                    className="w-full flex items-center justify-between p-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-700 hover:shadow-sm transition-all text-left group"
                                >
                                    <div className="min-w-0 flex-1">
                                        <div className="font-bold text-sm text-gray-800 dark:text-gray-200 truncate">
                                            {s.labId || s.originalId?.substring(0, 12) || s.id.substring(0, 8)}
                                        </div>
                                        <div className="text-[10px] text-gray-400 mt-0.5 truncate">
                                            {s.projectCode || 'Unknown'} • {s.receivedBy || 'Intake'} • {new Date(s.receptionDate || s.createdAt).toLocaleDateString()}
                                        </div>
                                    </div>
                                    <ArrowRight size={14} className="text-gray-300 group-hover:text-purple-500 transition-colors shrink-0 ml-2" />
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-8 text-gray-400 text-sm border border-dashed rounded-lg bg-gray-50/50 dark:bg-gray-800/50">
                            <CheckCircle size={24} className="mx-auto mb-2 text-emerald-400" />
                            Intake queue is clear
                        </div>
                    )}
                </div>

                {/* ─── RIGHT: Review Queue ─── */}
                <div className="card-base rounded-xl shadow-sm border p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-black text-gray-900 dark:text-gray-100 flex items-center gap-2">
                            <Eye size={18} className="text-amber-500" /> Pending Reviews
                        </h3>
                        <button onClick={() => navigate('/manager-queue')} className="text-xs text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1">
                            View All <ArrowUpRight size={12} />
                        </button>
                    </div>
                    {reviewQueue.length > 0 ? (
                        <div className="space-y-2">
                            {reviewQueue.slice(0, 6).map(r => (
                                <button
                                    key={r.sampleId}
                                    onClick={() => navigate(`/samples/${r.sampleId}`)}
                                    className="w-full flex items-center justify-between p-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 hover:border-amber-300 dark:hover:border-amber-700 hover:shadow-sm transition-all text-left group"
                                >
                                    <div className="min-w-0 flex-1">
                                        <div className="font-bold text-sm text-gray-800 dark:text-gray-200 truncate">
                                            {r.labId || r.sampleId.substring(0, 12)}
                                        </div>
                                        <div className="text-[10px] text-gray-400 mt-0.5 truncate">
                                            {r.count} submission(s) by {r.submittedBy || 'Tech'} • {r.types?.join(', ')}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0 ml-2">
                                        <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">Review</span>
                                        <ArrowRight size={14} className="text-gray-300 group-hover:text-amber-500 transition-colors" />
                                    </div>
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-8 text-gray-400 text-sm border border-dashed rounded-lg bg-gray-50/50 dark:bg-gray-800/50">
                            <CheckCircle size={24} className="mx-auto mb-2 text-emerald-400" />
                            No submissions pending review
                        </div>
                    )}
                </div>
            </div>

            {/* ─── Analysis Progress Monitor ─── */}
            {oversight.length > 0 && (
                <div className="card-base rounded-xl shadow-sm border p-5">
                    <h3 className="text-lg font-black text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-4">
                        <BarChart3 size={18} className="text-blue-500" /> Analysis Progress
                    </h3>
                    <div className="space-y-3">
                        {oversight.slice(0, 10).map(s => (
                            <button
                                key={s.labId}
                                onClick={() => navigate(`/samples/${s.sampleId}`)}
                                className="w-full flex items-center gap-4 p-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-sm transition-all text-left group"
                            >
                                <span className="font-mono font-bold text-sm text-gray-700 dark:text-gray-300 w-32 truncate shrink-0">{s.labId}</span>
                                <div className="flex-1">
                                    <div className="flex items-center gap-3">
                                        <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all duration-700 ${s.progress === 100 ? 'bg-emerald-500' : s.progress > 50 ? 'bg-blue-500' : 'bg-orange-400'
                                                    }`}
                                                style={{ width: `${s.progress}%` }}
                                            />
                                        </div>
                                        <span className="text-xs font-black w-10 text-right text-gray-600 dark:text-gray-400">{s.progress}%</span>
                                    </div>
                                    <div className="text-[10px] text-gray-400 mt-1">{s.completed}/{s.total} analyses</div>
                                </div>
                                {s.progress === 100 ? (
                                    <span className="px-2 py-1 rounded-lg text-[9px] font-black uppercase bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 shrink-0">Ready</span>
                                ) : null}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* ─── Bottom Grid: Tech Workload + Activity ─── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* ─── Tech Workload ─── */}
                {techWorkload.length > 0 && (
                    <div className="card-base rounded-xl shadow-sm border p-5">
                        <h3 className="text-lg font-black text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-4">
                            <UserCheck size={18} className="text-green-500" /> Technician Workload
                        </h3>
                        <div className="space-y-2">
                            {techWorkload.map(t => {
                                const total = t.assigned || 1;
                                const completionRate = total > 0 ? Math.round((t.completed / total) * 100) : 0;
                                return (
                                    <div key={t.username} className="flex items-center gap-3 p-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
                                        <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-xs font-black text-blue-600 dark:text-blue-400 shrink-0">
                                            {(t.name || t.username).charAt(0).toUpperCase()}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-bold text-sm text-gray-800 dark:text-gray-200 truncate">{t.name}</div>
                                            <div className="flex items-center gap-3 mt-1">
                                                <span className="text-[10px] text-gray-400">{t.pending} pending</span>
                                                <span className="text-[10px] text-emerald-500">{t.completed} done</span>
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <div className="text-lg font-black text-gray-700 dark:text-gray-300">{t.assigned}</div>
                                            <div className="text-[10px] text-gray-400">tasks</div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* ─── Recent Activity ─── */}
                <div className="card-base rounded-xl shadow-sm border p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-black text-gray-900 dark:text-gray-100 flex items-center gap-2">
                            <Clock size={18} className="text-blue-500" /> Recent Activity
                        </h3>
                        <button onClick={() => navigate('/admin/audit')} className="text-xs text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1">
                            Full Log <ArrowUpRight size={12} />
                        </button>
                    </div>
                    {recentActivity.length > 0 ? (
                        <div className="space-y-1">
                            {recentActivity.map((log, idx) => (
                                <div key={log.id || idx} className="flex gap-3 p-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors items-start">
                                    <div className={`p-1.5 rounded-lg mt-0.5 shrink-0 ${log.action?.includes('CREATE') ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40' :
                                        log.action?.includes('DELETE') ? 'bg-red-100 text-red-600 dark:bg-red-900/40' :
                                            'bg-blue-100 text-blue-600 dark:bg-blue-900/40'
                                        }`}>
                                        <Activity size={12} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-bold text-gray-700 dark:text-gray-300 truncate">{log.details}</p>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="text-[10px] text-gray-400 font-mono">{log.action?.split('_').join(' ')}</span>
                                            {log.user && <span className="text-[10px] text-gray-400">• {log.user}</span>}
                                        </div>
                                    </div>
                                    <span className="text-[10px] text-gray-400 shrink-0 whitespace-nowrap">
                                        {new Date(log.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-8 text-gray-400 text-sm">No recent activity</div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ManagerDashboard;
