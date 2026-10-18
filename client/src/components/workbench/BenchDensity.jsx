import React from 'react';
import { useLanguage } from '../../context/LanguageContext';

export const BENCH_DENSITY_KEY = 'soilfer.workbenchDensity';
export function readBenchDensity(storage) {
    try { return (storage === undefined ? globalThis.localStorage : storage)?.getItem(BENCH_DENSITY_KEY) === 'bench' ? 'bench' : 'standard'; }
    catch { return 'standard'; }
}

// An ergonomic device preference; it never changes the separate bench PIN,
// idle-lock settings, laboratory policy or analytical data.
export default function BenchDensity({ value, onChange }) {
    const { t } = useLanguage();
    const choose = next => {
        try { globalThis.localStorage?.setItem(BENCH_DENSITY_KEY, next); } catch { /* Device storage may be unavailable. */ }
        onChange(next);
    };
    return <div role="group" aria-label={t('benchErgonomics.density')} className="inline-flex gap-1 rounded-lg border border-sf-divider p-1">
        {['standard', 'bench'].map(option => <button key={option} type="button" aria-pressed={value === option}
            onClick={() => choose(option)} className={`min-h-[44px] min-w-[44px] rounded px-3 text-sm font-semibold ${value === option ? 'bg-sf-primary text-white' : 'text-sf-text hover:bg-sf-hover'}`}>
            {t(`benchErgonomics.${option}`)}
        </button>)}
    </div>;
}
