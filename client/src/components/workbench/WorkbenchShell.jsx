import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useNotifications } from '../../context/NotificationContext';
import { useHelp } from '../../context/HelpContext';
import {
    Activity, Save, CheckCircle2, AlertTriangle, Clock, Send,
    RefreshCw, Layers, ShieldCheck, Check
} from 'lucide-react';

import WorkbenchQueue from './WorkbenchQueue';
import WorksheetArea from './WorksheetArea';
import ReviewCompletionView from './ReviewCompletionView';
import ReviewSubmissionView from './ReviewSubmissionView';
import ActivityReceiptsView from './ActivityReceiptsView';
import SpectralIntakeModal from './SpectralIntakeModal';
import { saveLocalDraft, getLocalDraft, deleteLocalDraft, removePendingDraftOperations } from '../../services/offline/offlineDb';
import { recordSyncOperation } from '../../services/offline/syncEngine';

/**
 * WorkbenchShell
 * Central container for the technician workbench redesign.
 * Coordinates real-time queue synchronization, isolated draft persistence,
 * the two-step completion/submission lifecycle, and specialized modality routing.
 */
export default function WorkbenchShell({
    initialAnalysis = null,
    initialMethodologyId = null,
    initialRevision = null,
    initialSampleId = null,
    initialWorkItemId = null,
    initialRunId = null,
    initialQueue = null
}) {
    const { user } = useAuth();
    const { t } = useLanguage();
    const { clearBlockers } = useHelp();
    const [toast, setToast] = useState(null);

    // Clean up blockers when navigating away from Workbench
    useEffect(() => {
        return () => {
            clearBlockers();
        };
    }, [clearBlockers]);
    const addToast = useCallback((message, type = 'info') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 4000);
    }, []);

    const [queueView, setQueueView] = useState(() => {
        if (initialQueue === 'bench.toSubmit') return 'ready_to_submit';
        return 'my_work';
    });

    const [activeTab, setActiveTab] = useState(() => {
        if (initialQueue === 'bench.toSubmit') return 'review';
        if (initialAnalysis || initialSampleId || initialRunId || initialWorkItemId) return 'worksheet';
        return 'queue';
    });
    const [reviewSubView, setReviewSubView] = useState(() => {
        if (initialQueue === 'bench.toSubmit') return 'submission';
        return 'completion';
    });
    const [groups, setGroups] = useState([]);
    const [stats, setStats] = useState({});
    const [activeAnalysis, setActiveAnalysis] = useState(initialAnalysis);
    const [activeSampleId, setActiveSampleId] = useState(initialSampleId);
    const [isLoading, setIsLoading] = useState(true);
    const [queueSearchQuery, setQueueSearchQuery] = useState('');

    // Save & sync state
    const [syncStatus, setSyncStatus] = useState('saved'); // saving | saved | conflict | offline
    const [conflictCount, setConflictCount] = useState(0);
    const [isSpectralModalOpen, setIsSpectralModalOpen] = useState(false);
    const [selectedSpectralItem, setSelectedSpectralItem] = useState(null);

    // Preflight review state
    const [completionPreview, setCompletionPreview] = useState(null);
    const [submissionPreview, setSubmissionPreview] = useState(null);
    const [receipts, setReceipts] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const debounceTimers = useRef({});
    const hasResolvedDeepLink = useRef(false);
    const activeTargetRef = useRef({
        workItemId: initialWorkItemId,
        sampleId: initialSampleId
    });

    useEffect(() => {
        activeTargetRef.current = {
            workItemId: initialWorkItemId,
            sampleId: initialSampleId
        };
        hasResolvedDeepLink.current = false;
    }, [initialWorkItemId, initialSampleId]);

    // ─────────────────────────────────────────────────────────────────────────
    // Queue & Draft Fetching
    // ─────────────────────────────────────────────────────────────────────────
    const fetchQueue = useCallback(async (viewToFetch = queueView, bypassDeepLink = false) => {
        try {
            const params = { view: viewToFetch };
            const target = activeTargetRef.current;
            if (!bypassDeepLink && (target.workItemId || target.sampleId)) {
                if (target.workItemId) params.workItemId = target.workItemId;
                if (target.sampleId) params.sampleId = target.sampleId;
            }
            const res = await axios.get('/api/workbench/queue', { params });
            const fetchedGroups = res.data.groups || [];

            // Rehydrate with durable offline local drafts if present
            if (user?.id) {
                for (const g of fetchedGroups) {
                    if (Array.isArray(g.items)) {
                        for (const item of g.items) {
                            try {
                                const localDraft = await getLocalDraft(`draft:${user.id}:${item.workItemId}`);
                                if (localDraft && localDraft.value !== undefined && localDraft.value !== null) {
                                    if (!item.draft || item.draft.value === undefined || item.draft.value === null ||
                                        (localDraft.updatedAt && new Date(localDraft.updatedAt) > new Date(item.draft.updatedAt || 0))) {
                                        item.draft = {
                                            ...(item.draft || {}),
                                            workItemId: item.workItemId,
                                            value: localDraft.value,
                                            values: localDraft.extra?.values || item.draft?.values,
                                            checks: localDraft.extra?.checks || item.draft?.checks,
                                            basis: localDraft.extra?.basis || item.draft?.basis || 'AIR_DRY',
                                            replicateNo: localDraft.extra?.replicateNo || item.draft?.replicateNo || 1,
                                            draftVersion: localDraft.draftVersion || item.draft?.draftVersion || 1,
                                            updatedAt: localDraft.updatedAt
                                        };
                                    }
                                }
                            } catch (_) {}
                        }
                    }
                }
            }

            setGroups(fetchedGroups);
            setStats(res.data.stats || {});

            // Set active analysis default if not set (functional update to prevent dependency loop)
            setActiveAnalysis(prev => prev || (fetchedGroups.length > 0 ? fetchedGroups[0].analysis : null));

            // Count conflicts
            let conflicts = 0;
            fetchedGroups.forEach(g => {
                g.items?.forEach(i => {
                    if (i.draft?.conflictValue) conflicts++;
                });
            });
            setConflictCount(conflicts);
            if (conflicts > 0) {
                setSyncStatus('conflict');
            } else {
                setSyncStatus('saved');
            }
        } catch (err) {
            console.error('[workbench] Failed to fetch queue:', err);
            const status = err.response?.status;
            const errData = err.response?.data;

            // Only fallback once for failed targeted requests
            const hadActiveTarget = Boolean(activeTargetRef.current.workItemId || activeTargetRef.current.sampleId);
            if (!bypassDeepLink && hadActiveTarget) {
                activeTargetRef.current = { workItemId: null, sampleId: null };
                hasResolvedDeepLink.current = true;
                setSyncStatus('saved');

                if (status === 400 && errData?.error === 'CONTRADICTORY_IDENTIFIERS') {
                    addToast(errData.message || `Contradictory identifiers: work item '${initialWorkItemId}' does not belong to sample '${initialSampleId}'`, 'error');
                } else if (status === 403) {
                    addToast(errData?.message || 'Access denied: requested item belongs to another laboratory.', 'error');
                } else if (status === 404) {
                    addToast(errData?.message || `Requested item '${initialWorkItemId || initialSampleId}' was not found.`, 'error');
                } else {
                    addToast(errData?.message || 'Failed to load requested deep-link item.', 'error');
                }

                fetchQueue(viewToFetch, true);
                return;
            }

            // Normal queue failure or persistent error after fallback: show stable error without re-fetching
            setSyncStatus('offline');
            addToast(errData?.message || 'Failed to load workbench queue.', 'error');
        } finally {
            setIsLoading(false);
        }
    }, [addToast, initialSampleId, initialWorkItemId, queueView, user?.id]);

    const fetchReceipts = useCallback(async () => {
        try {
            const res = await axios.get('/api/workbench/v2/receipts');
            setReceipts(res.data.receipts || []);
        } catch (err) {
            console.error('[workbench] Failed to fetch receipts:', err);
        }
    }, []);

    useEffect(() => {
        fetchQueue(queueView);
        fetchReceipts();
    }, [fetchQueue, fetchReceipts, queueView]);

    // Open submission review independently on bench.toSubmit
    useEffect(() => {
        if (initialQueue === 'bench.toSubmit') {
            handleOpenSubmissionReview();
        }
    }, [initialQueue]);

    // Deep link navigation - executed once per navigation intent change
    useEffect(() => {
        if (hasResolvedDeepLink.current || isLoading) return;

        if (initialQueue === 'bench.toSubmit') {
            setActiveTab('review');
            setReviewSubView('submission');
            hasResolvedDeepLink.current = true;
            return;
        }

        if (initialRunId && groups.length > 0) {
            const runGroup = groups.find(g => g.items?.some(i => i.batchId === initialRunId));
            if (runGroup) {
                setActiveAnalysis(runGroup.analysis);
                setActiveTab('worksheet');
                hasResolvedDeepLink.current = true;
                return;
            }
        }

        if (initialWorkItemId && groups.length > 0) {
            let found = false;
            for (const g of groups) {
                const targetItem = g.items?.find(i => i.id === initialWorkItemId || i.workItemId === initialWorkItemId);
                if (targetItem) {
                    setActiveAnalysis(g.analysis);
                    setActiveSampleId(targetItem.sampleId);
                    setActiveTab('worksheet');
                    hasResolvedDeepLink.current = true;
                    found = true;
                    return;
                }
            }
            if (!found) {
                addToast(`Work item ${initialWorkItemId} is not in current active queue (may be completed or in another view)`, 'info');
                hasResolvedDeepLink.current = true;
                return;
            }
        }

        if (initialMethodologyId && groups.length > 0) {
            const methGroup = groups.find(g => g.items?.some(i => i.methodologyId === initialMethodologyId));
            if (methGroup) {
                setActiveAnalysis(methGroup.analysis);
                setActiveTab('worksheet');
                hasResolvedDeepLink.current = true;
                return;
            }
        }

        if (initialAnalysis) {
            setActiveAnalysis(initialAnalysis);
            if (initialSampleId) setActiveSampleId(initialSampleId);
            setActiveTab('worksheet');
            hasResolvedDeepLink.current = true;
        } else if (initialSampleId && groups.length > 0) {
            const foundGroup = groups.find(g => g.items?.some(i => i.sampleId === initialSampleId || i.originalId === initialSampleId));
            if (foundGroup) {
                setActiveAnalysis(foundGroup.analysis);
                setActiveSampleId(initialSampleId);
                setActiveTab('worksheet');
                hasResolvedDeepLink.current = true;
            }
        }
    }, [initialAnalysis, initialMethodologyId, initialRevision, initialSampleId, initialWorkItemId, initialRunId, initialQueue, groups, isLoading, addToast]);

    // ─────────────────────────────────────────────────────────────────────────
    // Debounced Draft Persistence
    // ─────────────────────────────────────────────────────────────────────────
    const handleDraftChange = useCallback((workItemId, value, extra = {}) => {
        // Look up current draft version
        let currentItemSnapshot = null;
        for (const g of groups) {
            const match = g.items?.find(i => i.workItemId === workItemId);
            if (match) {
                currentItemSnapshot = match;
                break;
            }
        }
        const nextDraftVersion = (Number(currentItemSnapshot?.draft?.draftVersion) || 0) + 1;

        // Immediately patch in local UI state
        setGroups(prevGroups => {
            return prevGroups.map(group => ({
                ...group,
                items: group.items.map(item => {
                    if (item.workItemId !== workItemId) return item;
                    const existingDraft = item.draft || {};
                    return {
                        ...item,
                        draft: {
                            ...existingDraft,
                            workItemId,
                            value: value !== null && value !== undefined ? value : existingDraft.value,
                            values: extra.values !== undefined ? extra.values : existingDraft.values,
                            checks: extra.checks !== undefined ? extra.checks : existingDraft.checks,
                            basis: extra.basis || existingDraft.basis || 'AIR_DRY',
                            replicateNo: extra.replicateNo || existingDraft.replicateNo || 1,
                            instrumentId: extra.instrumentId || existingDraft.instrumentId || item.equipmentId,
                            draftVersion: nextDraftVersion,
                            updatedAt: new Date().toISOString()
                        }
                    };
                })
            }));
        });

        // Persist local offline draft immediately to IndexedDB
        if (user?.id) {
            saveLocalDraft(`draft:${user.id}:${workItemId}`, {
                workItemId,
                value,
                extra,
                draftVersion: nextDraftVersion,
                updatedAt: new Date().toISOString()
            }).catch(e => console.warn('[workbench] Failed to persist local draft:', e));
        }

        setSyncStatus('saving');

        // Debounce server draft save
        if (debounceTimers.current[workItemId]) {
            clearTimeout(debounceTimers.current[workItemId]);
        }

        debounceTimers.current[workItemId] = setTimeout(async () => {
            // Find current item snapshot
            let currentItem = null;
            for (const g of groups) {
                const match = g.items?.find(i => i.workItemId === workItemId);
                if (match) {
                    currentItem = match;
                    break;
                }
            }

            const draftVal = value !== null && value !== undefined ? value : currentItem?.draft?.value;

            if (typeof navigator !== 'undefined' && !navigator.onLine) {
                setSyncStatus('offline');
                if (user?.id) {
                    try {
                        await recordSyncOperation({
                            type: 'SAVE_WORK_DRAFT',
                            target: workItemId,
                            baseVersion: currentItem?.version || 1,
                            payload: {
                                workItemId,
                                value: draftVal,
                                values: extra.values || currentItem?.draft?.values,
                                checks: extra.checks || currentItem?.draft?.checks,
                                basis: extra.basis || currentItem?.draft?.basis || 'AIR_DRY',
                                replicateNo: extra.replicateNo || currentItem?.draft?.replicateNo || 1,
                                equipmentId: extra.instrumentId || currentItem?.draft?.instrumentId || currentItem?.equipmentId,
                                draftVersion: nextDraftVersion,
                                clientDraftVersion: nextDraftVersion
                            },
                            userId: user.id,
                            labId: user.labId
                        });
                    } catch (syncErr) {
                        console.warn('[workbench] Failed to queue outbox sync operation:', syncErr);
                    }
                }
                return;
            }

            try {
                await axios.post('/api/workbench/batch-save', {
                    draft: true,
                    entries: [
                        {
                            workItemId,
                            value: draftVal,
                            values: extra.values || currentItem?.draft?.values,
                            checks: extra.checks || currentItem?.draft?.checks,
                            basis: extra.basis || currentItem?.draft?.basis || 'AIR_DRY',
                            replicateNo: extra.replicateNo || currentItem?.draft?.replicateNo || 1,
                            equipmentId: extra.instrumentId || currentItem?.draft?.instrumentId || currentItem?.equipmentId,
                            version: currentItem?.version || 0,
                            draftVersion: nextDraftVersion
                        }
                    ]
                });

                setSyncStatus('saved');
            } catch (err) {
                console.error('[workbench] Draft save error:', err);
                setSyncStatus('offline');
                if (user?.id) {
                    try {
                        await recordSyncOperation({
                            type: 'SAVE_WORK_DRAFT',
                            target: workItemId,
                            baseVersion: currentItem?.version || 1,
                            payload: {
                                workItemId,
                                value: draftVal,
                                values: extra.values || currentItem?.draft?.values,
                                checks: extra.checks || currentItem?.draft?.checks,
                                basis: extra.basis || currentItem?.draft?.basis || 'AIR_DRY',
                                replicateNo: extra.replicateNo || currentItem?.draft?.replicateNo || 1,
                                equipmentId: extra.instrumentId || currentItem?.draft?.instrumentId || currentItem?.equipmentId,
                                draftVersion: nextDraftVersion,
                                clientDraftVersion: nextDraftVersion
                            },
                            userId: user.id,
                            labId: user.labId
                        });
                    } catch (syncErr) {
                        console.warn('[workbench] Failed to queue outbox sync operation:', syncErr);
                    }
                }
            }
        }, 800);
    }, [groups, user]);

    // ─────────────────────────────────────────────────────────────────────────
    // Update Item Metadata (Basis, Replicate, Instrument)
    // ─────────────────────────────────────────────────────────────────────────
    const handleUpdateItemMeta = useCallback((workItemId, metaKey, metaValue) => {
        handleDraftChange(workItemId, null, { [metaKey]: metaValue });
    }, [handleDraftChange]);

    // ─────────────────────────────────────────────────────────────────────────
    // Discard Single Draft
    // ─────────────────────────────────────────────────────────────────────────
    const handleDiscardDraft = async (workItemId) => {
        if (debounceTimers.current[workItemId]) {
            clearTimeout(debounceTimers.current[workItemId]);
            delete debounceTimers.current[workItemId];
        }
        try {
            if (user?.id) {
                deleteLocalDraft(`draft:${user.id}:${workItemId}`).catch(() => {});
                removePendingDraftOperations(workItemId, user.id).catch(() => {});
            }
            await axios.delete(`/api/workbench/drafts/item/${workItemId}`);
            addToast('Draft discarded successfully', 'info');
            fetchQueue(queueView);
            fetchReceipts();
        } catch (err) {
            console.error('[workbench] Failed to discard draft:', err);
            addToast(err.response?.data?.error || 'Failed to discard draft', 'error');
        }
    };

    // ─────────────────────────────────────────────────────────────────────────
    // Confirm Operational Gate Checklist (Drying / Preparation)
    // ─────────────────────────────────────────────────────────────────────────
    const handleConfirmOperation = async (workItemId, checklist, observations = null) => {
        if (debounceTimers.current[workItemId]) {
            clearTimeout(debounceTimers.current[workItemId]);
            delete debounceTimers.current[workItemId];
        }
        try {
            setIsLoading(true);
            const res = await axios.post('/api/workbench/operations/confirm', {
                workItemId,
                checklist,
                observations
            });
            addToast(`Operation confirmed successfully (${res.data.receipt?.receiptId || 'Verified'})`, 'success');
            await fetchQueue(queueView);
            await fetchReceipts();
        } catch (err) {
            console.error('[workbench] Failed to confirm operation:', err);
            addToast(err.response?.data?.error || err.response?.data?.message || 'Failed to confirm operational checklist', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    // ─────────────────────────────────────────────────────────────────────────
    // Resolve Concurrency Conflict
    // ─────────────────────────────────────────────────────────────────────────
    const handleResolveConflict = async (workItemId, resolution, reason = '') => {
        try {
            await axios.post(`/api/workbench/drafts/item/${workItemId}/resolve-conflict`, {
                resolution,
                reason
            });
            addToast(`Conflict resolved (${resolution})`, 'success');
            fetchQueue(queueView);
            fetchReceipts();
        } catch (err) {
            console.error('[workbench] Failed to resolve conflict:', err);
            addToast(err.response?.data?.error || 'Failed to resolve conflict', 'error');
        }
    };

    // ─────────────────────────────────────────────────────────────────────────
    // Preflight Preview & Review Initiation
    // ─────────────────────────────────────────────────────────────────────────
    const handleReviewRecord = async (selectedWorkItemIds) => {
        if (!selectedWorkItemIds || selectedWorkItemIds.length === 0) return;

        // Drain any pending debounces for these items before recording
        selectedWorkItemIds.forEach(id => {
            if (debounceTimers.current[id]) {
                clearTimeout(debounceTimers.current[id]);
                delete debounceTimers.current[id];
            }
        });

        try {
            setIsLoading(true);
            const activeGrp = groups.find(g => g.analysis === activeAnalysis);
            const selectedItems = activeGrp?.items?.filter(i => selectedWorkItemIds.includes(i.workItemId)) || [];

            const entries = selectedItems.map(i => ({
                workItemId: i.workItemId,
                value: i.draft?.value ?? i.currentResult,
                values: i.draft?.values,
                checks: i.draft?.checks,
                basis: i.draft?.basis || 'AIR_DRY',
                replicateNo: i.draft?.replicateNo || 1,
                equipmentId: i.draft?.instrumentId || i.equipmentId,
                version: i.version
            }));

            const res = await axios.post('/api/workbench/v2/completion/preview', { entries });
            setCompletionPreview(res.data);
            setReviewSubView('completion');
            setActiveTab('review');
        } catch (err) {
            console.error('[workbench] Failed to preview completion:', err);
            addToast('Failed to generate review preview', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    // ─────────────────────────────────────────────────────────────────────────
    // Commit Record Determinations (Step 1)
    // ─────────────────────────────────────────────────────────────────────────
    const handleCommitCompletion = async (includedItems) => {
        setIsSubmitting(true);
        try {
            const entries = includedItems.map(i => ({
                workItemId: i.workItemId,
                value: i.value,
                values: i.values,
                checks: i.checks,
                basis: i.basis,
                replicateNo: i.replicateNo,
                equipmentId: i.equipmentId,
                version: i.version
            }));

            const res = await axios.post('/api/workbench/v2/completion/commit', { entries });
            addToast(`Successfully recorded ${res.data.saved} determination(s)`, 'success');
            await fetchQueue();
            await fetchReceipts();

            // Transition to Submission review
            await handleOpenSubmissionReview();
        } catch (err) {
            console.error('[workbench] Failed to commit determinations:', err);
            addToast(err.response?.data?.error || 'Failed to record determinations', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    // ─────────────────────────────────────────────────────────────────────────
    // Open Submission Review (Step 2)
    // ─────────────────────────────────────────────────────────────────────────
    const handleOpenSubmissionReview = async () => {
        try {
            setIsLoading(true);
            const res = await axios.post('/api/workbench/v2/submissions/preview', {});
            setSubmissionPreview(res.data.eligibleSamples || []);
            setReviewSubView('submission');
            setActiveTab('review');
        } catch (err) {
            console.error('[workbench] Failed to preview submissions:', err);
        } finally {
            setIsLoading(false);
        }
    };

    // ─────────────────────────────────────────────────────────────────────────
    // Commit Review Submission (Step 2 Commit)
    // ─────────────────────────────────────────────────────────────────────────
    const handleCommitSubmissions = async (sampleIds, note) => {
        setIsSubmitting(true);
        try {
            const res = await axios.post('/api/workbench/v2/submissions/commit', {
                sampleIds,
                note
            });
            addToast(`Successfully submitted ${res.data.receipt?.sampleCount} sample(s) for review`, 'success');
            await fetchQueue();
            await fetchReceipts();
            setActiveTab('activity');
        } catch (err) {
            console.error('[workbench] Failed to commit submissions:', err);
            addToast(err.response?.data?.error || 'Failed to submit samples', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Active Group
    const currentGroup = groups.find(g => g.analysis === activeAnalysis) || groups[0] || null;

    return (
        <div className="flex flex-col gap-4 max-w-7xl mx-auto px-4 py-6 font-sans">
            {/* Top Ribbon */}
            <div className="flex items-center justify-between text-[11px] text-sf-muted border-b border-sf-divider pb-2">
                <span className="sf-kicker">SoilFER LIMS / Technician Workspace</span>
                <span>Role: {user?.role} · Lab: {user?.labId || 'Default'}</span>
            </div>

            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-sf-text tracking-tight">
                        Technician Workbench
                    </h1>
                    <p className="text-xs text-sf-muted mt-0.5">
                        Unified determination queue, method-aware worksheets, and two-step reviewer handoff
                    </p>
                </div>

                {/* Save / Sync Status Pill */}
                <div className="flex items-center gap-2">
                    {syncStatus === 'saving' ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[var(--sf-blue-bg)] text-[var(--sf-blue)] border border-[var(--sf-blue)]/20">
                            <RefreshCw size={12} className="animate-spin" /> Saving drafts...
                        </span>
                    ) : syncStatus === 'conflict' ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[var(--sf-warning-bg)] text-[var(--sf-warning)] border border-[var(--sf-warning)]/20">
                            <AlertTriangle size={12} /> {conflictCount} Conflict{conflictCount === 1 ? '' : 's'} to compare
                        </span>
                    ) : syncStatus === 'offline' ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[var(--sf-danger-bg)] text-[var(--sf-danger)] border border-[var(--sf-danger)]/20">
                            Offline · Local edits preserved
                        </span>
                    ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[var(--sf-success-bg)] text-[var(--sf-success)] border border-[var(--sf-success)]/20">
                            <CheckCircle2 size={12} /> ✓ Drafts saved
                        </span>
                    )}

                    <button
                        type="button"
                        onClick={fetchQueue}
                        disabled={isLoading}
                        className="p-1.5 rounded-lg border border-sf-divider hover:bg-sf-hover transition-colors text-sf-muted hover:text-sf-text"
                        title="Refresh queue"
                    >
                        <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Navigation Tabs */}
            <nav className="flex items-center gap-1.5 border-b border-sf-divider text-xs font-semibold" aria-label="Workbench navigation">
                {[
                    { id: 'queue', label: `My Work (${stats.myWorkCount ?? stats.totalItems ?? 0})` },
                    { id: 'worksheet', label: `Worksheet (${currentGroup?.items?.length || 0})` },
                    { id: 'review', label: `Ready to Submit (${stats.readyToSubmitCount ?? 0})` },
                    { id: 'completed', label: `Sent & Completed (${(stats.submittedCount || 0) + (stats.completedCount || 0)})` },
                    { id: 'activity', label: `Activity Receipts (${receipts.length})` }
                ].map(tab => (
                    <button
                        key={tab.id}
                        type="button"
                        onClick={() => {
                            if (tab.id === 'review') {
                                handleOpenSubmissionReview();
                            } else if (tab.id === 'completed') {
                                setQueueView('completed');
                                fetchQueue('completed');
                            } else if (tab.id === 'queue') {
                                setQueueView('my_work');
                                fetchQueue('my_work');
                            }
                            setActiveTab(tab.id);
                        }}
                        className={`px-4 py-2.5 border-b-2 transition-colors ${
                            activeTab === tab.id
                                ? 'border-sf-primary text-sf-primary font-bold'
                                : 'border-transparent text-sf-muted hover:text-sf-text'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </nav>

            {/* Tab Views */}
            <div className="pt-2">
                {(activeTab === 'queue' || activeTab === 'completed') && (
                    <WorkbenchQueue
                        groups={groups}
                        onOpenWorksheet={(analysis, sampleId) => {
                            setActiveAnalysis(analysis);
                            if (sampleId) setActiveSampleId(sampleId);
                            setActiveTab('worksheet');
                        }}
                        onOpenSpectralIntake={(item) => {
                            setSelectedSpectralItem(item);
                            setIsSpectralModalOpen(true);
                        }}
                        searchQuery={queueSearchQuery}
                        onSearchChange={setQueueSearchQuery}
                    />
                )}

                {activeTab === 'worksheet' && currentGroup && (
                    <WorksheetArea
                        activeGroup={currentGroup}
                        allGroups={groups}
                        initialSampleId={activeSampleId || initialSampleId}
                        initialWorkItemId={initialWorkItemId}
                        onSelectGroup={(analysis) => setActiveAnalysis(analysis)}
                        onDraftChange={handleDraftChange}
                        onUpdateItemMeta={handleUpdateItemMeta}
                        onDiscardDraft={handleDiscardDraft}
                        onResolveConflict={handleResolveConflict}
                        onReviewRecord={handleReviewRecord}
                        onConfirmOperation={handleConfirmOperation}
                        onOpenSpectralIntake={(item) => {
                            setSelectedSpectralItem(item);
                            setIsSpectralModalOpen(true);
                        }}
                        onBatchUpdated={() => fetchQueue(queueView)}
                    />
                )}

                {activeTab === 'review' && reviewSubView === 'completion' && (
                    <ReviewCompletionView
                        previewData={completionPreview}
                        onBack={() => setActiveTab('worksheet')}
                        onCommit={handleCommitCompletion}
                        isSubmitting={isSubmitting}
                    />
                )}

                {activeTab === 'review' && reviewSubView === 'submission' && (
                    <ReviewSubmissionView
                        eligibleSamples={submissionPreview || []}
                        onBack={() => setActiveTab('worksheet')}
                        onSubmit={handleCommitSubmissions}
                        isSubmitting={isSubmitting}
                    />
                )}

                {activeTab === 'activity' && (
                    <ActivityReceiptsView
                        receipts={receipts}
                        onRefresh={fetchReceipts}
                        isLoading={isLoading}
                    />
                )}
            </div>

            {/* Spectral Intake Modal */}
            <SpectralIntakeModal
                isOpen={isSpectralModalOpen}
                onClose={() => setIsSpectralModalOpen(false)}
                onImportComplete={() => {
                    setIsSpectralModalOpen(false);
                    fetchQueue();
                    fetchReceipts();
                }}
                assignedWorkItems={currentGroup?.items || []}
                selectedItem={selectedSpectralItem}
                modality={selectedSpectralItem?.analysis || 'SPEC_MIR'}
                eligibleEquipment={currentGroup?.eligibleEquipment || []}
            />

            {/* Toast Notification */}
            {toast && (
                <div className={`fixed bottom-5 right-5 z-50 px-4 py-2.5 rounded-lg shadow-lg text-xs font-medium border flex items-center gap-2 ${
                    toast.type === 'error' ? 'bg-red-50 text-red-800 border-red-200 dark:bg-red-950/80 dark:text-red-300 dark:border-red-900' :
                    toast.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-900' :
                    'bg-sf-raised text-sf-text border-sf-divider'
                }`}>
                    <span>{toast.message}</span>
                </div>
            )}
        </div>
    );
}
