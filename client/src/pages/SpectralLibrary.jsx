import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import { Search, Upload, Activity, RefreshCw, Eye, FileText, Download, CheckCircle, AlertTriangle, XCircle, Trash, Database, Sparkles, BarChart3, Calendar, User, Cpu, Clock, ThumbsUp, ThumbsDown, Shield, ClipboardCheck, Undo2, Trash2, RotateCcw, AlertOctagon, ChevronDown, ChevronRight } from 'lucide-react';
import SpectraBatchUpload from '../components/SpectraBatchUpload';
import SpectraViewer from '../components/SpectraViewer';
import InfoTooltip from '../components/common/InfoTooltip';
import { useAuth } from '../context/AuthContext';
import { useDialog } from '../context/DialogContext';
import { useNotifications } from '../context/NotificationContext';
import { useLanguage } from '../context/LanguageContext';

const SpectralLibrary = () => {
    const { user } = useAuth();
    const { showDialog } = useDialog();
    const { t } = useLanguage();
    const [activeTab, setActiveTab] = useState('EXPLORER');
    const [spectraList, setSpectraList] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedScan, setSelectedScan] = useState(null);
    const [overlayScans, setOverlayScans] = useState(null); // Array of scan objects for overlay mode
    const [filters, setFilters] = useState({ search: '', modality: '', qcStatus: '', status: '' });
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [batchLoading, setBatchLoading] = useState(false);
    const [expandedGroups, setExpandedGroups] = useState(new Set());

    // Dismiss viewer modal on Escape key
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && selectedScan) {
                setSelectedScan(null);
                setOverlayScans(null);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedScan]);

    // Group scans by sampleId for collapsible display
    const groupedData = useMemo(() => {
        const groups = {};
        spectraList.forEach(scan => {
            const key = scan.sampleId || scan.id; // ungrouped scans use their own id
            if (!groups[key]) {
                groups[key] = {
                    sampleId: scan.sampleId,
                    labId: scan.labId,
                    scans: []
                };
            }
            groups[key].scans.push(scan);
        });
        return Object.values(groups).map(g => {
            const nirCount = g.scans.filter(s => s.modality === 'NIR').length;
            const mirCount = g.scans.filter(s => s.modality === 'MIR').length;
            const latestDate = g.scans.reduce((latest, s) => {
                const d = s.metadata?.scanDate || s.timestamp;
                return d > latest ? d : latest;
            }, '');
            const statuses = [...new Set(g.scans.map(s => s.status))];
            return { ...g, nirCount, mirCount, latestDate, statuses, scanCount: g.scans.length };
        });
    }, [spectraList]);

    const toggleGroup = (key) => {
        setExpandedGroups(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    const isManager = ['SUPER_ADMIN', 'LAB_MANAGER'].includes(user?.role);
    const isTrashView = filters.status === 'DELETED';

    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(50);
    const [totalRecords, setTotalRecords] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [serverStats, setServerStats] = useState(null);

    const fetchStats = useCallback(async () => {
        try {
            const res = await axios.get('/api/spectral/stats');
            if (res.data?.data) {
                setServerStats(res.data.data);
            }
        } catch (e) {
            console.error("Failed to load spectral stats:", e);
        }
    }, []);

    // Stats: use serverStats if available, otherwise compute from loaded list
    const stats = useMemo(() => {
        if (serverStats) return serverStats;
        const total = spectraList.length;
        const nir = spectraList.filter(s => s.modality === 'NIR').length;
        const mir = spectraList.filter(s => s.modality === 'MIR').length;
        const pending = spectraList.filter(s => s.status === 'PENDING').length;
        const validated = spectraList.filter(s => s.status === 'VALIDATED').length;
        const approved = spectraList.filter(s => s.status === 'APPROVED').length;
        const rejected = spectraList.filter(s => s.status === 'REJECTED').length;
        return { total, nir, mir, pending, validated, approved, rejected };
    }, [serverStats, spectraList]);

    const fetchLibrary = useCallback(async () => {
        setLoading(true);
        setSelectedIds(new Set());
        try {
            const res = await axios.get('/api/spectral', { params: { ...filters, page, limit: pageSize } });
            setSpectraList(res.data.data || []);
            setTotalRecords(res.data.total !== undefined ? res.data.total : (res.data.data ? res.data.data.length : 0));
            setTotalPages(res.data.totalPages || 1);
        } catch (e) {
            console.error(e);
            showDialog({ type: 'error', title: 'Error', message: 'Failed to load spectral library' });
        } finally {
            setLoading(false);
        }
    }, [filters, page, pageSize]);

    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    useEffect(() => {
        setPage(1);
    }, [filters]);

    // Soft delete (move to trash)
    const handleDelete = async (scanId, labId) => {
        showDialog({
            type: 'confirm',
            title: 'Move to Trash',
            message: `Move spectrum for ${labId} to trash? You can restore it later from the Trash view.`,
            onConfirm: async () => {
                try {
                    await axios.delete(`/api/spectral/${scanId}`);
                    setSpectraList(prev => prev.filter(s => s.id !== scanId));
                    showDialog({ type: 'success', title: 'Moved to Trash', message: 'Spectrum moved to trash. Restore from the Trash view if needed.' });
                } catch (e) {
                    console.error(e);
                    showDialog({ type: 'error', title: 'Error', message: e.response?.data?.error || e.message });
                }
            }
        });
    };

    // Restore from trash
    const handleRestore = async (scanId, labId) => {
        try {
            await axios.post(`/api/spectral/${scanId}/restore`);
            setSpectraList(prev => prev.filter(s => s.id !== scanId));
            showDialog({ type: 'success', title: 'Restored', message: `Spectrum for ${labId} restored successfully.` });
        } catch (e) {
            showDialog({ type: 'error', title: 'Error', message: e.response?.data?.error || e.message });
        }
    };

    // Permanent delete
    const handlePermanentDelete = async (scanId, labId) => {
        showDialog({
            type: 'confirm',
            title: 'Permanently Delete',
            message: `Permanently delete spectrum for ${labId}? This cannot be undone.`,
            onConfirm: async () => {
                try {
                    await axios.delete(`/api/spectral/${scanId}/permanent`);
                    setSpectraList(prev => prev.filter(s => s.id !== scanId));
                    showDialog({ type: 'success', title: 'Deleted', message: 'Spectrum permanently deleted.' });
                } catch (e) {
                    showDialog({ type: 'error', title: 'Error', message: e.response?.data?.error || e.message });
                }
            }
        });
    };

    // Single review (approve/reject/undo)
    const handleReview = async (scanId, action, labId) => {
        if (action === 'UNDO') {
            try {
                await axios.post(`/api/spectral/${scanId}/review`, { action: 'UNDO' });
                fetchLibrary();
                showDialog({ type: 'success', title: 'Undone', message: `Rejection of ${labId} undone. Returned to Awaiting Review.` });
            } catch (e) {
                showDialog({ type: 'error', title: 'Error', message: e.response?.data?.error || e.message });
            }
            return;
        }

        const actionText = action === 'APPROVE' ? 'approve' : 'reject';
        showDialog({
            type: 'confirm',
            title: `${action === 'APPROVE' ? 'Approve' : 'Reject'} Spectrum`,
            message: `Are you sure you want to ${actionText} the spectrum for ${labId}?${action === 'APPROVE' ? ' This will mark the work item as COMPLETED.' : ''}`,
            onConfirm: async () => {
                try {
                    await axios.post(`/api/spectral/${scanId}/review`, { action });
                    fetchLibrary();
                    showDialog({ type: 'success', title: 'Success', message: `Spectrum ${actionText}d successfully.` });
                } catch (e) {
                    console.error(e);
                    showDialog({ type: 'error', title: 'Error', message: e.response?.data?.error || e.message });
                }
            }
        });
    };

    // Batch approve
    const handleBatchApprove = async () => {
        if (selectedIds.size === 0) return;
        showDialog({
            type: 'confirm',
            title: 'Batch Approve',
            message: `Approve ${selectedIds.size} selected spectra? This will mark their associated work items as COMPLETED.`,
            onConfirm: async () => {
                setBatchLoading(true);
                try {
                    const res = await axios.post('/api/spectral/batch-review', {
                        ids: Array.from(selectedIds),
                        action: 'APPROVE'
                    });
                    setSelectedIds(new Set());
                    fetchLibrary();
                    showDialog({ type: 'success', title: 'Batch Approve Complete', message: res.data.message });
                } catch (e) {
                    showDialog({ type: 'error', title: 'Error', message: e.response?.data?.error || e.message });
                } finally {
                    setBatchLoading(false);
                }
            }
        });
    };

    // Batch delete (move to trash)
    const handleBatchDelete = async () => {
        if (selectedIds.size === 0) return;
        showDialog({
            type: 'confirm',
            title: 'Batch Delete',
            message: `Move ${selectedIds.size} selected spectra to trash? You can restore them later from the Trash tab.`,
            onConfirm: async () => {
                setBatchLoading(true);
                try {
                    const res = await axios.post('/api/spectral/batch-delete', {
                        ids: Array.from(selectedIds)
                    });
                    setSelectedIds(new Set());
                    fetchLibrary();
                    showDialog({ type: 'success', title: 'Batch Delete Complete', message: res.data.message });
                } catch (e) {
                    showDialog({ type: 'error', title: 'Error', message: e.response?.data?.error || e.message });
                } finally {
                    setBatchLoading(false);
                }
            }
        });
    };

    useEffect(() => {
        fetchLibrary();
    }, [filters]);

    // Real-time: auto-refresh on SPECTRAL_UPDATE or WORKITEM_CHANGED events
    const { subscribeToEvent } = useNotifications();
    useEffect(() => {
        if (!subscribeToEvent) return;
        let debounceTimer = null;
        const debouncedRefresh = () => {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => fetchLibrary(), 500);
        };
        const unsubs = [
            subscribeToEvent('SPECTRAL_UPDATE', debouncedRefresh),
            subscribeToEvent('WORKITEM_CHANGED', debouncedRefresh),
        ];
        return () => {
            if (debounceTimer) clearTimeout(debounceTimer);
            unsubs.forEach(u => u && u());
        };
    }, [subscribeToEvent, fetchLibrary]);

    // Selection helpers
    const toggleSelect = (id) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const reviewableIds = useMemo(() =>
        spectraList.filter(s => ['PENDING', 'VALIDATED'].includes(s.status)).map(s => s.id),
        [spectraList]
    );

    const toggleSelectAll = () => {
        if (selectedIds.size === reviewableIds.length && reviewableIds.length > 0) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(reviewableIds));
        }
    };

    // Viewer
    const [viewerLoading, setViewerLoading] = useState(false);
    const openViewer = async (scanId) => {
        setViewerLoading(true);
        setOverlayScans(null); // Clear overlay when opening single scan
        try {
            const res = await axios.get(`/api/spectral/${scanId}`);
            const chartData = res.data.wavelengths.map((w, i) => ({
                wavelength: w,
                absorbance: res.data.values ? res.data.values[i] : 0
            }));
            setSelectedScan({ ...res.data, chartData });
        } catch (e) {
            showDialog({ type: 'error', title: 'Error', message: 'Failed to load spectral data' });
        } finally {
            setViewerLoading(false);
        }
    };

    // Compare all scans in a group (overlay mode)
    const handleCompareGroup = async (group) => {
        setViewerLoading(true);
        setSelectedScan(null);
        try {
            const scanPromises = group.scans.map(s => axios.get(`/api/spectral/${s.id}`));
            const responses = await Promise.all(scanPromises);
            const loaded = responses.map(res => {
                const d = res.data;
                const chartData = (d.wavelengths || []).map((w, i) => ({
                    wavelength: w,
                    absorbance: d.values ? d.values[i] : 0
                }));
                return {
                    ...d,
                    chartData,
                    metadata: typeof d.metadata === 'string' ? JSON.parse(d.metadata) : d.metadata
                };
            });
            setOverlayScans(loaded);
            // Set a dummy selectedScan to trigger the modal
            setSelectedScan({ _overlay: true, labId: group.labId, modality: loaded[0]?.modality });
        } catch (e) {
            showDialog({ type: 'error', title: 'Error', message: 'Failed to load scans for comparison' });
        } finally {
            setViewerLoading(false);
        }
    };

    const handleDownload = () => {
        if (!selectedScan) return;
        const headers = ["Wavelength,Absorbance"];
        const rows = selectedScan.wavelengths.map((w, i) =>
            `${w},${selectedScan.values ? selectedScan.values[i] : 0}`
        );
        const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `${selectedScan.labId}_${selectedScan.modality}_${selectedScan.id}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const getDisplayLabId = (scan) => scan.labId || scan.sampleId || 'Unknown';
    const getInstrumentDisplay = (scan) => {
        if (scan.metadata?.instrument && scan.metadata.instrument !== 'Unknown') return scan.metadata.instrument;
        if (scan.modality === 'NIR') return 'NIR Spectrometer';
        if (scan.modality === 'MIR') return 'MIR Spectrometer';
        return 'Unknown';
    };
    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        const d = new Date(dateStr);
        return isNaN(d.getTime()) ? '-' : d.toLocaleDateString();
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'PENDING':
                return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"><Clock size={12} />Pending QC</span>;
            case 'VALIDATED':
                return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"><ClipboardCheck size={12} />Awaiting Review</span>;
            case 'APPROVED':
                return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"><Shield size={12} />Approved</span>;
            case 'REJECTED':
                return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"><XCircle size={12} />Rejected</span>;
            case 'DELETED':
                return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-gray-200 text-gray-500 dark:bg-gray-600 dark:text-gray-400"><Trash2 size={12} />Trashed</span>;
            default:
                return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-600">{status || 'Unknown'}</span>;
        }
    };

    // Tooltip wrapper
    const Tip = ({ label, children }) => (
        <div className="relative group/tip">
            {children}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg whitespace-nowrap opacity-0 pointer-events-none group-hover/tip:opacity-100 transition-opacity duration-150 z-50 shadow-lg">
                {label}
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900 dark:border-t-gray-700" />
            </div>
        </div>
    );

    return (
        <div className="p-6 min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
            {/* Premium Header */}
            <div className="mb-8">
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-3xl font-black text-sf-text flex items-center gap-3">
                            <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg shadow-blue-500/25">
                                <Activity className="text-white" size={24} />
                            </div>
                            {t('spectral.title', 'Spectral Library')}
                        </h1>
                        <p className="text-sf-muted mt-1 ml-14">
                            {t('spectral.subtitle', 'Manage and explore Vis-NIR and MIR spectral assets')}
                        </p>
                    </div>

                    {/* Tab Buttons */}
                    <div className="flex gap-2 bg-sf-surface p-1 rounded-xl shadow-sm border border-sf-divider">
                        <button
                            onClick={() => { setActiveTab('EXPLORER'); setFilters(prev => ({ ...prev, status: '' })); }}
                            className={`px-5 py-2.5 rounded-lg font-bold text-sm transition-all flex items-center gap-2 ${activeTab === 'EXPLORER' && !isTrashView
                                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/30'
                                : 'text-sf-muted hover:bg-sf-raised'
                                }`}
                        >
                            <Database size={16} />
                            {t('spectral.explorer', 'Library Explorer')}
                        </button>
                        <button
                            onClick={() => setActiveTab('UPLOAD')}
                            className={`px-5 py-2.5 rounded-lg font-bold text-sm transition-all flex items-center gap-2 ${activeTab === 'UPLOAD'
                                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/30'
                                : 'text-sf-muted hover:bg-sf-raised'
                                }`}
                        >
                            <Upload size={16} />
                            {t('spectral.batchUpload', 'Batch Upload')}
                        </button>
                        {isManager && (
                            <button
                                onClick={() => { setActiveTab('EXPLORER'); setFilters(prev => ({ ...prev, status: 'DELETED' })); }}
                                className={`px-5 py-2.5 rounded-lg font-bold text-sm transition-all flex items-center gap-2 ${isTrashView
                                    ? 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-md shadow-red-500/30'
                                    : 'text-sf-muted hover:bg-sf-raised'
                                    }`}
                            >
                                <Trash2 size={16} />
                                {t('common.trash', 'Trash')}
                            </button>
                        )}
                    </div>
                </div>

                {/* Stats Cards */}
                {!isTrashView && (
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mt-6">
                        <div className="bg-sf-surface rounded-xl p-4 border border-sf-divider shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-sf-raised rounded-lg">
                                    <BarChart3 size={18} className="text-sf-muted" />
                                </div>
                                <div>
                                    <div className="text-2xl font-black text-sf-text">{stats.total}</div>
                                    <div className="text-xs text-gray-500 uppercase tracking-wide">{t('spectral.totalSpectra', 'Total Spectra')}</div>
                                </div>
                            </div>
                        </div>
                        <div className="bg-sf-surface rounded-xl p-4 border border-blue-100 dark:border-blue-900/30 shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                                    <Sparkles size={18} className="text-blue-600" />
                                </div>
                                <div>
                                    <div className="text-2xl font-black text-blue-600">{stats.nir}</div>
                                    <div className="text-xs text-gray-500 uppercase tracking-wide">{t('spectral.nirScans', 'NIR Scans')}</div>
                                </div>
                            </div>
                        </div>
                        <div className="bg-sf-surface rounded-xl p-4 border border-emerald-100 dark:border-emerald-900/30 shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                                    <Sparkles size={18} className="text-emerald-600" />
                                </div>
                                <div>
                                    <div className="text-2xl font-black text-emerald-600">{stats.mir}</div>
                                    <div className="text-xs text-gray-500 uppercase tracking-wide">MIR Scans</div>
                                </div>
                            </div>
                        </div>
                        <div className="bg-sf-surface rounded-xl p-4 border border-sf-divider shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-sf-raised rounded-lg">
                                    <Clock size={18} className="text-gray-600" />
                                </div>
                                <div>
                                    <div className="text-2xl font-black text-gray-600">{stats.pending}</div>
                                    <div className="text-xs text-gray-500 uppercase tracking-wide">Pending</div>
                                </div>
                            </div>
                        </div>
                        <div className="bg-sf-surface rounded-xl p-4 border border-amber-100 dark:border-amber-900/30 shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                                    <ClipboardCheck size={18} className="text-amber-600" />
                                </div>
                                <div>
                                    <div className="text-2xl font-black text-amber-600">{stats.validated}</div>
                                    <div className="text-xs text-gray-500 uppercase tracking-wide">Awaiting Review</div>
                                </div>
                            </div>
                        </div>
                        <div className="bg-sf-surface rounded-xl p-4 border border-green-100 dark:border-green-900/30 shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                                    <CheckCircle size={18} className="text-green-600" />
                                </div>
                                <div>
                                    <div className="text-2xl font-black text-green-600">{stats.approved}</div>
                                    <div className="text-xs text-gray-500 uppercase tracking-wide">Approved</div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* TAB: EXPLORER / TRASH */}
            {activeTab === 'EXPLORER' && (
                <div className="bg-sf-surface rounded-2xl shadow-xl border border-sf-divider overflow-hidden">
                    {/* Trash header */}
                    {isTrashView && (
                        <div className="p-4 bg-red-50 dark:bg-red-900/20 border-b border-red-100 dark:border-red-800 flex items-center gap-3">
                            <Trash2 className="text-red-500" size={20} />
                            <span className="text-sm font-medium text-red-800 dark:text-red-300">
                                Viewing trashed spectra. You can restore or permanently delete items here.
                            </span>
                        </div>
                    )}

                    {/* Toolbar */}
                    <div className="p-4 border-b border-sf-divider flex flex-wrap gap-4 items-center bg-sf-surface">
                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                            <input
                                type="text"
                                placeholder="Search by Lab ID..."
                                value={filters.search}
                                onChange={e => setFilters(prev => ({ ...prev, search: e.target.value }))}
                                className="pl-10 pr-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none w-72 bg-white dark:bg-gray-700 dark:text-white transition-shadow shadow-sm focus:shadow-md"
                            />
                        </div>
                        <select
                            value={filters.modality}
                            onChange={e => setFilters(prev => ({ ...prev, modality: e.target.value }))}
                            className="px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 dark:text-white font-medium shadow-sm"
                        >
                            <option value="">All Modalities</option>
                            <option value="NIR">NIR</option>
                            <option value="MIR">MIR</option>
                        </select>
                        {!isTrashView && (
                            <select
                                value={filters.status}
                                onChange={e => setFilters(prev => ({ ...prev, status: e.target.value }))}
                                className="px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 dark:text-white font-medium shadow-sm"
                            >
                                <option value="">All Workflow Status</option>
                                <option value="PENDING">Pending QC</option>
                                <option value="VALIDATED">Awaiting Review</option>
                                <option value="APPROVED">Approved</option>
                                <option value="REJECTED">Rejected</option>
                            </select>
                        )}
                        <Tip label="Refresh list">
                            <button
                                onClick={fetchLibrary}
                                disabled={loading}
                                className="p-2.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-xl transition-colors"
                            >
                                <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                            </button>
                        </Tip>
                    </div>

                    {/* Batch Action Bar */}
                    {isManager && selectedIds.size > 0 && !isTrashView && (
                        <div className="px-4 py-3 bg-indigo-50 dark:bg-indigo-900/20 border-b border-indigo-100 dark:border-indigo-800 flex items-center gap-4 animate-in slide-in-from-top">
                            <span className="text-sm font-bold text-indigo-700 dark:text-indigo-300">
                                {selectedIds.size} selected
                            </span>
                            <button
                                onClick={handleBatchApprove}
                                disabled={batchLoading}
                                className="px-4 py-1.5 bg-green-600 text-white rounded-lg text-sm font-bold hover:bg-green-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                            >
                                {batchLoading ? <RefreshCw size={14} className="animate-spin" /> : <ThumbsUp size={14} />}
                                Approve All
                            </button>
                            <button
                                onClick={handleBatchDelete}
                                disabled={batchLoading}
                                className="px-4 py-1.5 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                            >
                                {batchLoading ? <RefreshCw size={14} className="animate-spin" /> : <Trash2 size={14} />}
                                Delete Selected
                            </button>
                            <button
                                onClick={() => setSelectedIds(new Set())}
                                className="px-3 py-1.5 text-sf-muted hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors"
                            >
                                Clear
                            </button>
                        </div>
                    )}

                    {/* Manager Alert */}
                    {isManager && stats.validated > 0 && !isTrashView && selectedIds.size === 0 && (
                        <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-100 dark:border-amber-800 flex items-center gap-3">
                            <ClipboardCheck className="text-amber-600" size={20} />
                            <span className="text-sm font-medium text-amber-800 dark:text-amber-300">
                                {stats.validated} spectrum/spectra awaiting your review and approval
                            </span>
                            <button
                                onClick={() => setFilters(prev => ({ ...prev, status: 'VALIDATED' }))}
                                className="ml-auto px-3 py-1 bg-amber-600 text-white rounded-lg text-xs font-bold hover:bg-amber-700 transition-colors"
                            >
                                Review Now
                            </button>
                        </div>
                    )}

                    {/* Table */}
                    <div className="overflow-auto max-h-[55vh]">
                        <table className="w-full text-left">
                            <thead className="bg-sf-canvas/50 sticky top-0 z-10">
                                <tr>
                                    {/* Checkbox column for managers */}
                                    {isManager && !isTrashView && (
                                        <th className="pl-4 pr-2 py-4 border-b border-sf-divider w-10">
                                            <Tip label="Select all reviewable spectra">
                                                <input
                                                    type="checkbox"
                                                    checked={reviewableIds.length > 0 && selectedIds.size === reviewableIds.length}
                                                    onChange={toggleSelectAll}
                                                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                />
                                            </Tip>
                                        </th>
                                    )}
                                    <th className="px-6 py-4 font-bold text-xs text-sf-muted uppercase tracking-wider border-b border-sf-divider">
                                        Sample Lab ID
                                        <InfoTooltip text="The sample's unique laboratory identifier. Linked IDs are clickable." />
                                    </th>
                                    <th className="px-6 py-4 font-bold text-xs text-sf-muted uppercase tracking-wider border-b border-sf-divider">
                                        Modality
                                    </th>
                                    <th className="px-6 py-4 font-bold text-xs text-sf-muted uppercase tracking-wider border-b border-sf-divider">
                                        QC Status
                                        <InfoTooltip text="Quality control result from automated validation checks." />
                                    </th>
                                    <th className="px-6 py-4 font-bold text-xs text-sf-muted uppercase tracking-wider border-b border-sf-divider">
                                        Workflow Status
                                        <InfoTooltip text="PENDING: Needs QC. VALIDATED: QC passed, awaiting manager approval. APPROVED: Ready for use. REJECTED: Manager rejected (can be undone)." />
                                    </th>
                                    <th className="px-6 py-4 font-bold text-xs text-sf-muted uppercase tracking-wider border-b border-sf-divider">
                                        Date
                                    </th>
                                    <th className="px-6 py-4 font-bold text-xs text-sf-muted uppercase tracking-wider border-b border-sf-divider text-right">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                                {loading ? (
                                    <tr>
                                        <td colSpan={isManager && !isTrashView ? 7 : 6} className="p-12 text-center">
                                            <div className="flex flex-col items-center gap-3">
                                                <RefreshCw size={32} className="text-blue-500 animate-spin" />
                                                <span className="text-gray-500">{isTrashView ? 'Loading trash...' : 'Loading spectra...'}</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : spectraList.length === 0 ? (
                                    <tr>
                                        <td colSpan={isManager && !isTrashView ? 7 : 6} className="p-12 text-center">
                                            <div className="flex flex-col items-center gap-3">
                                                {isTrashView ? (
                                                    <>
                                                        <Trash2 size={48} className="text-gray-300" />
                                                        <span className="text-gray-500 font-medium">Trash is empty</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Database size={48} className="text-gray-300" />
                                                        <span className="text-gray-500 font-medium">No spectral records found</span>
                                                        <button
                                                            onClick={() => setActiveTab('UPLOAD')}
                                                            className="text-blue-600 hover:underline text-sm font-bold"
                                                        >
                                                            Upload your first spectra →
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    groupedData.map(group => {
                                        const groupKey = group.sampleId || group.scans[0]?.id;
                                        const isExpanded = expandedGroups.has(groupKey);
                                        const isSingleScan = group.scanCount === 1;
                                        const hasLinkedSample = !!group.sampleId;

                                        // For single-scan groups, render flat (no expand/collapse)
                                        const renderScanRow = (scan, indent = false) => {
                                            const isReviewable = ['PENDING', 'VALIDATED'].includes(scan.status);
                                            return (
                                                <tr key={scan.id} className={`hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors group ${scan.status === 'VALIDATED' ? 'bg-amber-50/30 dark:bg-amber-900/10' : ''} ${scan.status === 'REJECTED' ? 'bg-red-50/20 dark:bg-red-900/5' : ''}`}>
                                                    {isManager && !isTrashView && (
                                                        <td className="pl-4 pr-2 py-4">
                                                            {isReviewable ? (
                                                                <input
                                                                    type="checkbox"
                                                                    checked={selectedIds.has(scan.id)}
                                                                    onChange={() => toggleSelect(scan.id)}
                                                                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                                />
                                                            ) : (
                                                                <div className="w-4 h-4" />
                                                            )}
                                                        </td>
                                                    )}
                                                    <td className={`px-6 py-4 ${indent ? 'pl-14' : ''}`}>
                                                        {indent ? (
                                                            <span className="text-xs text-sf-muted font-mono">
                                                                v{scan.metadata?.scanVersion || '1'} — {scan.filename}
                                                            </span>
                                                        ) : hasLinkedSample ? (
                                                            <a
                                                                href={`/samples/${scan.sampleId}`}
                                                                className="font-mono font-bold text-blue-600 hover:text-blue-800 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
                                                                title={`View sample ${scan.sampleId}`}
                                                            >
                                                                {getDisplayLabId(scan)}
                                                            </a>
                                                        ) : (
                                                            <Tip label="Not linked to a sample record">
                                                                <span className="font-mono font-bold text-sf-muted flex items-center gap-1.5">
                                                                    {getDisplayLabId(scan)}
                                                                    <AlertTriangle size={13} className="text-amber-500" />
                                                                </span>
                                                            </Tip>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black ${scan.modality === 'NIR'
                                                            ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-sm'
                                                            : 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-sm'
                                                            }`}>
                                                            <Sparkles size={12} />
                                                            {scan.modality}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-2">
                                                            {scan.qcStatus === 'PASS' && (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                                                    <CheckCircle size={12} />PASS
                                                                </span>
                                                            )}
                                                            {scan.qcStatus === 'WARN' && (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                                                    <AlertTriangle size={12} />WARN
                                                                </span>
                                                            )}
                                                            {scan.qcStatus === 'FAIL' && (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                                                                    <XCircle size={12} />FAIL
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        {getStatusBadge(scan.status)}
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-sf-muted">
                                                        {formatDate(scan.metadata?.scanDate || scan.timestamp)}
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <div className="flex justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                                                            {isTrashView ? (
                                                                <>
                                                                    <Tip label="Restore spectrum">
                                                                        <button onClick={() => handleRestore(scan.id, getDisplayLabId(scan))} className="p-2 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 text-green-600 transition-colors">
                                                                            <RotateCcw size={18} />
                                                                        </button>
                                                                    </Tip>
                                                                    <Tip label="Permanently delete">
                                                                        <button onClick={() => handlePermanentDelete(scan.id, getDisplayLabId(scan))} className="p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 transition-colors">
                                                                            <AlertOctagon size={18} />
                                                                        </button>
                                                                    </Tip>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <Tip label="View spectrum chart">
                                                                        <button onClick={() => openViewer(scan.id)} className="p-2 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600 transition-colors">
                                                                            <Eye size={18} />
                                                                        </button>
                                                                    </Tip>
                                                                    {isManager && isReviewable && (
                                                                        <>
                                                                            <Tip label="Approve spectrum">
                                                                                <button onClick={() => handleReview(scan.id, 'APPROVE', getDisplayLabId(scan))} className="p-2 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 text-green-600 transition-colors">
                                                                                    <ThumbsUp size={18} />
                                                                                </button>
                                                                            </Tip>
                                                                            <Tip label="Reject spectrum">
                                                                                <button onClick={() => handleReview(scan.id, 'REJECT', getDisplayLabId(scan))} className="p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 transition-colors">
                                                                                    <ThumbsDown size={18} />
                                                                                </button>
                                                                            </Tip>
                                                                        </>
                                                                    )}
                                                                    {isManager && scan.status === 'REJECTED' && (
                                                                        <Tip label="Undo rejection">
                                                                            <button onClick={() => handleReview(scan.id, 'UNDO', getDisplayLabId(scan))} className="p-2 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/30 text-amber-600 transition-colors">
                                                                                <Undo2 size={18} />
                                                                            </button>
                                                                        </Tip>
                                                                    )}
                                                                    {isManager && (
                                                                        <Tip label="Move to trash">
                                                                            <button onClick={() => handleDelete(scan.id, getDisplayLabId(scan))} className="p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 transition-colors">
                                                                                <Trash size={18} />
                                                                            </button>
                                                                        </Tip>
                                                                    )}
                                                                </>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        };

                                        // Single-scan group: render flat row (no header)
                                        if (isSingleScan) {
                                            return renderScanRow(group.scans[0]);
                                        }

                                        // Multi-scan group: collapsible header + child rows
                                        return (
                                            <React.Fragment key={groupKey}>
                                                {/* Group Header Row */}
                                                <tr
                                                    className="bg-indigo-50/50 dark:bg-indigo-900/10 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 cursor-pointer transition-colors border-t border-indigo-100 dark:border-indigo-800/30"
                                                    onClick={() => toggleGroup(groupKey)}
                                                >
                                                    {isManager && !isTrashView && <td className="pl-4 pr-2 py-3"><div className="w-4 h-4" /></td>}
                                                    <td className="px-6 py-3">
                                                        <div className="flex items-center gap-2">
                                                            {isExpanded
                                                                ? <ChevronDown size={16} className="text-indigo-500" />
                                                                : <ChevronRight size={16} className="text-indigo-400" />
                                                            }
                                                            {hasLinkedSample ? (
                                                                <a
                                                                    href={`/samples/${group.sampleId}`}
                                                                    className="font-mono font-bold text-blue-600 hover:text-blue-800 hover:underline dark:text-blue-400"
                                                                    onClick={e => e.stopPropagation()}
                                                                >
                                                                    {group.labId}
                                                                </a>
                                                            ) : (
                                                                <span className="font-mono font-bold text-gray-600 dark:text-gray-300">{group.labId}</span>
                                                            )}
                                                            <span className="text-xs text-gray-400 font-medium">
                                                                ({group.scanCount} scans)
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-3">
                                                        <div className="flex items-center gap-1.5">
                                                            {group.nirCount > 0 && (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                                                    {group.nirCount} NIR
                                                                </span>
                                                            )}
                                                            {group.mirCount > 0 && (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                                                                    {group.mirCount} MIR
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-3">
                                                        <span className="text-xs text-gray-400">—</span>
                                                    </td>
                                                    <td className="px-6 py-3">
                                                        <div className="flex items-center gap-1">
                                                            {group.statuses.map(st => (
                                                                <span key={st}>{getStatusBadge(st)}</span>
                                                            ))}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-3 text-sm text-sf-muted">
                                                        {formatDate(group.latestDate)}
                                                    </td>
                                                    <td className="px-6 py-3 text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            {group.scanCount > 1 && (
                                                                <Tip label="Overlay all scans">
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); handleCompareGroup(group); }}
                                                                        className="px-3 py-1 rounded-lg text-xs font-bold bg-indigo-100 text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400 dark:hover:bg-indigo-900/50 transition-colors flex items-center gap-1.5"
                                                                    >
                                                                        <BarChart3 size={13} />
                                                                        Compare
                                                                    </button>
                                                                </Tip>
                                                            )}
                                                            <span className="text-xs text-indigo-400 font-medium">
                                                                {isExpanded ? 'Collapse' : 'Expand'}
                                                            </span>
                                                        </div>
                                                    </td>
                                                </tr>
                                                {/* Child Scan Rows */}
                                                {isExpanded && group.scans.map(scan => renderScanRow(scan, true))}
                                            </React.Fragment>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                    {/* Pagination Bar (SL-04) */}
                    <div className="px-6 py-4 bg-sf-canvas/50 border-t border-sf-divider flex flex-wrap items-center justify-between gap-4 text-xs text-sf-muted">
                        <div className="flex items-center gap-2">
                            <span>Showing {spectraList.length} of {totalRecords} scans</span>
                            <span className="text-gray-300 dark:text-gray-600">|</span>
                            <span>Per page:</span>
                            <select
                                value={pageSize}
                                onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
                                className="bg-white dark:bg-gray-700 border border-sf-divider rounded px-2 py-1 text-xs"
                            >
                                <option value={25}>25</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                                <option value={200}>200</option>
                            </select>
                        </div>
                        <div className="flex items-center gap-2">
                            <span>Page {page} of {totalPages}</span>
                            <button
                                disabled={page <= 1 || loading}
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                className="px-3 py-1 rounded bg-white dark:bg-gray-700 border border-sf-divider disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-gray-600 font-medium"
                            >
                                Previous
                            </button>
                            <button
                                disabled={page >= totalPages || loading}
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                className="px-3 py-1 rounded bg-white dark:bg-gray-700 border border-sf-divider disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-gray-600 font-medium"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB: UPLOAD */}
            {activeTab === 'UPLOAD' && (
                <div className="bg-sf-surface rounded-2xl shadow-xl border border-sf-divider p-8 flex justify-center items-center min-h-[500px]">
                    <div className="w-full max-w-2xl">
                        <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
                            <p className="text-amber-800 dark:text-amber-300 text-sm flex items-center gap-2">
                                <ClipboardCheck size={18} />
                                <strong>Note:</strong> Uploaded spectra will require manager approval before being registered in the library.
                            </p>
                        </div>
                        <SpectraBatchUpload
                            onUploadSuccess={() => {
                                setActiveTab('EXPLORER');
                                fetchLibrary();
                                showDialog({ type: 'success', title: 'Success', message: 'Spectra uploaded successfully! They are now awaiting manager review.' });
                            }}
                            onClose={() => setActiveTab('EXPLORER')}
                        />
                    </div>
                </div>
            )}

            {/* VIEWER MODAL */}
            {selectedScan && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-sf-surface rounded-2xl shadow-2xl w-full max-w-6xl h-[85vh] flex flex-col overflow-hidden border border-sf-divider">
                        {/* Modal Header */}
                        <div className="px-6 py-4 border-b border-sf-divider flex justify-between items-center bg-sf-surface">
                            <div className="flex items-center gap-4">
                                <div>
                                    <h2 className="text-xl font-black text-sf-text flex items-center gap-3">
                                        <span className={`px-3 py-1 rounded-lg text-sm ${selectedScan.modality === 'NIR' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'
                                            }`}>{selectedScan.modality}</span>
                                        {selectedScan.labId}
                                    </h2>
                                    <p className="text-xs text-sf-muted mt-1 font-mono">{selectedScan.id}</p>
                                </div>
                                {getStatusBadge(selectedScan.status)}
                            </div>
                            <div className="flex gap-2">
                                <Tip label="Download CSV">
                                    <button onClick={handleDownload} className="p-2.5 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-xl text-blue-600 transition-colors">
                                        <Download size={20} />
                                    </button>
                                </Tip>
                                <button onClick={() => { setSelectedScan(null); setOverlayScans(null); }} className="p-2.5 hover:bg-sf-raised rounded-xl text-gray-500 transition-colors">
                                    <XCircle size={24} />
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 flex overflow-hidden">
                            {/* Chart Area */}
                            <div className={`flex-1 p-6 overflow-hidden flex flex-col bg-sf-canvas ${overlayScans ? '' : ''}`}>
                                <SpectraViewer data={selectedScan} overlayData={overlayScans} />
                            </div>

                            {/* Sidebar Info - hidden in overlay mode */}
                            {!overlayScans && (
                                <div className="w-80 border-l border-sf-divider bg-sf-surface p-6 overflow-y-auto">
                                    <h3 className="font-bold text-sf-muted mb-4 flex items-center gap-2 text-sm uppercase tracking-wider">
                                        <FileText size={16} /> Metadata
                                    </h3>
                                    <div className="space-y-4 text-sm">
                                        <div className="p-3 bg-sf-canvas/50 rounded-xl">
                                            <label className="text-xs text-gray-400 uppercase flex items-center gap-1"><Cpu size={12} /> Instrument</label>
                                            <div className="font-bold text-sf-text mt-1">{getInstrumentDisplay(selectedScan)}</div>
                                        </div>
                                        <div className="p-3 bg-sf-canvas/50 rounded-xl">
                                            <label className="text-xs text-gray-400 uppercase flex items-center gap-1"><Calendar size={12} /> Scan Date</label>
                                            <div className="font-bold text-sf-text mt-1">{formatDate(selectedScan.metadata?.scanDate || selectedScan.timestamp)}</div>
                                        </div>
                                        <div className="p-3 bg-sf-canvas/50 rounded-xl">
                                            <label className="text-xs text-gray-400 uppercase flex items-center gap-1"><User size={12} /> Operator</label>
                                            <div className="font-bold text-sf-text mt-1">{selectedScan.metadata?.operator || selectedScan.uploadedBy || 'System'}</div>
                                        </div>

                                        <hr className="border-sf-divider" />

                                        <h3 className="font-bold text-sf-muted flex items-center gap-2 text-sm uppercase tracking-wider">
                                            <CheckCircle size={16} /> QC Report
                                        </h3>
                                        <div className={`p-4 rounded-xl border ${selectedScan.qcStatus === 'PASS' ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800' :
                                            selectedScan.qcStatus === 'WARN' ? 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800' :
                                                'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
                                            }`}>
                                            <div className={`font-black text-lg mb-2 flex items-center gap-2 ${selectedScan.qcStatus === 'PASS' ? 'text-green-700 dark:text-green-400' :
                                                selectedScan.qcStatus === 'WARN' ? 'text-amber-700 dark:text-amber-400' :
                                                    'text-red-700 dark:text-red-400'
                                                }`}>
                                                {selectedScan.qcStatus === 'PASS' && <CheckCircle size={20} />}
                                                {selectedScan.qcStatus === 'WARN' && <AlertTriangle size={20} />}
                                                {selectedScan.qcStatus === 'FAIL' && <XCircle size={20} />}
                                                {selectedScan.qcStatus}
                                            </div>
                                            {selectedScan.qcFlags && selectedScan.qcFlags.length > 0 ? (
                                                <ul className="list-disc pl-4 text-xs space-y-1">
                                                    {selectedScan.qcFlags.map(f => <li key={f} className="text-sf-muted">{f}</li>)}
                                                </ul>
                                            ) : (
                                                <div className="text-xs text-green-600 dark:text-green-400">✓ All quality checks passed</div>
                                            )}
                                        </div>

                                        {/* Approval section */}
                                        {selectedScan.reviewedBy && (
                                            <>
                                                <hr className="border-sf-divider" />
                                                <h3 className="font-bold text-sf-muted flex items-center gap-2 text-sm uppercase tracking-wider">
                                                    <Shield size={16} /> Manager Review
                                                </h3>
                                                <div className="p-3 bg-sf-canvas/50 rounded-xl">
                                                    <div className="text-xs text-gray-400 uppercase">Reviewed By</div>
                                                    <div className="font-bold text-sf-text mt-1">{selectedScan.reviewedBy}</div>
                                                    <div className="text-xs text-gray-500 mt-1">{formatDate(selectedScan.reviewedAt)}</div>
                                                </div>
                                            </>
                                        )}

                                        {/* Manager review buttons in modal */}
                                        {isManager && ['PENDING', 'VALIDATED'].includes(selectedScan.status) && (
                                            <div className="flex gap-2 pt-4">
                                                <button
                                                    onClick={() => { handleReview(selectedScan.id, 'APPROVE', getDisplayLabId(selectedScan)); setSelectedScan(null); }}
                                                    className="flex-1 py-2 bg-green-600 text-white rounded-lg font-bold text-sm hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                                                >
                                                    <ThumbsUp size={16} /> Approve
                                                </button>
                                                <button
                                                    onClick={() => { handleReview(selectedScan.id, 'REJECT', getDisplayLabId(selectedScan)); setSelectedScan(null); }}
                                                    className="flex-1 py-2 bg-red-600 text-white rounded-lg font-bold text-sm hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
                                                >
                                                    <ThumbsDown size={16} /> Reject
                                                </button>
                                            </div>
                                        )}

                                        {/* Undo reject button in modal */}
                                        {isManager && selectedScan.status === 'REJECTED' && (
                                            <div className="pt-4">
                                                <button
                                                    onClick={() => { handleReview(selectedScan.id, 'UNDO', getDisplayLabId(selectedScan)); setSelectedScan(null); }}
                                                    className="w-full py-2 bg-amber-500 text-white rounded-lg font-bold text-sm hover:bg-amber-600 transition-colors flex items-center justify-center gap-2"
                                                >
                                                    <Undo2 size={16} /> Undo Rejection
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SpectralLibrary;
