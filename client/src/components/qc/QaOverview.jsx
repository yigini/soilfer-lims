import { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

function Panel({ title, columns, rows, empty }) {
    return <section className="rounded-xl border border-sf-divider bg-sf-surface overflow-hidden">
        <h3 className="font-semibold text-sm px-4 py-3 border-b border-sf-divider">{title}</h3>
        {rows.length ? <div className="overflow-auto max-h-80"><table className="w-full text-left text-xs">
            <thead className="bg-sf-canvas"><tr>{columns.map(column => <th key={column.key} scope="col" className="p-3">{column.label}</th>)}</tr></thead>
            <tbody>{rows.map(row => <tr key={row.id} className="border-t border-sf-divider">
                {columns.map(column => <td key={column.key} className="p-3">{column.render ? column.render(row) : row[column.key]}</td>)}
            </tr>)}</tbody>
        </table></div> : <p className="p-4 text-sm text-sf-muted">{empty}</p>}
    </section>;
}

// Stored scores only; missing historical scores break the line rather than
// becoming zero or being recalculated against today's classification policy.
function ZScoreTrend({ rows, label, format }) {
    const scored = rows.filter(row => Number.isFinite(row.zScore));
    if (!scored.length) return null;
    const low = Math.min(0, ...scored.map(row => row.zScore)) - 0.5;
    const high = Math.max(0, ...scored.map(row => row.zScore)) + 0.5;
    const start = new Date(rows[0].date).getTime(), end = new Date(rows[rows.length - 1].date).getTime();
    const point = row => ({ x: 12 + (end === start ? 0.5 : (new Date(row.date).getTime() - start) / (end - start)) * 276,
        y: 82 - (row.zScore - low) / (high - low) * 68 });
    const segments = []; let segment = [];
    for (const row of rows) {
        if (Number.isFinite(row.zScore)) segment.push(row);
        else if (segment.length) { segments.push(segment); segment = []; }
    }
    if (segment.length) segments.push(segment);
    return <svg viewBox="0 0 300 96" role="img" aria-label={label} className="w-full h-24 text-sf-emerald">
        <line x1="12" x2="288" y1={point({ zScore: 0, date: rows[0].date }).y} y2={point({ zScore: 0, date: rows[0].date }).y} stroke="currentColor" opacity="0.25" />
        {segments.map((part, index) => <polyline key={index} points={part.map(row => { const p = point(row); return `${p.x},${p.y}`; }).join(' ')} fill="none" stroke="currentColor" strokeWidth="2" />)}
        {scored.map(row => { const p = point(row); return <circle key={row.id} cx={p.x} cy={p.y} r="3" fill="currentColor"><title>{format(row.date)}: {row.zScore}</title></circle>; })}
    </svg>;
}

export default function QaOverview({ refreshKey = 0 }) {
    const { token } = useAuth();
    const { t, locale } = useLanguage();
    const [labId, setLabId] = useState('');
    const [days, setDays] = useState('30');
    const [laboratories, setLaboratories] = useState([]);
    const [data, setData] = useState(null);
    const [error, setError] = useState(false);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        const controller = new AbortController();
        setData(null); setError(false); setLoading(true);
        if (!token) return () => controller.abort();
        axios.get('/api/dashboard/qa', { params: { days, ...(labId && { labId }) }, signal: controller.signal,
            headers: { Authorization: `Bearer ${token}` } }).then(response => {
            if (controller.signal.aborted) return;
            setData(response.data); setLaboratories(response.data.laboratories); setLoading(false);
        }).catch(() => {
            if (!controller.signal.aborted) { setError(true); setLoading(false); }
        });
        return () => controller.abort();
    }, [token, labId, days, refreshKey]);
    const tr = (key, params = {}) => t(`qaOverview.${key}`, params);
    const date = value => value ? new Date(value).toLocaleDateString(locale) : tr('unknown');
    const number = value => Number.isFinite(value) ? new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(value) : tr('unknown');
    const rate = row => row.rate == null ? tr('noDenominator') : new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 }).format(row.rate);
    const countRate = row => `${row.repeated} / ${row.executions} (${rate(row)})`;
    const state = value => tr(`statuses.${value}`);
    const empty = tr('empty');
    const expiryLabel = data ? tr('expiringMaterials', { days: data.expiryWarningDays }) : '';
    const ptGroups = [...new Set((data?.ptResults || []).map(row => row.analysisCode))].map(analysisCode => ({ analysisCode,
        rows: data.ptResults.filter(row => row.analysisCode === analysisCode) }));
    return <div className="p-4 space-y-4 text-sf-text" aria-busy={loading}>
        <div className="flex flex-wrap items-end gap-4">
            <label className="text-sm flex flex-col gap-1">{tr('laboratory')}
                <select value={labId || data?.lab.id || ''} onChange={event => setLabId(event.target.value)} className="bg-sf-canvas border border-sf-divider rounded-lg p-2" data-testid="qa-lab">
                    {!laboratories.length && <option value="">{tr('laboratory')}</option>}
                    {laboratories.map(lab => <option key={lab.id} value={lab.id}>{lab.name}</option>)}
                </select>
            </label>
            <label className="text-sm flex flex-col gap-1">{tr('window')}
                <select value={days} onChange={event => setDays(event.target.value)} className="bg-sf-canvas border border-sf-divider rounded-lg p-2" data-testid="qa-window">
                    <option value="30">{tr('days30')}</option><option value="90">{tr('days90')}</option>
                </select>
            </label>
            {data && <p className="text-xs text-sf-muted">{tr('snapshot')}: {new Date(data.asOf).toLocaleString(locale)}</p>}
        </div>
        {error && <p role="alert" className="text-sm text-rose-600">{tr('error')}</p>}
        {loading && <p role="status" className="text-sm text-sf-muted">{tr('loading')}</p>}
        {data && <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[[tr('awaitingDisposition'), data.awaitingDisposition], [tr('openNcrs'), data.openNcrs],
                    [expiryLabel, data.expiringMaterials.length], [tr('calibrationDue'), data.calibrationDue.length]].map(([label, value]) =>
                    <div key={label} className="rounded-xl border border-sf-divider p-4"><p className="text-xs text-sf-muted">{label}</p><p className="text-2xl font-bold mt-1">{value}</p></div>)}
            </div>
            <p className="text-xs text-sf-muted">{tr('currentCounts')}</p>
            <Panel title={tr('qcFailureRate')} empty={empty} rows={data.qcFailures.map(row => ({ ...row, id: row.analysisCode }))} columns={[
                { key: 'analysisCode', label: tr('analyte') }, { key: 'failed', label: tr('failed') }, { key: 'evaluated', label: tr('evaluated') },
                { key: 'notEvaluable', label: tr('notEvaluable') },
                { key: 'rate', label: tr('rate'), render: rate }]} />
            <p className="text-xs text-sf-muted">{tr('qcDefinition')}</p>
            <div className="grid lg:grid-cols-2 gap-4">
                <Panel title={expiryLabel} empty={empty} rows={data.expiringMaterials} columns={[
                    { key: 'code', label: tr('material') }, { key: 'name', label: tr('name') }, { key: 'expiresAt', label: tr('expiry'), render: row => date(row.expiresAt) }]} />
                <Panel title={tr('calibrationDue')} empty={empty} rows={data.calibrationDue} columns={[
                    { key: 'name', label: tr('equipment') }, { key: 'dueAt', label: tr('due'), render: row => date(row.dueAt) },
                    { key: 'status', label: tr('status'), render: row => state(row.status) }]} />
            </div>
            <h3 className="font-semibold">{tr('ptTitle')}</h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{ptGroups.map(group => <section key={group.analysisCode} className="border border-sf-divider rounded-xl p-3">
                <h4 className="text-sm font-semibold">{group.analysisCode}</h4>
                <ZScoreTrend rows={group.rows} label={`${tr('zScore')}: ${group.analysisCode}`} format={date} />
            </section>)}</div>
            <Panel title={tr('ptResults')} empty={empty} rows={data.ptResults} columns={[
                { key: 'date', label: tr('date'), render: row => date(row.date) }, { key: 'analysisCode', label: tr('analyte') },
                { key: 'provider', label: tr('provider') }, { key: 'roundRef', label: tr('round') },
                { key: 'labResult', label: tr('result'), render: row => number(row.labResult) },
                { key: 'zScore', label: tr('zScore'), render: row => number(row.zScore) },
                { key: 'outcome', label: tr('status'), render: row => row.legacyScoreFlag ? tr('legacyScore') : state(row.outcome) }]} />
            <p className="text-xs text-sf-muted">{tr('ptDefinition')}</p>
            <Panel title={tr('repeatsByReason')} empty={empty} rows={data.repeats.byReason.map(row => ({ ...row, id: row.reason }))} columns={[
                { key: 'reason', label: tr('reason'), render: row => ['UNKNOWN', 'TRANSCRIPTION_ERROR', 'CLIENT_RETEST'].includes(row.reason)
                    ? tr(`reasons.${row.reason}`) : t(`repeatCommands.reasons.${row.reason}`, row.reason) },
                { key: 'rate', label: tr('repeatsExecutions'), render: countRate }]} />
            <Panel title={tr('repeatsByAnalystMethod')} empty={empty} rows={data.repeats.byAnalystMethod.map((row, id) => ({ ...row, id }))} columns={[
                { key: 'analyst', label: tr('analyst'), render: row => row.analyst || tr('unknown') },
                { key: 'methodologyId', label: tr('method'), render: row => row.methodologyId || tr('unknown') },
                { key: 'methodRevision', label: tr('revision'), render: row => row.methodRevision || tr('unknown') },
                { key: 'rate', label: tr('repeatsExecutions'), render: countRate }]} />
            <p className="text-xs text-sf-muted">{tr('repeatDefinition')}</p>
        </>}
    </div>;
}
