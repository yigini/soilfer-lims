import React, { useEffect, useState } from 'react';
import axios from 'axios';
import numberParse from '@lims/number-parse';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

export default function CalculationTemplateManager({ batch, analyte, onChanged }) {
    const { t } = useLanguage(), auth = useAuth(), canManage = auth?.hasPermission?.('MANAGE_CALC_TEMPLATES') === true;
    const [rows,setRows] = useState([]), [state,setState] = useState(null), [selected,setSelected] = useState('');
    const [decimals,setDecimals] = useState(''), [parameters,setParameters] = useState({}), [citation,setCitation] = useState(''), [reason,setReason] = useState('');
    const [verified,setVerified] = useState(false), [busy,setBusy] = useState(false), [error,setError] = useState(null), [revision,setRevision] = useState(0);
    const source = rows.find(row => row.id === selected);
    useEffect(() => {
        let current = true; setRows([]); setState(null); setError(null);
        if (canManage) Promise.all([axios.get('/api/calculation-templates',{params:{labId:batch.labId,analysisCode:analyte.analysisCode}}),
            axios.get('/api/calculation-templates/activation',{params:{labId:batch.labId,analysisCode:analyte.analysisCode,methodologyId:analyte.methodologyId || 'null'}})])
            .then(([definitions,activation]) => { if (current) {setRows(definitions.data.data);setState(activation.data.data);
                setSelected(activation.data.data.active?.templateId || definitions.data.data[0]?.id || '');} })
            .catch(() => {if (current) setError(t('calculations.unavailable'));});
        return () => {current = false;};
    },[canManage,batch.labId,analyte.analysisCode,analyte.methodologyId,revision,t]);
    useEffect(() => {
        setDecimals(source?.outputDecimals == null ? '' : String(source.outputDecimals)); setCitation(''); setReason('');setVerified(false);
        setParameters(Object.fromEntries((source?.parameters || []).map(row => [row.key,String(row.value).replace('.',analyte.numberFormat?.decimal || '.')])));
    },[source,analyte.numberFormat?.decimal]);
    if (!canManage) return null;
    const scope = {labId:batch.labId,analysisCode:analyte.analysisCode,methodologyId:analyte.methodologyId || null};
    const perform = async operation => {
        setBusy(true); setError(null);
        try { await operation(); setRevision(value => value+1); await onChanged?.(); }
        catch {setError(t('calculations.saveRefused'));}
        finally {setBusy(false);}
    };
    const saveVersion = () => perform(async () => {
        const values = source.parameters.map(row => {
            const parsed = numberParse.parseNumber(parameters[row.key],analyte.numberFormat);
            if (!parsed.valid || parsed.qualifier) throw Error('Method constant needs a number');
            return {key:row.key,value:parsed.value};
        });
        const editing = source.labId === batch.labId && source.methodologyId === scope.methodologyId;
        await axios.post(`/api/calculation-templates/${source.id}/${editing ? 'versions' : 'clone'}`,{labId:scope.labId,methodologyId:scope.methodologyId,
            expectedVersion:source.version,outputDecimals:Number(decimals),parameters:values,sopCitation:citation,reason});
    });
    const changeActivation = action => perform(() => axios.post(`/api/calculation-templates/${source.id}/activation`,{...scope,
        expectedVersion:source.version,expectedActivationId:state?.activationHeadId || null,action,verifiedAgainstSop:verified,reason}));
    const isLocal = source?.labId === batch.labId && source?.methodologyId === scope.methodologyId;
    return <details className="p-3 border border-sf-divider rounded-xl" data-testid="calculation-template-manager">
        <summary className="font-semibold text-sm">{t('calculations.manageTemplates')}</summary>
        <div className="space-y-2 mt-2">
            {error && <p role="alert">{error}</p>}
            <label className="grid gap-1 text-xs">{t('calculations.template')}<select disabled={busy} value={selected}
                onChange={event => setSelected(event.target.value)} className="p-2 border rounded bg-sf-canvas">
                {rows.map(row => <option key={row.id} value={row.id}>{row.variant} · v{row.version} · {row.status}</option>)}
            </select></label>
            {source && <>
                <p className="text-xs">{t('calculations.active')}: {state?.active ? rows.find(row => row.id === state.active.templateId)?.variant || '—' : t('calculations.inactive')}</p>
                {source.parameters.map(parameter => <label className="grid gap-1 text-xs" key={parameter.key}>
                    {t(`calculations.parameters.${parameter.key}`,parameter.label)} ({parameter.unit})
                    <input inputMode="decimal" value={parameters[parameter.key] ?? ''} disabled={busy}
                        onChange={event => setParameters(values => ({...values,[parameter.key]:event.target.value}))} className="p-2 border rounded bg-sf-canvas" />
                </label>)}
                <label className="grid gap-1 text-xs">{t('calculations.decimals')}
                    <select value={decimals} disabled={busy} onChange={event => setDecimals(event.target.value)} className="p-2 border rounded bg-sf-canvas">
                        <option value="">{t('calculations.choosePrecision')}</option>
                        {[0,1,2,3,4,5,6].map(value => <option key={value} value={value}>{value}</option>)}
                    </select>
                </label>
                <p className="text-xs text-sf-muted" data-testid="calculation-source-rule">
                    {source.sourceCitation.sourceRule?.rule || source.precisionSource?.rule || t('calculations.precisionRequired')}
                </p>
                {source.sourceCitation.sourceRule?.unit && <p className="text-xs text-sf-muted" data-testid="calculation-source-unit">
                    {source.sourceCitation.sourceRule.unit}
                </p>}
                <label className="grid gap-1 text-xs">{t('calculations.sopCitation')}<input value={citation} disabled={busy}
                    onChange={event => setCitation(event.target.value)} className="p-2 border rounded bg-sf-canvas" /></label>
                <label className="grid gap-1 text-xs">{t('calculations.reason')}<textarea value={reason} disabled={busy}
                    onChange={event => setReason(event.target.value)} className="p-2 border rounded bg-sf-canvas" /></label>
                <button type="button" disabled={busy || decimals === '' || !citation.trim() || !reason.trim()} onClick={saveVersion}
                    className="px-3 py-2 rounded border">{t(isLocal ? 'calculations.saveVersion' : 'calculations.clone')}</button>
                <label className="flex gap-2 text-xs"><input type="checkbox" checked={verified} disabled={busy} onChange={event => setVerified(event.target.checked)} />
                    {t('calculations.verifiedAgainstSop')}</label>
                <div className="flex flex-wrap gap-2">
                    <button type="button" disabled={busy || !isLocal || source.outputDecimals == null || !verified || !reason.trim()}
                        onClick={() => changeActivation('ACTIVATE')} className="btn-primary px-3 py-2">{t('calculations.activate')}</button>
                    <button type="button" disabled={busy || state?.active?.templateId !== source.id || !reason.trim()}
                        onClick={() => changeActivation('DEACTIVATE')} className="px-3 py-2 rounded border">{t('calculations.deactivate')}</button>
                </div>
            </>}
        </div>
    </details>;
}
