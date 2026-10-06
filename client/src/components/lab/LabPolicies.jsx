import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useLanguage } from '../../context/LanguageContext';
import QcRules from './QcRules';

export function PolicyValueEditor({ definition, value, onChange, t }) {
    if (definition.type === 'boolean') return <select value={String(value)} onChange={e => onChange(e.target.value === 'true')}>
        <option value="true">{t('policies.yes')}</option><option value="false">{t('policies.no')}</option></select>;
    if (definition.type === 'enum') return <select value={value === null ? '__null' : value} onChange={e => onChange(e.target.value === '__null' ? null : e.target.value)}>
        {definition.nullable && <option value="__null">{t('policies.none')}</option>}
        {definition.allowedValues.map(option => <option key={option} value={option} disabled={definition.unsupportedValues?.includes(option)}>{t(`policies.options.${option}`, option)}</option>)}</select>;
    if (definition.type === 'westgard') return <div>{definition.allowedValues.map(code => <div key={code} className="flex gap-4 items-center py-2">
        <span>{code}</span>{['reject', 'warn'].map(kind => <label key={kind}>
            <input type="checkbox" checked={value[kind].includes(code)} onChange={e => onChange({
                reject: value.reject.filter(v => v !== code), warn: value.warn.filter(v => v !== code),
                [kind]: e.target.checked ? [...value[kind].filter(v => v !== code), code] : value[kind].filter(v => v !== code)
            })} /> {t(`policies.${kind}`)}</label>)}</div>)}</div>;
    if (definition.type === 'qcFailAction') return <div className="space-y-2">{['BLANK', 'DUPLICATE', 'LRM', 'CRM'].map(type => <label key={type}>
        {t(`qcRules.types.${type}`)}<select value={value[type]} onChange={e => onChange({ ...value, [type]: e.target.value })}>
            {['FAIL_BATCH', 'WARN'].map(action => <option key={action} value={action}>{t(`qcRules.actions.${action}`)}</option>)}
        </select></label>)}</div>;
    if (definition.type === 'runProfiles') {
        const update = (code, patch) => onChange({ ...value, [code]: { ...value[code], ...patch } });
        return <div className="space-y-4">{Object.entries(value).map(([code, tray]) => <fieldset key={code} className="border rounded p-3 space-y-2">
            <legend>{tray.name || code}</legend>
            <label>{t('policies.trayName')}<input required value={tray.name} onChange={e => update(code, { name: e.target.value })} /></label>
            <label>{t('policies.capacity')}<input required type="number" min="1" step="1" value={tray.capacity ?? ''} onChange={e => update(code, { capacity: e.target.value === '' ? null : Number(e.target.value) })} /></label>
            {tray.qcSlots.map((slot, index) => <div key={index} className="flex gap-2 flex-wrap">
                <label>{t('policies.position')}<input required type="number" min="1" max={tray.capacity} step="1" value={slot.position ?? ''}
                    onChange={e => update(code, { qcSlots: tray.qcSlots.map((s, i) => i === index ? { ...s, position: e.target.value === '' ? null : Number(e.target.value) } : s) })} /></label>
                <select aria-label={t('policies.qcType')} required value={slot.type} onChange={e => update(code, { qcSlots: tray.qcSlots.map((s, i) => i === index ? { ...s, type: e.target.value } : s) })}>
                    <option value="">{t('policies.choose')}</option>{['BLANK', 'DUPLICATE', 'CONTROL'].map(type => <option key={type} value={type}>{t(`policies.options.${type}`)}</option>)}</select>
                <label>{t('policies.label')}<input value={slot.label} onChange={e => update(code, { qcSlots: tray.qcSlots.map((s, i) => i === index ? { ...s, label: e.target.value } : s) })} /></label>
                <button type="button" onClick={() => update(code, { qcSlots: tray.qcSlots.filter((_, i) => i !== index) })}>{t('policies.remove')}</button>
            </div>)}
            <button type="button" onClick={() => update(code, { qcSlots: [...tray.qcSlots, { position: null, type: '', label: '' }] })}>{t('policies.addSlot')}</button>
            {Object.keys(value).length > 1 && <button type="button" onClick={() => onChange(Object.fromEntries(Object.entries(value).filter(([key]) => key !== code)))}>{t('policies.removeTray')}</button>}
        </fieldset>)}<button type="button" onClick={() => onChange({ ...value, [`CUSTOM_${Date.now()}`]: { name: '', capacity: null, qcSlots: [] } })}>{t('policies.addTray')}</button></div>;
    }
    if (['integer', 'number'].includes(definition.type)) return <div>
        {definition.nullable && <label><input type="checkbox" checked={value === null} onChange={e => onChange(e.target.checked ? null : '')} /> {t('policies.noLimit')}</label>}
        {value !== null && <input required type="number" min={definition.min} max={definition.max} step={definition.type === 'integer' ? '1' : 'any'} value={value}
            onChange={e => onChange(e.target.value === '' ? '' : Number(e.target.value))} />}</div>;
    return <div><input required value={value} onChange={e => onChange(e.target.value)} />
        {definition.type === 'sampleFormat' && !value.includes('{CHK}') && <p role="alert">{t('policies.sampleCodeNoCheck')}</p>}</div>;
}

