import React, { useState } from 'react';
import axios from 'axios';

export default function ReviewedQcCorrection({ batch, token, canReview, onSubmitted, t }) {
    const [analysisCode, setAnalysisCode] = useState('');
    const [values, setValues] = useState({});
    const [reason, setReason] = useState('');
    const [sourceReference, setSourceReference] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const candidates = (batch?.analytes || []).filter(row => row.status === 'QC_FAIL' && !row.disposition);
    const selected = candidates.find(row => row.analysisCode === analysisCode) || candidates[0];
    if (!canReview || !batch?.reviewedTranscriptionCorrectionEnabled || batch.status === 'CLOSED' || !selected) return null;
    const positions = new Map((selected.positions || []).filter(row => row.historicalSnapshotSeq == null && row.kind !== 'CAL_STD').map(row => [row.id, row]));
    const observations = (selected.measurements || []).filter(row => !row.supersededById && positions.has(row.positionId));
    const corrections = observations.filter(row => String(values[row.id] || '').trim()).map(row => ({
        positionId: row.positionId, replicateNo: row.replicateNo, rawInput: values[row.id]
    }));
    const submit = async event => {
        event.preventDefault();
        if (busy || !corrections.length || !reason.trim() || !sourceReference.trim()) return;
        setBusy(true); setError('');
        try {
            await axios.post(`/api/qc/batches/${encodeURIComponent(batch.id)}/corrections`, {
                mode: 'REVIEWED_TRANSCRIPTION', analysisCode: selected.analysisCode, corrections,
                reason: reason.trim(), sourceReference: sourceReference.trim()
            }, { headers: { Authorization: `Bearer ${token}` } });
            setValues({}); setReason(''); setSourceReference(''); await onSubmitted();
        } catch (failure) {
            setError(failure.response?.data?.error || failure.message || t('qcReviewedCorrection.refused'));
        } finally { setBusy(false); }
    };
    return <form onSubmit={submit} className="space-y-3 border border-sf-divider rounded-lg p-4" data-testid="reviewed-qc-correction">
        <h3 className="font-bold">{t('qcReviewedCorrection.title')}</h3>
        <p className="text-sm">{t('qcReviewedCorrection.help')}</p>
        <label className="block">{t('qcReviewedCorrection.analysis')}
            <select value={selected.analysisCode} disabled={busy} data-testid="reviewed-qc-analysis" className="block w-full sf-input"
                onChange={event => { setAnalysisCode(event.target.value); setValues({}); setError(''); }}>
                {candidates.map(row => <option key={row.analysisCode} value={row.analysisCode}>{row.analysisCode}</option>)}
            </select>
        </label>
        {observations.map(row => <label className="block text-sm" key={row.id}>
            {positions.get(row.positionId).position} · {positions.get(row.positionId).kind} · {row.replicateNo} · {t('qcReviewedCorrection.original')}: {row.rawInput ?? row.value}
            <input type="text" inputMode="decimal" disabled={busy} className="block w-full sf-input"
                value={values[row.id] || ''} data-testid={`reviewed-qc-value-${row.id}`} aria-label={t('qcReviewedCorrection.correctedValue')}
                onChange={event => setValues(previous => ({ ...previous, [row.id]: event.target.value }))} />
        </label>)}
        <label className="block">{t('qcReviewedCorrection.reason')}
            <textarea required value={reason} disabled={busy} className="block w-full sf-input" data-testid="reviewed-qc-reason" onChange={event => setReason(event.target.value)} />
        </label>
        <label className="block">{t('qcReviewedCorrection.sourceReference')}
            <input required type="text" value={sourceReference} disabled={busy} className="block w-full sf-input" data-testid="reviewed-qc-source" onChange={event => setSourceReference(event.target.value)} />
        </label>
        {error && <p role="alert" data-testid="reviewed-qc-error">{error}</p>}
        <button type="submit" disabled={busy || !corrections.length || !reason.trim() || !sourceReference.trim()} data-testid="reviewed-qc-submit" className="sf-btn sf-btn-primary">
            {busy ? t('qcReviewedCorrection.saving') : t('qcReviewedCorrection.submit')}
        </button>
    </form>;
}
