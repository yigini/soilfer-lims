import React from 'react';
import numberParse from '@lims/number-parse';
import { useLanguage } from '../../context/LanguageContext';

export default function NumberPreview({ value, numberFormat, duplicateObservation = false }) {
    const { t } = useLanguage();
    if (value === null || value === undefined || String(value).trim() === '') return null;
    const parsed = duplicateObservation ? numberParse.parseDuplicateObservation(value, numberFormat) : numberParse.parseNumber(value, numberFormat);
    return <span className={`text-xs ${parsed.valid ? 'text-sf-muted' : 'text-red-600'}`} data-number-code={parsed.code || ''}>
        {parsed.valid ? `→ ${parsed.canonical}` : parsed.code === 'AMBIGUOUS_NUMBER'
            ? t('numbers.ambiguous', 'Clarify the decimal or thousands separator.')
            : parsed.code === 'NUMBER_FORMAT_POLICY_INVALID' ? t('numbers.policyInvalid', 'Laboratory number format is unavailable or invalid.')
                : t('numbers.invalid', 'Invalid number format.')}
    </span>;
}
