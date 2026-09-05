import React, { useState } from 'react';
import { AlertCircle, Check, ArrowRight } from 'lucide-react';

/**
 * ConflictComparePanel
 * Revision-based concurrency resolution component.
 * Displays local draft vs server value side-by-side and requires explicit resolution:
 * either adopt the server value or retain local draft with mandatory rationale.
 */
export default function ConflictComparePanel({
    localValue,
    serverValue,
    onUseServer,
    onKeepLocal
}) {
    const [reason, setReason] = useState('');
    const [error, setError] = useState('');

    const handleKeepLocal = () => {
        if (!reason.trim()) {
            setError('A reason is mandatory to retain your local draft over the server value.');
            return;
        }
        setError('');
        onKeepLocal(reason.trim());
    };

    return (
        <div className="p-3.5 rounded-lg border border-amber-300 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-950/30 text-slate-800 dark:text-slate-200">
            <div className="flex items-center gap-2 mb-2 text-amber-800 dark:text-amber-300">
                <AlertCircle size={16} />
                <span className="font-semibold text-xs uppercase tracking-wider">Concurrency Conflict Detected</span>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 mb-3 leading-relaxed">
                This item was updated on the server while you were editing. Both values are preserved below for review:
            </p>

            <div className="grid grid-cols-2 gap-2 p-2.5 rounded bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800/40 mb-3 text-xs">
                <div>
                    <span className="block text-[10px] uppercase font-bold text-slate-400">Your Local Draft</span>
                    <span className="text-sm font-mono font-semibold text-blue-600 dark:text-blue-400">
                        {localValue || '<empty>'}
                    </span>
                </div>
                <div>
                    <span className="block text-[10px] uppercase font-bold text-slate-400">Server Value</span>
                    <span className="text-sm font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                        {serverValue || '<empty>'}
                    </span>
                </div>
            </div>

            <div className="flex flex-col gap-2">
                <button
                    type="button"
                    onClick={onUseServer}
                    className="w-full py-1.5 px-3 rounded text-xs font-medium bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center gap-1.5 transition-colors"
                >
                    <Check size={14} className="text-emerald-500" />
                    <span>Adopt Server Value ({serverValue})</span>
                </button>

                <div className="border-t border-amber-200 dark:border-amber-800/50 pt-2 mt-1">
                    <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                        Reason for retaining local draft (required):
                    </label>
                    <textarea
                        rows={2}
                        value={reason}
                        onChange={(e) => {
                            setReason(e.target.value);
                            if (error) setError('');
                        }}
                        placeholder="e.g. Verified against physical laboratory bench notebook..."
                        className="w-full p-2 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                    {error && (
                        <span className="text-[11px] text-red-600 dark:text-red-400 font-medium block mt-1">
                            {error}
                        </span>
                    )}

                    <button
                        type="button"
                        onClick={handleKeepLocal}
                        className="w-full mt-2 py-1.5 px-3 rounded text-xs font-medium bg-amber-600 hover:bg-amber-700 text-white flex items-center justify-center gap-1.5 transition-colors"
                    >
                        <ArrowRight size={14} />
                        <span>Keep Local Draft with Reason</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
