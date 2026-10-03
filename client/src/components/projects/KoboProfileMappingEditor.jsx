import React, {useState} from 'react';
import axios from 'axios';
import {useLanguage} from '../../context/LanguageContext';

export default function KoboProfileMappingEditor({projectId, config}) {
    const {t} = useLanguage();
    const [mapping, setMapping] = useState(()=>{try {return (typeof config.fieldMapping === 'string' ? JSON.parse(config.fieldMapping) : config.fieldMapping)?.profileReference || {};} catch {return {};}});
    const [revision, setRevision] = useState(config.updatedAt);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState(null);
    const fields = ['codePath','sitePath','namespace','namespacePath','relationPath','collectionDatePath','depthTopD1Path','depthBottomD1Path','depthTopD2Path','depthBottomD2Path'];
    const save = async()=>{
        setBusy(true); setMessage(null);
        try {
            const base = typeof config.fieldMapping === 'string' ? JSON.parse(config.fieldMapping) : config.fieldMapping || {};
            const profileReference = Object.fromEntries(Object.entries(mapping).filter(([,value])=>typeof value === 'string' && value.trim()).map(([key,value])=>[key,value.trim()]));
            const response = await axios.put(`/api/projects/${projectId}/kobo-connections/${config.configId}`, {fieldMapping:{...base,profileReference},expectedRevision:revision});
            setRevision(response.data.updatedAt);
            setMessage({ok:true,text:t('profileReference.mappingSaved')});
        } catch (error) {setMessage({ok:false,text:error.response?.data?.message || t('profileReference.saveFailed')});}
        finally {setBusy(false);}
    };
    return <details className="border-t border-sf-divider pt-3">
        <summary className="text-sm font-semibold text-sf-text cursor-pointer">{t('profileReference.mappingTitle')}</summary>
        <p className="text-xs text-sf-muted my-3">{t('profileReference.mappingHelp')}</p>
        <fieldset disabled={busy} className="min-w-0 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {fields.map(key=><label key={key} className="min-w-0 text-xs text-sf-muted">{t(`profileReference.mapping.${key}`)}<input maxLength={512} value={mapping[key] || ''} onChange={e=>setMapping(prev=>({...prev,[key]:e.target.value}))} className="mt-1 w-full rounded-lg border border-sf-divider bg-sf-canvas text-sf-text p-2"/></label>)}
            <label className="text-xs text-sf-muted">{t('profileReference.meaning')}<select value={mapping.relation || ''} onChange={e=>setMapping(prev=>({...prev,relation:e.target.value}))} className="mt-1 w-full rounded-lg border border-sf-divider bg-sf-canvas text-sf-text p-2"><option value="">{t('profileReference.fromSource')}</option>{['SITE_POINT','COMPOSITE','CONFIRMED_PROFILE'].map(key=><option value={key} key={key}>{t(`profileReference.relations.${key}`)}</option>)}</select></label>
        </fieldset>
        {message && <p role={message.ok ? 'status' : 'alert'} className={`text-xs mt-3 ${message.ok ? 'text-sf-text' : 'text-red-600 dark:text-red-300'}`}>{message.text}</p>}
        <button type="button" onClick={save} disabled={busy} className="btn-secondary text-xs mt-3">{busy ? t('common.saving') : t('common.save')}</button>
    </details>;
}
