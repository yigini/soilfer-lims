import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import numberParse from '@lims/number-parse';
import { useLanguage } from '../../context/LanguageContext';

const LIMIT_FIELDS = ['maxAllowed', 'maxRpd', 'absMax', 'absMaxBelow5LOQ', 'nearLoqMultiplier', 'loq',
    'minRecovery', 'maxRecovery', 'crmAbsWindow', 'lrmWindowPct', 'mode', 'crmMode', 'lrmMode'];
export function storedPositionEvidence(analyte, positionId) {
    let details;
    try { details = typeof analyte.evaluation?.details === 'string' ? JSON.parse(analyte.evaluation.details) : analyte.evaluation?.details; }
    catch { return null; }
    const evaluation = details?.evaluation || details?.qcResults || details || analyte.qcResults;
    const check = [...(evaluation?.blanks || []), ...(evaluation?.controls || []), ...(evaluation?.duplicates || [])]
        .find(row => row.positionId === positionId || row.id === positionId);
    return check ? { ...check, limits: Object.fromEntries(LIMIT_FIELDS.filter(key => check[key] !== undefined)
        .map(key => [key, check[key]])), preview: false } : null;
}

const verdictColour = status => status === 'PASS' || status === 'NOT_REQUIRED' ? 'text-emerald-700 dark:text-emerald-300'
    : status === 'FAIL' ? 'text-red-700 dark:text-red-300' : 'text-amber-700 dark:text-amber-300';

