import React, { useState } from 'react';
import axios from 'axios';
import { Upload, Smartphone, Database, CheckCircle2, AlertTriangle, ArrowRight, RefreshCw } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

export default function DataConnectionsTab({
    project,
    koboConfig,
    onOpenImportPreview,
    capabilities = {},
    userRole = ''
}) {
    const { t } = useLanguage();
    // F12 FIX: Enforce exact server-provided capability without role-based override
    const canImport = Boolean(capabilities.canImport);
    const canManageConnections = Boolean(capabilities.canManageConnections);

    const [actionMsg, setActionMsg] = useState(null);
    const [syncing, setSyncing] = useState(false);
    const [toggling, setToggling] = useState(false);

    const handleSync = async (configId) => {
        if (!configId || !project?.id) return;
        setSyncing(true);
        setActionMsg(null);
        try {
            const res = await axios.post(`/api/projects/${project.id}/kobo-connections/${configId}/sync`);
            setActionMsg({ type: 'success', text: `Sync complete: ${res.data.newSamples || 0} new samples imported.` });
        } catch (err) {
            setActionMsg({ type: 'error', text: err.response?.data?.message || err.message || 'Sync failed' });
        } finally {
            setSyncing(false);
        }
    };

    const handleToggle = async (configId) => {
        if (!configId || !project?.id) return;
        setToggling(true);
        setActionMsg(null);
        try {
            const res = await axios.post(`/api/projects/${project.id}/kobo-connections/${configId}/toggle`);
            setActionMsg({ type: 'success', text: `Connection status updated to ${res.data.isActive ? 'Active' : 'Disabled'}.` });
        } catch (err) {
            setActionMsg({ type: 'error', text: err.response?.data?.message || err.message || 'Toggle failed' });
        } finally {
            setToggling(false);
        }
    };

    const isConfigured = Boolean(koboConfig?.configured);
    const isAmbiguous = Boolean(koboConfig?.ambiguous);
    const effectiveFormId = koboConfig?.formId || koboConfig?.koboFormId;
    const destinationLab = koboConfig?.labId || project?.labId;

    const getKoboStatusBadge = () => {
        if (isAmbiguous) {
            return (
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-300">
                    {t('projects.connections.koboAmbiguous', 'Multiple lab configs')}
                </span>
            );
        }
        if (isConfigured) {
            const isActive = koboConfig?.isActive !== false;
            return (
                <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold ${
                    isActive
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-300'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-300'
                }`}>
                    {isActive ? t('projects.connections.koboActive', 'Configured') : t('projects.connections.koboDisabled', 'Disabled')}
                </span>
            );
        }
        return (
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-sf-inset text-sf-muted border border-sf-divider">
                {t('projects.connections.koboNotConfigured', 'Not linked')}
            </span>
        );
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Manifests Card */}
                <div className="card-base rounded-2xl p-6 shadow-sm border border-sf-divider bg-sf-surface space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-bold text-sf-text">
                            {t('projects.connections.manifestsTitle', 'Expected sample manifests')}
                        </h2>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-sf-primary/10 text-sf-primary border border-sf-primary/20">
                            {project?.projectType === 'TEMPLATE_PREDEFINED_IDS' ? t('projects.connections.manifestRequired', 'Predefined IDs') : t('projects.connections.manifestSupported', 'Manifest supported')}
                        </span>
                    </div>

                    <p className="text-xs text-sf-muted">
                        {t('projects.connections.manifestsDesc', 'Upload and preview planned field sample identifiers before arrival. Validates duplicate detection and destination laboratory isolation.')}
                    </p>

                    <div className="space-y-2 text-xs">
                        <div className="flex justify-between py-2 border-b border-sf-divider">
                            <span className="text-sf-muted">{t('projects.connections.admissionType', 'Admission mode')}</span>
                            <strong className="font-semibold text-sf-text">{project?.projectType || 'OPEN_INTAKE'}</strong>
                        </div>
                        <div className="flex justify-between py-2 border-b border-sf-divider">
                            <span className="text-sf-muted">{t('projects.connections.targetCount', 'Planned target volume')}</span>
                            <strong className="font-semibold text-sf-text">{project?.expectedSampleCount || '—'}</strong>
                        </div>
                    </div>

                    <button
                        onClick={onOpenImportPreview}
                        className="btn-primary text-xs w-full sm:w-auto mt-2"
                        disabled={!canImport}
                    >
                        {canImport ? t('projects.connections.previewManifest', 'Preview a manifest') : t('projects.connections.manifestReadOnly', 'View manifest specs')}
                    </button>

                    <p className="text-[11px] text-sf-muted">
                        {t('projects.connections.previewNotice', 'Previewing validates rows and conflicts without registering or creating samples in the database.')}
                    </p>
                </div>

                {/* KoboToolbox Integration Card */}
                <div className="card-base rounded-2xl p-6 shadow-sm border border-sf-divider bg-sf-surface space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-bold text-sf-text">
                            {t('projects.connections.koboTitle', 'Kobo field collection')}
                        </h2>
                        {getKoboStatusBadge()}
                    </div>

                    <div className="space-y-2 text-xs">
                        <div className="flex justify-between py-2 border-b border-sf-divider">
                            <span className="text-sf-muted">{t('projects.connections.destinationProject', 'Destination project')}</span>
                            <strong className="font-semibold font-mono text-sf-text">{project?.code}</strong>
                        </div>
                        <div className="flex justify-between py-2 border-b border-sf-divider">
                            <span className="text-sf-muted">{t('projects.connections.destinationLab', 'Destination lab')}</span>
                            <strong className="font-semibold text-sf-text">{destinationLab || '—'}</strong>
                        </div>
                        <div className="flex justify-between py-2 border-b border-sf-divider">
                            <span className="text-sf-muted">{t('projects.connections.koboForm', 'Form / asset ID')}</span>
                            <strong className="font-semibold font-mono text-sf-text">
                                {effectiveFormId ? `${effectiveFormId.substring(0, 10)}…` : (isAmbiguous ? t('projects.connections.seeBelow', 'See connected labs') : '—')}
                            </strong>
                        </div>
                    </div>

                    {isAmbiguous && Array.isArray(koboConfig?.configs) && (
                        <div className="p-2.5 rounded-xl bg-sf-inset/50 border border-sf-divider space-y-1.5 text-[11px]">
                            <span className="font-semibold text-sf-text">{t('projects.connections.participatingConfigs', 'Configured Servicing Labs:')}</span>
                            <div className="space-y-1">
                                {koboConfig.configs.map(c => (
                                    <div key={c.configId || c.labId} className="flex justify-between text-sf-muted">
                                        <span className="font-mono text-sf-text">{c.labId}</span>
                                        <span className="font-mono">{c.formId ? `${c.formId.substring(0, 8)}…` : '—'}</span>
                                        <span className={c.isActive ? 'text-emerald-600' : 'text-amber-600'}>{c.status}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <p className="text-[11px] text-sf-muted">
                        {t('projects.connections.koboSecurityNotice', 'API authentication credentials and secrets are managed server-side with restricted access controls and never returned to the browser.')}
                    </p>

                    {/* Action buttons when user has connection management capability */}
                    {canManageConnections && (koboConfig?.configId || (Array.isArray(koboConfig?.configs) && koboConfig.configs.length > 0)) && (
                        <div className="pt-2 border-t border-sf-divider space-y-2">
                            {actionMsg && (
                                <div className={`p-2 rounded-lg text-xs ${actionMsg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-300' : 'bg-red-50 text-red-800 border border-red-300'}`}>
                                    {actionMsg.text}
                                </div>
                            )}
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => handleSync(koboConfig?.configId || koboConfig?.configs?.[0]?.configId)}
                                    disabled={syncing}
                                    className="btn-secondary text-xs flex items-center gap-1.5"
                                >
                                    <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                                    <span>{syncing ? t('common.syncing', 'Syncing…') : t('projects.connections.syncNow', 'Sync Now')}</span>
                                </button>
                                <button
                                    onClick={() => handleToggle(koboConfig?.configId || koboConfig?.configs?.[0]?.configId)}
                                    disabled={toggling}
                                    className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-sf-border bg-sf-surface hover:bg-sf-hover text-sf-text"
                                >
                                    {koboConfig?.isActive !== false ? t('projects.connections.disable', 'Disable') : t('projects.connections.enable', 'Enable')}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* SIS & Released Data Exchange Card */}
            <div className="card-base rounded-2xl p-6 shadow-sm border border-sf-divider bg-sf-surface space-y-3">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-sf-text">
                            {t('projects.connections.sisTitle', 'SIS & released data exchange')}
                        </h2>
                        <p className="text-xs text-sf-muted mt-0.5">
                            {t('projects.connections.sisSubtitle', 'Project provenance and analytical release integrity remain permanent.')}
                        </p>
                    </div>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-sf-inset text-sf-text border border-sf-divider">
                        {t('projects.connections.sisGoverned', 'Governed API')}
                    </span>
                </div>

                <p className="text-xs text-sf-muted leading-relaxed">
                    {t('projects.connections.sisDesc', 'Only data approved and released through quality review is accessible by external SIS consumers and authorized API keys. Project archiving preserves released snapshots and report checksums without data loss.')}
                </p>
            </div>
        </div>
    );
}
