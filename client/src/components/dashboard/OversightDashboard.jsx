import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
    BarChart3, CheckCircle, FlaskConical, ArrowUpRight,
    RefreshCw, Activity, Clock, TrendingUp, Globe
} from 'lucide-react';
import { useRealtimeData, formatLastUpdated } from '../../hooks/useRealtimeData';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';

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

const OversightDashboard = ({ user }) => {
    const navigate = useNavigate();
    const { data, loading, isLive, isStale, lastUpdated, refresh } = useRealtimeData('/api/dashboard/live', {
        interval: 15000,
        wsEvents: ['WORKITEM_CHANGED', 'WORKITEM_UPDATE'],
    });

    if (loading && !data) {
        return (
            <div className="flex items-center justify-center h-64 gap-3">
                <RefreshCw size={20} className="animate-spin text-blue-500" />
                <span className="text-gray-400 font-medium">Loading oversight dashboard...</span>
            </div>
        );
    }

    const kpis = data?.kpis || {};
    const dailyCounts = data?.dailyCounts || [];
    const recentActivity = data?.recentActivity || [];

    // Determine scope label
    const scopeLabel = user.role === 'SUPER_ADMIN' ? 'All Labs' :
        user.countries?.length > 0 ? user.countries.join(', ') :
            user.labId || 'Your Scope';

    return (
        <div className="space-y-6 pb-12">
            {/* ─── Header ─── */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-black text-sf-text">
                        Oversight Dashboard
                    </h2>
                    <p className="text-sm text-gray-500 mt-0.5 flex items-center gap-1.5">
                        <Globe size={12} /> {scopeLabel} • {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <LiveBadge isLive={isLive} isStale={isStale} lastUpdated={lastUpdated} />
                    <button onClick={refresh} className="p-2 rounded-lg hover:bg-sf-raised transition-colors" title="Refresh now">
                        <RefreshCw size={16} className="text-gray-400" />
                    </button>
                </div>
            </div>

            {/* ─── KPI Row ─── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-6 rounded-xl border bg-gradient-to-br from-blue-50 to-blue-100/50 border-blue-200 dark:from-blue-900/20 dark:to-blue-800/10 dark:border-blue-800">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">Total Samples</span>
                        <FlaskConical size={18} className="text-blue-500 opacity-60" />
                    </div>
                    <span className="text-4xl font-black text-blue-700 dark:text-blue-300">{kpis.totalSamples || 0}</span>
                    <button onClick={() => navigate('/samples')} className="text-[10px] text-blue-500 hover:text-blue-700 font-bold flex items-center gap-1 mt-2">
                        View All <ArrowUpRight size={10} />
                    </button>
                </div>
                <div className="p-6 rounded-xl border bg-gradient-to-br from-orange-50 to-orange-100/50 border-orange-200 dark:from-orange-900/20 dark:to-orange-800/10 dark:border-orange-800">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-orange-600 dark:text-orange-400">In Progress</span>
                        <Activity size={18} className="text-orange-500 opacity-60" />
                    </div>
                    <span className="text-4xl font-black text-orange-700 dark:text-orange-300">{kpis.inProgress || 0}</span>
                    <div className="text-[10px] text-gray-400 mt-2">Active samples in pipeline</div>
                </div>
                <div className="p-6 rounded-xl border bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-emerald-200 dark:from-emerald-900/20 dark:to-emerald-800/10 dark:border-emerald-800">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Today's Intake</span>
                        <TrendingUp size={18} className="text-emerald-500 opacity-60" />
                    </div>
                    <span className="text-4xl font-black text-emerald-700 dark:text-emerald-300">{kpis.receivedToday || 0}</span>
                    <div className="text-[10px] text-gray-400 mt-2">Received today</div>
                </div>
            </div>

            {/* ─── Trends Chart ─── */}
            <div className="card-base rounded-xl shadow-sm border p-5">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-black text-sf-text flex items-center gap-2">
                        <BarChart3 size={18} className="text-blue-500" /> 7-Day Intake Trend
                    </h3>
                    <div className="text-[10px] text-gray-400 font-mono uppercase">Daily Received Samples</div>
                </div>
                {dailyCounts.length > 0 ? (
                    <ResponsiveContainer width="100%" height={200}>
                        <AreaChart data={dailyCounts} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                            <XAxis
                                dataKey="day"
                                tick={{ fontSize: 11, fill: '#9ca3af', fontWeight: 700 }}
                                axisLine={false}
                                tickLine={false}
                            />
                            <YAxis
                                tick={{ fontSize: 11, fill: '#9ca3af' }}
                                axisLine={false}
                                tickLine={false}
                                allowDecimals={false}
                            />
                            <Tooltip
                                contentStyle={{
                                    borderRadius: '10px',
                                    padding: '8px 14px',
                                    border: '1px solid #e5e7eb',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                                    fontSize: '12px',
                                    fontWeight: 700,
                                }}
                                formatter={(value) => [`${value} samples`, 'Received']}
                                labelFormatter={(label) => label}
                            />
                            <Area
                                type="monotone"
                                dataKey="count"
                                stroke="#3b82f6"
                                strokeWidth={2.5}
                                fill="url(#colorCount)"
                                dot={{ r: 4, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }}
                                activeDot={{ r: 6, fill: '#2563eb', stroke: '#fff', strokeWidth: 2 }}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="h-48 flex items-center justify-center text-gray-400 text-sm border border-dashed rounded-lg bg-sf-canvas">
                        No trend data available
                    </div>
                )}
            </div>

            {/* ─── Recent Activity ─── */}
            <div className="card-base rounded-xl shadow-sm border p-5">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-black text-sf-text flex items-center gap-2">
                        <Clock size={18} className="text-blue-500" /> Recent Activity
                    </h3>
                </div>
                {recentActivity.length > 0 ? (
                    <div className="space-y-1">
                        {recentActivity.map((log, idx) => (
                            <div key={log.id || idx} className="flex gap-3 p-2.5 rounded-lg hover:bg-sf-raised/30 transition-colors items-start">
                                <div className={`p-1.5 rounded-lg mt-0.5 shrink-0 ${log.action?.includes('CREATE') ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40' :
                                    log.action?.includes('DELETE') ? 'bg-red-100 text-red-600 dark:bg-red-900/40' :
                                        'bg-blue-100 text-blue-600 dark:bg-blue-900/40'
                                    }`}>
                                    <Activity size={12} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-bold text-sf-muted truncate">{log.details}</p>
                                    <span className="text-[10px] text-gray-400 font-mono">{log.action?.split('_').join(' ')}</span>
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
    );
};

export default OversightDashboard;
