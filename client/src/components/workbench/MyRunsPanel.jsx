import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import StartRunForm from './StartRunForm';

export default function MyRunsPanel({ groups, onOpenRun, onStarted }) {
    const { t } = useLanguage(), { hasPermission } = useAuth();
    const [view, setView] = useState('my_runs'), [runs, setRuns] = useState([]), [starting, setStarting] = useState(false);
    const [loading, setLoading] = useState(false), [error, setError] = useState(null);
    const reload = useCallback(async () => {
        setLoading(true); setError(null);
        try { const response = await axios.get('/api/qc/batches', { params: { view } }); setRuns(response.data.data || []); }
        catch (failure) { setError(failure.response?.data?.error || t('runFirst.runsFailed')); }
        finally { setLoading(false); }
    }, [view, t]);
    useEffect(() => { reload(); }, [reload]);
    if (starting) return <StartRunForm groups={groups} onCancel={() => setStarting(false)} onStarted={async batch => {
        setStarting(false); await onStarted?.(batch); await reload(); onOpenRun(batch);
    }} />;
    return <section className="space-y-3" data-testid="my-runs-panel">
        <div className="flex items-center gap-3 flex-wrap">
            <label className="text-sm">{t('runFirst.runs')} <select data-testid="my-runs-filter" value={view} onChange={event => setView(event.target.value)} className="border border-sf-divider bg-sf-surface rounded p-2">
                <option value="my_runs">{t('runFirst.myRuns')}</option><option value="all_runs">{t('runFirst.allRuns')}</option>
            </select></label>
            {hasPermission?.('CHANGE_STATUS') && <button data-testid="my-runs-start" type="button" onClick={() => setStarting(true)} className="rounded bg-sf-primary text-white px-4 py-2 text-sm">{t('runFirst.startRun')}</button>}
            <button type="button" onClick={reload} disabled={loading} className="text-sm">{t('runFirst.refresh')}</button>
        </div>
        {error && <p role="alert" className="text-red-600 text-sm">{error}</p>}
        {loading ? <p>{t('runFirst.loading')}</p> : !runs.length ? <p className="text-sf-muted">{t('runFirst.noRuns')}</p> :
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">{runs.map(run => <button type="button" key={run.id} onClick={() => onOpenRun(run)} className="rounded-xl border border-sf-divider bg-sf-surface p-4 text-left space-y-2 hover:border-sf-primary">
                <strong className="text-sm">{run.analysis} · {run.id}</strong><p className="text-xs">{run.status} · {run.instrument || t('runFirst.manual')}</p>
                <p className="text-xs text-sf-muted">{t('runFirst.analyst')}: {run.analystUsername || t('runFirst.notStarted')}</p>
            </button>)}</div>}
    </section>;
}
