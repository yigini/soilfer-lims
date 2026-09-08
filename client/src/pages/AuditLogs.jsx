
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    ShieldAlert, Clock, User, LayoutList,
    ArrowRight, ArrowLeft, Loader, CheckCircle, Search,
    FilePlus, History, UserCog, Settings, Syringe
} from 'lucide-react';

const AuditLogs = () => {
    const [logs, setLogs] = useState([]);
    const [meta, setMeta] = useState({ page: 1, limit: 50, total: 0, totalPages: 1 });
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState('ALL');

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            fetchLogs(1);
        }, 500);
        return () => clearTimeout(timer);
    }, [search, category]);

    const fetchLogs = async (page) => {
        setLoading(true);
        try {
            const res = await axios.get('/api/audit-final', {
                params: { page, limit: 50, search, category }
            });
            setLogs(res.data.data);
            setMeta(res.data.meta);
        } catch (e) {
            console.error("Failed to fetch audit logs", e);
        } finally {
            setLoading(false);
        }
    };

    // Human-readable mapping
    const getActionDisplay = (action, cat) => {
        const map = {
            'STATUS_CHANGE': { text: 'Status Updated', icon: History, color: 'text-blue-600', bg: 'bg-blue-50' },
            'WORKITEM_GENERATED': { text: 'Work Assigned', icon: Syringe, color: 'text-purple-600', bg: 'bg-purple-50' },
            'USER_CREATED': { text: 'User Added', icon: UserCog, color: 'text-green-600', bg: 'bg-green-50' },
            'SETTINGS_UPDATE': { text: 'System Config', icon: Settings, color: 'text-gray-600', bg: 'bg-gray-50' },
            'Sample Created': { text: 'Sample Intake', icon: FilePlus, color: 'text-indigo-600', bg: 'bg-indigo-50' }
        };

        const def = map[action] || { text: action.replace(/_/g, ' '), icon: ShieldAlert, color: 'text-gray-500', bg: 'bg-gray-50' };
        // Override color for system vs operational if needed, or keep specific mapping
        return def;
    };

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-6">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-sf-text flex items-center gap-3">
                        <LayoutList size={32} className="text-indigo-600" />
                        System Audit Logs
                    </h1>
                    <p className="text-gray-500 mt-1">Full history of system events, actions, and user activities.</p>
                </div>

                <div className="flex items-center gap-4 w-full md:w-auto">
                    {/* Tabs */}
                    <div className="flex bg-gray-100 p-1 rounded-lg">
                        {['ALL', 'OPERATIONAL', 'SYSTEM'].map(tab => (
                            <button
                                key={tab}
                                onClick={() => setCategory(tab)}
                                className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${category === tab
                                        ? 'bg-white text-indigo-600 shadow-sm'
                                        : 'text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                {tab === 'ALL' ? 'All Logs' : tab.charAt(0) + tab.slice(1).toLowerCase()}
                            </button>
                        ))}
                    </div>

                    {/* Search */}
                    <div className="bg-white p-2 rounded-lg border shadow-sm flex items-center gap-2 flex-1 md:w-64">
                        <Search size={18} className="text-gray-400" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search logs..."
                            className="outline-none text-sm w-full"
                        />
                    </div>
                </div>
            </header>

            <div className="bg-sf-surface rounded-xl shadow-sm border border-sf-divider overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-sf-canvas/50 border-b border-sf-divider">
                            <tr>
                                <th className="px-6 py-4 font-semibold text-sf-muted text-xs uppercase tracking-wider">Event</th>
                                <th className="px-6 py-4 font-semibold text-sf-muted text-xs uppercase tracking-wider">User</th>
                                <th className="px-6 py-4 font-semibold text-sf-muted text-xs uppercase tracking-wider">Details</th>
                                <th className="px-6 py-4 font-semibold text-sf-muted text-xs uppercase tracking-wider">Timestamp</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-sf-divider">
                            {loading ? (
                                <tr>
                                    <td colSpan="4" className="px-6 py-12 text-center">
                                        <Loader className="animate-spin mx-auto text-indigo-500 mb-2" />
                                        <span className="text-gray-500">Loading records...</span>
                                    </td>
                                </tr>
                            ) : logs.length === 0 ? (
                                <tr>
                                    <td colSpan="4" className="px-6 py-12 text-center text-gray-500">
                                        No audit records found matching your filters.
                                    </td>
                                </tr>
                            ) : logs.map((log, i) => {
                                const display = getActionDisplay(log.action, log.category);
                                const Icon = display.icon;
                                return (
                                    <tr key={i} className="hover:bg-sf-raised/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className={`p - 2 rounded - lg ${display.bg} ${display.color} relative group`}>
                                                    <Icon size={18} />
                                                    {log.category === 'SYSTEM' && (
                                                        <span className="absolute -top-1 -right-1 w-2 h-2 bg-gray-400 rounded-full border border-white"></span>
                                                    )}
                                                </div>
                                                <div>
                                                    <div className="font-semibold text-sf-text">{display.text}</div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs text-gray-400 font-mono">{log.action}</span>
                                                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${log.category === 'OPERATIONAL' ? 'bg-indigo-50 text-indigo-600' : 'bg-gray-100 text-gray-500'
                                                            }`}>
                                                            {log.category}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center text-xs font-bold uppercase">
                                                    {(log.user || '?').charAt(0)}
                                                </div>
                                                <span className="font-medium text-sm text-sf-muted">{log.user || 'System'}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="text-sm text-sf-muted max-w-md truncate" title={log.details}>
                                                {log.details || '-'}
                                            </p>
                                            {log.entityId && (
                                                <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded text-[10px] font-mono bg-gray-100 text-gray-500">
                                                    ID: {log.entityId}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-1.5 font-medium text-gray-700">
                                                    <Clock size={14} className="text-gray-400" />
                                                    {new Date(log.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                                <div className="text-xs text-gray-400 pl-5">
                                                    {new Date(log.time).toLocaleDateString()}
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="px-6 py-4 border-t border-sf-divider flex items-center justify-between">
                    <span className="text-sm text-gray-500">
                        Showing page {meta.page} of {meta.totalPages} ({meta.total} records)
                    </span>
                    <div className="flex gap-2">
                        <button
                            disabled={meta.page === 1}
                            onClick={() => fetchLogs(meta.page - 1)}
                            className="p-2 border rounded hover:bg-gray-50 disabled:opacity-50"
                        >
                            <ArrowLeft size={16} />
                        </button>
                        <button
                            disabled={meta.page === meta.totalPages}
                            onClick={() => fetchLogs(meta.page + 1)}
                            className="p-2 border rounded hover:bg-gray-50 disabled:opacity-50"
                        >
                            <ArrowRight size={16} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AuditLogs;
