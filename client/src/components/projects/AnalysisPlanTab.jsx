import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Beaker, Layers, Activity, AlertCircle, CheckCircle2, ArrowRight, Settings } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

export default function AnalysisPlanTab({
    project,
    capabilities = {},
    userRole = '',
    onOpenConfigurePlan
}) {
    const navigate = useNavigate();
    const { t } = useLanguage();

    const [loading, setLoading] = useState(false);
    const [bundleGroup, setBundleGroup] = useState(null);
    const [resolvedAnalyses, setResolvedAnalyses] = useState([]);
    const [gates, setGates] = useState([]);
    const [fetchError, setFetchError] = useState(null);

    const bundleName = project?.defaultAnalysisBundle;
    const isManager = ['SUPER_ADMIN', 'ADMIN', 'MASTER_USER', 'LAB_MANAGER', 'PROJECT_MANAGER'].includes(userRole);

    const loadPlanData = React.useCallback(async () => {
        setLoading(true);
        setFetchError(null);

        try {
            const [groupsRes, analysesRes, gatesRes] = await Promise.allSettled([
                axios.get('/api/config/groups'),
                axios.get('/api/config/analyses'),
                axios.get('/api/config/gates')
            ]);

            const failedEndpoints = [];
            if (groupsRes.status === 'rejected') {
                failedEndpoints.push(`Analysis packages (${groupsRes.reason?.response?.status || groupsRes.reason?.message || 'Network error'})`);
            }
            if (analysesRes.status === 'rejected') {
                failedEndpoints.push(`Methods catalogue (${analysesRes.reason?.response?.status || analysesRes.reason?.message || 'Network error'})`);
            }

            if (failedEndpoints.length > 0) {
                setFetchError(failedEndpoints.join('; '));
                setBundleGroup(null);
                setResolvedAnalyses([]);
                if (gatesRes.status === 'fulfilled' && Array.isArray(gatesRes.value?.data)) {
                    setGates(gatesRes.value.data);
                }
                return;
            }

            const allGroups = Array.isArray(groupsRes.value?.data) ? groupsRes.value.data : [];
            const allAnalyses = Array.isArray(analysesRes.value?.data) ? analysesRes.value.data : [];
            const allGates = gatesRes.status === 'fulfilled' && Array.isArray(gatesRes.value?.data) ? gatesRes.value.data : [];

            setGates(allGates);

            if (bundleName) {
                const cleanName = String(bundleName).trim().toLowerCase();
                const matched = allGroups.find(g =>
                    (g.id && String(g.id).toLowerCase() === cleanName) ||
                    (g.name && String(g.name).toLowerCase() === cleanName)
                );

                if (matched) {
                    setBundleGroup(matched);
                    const rawAnalyses = Array.isArray(matched.analyses) ? matched.analyses : [];
                    const resolved = rawAnalyses.map(item => {
                        const code = typeof item === 'string' ? item : (item?.code || '');
                        const full = allAnalyses.find(a => a.code === code);
                        return full || {
                            code,
                            name: (typeof item === 'object' && item?.name) || code,
                            units: (typeof item === 'object' && item?.units) || '—',
                            methodLabel: null
                        };
                    });
                    setResolvedAnalyses(resolved);
                } else {
                    setBundleGroup(null);
                    setResolvedAnalyses([]);
                }
            } else {
                setBundleGroup(null);
                setResolvedAnalyses([]);
            }
        } catch (err) {
            setFetchError(err.message || 'Failed to load catalogue');
        } finally {
            setLoading(false);
        }
    }, [bundleName]);

    useEffect(() => {
        loadPlanData();
    }, [loadPlanData]);

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
                                {bundleGroup?.name || bundleName || t('projects.plan.noBundleTitle', 'No analysis bundle assigned')}
                            </h2>
                            {project?.updatedAt && (
                                <p className="text-xs text-sf-muted mt-0.5">
                                    {t('projects.plan.lastSynchronized', 'Last updated: ')}{new Date(project.updatedAt).toLocaleDateString()}
                                </p>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            {bundleName && (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-300">
                                    {t('projects.plan.currentBadge', 'Active bundle')}
                                </span>
                            )}
                            {capabilities.canManage && onOpenConfigurePlan && (
                                <button
                                    onClick={onOpenConfigurePlan}
                                    className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg border border-sf-border bg-sf-inset hover:bg-sf-hover text-sf-primary transition-colors"
                                >
                                    <Settings className="w-3.5 h-3.5" />
                                    <span>{bundleName ? t('projects.plan.changePackage', 'Change package') : t('projects.plan.selectPackage', 'Select package')}</span>
                                </button>
                            )}
                        </div>
                    </div>

                    {loading ? (
                        <div className="py-12 text-center text-xs text-sf-muted">
                            {t('common.loading', 'Loading analytical plan definitions…')}
                        </div>
                    ) : fetchError ? (
                        /* Explicit Error State: Catalogue endpoints failed */
                        <div className="p-6 rounded-xl border border-red-300 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 space-y-3">
                            <div className="flex items-start gap-3">
                                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
                                <div className="space-y-1">
                                    <h3 className="text-sm font-bold text-red-900 dark:text-red-200">
                                        {t('projects.plan.catalogueLoadErrorTitle', 'Failed to load analysis catalogue definitions')}
                                    </h3>
                                    <p className="text-xs text-red-700 dark:text-red-300">
                                        {t('projects.plan.catalogueLoadErrorDesc', 'The system could not retrieve master methods or packages from the server: {{error}}', { error: fetchError })}
                                    </p>
                                </div>
                            </div>
                            <div className="pt-1">
                                <button
                                    onClick={loadPlanData}
                                    className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-red-300 dark:border-red-800 bg-white dark:bg-sf-surface hover:bg-red-100 dark:hover:bg-red-950/50 text-red-800 dark:text-red-200 transition-colors"
                                >
                                    {t('common.retry', 'Retry')}
                                </button>
                            </div>
                        </div>
                    ) : !bundleName ? (
                        /* Honest Empty State: No Bundle Configured */
                        <div className="p-8 text-center rounded-xl border border-dashed border-sf-divider bg-sf-inset/50 space-y-3">
                            <Layers className="w-10 h-10 text-sf-muted mx-auto opacity-50" />
                            <div className="space-y-1">
                                <h3 className="text-sm font-bold text-sf-text">
                                    {t('projects.plan.emptyHeading', 'No default analysis bundle configured')}
                                </h3>
                                <p className="text-xs text-sf-muted max-w-md mx-auto">
                                    {t('projects.plan.emptyDesc', 'This project does not define an automatic analysis package. Incoming samples will receive tests assigned individually or specified upon physical receipt.')}
                                </p>
                            </div>
                            {capabilities.canManage && onOpenConfigurePlan ? (
                                <div className="flex items-center justify-center gap-2 pt-2">
                                    <button
                                        onClick={onOpenConfigurePlan}
                                        className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-sf-primary text-white hover:bg-sf-primary-hover shadow-sm transition-colors"
                                    >
                                        <Settings className="w-3.5 h-3.5" />
                                        <span>{t('projects.plan.selectPackage', 'Select analysis package')}</span>
                                    </button>
                                    <button
                                        onClick={() => navigate('/admin/methods')}
                                        className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-sf-border bg-sf-surface hover:bg-sf-hover text-sf-muted transition-colors"
                                    >
                                        <span>{t('projects.plan.openCatalogue', 'Configure packages in catalogue →')}</span>
                                    </button>
                                </div>
                            ) : isManager && (
                                <button
                                    onClick={() => navigate('/admin/methods')}
                                    className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-sf-border bg-sf-surface hover:bg-sf-hover text-sf-primary transition-colors"
                                >
                                    <span>{t('projects.plan.openCatalogue', 'Configure packages in catalogue →')}</span>
                                </button>
                            )}
                        </div>
                    ) : resolvedAnalyses.length === 0 ? (
                        /* Honest Empty State: Bundle assigned but no methods found in catalogue */
                        <div className="p-6 rounded-xl border border-sf-divider bg-sf-inset space-y-2">
                            <p className="text-xs font-semibold text-sf-text">
                                {t('projects.plan.bundleUnresolvedTitle', 'Bundle assigned but not defined in catalogue')}
                            </p>
                            <p className="text-xs text-sf-muted">
                                {t('projects.plan.bundleUnresolvedDesc', 'Project specifies bundle "{bundleName}", but no active parameter list was found in the laboratory analysis catalogue.', { bundleName })}
                            </p>
                            {isManager && (
                                <button
                                    onClick={() => navigate('/admin/methods')}
                                    className="text-xs font-semibold text-sf-primary hover:underline pt-1 inline-block"
                                >
                                    {t('projects.plan.createPackageInCatalogue', 'Define this package in catalogue →')}
                                </button>
                            )}
                        </div>
                    ) : (
                        /* Authoritative Method Items from Catalogue */
                        <div className="space-y-3">
                            {resolvedAnalyses.map((item, idx) => (
                                <div key={item.code || idx} className="p-4 rounded-xl border border-sf-divider bg-sf-inset flex items-start gap-3.5">
                                    <div className="w-9 h-9 rounded-lg bg-sf-surface border border-sf-divider text-sf-primary font-mono font-bold flex items-center justify-center shrink-0 text-xs">
                                        {item.code ? item.code.substring(0, 4) : 'TEST'}
                                    </div>
                                    <div className="space-y-0.5 flex-1">
                                        <div className="flex items-center justify-between gap-2">
                                            <h3 className="text-sm font-bold text-sf-text">{item.name || item.code}</h3>
                                            {item.units && item.units !== '—' && (
                                                <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-sf-surface text-sf-muted border border-sf-divider">
                                                    {item.units}
                                                </span>
                                            )}
                                        </div>
                                        {item.methodLabel && (
                                            <div className="text-xs font-semibold text-sf-primary font-mono">{item.methodLabel}</div>
                                        )}
                                        {item.description && (
                                            <p className="text-xs text-sf-muted pt-0.5">{item.description}</p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Invariant Notice */}
                    <div className="p-4 rounded-xl border border-sf-divider bg-sf-hover/30 text-xs text-sf-muted space-y-1">
                        <strong className="text-sf-text font-semibold">
                            {t('projects.plan.invariantNoticeTitle', 'Applies to future intake and orders')}
                        </strong>
                        <p>
                            {t('projects.plan.invariantNoticeDesc', 'Changing project bundles affects future sample intake. Existing registered samples retain their snapshot analytical work items.')}
                        </p>
                    </div>

                    {isManager ? (
                        <div className="flex items-center gap-2 flex-wrap">
                            {capabilities.canManage && onOpenConfigurePlan && (
                                <button
                                    onClick={onOpenConfigurePlan}
                                    className="text-xs font-semibold px-4 py-2 rounded-lg border border-sf-primary bg-sf-primary/10 hover:bg-sf-primary/20 text-sf-primary transition-colors inline-flex items-center gap-1.5"
                                >
                                    <Settings className="w-3.5 h-3.5" />
                                    <span>{t('projects.plan.configurePlan', 'Configure project plan')}</span>
                                </button>
                            )}
                            <button
                                onClick={() => navigate('/admin/methods')}
                                className="text-xs font-semibold px-4 py-2 rounded-lg border border-sf-border bg-sf-surface hover:bg-sf-hover text-sf-text transition-colors"
                            >
                                {t('projects.plan.manageCatalogue', 'Manage catalogue definitions')}
                            </button>
                        </div>
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
                        {t('projects.plan.beforeBenchTitle', 'Operational workflow gates')}
                    </h3>

                    <div className="space-y-2.5 text-xs">
                        {gates.length > 0 ? (
                            gates.map((g, idx) => (
                                <div key={g.id || idx} className="flex justify-between py-2 border-b border-sf-divider last:border-0">
                                    <span className="text-sf-muted">{g.name || g.code}</span>
                                    <strong className="font-semibold text-sf-text">{g.module || 'Workbench'}</strong>
                                </div>
                            ))
                        ) : (
                            <>
                                <div className="flex justify-between py-2 border-b border-sf-divider">
                                    <span className="text-sf-muted">{t('projects.plan.gateIntake', 'Intake & identity verification')}</span>
                                    <strong className="font-semibold text-sf-text">{t('projects.plan.receptionModule', 'Reception')}</strong>
                                </div>
                                <div className="flex justify-between py-2 border-b border-sf-divider">
                                    <span className="text-sf-muted">{t('projects.plan.gateDrying', 'Required drying / preparation')}</span>
                                    <strong className="font-semibold text-sf-text">{t('projects.plan.workbenchModule', 'Workbench')}</strong>
                                </div>
                                <div className="flex justify-between py-2 border-b border-sf-divider last:border-0">
                                    <span className="text-sf-muted">{t('projects.plan.gateMethod', 'Analytical readiness')}</span>
                                    <strong className="font-semibold text-sf-text">{t('projects.plan.workbenchModule', 'Workbench')}</strong>
                                </div>
                            </>
                        )}
                    </div>

                    <p className="text-xs text-sf-muted leading-relaxed">
                        {t('projects.plan.gatesDesc', 'Operational preparation gates are driven by laboratory SOPs and catalogue rules, not static placeholders.')}
                    </p>
                </div>

                <div className="card-base rounded-2xl p-6 shadow-sm border border-sf-divider bg-sf-surface space-y-3">
                    <h3 className="text-sm font-bold text-sf-text">
                        {t('projects.plan.availabilityTitle', 'Method availability by laboratory')}
                    </h3>
                    <p className="text-xs text-sf-muted leading-relaxed">
                        {t('projects.plan.availabilityDesc', 'Participating servicing laboratories must have validated instrumentation and method capability before receiving sample consignments.')}
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
