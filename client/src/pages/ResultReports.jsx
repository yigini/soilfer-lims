import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useDialog } from '../context/DialogContext';
import { useLanguage } from '../context/LanguageContext';
import ReportContent from '../components/report/ReportContent';
import {
    FileText, Search, Share2, Download, ExternalLink, Copy, XCircle,
    ChevronLeft, ChevronRight, Clock, User, Shield, Link2, LinkIcon,
    Eye, Trash2, Plus, Printer
} from 'lucide-react';

const ResultReports = ({
    initialReports = null,
    initialPagination = null,
    initialQuery = '',
    initialStatus = null
} = {}) => {
    const { user } = useAuth();
    const { showDialog } = useDialog();
    const { t } = useLanguage();
    const [searchParams] = useSearchParams();
    const paramReportId = searchParams.get('reportId');
    const paramProjectId = searchParams.get('projectId');
    const paramStatus = searchParams.get('status');
    const paramQuery = searchParams.get('q') || searchParams.get('query') || '';

    const defaultStatus = initialStatus || paramStatus || 'PUBLISHED';
    const defaultQuery = initialQuery || paramQuery || '';

    const [reports, setReports] = useState(initialReports || []);
    const [loading, setLoading] = useState(false);
    const [query, setQuery] = useState(defaultQuery);
    const [appliedQuery, setAppliedQuery] = useState(defaultQuery);
    const [statusFilter, setStatusFilter] = useState(defaultStatus);
    const [pagination, setPagination] = useState(initialPagination || { total: initialReports ? initialReports.length : 0, page: 1, pages: 1, limit: 25 });
    const [selectedReport, setSelectedReport] = useState(null);
    const [shareModal, setShareModal] = useState(null); // reportId for share dialog
    const [shareLinks, setShareLinks] = useState([]);
    const [shareLoading, setShareLoading] = useState(false);
    const [expiryDays, setExpiryDays] = useState(30);

    const requestIdRef = useRef(0);
    const abortControllerRef = useRef(null);
    const appliedQueryRef = useRef(appliedQuery);
    appliedQueryRef.current = appliedQuery;
    const statusFilterRef = useRef(statusFilter);
    statusFilterRef.current = statusFilter;

    // Escape key listener for active modals
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                if (shareModal) setShareModal(null);
                else if (selectedReport) setSelectedReport(null);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [shareModal, selectedReport]);

    const isManager = ['SUPER_ADMIN', 'MASTER_USER', 'LAB_MANAGER'].includes(user?.role);
    const canGenerate = ['SUPER_ADMIN', 'MASTER_USER', 'LAB_MANAGER', 'SAMPLE_RECEPTION'].includes(user?.role);

    // ─── Search & Fetch ──────────────────────────────────

    const fetchReports = useCallback(async (
        page = 1,
        search = appliedQueryRef.current,
        currentStatus = statusFilterRef.current
    ) => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        const controller = new AbortController();
        abortControllerRef.current = controller;
        const requestId = ++requestIdRef.current;

        setLoading(true);
        try {
            const params = {
                q: typeof search === 'string' ? search.trim() : '',
                page,
                limit: pagination.limit
            };
            if (paramProjectId) params.projectId = paramProjectId;
            if (currentStatus) params.status = currentStatus;

            const res = await axios.get('/api/reports/search', {
                params,
                signal: controller.signal
            });

            // Discard stale responses if a newer request was dispatched
            if (requestId !== requestIdRef.current) {
                return;
            }

            setReports(res.data.reports || []);
            setPagination(res.data.pagination || { total: 0, page: 1, pages: 1, limit: 25 });
        } catch (e) {
            if (axios.isCancel(e) || e.name === 'CanceledError' || e.name === 'AbortError') {
                return;
            }
            if (requestId === requestIdRef.current) {
                console.error('Report search failed:', e);
            }
        } finally {
            if (requestId === requestIdRef.current) {
                setLoading(false);
            }
        }
    }, [paramProjectId]);

    // Initial mount and project scope synchronization effect
    useEffect(() => {
        if (!initialReports) {
            fetchReports(1, appliedQueryRef.current, statusFilterRef.current);
        }
        return () => {
            abortControllerRef.current?.abort();
        };
    }, [fetchReports, initialReports]);

    // Load exact report if reportId is passed in URL
    useEffect(() => {
        if (paramReportId) {
            axios.get(`/api/reports/${paramReportId}`)
                .then(res => {
                    if (res.data) setSelectedReport(res.data);
                })
                .catch(err => console.error('Failed to load report from param:', err));
        }
    }, [paramReportId]);

    const handleSearch = (e) => {
        if (e) e.preventDefault();
        const trimmed = query.trim();
        setAppliedQuery(trimmed);
        fetchReports(1, trimmed, statusFilter);
    };

    const handleClearSearch = () => {
        setQuery('');
        setAppliedQuery('');
        fetchReports(1, '', statusFilter);
    };

    const handleStatusFilterChange = (newStatus) => {
        if (statusFilter === newStatus) return;
        setStatusFilter(newStatus);
        fetchReports(1, appliedQuery, newStatus);
    };

    const handlePageChange = (newPage) => {
        fetchReports(newPage, appliedQuery, statusFilter);
    };

    // ─── Share Link Management ───────────────────────────

    const openShareModal = async (reportId) => {
        setShareModal(reportId);
        setShareLoading(true);
        try {
            const res = await axios.get(`/api/reports/${reportId}/links`);
            setShareLinks(res.data || []);
        } catch (e) {
            setShareLinks([]);
        } finally {
            setShareLoading(false);
        }
    };

    const createShareLink = async () => {
        if (!shareModal) return;
        setShareLoading(true);
        try {
            const res = await axios.post(`/api/reports/${shareModal}/share`, { expiresInDays: expiryDays });
            // Copy to clipboard
            if (res.data.publicUrl) {
                await navigator.clipboard.writeText(res.data.publicUrl);
                showDialog({ type: 'success', title: 'Link Created', message: `Public link copied to clipboard!\n\nExpires: ${res.data.expiresAt ? new Date(res.data.expiresAt).toLocaleDateString() : 'Never'}` });
            }
            // Refresh links
            const linksRes = await axios.get(`/api/reports/${shareModal}/links`);
            setShareLinks(linksRes.data || []);
        } catch (e) {
            showDialog({ type: 'error', title: 'Error', message: e.response?.data?.error || 'Failed to create share link' });
        } finally {
            setShareLoading(false);
        }
    };

    const revokeLink = async (linkId) => {
        try {
            await axios.post(`/api/reports/links/${linkId}/revoke`);
            showDialog({ type: 'success', title: 'Revoked', message: 'Share link has been revoked' });
            const linksRes = await axios.get(`/api/reports/${shareModal}/links`);
            setShareLinks(linksRes.data || []);
        } catch (e) {
            showDialog({ type: 'error', title: 'Error', message: 'Failed to revoke link' });
        }
    };

    // ─── View Report ─────────────────────────────────────

    const viewReport = async (reportId) => {
        try {
            const res = await axios.get(`/api/reports/${reportId}`);
            setSelectedReport(res.data);
        } catch (e) {
            showDialog({ type: 'error', title: 'Error', message: 'Failed to load report' });
        }
    };

    // ─── Helpers ─────────────────────────────────────────

    const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

    const getClientName = (r) => {
        const parts = [r.firstName, r.surname].filter(Boolean);
        return parts.length > 0 ? parts.join(' ') : '—';
    };

    // ─── RENDER ──────────────────────────────────────────

    return (
        <div className="p-6 lg:p-8 h-full bg-sf-canvas overflow-y-auto" data-tour="result-reports-container">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-black text-sf-text flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                        <FileText size={20} className="text-white" />
                    </div>
                    {t('resultReports.title', 'Result Reports')}
                </h1>
                <span className="text-sm text-sf-muted">
                    {t('resultReports.reportsFound', `${pagination.total} reports found`, { count: pagination.total })}
                </span>
            </div>

            {/* Status Filter & Search Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                <form onSubmit={handleSearch} className="flex-1 max-w-2xl">
                    <div className="relative">
                        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            placeholder={t('resultReports.searchPlaceholder', 'Search by name, phone, project, sample ID, or lab ID...')}
                            className="w-full pl-12 pr-28 py-3 bg-sf-surface border border-sf-divider rounded-xl shadow-sm focus:ring-2 focus:ring-sf-emerald focus:border-sf-emerald outline-none text-sm"
                        />
                        {query && (
                            <button
                                type="button"
                                onClick={handleClearSearch}
                                className="absolute right-24 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1 rounded-full transition-colors"
                                title={t('common.clear', 'Clear')}
                                aria-label="Clear search"
                            >
                                <XCircle size={16} />
                            </button>
                        )}
                        <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-1.5 bg-sf-emerald text-white rounded-lg text-sm font-bold hover:bg-sf-emerald-hover transition-colors">
                            {t('common.search', 'Search')}
                        </button>
                    </div>
                </form>

                {/* Status Filter Pills */}
                <div className="flex items-center gap-1.5">
                    {[
                        { id: 'PUBLISHED', label: t('resultReports.filterPublished', 'Published') },
                        { id: 'SUPERSEDED', label: t('resultReports.filterSuperseded', 'Superseded') },
                        { id: 'ALL', label: t('resultReports.filterAll', 'All Versions') }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => handleStatusFilterChange(tab.id)}
                            className={`px-3 py-2 rounded-xl text-xs font-semibold transition-colors border ${
                                statusFilter === tab.id
                                    ? 'bg-sf-emerald text-white border-sf-emerald shadow-sm'
                                    : 'bg-sf-surface text-sf-muted hover:bg-sf-hover border-sf-divider'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Results Table */}
            <div className="bg-sf-surface rounded-2xl shadow-xl border border-sf-divider overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center py-20 text-gray-400">
                        <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-500 border-t-transparent mr-3" />
                        {t('resultReports.searchingReports', 'Searching reports...')}
                    </div>
                ) : reports.length === 0 ? (
                    <div className="text-center py-20 text-gray-400">
                        <FileText size={40} className="mx-auto mb-3 opacity-30" />
                        <p className="font-bold">{t('resultReports.noReportsFound', 'No reports found')}</p>
                        <p className="text-sm mt-1">{t('resultReports.noReportsHint', 'Try a different search term or generate new reports from the Samples page.')}</p>
                    </div>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-sf-canvas/50 border-b border-sf-divider text-xs uppercase text-sf-muted tracking-wider">
                                    <tr>
                                        <th className="px-6 py-3">{t('resultReports.colSampleLabId', 'Sample / Lab ID')}</th>
                                        <th className="px-6 py-3">{t('resultReports.colClient', 'Client')}</th>
                                        <th className="px-6 py-3">{t('resultReports.colProject', 'Project')}</th>
                                        <th className="px-6 py-3">{t('resultReports.colVersion', 'Version')}</th>
                                        <th className="px-6 py-3">{t('resultReports.colGenerated', 'Generated')}</th>
                                        <th className="px-6 py-3">{t('resultReports.colLinks', 'Links')}</th>
                                        <th className="px-6 py-3 text-right">{t('resultReports.colActions', 'Actions')}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-sf-divider">
                                    {reports.map(r => (
                                        <tr key={r.id} className="hover:bg-sf-raised/50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="font-mono font-bold text-sf-emerald">
                                                    {r.sampleLabId || r.sampleId?.slice(0, 8)}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="font-medium text-sf-text">{getClientName(r)}</div>
                                                {r.phone && <div className="text-xs text-gray-400 mt-0.5">{r.phone}</div>}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-sf-text">{r.projectName || r.projectCode || '—'}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${
                                                    r.status === 'SUPERSEDED'
                                                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                                                        : 'bg-sf-raised text-sf-muted'
                                                }`}>
                                                    v{r.version} {r.status === 'SUPERSEDED' && '· Superseded'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sf-muted text-sm">
                                                <div>{formatDate(r.generatedAt)}</div>
                                                <div className="text-xs text-gray-400">{r.generatedBy}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                {r.shareLinks?.length > 0 ? (
                                                    <span className="inline-flex items-center gap-1 text-xs font-bold text-green-700 bg-green-50 dark:bg-green-900/20 dark:text-green-400 px-2 py-0.5 rounded-full">
                                                        <LinkIcon size={11} /> {t('resultReports.activeLinks', `${r.shareLinks.length} active`, { count: r.shareLinks.length })}
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-gray-400">{t('resultReports.noLinks', 'No links')}</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <button
                                                        onClick={() => viewReport(r.id)}
                                                        className="p-2 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/30 text-sf-emerald transition-colors"
                                                        title="View report"
                                                    >
                                                        <Eye size={16} />
                                                    </button>
                                                    {isManager && (
                                                        <button
                                                            onClick={() => openShareModal(r.id)}
                                                            className="p-2 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/30 text-purple-600 dark:text-purple-400 transition-colors"
                                                            title="Share report"
                                                        >
                                                            <Share2 size={16} />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        {pagination.pages > 1 && (
                            <div className="px-6 py-3 bg-sf-canvas/50 border-t border-sf-divider flex items-center justify-between">
                                <span className="text-xs text-gray-500">
                                    Page {pagination.page} of {pagination.pages} ({pagination.total} total)
                                </span>
                                <div className="flex gap-1">
                                    <button
                                        onClick={() => handlePageChange(pagination.page - 1)}
                                        disabled={pagination.page <= 1}
                                        className="p-1.5 rounded-lg hover:bg-sf-raised disabled:opacity-30 transition-colors"
                                    >
                                        <ChevronLeft size={16} />
                                    </button>
                                    <button
                                        onClick={() => handlePageChange(pagination.page + 1)}
                                        disabled={pagination.page >= pagination.pages}
                                        className="p-1.5 rounded-lg hover:bg-sf-raised disabled:opacity-30 transition-colors"
                                    >
                                        <ChevronRight size={16} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* ─── REPORT VIEWER MODAL ─── */}
            {selectedReport && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-sf-surface rounded-2xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden border border-sf-divider">
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-sf-divider flex justify-between items-center bg-sf-surface no-print">
                            <div>
                                <h2 className="text-xl font-black text-sf-text">
                                    Report — {selectedReport.sampleLabId || selectedReport.sampleId?.slice(0, 8)}
                                </h2>
                                <p className="text-xs text-gray-500 mt-0.5">Version {selectedReport.version} • Generated {formatDate(selectedReport.generatedAt)} by {selectedReport.generatedBy}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={() => window.print()} className="p-2.5 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 rounded-xl text-sf-emerald transition-colors" title="Print / Save as PDF">
                                    <Printer size={20} />
                                </button>
                                <button onClick={() => setSelectedReport(null)} className="p-2.5 hover:bg-sf-raised rounded-xl text-gray-500 transition-colors">
                                    <XCircle size={24} />
                                </button>
                            </div>
                        </div>

                        {/* Report Content */}
                        <div className="flex-1 overflow-y-auto p-8 bg-sf-canvas" data-surface="paper">
                            {selectedReport.content ? (
                                <ReportContent data={typeof selectedReport.content === 'string' ? JSON.parse(selectedReport.content) : selectedReport.content} showActions />
                            ) : (
                                <div className="text-center text-gray-400 py-20">No report content available</div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ─── SHARE LINK MODAL ─── */}
            {shareModal && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-sf-surface rounded-2xl shadow-2xl w-full max-w-lg border border-sf-divider overflow-hidden">
                        <div className="px-6 py-4 border-b border-sf-divider flex justify-between items-center">
                            <h3 className="font-bold text-sf-text flex items-center gap-2">
                                <Share2 size={18} className="text-purple-600" /> {t('resultReports.manageShareLinks', 'Manage Share Links')}
                            </h3>
                            <button onClick={() => setShareModal(null)} className="p-2 hover:bg-sf-raised rounded-lg">
                                <XCircle size={20} className="text-gray-400" />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            {/* Create new link */}
                            <div className="p-4 bg-sf-canvas rounded-xl border border-sf-divider">
                                <h4 className="text-sm font-bold text-sf-text mb-3">{t('resultReports.createPublicLink', 'Create Public Link')}</h4>
                                <div className="flex items-center gap-3">
                                    <div className="flex-1">
                                        <label className="text-xs text-gray-500 mb-1 block">{t('resultReports.expiresInDays', 'Expires in (days)')}</label>
                                        <input
                                            type="number"
                                            value={expiryDays}
                                            onChange={e => setExpiryDays(parseInt(e.target.value) || 30)}
                                            min="1"
                                            max="365"
                                            className="w-full border border-sf-divider rounded-lg px-3 py-2 text-sm bg-sf-surface text-sf-text"
                                        />
                                    </div>
                                    <button
                                        onClick={createShareLink}
                                        disabled={shareLoading}
                                        className="px-4 py-2 bg-sf-emerald text-white rounded-lg font-bold text-sm hover:bg-sf-emerald-hover transition-colors disabled:opacity-50 flex items-center gap-2 mt-5"
                                    >
                                        <Plus size={14} /> {t('resultReports.generate', 'Generate')}
                                    </button>
                                </div>
                            </div>

                            {/* Existing links */}
                            <div>
                                <h4 className="text-sm font-bold text-sf-text mb-2">Existing Links</h4>
                                {shareLoading ? (
                                    <div className="py-6 text-center text-gray-400 text-sm">Loading...</div>
                                ) : shareLinks.length === 0 ? (
                                    <div className="py-6 text-center text-gray-400 text-sm">No share links yet</div>
                                ) : (
                                    <div className="space-y-2 max-h-48 overflow-y-auto">
                                        {shareLinks.map(link => (
                                            <div key={link.id} className={`p-3 rounded-lg border text-sm ${link.isRevoked ? 'bg-red-50 border-red-200 dark:bg-red-900/10 dark:border-red-800' : 'bg-gray-50 border-gray-200 dark:bg-gray-700 dark:border-gray-600'}`}>
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <Clock size={12} className="text-gray-400" />
                                                            <span className="text-xs text-gray-500">Created {formatDate(link.createdAt)} by {link.createdBy}</span>
                                                        </div>
                                                        {link.expiresAt && (
                                                            <div className="text-xs text-gray-400 mt-0.5">Expires: {formatDate(link.expiresAt)}</div>
                                                        )}
                                                        <div className="text-xs text-gray-400 mt-0.5">{link._count?.accessLogs || 0} views</div>
                                                    </div>
                                                    {link.isRevoked ? (
                                                        <span className="text-xs font-bold text-red-600 dark:text-red-400">Revoked</span>
                                                    ) : (
                                                        <button
                                                            onClick={() => revokeLink(link.id)}
                                                            className="px-2 py-1 text-xs font-bold text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                                                        >
                                                            Revoke
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ResultReports;
