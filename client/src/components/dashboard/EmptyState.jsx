import React from 'react';
import { CheckCircle2, SearchX, AlertCircle, RotateCcw } from 'lucide-react';

/**
 * EmptyState
 * Accurately conveys true zero, search mismatch, or fetch error.
 */
export default function EmptyState({
    type = 'zero', // 'zero', 'search', 'error'
    title,
    message,
    searchTerm = '',
    onClearSearch,
    onRetry
}) {
    if (type === 'error') {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-center bg-rose-50/50 dark:bg-rose-950/20 rounded-xl border border-rose-200 dark:border-rose-900/50 my-4">
                <AlertCircle className="w-10 h-10 text-rose-500 mb-3" />
                <h3 className="text-base font-semibold text-sf-text">
                    {title || 'Unable to load queue'}
                </h3>
                <p className="text-sm text-sf-muted mt-1 max-w-sm">
                    {message || 'A network error or access restriction prevented loading records.'}
                </p>
                {onRetry && (
                    <button
                        type="button"
                        onClick={onRetry}
                        className="mt-4 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2"
                    >
                        <RotateCcw className="w-4 h-4" />
                        <span>Try again</span>
                    </button>
                )}
            </div>
        );
    }

    if (type === 'search') {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-center bg-sf-canvas/40 rounded-xl border border-sf-divider/60 my-4">
                <SearchX className="w-10 h-10 text-sf-muted mb-3" />
                <h3 className="text-base font-semibold text-sf-text">
                    {title || 'No matching records'}
                </h3>
                <p className="text-sm text-sf-muted mt-1 max-w-sm">
                    {message || `No records in this queue match "${searchTerm}".`}
                </p>
                {onClearSearch && (
                    <button
                        type="button"
                        onClick={onClearSearch}
                        className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors"
                    >
                        <span>Clear search</span>
                    </button>
                )}
            </div>
        );
    }

    // Default: True zero
    return (
        <div className="flex flex-col items-center justify-center p-8 text-center bg-sf-surface/60 rounded-xl border border-sf-divider/60 my-4">
            <CheckCircle2 className="w-10 h-10 text-emerald-500/80 mb-3" />
            <h3 className="text-base font-semibold text-sf-text">
                {title || 'No work waiting'}
            </h3>
            <p className="text-sm text-sf-muted mt-1 max-w-sm">
                {message || 'This queue is clear. New incoming samples or assigned tasks will appear here.'}
            </p>
        </div>
    );
}
