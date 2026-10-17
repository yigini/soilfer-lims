import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import ContainerLabelDialog from './ContainerLabelDialog';

const KINDS = ['BULK', 'FINE_EARTH', 'GROUND', 'ALIQUOT', 'ARCHIVE'];
export default function SampleContainersPanel({ sampleId, sampleCode, attempts = [] }) {
    const { t } = useLanguage(), { hasPermission } = useAuth();
    const [rows, setRows] = useState([]), [error, setError] = useState(''), [busy, setBusy] = useState(false);
    const [kind, setKind] = useState('BULK'), [parentId, setParentId] = useState(''), [mass, setMass] = useState('');
    const [label, setLabel] = useState(null);
    const load = useCallback(async () => {
        const response = await axios.get(`/api/samples/${encodeURIComponent(sampleId)}/containers`);
        if (!Array.isArray(response.data.containers)) throw new Error(t('containers.loadFailed'));
        return response.data.containers;
    }, [sampleId, t]);
    useEffect(() => {
        let current = true; setRows([]); setError(''); setParentId(''); setKind('BULK'); setMass(''); setLabel(null);
        load().then(data => { if (current) setRows(data); }).catch(() => { if (current) setError(t('containers.loadFailed')); });
        return () => { current = false; };
    }, [load, t]);
    const create = async event => {
        event.preventDefault(); setBusy(true); setError('');
        try {
            await axios.post(`/api/samples/${encodeURIComponent(sampleId)}/containers`, { kind, parentId: parentId || null, massG: mass === '' ? null : Number(mass) });
            setRows(await load()); setMass('');
        } catch (failure) { setError(t(`containers.errors.${failure.response?.data?.code}`, t('containers.createFailed'))); }
        finally { setBusy(false); }
    };
    const branch = parent => rows.filter(row => row.parentId === parent).map(row => <li key={row.id} className="mt-2">
        <div className="flex flex-wrap items-center gap-2">
            <strong>{row.code}</strong><span>{t(`containers.kinds.${row.kind}`)}</span>
            {row.massG != null && <span>{row.massG} g</span>}<span>{t(`containers.status.${row.status}`)}</span>
            {hasPermission?.('PRINT_LABELS') && <button type="button" onClick={() => setLabel(row)} className="underline">{t('containers.print')}</button>}
        </div>
        <div className="text-xs text-sf-muted">{row.createdBy} · {new Date(row.createdAt).toLocaleString()}</div>
        {attempts.filter(attempt => attempt.aliquotId === row.id).map(attempt => <div key={attempt.id} className="text-xs">
            {t('containers.linkedAttempt')} {attempt.attemptNo} · {attempt.id}
        </div>)}
        <ul className="pl-4 border-l border-sf-divider">{branch(row.id)}</ul>
    </li>);
    return <section className="bg-sf-surface rounded-2xl p-5 border border-sf-divider" data-testid="sample-containers">
        <h3 className="font-semibold">{t('containers.title')}</h3>
        <p className="text-xs text-sf-muted mt-1">{t('containers.help')}</p>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        {rows.length ? <ul className="my-3">{branch(null)}</ul> : <p className="text-sm my-3">{t('containers.empty')}</p>}
        {hasPermission?.('MANAGE_CONTAINERS') && <form onSubmit={create} className="flex flex-wrap items-end gap-3">
            <label className="text-xs">{t('containers.kind')}<select className="block p-2 border rounded bg-sf-canvas" value={kind} disabled={busy}
                onChange={event => setKind(event.target.value)}>{KINDS.map(value => <option key={value} value={value}>{t(`containers.kinds.${value}`)}</option>)}</select></label>
            <label className="text-xs">{t('containers.parent')}<select className="block p-2 border rounded bg-sf-canvas" value={parentId} disabled={busy}
                required={kind !== 'BULK'} onChange={event => setParentId(event.target.value)}>
                <option value="">{t('containers.noParent')}</option>{rows.filter(row => row.status === 'ACTIVE').map(row => <option key={row.id} value={row.id}>{row.code}</option>)}
            </select></label>
            <label className="text-xs">{t('containers.mass')}<input className="block p-2 border rounded bg-sf-canvas" type="number" min="0.000000001" step="any"
                value={mass} disabled={busy} onChange={event => setMass(event.target.value)} /></label>
            <button className="p-2 rounded bg-sf-primary text-white" disabled={busy}>{t('containers.create')}</button>
        </form>}
        {label && <ContainerLabelDialog container={label} sampleCode={sampleCode || sampleId} onClose={() => setLabel(null)} />}
    </section>;
}
