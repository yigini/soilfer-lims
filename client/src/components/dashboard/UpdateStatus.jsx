import React from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { RefreshCw, Radio } from 'lucide-react';

/**
 * UpdateStatus
 * Displays genuine data freshness and connection state.
 * Never claims 'Live' merely because the last HTTP request succeeded.
 */
export default function UpdateStatus({
    status = 'idle',
    lastUpdated = null,
    onRefresh,
    isRefreshing = false
}) {
    const { t } = useLanguage();
    const getFreshnessLabel = () => {
        if (isRefreshing) return t('dashboard.updateStatus.refreshing', 'Refreshing…');
        if (status === 'disconnected') return t('dashboard.updateStatus.notConnected', 'Not connected');
        if (status === 'stale') return t('dashboard.updateStatus.stale', 'Data may be stale');
        if (status === 'live') return t('dashboard.updateStatus.live', 'Live connection');
        if (!lastUpdated) return t('dashboard.updateStatus.loaded', 'Loaded');

        const seconds = Math.floor((Date.now() - new Date(lastUpdated).getTime()) / 1000);
        if (seconds < 30) return t('dashboard.updateStatus.updatedJustNow', 'Updated just now');
        if (seconds < 120) return t('dashboard.updateStatus.updatedSecondsAgo', `Updated ${seconds}s ago`, { seconds });
        const minutes = Math.floor(seconds / 60);
        return t('dashboard.updateStatus.updatedMinutesAgo', `Updated ${minutes}m ago`, { minutes });
    };

    const getIndicatorColor = () => {
        if (status === 'disconnected') return 'bg-rose-500 ring-rose-300 dark:ring-rose-900';
        if (status === 'stale') return 'bg-amber-500 ring-amber-300 dark:ring-amber-900';
        if (status === 'live') return 'bg-emerald-500 ring-emerald-300 dark:ring-emerald-900';
        return 'bg-emerald-500/80 ring-emerald-200 dark:ring-emerald-800';
    };

    return (
        <div className="flex items-center gap-3 text-xs font-medium text-sf-muted">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sf-raised/80 border border-sf-divider">
                <span className={`w-2 h-2 rounded-full ring-2 ${getIndicatorColor()}`} />
                <span className="font-sans">{getFreshnessLabel()}</span>
            </div>

            {onRefresh && (
                <button
                    type="button"
                    onClick={onRefresh}
                    disabled={isRefreshing}
                    className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:underline"
                    aria-label={t('dashboard.updateStatus.refreshAria', 'Refresh dashboard data')}
                >
                    <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                    <span>{t('dashboard.updateStatus.refresh', 'Refresh')}</span>
                </button>
            )}
        </div>
    );
}
