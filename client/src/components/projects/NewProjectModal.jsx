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
    const [submitting, setSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    if (!isOpen) return null;

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
                labId: userLabId || null
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
                                {t('projects.create.admissionModeLabel', 'Admission mode')}
                            </label>
                            <select
                                value={projectType}
                                onChange={(e) => setProjectType(e.target.value)}
                                className="w-full text-xs rounded-xl border border-sf-border bg-sf-inset p-2.5 text-sf-text"
                            >
                                <option value="OPEN_INTAKE">{t('projects.create.openIntake', 'Open Intake (Ad-hoc)')}</option>
                                <option value="TEMPLATE_PREDEFINED_IDS">{t('projects.create.predefinedManifest', 'Predefined Manifest')}</option>
                                <option value="KOBO_LINKED">{t('projects.create.koboLinked', 'KoboToolbox Linked')}</option>
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