export default function NativeRunPanel({ batch, referenceMaterials, onChanged, loading, setLoading, setError, setSuccessMsg,
    renderWorksheet = null, canEdit = true, analysisCode = null, onAnalysisChanged = null }) {
    const { t } = useLanguage();
    const [selectedCode, setSelectedCode] = useState(batch.analysis);
    const [values, setValues] = useState({}), [lots, setLots] = useState({}), [correcting, setCorrecting] = useState({});
    const [reason, setReason] = useState(''), [draggedId, setDraggedId] = useState(null);
    const [preview, setPreview] = useState(null), [previewError, setPreviewError] = useState(null);
    const previewGeneration = useRef(0);
    const analyte = batch.analytes.find(row => row.analysisCode === (analysisCode || selectedCode)) || batch.analytes.find(row => row.analysisCode === batch.analysis) || batch.analytes[0];
    const positions = batch.positions || [], served = new Set(analyte.positions.map(row => row.id));
    const parents = new Set(positions.filter(row => row.kind === 'DUPLICATE' && served.has(row.id)).map(row => row.duplicateOfPositionId));
    const measured = id => analyte.measurements?.find(row => row.positionId === id && row.replicateNo === 1);
    const binding = row => row.references?.find(reference => reference.analysisCode === analyte.analysisCode && !reference.supersededById && reference.serviceStatus !== 'NOT_SERVED');
    const locked = !canEdit || batch.status === 'CLOSED' || ['QC_FAIL', 'REJECTED', 'REPEAT_ORDERED', 'CLOSED'].includes(analyte.status) || Boolean(analyte.disposition);
    const accepted = ['QC_PASS', 'QC_WARN'].includes(analyte.status);
    const sequenceKey = positions.map(row => `${row.id}:${row.position}`).join(',');
    const bindingKey = positions.flatMap(row => (row.references || []).map(reference => `${reference.id}:${reference.supersededById || ''}`)).join(',');
    useEffect(() => { setSelectedCode(batch.analysis); }, [batch.id, batch.analysis]);
    useEffect(() => {
        setValues({}); setLots({}); setCorrecting({}); setReason('');
        previewGeneration.current++; setPreview(null); setPreviewError(null);
    }, [batch.id, analyte.analysisCode, analyte.evaluation?.id, batch.startedAt, sequenceKey, bindingKey]);
    const isDuplicate = row => ['SAMPLE', 'DUPLICATE'].includes(row.kind);
    const canMeasure = row => served.has(row.id) && row.kind !== 'CAL_STD' && (row.kind !== 'SAMPLE' || parents.has(row.id));
    const corrections = Object.keys(correcting).filter(id => correcting[id]);
    const changedLots = positions.filter(row => lots[row.id] && lots[row.id] !== binding(row)?.referenceMaterialId);
    const correction = corrections.length > 0;
    const entered = positions.filter(row => canMeasure(row) && String(values[row.id] || '').trim() && (correction ? correcting[row.id] : !measured(row.id)));
    const valid = entered.every(row => {
        const parsed = isDuplicate(row) ? numberParse.parseDuplicateObservation(values[row.id], analyte.numberFormat) : numberParse.parseNumber(values[row.id], analyte.numberFormat);
        return parsed.valid && (isDuplicate(row) || !parsed.qualifier);
    });
    const changeObservation = (id, rawInput) => {
        previewGeneration.current++; setPreview(null); setPreviewError(null);
        setValues(previous => ({ ...previous, [id]: rawInput }));
    };
    const commitPreview = async () => {
        if (!batch.startedAt || locked || !entered.length) return;
        const generation = ++previewGeneration.current;
        try {
            const response = await axios.post(`/api/qc/batches/${batch.id}/preview`,
                entered.map(row => ({ analysisCode: analyte.analysisCode, positionId: row.id, rawInput: values[row.id] })));
            if (previewGeneration.current !== generation) return;
            setPreview(response.data.analytes?.find(row => row.analysisCode === analyte.analysisCode) || null);
            setPreviewError(null);
        } catch (error) {
            if (previewGeneration.current !== generation) return;
            setPreview(null);
            setPreviewError(t(`qcRuns.errors.${error.response?.data?.code}`, error.response?.data?.error || error.message));
        }
    };
    const perform = async operation => {
        previewGeneration.current++; setPreview(null); setPreviewError(null);
        setError(null); setSuccessMsg(null); setLoading(true);
        try { await operation(); await onChanged(); }
        catch (error) { setError(t(`qcRuns.errors.${error.response?.data?.code}`, error.response?.data?.error || error.message)); }
        finally { setLoading(false); }
    };
    const submit = explicit => {
        if (!submitAllowed || changedLots.length || (explicit ? !complete || Boolean(previewError) : !entered.length)) return;
        return perform(async () => {
        const entries = entered.map(row => ({ positionId: row.id, replicateNo: 1, rawInput: values[row.id] }));
        const payload = { analysisCode: analyte.analysisCode, [correction ? 'corrections' : 'measurements']: entries,
            references: [], ...(correction && { reason }) };
        const url = `/api/qc/batches/${batch.id}`;
        const response = correction ? await axios.post(`${url}/corrections`, payload)
            : explicit ? await axios.post(`${url}/evaluate`, payload) : await axios.put(url, payload);
        setValues({}); setLots({}); setCorrecting({});
        setSuccessMsg(response.data.batch?.result === 'NOT_REQUIRED' || analyte.qcMode === 'OFF' ? t('qcRuns.notRequired') : t('qcRuns.saved'));
        });
    };
    const reorder = targetId => {
        const source = draggedId; setDraggedId(null);
        if (!source || source === targetId || batch.startedAt || locked) return;
        const ids = positions.map(row => row.id).filter(id => id !== source); ids.splice(ids.indexOf(targetId), 0, source);
        perform(() => axios.post(`/api/qc/batches/${batch.id}/reorder`, { positionIds: ids }));
    };
    const submitAllowed = !loading && batch.startedAt && !locked && valid && (!correction || reason.trim()) && corrections.every(id => String(values[id] || '').trim());
    let frozen;
    try { frozen = analyte.criteriaSnapshot && JSON.parse(analyte.criteriaSnapshot); } catch { /* Server preview reports unavailable frozen criteria. */ }
    const requiredIds = new Set(frozen?.requiredPositions ? Object.values(frozen.requiredPositions).flat() : positions.filter(canMeasure).map(row => row.id));
    positions.filter(row => row.kind === 'DUPLICATE' && requiredIds.has(row.id)).forEach(row => requiredIds.add(row.duplicateOfPositionId));
    const present = id => Boolean(measured(id) || entered.some(row => row.id === id));
    const pairsComplete = positions.filter(row => row.kind === 'DUPLICATE' && served.has(row.id))
        .every(row => present(row.id) === present(row.duplicateOfPositionId));
    const complete = [...requiredIds].every(present) && pairsComplete;
    const referenceSnapshot = row => {
        const source = binding(row)?.referenceSnapshot;
        try { return typeof source === 'string' ? JSON.parse(source) : source; } catch { return null; }
    };
    const positionProps = row => ({ 'data-testid': `native-position-${row.id}`, draggable: !batch.startedAt && !locked && !loading,
        onDragStart: () => setDraggedId(row.id), onDragOver: event => { if (!batch.startedAt) event.preventDefault(); },
        onDrop: event => { event.preventDefault(); reorder(row.id); } });
    const sampleLabel = row => batch.workItems?.find(item => item.sampleId === row?.sampleId)?.sample?.originalId || row?.sampleId;
    const renderType = row => {
        const snapshot = referenceSnapshot(row), reference = binding(row);
        const parent = positions.find(position => position.id === row.duplicateOfPositionId);
        return <div data-testid={reference ? `native-reference-${row.id}` : undefined} className="text-xs space-y-1">
            <span className="inline-block px-2 py-1 rounded bg-sf-inset font-semibold">{row.position} · {row.kind}
                {row.kind === 'DUPLICATE' && ` · ${sampleLabel(parent) || t('qcWorksheet.notStored')}`}
                {reference && ` · ${snapshot?.code || reference.referenceMaterialId}${snapshot?.lotNumber ? ` · ${snapshot.lotNumber}` : ''}`}</span>
            {row.kind === 'SAMPLE' && <p>{sampleLabel(row)}</p>}
        </div>;
    };
    const renderEvidence = row => {
        if (!canMeasure(row)) return null;
        const candidate = preview?.positions?.find(position => position.positionId === row.id);
        const evidence = candidate || storedPositionEvidence(analyte, row.id) || analyte.entryEvidence?.find(position => position.positionId === row.id);
        const snapshot = referenceSnapshot(row);
        return <div data-testid={`native-evidence-${row.id}`} className="text-xs space-y-1">
            <p>{t('qcWorksheet.expected')}: <output>{(evidence ? evidence.expected : snapshot?.expected) ?? t('qcWorksheet.notStored')}</output></p>
            <p>{t('qcWorksheet.limits')}: <output>{Object.keys(evidence?.limits || {}).length ? JSON.stringify(evidence.limits) : t('qcWorksheet.notStored')}</output></p>
            <p className={verdictColour(evidence?.status)}>{t(candidate ? 'qcWorksheet.preview' : 'qcWorksheet.verdict')}: <output>{evidence?.status ?? t('qcWorksheet.notStored')}</output>
                {evidence?.criterion && ` · ${evidence.criterion}`}</p>
        </div>;
    };
    const renderObservation = row => {
        if (!canMeasure(row)) return null;
        const old = measured(row.id), parsed = preview?.positions?.find(position => position.positionId === row.id)?.parsedObservation;
        return <div className="text-xs space-y-1">
            {old && <p className="font-mono">{t('qcRuns.recorded')}: {old.rawInput ?? old.value ?? t('common.notRecorded')}</p>}
            {(!old || correcting[row.id]) && <label className="grid gap-1">
                {t(row.kind === 'SAMPLE' ? 'qcWorksheet.parentObservation' : 'qcRules.fields.measured')}
                <input type="text" value={values[row.id] || ''} disabled={!batch.startedAt || locked || loading || accepted || correction && !correcting[row.id]}
                    data-testid={`native-value-${row.id}`} aria-label={`${row.position} ${row.kind} ${t(row.kind === 'SAMPLE' ? 'qcWorksheet.parentObservation' : 'qcRules.fields.measured')}`}
                    onChange={event => changeObservation(row.id, event.target.value)} onBlur={commitPreview}
                    className="p-2 rounded border border-sf-divider bg-sf-canvas" />
            </label>}
            {parsed && <p>{t('qcWorksheet.serverParse')}: <output data-testid={`native-parsed-${row.id}`}>{JSON.stringify(parsed)}</output></p>}
        </div>;
    };
    const saveBindings = () => perform(async () => {
        const bindingCorrection = changedLots.some(row => binding(row));
        const payload = { analysisCode: analyte.analysisCode, [bindingCorrection ? 'corrections' : 'measurements']: [],
            references: changedLots.map(row => ({ positionId: row.id, referenceMaterialId: lots[row.id] })), ...(bindingCorrection && { reason }) };
        if (bindingCorrection) await axios.post(`/api/qc/batches/${batch.id}/corrections`, payload);
        else await axios.put(`/api/qc/batches/${batch.id}`, payload);
        setLots({}); setCorrecting({}); setReason('');
    });
    return <section className="space-y-3" data-testid="native-qc-run">
        {batch.analytes.length > 1 && <label className="grid gap-1 text-xs">{t('qcRuns.analysis')}
            <select value={analyte.analysisCode} data-testid="native-analysis-select" disabled={loading}
                onChange={event => { setSelectedCode(event.target.value); onAnalysisChanged?.(event.target.value); }} className="p-2 rounded border border-sf-divider bg-sf-canvas text-sf-text">
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
        {preview && <p className={verdictColour(preview.verdict)} data-testid="native-qc-preview-verdict">{t('qcWorksheet.preview')}: {preview.verdict}</p>}
        {previewError && <p role="alert" data-testid="native-qc-preview-error">{previewError}</p>}
        <section data-testid="native-run-setup" className="space-y-2 p-3 border border-sf-divider rounded-xl">
            <h3 className="text-xs font-semibold">{t('qcWorksheet.runSetup')}</h3>
            {positions.map(row => {
                const reference = binding(row), old = measured(row.id);
                const needsLot = served.has(row.id) && ['LRM', 'CRM', 'ICV', 'CCV', 'CCB'].includes(row.kind);
                const lotKind = { ICV: 'CHECK_STANDARD', CCV: 'CHECK_STANDARD', CCB: 'BLANK_MATRIX' }[row.kind] || row.kind;
                return <div key={row.id} className="text-xs space-y-1">
                    {needsLot && <label className="grid gap-1">{row.position} · {row.kind} · {t('referenceMaterials.controlMaterial')}
                        <select value={lots[row.id] || reference?.referenceMaterialId || ''} disabled={locked || loading || accepted}
                            onChange={event => setLots(previous => ({ ...previous, [row.id]: event.target.value }))} data-testid={`native-lot-${row.id}`}>
                            <option value="">{t('referenceMaterials.choose')}</option>
                            {referenceMaterials.filter(material => material.kind === lotKind).map(material => <option key={material.id} value={material.id} disabled={!material.eligible}>
                                {material.code} · {material.lotNumber}</option>)}
                        </select>
                    </label>}
                    {canMeasure(row) && old && !locked && !accepted && <label className="flex gap-2">
                        <input type="checkbox" checked={!!correcting[row.id]} disabled={loading}
                            onChange={event => setCorrecting(previous => ({ ...previous, [row.id]: event.target.checked }))} />
                        {row.position} · {t('qcRuns.correct')}
                    </label>}
                </div>;
            })}
            {(correction || accepted || changedLots.some(row => binding(row))) && !locked && <label className="grid gap-1 text-xs">{t('qcRuns.reason')}
                <textarea value={reason} onChange={event => setReason(event.target.value)} data-testid="native-correction-reason" className="p-2 border border-sf-divider rounded" />
            </label>}
            {changedLots.length > 0 && <button type="button" data-testid="native-bindings-save"
                disabled={loading || locked || accepted || !batch.startedAt || changedLots.some(row => binding(row)) && !reason.trim()}
                onClick={saveBindings}>{t('qcWorksheet.saveBindings')}</button>}
        </section>
        {renderWorksheet ? renderWorksheet({ positions, analyte, positionProps, renderType, renderObservation, renderEvidence }) :
            <table data-testid="native-run-sequence" className="w-full text-xs">
                <thead><tr><th>{t('qcWorksheet.position')}</th><th>{t('qcWorksheet.measured')}</th><th>{t('qcWorksheet.storedEvidence')}</th></tr></thead>
                <tbody>{positions.map(row => <tr key={row.id} {...positionProps(row)}>
                    <td className="p-2">{renderType(row)}</td><td className="p-2">{renderObservation(row)}</td><td className="p-2">{renderEvidence(row)}</td>
                </tr>)}</tbody>
            </table>}
        {accepted && !locked && <button type="button" disabled={loading || !reason.trim()} data-testid="native-run-reopen"
            onClick={() => perform(() => axios.put(`/api/qc/batches/${batch.id}`, { analysisCode: analyte.analysisCode, status: 'OPEN', reason }))}>{t('qcRuns.reopen')}</button>}
        {['QC_PASS', 'QC_WARN', 'ACCEPTED_WITH_DEVIATION'].includes(analyte.status) && <button type="button" disabled={loading} data-testid="native-analyte-close"
            onClick={() => perform(() => axios.put(`/api/qc/batches/${batch.id}`, { analysisCode: analyte.analysisCode, status: 'CLOSED' }))}>{t('qcRuns.closeAnalyte')}</button>}
        <div className="flex gap-3">
            <button type="button" data-testid="native-qc-save" disabled={!submitAllowed || changedLots.length > 0 || !entered.length} onClick={() => submit(false)}>{t('qcRuns.save')}</button>
            <button type="button" data-testid="native-qc-evaluate" disabled={!submitAllowed || !complete || Boolean(previewError) || changedLots.length > 0} onClick={() => submit(true)}>{t('qcRuns.evaluate')}</button>
        </div>
        {analyte.reviewedCorrections?.length > 0 && <aside className="border border-sf-divider rounded-lg p-3 space-y-2" data-testid="native-reviewed-qc-history">
            <h3 className="font-bold">{t('qcReviewedCorrection.disclosure')}</h3>
            {analyte.reviewedCorrections.map(row => <div key={row.id}>
                <p>{t('qcReviewedCorrection.originalFailure')}: {row.previousVerdict} ({row.previousEvaluationId})
                    {' · '}{t('qcReviewedCorrection.replacement')}: {row.replacementEvaluation?.verdict} ({row.evaluationId})</p>
                <p>{t('qcReviewedCorrection.reviewer')}: {row.reviewer?.username || row.by} · {row.reason} · {row.sourceReference}</p>
                <details><summary>{t('qcWorksheet.fullRecord')}</summary><pre className="whitespace-pre-wrap break-all text-xs">{JSON.stringify(row, null, 2)}</pre></details>
            </div>)}
        </aside>}
    </section>;
}
