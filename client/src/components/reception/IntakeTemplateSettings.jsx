import React,{useEffect,useState} from 'react';
import axios from 'axios';
import {useLanguage} from '../../context/LanguageContext';
import {formLabel,formName} from './intakeForm';

export default function IntakeTemplateSettings({labId,projectId=null}) {
    const {t,locale} = useLanguage();
    const [catalog,setCatalog]=useState(null),[origin,setOrigin]=useState('*'),[matrix,setMatrix]=useState('SOIL');
    const [source,setSource]=useState(null),[form,setForm]=useState(null),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
    const [forbidden,setForbidden]=useState(false);
    const load=async()=>{
        if (!labId) return;
        try {
            if (projectId) await axios.get(`/api/projects/${projectId}/intake-template-bindings`,{params:{labId}});
            const {data}=await axios.get(`/api/labs/${labId}/intake-templates`);setCatalog(data);setForbidden(false);
        } catch(err) {if(err.response?.status===403) setForbidden(true);else setMessage(t('intakeRules.loadFailed'));}
    };
    useEffect(()=>{setCatalog(null);setSource(null);setForm(null);load();},[labId,projectId]);
    const options=(catalog?.templates || []).flatMap(template=>template.revisions.filter(r=>r.state==='PUBLISHED' && (template.matrix===matrix || template.matrix==='OTHER')).map(revision=>({...revision,name:template.name,local:!!template.labId})));
    const binding=catalog?.bindings.find(b=>b.projectId===(projectId||null) && b.matrix===matrix && b.origin===origin);
    const choose=(id,clearMessage=true)=>{const row=options.find(r=>r.id===id);setSource(row || null);setForm(row ? structuredClone(row.schema):null);if(clearMessage) setMessage('');};
    useEffect(()=>{if(catalog) choose(binding?.revisionId || options.find(r=>r.id===(matrix!=='SOIL'?'INTAKE-SEED-COMPATIBLE-1':origin==='DESK_WALKIN'?'INTAKE-SEED-COMMERCIAL-1':'INTAKE-SEED-SOILFER-1'))?.id || options[0]?.id,false);},[catalog,origin,matrix]);
    if (forbidden || !labId) return null;
    const run=async action=>{setBusy(true);setMessage('');try {await action();await load();setMessage(t('intakeRules.saved'));}catch(err){setMessage((err.response?.data?.code || t('intakeRules.saveFailed'))+' · '+t('intakeRules.inputKept'));}finally{setBusy(false);}};
    const toggle=(group,index,key,value)=>setForm(prev=>({...prev,[group]:prev[group].map((row,i)=>i===index ? {...row,[key]:value}:row)}));
    return <section className="rounded-2xl border border-sf-divider bg-sf-surface p-4 sm:p-6 space-y-4 min-w-0" aria-label={t('intakeRules.settings')}>
        <h2 className="font-bold text-lg text-sf-text">{t('intakeRules.settings')}</h2>
        <p className="text-sm text-sf-muted">{t('intakeRules.settingsHint')}</p>
        {message && <p role="status" className="rounded-lg bg-sf-canvas p-3 text-sm text-sf-text break-words">{message}</p>}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="text-sm text-sf-text">{t('intakeRules.material')}<input className="block w-full p-2 rounded-lg border border-sf-divider bg-sf-canvas" value={matrix} onChange={e=>setMatrix(e.target.value.toUpperCase())}/></label>
            <label className="text-sm text-sf-text">{t('intakeRules.origin')}<select className="block w-full p-2 rounded-lg border border-sf-divider bg-sf-canvas" value={origin} onChange={e=>setOrigin(e.target.value)}>{['*','PROJECT_SAMPLE','DESK_WALKIN'].map(id=><option key={id} value={id}>{t('intakeRules.originNames.'+id)}</option>)}</select></label>
            <label className="text-sm text-sf-text">{t('intakeRules.template')}<select className="block w-full p-2 rounded-lg border border-sf-divider bg-sf-canvas" value={source?.id || ''} onChange={e=>choose(e.target.value)}><option value="">{t('intakeRules.choose')}</option>{options.map(r=><option key={r.id} value={r.id}>{formName({name:r.name,templateId:r.templateId},t)} · {t(r.local?'intakeRules.labCopy':'intakeRules.seedCopy')} · {t('intakeRules.version')} {r.version}</option>)}</select></label>
        </div>
        {form && <>
            {['criteria','contextFields'].map(group=><fieldset key={group} className="border border-sf-divider rounded-xl p-3"><legend className="font-semibold text-sf-text px-1">{t('intakeRules.'+group)}</legend>
                <div className="space-y-2">{form[group].map((row,i)=><div key={row.id} className="flex flex-wrap items-center gap-3 text-sm text-sf-text rounded-lg bg-sf-canvas p-2">
                    <span className="flex-1 min-w-36 break-words">{formLabel(row,locale)}</span>
                    <label className="flex items-center gap-2"><input type="checkbox" checked={row.enabled!==false} onChange={e=>toggle(group,i,'enabled',e.target.checked)}/>{t('intakeRules.enabled')}</label>
                    <label className="flex items-center gap-2"><input type="checkbox" checked={!!row.required} disabled={row.enabled===false} onChange={e=>toggle(group,i,'required',e.target.checked)}/>{t('intakeRules.required')}</label>
                </div>)}</div>
            </fieldset>)}
            <div className="flex flex-wrap gap-3">
                <button type="button" disabled={busy} className="rounded-lg px-4 py-2 bg-sf-primary text-white disabled:opacity-50" onClick={()=>run(()=>axios.post(`/api/labs/${labId}/intake-templates/basic`,{projectId,matrix,origin,sourceRevisionId:source.id,sourceHash:source.schemaHash,schema:form,expectedVersion:binding?.editVersion || 0}))}>{t('intakeRules.saveVersion')}</button>
                <button type="button" disabled={busy} className="rounded-lg px-4 py-2 border border-sf-divider text-sf-text" onClick={()=>run(()=>axios.put(projectId ? `/api/projects/${projectId}/intake-template-bindings` : `/api/labs/${labId}/intake-template-defaults`,{labId,projectId,matrix,origin,revisionId:source.id,expectedVersion:binding?.editVersion || 0}))}>{t('intakeRules.usePublished')}</button>
            </div>
        </>}
    </section>;
}
