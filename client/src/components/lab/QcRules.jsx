import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useLanguage } from '../../context/LanguageContext';

export default function QcRules({ labId, analysisCode, methodologyId, registry, canEdit, Editor }) {
    const { t } = useLanguage();
    const [data, setData] = useState(null), [draft, setDraft] = useState({}), [reason, setReason] = useState('');
    const [error, setError] = useState(''), [warnings, setWarnings] = useState([]), [loading, setLoading] = useState(true), [saving, setSaving] = useState(false), [refresh, setRefresh] = useState(0);
    useEffect(() => {
        let active = true;
        setLoading(true); setError(''); setReason('');
        axios.get('/api/qc/rules', { params: { labId, analysisCode, methodologyId: methodologyId || undefined } })
            .then(response => {
                if (!active) return;
                const result = response.data.data;
                setData(result);
                setDraft(result.versions[0]?.criteria || Object.fromEntries(Object.keys(result.fieldPolicies).map(field => [field, null])));
            }).catch(e => { if (active) setError(t(`qcRules.errors.${e.response?.data?.code}`, t('policies.loadFailed'))); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [labId, analysisCode, methodologyId, refresh, t]);
    const save = async reset => {
        if (!canEdit || saving || !reason.trim()) return;
        setSaving(true); setError(''); setWarnings([]);
        try {
            const response = await axios.post('/api/qc/rules', { labId, analysisCode, methodologyId, criteria: draft, reset,
                reason, expectedVersion: data.expectedVersion });
            setWarnings(response.data.data.warnings || []); setRefresh(value => value + 1);
        } catch (e) { setError(t(`qcRules.errors.${e.response?.data?.code}`, e.response?.data?.error || t('policies.saveFailed'))); }
        finally { setSaving(false); }
    };
    if (loading) return <p role="status">{t('policies.loading')}</p>;
    if (!data) return <p role="alert">{error}</p>;
    return <section className="border rounded p-4 space-y-3" data-testid="qc-rule-editor">
        <h3 className="font-bold">{t('qcRules.title')} · {t('policies.version')} {data.expectedVersion}</h3>
        <p>{t('qcRules.inheritanceHelp')}</p><p>{t('qcRules.deferredHelp')}</p>
        {error && <p role="alert">{error}</p>}
        {warnings.map((warning, index) => <p key={index} role="alert">{t(`qcRules.errors.${warning.code}`)}</p>)}
        <form onSubmit={e => { e.preventDefault(); save(false); }}>
            <div className="grid gap-3 sm:grid-cols-2">{Object.entries(data.fieldPolicies).map(([field, key]) => {
                const definition = registry[key], resolved = data.qcRule.resolved[field];
                return <fieldset key={field} className="border rounded p-3 space-y-1" disabled={!canEdit || saving}>
                    <legend>{t(definition.description)}{definition.unit && ` (${t(`policies.units.${definition.unit}`, definition.unit)})`}</legend>
                    <p className="text-xs">{t('policies.value')}: {typeof resolved.value === 'object' ? JSON.stringify(resolved.value) : String(resolved.value ?? '—')} · {t(`policies.sources.${resolved.source}`, resolved.source)}</p>
                    {canEdit && <><label><input type="checkbox" checked={draft[field] === null} data-testid={`qc-rule-inherit-${field}`}
                        onChange={e => setDraft(values => ({ ...values, [field]: e.target.checked ? null : resolved.value === null ? '' : resolved.value }))} />{t('policies.inherit')}</label>
                    {draft[field] !== null && <Editor definition={definition} value={draft[field]} t={t} onChange={value => setDraft(values => ({ ...values, [field]: value }))} />}</>}
                    {data.qcRule.deferredFields.includes(field) && <p className="text-xs">{t('qcRules.deferredHelp')}</p>}
                </fieldset>;
            })}</div>
            {canEdit && <div className="flex gap-3 flex-wrap items-end mt-3">
                <label>{t('policies.reason')}<input required value={reason} data-testid="qc-rule-reason" onChange={e => setReason(e.target.value)} /></label>
                <button disabled={saving || !reason.trim()}>{t('policies.save')}</button>
                <button type="button" disabled={saving || !reason.trim()} data-testid="qc-rule-reset" onClick={() => save(true)}>{t('qcRules.reset')}</button>
            </div>}
        </form>
        <ul>{data.versions.map(row => <li key={row.id}>{t('policies.version')} {row.version} · <time>{new Date(row.effectiveFrom).toLocaleString()}</time> · {row.approvedBy} · {row.reason}</li>)}</ul>
    </section>;
}
