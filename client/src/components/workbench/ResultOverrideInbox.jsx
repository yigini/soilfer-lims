import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

export default function ResultOverrideInbox({ actorId }) {
    const { hasPermission } = useAuth(), { t } = useLanguage();
    const [rows, setRows] = useState([]), [reasons, setReasons] = useState({});
    const [error, setError] = useState(null), [busy, setBusy] = useState(false);
    const allowed = hasPermission?.('APPROVE_RESULTS') === true;
    const load = async () => {
        const response = await axios.get('/api/result-overrides');
        if (!Array.isArray(response.data)) throw new Error(t('overrideRequests.loadFailed'));
        setRows(response.data);
    };
    useEffect(() => {
        if (!allowed) return;
        let current = true;
        axios.get('/api/result-overrides').then(response => {
            if (!Array.isArray(response.data)) throw new Error(t('overrideRequests.loadFailed'));
            if (current) setRows(response.data);
        })
            .catch(failure => { if (current) setError(failure.response?.data?.error || failure.message); });
        return () => { current = false; };
    }, [allowed, t]);
    const decide = async (row, status) => {
        setBusy(true);setError(null);
        try { await axios.post(`/api/result-overrides/${encodeURIComponent(row.id)}/decision`, {
            status, reason: reasons[row.id] });await load(); }
        catch (failure) { setError(failure.response?.data?.error || failure.message); }
        finally { setBusy(false); }
    };
    if (!allowed) return null;
    return <section className="space-y-3" data-testid="override-inbox">
        <h2 className="font-semibold">{t('overrideRequests.inbox')}</h2>
        {!rows.length && <p>{t('overrideRequests.empty')}</p>}
        {rows.map(row => <article key={row.id} className="p-3 border border-sf-divider rounded" data-testid={`override-${row.id}`}>
            <p>{row.sampleId} · {row.analysisCode} · {t('overrideRequests.replicate', { number: row.replicateNo })}</p>
            <p className="font-mono">{row.rawValue} {row.unit}</p><p>{row.reason}</p>
            <p>{t(`overrideRequests.status.${row.status}`)} · {row.requestedBy}</p>
            {row.status === 'REQUESTED' && <>
                <label>{t('overrideRequests.decisionReason')}<textarea value={reasons[row.id] || ''}
                    onChange={event => setReasons(previous => ({ ...previous, [row.id]: event.target.value }))}
                    data-testid={`decision-reason-${row.id}`} className="block w-full p-2 border border-sf-divider rounded bg-sf-surface" /></label>
                <button type="button" disabled={busy || row.requestedBy === actorId || !reasons[row.id]?.trim()}
                    data-testid={`approve-${row.id}`} onClick={() => decide(row, 'APPROVED')}>{t('overrideRequests.approve')}</button>
                <button type="button" disabled={busy || row.requestedBy === actorId || !reasons[row.id]?.trim()}
                    data-testid={`reject-${row.id}`} onClick={() => decide(row, 'REJECTED')}>{t('overrideRequests.reject')}</button>
            </>}
            {row.decisionReason && <p>{row.decisionReason} · {row.decidedBy}</p>}
            {row.cancelReason && <p>{row.cancelReason} · {row.cancelledBy}</p>}
        </article>)}
        {error && <p role="alert">{error}</p>}
    </section>;
}
