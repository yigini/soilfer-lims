import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

export function trialStatistics(points) {
    if (points.length < 2) return null;
    const mean = points[0].value + points.reduce((sum, row) => sum + row.value - points[0].value, 0) / points.length;
    const sd = Math.sqrt(points.reduce((sum, row) => sum + (row.value - mean) ** 2, 0) / (points.length - 1));
    return { mean, sd, n: points.length };
}

export function ControlChartPlot({ points, basis, t }) {
    const lines = basis?.mode === 'CONTROL_CHART' ? [-3, -2, 0, 2, 3].map(z => ({ value: basis.mean + z * basis.sd,
        label: z === 0 ? t('controlCharts.mean') : `${z > 0 ? '+' : '−'}${Math.abs(z)}s` }))
        : basis?.fixedWindow ? [{ value: basis.fixedWindow.lower, label: t('controlCharts.lower') },
            { value: basis.fixedWindow.upper, label: t('controlCharts.upper') }] : [];
    const values = [...points.map(row => row.value), ...lines.map(row => row.value)];
    if (!values.length) return <p>{t('controlCharts.noPoints')}</p>;
    const min = values.reduce((a, b) => Math.min(a, b)), max = values.reduce((a, b) => Math.max(a, b)), padding = (max - min || Math.abs(max) || 1) * 0.1;
    const y = value => 240 - (value - min + padding) / (max - min + padding * 2) * 210;
    const x = index => 75 + index / Math.max(1, points.length - 1) * 600;
    return <svg viewBox="0 0 780 285" role="img" aria-label={t('controlCharts.plot')} className="w-full max-h-96">
        <title>{t('controlCharts.plot')}</title>
        <rect x="75" y="20" width="600" height="230" fill="none" stroke="currentColor" opacity="0.3" />
        {lines.map(line => <g key={line.label}><line x1="75" x2="675" y1={y(line.value)} y2={y(line.value)} stroke="currentColor" strokeDasharray="4 4" opacity="0.5" />
            <text x="685" y={y(line.value) + 4} fontSize="12" fill="currentColor">{line.label}</text></g>)}
        <polyline points={points.map((row, index) => `${x(index)},${y(row.value)}`).join(' ')} fill="none" stroke="currentColor" />
        {points.map((row, index) => <circle key={row.measurementId} cx={x(index)} cy={y(row.value)} r="4" fill={row.inControl ? '#15803d' : '#b91c1c'}>
            <title>{`${row.measurementId}: ${row.value}`}</title></circle>)}
        <text x="75" y="275" fontSize="12" fill="currentColor">{t('controlCharts.executionOrder')}</text>
    </svg>;
}

