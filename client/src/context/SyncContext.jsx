import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
    triggerSync,
    subscribeSyncState,
    recordSyncOperation
} from '../services/offline/syncEngine';
import {
    getPendingOutboxOperations,
    getAllOutboxOperations,
    getActiveWorkPack
} from '../services/offline/offlineDb';
import {
    downloadAndActivateWorkPack,
    checkPackValidity
} from '../services/offline/workPackManager';
import { useAuth } from './AuthContext';

const SyncContext = createContext(null);

export const SyncProvider = ({ children }) => {
    const { user } = useAuth();
    const [isOnline, setIsOnline] = useState(() => typeof navigator !== 'undefined' ? navigator.onLine : true);
    const [syncStatus, setSyncStatus] = useState('idle'); // 'idle' | 'syncing' | 'offline' | 'needs_attention' | 'error'
    const [pendingCount, setPendingCount] = useState(0);
    const [conflictCount, setConflictCount] = useState(0);
    const [lastSyncTime, setLastSyncTime] = useState(null);
    const [activePack, setActivePack] = useState(null);
    const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);

    // Refresh pending outbox counts
    const refreshCounts = useCallback(async () => {
        try {
            const allOps = await getAllOutboxOperations();
            const pending = allOps.filter(o => o.status === 'PENDING' || o.status === 'SYNCING');
            const conflicts = allOps.filter(o => o.status === 'CONFLICT' || o.status === 'REJECTED');
            setPendingCount(pending.length);
            setConflictCount(conflicts.length);

            if (conflicts.length > 0) {
                setSyncStatus('needs_attention');
            } else if (!navigator.onLine) {
                setSyncStatus('offline');
            } else if (syncStatus !== 'syncing') {
                setSyncStatus('idle');
            }
        } catch (e) {
            console.error('[SYNC_CONTEXT] Error refreshing counts:', e);
        }
    }, [syncStatus]);

    // Check active work pack
    const refreshPack = useCallback(async () => {
        if (!user) return;
        try {
            const packResult = await checkPackValidity(user);
            setActivePack(packResult.pack);
        } catch (e) {
            console.error('[SYNC_CONTEXT] Error checking pack:', e);
        }
    }, [user]);

    // Listen to network status
    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            setSyncStatus('idle');
            // Auto sync when coming back online
            triggerSync().catch(() => {});
        };

        const handleOffline = () => {
            setIsOnline(false);
            setSyncStatus('offline');
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        refreshCounts();
        refreshPack();

        // Subscribe to sync engine events
        const unsubscribe = subscribeSyncState((event) => {
            if (event.type === 'SYNC_STARTED') {
                setSyncStatus('syncing');
            } else if (event.type === 'SYNC_COMPLETED') {
                setSyncStatus(event.summary.conflicts > 0 ? 'needs_attention' : 'idle');
                setLastSyncTime(new Date());
                refreshCounts();
            } else if (event.type === 'SYNC_FAILED') {
                setSyncStatus('error');
                refreshCounts();
            } else if (event.type === 'OPERATION_QUEUED') {
                refreshCounts();
            }
        });

        // Periodic count refresh every 30s
        const interval = setInterval(() => {
            refreshCounts();
        }, 30000);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            unsubscribe();
            clearInterval(interval);
        };
    }, [refreshCounts, refreshPack]);

    const performSync = async () => {
        setSyncStatus('syncing');
        const res = await triggerSync(null, user);
        refreshCounts();
        return res;
    };

    const downloadPack = async (options) => {
        const bundle = await downloadAndActivateWorkPack(options);
        await refreshPack();
        return bundle;
    };

    const openSyncCentre = () => setIsSyncModalOpen(true);
    const closeSyncCentre = () => setIsSyncModalOpen(false);

    return (
        <SyncContext.Provider value={{
            isOnline,
            syncStatus,
            pendingCount,
            conflictCount,
            lastSyncTime,
            activePack,
            isSyncModalOpen,
            openSyncCentre,
            closeSyncCentre,
            triggerSync: performSync,
            downloadPack,
            recordSyncOperation,
            refreshCounts
        }}>
            {children}
        </SyncContext.Provider>
    );
};

export const useSync = () => {
    const context = useContext(SyncContext);
    if (!context) {
        throw new Error('useSync must be used within a SyncProvider');
    }
    return context;
};
