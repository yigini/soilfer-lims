import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useLanguage } from '../../context/LanguageContext';
import { canSelectInstrument } from './entryReadiness';

export default function StartRunForm({ groups = [], onStarted, onCancel }) {
    const { t } = useLanguage();
    const choices = useMemo(() => groups.filter(group => group.category !== 'Operational Gates').flatMap(group =>
        [...new Set((group.items || []).map(item => item.laboratoryId).filter(Boolean))].map(labId => ({
            key: JSON.stringify([group.analysis, labId]), analysisCode: group.analysis, labId,
            name: group.analysisName || group.analysis, items: group.items.filter(item => item.laboratoryId === labId)
        }))), [groups]);
    const [choiceKey, setChoiceKey] = useState(''), [methodId, setMethodId] = useState(''), [instrumentId, setInstrumentId] = useState('');
    const [options, setOptions] = useState(null), [selected, setSelected] = useState(new Set()), [barcode, setBarcode] = useState('');
    const [loading, setLoading] = useState(false), [submitting, setSubmitting] = useState(false), [error, setError] = useState(null);
    const choice = choices.find(row => row.key === choiceKey);
    useEffect(() => {
        let current = true; setOptions(null); setError(null);
        if (!choice) { setLoading(false); return () => { current = false; }; }
        setLoading(true);
        axios.get('/api/qc/run-options', { params: { analysisCode: choice.analysisCode, labId: choice.labId,
            workItemIds: JSON.stringify(choice.items.map(item => item.workItemId || item.id)), ...(methodId && { methodologyId: methodId }) } })
            .then(response => { if (current) { setOptions(response.data); if (!methodId) setMethodId(response.data.methodologyId || ''); } })
            .catch(failure => { if (current) setError(t(`runFirst.errors.${failure.response?.data?.code}`, failure.response?.data?.error || t('runFirst.optionsFailed'))); })
            .finally(() => { if (current) setLoading(false); });
        return () => { current = false; };
    }, [choiceKey, choice?.analysisCode, choice?.labId, methodId, t]);
    const candidates = (choice?.items || []).filter(item => canSelectInstrument(item) &&
        (options?.eligibleWorkItemIds ? options.eligibleWorkItemIds.includes(item.workItemId || item.id) : !item.batchId) &&
        (!item.methodologyId || item.methodologyId === methodId));
    const capacity = options?.maxBatchSize ?? Infinity;
    const ready = !loading && options?.methodologyId === methodId && methodId &&
        (!options.equipmentRequired || instrumentId) && (!instrumentId || options.eligibleEquipment.some(asset => asset.id === instrumentId));
    const selectBarcode = () => {
        const matches = candidates.filter(item => [item.sampleDisplayId, item.originalId, item.sampleId, item.labId].includes(barcode.trim()));
        if (matches.length !== 1) { setError(t('runFirst.scanNotUnique')); return; }
        const id = matches[0].workItemId || matches[0].id;
        if (!selected.has(id) && selected.size >= capacity) { setError(t('runFirst.capacityReached')); return; }
        setSelected(previous => new Set([...previous, id])); setBarcode(''); setError(null);
    };
    const submit = async event => {
        event.preventDefault();
        if (!ready || submitting || !selected.size || selected.size > capacity || [...selected].some(id => !candidates.some(item => (item.workItemId || item.id) === id))) return;
        setSubmitting(true); setError(null);
        try {
            const response = await axios.post('/api/qc/runs/start', { analysisCode: choice.analysisCode, labId: choice.labId,
                methodologyId: methodId, instrumentId: instrumentId || null, workItemIds: [...selected] });
            await onStarted(response.data.batch);
        } catch (failure) { setError(t(`runFirst.errors.${failure.response?.data?.code}`, failure.response?.data?.error || failure.message)); }
        finally { setSubmitting(false); }
    };
    return <form data-testid="start-run-form" onSubmit={submit} className="rounded-xl border border-sf-divider p-4 bg-sf-surface space-y-3">
        <h3 className="font-semibold">{t('runFirst.startRun')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <label>{t('runFirst.analysis')}<select data-testid="start-run-analysis" value={choiceKey} disabled={submitting} onChange={event => {
                setChoiceKey(event.target.value); setMethodId(''); setInstrumentId(''); setSelected(new Set()); setBarcode('');
            }} className="block w-full border border-sf-divider bg-sf-canvas rounded p-2">
                <option value="">{t('runFirst.chooseAnalysis')}</option>{choices.map(row => <option key={row.key} value={row.key}>{row.name} · {row.labId}</option>)}
            </select></label>
            <label>{t('runFirst.method')}<select data-testid="start-run-method" value={methodId} disabled={submitting || loading || !choice} onChange={event => {
                setMethodId(event.target.value); setInstrumentId(''); setSelected(new Set());
            }} className="block w-full border border-sf-divider bg-sf-canvas rounded p-2">
                <option value="">{t('runFirst.chooseMethod')}</option>{(options?.methods || []).map(method => <option key={method.id} value={method.id}>{method.name} · {method.standard || ''}</option>)}
            </select></label>
            <label>{t('runFirst.instrument')}<select data-testid="start-run-instrument" value={instrumentId} disabled={submitting || loading || !methodId} onChange={event => setInstrumentId(event.target.value)} className="block w-full border border-sf-divider bg-sf-canvas rounded p-2">
                <option value="">{options?.equipmentRequired ? t('runFirst.chooseInstrument') : t('runFirst.manual')}</option>{(options?.eligibleEquipment || []).map(asset => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
            </select></label>
        </div>
        <p className="text-xs text-sf-muted">{t('runFirst.sharedContext')}</p>
        {choice && <div className="space-y-2 text-xs">
            <p>{t('runFirst.selected')}: {selected.size}{Number.isFinite(capacity) && ` / ${capacity}`}</p>
            <button data-testid="start-run-select-all" type="button" disabled={!ready || submitting || candidates.length > capacity || !candidates.length} onClick={() => setSelected(new Set(candidates.map(item => item.workItemId || item.id)))}>{t('runFirst.selectAll')} ({candidates.length})</button>
            <label className="block">{t('runFirst.scan')}<input data-testid="start-run-scan" value={barcode} disabled={!ready || submitting} onChange={event => setBarcode(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); selectBarcode(); } }} className="ml-2 border border-sf-divider bg-sf-canvas rounded p-2" /></label>
            <div className="max-h-56 overflow-auto space-y-1">{candidates.map(item => {
                const id = item.workItemId || item.id;
                return <label key={id} className="flex items-center gap-2"><input type="checkbox" checked={selected.has(id)} disabled={!ready || submitting || !selected.has(id) && selected.size >= capacity} onChange={event => setSelected(previous => {
                    const next = new Set(previous); if (event.target.checked) next.add(id); else next.delete(id); return next;
                })} />{item.sampleDisplayId || item.originalId || item.sampleId}</label>;
            })}</div>
            {!candidates.length && <p>{t('runFirst.noEligibleSamples')}</p>}
            {candidates.length > capacity && <p>{t('runFirst.capacityReached')}</p>}
        </div>}
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-3"><button data-testid="start-run-confirm" type="submit" disabled={!ready || !selected.size || selected.size > capacity || submitting} className="rounded bg-sf-primary text-white px-4 py-2">{t('runFirst.confirmStart')}</button>
            <button type="button" disabled={submitting} onClick={onCancel}>{t('runFirst.cancel')}</button></div>
    </form>;
}
