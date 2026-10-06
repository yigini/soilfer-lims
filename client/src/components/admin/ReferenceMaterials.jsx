import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';

const kinds = ['CRM', 'LRM', 'CHECK_STANDARD', 'CALIBRATION_STANDARD', 'BLANK_MATRIX'];
const statuses = ['ACTIVE', 'QUARANTINED', 'EXPIRED', 'RETIRED'];
const valueTypes = ['CERTIFIED', 'INDICATIVE', 'CONSENSUS', 'LAB_ASSIGNED'];
const emptyMaterial = { code: '', name: '', kind: 'CRM', matrix: '', supplier: '', certificateRef: '', lotNumber: '', inventoryLotId: '', expiryDate: '', openedAt: '' };
const emptyValue = { analysisCode: '', methodologyId: '', assignedValue: '', unit: '', expandedUncertainty: '', coverageFactor: '', valueType: 'CERTIFIED', reason: '' };
const array = response => Array.isArray(response.data?.data) ? response.data.data : Array.isArray(response.data) ? response.data : [];

export default function ReferenceMaterials() {
    const { t } = useLanguage(), { user, hasPermission } = useAuth();
    const canEdit = hasPermission('MANAGE_ANALYSES');
    const [materials, setMaterials] = useState([]), [labs, setLabs] = useState([]), [lots, setLots] = useState([]);
    const [analyses, setAnalyses] = useState([]), [methods, setMethods] = useState([]), [units, setUnits] = useState([]);
    const [labId, setLabId] = useState(user?.labId || ''), [selectedId, setSelectedId] = useState('');
    const [loading, setLoading] = useState(true), [saving, setSaving] = useState(false), [error, setError] = useState(''), [refresh, setRefresh] = useState(0);
    const [newMaterial, setNewMaterial] = useState(null), [newValue, setNewValue] = useState(null), [correctingId, setCorrectingId] = useState('');
    const [status, setStatus] = useState(''), [reason, setReason] = useState('');
    const tr = useCallback(key => t(`referenceMaterials.${key}`), [t]);
    useEffect(() => {
        let current = true;
        const requests = canEdit ? ['/api/labs', '/api/inventory/lots', '/api/config/analyses', '/api/config/methodologies', '/api/config/units'] : [];
        Promise.all(requests.map(url => axios.get(url))).then(responses => {
            if (!current || !canEdit) return;
            const [labRows, lotRows, analysisRows, methodRows, unitRows] = responses.map(array);
            setLabs(labRows); setLots(lotRows); setAnalyses(analysisRows); setMethods(methodRows); setUnits(unitRows);
        }).catch(() => { if (current) setError(tr('loadFailed')); });
        return () => { current = false; };
    }, [canEdit, tr]);
    useEffect(() => {
        let current = true;
        setLoading(true);
        axios.get('/api/reference-materials', { params: { labId: labId || undefined } }).then(response => {
            if (current) setMaterials(array(response));
        }).catch(() => { if (current) setError(tr('loadFailed')); }).finally(() => { if (current) setLoading(false); });
        return () => { current = false; };
    }, [labId, refresh, tr]);
    const selected = materials.find(row => row.id === selectedId);
    const lab = labs.find(row => row.id === labId || row.code === labId);
    const activeLabId = selected?.labId || lab?.id || labId;
    const labReferences = [activeLabId, labs.find(row => row.id === activeLabId)?.code];
    const scoped = row => !row.labId || labReferences.includes(row.labId);
    const save = async (url, body, method = 'post') => {
        setSaving(true); setError('');
        try {
            const response = await axios[method](url, body);
            setRefresh(value => value + 1); return response.data.data;
        } catch (e) {
            const code = e.response?.data?.code;
            setError(code ? t(`referenceMaterials.errors.${code}`, e.response?.data?.error || tr('saveFailed')) : tr('saveFailed'));
            return null;
        } finally { setSaving(false); }
    };
    const field = (form, setForm, key, required = false, type = 'text') => <label key={key} className="grid gap-1 text-sm">
        {tr(key)}<input type={type} required={required} value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })}
            className="p-2 rounded border border-sf-divider bg-sf-canvas text-sf-text" /></label>;
    const choice = (form, setForm, key, options, required = false) => <label className="grid gap-1 text-sm">{tr(key)}
        <select required={required} value={form[key]} onChange={e => setForm({ ...form, ...(key === 'analysisCode' && { methodologyId: '' }), [key]: e.target.value })} className="p-2 rounded border border-sf-divider bg-sf-canvas text-sf-text">
            <option value="">{tr('choose')}</option>{options.map(row => <option key={row.value} value={row.value}>{row.label}</option>)}
        </select></label>;
    return <section className="space-y-5 text-sf-text" data-testid="reference-materials">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-bold">{tr('title')}</h2>
            {canEdit && <button disabled={saving || !labId} onClick={() => { setNewMaterial({ ...emptyMaterial }); setNewValue(null); }} className="btn-primary">{tr('addMaterial')}</button>}
        </div>
        {canEdit && <label className="grid gap-1 text-sm">{tr('laboratory')}<select value={labId} onChange={e => { setLabId(e.target.value); setSelectedId(''); setNewMaterial(null); setNewValue(null); }} className="p-2 rounded border border-sf-divider bg-sf-canvas">
            <option value="">{tr('allLabs')}</option>{labs.map(row => <option key={row.id} value={row.id}>{row.name} ({row.code})</option>)}
        </select></label>}
        {error && <p role="alert" className="text-red-600">{error}</p>}
        {loading ? <p>{tr('loading')}</p> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr>
            {['name', 'kind', 'lotNumber', 'status', 'daysToExpiry'].map(key => <th key={key} className="text-left p-2">{tr(key)}</th>)}
        </tr></thead><tbody>{materials.map(row => <tr key={row.id} className={`border-t border-sf-divider ${row.id === selectedId ? 'bg-sf-hover' : ''}`}>
            <td className="p-2"><button className="underline text-left" onClick={() => { setSelectedId(row.id); setStatus(row.status); setReason(''); setNewValue(null); }}>{row.code} · {row.name}</button></td>
            <td className="p-2">{tr(`kinds.${row.kind}`)}</td><td className="p-2">{row.lotNumber}</td>
            <td className="p-2">{tr(`statuses.${row.status}`)}{!row.eligible && <span className="block text-sf-muted">{tr(`eligibility.${row.reason}`)}</span>}</td>
            <td className="p-2">{row.daysToExpiry ?? tr('noExpiry')}{row.expiryWarning && <span className="block text-amber-700">{tr('expiryWarning')}</span>}</td>
        </tr>)}</tbody></table>{materials.length === 0 && <p className="p-3">{tr('empty')}</p>}</div>}
        {newMaterial && <form className="space-y-3 p-4 rounded-xl border border-sf-divider" onSubmit={async e => {
            e.preventDefault(); const created = await save('/api/reference-materials', { ...newMaterial, labId,
                expiryDate: newMaterial.expiryDate ? new Date(newMaterial.expiryDate).toISOString() : null,
                openedAt: newMaterial.openedAt ? new Date(newMaterial.openedAt).toISOString() : null });
            if (created) { setSelectedId(created.id); setStatus(created.status); setNewMaterial(null); }
        }}><h3 className="font-bold">{tr('addMaterial')}</h3><div className="grid sm:grid-cols-2 gap-3">
            {['code', 'name', 'matrix', 'lotNumber'].map(key => field(newMaterial, setNewMaterial, key, true))}
            {choice(newMaterial, setNewMaterial, 'kind', kinds.map(value => ({ value, label: tr(`kinds.${value}`) })), true)}
            {['supplier', 'certificateRef'].map(key => field(newMaterial, setNewMaterial, key))}
            {choice(newMaterial, setNewMaterial, 'inventoryLotId', lots.filter(row => labReferences.includes(row.labId)).map(row => ({ value: row.id, label: `${row.item?.name || row.inventoryItemId} · ${row.lotNumber}` })))}
            {field(newMaterial, setNewMaterial, 'expiryDate', false, 'datetime-local')}{field(newMaterial, setNewMaterial, 'openedAt', false, 'datetime-local')}
        </div><button disabled={saving} className="btn-primary">{tr('save')}</button> <button type="button" onClick={() => setNewMaterial(null)}>{tr('cancel')}</button></form>}
        {selected && <div className="space-y-4 p-4 rounded-xl border border-sf-divider"><h3 className="font-bold">{selected.code} · {selected.lotNumber}</h3>
            <p className="text-sm">{tr('certificateRef')}: {selected.certificateRef || '—'} · {tr('matrix')}: {selected.matrix}</p>
            {canEdit && <form className="flex flex-wrap gap-2 items-end" onSubmit={async e => { e.preventDefault(); if (await save(`/api/reference-materials/${selected.id}/status`, { status, reason }, 'patch')) setReason(''); }}>
                <label>{tr('status')}<select value={status} onChange={e => setStatus(e.target.value)} className="block p-2 bg-sf-canvas border border-sf-divider rounded">{statuses.map(value => <option key={value} value={value}>{tr(`statuses.${value}`)}</option>)}</select></label>
                <label>{tr('reason')}<input required value={reason} onChange={e => setReason(e.target.value)} className="block p-2 bg-sf-canvas border border-sf-divider rounded" /></label>
                <button disabled={saving || status === selected.status} className="btn-primary">{tr('changeStatus')}</button>
            </form>}
            <div className="flex justify-between"><h4 className="font-bold">{tr('values')}</h4>{canEdit && <button onClick={() => { setCorrectingId(''); setNewValue({ ...emptyValue }); }}>{tr('addValue')}</button>}</div>
            <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr>{['analysisCode', 'methodologyId', 'assignedValue', 'expandedUncertainty', 'coverageFactor', 'valueType', 'revision'].map(key => <th key={key} className="text-left p-2">{tr(key)}</th>)}</tr></thead>
                <tbody>{selected.values.map(row => <tr key={row.id} className="border-t border-sf-divider"><td className="p-2">{row.analysisCode}</td><td className="p-2">{methods.find(method => method.id === row.methodologyId)?.name || row.methodologyId || tr('genericMethod')}</td>
                    <td className="p-2">{row.assignedValue} {row.unit}</td><td className="p-2">{row.expandedUncertainty ?? '—'}</td><td className="p-2">{row.coverageFactor ?? '—'}</td><td className="p-2">{tr(`valueTypes.${row.valueType}`)}</td>
                    <td className="p-2">{row.supersededById ? <span title={row.correctionReason}>{tr('superseded')}</span> : <>{tr('current')}{canEdit && <button className="block underline" onClick={() => {
                        setCorrectingId(row.id); setNewValue({ ...emptyValue, ...Object.fromEntries(Object.keys(emptyValue).filter(key => key !== 'reason').map(key => [key, row[key] ?? ''])), reason: '' });
                    }}>{tr('correct')}</button>}</>}</td></tr>)}</tbody></table></div>
            {newValue && <form className="space-y-3" onSubmit={async e => { e.preventDefault(); const url = `/api/reference-materials/${selected.id}/values${correctingId ? `/${correctingId}/correct` : ''}`;
                if (await save(url, newValue)) { setNewValue(null); setCorrectingId(''); }
            }}><h4 className="font-bold">{tr(correctingId ? 'correct' : 'addValue')}</h4><p className="text-sm text-sf-muted">{tr('certificateFacts')}</p>
                <div className="grid sm:grid-cols-2 gap-3">{correctingId ? <p>{newValue.analysisCode} · {methods.find(row => row.id === newValue.methodologyId)?.name || tr('genericMethod')}</p> : <>
                    {choice(newValue, setNewValue, 'analysisCode', analyses.filter(scoped).map(row => ({ value: row.code, label: `${row.code} · ${row.name}` })), true)}
                    {choice(newValue, setNewValue, 'methodologyId', methods.filter(row => row.analysisCode === newValue.analysisCode && scoped(row)).map(row => ({ value: row.id, label: row.name })))}
                </>}{field(newValue, setNewValue, 'assignedValue', true)}
                    {choice(newValue, setNewValue, 'unit', units.map(row => ({ value: row.code, label: row.display || row.code })), true)}
                    {field(newValue, setNewValue, 'expandedUncertainty')}{field(newValue, setNewValue, 'coverageFactor', newValue.expandedUncertainty !== '')}
                    {choice(newValue, setNewValue, 'valueType', valueTypes.map(value => ({ value, label: tr(`valueTypes.${value}`) })), true)}
                    {correctingId && field(newValue, setNewValue, 'reason', true)}
                </div><button disabled={saving} className="btn-primary">{tr('save')}</button> <button type="button" onClick={() => setNewValue(null)}>{tr('cancel')}</button>
            </form>}
        </div>}
    </section>;
}
