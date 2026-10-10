import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { registerReloginHandler, tokenTimes } from '../../lib/sessionBridge';

const REFRESH_CHECK_MS = 60 * 1000;

// #202 B14: re-login in place on expiry (same analyst only) and refresh the
// token silently while the analyst is active, so pending edits are never lost.
export default function SessionKeeper() {
    const { user, token, logout, resumeSession } = useAuth();
    const { t } = useLanguage();
    const [prompt, setPrompt] = useState(null);
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const lastActivity = useRef(Date.now());
    const lastCheck = useRef(0);

    useEffect(() => {
        if (!user?.username) return undefined;
        return registerReloginHandler(() => new Promise((resolve, reject) => { setError(''); setPassword(''); setPrompt({ resolve, reject }); }));
    }, [user?.username]);

    useEffect(() => {
        if (!token || typeof window === 'undefined') return undefined;
        const onActivity = () => {
            lastActivity.current = Date.now();
            if (Date.now() - lastCheck.current < REFRESH_CHECK_MS) return;
            lastCheck.current = Date.now();
            const times = tokenTimes(localStorage.getItem('token'));
            // Refresh past half-life only; an expired token goes through the re-login prompt.
            if (times && Date.now() < times.exp && Date.now() - times.iat > (times.exp - times.iat) / 2) {
                axios.post('/api/auth/refresh').then(res => resumeSession(res.data.token)).catch(() => {});
            }
        };
        window.addEventListener('keydown', onActivity);
        window.addEventListener('pointerdown', onActivity);
        return () => { window.removeEventListener('keydown', onActivity); window.removeEventListener('pointerdown', onActivity); };
    }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

    if (!prompt) return null;
    const submit = async event => {
        event.preventDefault();
        try {
            const res = await axios.post('/api/auth/login', { username: user.username, password });
            const payload = res.data?.data || res.data;
            if (payload.user?.username !== user.username) throw new Error('different user');
            resumeSession(payload.token, payload.user);
            setPrompt(null);
            prompt.resolve(payload.token);
        } catch {
            setError(t('session.reloginFailed'));
        }
    };
    const signOut = () => { setPrompt(null); prompt.reject(new Error('signed out')); logout(); window.location.href = '/login?expired=true'; };
    return (
        <div role="dialog" aria-modal="true" data-testid="session-relogin" className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
            <form onSubmit={submit} className="w-full max-w-sm space-y-3 rounded-lg bg-white p-6 shadow-xl dark:bg-slate-900">
                <h2 className="text-lg font-semibold">{t('session.expiredTitle')}</h2>
                <p className="text-sm">{t('session.expiredBody', { name: user.name || user.username })}</p>
                <input type="password" autoFocus required aria-label={t('session.password')} value={password}
                    onChange={event => setPassword(event.target.value)} className="w-full rounded border px-3 py-2" />
                {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
                <div className="flex justify-end gap-2">
                    <button type="button" onClick={signOut} className="rounded border px-3 py-2">{t('session.signOut')}</button>
                    <button type="submit" className="rounded bg-blue-700 px-3 py-2 text-white">{t('session.continue')}</button>
                </div>
            </form>
        </div>
    );
}
