import React from 'react';
import { useLanguage } from '../../context/LanguageContext';

export default function PreviousResultHint({ result }) {
    const { t } = useLanguage();
    if (!result || result.value === null || result.value === undefined) return null;
    return <p className="text-xs text-sf-muted" data-testid="previous-result">
        {t('workbench.previousValue', 'Previous')}: {result.value} {result.unit || ''}
        {' '}({result.isValid === false
            ? t('workbench.previousRejected', 'rejected')
            : t('workbench.previousRecorded', 'recorded')})
    </p>;
}
