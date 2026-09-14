import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Clock, CheckCircle2, ArrowRight, ExternalLink } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

export default function OverviewTab({
    project,
    counts,
    stats,
    onSelectStage,
    onSelectTab,
    capabilities = {},
    userRole = ''
}) {
    const navigate = useNavigate();
    const { t } = useLanguage();

    const stageItems = [
        {
            key: 'awaitingArrival',
            label: t('projects.stages.awaitingArrival', 'Awaiting arrival'),
            desc: t('projects.stages.notReceivedYet', 'Not received yet'),
            color: '#b69f76',
            count: counts?.awaitingArrival ?? 0,
            stageIndex: 0
        },
        {
            key: 'intakeInProgress',
            label: t('projects.stages.intakeInProgress', 'Intake in progress'),
            desc: t('projects.stages.openMatchingList', 'Open matching list →'),
            color: '#c0904a',
            count: counts?.intakeInProgress ?? 0,
            stageIndex: 1
        },
        {
            key: 'labWork',
            label: t('projects.stages.labWork', 'Lab work'),
            desc: t('projects.stages.openMatchingList', 'Open matching list →'),
            color: '#638a6a',
            count: counts?.labWork ?? 0,
            stageIndex: 2
        },
        {
            key: 'awaitingReview',
            label: t('projects.stages.awaitingReview', 'Awaiting review'),
            desc: t('projects.stages.openMatchingList', 'Open matching list →'),
            color: '#548092',
            count: counts?.awaitingReview ?? 0,
            stageIndex: 3
        },
        {
            key: 'released',
            label: t('projects.stages.released', 'Released'),
            desc: t('projects.stages.approvedOutput', 'Approved output available'),
            color: '#2c6c50',
            count: counts?.released ?? 0,
            stageIndex: 4
        },
        {
            key: 'rejectedOrCancelled',
            label: t('projects.stages.rejectedOrCancelled', 'Rejected / cancelled'),
            desc: t('projects.stages.openMatchingList', 'Open matching list →'),
            color: '#9caaa0',
            count: counts?.rejectedOrCancelled ?? 0,
            stageIndex: 5
        }
    ];

    const totalRegistered = counts?.registered ?? 0;
    const everReceived = counts?.everPhysicallyReceived ?? 0;
    const targetCount = project?.expectedSampleCount || stats?.target || null;

    const isPaused = project?.status === 'PAUSED';
    const isCompleted = project?.status === 'COMPLETED' || project?.status === 'ARCHIVED';

    return (
        <div className="space-y-6">
            {/* Admissions Banner */}
            {isPaused && (
                <div className="p-4 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 text-sm flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div>
                        <strong className="font-semibold">
                            {t('projects.notices.admissionsPaused', 'Admissions are paused.')}
                        </strong>
                        <p className="mt-0.5">
                            {t('projects.notices.admissionsPausedDesc', 'Existing received work remains governed by the workbench; no sample is automatically completed.')}
                        </p>
                    </div>
                </div>
            )}

            {isCompleted && (
                <div className="p-4 rounded-xl border border-sf-border bg-sf-surface text-sf-muted text-sm flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-sf-muted shrink-0 mt-0.5" />
                    <div>
                        <strong className="font-semibold text-sf-text">
                            {t('projects.notices.projectArchived', 'Project is archived.')}
                        </strong>
                        <p className="mt-0.5">
                            {t('projects.notices.projectArchivedDesc', 'Admissions are closed. Historical samples, reports, and audit trails remain permanently accessible.')}
                        </p>
                    </div>
                </div>
            )}

            {/* Where the samples are: Stages Card */}
            <div className="card-base rounded-2xl p-6 shadow-sm border border-sf-divider bg-sf-surface">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                    <div>
                        <h2 className="text-lg font-bold text-sf-text">
                            {t('projects.overview.whereSamplesAre', 'Where the samples are')}
                        </h2>
                        <p className="text-xs text-sf-muted mt-0.5">
                            {capabilities.isScopedOnly
                                ? t('projects.overview.scopedRegisteredCount', '{{count}} registered in your laboratory · Current stages, counted once per sample', { count: totalRegistered })
                                : t('projects.overview.wholeRegisteredCount', '{{count}} registered across this project · Current stages, counted once per sample', { count: totalRegistered })}
                        </p>
                    </div>
                    <button
                        onClick={() => onSelectStage('all')}
                        className="text-xs font-semibold text-sf-primary hover:underline flex items-center gap-1 self-start sm:self-auto"
                    >
                        <span>{t('projects.overview.viewSamplesLink', 'View samples →')}</span>
                    </button>
                </div>

                {/* 6 Stage Buttons Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 mt-4">
                    {stageItems.map((stage) => (
                        <button
                            key={stage.key}
                            onClick={() => onSelectStage(String(stage.stageIndex))}
                            className="p-3.5 rounded-xl text-left bg-sf-inset hover:bg-sf-hover border border-sf-divider transition-all group"
                        >
                            <span
                                className="inline-block h-1.5 w-5 rounded-sm mb-2"
                                style={{ backgroundColor: stage.color }}
                            />
                            <div className="text-2xl font-bold tracking-tight text-sf-text group-hover:text-sf-primary transition-colors">
                                {stage.count}
                            </div>
                            <div className="text-xs font-semibold text-sf-text mt-1 leading-tight">
                                {stage.label}
                            </div>
                            <span className="text-[11px] text-sf-muted block mt-1">
                                {stage.desc}
                            </span>
                        </button>
                    ))}
                </div>

                {/* Segmented Progress Bar */}
                <div className="h-2 flex rounded-full overflow-hidden mt-5 bg-sf-divider/40" aria-hidden="true">
                    {totalRegistered > 0 ? (
                        stageItems.map((stage) => {
                            const pct = (stage.count / totalRegistered) * 100;
                            if (pct === 0) return null;
                            return (
                                <span
                                    key={stage.key}
                                    style={{ width: `${pct}%`, backgroundColor: stage.color }}
                                    className="h-full transition-all"
                                    title={`${stage.label}: ${stage.count}`}
                                />
                            );
                        })
                    ) : (
                        <span className="w-full bg-sf-divider/50 h-full" />
                    )}
                </div>

                {/* Footer Metadata */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-sf-muted mt-3 pt-2 border-t border-sf-divider/50 gap-2">
                    <span>
                        <strong className="text-sf-text font-semibold">{everReceived}</strong> {t('projects.overview.everPhysicallyReceived', 'samples have a physical receipt event')}
                    </span>
                    <span>
                        {targetCount
                            ? `${t('projects.overview.targetLabel', 'Target')}: ${targetCount} ${t('projects.overview.samples', 'samples')}`
                            : capabilities.isScopedOnly
                                ? t('projects.overview.labTargetNotAllocated', 'Lab target not allocated')
                                : t('projects.overview.projectTargetNotSet', 'Project target: not set')}
                    </span>
                </div>
            </div>

            {/* Split Section: Next Actions & At a Glance */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Next Actions (2 cols) */}
                <div className="lg:col-span-2 card-base rounded-2xl p-6 shadow-sm border border-sf-divider bg-sf-surface space-y-4">
                    <h2 className="text-lg font-bold text-sf-text">
                        {t('projects.overview.nextActions', 'Next actions')}
                    </h2>

                    {/* Attention Item 1: Expected Samples */}
                    <div className="flex items-start gap-3.5 pt-3 border-t border-sf-divider">
                        <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 font-bold flex items-center justify-center shrink-0">
                            !
                        </div>
                        <div className="space-y-1 flex-1">
                            <h3 className="text-sm font-bold text-sf-text">
                                {t('projects.overview.actionExpectedTitle', 'Follow up on {{count}} expected samples', { count: counts?.awaitingArrival ?? 0 })}
                            </h3>
                            <p className="text-xs text-sf-muted">
                                {t('projects.overview.actionExpectedDesc', 'Expected samples have not arrived physically at reception; they are not workbench drying tasks.')}
                            </p>
                            <button
                                onClick={() => onSelectStage('0')}
                                className="text-xs font-semibold text-sf-primary hover:underline flex items-center gap-1 pt-1"
                            >
                                <span>{t('projects.overview.seeExpected', 'See expected samples →')}</span>
                            </button>
                        </div>
                    </div>

                    {/* Attention Item 2: Submitted Work */}
                    <div className="flex items-start gap-3.5 pt-3 border-t border-sf-divider">
                        <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 font-bold flex items-center justify-center shrink-0">
                            {counts?.awaitingReview ?? 0}
                        </div>
                        <div className="space-y-1 flex-1">
                            <h3 className="text-sm font-bold text-sf-text">
                                {t('projects.overview.actionReviewTitle', 'Submitted work is ready for review')}
                            </h3>
                            <p className="text-xs text-sf-muted">
                                {userRole === 'LAB_TECHNICIAN'
                                    ? t('projects.overview.actionReviewTech', 'Your manager will review submitted measurements. You can monitor submission progress.')
                                    : t('projects.overview.actionReviewManager', 'Open the review queue to review complete analytical submissions and quality checks.')}
                            </p>
                            <button
                                onClick={() => navigate(`/workbench?project=${encodeURIComponent(project?.code)}&state=submitted`)}
                                className="text-xs font-semibold text-sf-primary hover:underline flex items-center gap-1 pt-1"
                            >
                                <span>{userRole === 'LAB_TECHNICIAN' ? t('projects.overview.trackSubmissions', 'Track submissions →') : t('projects.overview.openReviewQueue', 'Open review queue →')}</span>
                            </button>
                        </div>
                    </div>

                    {/* Attention Item 3: Manifest / Connections Check */}
                    <div className="flex items-start gap-3.5 pt-3 border-t border-sf-divider">
                        <div className="w-8 h-8 rounded-lg bg-sf-inset text-sf-muted font-bold flex items-center justify-center shrink-0">
                            {project?.projectType === 'TEMPLATE_PREDEFINED_IDS' ? 'M' : 'K'}
                        </div>
                        <div className="space-y-1 flex-1">
                            <h3 className="text-sm font-bold text-sf-text">
                                {t('projects.overview.actionImportTitle', 'Review sample intake and import channels')}
                            </h3>
                            <p className="text-xs text-sf-muted">
                                {t('projects.overview.actionImportDesc', 'Validate manifest files or Kobo collection channels. Historical records and accession identity remain preserved.')}
                            </p>
                            <button
                                onClick={() => onSelectTab('connections')}
                                className="text-xs font-semibold text-sf-primary hover:underline flex items-center gap-1 pt-1"
                            >
                                <span>{t('projects.overview.reviewConnections', 'Review data connections →')}</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Right Column: Project at a Glance (1 col) */}
                <aside className="space-y-6">
                    <div className="card-base rounded-2xl p-6 shadow-sm border border-sf-divider bg-sf-surface space-y-4">
                        <h3 className="text-sm font-bold text-sf-text">
                            {t('projects.overview.atAGlance', 'Project at a glance')}
                        </h3>

                        <div className="space-y-2.5 text-xs">
                            <div className="flex justify-between py-2 border-b border-sf-divider">
                                <span className="text-sf-muted">{t('projects.overview.coordinatingLab', 'Coordinating laboratory')}</span>
                                <strong className="font-semibold text-sf-text">{project?.labId || t('projects.overview.centralCoordination', 'Central coordination')}</strong>
                            </div>
                            <div className="flex justify-between py-2 border-b border-sf-divider">
                                <span className="text-sf-muted">{t('projects.overview.client', 'Client / Organization')}</span>
                                <strong className="font-semibold text-sf-text">{project?.client || '—'}</strong>
                            </div>
                            <div className="flex justify-between py-2 border-b border-sf-divider">
                                <span className="text-sf-muted">{t('projects.overview.defaultPlan', 'Default analysis plan')}</span>
                                <strong className={`font-semibold ${project?.defaultAnalysisBundle ? 'text-sf-text' : 'text-sf-muted'}`}>
                                    {project?.defaultAnalysisBundle || t('projects.plan.noBundleTitle', 'No analysis bundle assigned')}
                                </strong>
                            </div>
                            <div className="flex justify-between py-2 border-b border-sf-divider">
                                <span className="text-sf-muted">{t('projects.overview.nextDelivery', 'Delivery deadline')}</span>
                                <strong className="font-semibold text-sf-text">
                                    {project?.deliveryDeadline ? new Date(project.deliveryDeadline).toLocaleDateString() : '—'}
                                </strong>
                            </div>
                        </div>

                        <button
                            onClick={() => onSelectTab('team')}
                            className="text-xs font-semibold text-sf-primary hover:underline flex items-center gap-1 pt-1"
                        >
                            <span>{t('projects.overview.viewTeamLink', 'Labs, people and responsibilities →')}</span>
                        </button>
                    </div>

                    {/* Laboratory Instructions Callout */}
                    <div className="p-5 rounded-2xl border border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/30 text-xs text-sf-text space-y-2">
                        <div className="text-[11px] uppercase tracking-wider font-bold text-amber-700 dark:text-amber-400">
                            {t('projects.overview.labInstructionsTitle', 'Laboratory instructions')}
                        </div>
                        <h4 className="font-bold text-sm text-sf-text">
                            {t('projects.overview.instructionHeading', 'Keep field label with the specimen')}
                        </h4>
                        <p className="text-sf-muted leading-relaxed">
                            {project?.notes || t('projects.overview.defaultInstructions', 'Confirm the sampling depth at reception. Use the effective method instructions for preparation. Record exceptions before passing work to analytical benches.')}
                        </p>
                    </div>
                </aside>
            </div>
        </div>
    );
}
