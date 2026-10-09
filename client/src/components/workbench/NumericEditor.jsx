import React, { useRef } from 'react';
import { revertWorksheetCell } from './qcWorksheetNavigation';
import NumberPreview from './NumberPreview';
import BarcodeSafeInput from './BarcodeSafeInput';
import { useLanguage } from '../../context/LanguageContext';
import { classifyResultValue, loqQuickValue } from '@lims/result-value-validation';

/**
 * NumericEditor
 * Specialized numeric and qualified determination editor for laboratory methods.
 * Supports locale decimal commas ("6,42" -> 6.42), <LOQ / >Range qualifiers,
 * keyboard Enter navigation to advance to next row, and immediate draft updates.
 */
export default function NumericEditor({
    value,
    onChange,
    disabled = false,
    placeholder = '0.00',
    unit = '',
    validation = null,
    isInvalid = false,
    onEnterNext = null,
    ariaLabel = 'Numeric determination',
    inputRef = null,
    numberFormat,
    onBarcodeRejected = null,
    onRevertValue = null
}) {
    const { t } = useLanguage();
    const classified = classifyResultValue(value ?? '', validation, numberFormat);
    const red = isInvalid || classified.severity === 'RED';
    const amber = !red && classified.severity === 'AMBER';
    const quick = loqQuickValue(validation, numberFormat);
    const display = number => number == null ? t('valueValidation.notConfigured', 'Not configured')
        : String(number).replace('.', numberFormat?.decimal || '.');
    const tooltip = [['hardMin', 'min'], ['hardMax', 'max'], ['typicalMin', 'typicalMin'],
        ['typicalMax', 'typicalMax'], ['loq', 'loq'], ['lod', 'lod'], ['calibrationMax', 'calibrationMax']]
        .map(([label, key]) => `${t('valueValidation.' + label)}: ${display(validation?.[key])}`)
        .concat(`${t('valueValidation.unit', 'Unit')}: ${validation?.unit || unit || t('valueValidation.notConfigured', 'Not configured')}`)
        .join('\n');
    const Input = onBarcodeRejected ? BarcodeSafeInput : 'input';
    const focusValue = useRef(null);
    const handleKeyDown = (e) => {
        if (revertWorksheetCell(e, focusValue.current, onRevertValue)) return;
        if (e.key === '<' && quick.value !== null && !disabled) {
            e.preventDefault();
            onChange(quick.value);
            return;
        }
        if (e.key === 'Enter') {
            e.preventDefault();
            if (onEnterNext) {
                onEnterNext();
            }
        }
    };

    return (
        <div className="flex flex-wrap items-center gap-1.5" title={tooltip}
            data-value-severity={classified.severity} data-value-flags={classified.flags.join(',')}>
            <Input
                ref={inputRef}
                type="text"
                inputMode="decimal"
                value={value ?? ''}
                onChange={event => onChange(event.target.value)}
                onFocus={event => { focusValue.current = event.currentTarget.value; }}
                {...(onBarcodeRejected ? { onBarcodeRejected } : {})}
                onKeyDown={handleKeyDown}
                disabled={disabled}
                placeholder={placeholder}
                aria-label={ariaLabel}
                aria-invalid={red}
                className={`w-28 px-2.5 py-1.5 text-sm font-mono tabular-nums rounded-md border transition-colors
                    bg-sf-surface text-sf-text placeholder:text-sf-muted
                    ${red
                        ? 'border-[var(--sf-danger)] focus:ring-[var(--sf-danger)] focus:border-[var(--sf-danger)]'
                        : amber ? 'border-amber-500 focus:ring-amber-500 focus:border-amber-500'
                            : 'border-sf-control focus:ring-sf-primary focus:border-sf-primary'
                    }
                    ${disabled ? 'opacity-70 bg-sf-inset text-sf-muted cursor-not-allowed' : ''}
                    focus:outline-none focus:ring-1`}
            />
            {unit && (
                <span className="text-xs text-sf-muted select-none whitespace-nowrap">
                    {unit}
                </span>
            )}
            <NumberPreview value={value} numberFormat={numberFormat} />
            <button type="button" disabled={disabled || quick.value === null}
                aria-label={t('valueValidation.fillLoq', 'Fill method LOQ')}
                data-loq-code={quick.code || ''}
                title={quick.code ? t('valueValidation.' + quick.code) : t('valueValidation.fillLoq', 'Fill method LOQ')}
                onClick={() => quick.value !== null && onChange(quick.value)}
                className="text-xs px-1.5 py-1 border border-sf-divider rounded disabled:opacity-50">
                &lt; {t('valueValidation.loq', 'LOQ')}
            </button>
            {(red || amber) && <span role="status" className={`basis-full text-xs ${red ? 'text-[var(--sf-danger)]' : 'text-amber-700 dark:text-amber-300'}`}>
                {classified.flags.map(flag => t('valueValidation.flags.' + flag)).join(' · ')}
            </span>}
        </div>
    );
}
