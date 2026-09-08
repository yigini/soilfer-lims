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
                    color: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300',
                    icon: CheckCircle
                };
            case 'WORKBENCH_SUBMIT':
                return {
                    label: 'Submitted for Review',
                    color: 'bg-blue-500/15 text-blue-800 dark:text-blue-300',
                    icon: Send
                };
            case 'DRAFT_DISCARDED':
                return {
                    label: 'Draft Discarded',
                    color: 'bg-sf-hover text-sf-muted',
                    icon: Trash2
                };
            case 'DRAFT_CONFLICT_RESOLVED':
                return {
                    label: 'Conflict Resolved',
                    color: 'bg-amber-500/15 text-amber-800 dark:text-amber-300',
                    icon: AlertCircle
                };
            default:
                return {
                    label: action,
                    color: 'bg-sf-hover text-sf-muted',
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
            <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-sf-divider">
                <div>
                    <h3 className="text-lg font-bold text-sf-text">
                        Workbench Activity & Receipts
                    </h3>
                    <p className="text-xs text-sf-muted mt-0.5">
                        Durable audit trail of determinations, submissions, and draft operations.
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Search size={14} className="absolute left-2.5 top-2.5 text-sf-muted" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search sample or receipt..."
                            className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-sf-divider bg-sf-surface text-sf-text placeholder:text-sf-muted focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                    </div>
                    {onRefresh && (
                        <button
                            type="button"
                            onClick={onRefresh}
                            disabled={isLoading}
                            className="p-1.5 rounded-lg border border-sf-divider hover:bg-sf-hover transition-colors text-sf-muted hover:text-sf-text"
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
                                : 'bg-sf-surface text-sf-muted hover:bg-sf-hover hover:text-sf-text border border-sf-divider'
                        }`}
                    >
                        {p.label}
                    </button>
                ))}
            </div>

            {/* Feed List */}
            <div className="rounded-xl border border-sf-divider bg-sf-surface divide-y divide-sf-divider overflow-hidden">
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
                                            <span className="font-mono font-bold text-sf-text">
                                                {r.sampleId}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-sf-text mt-1 leading-snug">
                                        {r.details}
                                    </p>
                                    <div className="font-mono text-[10px] text-sf-muted mt-1">
                                        ID: {r.id}
                                    </div>
                                </div>
                            </div>

                            <span className="text-[11px] text-sf-muted whitespace-nowrap">
                                {dateStr}
                            </span>
                        </div>
                    );
                })}

                {filtered.length === 0 && (
                    <div className="p-8 text-center text-xs text-sf-muted">
                        No activity receipts matching the current criteria.
                    </div>
                )}
            </div>
        </div>
    );
}
