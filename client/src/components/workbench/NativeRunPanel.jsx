import React, { useEffect, useState } from 'react';
import axios from 'axios';
import numberParse from '@lims/number-parse';
import { useLanguage } from '../../context/LanguageContext';
import NumberPreview from './NumberPreview';

export default function NativeRunPanel({ batch, referenceMaterials, onChanged, loading, setLoading, setError, setSuccessMsg }) {
    const { t } = useLanguage();
    const [selectedCode, setSelectedCode] = useState(batch.analysis);
    const [values, setValues] = useState({}), [lots, setLots] = useState({}), [correcting, setCorrecting] = useState({});
    const [reason, setReason] = useState(''), [draggedId, setDraggedId] = useState(null);
    const analyte = batch.analytes.find(row => row.analysisCode === selectedCode) || batch.analytes.find(row => row.analysisCode === batch.analysis) || batch.analytes[0];
    const positions = batch.positions || [], served = new Set(analyte.positions.map(row => row.id));
    const parents = new Set(positions.filter(row => row.kind === 'DUPLICATE' && served.has(row.id)).map(row => row.duplicateOfPositionId));
    const measured = id => analyte.measurements?.find(row => row.positionId === id && row.replicateNo === 1);
    const binding = row => row.references?.find(reference => reference.analysisCode === analyte.analysisCode && !reference.supersededById && reference.serviceStatus !== 'NOT_SERVED');
    const locked = batch.status === 'CLOSED' || ['QC_FAIL', 'REJECTED', 'REPEAT_ORDERED', 'CLOSED'].includes(analyte.status) || Boolean(analyte.disposition);
    const accepted = ['QC_PASS', 'QC_WARN'].includes(analyte.status);
    const sequenceKey = positions.map(row => `${row.id}:${row.position}`).join(',');
    useEffect(() => { setSelectedCode(batch.analysis); }, [batch.id, batch.analysis]);
    useEffect(() => { setValues({}); setLots({}); setCorrecting({}); setReason(''); }, [batch.id, analyte.analysisCode, analyte.evaluation?.id, batch.startedAt, sequenceKey]);
    const isDuplicate = row => ['SAMPLE', 'DUPLICATE'].includes(row.kind);
    const canMeasure = row => served.has(row.id) && row.kind !== 'CAL_STD' && (row.kind !== 'SAMPLE' || parents.has(row.id));
    const corrections = Object.keys(correcting).filter(id => correcting[id]);
    const changedLots = positions.filter(row => lots[row.id] && lots[row.id] !== binding(row)?.referenceMaterialId);
    const correction = corrections.length > 0 || changedLots.some(row => binding(row));
    const entered = positions.filter(row => canMeasure(row) && String(values[row.id] || '').trim() && (correction ? correcting[row.id] : !measured(row.id)));
    const valid = entered.every(row => {
        const parsed = isDuplicate(row) ? numberParse.parseDuplicateObservation(values[row.id], analyte.numberFormat) : numberParse.parseNumber(values[row.id], analyte.numberFormat);
        return parsed.valid && (isDuplicate(row) || !parsed.qualifier);
    });
    const perform = async operation => {
        setError(null); setSuccessMsg(null); setLoading(true);
        try { await operation(); await onChanged(); }
        catch (error) { setError(t(`qcRuns.errors.${error.response?.data?.code}`, error.response?.data?.error || error.message)); }
        finally { setLoading(false); }
    };
    const submit = explicit => perform(async () => {
        const entries = entered.map(row => ({ positionId: row.id, replicateNo: 1, rawInput: values[row.id] }));
        const payload = { analysisCode: analyte.analysisCode, [correction ? 'corrections' : 'measurements']: entries,
            references: changedLots.map(row => ({ positionId: row.id, referenceMaterialId: lots[row.id] })), ...(correction && { reason }) };
        const url = `/api/qc/batches/${batch.id}`;
        const response = correction ? await axios.post(`${url}/corrections`, payload)
            : explicit ? await axios.post(`${url}/evaluate`, payload) : await axios.put(url, payload);
        setValues({}); setLots({}); setCorrecting({});
        setSuccessMsg(response.data.batch?.result === 'NOT_REQUIRED' || analyte.qcMode === 'OFF' ? t('qcRuns.notRequired') : t('qcRuns.saved'));
    });
    const reorder = targetId => {
        const source = draggedId; setDraggedId(null);
        if (!source || source === targetId || batch.startedAt || locked) return;
        const ids = positions.map(row => row.id).filter(id => id !== source); ids.splice(ids.indexOf(targetId), 0, source);
        perform(() => axios.post(`/api/qc/batches/${batch.id}/reorder`, { positionIds: ids }));
    };
    const submitAllowed = !loading && batch.startedAt && !locked && valid && (!correction || reason.trim()) && corrections.every(id => String(values[id] || '').trim());
    return <section className="space-y-3" data-testid="native-qc-run">
        {batch.analytes.length > 1 && <label className="grid gap-1 text-xs">{t('qcRuns.analysis')}
            <select value={analyte.analysisCode} data-testid="native-analysis-select" disabled={loading}
                onChange={event => setSelectedCode(event.target.value)} className="p-2 rounded border border-sf-divider bg-sf-canvas text-sf-text">
                {batch.analytes.map(row => <option key={row.analysisCode} value={row.analysisCode}>{row.analysisCode}</option>)}
            </select>
        </label>}
        {analyte.qcMode === 'OFF' && <p data-testid="native-qc-not-required">{t('qcRuns.notRequired')}</p>}
        {!batch.startedAt && <>
            <p className="text-xs text-sf-muted">{t('qcRuns.startHelp')}</p>
            <button type="button" data-testid="native-run-start" disabled={loading || locked} className="px-3 py-2 rounded border border-sf-divider"
                onClick={() => perform(() => axios.post(`/api/qc/batches/${batch.id}/start`, {}))}>{t('qcRuns.start')}</button>
            <p className="text-xs text-sf-muted">{t('qcRuns.reorderHelp')}</p>
        </>}
        {locked && <p role="alert">{t('qcRuns.locked')}</p>}
        <ol className="space-y-2" data-testid="native-run-sequence">
            {positions.map(row => {
                const old = measured(row.id), reference = binding(row);
                const snapshot = reference?.referenceSnapshot && JSON.parse(reference.referenceSnapshot);
                const needsLot = served.has(row.id) && ['LRM', 'CRM', 'ICV', 'CCV', 'CCB'].includes(row.kind);
                const lotKind = { ICV: 'CHECK_STANDARD', CCV: 'CHECK_STANDARD', CCB: 'BLANK_MATRIX' }[row.kind] || row.kind;
                const sample = batch.workItems?.find(item => item.sampleId === row.sampleId)?.sample;
                return <li key={row.id} draggable={!batch.startedAt && !locked && !loading}
                    onDragStart={() => setDraggedId(row.id)} onDragOver={event => { if (!batch.startedAt) event.preventDefault(); }}
                    onDrop={event => { event.preventDefault(); reorder(row.id); }}
                    className="p-3 border border-sf-divider rounded-xl space-y-2" data-testid={`native-position-${row.id}`}>
                    <p className="text-xs font-bold">{row.position} · {row.kind}{row.sampleId && ` · ${sample?.originalId || row.sampleId}`}</p>
                    {row.duplicateOfPositionId && <p className="text-xs text-sf-muted">{t('qcRuns.duplicateParent')}: {positions.find(parent => parent.id === row.duplicateOfPositionId)?.position}</p>}
                    {reference && <p className="text-xs">{t('qcRuns.boundLot')}: {snapshot?.code || reference.referenceMaterialId}{snapshot?.lotNumber && ` · ${snapshot.lotNumber}`}
                        {snapshot?.expected != null && ` · ${t('qcRuns.expected')}: ${snapshot.expected}`}</p>}
                    {needsLot && <label className="grid gap-1 text-xs">{t('referenceMaterials.controlMaterial')}
                        <select value={lots[row.id] || reference?.referenceMaterialId || ''} disabled={locked || loading || accepted}
                            onChange={event => setLots(previous => ({ ...previous, [row.id]: event.target.value }))} data-testid={`native-lot-${row.id}`}>
                            <option value="">{t('referenceMaterials.choose')}</option>
                            {referenceMaterials.filter(material => material.kind === lotKind).map(material => <option key={material.id} value={material.id} disabled={!material.eligible}>
                                {material.code} · {material.lotNumber}</option>)}
                        </select>
                    </label>}
                    {canMeasure(row) && <>
                        {old && <p className="text-xs font-mono">{t('qcRuns.recorded')}: {old.rawInput ?? old.value ?? t('common.notRecorded')}</p>}
                        {old && !locked && !accepted && <label className="flex gap-2 text-xs"><input type="checkbox" checked={!!correcting[row.id]} disabled={loading}
                            onChange={event => setCorrecting(previous => ({ ...previous, [row.id]: event.target.checked }))} />{t('qcRuns.correct')}</label>}
                        {(!old || correcting[row.id]) && <label className="grid gap-1 text-xs">{t('qcRules.fields.measured')}
                            <input type="text" value={values[row.id] || ''} disabled={!batch.startedAt || locked || loading || accepted || correction && !correcting[row.id]}
                                data-testid={`native-value-${row.id}`} onChange={event => setValues(previous => ({ ...previous, [row.id]: event.target.value }))}
                                className="p-2 rounded border border-sf-divider bg-sf-canvas" />
                            <NumberPreview value={values[row.id] || ''} numberFormat={analyte.numberFormat} duplicateObservation={isDuplicate(row)} />
                        </label>}
                    </>}
                </li>;
            })}
        </ol>
        {(correction || accepted) && !locked && <label className="grid gap-1 text-xs">{t('qcRuns.reason')}
            <textarea value={reason} onChange={event => setReason(event.target.value)} data-testid="native-correction-reason" className="p-2 border border-sf-divider rounded" />
        </label>}
        {accepted && !locked && <button type="button" disabled={loading || !reason.trim()} data-testid="native-run-reopen"
            onClick={() => perform(() => axios.put(`/api/qc/batches/${batch.id}`, { analysisCode: analyte.analysisCode, status: 'OPEN', reason }))}>{t('qcRuns.reopen')}</button>}
        {['QC_PASS', 'QC_WARN', 'ACCEPTED_WITH_DEVIATION'].includes(analyte.status) && <button type="button" disabled={loading} data-testid="native-analyte-close"
            onClick={() => perform(() => axios.put(`/api/qc/batches/${batch.id}`, { analysisCode: analyte.analysisCode, status: 'CLOSED' }))}>{t('qcRuns.closeAnalyte')}</button>}
        <div className="flex gap-3">
            <button type="button" data-testid="native-qc-save" disabled={!submitAllowed || !(entered.length || changedLots.length)} onClick={() => submit(false)}>{t('qcRuns.save')}</button>
            <button type="button" data-testid="native-qc-evaluate" disabled={!submitAllowed} onClick={() => submit(true)}>{t('qcRuns.evaluate')}</button>
        </div>
    </section>;
}
