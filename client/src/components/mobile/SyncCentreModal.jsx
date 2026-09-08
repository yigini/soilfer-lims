import React, { useState, useEffect } from 'react';
import { useSync } from '../../context/SyncContext';
import { useAuth } from '../../context/AuthContext';
import { getAllOutboxOperations } from '../../services/offline/offlineDb';
import {
    X,
    RefreshCw,
    Cloud,
    CloudOff,
    CheckCircle2,
    AlertTriangle,
    Package,
    ArrowDownToLine,
    Clock,
    FileText,
    ShieldCheck
} from 'lucide-react';
import clsx from 'clsx';

export const SyncCentreModal = () => {
    const {
        isSyncModalOpen,
        closeSyncCentre,
        isOnline,
        syncStatus,
        activePack,
        triggerSync,
        downloadPack
    } = useSync();

    const { user } = useAuth();
    const [operations, setOperations] = useState([]);
    const [loadingOps, setLoadingOps] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [packDownloadError, setPackDownloadError] = useState(null);

    const fetchOperations = async () => {
        setLoadingOps(true);
        try {
            const ops = await getAllOutboxOperations();
            setOperations(ops);
        } catch (e) {
            console.error('[SYNC_CENTRE] Failed to fetch outbox:', e);
        } finally {
            setLoadingOps(false);
        }
    };

    useEffect(() => {
        if (isSyncModalOpen) {
            fetchOperations();
        }
    }, [isSyncModalOpen, syncStatus]);

    if (!isSyncModalOpen) return null;

    const handleSyncNow = async () => {
        await triggerSync();
        await fetchOperations();
    };

    const handleDownloadPack = async () => {
        setDownloading(true);
        setPackDownloadError(null);
        try {
            await downloadPack({
                labId: user?.labId,
                token: localStorage.getItem('token')
            });
            await fetchOperations();
        } catch (err) {
            setPackDownloadError(err.message || 'Failed to download offline pack');
        } finally {
            setDownloading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
            <div className="bg-sf-surface border border-sf-divider rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-sf-divider bg-sf-canvas">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-lg bg-sf-primary/10 text-sf-primary">
                            <Cloud size={20} />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-sf-text">Sync Centre</h2>
                            <p className="text-xs text-sf-muted">Offline status & durable outbox queue</p>
                        </div>
                    </div>
                    <button
                        onClick={closeSyncCentre}
                        className="p-1.5 rounded-lg text-sf-muted hover:text-sf-text hover:bg-sf-hover transition-colors"
                        aria-label="Close"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body Content */}
                <div className="flex-1 overflow-y-auto p-5 space-y-5">
                    {/* Network & Device Status Banner */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className={clsx(
                            "p-3 rounded-xl border flex items-center gap-3",
                            isOnline
                                ? "bg-emerald-500/10 border-emerald-400/30 text-emerald-700 dark:text-emerald-300"
                                : "bg-amber-500/10 border-amber-400/30 text-amber-700 dark:text-amber-300"
                        )}>
                            {isOnline ? <CheckCircle2 size={24} className="text-emerald-500 flex-shrink-0" /> : <CloudOff size={24} className="text-amber-500 flex-shrink-0" />}
                            <div>
                                <div className="text-xs font-semibold uppercase tracking-wider">Network</div>
                                <div className="text-sm font-bold">{isOnline ? 'Online & Connected' : 'Offline Mode'}</div>
                            </div>
                        </div>

                        <div className="p-3 rounded-xl border border-sf-divider bg-sf-inset flex items-center gap-3">
                            <ShieldCheck size={24} className="text-sf-primary flex-shrink-0" />
                            <div>
                                <div className="text-xs font-semibold text-sf-muted uppercase tracking-wider">Storage</div>
                                <div className="text-sm font-bold text-sf-text">Durable IndexedDB</div>
                            </div>
                        </div>
                    </div>

                    {/* Active Work Pack Info */}
                    <div className="p-4 rounded-xl border border-sf-divider bg-sf-inset space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-sm font-bold text-sf-text">
                                <Package size={18} className="text-sf-primary" />
                                <span>Offline Work Pack</span>
                            </div>
                            {activePack ? (
                                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                                    Active Lease
                                </span>
                            ) : (
                                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400">
                                    No Pack Loaded
                                </span>
                            )}
                        </div>

                        {activePack ? (
                            <div className="space-y-1.5 text-xs text-sf-muted">
                                <div className="flex justify-between">
                                    <span>Pack ID:</span>
                                    <span className="font-mono font-medium text-sf-text">{activePack.packId}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Laboratory:</span>
                                    <span className="font-medium text-sf-text">{activePack.labId || 'Current Lab'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Cached Samples:</span>
                                    <span className="font-bold text-sf-text">{activePack.sampleCount || 0}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Expires At:</span>
                                    <span className="font-medium text-sf-text">
                                        {activePack.expiresAt ? new Date(activePack.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '12 hours'}
                                    </span>
                                </div>
                            </div>
                        ) : (
                            <p className="text-xs text-sf-muted">
                                Download a work pack before going offline to access assigned samples and capture results.
                            </p>
                        )}

                        {packDownloadError && (
                            <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-400/30 text-rose-600 text-xs">
                                {packDownloadError}
                            </div>
                        )}

                        <button
                            onClick={handleDownloadPack}
                            disabled={downloading || !isOnline}
                            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-bold border border-sf-divider bg-sf-surface hover:bg-sf-hover text-sf-text transition-colors disabled:opacity-50"
                        >
                            {downloading ? (
                                <>
                                    <RefreshCw size={14} className="animate-spin text-sf-primary" />
                                    <span>Downloading Pack...</span>
                                </>
                            ) : (
                                <>
                                    <ArrowDownToLine size={14} className="text-sf-primary" />
                                    <span>{activePack ? 'Refresh / Re-download Pack' : 'Download Offline Work Pack'}</span>
                                </>
                            )}
                        </button>
                    </div>

                    {/* Outbox Operations Queue */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xs font-bold text-sf-muted uppercase tracking-wider">
                                Durable Outbox ({operations.length})
                            </h3>
                            <button
                                onClick={fetchOperations}
                                className="text-xs text-sf-primary hover:underline flex items-center gap-1"
                            >
                                <RefreshCw size={12} />
                                <span>Refresh</span>
                            </button>
                        </div>

                        {operations.length === 0 ? (
                            <div className="p-6 text-center border border-dashed border-sf-divider rounded-xl text-sf-muted text-xs">
                                <CheckCircle2 size={24} className="mx-auto text-emerald-500 mb-1.5" />
                                <p className="font-medium text-sf-text">Outbox is clear</p>
                                <p>All offline work has been securely transmitted to the server.</p>
                            </div>
                        ) : (
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                                {operations.map((op) => (
                                    <div
                                        key={op.operationId}
                                        className="p-2.5 rounded-xl border border-sf-divider bg-sf-surface flex items-start justify-between gap-3 text-xs"
                                    >
                                        <div className="space-y-0.5 min-w-0">
                                            <div className="flex items-center gap-1.5 font-bold text-sf-text truncate">
                                                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-sf-inset border border-sf-divider">
                                                    {op.type}
                                                </span>
                                                <span className="truncate">{op.target?.workItemId || op.target?.sampleId || op.operationId}</span>
                                            </div>
                                            <div className="text-[11px] text-sf-muted flex items-center gap-1">
                                                <Clock size={11} />
                                                <span>{new Date(op.capturedAtLocal).toLocaleTimeString()}</span>
                                                {op.retries > 0 && <span className="text-amber-500">({op.retries} retries)</span>}
                                            </div>
                                            {op.conflictReason && (
                                                <div className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                                                    Conflict: {op.conflictReason}
                                                </div>
                                            )}
                                        </div>
                                        <span className={clsx(
                                            "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex-shrink-0",
                                            op.status === 'PENDING' && "bg-blue-500/10 text-blue-600",
                                            op.status === 'SYNCING' && "bg-sf-primary/10 text-sf-primary animate-pulse",
                                            op.status === 'CONFLICT' && "bg-amber-500/10 text-amber-600",
                                            op.status === 'REJECTED' && "bg-rose-500/10 text-rose-600"
                                        )}>
                                            {op.status}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Controls */}
                <div className="p-4 border-t border-sf-divider bg-sf-canvas flex items-center justify-between gap-3">
                    <button
                        onClick={closeSyncCentre}
                        className="px-4 py-2.5 rounded-xl text-xs font-bold text-sf-muted hover:text-sf-text hover:bg-sf-hover border border-sf-divider transition-colors"
                    >
                        Close
                    </button>
                    <button
                        onClick={handleSyncNow}
                        disabled={syncStatus === 'syncing' || !isOnline}
                        className="btn-primary flex items-center gap-2 text-xs font-bold py-2.5 px-5 disabled:opacity-50"
                    >
                        <RefreshCw size={14} className={syncStatus === 'syncing' ? 'animate-spin' : ''} />
                        <span>{syncStatus === 'syncing' ? 'Synchronizing...' : 'Sync Now'}</span>
                    </button>
                </div>
            </div>
        </div>
    );
};
