import React, { useState, useEffect, useCallback, useRef } from 'react';
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

const ResultReports = () => {
    const { user } = useAuth();
    const { showDialog } = useDialog();
    const { t } = useLanguage();
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(false);
    const [query, setQuery] = useState('');
    const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 1, limit: 25 });
    const [selectedReport, setSelectedReport] = useState(null);
    const [shareModal, setShareModal] = useState(null); // reportId for share dialog
    const [shareLinks, setShareLinks] = useState([]);
    const [shareLoading, setShareLoading] = useState(false);
    const [expiryDays, setExpiryDays] = useState(30);

    const isManager = ['SUPER_ADMIN', 'MASTER_USER', 'LAB_MANAGER'].includes(user?.role);
    const canGenerate = ['SUPER_ADMIN', 'MASTER_USER', 'LAB_MANAGER', 'SAMPLE_RECEPTION'].includes(user?.role);

    // ─── Search & Fetch ──────────────────────────────────

    const fetchReports = useCallback(async (page = 1, search = query) => {
        setLoading(true);
        try {
            const res = await axios.get('/api/reports/search', {
                params: { q: search, page, limit: pagination.limit }
            });
            setReports(res.data.reports || []);
            setPagination(res.data.pagination || { total: 0, page: 1, pages: 1, limit: 25 });
        } catch (e) {
            console.error('Report search failed:', e);
        } finally {
            setLoading(false);
        }
    }, [query, pagination.limit]);

    useEffect(() => {
        fetchReports(1, '');
    }, []);

    const handleSearch = (e) => {
        e.preventDefault();
        fetchReports(1, query);
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
        <div className="p-6 lg:p-8 h-full bg-gray-50 dark:bg-gray-900 overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-black text-gray-900 dark:text-white flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                        <FileText size={20} className="text-white" />
                    </div>
                    Result Reports
                </h1>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                    {pagination.total} report{pagination.total !== 1 ? 's' : ''} found
                </span>
            </div>

            {/* Search Bar */}
            <form onSubmit={handleSearch} className="mb-6">
                <div className="relative max-w-2xl">
                    <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder="Search by name, phone, project, sample ID, or lab ID..."
                        className="w-full pl-12 pr-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm"
                    />
                    <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition-colors">
                        Search
                    </button>
                </div>
            </form>

            {/* Results Table */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center py-20 text-gray-400">
                        <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-500 border-t-transparent mr-3" />
                        Searching reports...
                    </div>
                ) : reports.length === 0 ? (
                    <div className="text-center py-20 text-gray-400">
                        <FileText size={40} className="mx-auto mb-3 opacity-30" />
                        <p className="font-bold">No reports found</p>
                        <p className="text-sm mt-1">Try a different search term or generate new reports from the Samples page.</p>
                    </div>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700 text-xs uppercase text-gray-500 dark:text-gray-400 tracking-wider">
                                    <tr>
                                        <th className="px-6 py-3">Sample / Lab ID</th>
                                        <th className="px-6 py-3">Client</th>
                                        <th className="px-6 py-3">Project</th>
                                        <th className="px-6 py-3">Version</th>
                                        <th className="px-6 py-3">Generated</th>
                                        <th className="px-6 py-3">Links</th>
                                        <th className="px-6 py-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {reports.map(r => (
                                        <tr key={r.id} className="hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                                                    {r.sampleLabId || r.sampleId?.slice(0, 8)}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="font-medium text-gray-900 dark:text-white">{getClientName(r)}</div>
                                                {r.phone && <div className="text-xs text-gray-400 mt-0.5">{r.phone}</div>}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-gray-700 dark:text-gray-300">{r.projectName || r.projectCode || '—'}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                                                    v{r.version}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-gray-600 dark:text-gray-400 text-sm">
                                                <div>{formatDate(r.generatedAt)}</div>
                                                <div className="text-xs text-gray-400">{r.generatedBy}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                {r.shareLinks?.length > 0 ? (
                                                    <span className="inline-flex items-center gap-1 text-xs font-bold text-green-700 bg-green-50 dark:bg-green-900/20 dark:text-green-400 px-2 py-0.5 rounded-full">
                                                        <LinkIcon size={11} /> {r.shareLinks.length} active
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-gray-400">No links</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <button
                                                        onClick={() => viewReport(r.id)}
                                                        className="p-2 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 transition-colors"
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
                            <div className="px-6 py-3 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
                                <span className="text-xs text-gray-500">
                                    Page {pagination.page} of {pagination.pages} ({pagination.total} total)
                                </span>
                                <div className="flex gap-1">
                                    <button
                                        onClick={() => fetchReports(pagination.page - 1)}
                                        disabled={pagination.page <= 1}
                                        className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-30 transition-colors"
                                    >
                                        <ChevronLeft size={16} />
                                    </button>
                                    <button
                                        onClick={() => fetchReports(pagination.page + 1)}
                                        disabled={pagination.page >= pagination.pages}
                                        className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-30 transition-colors"
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
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden border border-gray-200 dark:border-gray-700">
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gradient-to-r from-indigo-50 to-white dark:from-gray-800 dark:to-gray-800 no-print">
                            <div>
                                <h2 className="text-xl font-black text-gray-900 dark:text-white">
                                    Report — {selectedReport.sampleLabId || selectedReport.sampleId?.slice(0, 8)}
                                </h2>
                                <p className="text-xs text-gray-500 mt-0.5">Version {selectedReport.version} • Generated {formatDate(selectedReport.generatedAt)} by {selectedReport.generatedBy}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={() => window.print()} className="p-2.5 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 rounded-xl text-indigo-600 dark:text-indigo-400 transition-colors" title="Print / Save as PDF">
                                    <Printer size={20} />
                                </button>
                                <button onClick={() => setSelectedReport(null)} className="p-2.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl text-gray-500 transition-colors">
                                    <XCircle size={24} />
                                </button>
                            </div>
                        </div>

                        {/* Report Content */}
                        <div className="flex-1 overflow-y-auto p-8 bg-white dark:bg-gray-900">
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
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                            <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <Share2 size={18} className="text-purple-600" /> Manage Share Links
                            </h3>
                            <button onClick={() => setShareModal(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                                <XCircle size={20} className="text-gray-400" />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            {/* Create new link */}
                            <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-200 dark:border-indigo-800">
                                <h4 className="text-sm font-bold text-indigo-800 dark:text-indigo-300 mb-3">Create Public Link</h4>
                                <div className="flex items-center gap-3">
                                    <div className="flex-1">
                                        <label className="text-xs text-gray-500 mb-1 block">Expires in (days)</label>
                                        <input
                                            type="number"
                                            value={expiryDays}
                                            onChange={e => setExpiryDays(parseInt(e.target.value) || 30)}
                                            min="1"
                                            max="365"
                                            className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700"
                                        />
                                    </div>
                                    <button
                                        onClick={createShareLink}
                                        disabled={shareLoading}
                                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold text-sm hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-2 mt-5"
                                    >
                                        <Plus size={14} /> Generate
                                    </button>
                                </div>
                            </div>

                            {/* Existing links */}
                            <div>
                                <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Existing Links</h4>
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
