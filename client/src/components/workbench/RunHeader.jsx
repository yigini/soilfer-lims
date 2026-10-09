import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useLanguage } from '../../context/LanguageContext';

export default function RunHeader({ batch, analysisCode, canEdit = false, onChanged }) {
    const { t } = useLanguage();
    const analyte = batch.analytes?.find(row => row.analysisCode === (analysisCode || batch.analysis)) || batch.analytes?.[0];
    const revision = analyte?.methodRevision;
    const [choices, setChoices] = useState([]), [lotId, setLotId] = useState(''), [role, setRole] = useState('');
    const [withdrawId, setWithdrawId] = useState(''), [reason, setReason] = useState('');
    const [busy, setBusy] = useState(false), [error, setError] = useState(null);
    const editable = canEdit && (!batch.startedAt ? batch.status === 'OPEN' : batch.status !== 'CLOSED' &&
        !batch.analytes?.some(row => ['QC_FAIL', 'REJECTED', 'REPEAT_ORDERED', 'CLOSED'].includes(row.status) || row.disposition) &&
        batch.analytes?.some(row => ['IN_RUN', 'QC_PENDING'].includes(row.status)));
    useEffect(() => {
        let current = true; setChoices([]); setLotId(''); setRole(''); setWithdrawId(''); setReason(''); setError(null);
        if (editable) axios.get(`/api/qc/batches/${encodeURIComponent(batch.id)}/reagent-lot-options`)
            .then(response => { if (current) setChoices(Array.isArray(response.data.data) ? response.data.data : []); })
            .catch(() => { if (current) setError(t('runFirst.lotsLoadFailed')); });
        return () => { current = false; };
    }, [batch.id, editable, t]);
    const command = async (url, data) => {
        if (!editable || busy) return;
        setBusy(true); setError(null);
        try { await axios.post(url, data); setLotId(''); setRole(''); setWithdrawId(''); setReason(''); await onChanged?.(); }
        catch (failure) { setError(t(`runFirst.errors.${failure.response?.data?.code}`, failure.response?.data?.error || failure.message)); }
        finally { setBusy(false); }
    };
    return <section data-testid="run-header" className="rounded-xl border border-sf-divider bg-sf-surface p-4 mb-3 space-y-3">
        <h3 className="text-sm font-semibold">{t('runFirst.header')}</h3>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div><dt className="text-sf-muted">{t('runFirst.instrument')}</dt><dd>{batch.instrument || t('runFirst.manual')}</dd></div>
            <div><dt className="text-sf-muted">{t('runFirst.method')}</dt><dd data-testid="run-method-revision">{revision ?
                `${revision.name} · ${revision.standard || ''} · ${t('runFirst.version')} ${revision.version ?? t('runFirst.unknown')}` : t('runFirst.methodUnknown')}
                {revision && <span className="ml-2 text-sf-muted">{t(analyte.methodRevisionSource === 'FROZEN' ? 'runFirst.frozen' : 'runFirst.current')}</span>}
            </dd></div>
            <div><dt className="text-sf-muted">{t('runFirst.analyst')}</dt><dd>{batch.analystUsername || t('runFirst.unknown')}</dd></div>
            <div><dt className="text-sf-muted">{t('runFirst.startedAt')}</dt><dd>{batch.startedAt ? new Date(batch.startedAt).toLocaleString() : t('runFirst.notStarted')}</dd></div>
        </dl>
        <p className="text-xs text-sf-muted">{t('runFirst.sharedContext')}</p>
        <div className="text-xs space-y-2"><strong>{t('runFirst.reagentLots')}</strong>
            {!batch.reagentLots?.length && <p className="text-sf-muted">{t('runFirst.noLots')}</p>}
            {(batch.reagentLots || []).map(link => <div key={link.id} className="flex items-center justify-between gap-2">
                <span>{link.inventoryLot?.lotNumber || link.inventoryLotId}{link.role ? ` · ${link.role}` : ''}</span>
                {editable && !batch.startedAt && <button type="button" disabled={busy} onClick={() => { setWithdrawId(link.inventoryLotId); setReason(''); }}>{t('runFirst.withdraw')}</button>}
            </div>)}
            {editable && <form onSubmit={event => { event.preventDefault(); if (lotId) command(`/api/qc/batches/${encodeURIComponent(batch.id)}/reagent-lots`, { inventoryLotId: lotId, role: role || null }); }} className="flex flex-wrap gap-2">
                <select aria-label={t('runFirst.reagentLots')} value={lotId} disabled={busy} onChange={event => setLotId(event.target.value)} className="bg-sf-canvas border border-sf-divider rounded p-2">
                    <option value="">{t('runFirst.selectLot')}</option>
                    {choices.filter(lot => !(batch.retainedReagentLots || batch.reagentLots || []).some(link => link.inventoryLotId === lot.id)).map(lot => <option key={lot.id} value={lot.id}>{lot.item?.name} · {lot.lotNumber}</option>)}
                </select>
                <input aria-label={t('runFirst.lotRole')} placeholder={t('runFirst.lotRole')} maxLength={120} value={role} disabled={busy} onChange={event => setRole(event.target.value)} className="bg-sf-canvas border border-sf-divider rounded p-2" />
                <button type="submit" disabled={busy || !lotId}>{t('runFirst.addLot')}</button>
            </form>}
            {editable && !batch.startedAt && withdrawId && <form onSubmit={event => { event.preventDefault(); if (reason.trim()) command(`/api/qc/batches/${encodeURIComponent(batch.id)}/reagent-lots/${encodeURIComponent(withdrawId)}/withdraw`, { reason }); }} className="flex gap-2">
                <input aria-label={t('runFirst.withdrawReason')} placeholder={t('runFirst.withdrawReason')} value={reason} onChange={event => setReason(event.target.value)} className="bg-sf-canvas border border-sf-divider rounded p-2" />
                <button type="submit" disabled={busy || !reason.trim()}>{t('runFirst.withdraw')}</button>
                <button type="button" disabled={busy} onClick={() => setWithdrawId('')}>{t('runFirst.cancel')}</button>
            </form>}
        </div>
        {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
    </section>;
}
