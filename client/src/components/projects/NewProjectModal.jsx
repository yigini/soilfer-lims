import React, { useState } from 'react';
import axios from 'axios';
import { X, Plus, Building2, CheckCircle2 } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

export default function NewProjectModal({
    isOpen,
    onClose,
    onSuccess,
    userRole = '',
    userLabId = ''
}) {
    const { t } = useLanguage();
    const [name, setName] = useState('');
    const [code, setCode] = useState('');
    const [client, setClient] = useState('');
    const [projectType, setProjectType] = useState('OPEN_INTAKE');
    const [expectedSampleCount, setExpectedSampleCount] = useState('');
    const [priority, setPriority] = useState('NORMAL');
    const [koboFormId, setKoboFormId] = useState('');
    const [koboApiToken, setKoboApiToken] = useState('');
    const [koboServerUrl, setKoboServerUrl] = useState('https://kf.kobotoolbox.org');
    const [destinationLabId, setDestinationLabId] = useState(userLabId || '');
    const [availableLabs, setAvailableLabs] = useState([]);
    const [submitting, setSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    React.useEffect(() => {
        if (isOpen) {
            axios.get('/api/labs')
                .then(res => {
                    if (Array.isArray(res.data)) {
                        setAvailableLabs(res.data.filter(l => l.isActive !== false));
                    }
                })
                .catch(() => {});
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const isKoboRelevant = projectType === 'KOBO_LINKED' || projectType === 'SOILFER_V1';

    const getPolicyExplanation = () => {
        switch (projectType) {
            case 'SOILFER_V1':
                return t('projects.create.policySoilfer', 'SoilFER Country Project: Kobo is the default registration channel. Manual desk intake requires an authorized exception record. Applies standard SoilFER analytical bundle.');
            case 'KOBO_LINKED':
                return t('projects.create.policyGenericKobo', 'Generic Kobo Project: Connects Kobo forms to specific servicing laboratories without inheriting SoilFER-specific bundle rules.');
            case 'TEMPLATE_PREDEFINED_IDS':
                return t('projects.create.policyManifest', 'Predefined Manifest: Samples must match pre-registered identifiers before reception.');
            case 'OPEN_INTAKE':
            default:
                return t('projects.create.policyOpen', 'Generic Open Intake: Authorized staff can register and receive samples directly at the reception desk without exception restrictions.');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const trimmedName = name.trim();
        const trimmedCode = code.trim().toUpperCase();

        if (!trimmedName) {
            setErrorMessage(t('projects.create.nameRequired', 'Project name is required.'));
            return;
        }

        if (!trimmedCode || !/^[A-Z0-9-]+$/.test(trimmedCode)) {
            setErrorMessage(t('projects.create.codeInvalid', 'Project code must contain only uppercase letters, numbers, and hyphens.'));
            return;
        }

        if (projectType === 'KOBO_LINKED' && (!koboFormId.trim() || !koboApiToken.trim())) {
            setErrorMessage(t('projects.create.koboRequired', 'Kobo Form ID and API Token are required for Kobo-linked projects.'));
            return;
        }

        if (projectType === 'KOBO_LINKED' && !destinationLabId.trim()) {
            setErrorMessage(t('projects.create.destinationLabRequired', 'Destination laboratory is required for Kobo-linked projects.'));
            return;
        }

        setSubmitting(true);
        setErrorMessage('');

        try {
            const payload = {
                name: trimmedName,
                code: trimmedCode,
                client: client.trim() || null,
                projectType,
                expectedSampleCount: expectedSampleCount ? parseInt(expectedSampleCount, 10) : 0,
                priority,
                labId: userLabId || null,
                destinationLabId: destinationLabId.trim() || userLabId || null,
                koboFormId: koboFormId.trim() || null,
                koboApiToken: koboApiToken.trim() || null,
                koboServerUrl: koboServerUrl.trim() || 'https://kf.kobotoolbox.org'
            };

            const res = await axios.post('/api/projects', payload);
            onSuccess?.(res.data);
            onClose();
        } catch (err) {
            setErrorMessage(err.response?.data?.message || err.response?.data?.error || 'Failed to create project');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="bg-sf-surface border border-sf-divider rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 my-auto">
                <div className="flex items-center justify-between pb-3 border-b border-sf-divider">
                    <div>
                        <h2 className="text-lg font-bold text-sf-text">
                            {t('projects.create.modalTitle', 'Create new project')}
                        </h2>
                        <p className="text-xs text-sf-muted mt-0.5">
                            {t('projects.create.modalSubtitle', 'Establish project identity, coordinate intake mode, and configure admission parameters.')}
                        </p>
                    </div>
                    <button onClick={onClose} className="text-sf-muted hover:text-sf-text p-1 rounded-lg">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {errorMessage && (
                    <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-300 text-red-800 dark:text-red-200 text-xs">
                        {errorMessage}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-3.5">
                    <div>
                        <label className="block text-xs font-semibold text-sf-text mb-1">
                            {t('projects.create.nameLabel', 'Project name *')}
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder={t('projects.create.namePlaceholder', 'e.g. SoilFER Guatemala Survey 2027')}
                            className="w-full text-xs rounded-xl border border-sf-border bg-sf-inset p-2.5 text-sf-text placeholder:text-sf-muted"
                            required
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-sf-text mb-1">
                                {t('projects.create.codeLabel', 'Permanent project code *')}
                            </label>
                            <input
                                type="text"
                                value={code}
                                onChange={(e) => setCode(e.target.value.toUpperCase())}
                                placeholder="GTM-SOIL-2027"
                                className="w-full text-xs font-mono font-bold rounded-xl border border-sf-border bg-sf-inset p-2.5 text-sf-text placeholder:text-sf-muted uppercase"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-sf-text mb-1">
                                {t('projects.create.clientLabel', 'Client / Partner organization')}
                            </label>
                            <input
                                type="text"
                                value={client}
                                onChange={(e) => setClient(e.target.value)}
                                placeholder="FAO / Ministry of Ag"
                                className="w-full text-xs rounded-xl border border-sf-border bg-sf-inset p-2.5 text-sf-text placeholder:text-sf-muted"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-sf-text mb-1">
                                {t('projects.create.admissionModeLabel', 'Project template & admission mode')}
                            </label>
                            <select
                                value={projectType}
                                onChange={(e) => setProjectType(e.target.value)}
                                className="w-full text-xs rounded-xl border border-sf-border bg-sf-inset p-2.5 text-sf-text"
                            >
                                <option value="OPEN_INTAKE">{t('projects.create.openIntake', 'Generic Open Intake')}</option>
                                <option value="TEMPLATE_PREDEFINED_IDS">{t('projects.create.predefinedManifest', 'Predefined Manifest')}</option>
                                <option value="KOBO_LINKED">{t('projects.create.koboLinked', 'Generic KoboToolbox')}</option>
                                <option value="SOILFER_V1">{t('projects.create.soilferCountry', 'SoilFER Country Project')}</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-sf-text mb-1">
                                {t('projects.create.targetCountLabel', 'Expected sample count')}
                            </label>
                            <input
                                type="number"
                                min="0"
                                value={expectedSampleCount}
                                onChange={(e) => setExpectedSampleCount(e.target.value)}
                                placeholder="120"
                                className="w-full text-xs rounded-xl border border-sf-border bg-sf-inset p-2.5 text-sf-text placeholder:text-sf-muted"
                            />
                        </div>
                    </div>

                    {/* Policy summary box */}
                    <div className="p-2.5 rounded-xl bg-sf-inset/60 border border-sf-border/60 text-[11px] text-sf-muted leading-relaxed">
                        {getPolicyExplanation()}
                    </div>

                    {/* Optional / Required Kobo connection fields */}
                    {isKoboRelevant && (
                        <div className="p-3 rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/40 dark:bg-emerald-950/20 space-y-2.5">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                                    {t('projects.create.koboSetupTitle', 'KoboToolbox Data Connection')}
                                </span>
                                <span className="text-[10px] text-emerald-700 dark:text-emerald-400">
                                    {projectType === 'KOBO_LINKED' ? t('projects.create.required', 'Required') : t('projects.create.optional', 'Optional setup')}
                                </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-[11px] font-medium text-sf-text mb-1">
                                        {t('projects.create.koboFormId', 'Form / Asset ID')}
                                    </label>
                                    <input
                                        type="text"
                                        value={koboFormId}
                                        onChange={(e) => setKoboFormId(e.target.value.trim())}
                                        placeholder="aYU8RNGWt..."
                                        className="w-full text-xs font-mono rounded-lg border border-sf-border bg-sf-surface p-2 text-sf-text"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-medium text-sf-text mb-1">
                                        {t('projects.create.koboApiToken', 'API Token')}
                                    </label>
                                    <input
                                        type="password"
                                        value={koboApiToken}
                                        onChange={(e) => setKoboApiToken(e.target.value.trim())}
                                        placeholder="••••••••••••"
                                        className="w-full text-xs font-mono rounded-lg border border-sf-border bg-sf-surface p-2 text-sf-text"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[11px] font-medium text-sf-text mb-1">
                                    {t('projects.create.destinationLab', 'Destination Laboratory *')}
                                </label>
                                <select
                                    value={destinationLabId}
                                    onChange={(e) => setDestinationLabId(e.target.value)}
                                    className="w-full text-xs rounded-lg border border-sf-border bg-sf-surface p-2 text-sf-text"
                                    required={projectType === 'KOBO_LINKED'}
                                >
                                    <option value="">{t('projects.create.selectDestinationLab', '-- Select Servicing Laboratory --')}</option>
                                    {availableLabs.map(lab => (
                                        <option key={lab.id} value={lab.id}>
                                            {lab.name} ({lab.code || lab.id}) {lab.country ? `[${lab.country}]` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    )}

                    <div className="flex justify-end gap-2 pt-3 border-t border-sf-divider">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-sf-border text-sf-muted hover:bg-sf-hover"
                        >
                            {t('common.cancel', 'Cancel')}
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="btn-primary text-xs"
                        >
                            {submitting ? t('common.loading', 'Creating…') : t('projects.create.createBtn', 'Create project draft')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
