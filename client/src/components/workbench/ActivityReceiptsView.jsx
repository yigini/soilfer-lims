import React, { useState } from 'react';
import {
    Clock, CheckCircle, FileText, Send, Trash2,
    AlertCircle, Search, RefreshCw
} from 'lucide-react';

/**
 * ActivityReceiptsView
 * Searchable chronological audit feed displaying verifiable operation receipts:
 * record commits, review submissions, conflict resolutions, and draft discards.
 */
export default function ActivityReceiptsView({
    receipts = [],
    onRefresh,
    isLoading = false
}) {
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState('ALL');

    const getActionBadge = (action) => {
        switch (action) {
            case 'WORKBENCH_COMPLETE':
                return {
                    label: 'Determinations Recorded',
                    color: 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300',
                    icon: CheckCircle
                };
            case 'WORKBENCH_SUBMIT':
                return {
                    label: 'Submitted for Review',
                    color: 'bg-blue-100 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300',
                    icon: Send
                };
            case 'DRAFT_DISCARDED':
                return {
                    label: 'Draft Discarded',
                    color: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300',
                    icon: Trash2
                };
            case 'DRAFT_CONFLICT_RESOLVED':
                return {
                    label: 'Conflict Resolved',
                    color: 'bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300',
                    icon: AlertCircle
                };
            default:
                return {
                    label: action,
                    color: 'bg-slate-100 text-slate-700',
                    icon: FileText
                };
        }
    };

    const filtered = receipts.filter(r => {
        if (filter !== 'ALL' && r.action !== filter) return false;
        if (!search) return true;
        const q = search.toLowerCase();
        return (
            (r.sampleId && r.sampleId.toLowerCase().includes(q)) ||
            (r.details && r.details.toLowerCase().includes(q)) ||
            (r.id && r.id.toLowerCase().includes(q))
        );
    });

    return (
        <div className="flex flex-col gap-4 max-w-4xl mx-auto py-2">
            {/* Header & Controls */}
            <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
                <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                        Workbench Activity & Receipts
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                        Durable audit trail of determinations, submissions, and draft operations.
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search sample or receipt..."
                            className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                    </div>
                    {onRefresh && (
                        <button
                            type="button"
                            onClick={onRefresh}
                            disabled={isLoading}
                            className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-600 dark:text-slate-300"
                        >
                            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
                        </button>
                    )}
                </div>
            </div>

            {/* Filter Pills */}
            <div className="flex gap-2 flex-wrap text-xs">
                {[
                    { id: 'ALL', label: 'All Receipts' },
                    { id: 'WORKBENCH_COMPLETE', label: 'Recorded Determinations' },
                    { id: 'WORKBENCH_SUBMIT', label: 'Submissions' },
                    { id: 'DRAFT_CONFLICT_RESOLVED', label: 'Conflict Resolutions' },
                    { id: 'DRAFT_DISCARDED', label: 'Discards' }
                ].map(p => (
                    <button
                        key={p.id}
                        type="button"
                        onClick={() => setFilter(p.id)}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                            filter === p.id
                                ? 'bg-emerald-600 text-white font-semibold'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                        }`}
                    >
                        {p.label}
                    </button>
                ))}
            </div>

            {/* Feed List */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
                {filtered.map((r) => {
                    const badge = getActionBadge(r.action);
                    const Icon = badge.icon;
                    const dateStr = r.timestamp ? new Date(r.timestamp).toLocaleString() : '';

                    return (
                        <div key={r.id} className="p-3.5 flex items-start justify-between gap-4 text-xs">
                            <div className="flex items-start gap-3">
                                <div className={`p-2 rounded-lg mt-0.5 ${badge.color}`}>
                                    <Icon size={14} />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${badge.color}`}>
                                            {badge.label}
                                        </span>
                                        {r.sampleId && (
                                            <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                                                {r.sampleId}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-slate-700 dark:text-slate-300 mt-1 leading-snug">
                                        {r.details}
                                    </p>
                                    <div className="font-mono text-[10px] text-slate-400 mt-1">
                                        ID: {r.id}
                                    </div>
                                </div>
                            </div>

                            <span className="text-[11px] text-slate-400 whitespace-nowrap">
                                {dateStr}
                            </span>
                        </div>
                    );
                })}

                {filtered.length === 0 && (
                    <div className="p-8 text-center text-xs text-slate-400">
                        No activity receipts matching the current criteria.
                    </div>
                )}
            </div>
        </div>
    );
}
