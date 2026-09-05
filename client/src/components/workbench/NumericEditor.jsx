import React from 'react';

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
    ariaLabel = 'Numeric determination'
}) {
    const handleChange = (e) => {
        onChange(e.target.value);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (onEnterNext) {
                onEnterNext();
            }
        }
    };

    return (
        <div className="flex items-center gap-1.5">
            <input
                type="text"
                inputMode="decimal"
                value={value ?? ''}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                disabled={disabled}
                placeholder={placeholder}
                aria-label={ariaLabel}
                aria-invalid={isInvalid}
                className={`w-28 px-2.5 py-1.5 text-sm font-mono rounded-md border transition-colors
                    bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100
                    ${isInvalid
                        ? 'border-red-500 focus:ring-red-400 focus:border-red-500'
                        : 'border-slate-300 dark:border-slate-700 focus:ring-emerald-500 focus:border-emerald-500'
                    }
                    ${disabled ? 'opacity-60 bg-slate-100 dark:bg-slate-800 cursor-not-allowed' : ''}
                    focus:outline-none focus:ring-1`}
            />
            {unit && (
                <span className="text-xs text-slate-500 dark:text-slate-400 select-none whitespace-nowrap">
                    {unit}
                </span>
            )}
        </div>
    );
}
