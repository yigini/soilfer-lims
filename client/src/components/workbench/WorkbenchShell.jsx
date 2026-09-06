import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useNotifications } from '../../context/NotificationContext';
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
    const [toast, setToast] = useState(null);
    const addToast = useCallback((message, type = 'info') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 4000);
    }, []);

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

    // ─────────────────────────────────────────────────────────────────────────
    // Queue & Draft Fetching
    // ─────────────────────────────────────────────────────────────────────────
    const fetchQueue = useCallback(async () => {
        try {
            const res = await axios.get('/api/workbench/queue');
            const fetchedGroups = res.data.groups || [];
            setGroups(fetchedGroups);
            setStats(res.data.stats || {});

            // Set active analysis default
            if (!activeAnalysis && fetchedGroups.length > 0) {
                setActiveAnalysis(fetchedGroups[0].analysis);
            }

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
            setSyncStatus('offline');
        } finally {
            setIsLoading(false);
        }
    }, [activeAnalysis]);

    const fetchReceipts = useCallback(async () => {
        try {
            const res = await axios.get('/api/workbench/v2/receipts');
            setReceipts(res.data.receipts || []);
        } catch (err) {
            console.error('[workbench] Failed to fetch receipts:', err);
        }
    }, []);

    useEffect(() => {
        fetchQueue();
        fetchReceipts();
    }, [fetchQueue, fetchReceipts]);

    // Deep link navigation
    useEffect(() => {
        if (initialQueue === 'bench.toSubmit') {
            setActiveTab('review');
            setReviewSubView('submission');
            return;
        }

        if (initialRunId && groups.length > 0) {
            const runGroup = groups.find(g => g.items?.some(i => i.batchId === initialRunId));
            if (runGroup) {
                setActiveAnalysis(runGroup.analysis);
                setActiveTab('worksheet');
                return;
            }
        }

        if (initialWorkItemId && groups.length > 0) {
            for (const g of groups) {
                const targetItem = g.items?.find(i => i.id === initialWorkItemId);
                if (targetItem) {
                    setActiveAnalysis(g.analysis);
                    setActiveSampleId(targetItem.sampleId);
                    setActiveTab('worksheet');
                    return;
                }
            }
        }

        if (initialMethodologyId && groups.length > 0) {
            const methGroup = groups.find(g => g.items?.some(i => i.methodologyId === initialMethodologyId));
            if (methGroup) {
                setActiveAnalysis(methGroup.analysis);
                setActiveTab('worksheet');
                return;
            }
        }

        if (initialAnalysis) {
            setActiveAnalysis(initialAnalysis);
            if (initialSampleId) setActiveSampleId(initialSampleId);
            setActiveTab('worksheet');
        } else if (initialSampleId && groups.length > 0) {
            const foundGroup = groups.find(g => g.items?.some(i => i.sampleId === initialSampleId || i.originalId === initialSampleId));
            if (foundGroup) {
                setActiveAnalysis(foundGroup.analysis);
                setActiveSampleId(initialSampleId);
                setActiveTab('worksheet');
            }
        }
    }, [initialAnalysis, initialMethodologyId, initialRevision, initialSampleId, initialWorkItemId, initialRunId, initialQueue, groups]);

    // ─────────────────────────────────────────────────────────────────────────
    // Debounced Draft Persistence
    // ─────────────────────────────────────────────────────────────────────────
    const handleDraftChange = useCallback((workItemId, value, extra = {}) => {
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
                            updatedAt: new Date().toISOString()
                        }
                    };
                })
            }));
        });

        setSyncStatus('saving');

        // Debounce server draft save
        if (debounceTimers.current[workItemId]) {
            clearTimeout(debounceTimers.current[workItemId]);
        }

        debounceTimers.current[workItemId] = setTimeout(async () => {
            try {
                // Find current item snapshot
                let currentItem = null;
                for (const g of groups) {
                    const match = g.items?.find(i => i.workItemId === workItemId);
                    if (match) {
                        currentItem = match;
                        break;
                    }
                }

                await axios.post('/api/workbench/batch-save', {
                    draft: true,
                    entries: [
                        {
                            workItemId,
                            value: value !== null && value !== undefined ? value : currentItem?.draft?.value,
                            values: extra.values || currentItem?.draft?.values,
                            checks: extra.checks || currentItem?.draft?.checks,
                            basis: extra.basis || currentItem?.draft?.basis || 'AIR_DRY',
                            replicateNo: extra.replicateNo || currentItem?.draft?.replicateNo || 1,
                            equipmentId: extra.instrumentId || currentItem?.draft?.instrumentId || currentItem?.equipmentId,
                            version: currentItem?.version || 0
                        }
                    ]
                });

                setSyncStatus('saved');
            } catch (err) {
                console.error('[workbench] Draft save error:', err);
                setSyncStatus('offline');
            }
        }, 800);
    }, [groups]);

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
        try {
            await axios.delete(`/api/workbench/drafts/item/${workItemId}`);
            addToast('Draft discarded successfully', 'info');
            fetchQueue();
            fetchReceipts();
        } catch (err) {
            console.error('[workbench] Failed to discard draft:', err);
            addToast(err.response?.data?.error || 'Failed to discard draft', 'error');
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
            fetchQueue();
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
            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 pb-2">
                <span>SoilFER LIMS / Technician Workspace</span>
                <span>Role: {user?.role} · Lab: {user?.labId || 'Default'}</span>
            </div>

            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                        Technician Workbench
                    </h1>
                    <p className="text-xs text-slate-500 mt-0.5">
                        Unified determination queue, method-aware worksheets, and two-step reviewer handoff
                    </p>
                </div>

                {/* Save / Sync Status Pill */}
                <div className="flex items-center gap-2">
                    {syncStatus === 'saving' ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                            <RefreshCw size={12} className="animate-spin" /> Saving drafts...
                        </span>
                    ) : syncStatus === 'conflict' ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                            <AlertTriangle size={12} /> {conflictCount} Conflict{conflictCount === 1 ? '' : 's'} to compare
                        </span>
                    ) : syncStatus === 'offline' ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300">
                            Offline · Local edits preserved
                        </span>
                    ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                            <CheckCircle2 size={12} /> ✓ Drafts saved
                        </span>
                    )}

                    <button
                        type="button"
                        onClick={fetchQueue}
                        disabled={isLoading}
                        className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-600 dark:text-slate-300"
                        title="Refresh queue"
                    >
                        <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Navigation Tabs */}
            <nav className="flex items-center gap-1.5 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold" aria-label="Workbench navigation">
                {[
                    { id: 'queue', label: `My Queue (${stats.totalItems || 0})` },
                    { id: 'worksheet', label: `Worksheet (${currentGroup?.items?.length || 0})` },
                    { id: 'review', label: `Review & Submit (${stats.totalPending === 0 ? '✓' : stats.totalItems || 0})` },
                    { id: 'activity', label: `Activity Receipts (${receipts.length})` }
                ].map(tab => (
                    <button
                        key={tab.id}
                        type="button"
                        onClick={() => {
                            if (tab.id === 'review' && activeTab !== 'review') {
                                handleOpenSubmissionReview();
                            } else {
                                setActiveTab(tab.id);
                            }
                        }}
                        className={`px-4 py-2.5 border-b-2 transition-colors ${
                            activeTab === tab.id
                                ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400 font-bold'
                                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </nav>

            {/* Tab Views */}
            <div className="pt-2">
                {activeTab === 'queue' && (
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
                        searchQuery=""
                        onSearchChange={() => {}}
                    />
                )}

                {activeTab === 'worksheet' && currentGroup && (
                    <WorksheetArea
                        activeGroup={currentGroup}
                        allGroups={groups}
                        initialSampleId={activeSampleId || initialSampleId}
                        onSelectGroup={(analysis) => setActiveAnalysis(analysis)}
                        onDraftChange={handleDraftChange}
                        onUpdateItemMeta={handleUpdateItemMeta}
                        onDiscardDraft={handleDiscardDraft}
                        onResolveConflict={handleResolveConflict}
                        onReviewRecord={handleReviewRecord}
                        onOpenSpectralIntake={(item) => {
                            setSelectedSpectralItem(item);
                            setIsSpectralModalOpen(true);
                        }}
                        onBatchUpdated={fetchQueue}
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
                    toast.type === 'error' ? 'bg-red-50 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-300' :
                    toast.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300' :
                    'bg-slate-800 text-white border-slate-700'
                }`}>
                    <span>{toast.message}</span>
                </div>
            )}
        </div>
    );
}
