import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { classifyResultValue } from '@lims/result-value-validation';
import { entryInstrumentId, isEntryReady } from './entryReadiness';

export default function ResultValueActions({ item, onChooseApproval, onChanged }) {
    const { hasPermission } = useAuth(), { t } = useLanguage();
    const [rows, setRows] = useState([]), [reason, setReason] = useState('');
    const [error, setError] = useState(null), [busy, setBusy] = useState(false);
    const number = Number(item.draft?.replicateNo ?? 1);
    const validation = classifyResultValue(item.draft?.value ?? '', item.valueRules, item.numberFormat);
    useEffect(() => {
        let current = true;
        axios.get('/api/result-overrides', { params: { workItemId: item.workItemId } })
            .then(response => { if (current) setRows(response.data); })
            .catch(failure => { if (current) setError(failure.response?.data?.error || failure.message); });
        return () => { current = false; };
    }, [item.workItemId]);
    const active = rows.find(row => row.replicateNo === number && ['REQUESTED', 'APPROVED'].includes(row.status));
    const command = async (url, body) => {
        setBusy(true);setError(null);
        try {
            await axios.post(url, body);
            const response = await axios.get('/api/result-overrides', { params: { workItemId: item.workItemId } });
            setRows(response.data);setReason('');
            onChooseApproval?.(item.workItemId, null);
        } catch (failure) { setError(failure.response?.data?.error || failure.message); }
        finally { setBusy(false); }
    };
    const canRequest = hasPermission?.('ENTER_RESULTS') && isEntryReady(item, item.eligibleEquipment || []) && validation.canOverride;
    return <div className="text-xs space-y-2 mt-2" data-testid={`value-actions-${item.workItemId}`}>
        {(canRequest || active || item.dilutionOpportunity?.eligible) && <label className="block">
            {t('overrideRequests.reason')}
            <textarea value={reason} onChange={event => setReason(event.target.value)} disabled={busy}
                className="block w-full p-2 rounded border border-sf-divider bg-sf-surface" data-testid="override-reason" />
        </label>}
        {canRequest && !active && <button type="button" disabled={busy || !reason.trim()} data-testid="request-override"
            onClick={() => command(`/api/result-overrides/work-items/${encodeURIComponent(item.workItemId)}`, {
                value: item.draft.value, replicateNo: number, basis: item.draft.basis || 'AIR_DRY',
                equipmentId: entryInstrumentId(item), reason, ...(item.valueRules?.unit && { unit: item.valueRules.unit })
            })}>{t('overrideRequests.request')}</button>}
        {active && <div data-testid="active-override">
            {t(`overrideRequests.status.${active.status}`)} · {active.rawValue} {active.unit}
            {active.decisionReason && <p>{active.decisionReason}</p>}
            {active.status === 'APPROVED' && onChooseApproval && <button type="button" disabled={busy}
                data-testid="use-approval" onClick={() => onChooseApproval(item.workItemId, active.id)}>{t('overrideRequests.useApproval')}</button>}
            <button type="button" disabled={busy || !reason.trim()} data-testid="cancel-override"
                onClick={() => command(`/api/result-overrides/${encodeURIComponent(active.id)}/cancel`, { reason })}>{t('overrideRequests.cancel')}</button>
        </div>}
        {validation.flags.includes('ABOVE_RANGE') && !item.dilutionOpportunity?.eligible && !item.currentResult &&
            <p data-testid="record-before-dilution">{t('overrideRequests.recordFirst')}</p>}
        {item.dilutionOpportunity?.eligible && <button type="button" disabled={busy || !reason.trim()}
            data-testid="dilute-repeat" onClick={async () => {
                setBusy(true);setError(null);
                try { await axios.post(`/api/work-items/${encodeURIComponent(item.workItemId)}/repeats`, {
                    reason: 'ABOVE_RANGE_DILUTION', note: reason });await onChanged?.(); }
                catch (failure) { setError(failure.response?.data?.error || failure.message); }
                finally { setBusy(false); }
            }}>{t('overrideRequests.diluteRepeat')}</button>}
        {error && <p role="alert">{error}</p>}
    </div>;
}
