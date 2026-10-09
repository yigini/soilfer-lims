import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';

export default function ReportedValueReview({ itemId, itemVersion, itemStatus, token, t, canReview, onChoice, onSaved }) {
    const [data, setData] = useState(null), [error, setError] = useState('');
    const [mode, setMode] = useState('AUTO'), [attemptId, setAttemptId] = useState('');
    const [meanIds, setMeanIds] = useState([]), [mean, setMean] = useState(null), [reason, setReason] = useState('');
    const [saving, setSaving] = useState(false), [reload, setReload] = useState(0);
    const loadGeneration = useRef(0), previewGeneration = useRef(0), modeRef = useRef('AUTO'), choiceCallback = useRef(onChoice);
    const reasonRef = useRef(reason); reasonRef.current = reason;
    choiceCallback.current = onChoice;
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const refusal = response => t(`reportedValue.errors.${response?.code}`, response?.error || t('reportedValue.unavailable'));
    useEffect(() => {
        const generation = ++loadGeneration.current;
        previewGeneration.current++; modeRef.current = 'AUTO';
        setData(null); setError(''); setMode('AUTO'); setAttemptId(''); setReason(''); setMean(null); setMeanIds([]); setSaving(false);
        choiceCallback.current?.({ selection: null, ready: false });
        if (canReview) axios.get(`/api/work/${itemId}/reported-value`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
            .then(response => {
                if (generation !== loadGeneration.current) return;
                const next = response.data; setData(next); setMean(next.mean || null);
                setMeanIds((next.attempts || []).filter(row => row.eligible).map(row => row.id));
                choiceCallback.current?.({ selection: null, ready: next.notRequired || Boolean(next.automatic?.choice) });
            }).catch(err => {
                if (generation === loadGeneration.current) setError(err.response?.data?.error || err.message);
            });
        return () => { loadGeneration.current++; previewGeneration.current++; };
    }, [itemId, itemVersion, itemStatus, token, canReview, reload]);

    const choice = (nextMode = mode, nextReason = reason, nextId = attemptId, nextMean = mean, nextIds = meanIds) => {
        if (nextMode === 'AUTO') return { selection: null, ready: Boolean(data?.automatic?.choice) };
        if (nextMode === 'NOT_REPORTABLE') return { selection: { mode: nextMode, reason: nextReason.trim() }, ready: Boolean(nextReason.trim()) };
        if (nextMode === 'DERIVED') return {selection:{mode:nextMode,...(nextReason.trim() && {reason:nextReason.trim()})},
            ready:Boolean(data?.derived?.allowed && (!data.derived.requiresReason || nextReason.trim()))};
        if (nextMode === 'ATTEMPT') {
            const option = data?.attempts.find(row => row.id === nextId)?.option;
            return { selection: { mode: nextMode, attemptIds: [nextId], ...(nextReason.trim() && { reason: nextReason.trim() }) },
                ready: Boolean(option?.allowed && (!option.requiresReason || nextReason.trim())) };
        }
        return { selection: { mode: 'MEAN', attemptIds: nextIds, ...(nextReason.trim() && { reason: nextReason.trim() }) },
            ready: Boolean(nextMean?.allowed && (!nextMean.requiresReason || nextReason.trim())) };
    };
    const choose = (nextMode, nextId = attemptId) => {
        modeRef.current = nextMode; setMode(nextMode); setAttemptId(nextId);
        choiceCallback.current?.(choice(nextMode, reason, nextId));
    };
    const changeMean = async ids => {
        const generation = ++previewGeneration.current; setMeanIds(ids); setMean(null);
        if (modeRef.current === 'MEAN') choiceCallback.current?.({ selection: { mode: 'MEAN', attemptIds: ids }, ready: false });
        let next;
        try { next = (await axios.post(`/api/work/${itemId}/reported-value/preview`, { mode: 'MEAN', attemptIds: ids }, { headers })).data; }
        catch (err) { next = { allowed: false, ...(err.response?.data || { error: err.message }) }; }
        if (generation !== previewGeneration.current) return;
        setMean(next);
        if (modeRef.current === 'MEAN') choiceCallback.current?.(choice('MEAN', reasonRef.current, attemptId, next, ids));
    };
    const save = async () => {
        const selected = choice(); if (!selected.ready || !selected.selection || saving) return;
        const generation = loadGeneration.current;
        setSaving(true); setError('');
        try {
            await axios.post(`/api/work/${itemId}/reported-value`, { expectedGroupId: data.current.groupId, selection: selected.selection }, { headers });
            if (generation === loadGeneration.current) { setReload(value => value + 1); onSaved?.(); }
        } catch (err) { if (generation === loadGeneration.current) setError(refusal(err.response?.data || { error: err.message })); }
        finally { if (generation === loadGeneration.current) setSaving(false); }
    };
    if (!canReview || data?.notRequired) return null;
    const outputText = (outputs, selectedMode, selectedReason) => (outputs || []).map(row => {
        if((row.mode || selectedMode)==='NOT_REPORTABLE') {
            let displayed=row.reason || selectedReason || '';
            try {
                const stored=JSON.parse(displayed);
                if(stored.code==='FRACTION_NOT_REPORTABLE') displayed=stored.fractions.map(fraction=>
                    t('reportedValue.fractionNotReportable',{fraction:fraction.analysisCode,selectionId:fraction.selectionId})).join(' ');
            } catch { /* Keep the recorded reviewer reason. */ }
            return `${row.analysisCode}: ${t('reportedValue.notReportable')}: ${displayed}`;
        }
        return `${row.analysisCode}: ${row.valueText}${row.unit ? ' '+row.unit : ''}`;
    }).join(' · ');
    return <section className="w-full space-y-3 border-t border-sf-divider pt-3 text-xs" data-testid={`reported-value-${itemId}`}>
        <h4 className="font-bold">{t('reportedValue.title')}</h4>
        {error && <div role="alert">{error} <button type="button" onClick={() => setReload(value => value + 1)}>{t('reportedValue.reload')}</button></div>}
        {!data ? <p>{t('reportedValue.loading')}</p> : <>
            {data.current.code && data.current.groupId && <p role="alert">{refusal({ code: data.current.code })}</p>}
            <div className="overflow-x-auto"><table className="w-full text-left"><thead><tr>
                {['attempt','batch','analyst','date','replicates','mean','reason','status'].map(key => <th className="p-2" key={key}>{t(`reportedValue.${key}`)}</th>)}
            </tr></thead><tbody>{data.attempts.map(row => <tr key={row.id} data-testid={`reported-attempt-${row.id}`}>
                <td className="p-2">{row.attemptNo}</td><td className="p-2">{row.batchId || '—'} <span className="rounded border border-sf-divider px-1">{[...new Set(row.qcGates.map(gate => gate.value))].join(', ') || '—'}</span></td>
                <td className="p-2">{row.analyst || '—'}</td><td className="p-2">{row.recordedAt ? new Date(row.recordedAt).toLocaleString() : '—'}</td>
                <td className="p-2">{row.results.map(result => <div key={result.id}>{result.param} #{result.replicateNo}: {result.valueText} {result.unit || ''} {result.censoring !== 'NONE' && result.censoring}</div>)}</td>
                <td className="p-2">{row.option?.allowed ? outputText(row.option.choice.outputs) : row.option ? refusal(row.option) : '—'}</td>
                <td className="p-2">{row.reason && t(`repeatCommands.reasons.${row.reason}`, row.reason)} {row.note}</td><td className="p-2">{t(`reportedValue.statuses.${row.status}`, row.status)}</td>
            </tr>)}</tbody></table></div>
            {data.current.rows.length > 0 && <p>{t('reportedValue.current')}: {outputText(data.current.rows)} · {data.current.rows[0].selectedBy}</p>}
            <fieldset className="space-y-2" disabled={saving}>
                <legend className="font-semibold">{t('reportedValue.choose')}</legend>
                {itemStatus !== 'ACCEPTED' && <label className="block"><input type="radio" name={`reported-${itemId}`} checked={mode === 'AUTO'}
                    disabled={!data.automatic.choice} onChange={() => choose('AUTO')} /> {t('reportedValue.automatic')} {data.automatic.choice && outputText(data.automatic.choice.outputs,data.automatic.choice.mode,data.automatic.choice.reason)}
                    {!data.automatic.choice && <span> · {data.automatic.reasons.map(code => t(`reportedValue.errors.${code}`, code)).join(', ')}</span>}</label>}
                {data.attempts.filter(row => row.eligible).map(row => <label className="block" key={row.id}>
                    <input type="radio" name={`reported-${itemId}`} checked={mode === 'ATTEMPT' && attemptId === row.id} disabled={!row.option.allowed}
                        data-testid={`reported-choose-${row.id}`} onChange={() => choose('ATTEMPT', row.id)} /> {t('reportedValue.reportAttempt')} {row.attemptNo}
                    {!row.option.allowed && <span> · {refusal(row.option)}</span>}
                </label>)}
                {data.layout==='SEPARATE' && <label className="block"><input type="radio" name={`reported-${itemId}`} checked={mode==='DERIVED'}
                    disabled={!data.derived?.allowed} data-testid="reported-choose-derived" onChange={()=>choose('DERIVED')} /> {t('reportedValue.reportDerived')}
                    {data.derived?.allowed ? outputText(data.derived.choice.outputs,data.derived.choice.mode,data.derived.choice.reason) : data.derived && refusal(data.derived)}</label>}
                {data.layout!=='SEPARATE' && <><div className="space-x-3">{data.attempts.filter(row => row.eligible).map(row => <label key={row.id}>
                    <input type="checkbox" checked={meanIds.includes(row.id)} data-testid={`reported-mean-member-${row.id}`}
                        onChange={event => changeMean(event.target.checked ? [...meanIds,row.id] : meanIds.filter(id => id !== row.id))} /> {t('reportedValue.meanMember')} {row.attemptNo}
                </label>)}</div>
                <label className="block"><input type="radio" name={`reported-${itemId}`} checked={mode === 'MEAN'} disabled={!mean?.allowed}
                    data-testid="reported-choose-mean" onChange={() => choose('MEAN')} /> {t('reportedValue.reportMean')} {mean?.allowed && outputText(mean.choice.outputs)}
                    {!mean?.allowed && <span data-testid="reported-mean-refusal"> · {mean ? refusal(mean) : t('reportedValue.loading')}</span>}</label></>}
                <label className="block"><input type="radio" name={`reported-${itemId}`} checked={mode === 'NOT_REPORTABLE'}
                    data-testid="reported-choose-not-reportable" onChange={() => choose('NOT_REPORTABLE')} /> {t('reportedValue.notReportable')}</label>
                <label className="block">{t('reportedValue.reason')}<textarea className="mt-1 block w-full border border-sf-divider rounded p-2 bg-sf-surface"
                    value={reason} required={mode === 'NOT_REPORTABLE' || mode === 'DERIVED' && data.derived?.requiresReason || mode === 'MEAN' && mean?.requiresReason || mode === 'ATTEMPT' && data.attempts.find(row => row.id === attemptId)?.option.requiresReason}
                    data-testid="reported-choice-reason" onChange={event => {
                        setReason(event.target.value); choiceCallback.current?.(choice(mode,event.target.value));
                    }} /></label>
            </fieldset>
            {itemStatus === 'ACCEPTED' && <button type="button" className="rounded border border-sf-divider p-2" data-testid="reported-save"
                disabled={saving || !choice().ready || !choice().selection} onClick={save}>{t('reportedValue.save')}</button>}
        </>}
    </section>;
}
