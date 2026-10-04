import React from 'react';
import { useLanguage } from '../../context/LanguageContext';

export default function CompletionReceipt({ receipt, onRetry, disabled = false }) {
    const { t } = useLanguage();
    if (!receipt) return null;
    return <section className="p-4 border border-amber-500/30 rounded-xl" role="alert">
        <h3 className="font-semibold">{t('workbench.recordingIncomplete', 'Recording incomplete')}</h3>
        <p>{t('workbench.recordedCount', 'Recorded')}: {receipt.saved}</p>
        <ul className="my-2 space-y-1">
            {receipt.errors.map((error, index) => <li key={`${error.workItemId}-${index}`}>
                <span className="font-mono">{error.sampleDisplayId || error.workItemId}</span>
                {' · '}{error.analysis || ''}{': '}{error.error || error.code}
            </li>)}
        </ul>
        <button type="button" className="btn-primary px-3 py-2" onClick={onRetry} disabled={disabled}>
            {t('workbench.retryFailed', 'Retry failed')}
        </button>
    </section>;
}
