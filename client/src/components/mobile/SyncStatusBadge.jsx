import React from 'react';
import { useSync } from '../../context/SyncContext';
import { Cloud, CloudOff, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import clsx from 'clsx';

export const SyncStatusBadge = ({ showLabel = true, className = '' }) => {
    const { isOnline, syncStatus, pendingCount, conflictCount, openSyncCentre } = useSync();

    let icon = null;
    let label = '';
    let badgeStyle = '';

    if (conflictCount > 0) {
        icon = <AlertTriangle size={14} className="text-amber-500 animate-pulse" />;
        label = `${conflictCount} conflict${conflictCount > 1 ? 's' : ''}`;
        badgeStyle = 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-400/30';
    } else if (syncStatus === 'syncing') {
        icon = <RefreshCw size={14} className="text-sf-primary animate-spin" />;
        label = 'Syncing...';
        badgeStyle = 'bg-sf-primary/10 text-sf-primary border-sf-primary/30';
    } else if (!isOnline) {
        icon = <CloudOff size={14} className="text-sf-muted" />;
        label = pendingCount > 0 ? `${pendingCount} queued` : 'Offline';
        badgeStyle = 'bg-sf-inset text-sf-muted border-sf-divider';
    } else if (pendingCount > 0) {
        icon = <Cloud size={14} className="text-blue-500" />;
        label = `${pendingCount} to sync`;
        badgeStyle = 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-400/30';
    } else {
        icon = <CheckCircle2 size={14} className="text-emerald-500" />;
        label = 'Synced';
        badgeStyle = 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-400/30';
    }

    return (
        <button
            onClick={openSyncCentre}
            className={clsx(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-sf-focus",
                badgeStyle,
                className
            )}
            title="Open Sync Centre"
            aria-label={`Sync status: ${label}`}
        >
            {icon}
            {showLabel && <span>{label}</span>}
        </button>
    );
};
