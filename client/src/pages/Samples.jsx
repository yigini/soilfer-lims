import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useDialog } from '../context/DialogContext';
import SamplesHeader from '../components/samples/SamplesHeader';
import SamplesFilterBar from '../components/samples/SamplesFilterBar';
import SamplesFilterDrawer from '../components/samples/SamplesFilterDrawer';
import SamplesTable from '../components/samples/SamplesTable';
import { ChevronLeft, ChevronRight, AlertTriangle, X, Printer, Trash2 } from 'lucide-react';
import LabelPrintDialog from '../components/common/LabelPrintDialog';
import ExportModal from '../components/common/ExportModal';

const Samples = () => {
    const { token, user } = useAuth();
    const { showDialog } = useDialog();

    // Data State
    const [data, setData] = useState([]);
    const [meta, setMeta] = useState({ page: 1, limit: 50, total: 0, pages: 1 });
    const [facets, setFacets] = useState({});
    const [loading, setLoading] = useState(false);

    // Filter State
    const [search, setSearch] = useState('');
    const [filters, setFilters] = useState({});
    const [sort, setSort] = useState('createdAt');
    const [order, setOrder] = useState('desc');

    // UI State
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [selected, setSelected] = useState([]);
    const [options, setOptions] = useState({
        projects: [], countries: [], labs: []
    });

    // Delete Flow State
    const [deleteTarget, setDeleteTarget] = useState(null); // ID pending confirmation
    const [deletingIds, setDeletingIds] = useState([]); // IDs in undo window
    const [undoTimers, setUndoTimers] = useState({}); // { id: timeoutId }
    const [countdowns, setCountdowns] = useState({}); // { id: remainingSeconds }
    const [printTarget, setPrintTarget] = useState(null); // Sample to print
    const [syncing, setSyncing] = useState(false); // Kobo sync in progress
    const [isExportModalOpen, setExportModalOpen] = useState(false);

    // Update options when facets change
    useEffect(() => {
        if (!facets) return;
        setOptions({
            projects: Object.keys(facets.projects || {}).map(k => ({ code: k, name: k })),
            countries: Object.keys(facets.countries || {}).map(k => ({ code: k, name: k })),
            labs: Object.keys(facets.labs || {}).map(k => ({ id: k, name: k }))
        });
    }, [facets]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const params = {
                page: meta.page,
                limit: meta.limit,
                sort,
                order,
                search,
                ...filters
            };
            Object.keys(params).forEach(key => !params[key] && delete params[key]);

            const res = await axios.get('/api/samples', {
                params,
                headers: { Authorization: `Bearer ${token}` }
            });

            setData(res.data.data);
            setMeta(res.data.meta);
            setFacets(res.data.facets || {});
        } catch (err) {
            console.error("Failed to fetch samples", err);
        } finally {
            setLoading(false);
        }
    }, [token, meta.page, meta.limit, sort, order, search, filters]);

    useEffect(() => {
        if (deletingIds.length === 0) return;

        const interval = setInterval(() => {
            setCountdowns(prev => {
                const updated = { ...prev };
                Object.keys(updated).forEach(id => {
                    if (updated[id] > 0) updated[id] -= 1;
                });
                return updated;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [deletingIds]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Sync from Kobo
    const handleSync = async () => {
        setSyncing(true);
        try {
            const res = await axios.post('/api/kobo/sync-all', {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const newCount = res.data.newSamples || 0;
            const skipped = res.data.skipped || 0;
            if (newCount > 0) {
                showDialog({
                    title: 'Sync Complete',
                    message: `Successfully synced ${newCount} new sample(s) from Kobo.`,
                    type: 'success'
                });
                fetchData(); // Refresh the table
            } else {
                showDialog({
                    title: 'Sync Complete',
                    message: 'No new samples found in Kobo. All samples are already in the system.',
                    type: 'info'
                });
            }
        } catch (err) {
            console.error('Sync failed:', err);
            showDialog({
                title: 'Sync Failed',
                message: err.response?.data?.error || err.message,
                type: 'error'
            });
        } finally {
            setSyncing(false);
        }
    };

    // Handlers
    const handleSort = (field, newOrder) => {
        setSort(field);
        setOrder(newOrder);
    };

    const handlePageChange = (newPage) => {
        if (newPage > 0 && newPage <= meta.pages) setMeta(prev => ({ ...prev, page: newPage }));
    };

    const handleSearchChange = (val) => { setSearch(val); setMeta(prev => ({ ...prev, page: 1 })); };

    const handleQuickFilter = (param, value) => {
        const current = filters[param] || '';
        let currentList = current ? current.split(',').map(v => v.trim()) : [];
        const incomingList = String(value).split(',').map(v => v.trim());

        // For multi-value filters (like "Complete"), we toggle based on whether 
        // ALL incoming values are already present.
        const allPresent = incomingList.every(v => currentList.includes(v));

        let newList;
        if (allPresent) {
            // Remove all values in the incoming set
            newList = currentList.filter(v => !incomingList.includes(v));
        } else {
            // Add any missing values from the incoming set
            const toAdd = incomingList.filter(v => !currentList.includes(v));
            newList = [...currentList, ...toAdd];
        }

        setFilters(prev => ({ ...prev, [param]: newList.join(',') }));
        setMeta(prev => ({ ...prev, page: 1 }));
    };

    const handleAdvancedApply = (newFilters) => { setFilters(newFilters); setMeta(prev => ({ ...prev, page: 1 })); };
    const handleReset = () => { setFilters({}); setSearch(''); setMeta(prev => ({ ...prev, page: 1 })); };
    const handleSelect = (id, checked) => { setSelected(prev => checked ? [...prev, id] : prev.filter(i => i !== id)); };
    const handleSelectAll = (checked) => { setSelected(checked ? data.map(d => d.id) : []); };

    // --- Delete Flow ---

    const initiateDelete = (id) => {
        setDeleteTarget(id);
    };

    const confirmDelete = () => {
        if (!deleteTarget) return;
        const id = deleteTarget;
        setDeleteTarget(null);

        // Add to deleting list (Visual Strikethrough)
        setDeletingIds(prev => [...prev, id]);
        setCountdowns(prev => ({ ...prev, [id]: 10 }));

        // Start Timer
        const timer = setTimeout(() => {
            performFinalDelete(id);
        }, 10000); // 10 seconds

        setUndoTimers(prev => ({ ...prev, [id]: timer }));
    };

    const undoDelete = (id) => {
        // Clear Timer
        if (undoTimers[id]) {
            clearTimeout(undoTimers[id]);
            setUndoTimers(prev => {
                const updated = { ...prev };
                delete updated[id];
                return updated;
            });
        }
        setCountdowns(prev => {
            const updated = { ...prev };
            delete updated[id];
            return updated;
        });
        // Remove from deleting UI
        setDeletingIds(prev => prev.filter(mid => mid !== id));
    };

    const performFinalDelete = async (id) => {
        try {
            await axios.delete(`/api/samples/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            // Check if user is still on page, refresh if so
            // We blindly refresh. But ideally we remove from 'data' locally to avoid jump
            // For now refresh is safest.
            fetchData();
        } catch (err) {
            console.error("Failed to delete sample", err);
            const msg = err.response?.data?.error || "Failed to delete sample.";
            alert(msg);
            // Revert UI if failed
            undoDelete(id);
        } finally {
            // Cleanup timer ref
            setUndoTimers(prev => {
                const newT = { ...prev };
                delete newT[id];
                return newT;
            });
            setCountdowns(prev => {
                const updated = { ...prev };
                delete updated[id];
                return updated;
            });
            setDeletingIds(prev => prev.filter(mid => mid !== id));
        }
    };

    const handleBatchDelete = async () => {
        if (!selected.length) return;
        if (!window.confirm(`Are you sure you want to permanently delete these ${selected.length} samples and all their associated data (work items, results, spectral data)? This action CANNOT be undone.`)) return;

        setLoading(true);
        try {
            const res = await axios.post('/api/samples/batch-delete', { ids: selected }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            alert(res.data.message || 'Samples deleted successfully');
            setSelected([]);
            fetchData();
        } catch (err) {
            console.error("Batch delete failed", err);
            alert(err.response?.data?.error || 'Failed to perform batch deletion.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6 max-w-[1600px] mx-auto min-h-screen relative">
            {/* Floating Bulk Actions Bar */}
            {selected.length > 0 && user?.role === 'SUPER_ADMIN' && (
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-bottom-8 duration-300">
                    <div className="bg-gray-900 border border-white/10 shadow-2xl rounded-2xl px-6 py-4 flex items-center gap-8 backdrop-blur-xl bg-opacity-95">
                        <div className="flex items-center gap-3 border-r border-white/10 pr-8">
                            <div className="bg-emerald-500 text-white text-xs font-bold h-6 w-6 flex items-center justify-center rounded-full shadow-lg shadow-emerald-500/20">
                                {selected.length}
                            </div>
                            <span className="text-white font-medium text-sm">Samples Selected</span>
                        </div>

                        <div className="flex items-center gap-4">
                            <button
                                onClick={handleBatchDelete}
                                disabled={loading}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-all duration-200 font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed group"
                            >
                                <Trash2 size={18} className="transition-transform group-hover:scale-110" />
                                <span>Batch Delete</span>
                            </button>

                            <button
                                onClick={() => setSelected([])}
                                className="text-gray-400 hover:text-white transition-colors text-sm font-medium px-2"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <SamplesHeader
                facets={facets}
                onSync={handleSync}
                onExport={() => setExportModalOpen(true)}
                loadingSync={syncing}
                onToggleQuickFilter={handleQuickFilter}
            />

            <SamplesFilterBar
                search={search}
                onSearchChange={handleSearchChange}
                activeFilters={filters}
                onToggleQuickFilter={handleQuickFilter}
                onOpenAdvanced={() => setDrawerOpen(true)}
                onReset={handleReset}
                totalResults={meta.total}
                facets={facets}
                page={meta.page}
                pages={meta.pages}
                onPageChange={handlePageChange}
            />

            <SamplesTable
                data={data}
                sort={sort}
                order={order}
                onSort={handleSort}
                selected={selected}
                onSelect={handleSelect}
                onSelectAll={handleSelectAll}
                canDelete={user && user.role === 'SUPER_ADMIN'}
                onDelete={initiateDelete}
                deletingIds={deletingIds}
                onPrintLabel={(sample) => setPrintTarget(sample)}
            />

            <LabelPrintDialog
                isOpen={!!printTarget}
                onClose={() => setPrintTarget(null)}
                sample={printTarget}
            />

            {/* Pagination ... */}
            <div className="flex justify-between items-center mt-4 border-t border-gray-200 dark:border-gray-700 pt-4">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                    Showing {(meta.page - 1) * meta.limit + 1} to {Math.min(meta.page * meta.limit, meta.total)} of {meta.total} entries
                </span>
                <div className="flex gap-2">
                    <button
                        onClick={() => handlePageChange(meta.page - 1)}
                        disabled={meta.page === 1}
                        className="p-2 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                    >
                        <ChevronLeft size={16} />
                    </button>
                    <button
                        onClick={() => handlePageChange(meta.page + 1)}
                        disabled={meta.page === meta.pages}
                        className="p-2 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                    >
                        <ChevronRight size={16} />
                    </button>
                </div>
            </div>

            <SamplesFilterDrawer
                isOpen={drawerOpen}
                onClose={() => setDrawerOpen(false)}
                filters={filters}
                onApply={handleAdvancedApply}
                onReset={handleReset}
                options={options}
            />

            {/* Confirmation Modal */}
            {deleteTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4 border border-gray-200 dark:border-gray-700">
                        <div className="flex items-center gap-3 text-red-600 mb-4">
                            <AlertTriangle size={24} />
                            <h3 className="text-lg font-bold">Delete Sample?</h3>
                        </div>
                        <p className="text-gray-600 dark:text-gray-300 mb-6">
                            Are you sure you want to delete this sample? This action will permanently remove all associated work items and audit logs.
                        </p>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setDeleteTarget(null)}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 rounded transition"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmDelete}
                                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition font-medium"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Undo Toast */}
            {deletingIds.length > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex flex-col gap-2 z-50">
                    {deletingIds.map(id => (
                        <div key={id} className="bg-gray-900 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-4 animate-in slide-in-from-bottom duration-300">
                            <span>Sample deleted.</span>
                            <button
                                onClick={() => undoDelete(id)}
                                className="text-indigo-400 font-bold hover:text-indigo-300 hover:underline"
                            >
                                Undo ({countdowns[id] || 0}s)
                            </button>
                            <button onClick={() => undoDelete(id)} className="ml-2 text-gray-500 hover:text-white">
                                <X size={16} />
                            </button>
                        </div>
                    ))}
                </div>
            )}
            {/* EXPORT MODAL */}
            <ExportModal
                isOpen={isExportModalOpen}
                onClose={() => setExportModalOpen(false)}
                currentFilters={filters}
                searchQuery={search}
            />
        </div>
    );
};

export default Samples;
