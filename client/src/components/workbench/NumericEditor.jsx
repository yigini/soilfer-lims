import React, { useRef } from 'react';
import { revertWorksheetCell } from './qcWorksheetNavigation';
import NumberPreview from './NumberPreview';
import BarcodeSafeInput from './BarcodeSafeInput';

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
    onRevertValue = null,
    worksheetColumn = null
}) {
    const Input = onBarcodeRejected ? BarcodeSafeInput : 'input';
    const focusValue = useRef(null);
    const handleKeyDown = (e) => {
        if (revertWorksheetCell(e, focusValue.current, onRevertValue)) return;
        if (e.key === 'Enter') {
            e.preventDefault();
            if (onEnterNext) {
                onEnterNext();
            }
        }
    };

    return (
        <div className="flex items-center gap-1.5">
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
                data-worksheet-column={worksheetColumn ?? undefined}
                aria-invalid={isInvalid}
                className={`w-28 px-2.5 py-1.5 text-sm font-mono tabular-nums rounded-md border transition-colors
                    bg-sf-surface text-sf-text placeholder:text-sf-muted
                    ${isInvalid
                        ? 'border-[var(--sf-danger)] focus:ring-[var(--sf-danger)] focus:border-[var(--sf-danger)]'
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
        </div>
    );
}
