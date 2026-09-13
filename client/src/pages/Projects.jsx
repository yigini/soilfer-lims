import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import {
    Plus, Search, AlertCircle, ArrowRight, CheckCircle2,
    Database, RefreshCw, Filter, HelpCircle, Layers
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import NewProjectModal from '../components/projects/NewProjectModal';
import LegacyBackfillModal from '../components/projects/LegacyBackfillModal';

export const getProjectLabIds = (p) => {
    if (!p) return [];
    if (Array.isArray(p.assignedLabs) && p.assignedLabs.length > 0) return p.assignedLabs;
    if (Array.isArray(p.assignedLabIds) && p.assignedLabIds.length > 0) return p.assignedLabIds;
    if (typeof p.assignedLabIds === 'string' && p.assignedLabIds.trim()) {
        try {
            const parsed = JSON.parse(p.assignedLabIds);
            if (Array.isArray(parsed)) return parsed;
        } catch (e) {}
    }
    return [];
};

export default function Projects() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { user, hasPermission } = useAuth();
    const { t } = useLanguage();

    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [filterTab, setFilterTab] = useState('all'); // 'all' | 'attention'
    const [searchQuery, setSearchQuery] = useState('');
    const [newProjectModalOpen, setNewProjectModalOpen] = useState(false);
    const [backfillModalOpen, setBackfillModalOpen] = useState(false);

    // Deep link redirection: if query parameter ?code=XXX or ?id=XXX is present, redirect to /projects/:id
    useEffect(() => {
        const code = searchParams.get('code');
        const id = searchParams.get('id');
        if (code || id) {
            navigate(`/projects/${encodeURIComponent(code || id)}`, { replace: true });
        }
    }, [searchParams, navigate]);

    const fetchProjects = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await axios.get('/api/projects?includeDeleted=false');
            const data = Array.isArray(res.data) ? res.data : [];
            setProjects(data);
        } catch (err) {
            console.error('[Projects] Error fetching projects:', err);
            setError(err.response?.data?.message || err.response?.data?.error || t('projects.errors.failedToFetch', 'Failed to load projects list.'));
        } finally {
            setLoading(false);
        }
    }, [t]);

    useEffect(() => {
        fetchProjects();
    }, [fetchProjects]);

    const canCreate = hasPermission('MANAGE_PROJECTS') || ['SUPER_ADMIN', 'ADMIN', 'MASTER_USER', 'LAB_MANAGER'].includes(user?.role);
    const isSuperAdmin = user?.role === 'SUPER_ADMIN';
    const isScoped = !['SUPER_ADMIN', 'ADMIN', 'MASTER_USER'].includes(user?.role) && Boolean(user?.labId);

    // Compute attention and filtering
    const processedProjects = useMemo(() => {
        return projects.map((p) => {
            const isDraft = p.status === 'DRAFT' || p.status === 'PENDING_MANIFEST';
            const isPaused = p.status === 'PAUSED';
            const counts = p.counts || {
                registered: p.sampleCount || 0,
                everPhysicallyReceived: p.receivedCount || 0,
                released: 0,
                awaitingArrival: 0
            };

            let dueText = t('projects.attention.noImmediateAction', 'No immediate action');
            let isAttention = false;

            if (isDraft) {
                dueText = t('projects.attention.completeSetup', 'Choose an analysis plan');
                isAttention = true;
            } else if (isPaused) {
                dueText = t('projects.attention.admissionsPaused', 'Admissions paused');
                isAttention = true;
            } else if (counts.awaitingArrival > 0) {
                dueText = t('projects.attention.samplesExpected', '{{count}} expected samples overdue', { count: counts.awaitingArrival });
                isAttention = true;
            } else if (p.deliveryDeadline && new Date(p.deliveryDeadline) < new Date() && p.status === 'ACTIVE') {
                dueText = t('projects.attention.deliveryOverdue', 'Delivery deadline reached');
                isAttention = true;
            }

            return {
                ...p,
                counts,
                dueText,
                isAttention
            };
        });
    }, [projects, t]);

    const filteredProjects = useMemo(() => {
        return processedProjects.filter((p) => {
            if (filterTab === 'attention' && !p.isAttention) {
                return false;
            }
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const nameMatch = (p.name || '').toLowerCase().includes(q);
                const codeMatch = (p.code || '').toLowerCase().includes(q);
                const clientMatch = (p.client || '').toLowerCase().includes(q);
                if (!nameMatch && !codeMatch && !clientMatch) return false;
            }
            return true;
        });
    }, [processedProjects, filterTab, searchQuery]);

    const attentionCount = useMemo(() => {
        return processedProjects.filter(p => p.isAttention).length;
    }, [processedProjects]);

    return (
        <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div>
                    <div className="text-xs uppercase tracking-wider font-bold text-sf-primary mb-1">
                        {t('projects.listEyebrow', 'Laboratory coordination')}
                    </div>
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-sf-text">
                        {t('projects.title', 'Projects')}
                    </h1>
                    <p className="text-sm text-sf-muted mt-1 max-w-xl">
                        {t('projects.listSubtitle', 'See what is coming, what needs attention, and where analytical work stands.')}
                    </p>
                    <div className="flex items-center gap-3 mt-3 flex-wrap text-xs">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full font-semibold bg-sf-surface border border-sf-border text-sf-text">
                            {isScoped ? t('projects.scope.thisLabLabel', 'Your laboratory') : t('projects.scope.allPermitted', 'All permitted projects')}
                        </span>
                        <span className="text-sf-muted">
                            {t('projects.truthfulCountsNote', 'Expected records and physical arrivals are shown separately.')}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap self-start md:self-auto">
                    {isSuperAdmin && (
                        <button
                            onClick={() => setBackfillModalOpen(true)}
                            className="px-3 py-2 rounded-lg border border-sf-border bg-sf-surface hover:bg-sf-hover text-sf-muted hover:text-sf-text text-xs font-semibold transition-colors"
                        >
                            {t('projects.dataTools', 'Data tools')}
                        </button>
                    )}
                    {canCreate && (
                        <button
                            onClick={() => setNewProjectModalOpen(true)}
                            className="btn-primary text-xs flex items-center gap-1.5"
                        >
                            <Plus className="w-4 h-4" />
                            <span>{t('projects.createProject', '+ New project')}</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-300 text-red-800 dark:text-red-200 text-xs flex items-center justify-between">
                    <span>{error}</span>
                    <button onClick={fetchProjects} className="text-xs font-bold underline">
                        {t('common.retry', 'Retry')}
                    </button>
                </div>
            )}

            {/* Toolbar: Filter Buttons & Search Input */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 p-1 rounded-xl bg-sf-inset border border-sf-divider self-start">
                    <button
                        onClick={() => setFilterTab('all')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                            filterTab === 'all'
                                ? 'bg-sf-surface text-sf-text shadow-sm'
                                : 'text-sf-muted hover:text-sf-text'
                        }`}
                    >
                        {t('projects.filters.allProjects', 'All projects')} ({projects.length})
                    </button>
                    <button
                        onClick={() => setFilterTab('attention')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                            filterTab === 'attention'
                                ? 'bg-sf-surface text-sf-primary shadow-sm'
                                : 'text-sf-muted hover:text-sf-text'
                        }`}
                    >
                        <span>{t('projects.filters.needsAttention', 'Needs attention')}</span>
                        {attentionCount > 0 && (
                            <span className="w-4 h-4 rounded-full bg-amber-500 text-white text-[10px] flex items-center justify-center font-bold">
                                {attentionCount}
                            </span>
                        )}
                    </button>
                </div>

                <div className="relative max-w-xs w-full">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-sf-muted" />
                    <input
                        type="text"
                        placeholder={t('projects.searchPlaceholder', 'Search project name or code…')}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-sf-border bg-sf-inset text-sf-text placeholder:text-sf-muted focus:ring-2 focus:ring-sf-primary focus:outline-none"
                    />
                </div>
            </div>

            {/* Project Cards Flush Container */}
            <div className="card-base rounded-2xl shadow-sm border border-sf-divider bg-sf-surface overflow-hidden">
                {/* Decorative Top Strip */}
                <div
                    className="h-1.5 w-full"
                    style={{ background: 'linear-gradient(90deg, #527953 0 32%, #b79558 32% 62%, #846547 62% 83%, #c5bd9f 83%)' }}
                />

                {loading ? (
                    <div className="py-16 flex flex-col items-center justify-center space-y-3">
                        <RefreshCw className="w-6 h-6 text-sf-primary animate-spin" />
                        <span className="text-xs text-sf-muted font-medium">{t('common.loading', 'Loading projects…')}</span>
                    </div>
                ) : filteredProjects.length === 0 ? (
                    <div className="py-16 text-center space-y-2 p-6">
                        <p className="text-sm font-semibold text-sf-text">
                            {filterTab === 'attention'
                                ? t('projects.emptyAttention', 'No projects need attention.')
                                : t('projects.noProjectsFound', 'No matching projects found.')}
                        </p>
                        <p className="text-xs text-sf-muted">
                            {filterTab === 'attention'
                                ? t('projects.viewAllHelper', 'View all {{count}} active projects in the overview.', { count: projects.length })
                                : t('projects.noProjectsSub', 'Try adjusting your search query or filters.')}
                        </p>
                        {filterTab === 'attention' && (
                            <button
                                onClick={() => setFilterTab('all')}
                                className="text-xs font-semibold text-sf-primary hover:underline pt-2 inline-block"
                            >
                                {t('projects.viewAllBtn', 'Switch to All projects')}
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="divide-y divide-sf-divider">
                        {filteredProjects.map((p) => {
                            const isDraft = p.status === 'DRAFT' || p.status === 'PENDING_MANIFEST';
                            const isPaused = p.status === 'PAUSED';
                            const isCompleted = p.status === 'COMPLETED' || p.status === 'ARCHIVED';

                            const badgeClass = isCompleted
                                ? 'bg-sf-muted/20 text-sf-muted border-sf-border'
                                : isPaused
                                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border-amber-300'
                                    : isDraft
                                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300 border-blue-300'
                                        : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-300';

                            return (
                                <article
                                    key={p.id}
                                    className="p-5 sm:p-6 hover:bg-sf-hover/30 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                                >
                                    {/* Left: Name & Code */}
                                    <div className="space-y-1 min-w-[200px] flex-1">
                                        <h2 className="text-base sm:text-lg font-bold text-sf-text hover:text-sf-primary transition-colors">
                                            <button
                                                onClick={() => navigate(`/projects/${encodeURIComponent(p.id || p.code)}`)}
                                                className="text-left font-bold"
                                            >
                                                {p.name}
                                            </button>
                                        </h2>
                                        <p className="text-xs text-sf-muted font-medium">
                                            <span className="font-mono font-bold text-sf-primary">{p.code}</span>
                                            {p.client ? ` · ${p.client}` : ''}
                                            {p.labId ? ` · ${p.labId}` : ''}
                                        </p>
                                    </div>

                                    {/* Status Badge & Scope */}
                                    <div className="w-32 shrink-0">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${badgeClass}`}>
                                            {p.status || 'ACTIVE'}
                                        </span>
                                        <p className="text-[11px] text-sf-muted mt-1">
                                            {isScoped ? t('projects.scope.thisLab', 'Your lab slice') : t('projects.scope.wholeProject', 'Whole project')}
                                        </p>
                                    </div>

                                    {/* Truthful Numbers: registered, ever received, released */}
                                    <div className="flex items-center gap-6 sm:gap-8 shrink-0 text-left">
                                        <div>
                                            <div className="text-lg sm:text-xl font-bold text-sf-text">
                                                {p.counts?.registered ?? 0}
                                            </div>
                                            <small className="text-[11px] text-sf-muted block">
                                                {t('projects.numbers.registered', 'registered')}
                                            </small>
                                        </div>
                                        <div>
                                            <div className="text-lg sm:text-xl font-bold text-sf-text">
                                                {p.counts?.everPhysicallyReceived ?? 0}
                                            </div>
                                            <small className="text-[11px] text-sf-muted block">
                                                {t('projects.numbers.receivedEver', 'received ever')}
                                            </small>
                                        </div>
                                        <div>
                                            <div className="text-lg sm:text-xl font-bold text-sf-text">
                                                {p.counts?.released ?? 0}
                                            </div>
                                            <small className="text-[11px] text-sf-muted block">
                                                {t('projects.numbers.releasedNow', 'released now')}
                                            </small>
                                        </div>
                                    </div>

                                    {/* Attention / Due Note */}
                                    <div className="min-w-[170px] shrink-0 text-xs">
                                        <div className={`font-semibold ${p.isAttention ? 'text-amber-700 dark:text-amber-400' : 'text-sf-muted'}`}>
                                            {p.dueText}
                                        </div>
                                        <p className="text-[11px] text-sf-muted mt-0.5">
                                            {p.isAttention ? t('projects.attention.nextStepInside', 'A clear next step inside') : t('projects.attention.readyForWork', 'Ready for routine work')}
                                        </p>
                                    </div>

                                    {/* Open Workspace Action */}
                                    <div className="shrink-0 flex items-center">
                                        <button
                                            onClick={() => navigate(`/projects/${encodeURIComponent(p.id || p.code)}`)}
                                            className="px-3 py-2 rounded-lg border border-sf-border bg-sf-surface hover:bg-sf-hover text-sf-text hover:border-sf-primary text-xs font-semibold transition-colors flex items-center gap-1 shadow-sm"
                                        >
                                            <span>{t('projects.openBtn', 'Open →')}</span>
                                        </button>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Explanatory Educational Note */}
            <div className="p-4 rounded-xl border border-sf-divider bg-sf-inset text-xs text-sf-muted">
                {t('projects.educationalBanner', 'This overview separates registered sample identifiers, physical laboratory arrivals, and analytical stages. Projects with pending field manifests no longer report misleading zero totals.')}
            </div>

            {/* Bottom Educational Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="card-base rounded-2xl p-6 shadow-sm border border-sf-divider bg-sf-surface space-y-2">
                    <h3 className="text-sm font-bold text-sf-text">
                        {t('projects.bottomCard1Title', 'Keep scientific work in the workbench')}
                    </h3>
                    <p className="text-xs text-sf-muted leading-relaxed">
                        {t('projects.bottomCard1Desc', 'Project workspaces coordinate admissions, default test packages, and facility responsibilities. All bench measurements, prep checklists, and quality signoffs remain in the authoritative workbench.')}
                    </p>
                </div>

                <div className="card-base rounded-2xl p-6 shadow-sm border border-sf-divider bg-sf-surface space-y-2">
                    <h3 className="text-sm font-bold text-sf-text">
                        {t('projects.bottomCard2Title', 'Useful context, controlled access')}
                    </h3>
                    <p className="text-xs text-sf-muted leading-relaxed">
                        {t('projects.bottomCard2Desc', 'Servicing laboratories focus on their own allocated sample batch. Project-wide governance, analysis plan revisions, and archival actions are restricted to authorized coordinating managers.')}
                    </p>
                </div>
            </div>

            {/* Modals */}
            <NewProjectModal
                isOpen={newProjectModalOpen}
                onClose={() => setNewProjectModalOpen(false)}
                onSuccess={(newProj) => {
                    fetchProjects();
                    if (newProj?.id || newProj?.code) {
                        navigate(`/projects/${encodeURIComponent(newProj.id || newProj.code)}`);
                    }
                }}
                userRole={user?.role}
                userLabId={user?.labId}
            />

            <LegacyBackfillModal
                isOpen={backfillModalOpen}
                onClose={() => setBackfillModalOpen(false)}
                projects={projects}
            />
        </div>
    );
}
