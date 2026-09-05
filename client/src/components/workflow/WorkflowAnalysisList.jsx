import React, { useState, useMemo } from 'react';

/**
 * WorkflowAnalysisList
 * Full accessible task list for operators and keyboard users.
 * Supports quick status filtering and keyboard navigation.
 */
export default function WorkflowAnalysisList({
    dependencyGraph,
    selectedId,
    onSelect
}) {
    const [filter, setFilter] = useState('ALL');
    const nodes = dependencyGraph?.nodes || [];

    const filteredNodes = useMemo(() => {
        if (filter === 'ALL') return nodes;
        if (filter === 'ACTIVE') return nodes.filter(n => n.tone === 'active');
        if (filter === 'BLOCKED') return nodes.filter(n => n.tone === 'blocked');
        if (filter === 'DONE') return nodes.filter(n => n.tone === 'done');
        if (filter === 'WARN') return nodes.filter(n => n.tone === 'warn');
        return nodes;
    }, [nodes, filter]);

    return (
        <section className="sf-map-area" aria-label="Analysis Task List">
            <div className="sf-map-title">
                <strong>All assigned work</strong>
                <span>{nodes.length} tasks · completion ≠ approval</span>
            </div>

            {/* Quick Status Filter Chips */}
            <div className="flex gap-2 mb-4 flex-wrap">
                {['ALL', 'ACTIVE', 'BLOCKED', 'DONE', 'WARN'].map(f => (
                    <button
                        key={f}
                        type="button"
                        onClick={() => setFilter(f)}
                        className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                            filter === f
                                ? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 border-transparent font-medium'
                                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                    >
                        {f === 'ALL' && `All (${nodes.length})`}
                        {f === 'ACTIVE' && `Active (${nodes.filter(n => n.tone === 'active').length})`}
                        {f === 'BLOCKED' && `Blocked (${nodes.filter(n => n.tone === 'blocked').length})`}
                        {f === 'DONE' && `Done (${nodes.filter(n => n.tone === 'done').length})`}
                        {f === 'WARN' && `Warnings (${nodes.filter(n => n.tone === 'warn').length})`}
                    </button>
                ))}
            </div>

            {/* Task Item Buttons */}
            <div className="sf-list" role="listbox">
                {filteredNodes.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-400">
                        No work items match filter "{filter}".
                    </div>
                ) : (
                    filteredNodes.map(node => {
                        const isSelected = selectedId === node.id || selectedId === node.workItemId || selectedId === `wi_${node.workItemId}`;
                        const badgeIcon = node.tone === 'done' ? '✓ ' : (node.tone === 'active' ? '● ' : (node.tone === 'warn' ? '△ ' : (node.tone === 'blocked' ? '✕ ' : '')));

                        return (
                            <button
                                key={node.id}
                                type="button"
                                role="option"
                                aria-selected={isSelected}
                                aria-pressed={isSelected}
                                onClick={() => onSelect(node)}
                            >
                                <span>
                                    <span className="font-semibold text-slate-800 dark:text-slate-200">{node.title}</span>
                                    <small>{node.sub || node.category}</small>
                                </span>
                                <span className={`sf-pill sf-${node.tone}`}>
                                    {badgeIcon}{node.status}
                                </span>
                            </button>
                        );
                    })
                )}
            </div>
        </section>
    );
}
