import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import axios from 'axios';

// #202 B12: bench mode is a per-device switch kept in this browser only. Lab
// policy decides the idle lock (bench.idleLockMinutes, 0 = off) and whether
// Record asks for the PIN (bench.pinAtRecord); nothing here is hard-coded.
export const BENCH_STORAGE_KEY = 'soilfer.benchMode';
const IDLE_CHECK_MS = 5000;

export function readBenchMode() {
    try { return localStorage.getItem(BENCH_STORAGE_KEY) === 'on'; } catch { return false; }
}

function PinForm({ t, title, onVerified, onCancel, pinSet, onPinSet }) {
    const fieldId = useId();
    const pinId = fieldId + '-pin';
    const passwordId = fieldId + '-password';
    const hintId = fieldId + '-hint';
    const [pin, setPin] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const submit = async event => {
        event.preventDefault();
        if (!/^\d{4,8}$/.test(pin)) {
            setError(t('bench.errors.BENCH_PIN_FORMAT_INVALID'));
            return;
        }
        setError('');
        try {
            if (!pinSet) {
                await axios.put('/api/auth/bench/pin', { password, pin });
                onPinSet?.();
            }
            await axios.post('/api/auth/bench/pin/verify', { pin });
            setPin('');
            onVerified();
        } catch (err) {
            const { code, error: message } = err.response?.data || {};
            setError(message || t(`bench.errors.${code}`, t('bench.errors.generic')));
        }
    };
    return (
        <form onSubmit={submit} data-testid="bench-pin-form" className="w-full max-w-xs space-y-3 rounded-lg bg-white p-6 shadow-xl dark:bg-slate-900">
            <h2 className="text-lg font-semibold">{pinSet ? title : t('bench.setPinTitle')}</h2>
            {!pinSet && <p className="text-sm">{t('bench.setPinHelp')}</p>}
            <div>
                <label htmlFor={pinId} className="block text-sm font-medium">{t(pinSet ? 'bench.pin' : 'bench.newPinLabel')}</label>
                <input id={pinId} type="password" inputMode="numeric" autoFocus aria-required="true"
                    aria-describedby={pinSet ? undefined : hintId} value={pin} onChange={event => setPin(event.target.value)}
                    className="w-full rounded border px-3 py-3 text-center text-2xl tracking-widest" />
                {!pinSet && <p id={hintId} className="mt-1 text-sm">{t('bench.pinHint')}</p>}
            </div>
            {!pinSet && (
                <div>
                    <label htmlFor={passwordId} className="block text-sm font-medium">{t('bench.passwordLabel')}</label>
                    <input id={passwordId} type="password" required value={password}
                        onChange={event => setPassword(event.target.value)} className="w-full rounded border px-3 py-2" />
                </div>
            )}
            {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-2">
                {onCancel && <button type="button" onClick={onCancel} className="min-h-[44px] rounded border px-4">{t('common.cancel', 'Cancel')}</button>}
                <button type="submit" className="min-h-[44px] rounded bg-blue-700 px-4 text-white">{t('bench.unlock')}</button>
            </div>
        </form>
    );
}

export default function BenchMode({ user, t, canManage, onSwitchAnalyst, registerRecordGuard }) {
    const [enabled, setEnabled] = useState(readBenchMode);
    const [settings, setSettings] = useState(null);
    const [locked, setLocked] = useState(false);
    const [recordPrompt, setRecordPrompt] = useState(null);
    const lastActivity = useRef(Date.now());
    const lockRef = useRef(null);

    useEffect(() => {
        if (!enabled) return;
        axios.get('/api/auth/bench').then(res => setSettings(res.data)).catch(() => setSettings(null));
    }, [enabled, user?.id]);

    // Idle lock: any key or pointer activity resets the clock while unlocked.
    useEffect(() => {
        const minutes = settings?.idleLockMinutes;
        if (!enabled || !minutes || typeof window === 'undefined') return undefined;
        lastActivity.current = Date.now();
        const onActivity = () => { lastActivity.current = Date.now(); };
        const timer = setInterval(() => {
            if (Date.now() - lastActivity.current >= minutes * 60 * 1000) setLocked(true);
        }, IDLE_CHECK_MS);
        window.addEventListener('keydown', onActivity, true);
        window.addEventListener('pointerdown', onActivity, true);
        return () => { clearInterval(timer); window.removeEventListener('keydown', onActivity, true); window.removeEventListener('pointerdown', onActivity, true); };
    }, [enabled, settings?.idleLockMinutes]);

    // While locked, nothing behind the overlay takes keys or focus: the field
    // the analyst was typing in loses focus and stray keys are swallowed.
    useEffect(() => {
        if (!locked || typeof window === 'undefined') return undefined;
        const inside = target => Boolean(lockRef.current && target && lockRef.current.contains(target));
        if (!inside(document.activeElement)) document.activeElement?.blur?.();
        const block = event => { if (!inside(event.target)) { event.preventDefault(); event.stopPropagation(); } };
        const refocus = event => { if (!inside(event.target)) { event.target?.blur?.(); lockRef.current?.querySelector('input')?.focus(); } };
        for (const type of ['keydown', 'keypress', 'beforeinput', 'paste']) window.addEventListener(type, block, true);
        window.addEventListener('focusin', refocus, true);
        return () => {
            for (const type of ['keydown', 'keypress', 'beforeinput', 'paste']) window.removeEventListener(type, block, true);
            window.removeEventListener('focusin', refocus, true);
        };
    }, [locked]);

    // Record confirmation: resolves true once the same analyst's PIN verifies.
    const confirmRecord = useCallback(() => {
        if (!enabled || !settings?.pinAtRecord) return Promise.resolve(true);
        return new Promise(resolve => setRecordPrompt({ resolve }));
    }, [enabled, settings?.pinAtRecord]);
    useEffect(() => registerRecordGuard?.(confirmRecord), [registerRecordGuard, confirmRecord]);

    const toggle = () => {
        const next = !enabled;
        try { localStorage.setItem(BENCH_STORAGE_KEY, next ? 'on' : 'off'); } catch { /* storage unavailable */ }
        setEnabled(next);
        setLocked(false);
    };
    const pinSet = settings?.pinSet;
    const markPinSet = () => setSettings(previous => ({ ...previous, pinSet: true }));

    return (
        <>
            <div data-testid="bench-header" className="flex items-center gap-2 text-sm">
                {enabled && <span data-testid="bench-analyst" className="rounded bg-amber-100 px-2 py-1 font-semibold text-amber-900">
                    {t('bench.analyst', { name: user?.name || user?.username })}
                </span>}
                {enabled && <button type="button" onClick={onSwitchAnalyst} className="min-h-[44px] rounded border px-3">{t('bench.switchAnalyst')}</button>}
                {canManage && <button type="button" onClick={toggle} aria-pressed={enabled} className="min-h-[44px] rounded border px-3">
                    {enabled ? t('bench.disable') : t('bench.enable')}
                </button>}
            </div>
            {locked && (
                <div ref={lockRef} role="dialog" aria-modal="true" data-testid="bench-lock" className="fixed inset-0 z-[90] flex flex-col items-center justify-center gap-4 bg-slate-900/80 p-4"
>
                    <p className="text-lg font-semibold text-white">{t('bench.lockedFor', { name: user?.name || user?.username })}</p>
                    <PinForm t={t} title={t('bench.locked')} pinSet={pinSet} onPinSet={markPinSet}
                        onVerified={() => { lastActivity.current = Date.now(); setLocked(false); }} />
                    <button type="button" onClick={onSwitchAnalyst} className="min-h-[44px] rounded border border-white px-4 text-white">{t('bench.switchAnalyst')}</button>
                </div>
            )}
            {recordPrompt && !locked && (
                <div role="dialog" aria-modal="true" data-testid="bench-record-pin" className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4">
                    <PinForm t={t} title={t('bench.confirmRecord')} pinSet={pinSet} onPinSet={markPinSet}
                        onVerified={() => { recordPrompt.resolve(true); setRecordPrompt(null); }}
                        onCancel={() => { recordPrompt.resolve(false); setRecordPrompt(null); }} />
                </div>
            )}
        </>
    );
}
