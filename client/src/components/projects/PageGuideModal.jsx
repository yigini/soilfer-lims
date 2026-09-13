import React from 'react';
import { X, CheckCircle2, AlertCircle, HelpCircle } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

export default function PageGuideModal({
    isOpen,
    onClose
}) {
    const { t } = useLanguage();
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="bg-sf-surface border border-sf-divider rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 my-auto">
                <div className="flex items-center justify-between pb-3 border-b border-sf-divider">
                    <div className="flex items-center gap-2">
                        <HelpCircle className="w-5 h-5 text-sf-primary" />
                        <h2 className="text-lg font-bold text-sf-text">
                            {t('projects.guide.title', 'Working with a project')}
                        </h2>
                    </div>
                    <button onClick={onClose} className="text-sf-muted hover:text-sf-text p-1 rounded-lg">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="space-y-3.5 text-xs text-sf-text leading-relaxed">
                    <div className="p-3.5 rounded-xl border border-sf-divider bg-sf-inset space-y-1">
                        <h3 className="font-bold text-sf-text text-sm">
                            {t('projects.guide.section1Title', 'Start with Next Actions')}
                        </h3>
                        <p className="text-sf-muted">
                            {t('projects.guide.section1Desc', 'Expected samples need physical receipt at reception. Submitted laboratory measurements require supervisor review. Each action links directly to the authorized workflow page.')}
                        </p>
                    </div>

                    <div className="p-3.5 rounded-xl border border-sf-divider bg-sf-inset space-y-1">
                        <h3 className="font-bold text-sf-text text-sm">
                            {t('projects.guide.section2Title', 'Check your laboratory scope')}
                        </h3>
                        <p className="text-sf-muted">
                            {t('projects.guide.section2Desc', 'Whole-project counts reflect all participating facilities combined, whereas your laboratory slice shows only the samples assigned to your bench. Counts never double-count samples.')}
                        </p>
                    </div>

                    <div className="p-3.5 rounded-xl border border-sf-divider bg-sf-inset space-y-1">
                        <h3 className="font-bold text-sf-text text-sm">
                            {t('projects.guide.section3Title', 'Use the workbench for results')}
                        </h3>
                        <p className="text-sf-muted">
                            {t('projects.guide.section3Desc', 'Project settings coordinate admissions, delivery deadlines, and responsibilities. Operational preparation checklist completion, analytical entries, and quality approval remain strictly in the workbench.')}
                        </p>
                    </div>
                </div>

                <div className="flex justify-end pt-2">
                    <button
                        onClick={onClose}
                        className="btn-primary text-xs"
                    >
                        {t('common.ok', 'Got it')}
                    </button>
                </div>
            </div>
        </div>
    );
}
