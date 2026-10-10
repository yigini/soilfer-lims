import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';

export default function CrossCheckPanel({ sampleId, reviewVersion, token, t, canReview }) {
    const [data, setData] = useState(null), [error, setError] = useState(''), [reload, setReload] = useState(0);
    const generation = useRef(0);
    useEffect(() => {
        const current = ++generation.current;
        setData(null); setError('');
        if (!sampleId || !canReview) return;
        axios.get(`/api/results/${sampleId}/cross-checks`, { headers: { Authorization: `Bearer ${token}` } })
            .then(response => { if (generation.current === current) setData(response.data); })
            .catch(failure => { if (generation.current === current) setError(failure.response?.data?.code || 'CROSS_CHECK_READ_FAILED'); });
        return () => { generation.current++; };
    }, [sampleId, reviewVersion, token, canReview, reload]);
    if (!canReview || !sampleId) return null;
    const rows = (evaluations, label) => <div className="space-y-2">
        <h5 className="font-semibold">{label}</h5>
        {!evaluations.length ? <p>{t('crossCheck.noSubmission')}</p> : <div className="overflow-x-auto"><table className="w-full text-left">
            <thead><tr>{['check', 'outcome', 'evidence'].map(key => <th className="p-2" key={key}>{t(`crossCheck.${key}`)}</th>)}</tr></thead>
            <tbody>{evaluations.map((row, index) => <tr key={row.id || row.ruleCode + index} data-testid={`cross-check-${row.ruleCode}-${row.id || 'current'}`}>
                <th scope="row" className="p-2">{t(`crossCheck.rules.${row.ruleCode}`)}</th>
                <td className="p-2"><span>{t(`crossCheck.outcomes.${row.outcome}`)}</span>
                    {row.flagCode && <p data-testid={`cross-check-flag-${row.flagCode}`}>{t(`crossCheck.flags.${row.flagCode}`)}</p>}
                    {row.reasonCode && <p>{t(`crossCheck.reasons.${row.reasonCode}`)}</p>}
                    {row.inputs.lowerBound && <p>{t('crossCheck.lowerBound')}</p>}
                </td>
                <td className="p-2"><details><summary>{t('crossCheck.evidence')}</summary>
                    <p>{t('crossCheck.policyVersion', { version: row.thresholds.policyVersion })}</p>
                    {Object.entries(row.thresholds).filter(([key]) => key !== 'policyVersion').map(([key, value]) =>
                        <p key={key}>{t(`policies.keys.${key.replaceAll('.', '_')}`, key)}: {String(value)}</p>)}
                    {row.inputs.values.map((input, number) => <p key={number}>
                        {input.analysisCode}: {input.value === null ? '—' : String(input.value)} {input.unit || '—'} · {input.basis || '—'} · {input.censoring || '—'}
                        <br />{t('crossCheck.sources')}: {input.resultIds.join(', ') || '—'}
                        {input.selectionId && <> · {t('crossCheck.selection')}: {input.selectionId}</>}
                    </p>)}
                    {!!row.inputs.missing.length && <p>{t('crossCheck.missingInputs')}: {row.inputs.missing.join(', ')}</p>}
                    {row.evaluatedBy && <p>{row.evaluatedBy} · {new Date(row.evaluatedAt).toLocaleString()}</p>}
                </details></td>
            </tr>)}</tbody></table></div>}
    </div>;
    return <section className="w-full space-y-3 rounded border border-sf-divider p-3 text-xs" data-testid="cross-check-panel">
        <h4 className="font-bold">{t('crossCheck.title')}</h4>
        <p>{t('crossCheck.advisory')}</p>
        {error && <p role="alert">{t(`crossCheck.errors.${error}`, t('crossCheck.errors.CROSS_CHECK_READ_FAILED'))}
            <button type="button" data-testid="cross-check-reload" onClick={() => setReload(value => value + 1)}>{t('crossCheck.reload')}</button></p>}
        {!error && !data && <p>{t('crossCheck.loading')}</p>}
        {data && <>
            {data.crossCheckUnavailableReason ? <p role="status" data-testid="cross-check-unavailable">
                {t(`crossCheck.unavailable.${data.crossCheckUnavailableReason}`)}</p> : <>
            {data.current ? rows(data.current.evaluations, t('crossCheck.current')) : <p>{t('crossCheck.beforeSelection')}</p>}
            {rows(data.atSubmission, t('crossCheck.atSubmission'))}
            {data.selectionErrors.map(row => <p key={row.workItemId} role="status">{row.analysisCode}: {t(`reportedValue.errors.${row.code}`, row.code)}</p>)}
            </>}
            <p data-testid="cross-check-existing-gate">{t('crossCheck.existingGate')}: {t(data.existingTextureGate.texture === null
                ? 'crossCheck.gateNotEvaluated' : data.existingTextureGate.isBlocking ? 'crossCheck.gateBlocks' : 'crossCheck.gatePasses')}</p>
        </>}
    </section>;
}
