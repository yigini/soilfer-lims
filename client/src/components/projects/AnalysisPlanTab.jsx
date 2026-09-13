import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Beaker, Layers, Activity, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

export default function AnalysisPlanTab({
    project,
    capabilities = {},
    userRole = ''
}) {
    const navigate = useNavigate();
    const { t } = useLanguage();

    const planItems = [
        {
            icon: 'pH',
            title: t('projects.plan.phTitle', 'Soil pH'),
            method: t('projects.plan.phMethod', '1:2.5 H2O / 1:2.5 0.01M CaCl2'),
            desc: t('projects.plan.phDesc', 'Method and extractant resolved from the master catalogue definition. Potentiometric determination.')
        },
        {
            icon: '%',
            title: t('projects.plan.textureTitle', 'Particle size & texture'),
            method: t('projects.plan.textureMethod', 'Hydrometer method (Bouyoucos)'),
            desc: t('projects.plan.textureDesc', 'Sand, silt, and clay entered together. USDA textural class computed automatically upon verification.')
        },
        {
            icon: '∿',
            title: t('projects.plan.mirTitle', 'Mid-infrared spectroscopy (MIR)'),
            method: t('projects.plan.mirMethod', 'Diffuse reflectance (FT-MIR 4000-600 cm⁻¹)'),
            desc: t('projects.plan.mirDesc', 'Spectral file workflow with instrument ID, background subtraction, and OPUS format verification.')
        }
    ];

    const isManager = ['SUPER_ADMIN', 'ADMIN', 'MASTER_USER', 'LAB_MANAGER', 'PROJECT_MANAGER'].includes(userRole);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 cols: Effective Plan */}
            <div className="lg:col-span-2 space-y-6">
                <div className="card-base rounded-2xl p-6 shadow-sm border border-sf-divider bg-sf-surface space-y-5">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-xs uppercase tracking-wider font-bold text-sf-primary mb-0.5">
                                {t('projects.plan.effectivePlan', 'Effective plan')}
                            </div>
                            <h2 className="text-xl font-bold text-sf-text">
                                {project?.defaultAnalysisBundle || t('projects.plan.defaultBundleName', 'Routine soil characterization')}
                            </h2>
                            <p className="text-xs text-sf-muted mt-0.5">
                                {t('projects.plan.revisionSnapshot', 'Revision 3 · Effective for orders created from 1 September 2026')}
                            </p>
                        </div>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-300">
                            {t('projects.plan.currentBadge', 'Current')}
                        </span>
                    </div>

                    {/* Method Items Stack */}
                    <div className="space-y-3">
                        {planItems.map((item, idx) => (
                            <div key={idx} className="p-4 rounded-xl border border-sf-divider bg-sf-inset flex items-start gap-3.5">
                                <div className="w-9 h-9 rounded-lg bg-sf-surface border border-sf-divider text-sf-primary font-mono font-bold flex items-center justify-center shrink-0 text-sm">
                                    {item.icon}
                                </div>
                                <div className="space-y-0.5 flex-1">
                                    <h3 className="text-sm font-bold text-sf-text">{item.title}</h3>
                                    <div className="text-xs font-semibold text-sf-primary font-mono">{item.method}</div>
                                    <p className="text-xs text-sf-muted pt-0.5">{item.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Invariant Notice */}
                    <div className="p-4 rounded-xl border border-sf-divider bg-sf-hover/30 text-xs text-sf-muted space-y-1">
                        <strong className="text-sf-text font-semibold">
                            {t('projects.plan.invariantNoticeTitle', 'Applies to future intake and orders')}
                        </strong>
                        <p>
                            {t('projects.plan.invariantNoticeDesc', 'Changing this default affects future sample registrations. Existing orders retain their snapshot method version and analytical results without disruption.')}
                        </p>
                    </div>

                    {isManager ? (
                        <button
                            onClick={() => alert(t('projects.plan.changeAlert', 'To adjust analysis bundles, edit project metadata in settings or catalogue definitions in Admin.'))}
                            className="text-xs font-semibold px-4 py-2 rounded-lg border border-sf-border bg-sf-surface hover:bg-sf-hover text-sf-text transition-colors"
                        >
                            {t('projects.plan.reviewPlanChange', 'Review a plan change')}
                        </button>
                    ) : (
                        <p className="text-xs text-sf-muted">
                            {t('projects.plan.readOnlyNotice', 'Your role has view-only access to this analysis plan. Contact the project manager to request modifications.')}
                        </p>
                    )}
                </div>
            </div>

            {/* Right 1 col: Operational Gates & Availability */}
            <aside className="space-y-6">
                <div className="card-base rounded-2xl p-6 shadow-sm border border-sf-divider bg-sf-surface space-y-4">
                    <h3 className="text-sm font-bold text-sf-text">
                        {t('projects.plan.beforeBenchTitle', 'Before a sample reaches the bench')}
                    </h3>

                    <div className="space-y-2.5 text-xs">
                        <div className="flex justify-between py-2 border-b border-sf-divider">
                            <span className="text-sf-muted">{t('projects.plan.gateIntake', 'Intake & identity verification')}</span>
                            <strong className="font-semibold text-sf-text">{t('projects.plan.receptionModule', 'Reception')}</strong>
                        </div>
                        <div className="flex justify-between py-2 border-b border-sf-divider">
                            <span className="text-sf-muted">{t('projects.plan.gateDrying', 'Required drying / preparation')}</span>
                            <strong className="font-semibold text-sf-text">{t('projects.plan.workbenchModule', 'Workbench')}</strong>
                        </div>
                        <div className="flex justify-between py-2 border-b border-sf-divider">
                            <span className="text-sf-muted">{t('projects.plan.gateMethod', 'Method-specific readiness')}</span>
                            <strong className="font-semibold text-sf-text">{t('projects.plan.workbenchModule', 'Workbench')}</strong>
                        </div>
                    </div>

                    <p className="text-xs text-sf-muted leading-relaxed">
                        {t('projects.plan.gatesDesc', 'Operational preparation gates are managed through task checklists, not as synthetic analytical values. Requirements are driven by the master catalogue.')}
                    </p>
                </div>

                <div className="card-base rounded-2xl p-6 shadow-sm border border-sf-divider bg-sf-surface space-y-3">
                    <h3 className="text-sm font-bold text-sf-text">
                        {t('projects.plan.availabilityTitle', 'Method availability by laboratory')}
                    </h3>
                    <p className="text-xs text-sf-muted leading-relaxed">
                        {t('projects.plan.availabilityDesc', 'Participating servicing laboratories must have validated instrumentation and reagent stock for selected methods before receiving shipments.')}
                    </p>
                    <button
                        onClick={() => navigate('/admin/methods')}
                        className="text-xs font-semibold text-sf-primary hover:underline flex items-center gap-1 pt-1"
                    >
                        <span>{t('projects.plan.viewCatalogueLink', 'View catalogue definitions →')}</span>
                    </button>
                </div>
            </aside>
        </div>
    );
}