export default function ControlCharts({ labId }) {
    const { t } = useLanguage(), { user, hasPermission } = useAuth();
    const tr = key => t(`controlCharts.${key}`);
    const allowed = hasPermission('VIEW_ANALYTICAL_RESULTS');
    const [series, setSeries] = useState([]), [selected, setSelected] = useState(''), [chart, setChart] = useState(null);
    const [reviews, setReviews] = useState({ obligations: [], canResolve: false });
    const [error, setError] = useState(''), [loading, setLoading] = useState(false), [saving, setSaving] = useState(false);
    const [selection, setSelection] = useState({}), [reason, setReason] = useState(''), [basisKey, setBasisKey] = useState('');
    const [resolution, setResolution] = useState({});
    const currentView = useRef({ labId, selected });
    currentView.current = { labId, selected };
    const reportError = useCallback(e => setError(`${t('controlCharts.requestFailed')} (${e.response?.data?.code || e.code || 'QC_CHART_FAILED'})`), [t]);
    const loadLab = useCallback(async () => {
        if (!allowed || !labId) return;
        const [available, pending] = await Promise.all([axios.get('/api/qc/control-charts/series', { params: { labId } }),
            axios.get('/api/qc/control-reviews', { params: { labId } })]);
        if (currentView.current.labId === labId) { setSeries(available.data.series); setReviews(pending.data); }
    }, [allowed, labId]);
    useEffect(() => {
        let live = true;
        setSeries([]); setSelected(''); setChart(null); setReviews({ obligations: [], canResolve: false }); setError('');
        if (!allowed || !labId) return;
        setLoading(true);
        Promise.all([axios.get('/api/qc/control-charts/series', { params: { labId } }), axios.get('/api/qc/control-reviews', { params: { labId } })])
            .then(([a, b]) => { if (live) { setSeries(a.data.series); setReviews(b.data); } }).catch(e => { if (live) reportError(e); })
            .finally(() => { if (live) setLoading(false); });
        return () => { live = false; };
    }, [allowed, labId, reportError]);
    const loadChart = useCallback(async row => {
        const response = await axios.get('/api/qc/control-charts', { params: row });
        return response.data;
    }, []);
    useEffect(() => {
        let live = true;
        setChart(null); setSelection({}); setReason(''); setError('');
        const row = series[Number(selected)];
        if (selected === '' || !row) return;
        setLoading(true);
        loadChart(row).then(data => {
            if (!live) return;
            setChart(data); setSelection(Object.fromEntries(data.points.filter(point => point.inControl).map(point => [point.measurementId, { selected: true, reason: '' }])));
            setBasisKey(data.current ? `set:${data.current.id}` : data.points.at(-1)?.basisKey || '');
        }).catch(e => { if (live) reportError(e); }).finally(() => { if (live) setLoading(false); });
        return () => { live = false; };
    }, [selected, series, loadChart, reportError]);
    const bases = useMemo(() => {
        if (!chart) return [];
        const result = new Map(chart.points.map(row => [row.basisKey, row.basis]));
        for (const set of chart.sets) result.set(`set:${set.id}`, { mode: 'CONTROL_CHART', key: `set:${set.id}`, controlLimitSetId: set.id, mean: set.mean, sd: set.sd });
        return [...result.values()];
    }, [chart]);
    const baseline = chart?.points.filter(row => row.inControl && selection[row.measurementId]?.selected) || [];
    const trial = trialStatistics(baseline), basis = bases.find(row => row.key === basisKey);
    const save = async (url, body) => {
        const origin = { labId, selected };
        setSaving(true); setError('');
        try {
            await axios.post(url, body);
            if (chart) {
                const refreshed = await loadChart(chart.series);
                if (currentView.current.labId === origin.labId && currentView.current.selected === origin.selected) setChart(refreshed);
            }
            await loadLab(); return true;
        } catch (e) { reportError(e); return false; }
        finally { setSaving(false); }
    };
    if (!allowed || !labId) return null;
    return <section className="space-y-4 border-t border-sf-divider pt-5" data-testid="control-charts">
        <h3 className="font-bold text-lg">{tr('title')}</h3>
        <p className="text-sm text-sf-muted">{tr('seriesHelp')}</p>
        {error && <p role="alert" className="text-red-600">{error}</p>}
        <label className="grid min-w-0 gap-1">{tr('series')}<select className="w-full min-w-0 max-w-full border rounded p-2 bg-sf-canvas" value={selected} onChange={e => setSelected(e.target.value)}>
            <option value="">{tr('chooseSeries')}</option>{series.map((row, index) => <option key={`${row.analysisCode}-${row.methodologyId}-${row.referenceMaterialId}`} value={index}>
                {row.analysisCode} · {row.methodologyId} · {row.referenceName} · {row.lotNumber}</option>)}
        </select></label>
        {loading && <p role="status">{tr('loading')}</p>}
        {chart && <>
            <p className="font-semibold">{chart.mode === 'FIXED_WINDOW' ? tr('fixedWindow') : chart.provisional ? tr('provisional') : tr('approved')} · {tr('minimum')}: {chart.minimumPoints}</p>
            <label className="grid min-w-0 gap-1">{tr('basis')}<select className="w-full min-w-0 max-w-full border rounded p-2 bg-sf-canvas" value={basisKey} onChange={e => setBasisKey(e.target.value)}>
                {bases.map(row => <option key={row.key} value={row.key}>{row.mode === 'CONTROL_CHART' ? `${tr('approved')}: ${row.controlLimitSetId}` : tr(row.mode === 'PROVISIONAL' ? 'provisional' : 'fixedWindow')}</option>)}
            </select></label>
            <ControlChartPlot points={chart.points.filter(row => row.basisKey === basisKey)} basis={basis} t={t} />
            <form className="space-y-3" onSubmit={async e => {
                e.preventDefault();
                const eligible = chart.points.filter(row => row.inControl);
                if (await save('/api/qc/control-limit-proposals', { ...chart.series, reason,
                    selectedMeasurementIds: eligible.filter(row => selection[row.measurementId]?.selected).map(row => row.measurementId),
                    exclusions: eligible.filter(row => !selection[row.measurementId]?.selected).map(row => ({ measurementId: row.measurementId, reason: selection[row.measurementId]?.reason || '' })) })) setReason('');
            }}>
                <h4 className="font-semibold">{tr('observations')}</h4><p className="text-sm">{tr('selectionHelp')}</p>
                <div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead><tr>
                    {['selected', 'measurement', 'executionOrder', 'value', 'verdict', 'exclusionReason'].map(key => <th className="p-2" key={key}>{tr(key)}</th>)}
                </tr></thead><tbody>{chart.points.map(point => <tr key={point.measurementId} className="border-t border-sf-divider">
                    <td className="p-2">{point.inControl && <input type="checkbox" aria-label={`${tr('selected')} ${point.measurementId}`} checked={Boolean(selection[point.measurementId]?.selected)} disabled={!chart.canPropose || saving}
                        onChange={e => setSelection(old => ({ ...old, [point.measurementId]: { ...old[point.measurementId], selected: e.target.checked } }))} />}</td>
                    <td className="p-2 break-all font-mono">{point.measurementId}{trial?.sd > 0 && Math.abs((point.value - trial.mean) / trial.sd) > 3 && <span className="block text-amber-700">{tr('trialOutlier')}</span>}</td>
                    <td className="p-2">{point.executionTime} · {point.sequenceIndex}</td><td className="p-2 font-mono">{point.value} {point.analysisUnit}</td>
                    <td className="p-2">{point.verdict} · {tr(point.inControl ? 'eligible' : 'ineligible')}</td>
                    <td className="p-2">{point.inControl && !selection[point.measurementId]?.selected && <input required aria-label={`${tr('exclusionReason')} ${point.measurementId}`} value={selection[point.measurementId]?.reason || ''}
                        disabled={!chart.canPropose || saving} className="border rounded p-2 bg-sf-canvas" onChange={e => setSelection(old => ({ ...old, [point.measurementId]: { selected: false, reason: e.target.value } }))} />}</td>
                </tr>)}</tbody></table></div>
                {trial && <p>{tr('trial')}: n={trial.n} · {tr('mean')}={trial.mean} · {tr('sampleSd')}={trial.sd}</p>}
                {chart.canPropose && <><label className="grid gap-1">{tr('proposalReason')}<textarea required value={reason} onChange={e => setReason(e.target.value)} className="border rounded p-2 bg-sf-canvas" /></label>
                    <button className="btn-primary" disabled={saving || baseline.length < chart.minimumPoints || !Number.isFinite(trial?.sd) || trial.sd <= 0}>{tr('propose')}</button></>}
            </form>
            <h4 className="font-semibold">{tr('proposals')}</h4>
            {chart.proposals.map(row => <details className="border rounded p-3" key={row.id}><summary>{row.id} · {row.proposedBy} · {row.proposedAt} · n={row.n}</summary>
                <p>{row.reason} · {tr('mean')}={row.mean} · {tr('sampleSd')}={row.sd}</p>
                <ul>{row.selectionSnapshot.map(point => <li key={point.measurementId} className="break-all">{point.measurementId}: {point.value} · {tr(point.selected ? 'selected' : 'excluded')}{point.exclusionReason && ` · ${point.exclusionReason}`}</li>)}</ul>
                {row.approvedSet ? <p>{tr('approved')}: {row.approvedSet.id} · {row.approvedSet.approvedBy}</p> : chart.canApprove && row.proposedBy !== user?.username
                    ? <button disabled={saving} className="btn-primary mt-3" onClick={() => save(`/api/qc/control-limit-proposals/${row.id}/approve`, {})}>{tr('approve')}</button> : <p>{tr('differentApprover')}</p>}
            </details>)}
            <h4 className="font-semibold">{tr('history')}</h4>
            {chart.sets.map(row => <p className="text-sm break-all" key={row.id}>{row.id} · {tr(row.status === 'APPROVED' ? 'approved' : 'superseded')} · {row.approvedBy} · {row.fromDate} → {row.toDate || tr('current')}
                {' · '}{tr('mean')}={row.mean} · {tr('sampleSd')}={row.sd} · n={row.n}</p>)}
        </>}
        <h4 className="font-semibold">{tr('reviews')}</h4><p className="text-sm text-sf-muted">{tr('reviewHelp')}</p>
        {!reviews.obligations.length && <p>{tr('noReviews')}</p>}
        {reviews.obligations.map(row => <div key={row.id} className="border rounded p-3 space-y-2">
            <p className="break-all">{row.rule} · {row.evaluation.analysisCode} · {row.evaluationId} · {tr(row.status === 'OPEN' ? 'open' : 'resolved')}</p>
            {row.resolutions.map(event => <p key={event.id}>{tr(event.outcome === 'NO_ACTION' ? 'noAction' : 'investigate')} · {event.note} · {event.resolvedBy} · {event.resolvedAt}</p>)}
            <details><summary>{tr('frozenEvidence')}</summary><pre className="whitespace-pre-wrap break-all text-xs">{JSON.stringify(row.evidenceSnapshot, null, 2)}</pre></details>
            {reviews.canResolve && row.status === 'OPEN' && <form className="flex flex-wrap gap-2" onSubmit={async e => {
                e.preventDefault(); if (await save(`/api/qc/control-reviews/${row.id}/resolve`, { outcome: resolution[row.id]?.outcome || 'NO_ACTION', note: resolution[row.id]?.note || '' })) setResolution(old => ({ ...old, [row.id]: {} }));
            }}><label>{tr('outcome')}<select className="block border rounded p-2 bg-sf-canvas" value={resolution[row.id]?.outcome || 'NO_ACTION'} onChange={e => setResolution(old => ({ ...old, [row.id]: { ...old[row.id], outcome: e.target.value } }))}>
                <option value="NO_ACTION">{tr('noAction')}</option><option value="INVESTIGATE_NEW_LIMITS">{tr('investigate')}</option></select></label>
                <label>{tr('note')}<input required className="block border rounded p-2 bg-sf-canvas" value={resolution[row.id]?.note || ''} onChange={e => setResolution(old => ({ ...old, [row.id]: { ...old[row.id], note: e.target.value } }))} /></label>
                <button disabled={saving} className="btn-primary">{tr('resolve')}</button>
            </form>}
        </div>)}
    </section>;
}
