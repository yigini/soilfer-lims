import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { useLanguage } from '../../context/LanguageContext';
import SampleHoldBadge from './SampleHoldBadge';

export default function SampleHoldsPanel({ sampleId, refreshKey, onResolved }) {
    const { t } = useLanguage();
    const [data, setData] = useState(null);
    const [selected, setSelected] = useState(null);
    const [reason, setReason] = useState('');
    const [saving, setSaving] = useState(false);
    const [errorCode, setErrorCode] = useState(null);
    const load = useCallback(async () => {
        if (!sampleId) return;
        const response = await axios.get(`/api/samples/${encodeURIComponent(sampleId)}/holds`);
        setData(response.data);
    }, [sampleId]);

    useEffect(() => {
        let active = true;
        setData(null);
        setSelected(null);
        setErrorCode(null);
        if (sampleId) axios.get(`/api/samples/${encodeURIComponent(sampleId)}/holds`)
            .then(response => { if (active) setData(response.data); })
            .catch(() => { if (active) setErrorCode('HOLD_FETCH_ERROR'); });
        return () => { active = false; };
    }, [sampleId, refreshKey]);

    const resolve = async event => {
        event.preventDefault();
        if (!reason.trim() || saving) return;
        setSaving(true);
        setErrorCode(null);
        try {
            await axios.post(`/api/samples/${encodeURIComponent(sampleId)}/holds/${encodeURIComponent(selected.id)}/resolve`, { reason: reason.trim() });
            await load();
            setSelected(null);
            setReason('');
            onResolved?.();
        } catch (error) {
            const code = error.response?.data?.code;
            setErrorCode(['HOLD_BACKFILL_REQUIRED', 'HOLD_MARKER_INVALID', 'HOLD_RESOLVE_FORBIDDEN', 'HOLD_STATE_CHANGED'].includes(code) ? code : 'HOLD_RESOLVE_ERROR');
        } finally { setSaving(false); }
    };

    if (!sampleId || !errorCode && !data?.held && !data?.holds?.length) return null;
    return <section className="rounded-xl border border-sf-divider bg-sf-surface p-4 space-y-3" aria-label={t('sampleHolds.title')}>
        <div className="flex items-center gap-3"><h2 className="font-semibold">{t('sampleHolds.title')}</h2><SampleHoldBadge held={data?.held} /></div>
        {errorCode && <p role="alert" className="text-[var(--sf-danger)]">{t(`sampleHolds.errors.${errorCode}`)}</p>}
        {data?.held && !data.holds.some(hold => !hold.resolvedAt) && <p className="text-sm">{t('sampleHolds.backfillRequired')}</p>}
        {data?.metadataRepairNeeded && <p className="text-sm" role="alert">{t('sampleHolds.metadataRepairNeeded')}</p>}
        <ul className="space-y-3">
            {data?.holds.map(hold => <li key={hold.id} className="border-t border-sf-divider pt-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                    <div><strong>{t(`sampleHolds.types.${hold.type}`)}</strong> · {t(hold.resolvedAt ? 'sampleHolds.resolved' : 'sampleHolds.open')}
                        <p className="text-sm whitespace-pre-wrap">{hold.reason}</p>
                        <p className="text-xs text-sf-muted">{t(hold.raisedAtIsUpperBound ? 'sampleHolds.raisedAtOrBefore' : 'sampleHolds.raisedAt')}: {new Date(hold.raisedAt).toLocaleString()} · {hold.raisedBy}</p>
                        {hold.resolvedAt && <p className="text-sm whitespace-pre-wrap">{hold.resolution} · {hold.resolvedBy} · {new Date(hold.resolvedAt).toLocaleString()}</p>}
                    </div>
                    {!hold.resolvedAt && data.canResolve && <button type="button" className="rounded-lg border border-sf-divider px-3 py-2 text-sm" onClick={() => { setSelected(hold); setReason(''); setErrorCode(null); }}>{t('sampleHolds.resolve')}</button>}
                </div>
            </li>)}
        </ul>
        {selected && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="resolve-hold-title">
            <form onSubmit={resolve} className="w-full max-w-lg space-y-4 rounded-xl bg-sf-surface p-6">
                <h2 id="resolve-hold-title" className="text-lg font-semibold">{t('sampleHolds.resolve')}</h2>
                <p className="text-sm whitespace-pre-wrap">{selected.reason}</p>
                <label className="block">{t('sampleHolds.resolutionReason')}<textarea autoFocus required disabled={saving} value={reason} onChange={event => setReason(event.target.value)} className="mt-2 block w-full rounded-lg border border-sf-divider bg-sf-canvas p-3" /></label>
                {errorCode && <p role="alert" className="text-[var(--sf-danger)]">{t(`sampleHolds.errors.${errorCode}`)}</p>}
                <div className="flex justify-end gap-3"><button type="button" disabled={saving} onClick={() => setSelected(null)}>{t('common.cancel')}</button><button type="submit" disabled={saving || !reason.trim()} className="rounded-lg bg-[var(--sf-primary)] px-4 py-2 text-white disabled:opacity-50">{t('sampleHolds.resolve')}</button></div>
            </form>
        </div>}
    </section>;
}
