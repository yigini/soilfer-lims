import React from 'react';
import { useNavigate } from 'react-router-dom';
import { HelpCircle, Settings, ChevronRight, ArrowLeft } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

export default function WorkspaceHeader({
    project,
    activeTab,
    onSelectTab,
    onOpenGuide,
    onOpenActions,
    capabilities = {},
    userRole = ''
}) {
    const navigate = useNavigate();
    const { t } = useLanguage();

    const isManager = ['SUPER_ADMIN', 'ADMIN', 'MASTER_USER', 'LAB_MANAGER', 'PROJECT_MANAGER'].includes(userRole);
    const isIntake = ['SAMPLE_RECEPTION', 'SURVEYOR'].includes(userRole);

    const tabs = [
        { id: 'overview', label: t('projects.tabs.overview', 'Overview') },
        { id: 'samples', label: t('projects.tabs.samples', 'Samples & arrivals') },
        { id: 'plan', label: t('projects.tabs.plan', 'Analysis plan') },
        { id: 'team', label: t('projects.tabs.team', 'Labs & people') },
        { id: 'connections', label: t('projects.tabs.connections', 'Data connections') },
        { id: 'activity', label: t('projects.tabs.activity', 'Activity') }
    ];

    const isDraft = project?.status === 'DRAFT' || project?.status === 'PENDING_MANIFEST';
    const isPaused = project?.status === 'PAUSED';
    const isCompleted = project?.status === 'COMPLETED' || project?.status === 'ARCHIVED';

    const statusBadgeClass = isCompleted
        ? 'bg-sf-muted/20 text-sf-muted border-sf-border'
        : isPaused
            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border-amber-300'
            : isDraft
                ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300 border-blue-300'
                : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-300';

    const statusDisplay = isDraft
        ? (project?.status === 'PENDING_MANIFEST' ? t('projects.pendingManifest', 'Awaiting Manifest') : t('projects.draft', 'Draft'))
        : isPaused
            ? t('projects.paused', 'Paused')
            : isCompleted
                ? t('projects.archived', 'Archived')
                : t('projects.active', 'Active');

    return (
        <header className="mb-6">
            {/* Breadcrumb */}
            <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-sf-muted mb-4">
                <button
                    onClick={() => navigate('/projects')}
                    className="hover:text-sf-primary transition-colors flex items-center gap-1 font-medium"
                >
                    <ArrowLeft className="w-4 h-4" />
                    {t('projects.breadcrumb', 'Projects')}
                </button>
                <span>/</span>
                <span className="font-mono font-bold text-sf-text">{project?.code}</span>
            </nav>

            {/* Header Content */}
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div>
                    <div className="text-xs uppercase tracking-wider font-bold text-sf-primary mb-1">
                        {t('projects.eyebrow', 'Project coordination')}
                    </div>
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-sf-text">
                        {project?.name}
                    </h1>
                    <p className="text-sm text-sf-muted mt-1 max-w-2xl">
                        {project?.description || t('projects.defaultSubtitle', 'From field sample to a reviewed, traceable laboratory result.')}
                    </p>
                    <div className="flex items-center gap-3 mt-3 flex-wrap text-xs">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full font-semibold border ${statusBadgeClass}`}>
                            {statusDisplay}
                        </span>
                        <span className="font-mono font-medium text-sf-muted">
                            {project?.code}
                        </span>
                        <span className="text-sf-divider">·</span>
                        <span className="text-sf-muted font-medium">
                            {capabilities.isScopedOnly
                                ? t('projects.scope.thisLab', 'Your lab slice')
                                : t('projects.scope.wholeProject', 'Whole project view')}
                        </span>
                    </div>
                </div>

                {/* Header Action Tools */}
                <div className="flex items-center gap-2 flex-wrap">
                    <button
                        onClick={onOpenGuide}
                        className="px-3 py-2 rounded-lg border border-sf-border bg-sf-surface hover:bg-sf-hover text-sf-text text-sm font-medium flex items-center gap-1.5 transition-colors shadow-sm"
                        title={t('projects.guideTooltip', 'Open page guide')}
                    >
                        <HelpCircle className="w-4 h-4 text-sf-muted" />
                        <span>{t('projects.pageGuide', 'Page guide')}</span>
                    </button>

                    {capabilities.canManage || isManager ? (
                        <button
                            onClick={onOpenActions}
                            className="px-3 py-2 rounded-lg border border-sf-border bg-sf-surface hover:bg-sf-hover text-sf-text text-sm font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
                        >
                            <Settings className="w-4 h-4 text-sf-muted" />
                            <span>{t('projects.actionsMenu', 'Project actions ▾')}</span>
                        </button>
                    ) : isIntake ? (
                        <button
                            onClick={() => navigate(`/reception?project=${encodeURIComponent(project?.code)}`)}
                            className="btn-primary text-sm flex items-center gap-1"
                        >
                            <span>{t('projects.openReception', 'Open reception →')}</span>
                        </button>
                    ) : (
                        <button
                            onClick={() => navigate(`/workbench?project=${encodeURIComponent(project?.code)}`)}
                            className="btn-primary text-sm flex items-center gap-1"
                        >
                            <span>{t('projects.openWorkbench', 'Open workbench →')}</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Horizontal Tabs with scroll container */}
            <nav className="flex gap-6 border-b border-sf-divider mt-6 overflow-x-auto no-scrollbar" aria-label="Project sections">
                {tabs.map((tab) => {
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => onSelectTab(tab.id)}
                            className={`pb-3 pt-1 text-sm font-semibold whitespace-nowrap transition-colors border-b-2 -mb-px ${
                                isActive
                                    ? 'border-sf-primary text-sf-primary'
                                    : 'border-transparent text-sf-muted hover:text-sf-text hover:border-sf-border'
                            }`}
                            aria-current={isActive ? 'page' : undefined}
                        >
                            {tab.label}
                        </button>
                    );
                })}
            </nav>
        </header>
    );
}
