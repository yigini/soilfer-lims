import React, { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import {
    ShieldCheck, AlertTriangle, CheckCircle2,
    Clock, RefreshCw, Search, ArrowUpRight,
    FileSpreadsheet, Activity, History, Loader2
} from 'lucide-react';
import BatchInspectionModal from '../components/qc/BatchInspectionModal';

export default function QADashboard() {
    const { token } = useAuth();
    const { t } = useLanguage();
    const [searchParams, setSearchParams] = useSearchParams();
    const batchIdParam = searchParams.get('batchId');
    const tabParam = searchParams.get('tab');

    const [activeTab, setActiveTab] = useState(tabParam === 'amendments' || tabParam === 'audit' ? tabParam : 'qc');
    const [selectedBatchId, setSelectedBatchId] = useState(batchIdParam);
    const [isInspectionOpen, setIsInspectionOpen] = useState(Boolean(batchIdParam));
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    useEffect(() => {
        if (batchIdParam) {
            setSelectedBatchId(batchIdParam);
            setIsInspectionOpen(true);
        }
    }, [batchIdParam]);

    useEffect(() => {
        if (tabParam && ['qc', 'amendments', 'audit'].includes(tabParam)) {
            setActiveTab(tabParam);
        }
    }, [tabParam]);

    const handleOpenInspection = (bId) => {
        setSelectedBatchId(bId);
        setIsInspectionOpen(true);
        setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            next.set('batchId', bId);
            return next;
        }, { replace: true });
    };

    const handleCloseInspection = () => {
        setIsInspectionOpen(false);
        setSelectedBatchId(null);
        setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            next.delete('batchId');
            return next;
        }, { replace: true });
    };

    // Data states
    const [qcRows, setQcRows] = useState([]);
    const [amendmentRows, setAmendmentRows] = useState([]);
    const [auditRows, setAuditRows] = useState([]);
    const [stats, setStats] = useState({
        qcTotal: 0,
        qcFailed: 0,
        amendmentsTotal: 0,
        auditTotal: 0
    });

    const fetchData = useCallback(async (isBackground = false) => {
        if (!token) return;
        if (!isBackground) setLoading(true);
        else setIsRefreshing(true);

        try {
            const [qcRes, amendRes, auditRes] = await Promise.allSettled([
                axios.get('/api/dashboard/queues/audit.qc', { headers: { Authorization: `Bearer ${token}` } }),
                axios.get('/api/dashboard/queues/audit.history', { headers: { Authorization: `Bearer ${token}` } }),
                axios.get('/api/audit-final?limit=15', { headers: { Authorization: `Bearer ${token}` } })
            ]);

            const qcs = qcRes.status === 'fulfilled' ? (qcRes.value.data.rows || []) : [];
            const amends = amendRes.status === 'fulfilled' ? (amendRes.value.data.rows || []) : [];
            const audits = auditRes.status === 'fulfilled' ? (auditRes.value.data.data || []) : [];

            setQcRows(qcs);
            setAmendmentRows(amends);
            setAuditRows(audits);

            const failedCount = (qcRes.status === 'fulfilled' && qcRes.value.data.qcFailedCount !== undefined)
                ? qcRes.value.data.qcFailedCount
                : qcs.filter(q => String(q.status || '').toLowerCase().includes('fail')).length;

            setStats({
                qcTotal: qcRes.status === 'fulfilled' ? (qcRes.value.data.total || qcs.length) : 0,
                qcFailed: failedCount,
                amendmentsTotal: amendRes.status === 'fulfilled' ? (amendRes.value.data.total || amends.length) : 0,
                auditTotal: auditRes.status === 'fulfilled' ? (auditRes.value.data.meta?.total || audits.length) : 0
            });
        } catch (err) {
            console.error('[QADashboard] Error loading QA data:', err);
        } finally {
            setLoading(false);
            setIsRefreshing(false);
        }
    }, [token]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const filteredQc = search.trim()
        ? qcRows.filter(r => (r.title && r.title.toLowerCase().includes(search.toLowerCase())) || (r.context && r.context.toLowerCase().includes(search.toLowerCase())))
        : qcRows;

    const filteredAmendments = search.trim()
        ? amendmentRows.filter(r => (r.title && r.title.toLowerCase().includes(search.toLowerCase())) || (r.context && r.context.toLowerCase().includes(search.toLowerCase())))
        : amendmentRows;

    const filteredAudit = search.trim()
        ? auditRows.filter(r => (r.action && r.action.toLowerCase().includes(search.toLowerCase())) || (r.details && r.details.toLowerCase().includes(search.toLowerCase())))
        : auditRows;

    return (
        <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-sf-divider">
                <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-sf-emerald mb-1">
                        {t('qaSection.kicker', 'Quality & Regulatory Compliance')}
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-sf-text flex items-center gap-3">
                        <ShieldCheck className="w-8 h-8 text-sf-emerald" />
                        <span>{t('qaSection.title', 'Quality Assurance & Audit')}</span>
                    </h1>
                    <p className="text-sm text-sf-muted mt-1">
                        {t('qaSection.subtitle', 'QC batch verification, control chart monitoring, traceable specimen amendments, and immutable audit trails.')}
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => fetchData(true)}
                        disabled={isRefreshing}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-sf-text bg-sf-surface border border-sf-divider hover:bg-sf-raised shadow-sm transition-all"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                        <span>{t('qaSection.refresh', 'Refresh QA')}</span>
                    </button>
                    <Link
                        to="/admin/audit"
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition-all"
                    >
                        <span>{t('qaSection.fullAuditLog', 'Full Audit Log')}</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                    </Link>
                </div>
            </div>

            {/* Metric Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl border border-sf-divider bg-sf-surface shadow-sm">
                    <div className="text-xs font-medium text-sf-muted">{t('qaSection.qcBatchesMonitored', 'QC Batches Monitored')}</div>
                    <div className="text-2xl font-bold text-sf-text mt-1">{stats.qcTotal}</div>
                    <div className="text-[11px] text-gray-400 mt-0.5">{t('qaSection.qcBatchesSubtitle', 'Active & recent analytical runs')}</div>
                </div>

                <div className={`p-4 rounded-xl border shadow-sm ${stats.qcFailed > 0 ? 'border-rose-300 dark:border-rose-900 bg-rose-50/40 dark:bg-rose-950/20' : 'border-sf-divider bg-sf-surface'}`}>
                    <div className="text-xs font-medium text-sf-muted">{t('qaSection.qcExceptions', 'QC Exceptions')}</div>
                    <div className={`text-2xl font-bold mt-1 ${stats.qcFailed > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                        {stats.qcFailed}
                    </div>
                    <div className="text-[11px] text-gray-400 mt-0.5">{stats.qcFailed > 0 ? t('qaSection.qcRequiresDisposition', 'Batches require disposition') : t('qaSection.zeroQcFailures', 'Zero active QC failures')}</div>
                </div>

                <div className="p-4 rounded-xl border border-sf-divider bg-sf-surface shadow-sm">
                    <div className="text-xs font-medium text-sf-muted">{t('qaSection.traceableAmendments', 'Traceable Amendments')}</div>
                    <div className="text-2xl font-bold text-sf-text mt-1">{stats.amendmentsTotal}</div>
                    <div className="text-[11px] text-gray-400 mt-0.5">{t('qaSection.traceableAmendmentsSubtitle', 'Post-approval corrections')}</div>
                </div>

                <div className="p-4 rounded-xl border border-sf-divider bg-sf-surface shadow-sm">
                    <div className="text-xs font-medium text-sf-muted">{t('qaSection.immutableAuditRecords', 'Immutable Audit Records')}</div>
                    <div className="text-2xl font-bold text-sf-text mt-1">{stats.auditTotal}</div>
                    <div className="text-[11px] text-gray-400 mt-0.5">{t('qaSection.immutableAuditRecordsSubtitle', 'Security & operational events')}</div>
                </div>
            </div>

            {/* Navigation Tabs & Search */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
                <div className="flex items-center gap-2 border-b sm:border-b-0 border-sf-divider pb-2 sm:pb-0">
                    <button
                        type="button"
                        onClick={() => setActiveTab('qc')}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                            activeTab === 'qc'
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'text-sf-muted hover:bg-sf-raised'
                        }`}
                    >
                        <Activity className="w-3.5 h-3.5" />
                        <span>{t('qaSection.tabQcBatches', `QC Batches (${stats.qcTotal})`, { count: stats.qcTotal })}</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTab('amendments')}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                            activeTab === 'amendments'
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'text-sf-muted hover:bg-sf-raised'
                        }`}
                    >
                        <FileSpreadsheet className="w-3.5 h-3.5" />
                        <span>{t('qaSection.tabAmendments', `Amendments (${stats.amendmentsTotal})`, { count: stats.amendmentsTotal })}</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTab('audit')}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                            activeTab === 'audit'
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'text-sf-muted hover:bg-sf-raised'
                        }`}
                    >
                        <History className="w-3.5 h-3.5" />
                        <span>{t('qaSection.tabAuditStream', 'Audit Stream')}</span>
                    </button>
                </div>

                <div className="relative w-full sm:w-72">
                    <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                        type="search"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder={t('qaSection.searchRecords', 'Search records…')}
                        className="w-full pl-9 pr-3 py-1.5 text-xs bg-sf-canvas border border-sf-divider rounded-lg text-sf-text placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sf-emerald shadow-sm"
                    />
                </div>
            </div>

            {/* Tab Contents */}
            <div className="bg-sf-surface/80 rounded-xl border border-sf-divider/80 shadow-sm overflow-hidden">
                {loading ? (
                    <div className="p-12 text-center text-gray-400 flex flex-col items-center justify-center">
                        <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-2" />
                        <span className="text-xs">{t('qaSection.loadingRecords', 'Loading quality records…')}</span>
                    </div>
                ) : activeTab === 'qc' ? (
                    filteredQc.length === 0 ? (
                        <div className="p-12 text-center text-sf-muted text-xs">
                            {t('qaSection.noQcBatches', 'No QC batches matching the current filter.')}
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-sf-canvas border-b border-sf-divider text-gray-500 font-semibold">
                                    <tr>
                                        <th className="py-3 px-4">{t('qaSection.colBatchId', 'Batch ID / Name')}</th>
                                        <th className="py-3 px-4">{t('qaSection.colAnalysisScope', 'Analysis & Scope')}</th>
                                        <th className="py-3 px-4">{t('qaSection.colStatus', 'Status')}</th>
                                        <th className="py-3 px-4 text-right">{t('qaSection.colAction', 'Action')}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-sf-divider">
                                    {filteredQc.map((row) => (
                                        <tr key={row.key} className="hover:bg-sf-raised/50">
                                            <td className="py-3.5 px-4 font-semibold text-sf-text">
                                                {row.title}
                                            </td>
                                            <td className="py-3.5 px-4 text-sf-muted">
                                                {row.context}
                                            </td>
                                            <td className="py-3.5 px-4">
                                                <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                                                    String(row.status || '').toLowerCase().includes('fail')
                                                        ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400'
                                                        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                                                }`}>
                                                    {row.status}
                                                </span>
                                            </td>
                                            <td className="py-3.5 px-4 text-right">
                                                <button
                                                    type="button"
                                                    onClick={() => handleOpenInspection(row.key)}
                                                    className="inline-flex items-center gap-1 text-xs font-semibold text-sf-emerald hover:text-sf-emerald-hover"
                                                >
                                                    <span>Inspect</span>
                                                    <ArrowUpRight className="w-3.5 h-3.5" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )
                ) : activeTab === 'amendments' ? (
                    filteredAmendments.length === 0 ? (
                        <div className="p-12 text-center text-sf-muted text-xs">
                            No recorded amendments in authorized scope.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-sf-canvas border-b border-sf-divider text-gray-500 font-semibold">
                                    <tr>
                                        <th className="py-3 px-4">Sample / Amendment</th>
                                        <th className="py-3 px-4">Reason & Justification</th>
                                        <th className="py-3 px-4">Type</th>
                                        <th className="py-3 px-4 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-sf-divider">
                                    {filteredAmendments.map((row) => (
                                        <tr key={row.key} className="hover:bg-sf-raised/50">
                                            <td className="py-3.5 px-4 font-semibold text-sf-text">
                                                {row.title}
                                            </td>
                                            <td className="py-3.5 px-4 text-sf-muted">
                                                {row.context}
                                            </td>
                                            <td className="py-3.5 px-4">
                                                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-sf-raised text-sf-muted">
                                                    {row.status || 'RECORDED'}
                                                </span>
                                            </td>
                                            <td className="py-3.5 px-4 text-right">
                                                {row.route ? (
                                                    <Link
                                                        to={row.route}
                                                        className="inline-flex items-center gap-1 text-xs font-semibold text-sf-emerald hover:text-sf-emerald-hover"
                                                    >
                                                        <span>Dossier</span>
                                                        <ArrowUpRight className="w-3.5 h-3.5" />
                                                    </Link>
                                                ) : (
                                                    <span className="text-gray-400">Locked</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )
                ) : (
                    filteredAudit.length === 0 ? (
                        <div className="p-12 text-center text-sf-muted text-xs">
                            No audit log events match query.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-sf-canvas border-b border-sf-divider text-gray-500 font-semibold">
                                    <tr>
                                        <th className="py-3 px-4">Timestamp</th>
                                        <th className="py-3 px-4">Action</th>
                                        <th className="py-3 px-4">User</th>
                                        <th className="py-3 px-4">Details</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-sf-divider">
                                    {filteredAudit.map((log) => (
                                        <tr key={log.id} className="hover:bg-sf-raised/50">
                                            <td className="py-3 px-4 whitespace-nowrap text-gray-500">
                                                {new Date(log.timestamp).toLocaleString()}
                                            </td>
                                            <td className="py-3 px-4 font-semibold text-sf-text">
                                                {log.action}
                                            </td>
                                            <td className="py-3 px-4 font-mono text-sf-muted">
                                                {log.performedBy}
                                            </td>
                                            <td className="py-3 px-4 text-sf-muted">
                                                {log.details}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )
                )}
            </div>
            <BatchInspectionModal
                batchId={selectedBatchId}
                isOpen={isInspectionOpen}
                onClose={handleCloseInspection}
                onDispositionSuccess={() => {
                    fetchData(true);
                }}
            />
        </div>
    );
}
