import React from 'react';
import { useLanguage } from '../../context/LanguageContext';

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
    const { t } = useLanguage();
    if (!metrics || metrics.length === 0) return null;

    const getToneClasses = (tone, isActive) => {
        if (isActive) {
            return 'border-sf-primary bg-[var(--sf-selected)] shadow-[inset_0_-3px_var(--sf-primary)]';
        }
        if (tone === 'problem') {
            return 'bg-[var(--sf-danger-bg)] border-[var(--sf-danger)]/30 hover:border-[var(--sf-danger)]/60';
        }
        if (tone === 'warn') {
            return 'bg-[var(--sf-warning-bg)] border-[var(--sf-warning)]/30 hover:border-[var(--sf-warning)]/60';
        }
        return 'bg-sf-surface border-sf-divider hover:border-sf-control hover:bg-sf-hover/30';
    };

    const getValueColor = (tone) => {
        if (tone === 'problem') return 'text-[var(--sf-danger)]';
        if (tone === 'warn') return 'text-[var(--sf-warning)]';
        return 'text-sf-text';
    };

    return (
        <section aria-label={t('dashboard.queueSummary.workSummaries', 'Work summaries')} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 mb-6">
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
                                <span className="text-xs font-medium text-sf-muted truncate">
                                    {metric.unitKey ? t(metric.unitKey, { count: displayValue }, metric.unit) : t('dashboard.units.' + metric.unit, { count: displayValue }, metric.unit)}
                                </span>
                            )}
                        </div>

                        <div className="mt-2.5">
                            <div className="text-xs font-semibold text-sf-muted leading-snug">
                                {metric.labelKey ? t(metric.labelKey, metric.label) : (metric.key ? t('dashboard.metrics.' + metric.key, metric.label) : metric.label)}
                            </div>
                            {metric.tone === 'problem' && displayValue > 0 && (
                                <div className="mt-1 inline-flex items-center text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">
                                    {t('dashboard.queueSummary.needsAttention', 'Needs attention')}
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </section>
    );
}
