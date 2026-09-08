import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    FlaskConical, Wind, Hammer, AlertTriangle, ArrowUpRight,
    RefreshCw, ArrowRight, Plus, Clock, FileEdit, PackageCheck,
    CheckCircle2, XCircle, MapPin, Database, ChevronRight
} from 'lucide-react';
import { useRealtimeData, formatLastUpdated } from '../../hooks/useRealtimeData';
import { useLanguage } from '../../context/LanguageContext';

// ─── Live Indicator ───
const LiveBadge = ({ isLive, isStale, lastUpdated }) => (
    <div className="flex items-center gap-2">
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${isStale ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
            : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
            }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isStale ? 'bg-amber-500' : isLive ? 'bg-emerald-500 animate-pulse' : 'bg-emerald-500'
                }`} />
            {isStale ? 'Stale' : 'Live'}
        </div>
        {lastUpdated && (
            <span className="text-[10px] text-gray-400">{formatLastUpdated(lastUpdated)}</span>
        )}
    </div>
);

const ReceptionDashboard = ({ user }) => {
    const navigate = useNavigate();
    const { t } = useLanguage();
    const [selectedTab, setSelectedTab] = useState(null); // dynamic actionable default

    const { data, loading, error, isLive, isStale, lastUpdated, refresh } = useRealtimeData('/api/dashboard/live', {
        interval: 15000,
        wsEvents: ['WORKITEM_CHANGED', 'WORKITEM_UPDATE', 'SAMPLE_CREATED', 'SAMPLE_UPDATED', 'INTAKE_COMPLETED'],
    });

    if (loading && !data) {
        return (
            <div className="flex items-center justify-center h-64 gap-3">
                <RefreshCw size={20} className="animate-spin text-blue-500" />
                <span className="text-gray-400 font-medium">{t('reception.loading', 'Loading reception console...')}</span>
            </div>
        );
    }

    if (error && !data) {
        return (
            <div className="p-8 rounded-xl border border-rose-200 bg-rose-50 dark:bg-rose-950/30 text-center space-y-3">
                <AlertTriangle size={32} className="mx-auto text-rose-500" />
                <h3 className="font-bold text-rose-800 dark:text-rose-300 text-base">
                    {t('reception.loadError', 'Failed to load reception dashboard')}
                </h3>
                <p className="text-xs text-rose-600 dark:text-rose-400">{error.message || 'Connection error'}</p>
                <button
                    onClick={refresh}
                    className="px-4 py-2 bg-rose-600 text-white rounded-lg text-xs font-bold hover:bg-rose-700 transition"
                >
                    {t('common.retry', 'Retry')}
                </button>
            </div>
        );
    }

    const kpis = data?.kpis || {};
    const timezone = data?.timezone || 'UTC';
    const recentIntakes = data?.recentIntakes || [];
    const draftQueue = data?.draftQueue || [];
    const expectedQueue = data?.expectedQueue || [];
    const attentionQueue = data?.attentionQueue || [];

    // Reception Activity KPIs
    const expectedArrivals = kpis.expectedArrivals ?? 0;
    const incompleteDrafts = kpis.incompleteDrafts ?? 0;
    const receivedToday = kpis.receivedToday ?? 0;
    const needsAttention = kpis.needsAttention ?? 0;

    // Laboratory Operational Handoff
    const waitingDrying = kpis.waitingDrying ?? kpis.pendingDrying ?? 0;
    const readyPreparation = kpis.readyPreparation ?? kpis.pendingPreparation ?? 0;
    const totalRegistered = kpis.totalRegistered ?? kpis.totalProcessed ?? 0;

    // Actionable default tab: attention if pending issues exist, else drafts, else expected, else recent
    const defaultTab = (needsAttention > 0 || attentionQueue.length > 0)
        ? 'ATTENTION'
        : (incompleteDrafts > 0 || draftQueue.length > 0)
            ? 'DRAFTS'
            : (expectedArrivals > 0 || expectedQueue.length > 0)
                ? 'EXPECTED'
                : 'RECENT';

    const activeTab = selectedTab || defaultTab;
    const setActiveTab = setSelectedTab;

    // Format date in laboratory timezone
    const todayFormatted = (() => {
        try {
            return new Intl.DateTimeFormat('en-US', {
                timeZone: timezone,
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            }).format(new Date());
        } catch {
            return new Date().toLocaleDateString();
        }
    })();

    return (
        <div className="space-y-6 pb-12">
            {/* ─── Header ─── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-black text-sf-text">
                        {t('reception.consoleTitle', 'Reception Console')}
                    </h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                        {todayFormatted} {timezone ? `(${timezone})` : ''} &middot; {user?.labId ? `Lab: ${user.labId}` : 'All Laboratories'}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <LiveBadge isLive={isLive} isStale={isStale} lastUpdated={lastUpdated} />
                    <button
                        onClick={refresh}
                        className="p-2 rounded-lg hover:bg-sf-raised transition-colors"
                        title={t('common.refresh', 'Refresh now')}
                    >
                        <RefreshCw size={16} className="text-gray-400" />
                    </button>
                    {/* Single Canonical Intake Action */}
                    <button
                        onClick={() => navigate('/reception')}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-md shadow-blue-500/20 transition-all cursor-pointer"
                    >
                        <Plus size={18} />
                        <span>{t('reception.newIntake', 'New Intake')}</span>
                    </button>
                </div>
            </div>

            {/* ─── Reception KPI Row ─── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {/* 1. Expected Arrivals */}
                <button
                    onClick={() => setActiveTab('EXPECTED')}
                    className={`p-5 rounded-xl border text-left transition-all cursor-pointer ${
                        activeTab === 'EXPECTED'
                            ? 'bg-blue-50 border-blue-400 ring-2 ring-blue-300 dark:bg-blue-900/30 dark:border-blue-700'
                            : 'bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-700 hover:border-blue-300'
                    }`}
                >
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                            {t('reception.expectedArrivals', 'Expected Arrivals')}
                        </span>
                        <PackageCheck size={18} className="text-blue-500 opacity-70" />
                    </div>
                    <span className="text-3xl font-black text-blue-700 dark:text-blue-300">{expectedArrivals}</span>
                    <span className="text-[11px] text-gray-400 block mt-0.5">
                        {t('reception.inManifest', 'in project manifests')}
                    </span>
                </button>

                {/* 2. Incomplete Drafts */}
                <button
                    onClick={() => setActiveTab('DRAFTS')}
                    className={`p-5 rounded-xl border text-left transition-all cursor-pointer ${
                        activeTab === 'DRAFTS'
                            ? 'bg-indigo-50 border-indigo-400 ring-2 ring-indigo-300 dark:bg-indigo-900/30 dark:border-indigo-700'
                            : 'bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-700 hover:border-indigo-300'
                    }`}
                >
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold uppercase tracking-wider text-sf-emerald">
                            {t('reception.incompleteDrafts', 'Incomplete Drafts')}
                        </span>
                        <FileEdit size={18} className="text-indigo-500 opacity-70" />
                    </div>
                    <span className="text-3xl font-black text-sf-emerald">{incompleteDrafts}</span>
                    <span className="text-[11px] text-gray-400 block mt-0.5">
                        {t('reception.savedDrafts', 'intake drafts in progress')}
                    </span>
                </button>

                {/* 3. Received Today */}
                <button
                    onClick={() => setActiveTab('RECENT')}
                    className={`p-5 rounded-xl border text-left transition-all cursor-pointer ${
                        activeTab === 'RECENT'
                            ? 'bg-emerald-50 border-emerald-400 ring-2 ring-emerald-300 dark:bg-emerald-900/30 dark:border-emerald-700'
                            : 'bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-700 hover:border-emerald-300'
                    }`}
                >
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                            {t('reception.receivedToday', 'Received Today')}
                        </span>
                        <Clock size={18} className="text-emerald-500 opacity-70" />
                    </div>
                    <span className="text-3xl font-black text-emerald-700 dark:text-emerald-300">{receivedToday}</span>
                    <span className="text-[11px] text-gray-400 block mt-0.5">
                        {t('reception.todayIntake', 'samples intaken today')}
                    </span>
                </button>

                {/* 4. Needs Attention */}
                <button
                    onClick={() => setActiveTab('ATTENTION')}
                    className={`p-5 rounded-xl border text-left transition-all cursor-pointer ${
                        activeTab === 'ATTENTION'
                            ? 'bg-rose-50 border-rose-400 ring-2 ring-rose-300 dark:bg-rose-950/30 dark:border-rose-700'
                            : 'bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-700 hover:border-rose-300'
                    }`}
                >
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                            {t('reception.needsAttention', 'Needs Attention')}
                        </span>
                        <AlertTriangle size={18} className="text-rose-500 opacity-70" />
                    </div>
                    <span className="text-3xl font-black text-rose-700 dark:text-rose-300">{needsAttention}</span>
                    <span className="text-[11px] text-gray-400 block mt-0.5">
                        {t('reception.issuesDesc', 'rejections & pending reviews')}
                    </span>
                </button>
            </div>

            {/* ─── Actionable Work Queues (Tabs) ─── */}
            <div className="card-base rounded-xl shadow-sm border border-sf-divider overflow-hidden bg-sf-surface">
                {/* Tab Navigation */}
                <div className="flex border-b border-sf-divider bg-gray-50/70 dark:bg-gray-850 px-4 pt-2 gap-1 overflow-x-auto">
                    {[
                        { id: 'ATTENTION', label: t('reception.tabAttention', 'Needs Attention'), count: attentionQueue.length, color: 'text-rose-600' },
                        { id: 'DRAFTS', label: t('reception.tabDrafts', 'Incomplete Drafts'), count: draftQueue.length, color: 'text-indigo-600' },
                        { id: 'EXPECTED', label: t('reception.tabExpected', 'Expected Arrivals'), count: expectedQueue.length, color: 'text-blue-600' },
                        { id: 'RECENT', label: t('reception.tabRecent', 'Recent Receipts'), count: recentIntakes.length, color: 'text-emerald-600' },
                    ].map(tab => {
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 px-4 py-2.5 font-bold text-xs rounded-t-lg transition-all border-b-2 cursor-pointer ${
                                    isActive
                                        ? 'bg-sf-surface text-sf-text border-blue-600 shadow-sm'
                                        : 'text-sf-muted border-transparent hover:text-gray-700 hover:border-gray-300'
                                }`}
                            >
                                <span>{tab.label}</span>
                                {tab.count > 0 && (
                                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-black ${
                                        isActive ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                                    }`}>
                                        {tab.count}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Tab Content */}
                <div className="p-4">
                    {/* TAB: Needs Attention */}
                    {activeTab === 'ATTENTION' && (
                        <div>
                            {attentionQueue.length > 0 ? (
                                <div className="divide-y divide-sf-divider">
                                    {attentionQueue.map(s => (
                                        <div key={s.id} className="py-3 flex items-center justify-between gap-4 hover:bg-gray-50/50 dark:hover:bg-gray-750 rounded-lg px-2 transition">
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-sm text-sf-text">
                                                        {s.originalId || s.labId}
                                                    </span>
                                                    <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300">
                                                        {s.status}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-sf-muted mt-0.5">
                                                    Project: {s.projectCode || s.projectId || 'Walk-in'} &middot; {s.rejectionReason ? `Reason: ${s.rejectionReason}` : 'Pending intake manager review'}
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => navigate(`/samples/${s.id}`)}
                                                className="px-3 py-1.5 bg-sf-raised hover:bg-blue-50 hover:text-blue-600 rounded-lg text-xs font-bold transition flex items-center gap-1 shrink-0"
                                            >
                                                Inspect <ChevronRight size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="py-10 text-center text-gray-400">
                                    <CheckCircle2 size={32} className="mx-auto text-emerald-400 mb-2" />
                                    <p className="font-medium text-sm text-sf-muted">No items need attention</p>
                                    <p className="text-xs text-gray-400 mt-1">All intaken samples are in good standing.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* TAB: Incomplete Drafts */}
                    {activeTab === 'DRAFTS' && (
                        <div>
                            {draftQueue.length > 0 ? (
                                <div className="divide-y divide-sf-divider">
                                    {draftQueue.map(s => (
                                        <div key={s.id} className="py-3 flex items-center justify-between gap-4 hover:bg-gray-50/50 dark:hover:bg-gray-750 rounded-lg px-2 transition">
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-sm text-sf-text">
                                                        {s.originalId || s.labId}
                                                    </span>
                                                    <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                                                        DRAFT
                                                    </span>
                                                </div>
                                                <p className="text-xs text-sf-muted mt-0.5">
                                                    Project: {s.projectCode || s.projectId || 'Walk-in'} &middot; Saved by: {s.receivedBy || 'Intake'} &middot; {new Date(s.updatedAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => navigate(`/reception?originalId=${encodeURIComponent(s.originalId)}`)}
                                                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shrink-0 cursor-pointer"
                                            >
                                                Resume Draft <ArrowRight size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="py-10 text-center text-gray-400">
                                    <FileEdit size={32} className="mx-auto text-gray-300 dark:text-gray-600 mb-2" />
                                    <p className="font-medium text-sm text-sf-muted">No active drafts</p>
                                    <p className="text-xs text-gray-400 mt-1">Start a new intake to create a draft.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* TAB: Expected Arrivals */}
                    {activeTab === 'EXPECTED' && (
                        <div>
                            {expectedQueue.length > 0 ? (
                                <div className="divide-y divide-sf-divider">
                                    {expectedQueue.map(s => {
                                        const hasCoords = Boolean(
                                            s.hasCoordinates ||
                                            (s.latitude != null && s.longitude != null) ||
                                            (() => {
                                                try {
                                                    const fm = typeof s.fieldMetadata === 'string' ? JSON.parse(s.fieldMetadata) : s.fieldMetadata;
                                                    return Boolean(fm?.latitude || fm?.lat || fm?.gps || fm?.coordinates);
                                                } catch { return false; }
                                            })()
                                        );
                                        return (
                                            <div key={s.id} className="py-3 flex items-center justify-between gap-4 hover:bg-gray-50/50 dark:hover:bg-gray-750 rounded-lg px-2 transition">
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-sm text-sf-text">
                                                            {s.originalId}
                                                        </span>
                                                        <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                                                            EXPECTED
                                                        </span>
                                                        {hasCoords && (
                                                            <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 text-[10px] font-bold rounded">
                                                                <MapPin size={10} /> GPS
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-sf-muted mt-0.5">
                                                        Project: {s.projectCode || s.projectId || 'Unassigned'} &middot; Logged: {new Date(s.createdAt).toLocaleDateString()}
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={() => navigate(`/reception?originalId=${encodeURIComponent(s.originalId)}`)}
                                                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shrink-0 cursor-pointer"
                                                >
                                                    Receive Sample <ArrowRight size={14} />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="py-10 text-center text-gray-400">
                                    <PackageCheck size={32} className="mx-auto text-gray-300 dark:text-gray-600 mb-2" />
                                    <p className="font-medium text-sm text-sf-muted">No expected arrivals pending</p>
                                    <p className="text-xs text-gray-400 mt-1">All manifest samples have been processed or none are expected.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* TAB: Recent Receipts */}
                    {activeTab === 'RECENT' && (
                        <div>
                            {recentIntakes.length > 0 ? (
                                <div className="divide-y divide-sf-divider">
                                    {recentIntakes.map(s => {
                                        const statusColor = s.status === 'RECEIVED' ? 'bg-blue-100 text-blue-700'
                                            : s.status === 'ACCEPTED' ? 'bg-emerald-100 text-emerald-700'
                                            : s.status === 'PROCESSING' ? 'bg-orange-100 text-orange-700'
                                            : 'bg-gray-100 text-gray-700';
                                        return (
                                            <div key={s.id} className="py-3 flex items-center justify-between gap-4 hover:bg-gray-50/50 dark:hover:bg-gray-750 rounded-lg px-2 transition">
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-sm text-sf-text">
                                                            {s.labId || s.originalId}
                                                        </span>
                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${statusColor}`}>
                                                            {s.status?.replace('_', ' ')}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-sf-muted mt-0.5">
                                                        Project: {s.projectCode || s.projectId || 'Walk-in'} &middot; Received by: {s.receivedBy || 'Intake'} &middot; {new Date(s.receptionDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={() => navigate(`/samples/${s.id}`)}
                                                    className="px-3 py-1.5 bg-sf-raised hover:bg-blue-50 hover:text-blue-600 rounded-lg text-xs font-bold transition flex items-center gap-1 shrink-0"
                                                >
                                                    View Record <ChevronRight size={14} />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="py-10 text-center text-gray-400">
                                    <FlaskConical size={32} className="mx-auto text-gray-300 dark:text-gray-600 mb-2" />
                                    <p className="font-medium text-sm text-sf-muted">No samples received today</p>
                                    <p className="text-xs text-gray-400 mt-1">Use "New Intake" above to record arriving samples.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* ─── Laboratory Operational Handoff (Clearly separate from today's intake) ─── */}
            <div className="p-5 rounded-xl border border-sf-divider bg-sf-canvas space-y-3">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-sm font-bold text-sf-text flex items-center gap-2">
                            <Database size={16} className="text-blue-500" />
                            {t('reception.handoffTitle', 'Laboratory Operational Handoff')}
                        </h3>
                        <p className="text-[11px] text-gray-500 mt-0.5">
                            {t('reception.handoffSubtitle', 'Post-intake processing queue for received and accepted samples')}
                        </p>
                    </div>
                    <button
                        onClick={() => navigate('/samples')}
                        className="text-xs font-bold text-blue-600 hover:text-blue-800 dark:text-blue-400 flex items-center gap-1"
                    >
                        {t('reception.allSamples', 'All Samples')} <ArrowUpRight size={14} />
                    </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                    {/* Waiting for Drying */}
                    <div className="p-4 rounded-xl border bg-amber-50/80 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800/60">
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                                Waiting for Drying
                            </span>
                            <Wind size={16} className="text-amber-500 opacity-70" />
                        </div>
                        <span className="text-2xl font-black text-amber-800 dark:text-amber-300">{waitingDrying}</span>
                        <span className="text-[10px] text-amber-600/80 dark:text-amber-400/80 block mt-0.5">
                            intaken samples requiring drying
                        </span>
                    </div>

                    {/* Ready for Preparation */}
                    <div className="p-4 rounded-xl border bg-orange-50/80 border-orange-200 dark:bg-orange-950/20 dark:border-orange-800/60">
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-orange-700 dark:text-orange-400">
                                Ready for Preparation
                            </span>
                            <Hammer size={16} className="text-orange-500 opacity-70" />
                        </div>
                        <span className="text-2xl font-black text-orange-800 dark:text-orange-300">{readyPreparation}</span>
                        <span className="text-[10px] text-orange-600/80 dark:text-orange-400/80 block mt-0.5">
                            dried &amp; awaiting preparation
                        </span>
                    </div>

                    {/* Total Registered */}
                    <div className="p-4 rounded-xl border bg-gray-50 border-gray-200 dark:bg-gray-800/80 dark:border-gray-700">
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-sf-muted">
                                Total Registered
                            </span>
                            <Database size={16} className="text-gray-400 opacity-70" />
                        </div>
                        <span className="text-2xl font-black text-sf-text">{totalRegistered}</span>
                        <span className="text-[10px] text-gray-500 block mt-0.5">
                            all registered samples in lab
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ReceptionDashboard;
