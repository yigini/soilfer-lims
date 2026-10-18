import React, { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { trialStatistics } from './ControlCharts';

export default function BlankHistory({ labId }) {
    const { hasPermission } = useAuth(), { t } = useLanguage();
    const allowed = hasPermission('VIEW_ANALYTICAL_RESULTS');
    const tr = (key, values) => t(`blankHistory.${key}`, values);
    const [series, setSeries] = useState([]), [selected, setSelected] = useState('');
    const [view, setView] = useState(null), [selection, setSelection] = useState({}), [reason, setReason] = useState('');
    const [excludedCounts, setExcludedCounts] = useState({}), [error, setError] = useState('');
    const [loadingSeries, setLoadingSeries] = useState(false), [loadingHistory, setLoadingHistory] = useState(false);
    const [saving, setSaving] = useState(false), [refresh, setRefresh] = useState(0), [reloadLab, setReloadLab] = useState(0);
    const origin = useRef({ labId, selected }), request = useRef(null);
    origin.current = { labId, selected };
    const reportError = useCallback(e => {
        const code = e.response?.data?.code || 'LOD_LOQ_FAILED';
        setError(t(`blankHistory.errors.${code}`, t('blankHistory.requestFailed')));
    }, [t]);
    useEffect(() => {
        const controller = new AbortController(); let live = true;
        setSeries([]); setSelected(''); setView(null); setExcludedCounts({}); setError(''); setSaving(false); request.current = null;
        setLoadingSeries(false);
        if (!allowed || !labId) return () => controller.abort();
        setLoadingSeries(true);
        axios.get('/api/qc/blank-history/series', { params: { labId }, signal: controller.signal }).then(response => {
            if (live) { setSeries(response.data.series); setExcludedCounts(response.data.excludedCounts); }
        }).catch(e => { if (live && !controller.signal.aborted) reportError(e); }).finally(() => { if (live) setLoadingSeries(false); });
        return () => { live = false; controller.abort(); };
    }, [allowed, labId, reloadLab, reportError]);
    useEffect(() => {
        const controller = new AbortController(); let live = true;
        setView(null); setSelection({}); setReason(''); setError(''); setSaving(false); request.current = null;
        setLoadingHistory(false);
        const row = selected === '' ? null : series[Number(selected)];
        if (!row) return () => controller.abort();
        setLoadingHistory(true);
        axios.get('/api/qc/blank-history', { params: row, signal: controller.signal }).then(response => {
            if (!live) return;
            setView(response.data);
            setSelection(Object.fromEntries(response.data.points.map(point => [point.measurementId, { selected: true, reason: '' }])));
        }).catch(e => { if (live && !controller.signal.aborted) reportError(e); }).finally(() => { if (live) setLoadingHistory(false); });
        return () => { live = false; controller.abort(); };
    }, [selected, series, refresh, reportError]);
    const points = view?.points || [], effective = points.filter(row => selection[row.measurementId]?.selected);
    const trial = trialStatistics(effective);
    const missingReason = points.some(row => !selection[row.measurementId]?.selected && !selection[row.measurementId]?.reason.trim());
    const propose = async event => {
        event.preventDefault();
        const from = { labId, selected };
        const body = { ...view.series, fingerprint: view.fingerprint, reason,
            selectedMeasurementIds: effective.map(row => row.measurementId),
            exclusions: points.filter(row => !selection[row.measurementId]?.selected)
                .map(row => ({ measurementId: row.measurementId, reason: selection[row.measurementId]?.reason || '' })) };
        const key = JSON.stringify(body);
        if (request.current?.key !== key) request.current = { key, id: globalThis.crypto.randomUUID() };
        setSaving(true); setError('');
        try {
            await axios.post('/api/qc/lod-loq-proposals', { ...body, requestId: request.current.id });
            if (origin.current.labId === from.labId && origin.current.selected === from.selected) setRefresh(value => value + 1);
        } catch (e) { if (origin.current.labId === from.labId && origin.current.selected === from.selected) reportError(e); }
        finally { if (origin.current.labId === from.labId && origin.current.selected === from.selected) setSaving(false); }
    };
    if (!allowed || !labId) return null;
    const loading = loadingSeries || loadingHistory;
    const excluded = view?.excludedCounts || excludedCounts;
    return <section className="space-y-4 border-t border-sf-divider pt-5" data-testid="blank-history">
        <h3 className="font-bold text-lg">{tr('title')}</h3>
        <p className="text-sm text-sf-muted">{tr('deferred')}</p>
        {error && <div role="alert" className="text-red-600"><p>{error}</p><button type="button" className="underline" onClick={() => setReloadLab(value => value + 1)}>{t('common.refresh')}</button></div>}
        <label className="grid gap-1">{tr('series')}<select aria-label={tr('series')} className="w-full min-w-0 border rounded p-2 bg-sf-canvas"
            value={selected} onChange={e => setSelected(e.target.value)}>
            <option value="">{tr('chooseSeries')}</option>{series.map((row, index) => <option key={index} value={index}>
                {row.analysisCode} · {row.methodName} · {tr('revision')} {row.methodRevision} · {row.analysisUnit}</option>)}
        </select></label>
        {loading ? <p role="status">{tr('loading')}</p> : !error && !series.length && <p>{tr('empty')}</p>}
        {!loading && !error && <><h4 className="font-semibold">{tr('excludedHistory')}</h4>
            {Object.keys(excluded).length ? <ul>{Object.entries(excluded).map(([code, count]) => <li key={code}>{tr(`exclusions.${code}`)}: {count}</li>)}</ul> : <p>{tr('noExclusions')}</p>}</>}
        {view && <>
            <p>{tr('sampleCount', { n: effective.length, window: view.windowSize })} · {tr('minimum')}: {view.minimumPoints}</p>
            <p className="text-sm">{tr('selectionHelp')}</p>
            <form className="space-y-3" onSubmit={propose}>
                <div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead><tr>
                    {['selected', 'measurement', 'execution', 'value', 'blankStatus', 'batchVerdict', 'exclusionReason'].map(key => <th className="p-2" key={key}>{tr(key)}</th>)}
                </tr></thead><tbody>{points.map(point => <tr key={point.measurementId} className="border-t border-sf-divider">
                    <td className="p-2"><input type="checkbox" aria-label={`${tr('selected')} ${point.measurementId}`} checked={Boolean(selection[point.measurementId]?.selected)}
                        disabled={!view.canPropose || saving} onChange={e => setSelection(old => ({ ...old, [point.measurementId]: { ...old[point.measurementId], selected: e.target.checked } }))} /></td>
                    <td className="p-2 break-all font-mono">{point.measurementId}</td><td className="p-2">{point.executionTime} · {point.sequenceIndex}</td>
                    <td className="p-2 font-mono">{point.value} {point.analysisUnit}</td><td className="p-2">{tr(`verdicts.${point.blankStatus}`)}</td><td className="p-2">{tr(`verdicts.${point.verdict}`)}</td>
                    <td className="p-2">{!selection[point.measurementId]?.selected && <input required aria-label={`${tr('exclusionReason')} ${point.measurementId}`}
                        value={selection[point.measurementId]?.reason || ''} disabled={!view.canPropose || saving} className="border rounded p-2 bg-sf-canvas"
                        onChange={e => setSelection(old => ({ ...old, [point.measurementId]: { selected: false, reason: e.target.value } }))} />}</td>
                </tr>)}</tbody></table></div>
                {trial && <p>{tr('preview')} · {tr('mean')}: {trial.mean} · {tr('sd')}: {trial.sd} · LOD: {view.lodMultiplier * trial.sd} · LOQ: {view.loqMultiplier * trial.sd}</p>}
                <p>{tr('formula', { lod: view.lodMultiplier, loq: view.loqMultiplier })}</p>
                {view.canPropose && <><label className="grid gap-1">{tr('proposalReason')}<textarea required value={reason} onChange={e => setReason(e.target.value)} className="border rounded p-2 bg-sf-canvas" /></label>
                    <button className="btn-primary" disabled={saving || !reason.trim() || missingReason || effective.length < view.minimumPoints || !Number.isFinite(trial?.sd) || trial.sd <= 0}>{tr('propose')}</button></>}
            </form>
            <h4 className="font-semibold">{tr('proposals')}</h4>
            {!view.proposals.length && <p>{tr('noProposals')}</p>}
            {view.proposals.map(row => <details className="border rounded p-3" key={row.id}><summary>{row.proposedAt} · {row.proposedBy} · {tr('sampleCount', { n: row.n, window: row.windowSize })}</summary>
                <p>{row.reason} · {tr('revision')} {row.series.methodRevision} · {row.series.analysisUnit}</p>
                <p>{tr('mean')}: {row.mean} · {tr('sd')}: {row.sd} · LOD: {row.lod} · LOQ: {row.loq}</p><p>{tr('deferred')}</p>
                <ul>{row.observations.map(point => <li key={point.measurementId} className="break-all">{point.measurementId} · {point.evaluationId} · {point.value} · {tr(point.selected ? 'selected' : 'excluded')}{point.exclusionReason && ` · ${point.exclusionReason}`}</li>)}</ul>
            </details>)}
        </>}
    </section>;
}
