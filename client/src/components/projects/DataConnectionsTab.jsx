import React from 'react';
import { Upload, Smartphone, Database, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

export default function DataConnectionsTab({
    project,
    koboConfig,
    onOpenImportPreview,
    capabilities = {},
    userRole = ''
}) {
    const { t } = useLanguage();
    const canImport = capabilities.canImport || ['SUPER_ADMIN', 'ADMIN', 'LAB_MANAGER', 'PROJECT_MANAGER'].includes(userRole);

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
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold ${
                            koboConfig?.configured
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-300'
                                : 'bg-sf-inset text-sf-muted border border-sf-divider'
                        }`}>
                            {koboConfig?.configured ? t('projects.connections.koboActive', 'Configured') : t('projects.connections.koboNotConfigured', 'Not linked')}
                        </span>
                    </div>

                    <div className="space-y-2 text-xs">
                        <div className="flex justify-between py-2 border-b border-sf-divider">
                            <span className="text-sf-muted">{t('projects.connections.destinationProject', 'Destination project')}</span>
                            <strong className="font-semibold font-mono text-sf-text">{project?.code}</strong>
                        </div>
                        <div className="flex justify-between py-2 border-b border-sf-divider">
                            <span className="text-sf-muted">{t('projects.connections.destinationLab', 'Destination lab')}</span>
                            <strong className="font-semibold text-sf-text">{project?.labId || '—'}</strong>
                        </div>
                        <div className="flex justify-between py-2 border-b border-sf-divider">
                            <span className="text-sf-muted">{t('projects.connections.koboForm', 'Form / asset ID')}</span>
                            <strong className="font-semibold font-mono text-sf-text">
                                {koboConfig?.formId ? `${koboConfig.formId.substring(0, 10)}…` : '—'}
                            </strong>
                        </div>
                    </div>

                    <p className="text-[11px] text-sf-muted">
                        {t('projects.connections.koboSecurityNotice', 'API authentication credentials and secrets are encrypted server-side and never displayed in the browser.')}
                    </p>
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