export default function LabPolicies({ labId }) {
    const { t } = useLanguage();
    const [data, setData] = useState(null), [loading, setLoading] = useState(true), [error, setError] = useState('');
    const [analysisCode, setAnalysisCode] = useState(''), [methodologyId, setMethodologyId] = useState('');
    const [refresh, setRefresh] = useState(0), [editing, setEditing] = useState(null), [reason, setReason] = useState(''), [saving, setSaving] = useState(false);
    const [preset, setPreset] = useState(''), [presetReason, setPresetReason] = useState('');
    useEffect(() => {
        let current = true;
        setLoading(true); setError('');
        axios.get(`/api/labs/${encodeURIComponent(labId)}/policies`, { params: { analysisCode: analysisCode || undefined, methodologyId: methodologyId || undefined } })
            .then(response => { if (current) { setData(response.data); setPreset(response.data.presetCode || ''); } })
            .catch(e => { if (current) setError(e.response?.data?.code || t('policies.loadFailed')); })
            .finally(() => { if (current) setLoading(false); });
        return () => { current = false; };
    }, [labId, analysisCode, methodologyId, refresh, t]);
    const save = async payload => {
        setSaving(true); setError('');
        try {
            await axios.patch(`/api/labs/${encodeURIComponent(labId)}/policies`, { ...payload, expectedVersion: data.version });
            setEditing(null); setReason(''); setPresetReason(''); setRefresh(v => v + 1);
        } catch (e) { setError(t(`policies.errors.${e.response?.data?.code}`, e.response?.data?.error || t('policies.saveFailed'))); }
        finally { setSaving(false); }
    };
    const display = (definition, value) => {
        if (value === null) return t(definition.type === 'integer' ? 'policies.noLimit' : 'policies.none');
        if (typeof value === 'boolean') return t(value ? 'policies.yes' : 'policies.no');
        if (definition.type === 'westgard') return `${t('policies.reject')}: ${value.reject.join(', ') || '—'}; ${t('policies.warn')}: ${value.warn.join(', ') || '—'}`;
        if (definition.type === 'runProfiles') return Object.values(value).map(p => `${p.name} (${p.capacity})`).join('; ');
        if (definition.type === 'qcFailAction') return Object.entries(value).map(([type, action]) => `${t(`qcRules.types.${type}`)}: ${t(`qcRules.actions.${action}`)}`).join('; ');
        if (definition.key === 'numbers.thousandsSeparator' && value === ' ') return t('numbers.space');
        return definition.type === 'enum' ? t(`policies.options.${value}`, value) : String(value);
    };
    if (loading) return <p role="status">{t('policies.loading')}</p>;
    if (!data) return <p role="alert">{error}</p>;
    return <section className="space-y-5 text-sf-text [&_input:not([type=checkbox])]:border [&_input:not([type=checkbox])]:rounded [&_input:not([type=checkbox])]:p-2 [&_select]:border [&_select]:rounded [&_select]:p-2 [&_button]:border [&_button]:rounded [&_button]:px-3 [&_button]:py-2 [&_button:disabled]:opacity-50 [&_label]:grid [&_label]:gap-1">
        <div><h2 className="text-xl font-bold">{t('policies.title')}</h2><p>{t('policies.version')} {data.version}</p>
            <p>{data.presetCode ? t(`policies.presets.${data.presetCode}`) : `${t('policies.inherit')}: ${data.profileConfigured ? data.profileName : t('policies.presets.ISO17025_STRICT')}`}</p></div>
        {error && <p role="alert">{error}</p>}
        {!data.canEdit && <p>{t('policies.readOnly')}</p>}
        <form onSubmit={e => { e.preventDefault(); save({ presetCode: preset || null, reason: presetReason }); }} className="flex flex-wrap gap-3 items-end">
            <label>{t('policies.preset')}<select disabled={!data.canEdit || saving} value={preset} onChange={e => setPreset(e.target.value)}>
                <option value="">{t('policies.inherit')}</option>{data.presets.map(p => <option key={p} value={p}>{t(`policies.presets.${p}`)}</option>)}</select></label>
            <p>{t(`policies.presetDescriptions.${preset || 'INHERIT'}`)}</p>
            {data.canEdit && <><label>{t('policies.reason')}<input required value={presetReason} onChange={e => setPresetReason(e.target.value)} /></label>
                <button disabled={saving || !presetReason.trim()}>{t('policies.savePreset')}</button></>}
        </form>
        <div className="flex flex-wrap gap-3">
            <label>{t('policies.scope')}<select value={analysisCode} onChange={e => { setAnalysisCode(e.target.value); setMethodologyId(''); setEditing(null); }}>
                <option value="">{t('policies.labScope')}</option>{data.analyses.map(a => <option key={a.code} value={a.code}>{a.name}</option>)}</select></label>
            {analysisCode && <label>{t('policies.method')}<select value={methodologyId} onChange={e => { setMethodologyId(e.target.value); setEditing(null); }}>
                <option value="">{t('policies.allMethods')}</option>{data.methodologies.filter(m => m.analysisCode === analysisCode).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>}
            <button type="button" disabled={saving} onClick={() => setRefresh(v => v + 1)}>{t('policies.refresh')}</button>
        </div>
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr>{['setting', 'value', 'source', 'difference'].map(key => <th key={key} className="text-left p-2">{t(`policies.${key}`)}</th>)}<th /></tr></thead>
            <tbody>{Object.entries(data.registry).map(([key, definition]) => {
                const row = data.resolved[key], presetValue = definition.presets[data.presetCode || data.inheritedPreset];
                const canChangeScope = definition.scope === 'LAB+METHOD' || !analysisCode ||
                    (!methodologyId && definition.analysisOverrides?.includes(analysisCode));
                return <tr key={key} className="border-t"><td className="p-2">{t(definition.description)}{definition.unit && <span> ({t(`policies.units.${definition.unit}`, definition.unit)})</span>}</td>
                    <td className="p-2">{display(definition, row.value)}
                        {definition.type === 'sampleFormat' && !row.value.includes('{CHK}') && <p role="alert">{t('policies.sampleCodeNoCheck')}</p>}</td><td className="p-2">{t(`policies.sources.${row.source}`)}
                        {row.scope?.analysisCode && ` · ${row.scope.analysisCode}`}{row.scope?.methodologyId && ` · ${data.methodologies.find(m => m.id === row.scope.methodologyId)?.name || row.scope.methodologyId}`}
                        {row.profile && ` · ${row.profile}`} · {t('policies.version')} {row.version}</td>
                    <td className="p-2">{JSON.stringify(row.value) !== JSON.stringify(presetValue) ? t('policies.differs') : '—'}</td>
                    <td>{data.canEdit && canChangeScope && <><button type="button" onClick={() => { setEditing({ key, value: JSON.parse(JSON.stringify(row.value)) }); setReason(''); }}>{t('policies.edit')}</button>
                        {['LAB_OVERRIDE', 'ANALYSIS_OVERRIDE', 'METHOD_OVERRIDE'].includes(row.source) && <button type="button" onClick={() => { setEditing({ key, clear: true, scope: row.scope }); setReason(''); }}>{t('policies.clear')}</button>}</>}</td></tr>;
            })}</tbody></table></div>
        {editing && data.canEdit && <form onSubmit={e => { e.preventDefault(); save({ reason, changes: [{ key: editing.key,
            ...(editing.clear ? { clear: true } : { value: editing.value }),
            analysisCode: editing.clear ? editing.scope.analysisCode : analysisCode || null,
            methodologyId: editing.clear ? editing.scope.methodologyId : methodologyId || null }] }); }} className="border rounded p-4 space-y-3">
            <h3>{t(data.registry[editing.key].description)}</h3>
            {editing.clear ? <p>{t('policies.clearExplanation')}</p> : <PolicyValueEditor definition={data.registry[editing.key]} value={editing.value} t={t} onChange={value => setEditing({ ...editing, value })} />}
            <label>{t('policies.reason')}<input required value={reason} onChange={e => setReason(e.target.value)} /></label>
            <button disabled={saving || !reason.trim()}>{t('policies.save')}</button><button type="button" disabled={saving} onClick={() => setEditing(null)}>{t('policies.cancel')}</button>
        </form>}
        <h3 className="font-bold">{t('policies.overrides')}</h3>
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr>{['setting', 'scope', 'value', 'reason'].map(key => <th className="text-left p-2" key={key}>{t(`policies.${key}`)}</th>)}<th /></tr></thead>
            <tbody>{data.overrides.filter(row => !row.revokedAt && row.analysisCode).map(row => <tr className="border-t" key={row.id}>
                <td className="p-2">{t(data.registry[row.key].description)}</td><td className="p-2">{row.analysisCode} · {row.methodologyId ? data.methodologies.find(m => m.id === row.methodologyId)?.name || row.methodologyId : t('policies.allMethods')}</td>
                <td className="p-2">{display(data.registry[row.key], row.value)}</td><td className="p-2">{row.reason}</td>
                <td>{data.canEdit && <button type="button" onClick={() => { setEditing({ key: row.key, clear: true, scope: row }); setReason(''); }}>{t('policies.clear')}</button>}</td>
            </tr>)}</tbody></table></div>
        <h3 className="font-bold">{t('policies.history')}</h3>
        {analysisCode && <QcRules key={`${labId}-${analysisCode}-${methodologyId}`} labId={labId} analysisCode={analysisCode} methodologyId={methodologyId || null} registry={data.registry} canEdit={data.canEdit} Editor={PolicyValueEditor} />}
        <ul>{data.history.map(row => { const event = JSON.parse(row.details); return <li key={row.id} className="border-t py-2">
            <time>{new Date(row.timestamp).toLocaleString()}</time> · {row.performedBy} · {t('policies.version')} {event.policyVersion}: {event.reason}
        </li>; })}</ul>
    </section>;
}
