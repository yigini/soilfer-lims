import React from 'react';

/**
 * QueueSummary
 * Accessible card deck displaying high-level queue metrics.
 * Selecting a card switches the active queue tab in the WorkQueue panel.
 */
export default function QueueSummary({
    metrics = [],
    activeQueue = '',
    onSelectQueue
}) {
    if (!metrics || metrics.length === 0) return null;

    const getToneClasses = (tone, isActive) => {
        if (isActive) {
            return 'ring-2 ring-emerald-600 dark:ring-emerald-400 bg-white dark:bg-gray-800 shadow-md border-emerald-500/50';
        }
        if (tone === 'problem') {
            return 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/60 hover:border-rose-400 dark:hover:border-rose-700';
        }
        if (tone === 'warn') {
            return 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/60 hover:border-amber-400 dark:hover:border-amber-700';
        }
        return 'bg-white dark:bg-gray-800/80 border-gray-200 dark:border-gray-700/80 hover:border-gray-300 dark:hover:border-gray-600';
    };

    const getValueColor = (tone) => {
        if (tone === 'problem') return 'text-rose-700 dark:text-rose-400';
        if (tone === 'warn') return 'text-amber-700 dark:text-amber-400';
        return 'text-gray-900 dark:text-white';
    };

    return (
        <section aria-label="Work summaries" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 mb-6">
            {metrics.map((metric) => {
                const isActive = activeQueue === metric.queueKey;
                const displayValue = metric.value !== null && metric.value !== undefined ? metric.value : '—';
                const isClickable = Boolean(metric.queueKey && onSelectQueue);

                return (
                    <div
                        key={metric.key || metric.queueKey}
                        role={isClickable ? 'button' : 'region'}
                        tabIndex={isClickable ? 0 : undefined}
                        aria-pressed={isClickable ? isActive : undefined}
                        onClick={() => isClickable && onSelectQueue(metric.queueKey)}
                        onKeyDown={(e) => {
                            if (isClickable && (e.key === 'Enter' || e.key === ' ')) {
                                e.preventDefault();
                                onSelectQueue(metric.queueKey);
                            }
                        }}
                        className={`p-4 rounded-xl border transition-all duration-150 flex flex-col justify-between select-none ${isClickable ? 'cursor-pointer' : ''} ${getToneClasses(metric.tone, isActive)}`}
                    >
                        <div className="flex items-baseline justify-between gap-2">
                            <span className={`text-2xl sm:text-3xl font-bold tracking-tight ${getValueColor(metric.tone)}`}>
                                {displayValue}
                            </span>
                            {metric.unit && (
                                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 truncate">
                                    {metric.unit}
                                </span>
                            )}
                        </div>

                        <div className="mt-2.5">
                            <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 leading-snug">
                                {metric.label}
                            </div>
                            {metric.tone === 'problem' && displayValue > 0 && (
                                <div className="mt-1 inline-flex items-center text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">
                                    Needs attention
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </section>
    );
}
