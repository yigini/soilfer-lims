import React, { useMemo, useRef } from 'react';
import { calculateUsdaTexture } from '../../utils/soilCalculations';

/**
 * TextureEditor
 * 3-fraction soil texture determination editor (Sand %, Silt %, Clay %).
 * Enforces live closure rule: Sand + Silt + Clay = 100% ± 2.0%.
 * Dynamically computes USDA Texture Class.
 */
export default function TextureEditor({
    values = ['', '', ''],
    onChange,
    disabled = false,
    onEnterNext = null,
    sampleId = ''
}) {
    const rawValues = Array.isArray(values) ? values : ['', '', ''];
    const sandVal = rawValues[0] ?? '';
    const siltVal = rawValues[1] ?? '';
    const clayVal = rawValues[2] ?? '';

    const sandRef = useRef(null);
    const siltRef = useRef(null);
    const clayRef = useRef(null);

    const updateFraction = (index, val) => {
        const next = [...rawValues];
        while (next.length < 3) next.push('');
        next[index] = val;
        onChange(next);
    };

    const s = Number(String(sandVal).replace(',', '.')) || 0;
    const si = Number(String(siltVal).replace(',', '.')) || 0;
    const c = Number(String(clayVal).replace(',', '.')) || 0;

    const hasAny = sandVal !== '' || siltVal !== '' || clayVal !== '';
    const hasAll = sandVal !== '' && siltVal !== '' && clayVal !== '';

    const textureResult = useMemo(() => {
        if (!hasAll) return null;
        return calculateUsdaTexture(s, si, c, 2.0);
    }, [s, si, c, hasAll]);

    const total = Number((s + si + c).toFixed(1));
    const closureError = Number(Math.abs(100 - total).toFixed(1));
    const isClosurePassing = hasAll && closureError <= 2.0;

    return (
        <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Sand:</span>
                    <input
                        ref={sandRef}
                        type="text"
                        inputMode="decimal"
                        value={sandVal}
                        onChange={(e) => updateFraction(0, e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                siltRef.current?.focus();
                            }
                        }}
                        disabled={disabled}
                        placeholder="0.0"
                        aria-label={`${sampleId} Sand %`}
                        className="w-16 px-2 py-1 text-xs font-mono rounded border border-slate-300 dark:border-slate-700
                            bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    <span className="text-[10px] text-slate-400">%</span>
                </div>

                <div className="flex items-center gap-1">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Silt:</span>
                    <input
                        ref={siltRef}
                        type="text"
                        inputMode="decimal"
                        value={siltVal}
                        onChange={(e) => updateFraction(1, e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                clayRef.current?.focus();
                            }
                        }}
                        disabled={disabled}
                        placeholder="0.0"
                        aria-label={`${sampleId} Silt %`}
                        className="w-16 px-2 py-1 text-xs font-mono rounded border border-slate-300 dark:border-slate-700
                            bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    <span className="text-[10px] text-slate-400">%</span>
                </div>

                <div className="flex items-center gap-1">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Clay:</span>
                    <input
                        ref={clayRef}
                        type="text"
                        inputMode="decimal"
                        value={clayVal}
                        onChange={(e) => updateFraction(2, e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                if (onEnterNext) onEnterNext();
                            }
                        }}
                        disabled={disabled}
                        placeholder="0.0"
                        aria-label={`${sampleId} Clay %`}
                        className="w-16 px-2 py-1 text-xs font-mono rounded border border-slate-300 dark:border-slate-700
                            bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    <span className="text-[10px] text-slate-400">%</span>
                </div>
            </div>

            {hasAny && (
                <div className="flex items-center gap-1.5 flex-wrap">
                    {hasAll ? (
                        isClosurePassing ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300">
                                <span>✓ {total}%</span>
                                {textureResult?.className && (
                                    <span className="font-semibold">· {textureResult.className}</span>
                                )}
                            </span>
                        ) : (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300"
                                title={`Total is ${total}%. Allowed tolerance is 98% to 102%.`}>
                                <span>⚠ Sum {total}% (error {closureError}% &gt; ±2%)</span>
                            </span>
                        )
                    ) : (
                        <span className="text-[10px] text-slate-400 italic">
                            All 3 fractions required for closure check
                        </span>
                    )}
                </div>
            )}
        </div>
    );
}
