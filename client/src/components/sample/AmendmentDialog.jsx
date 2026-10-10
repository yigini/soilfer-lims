import React,{useEffect,useRef,useState} from 'react';
import axios from 'axios';
import {useAuth} from '../../context/AuthContext';
import {useLanguage} from '../../context/LanguageContext';
import {useFocusTrap} from '../../hooks/useFocusTrap';

export default function AmendmentDialog({sampleId,sampleStatus,workItems,initialType='CLERICAL',onClose,onChanged}){
 const {user,hasPermission}=useAuth(),{t}=useLanguage();
 const allowed=Boolean(hasPermission?.('APPROVE_RESULTS'));
 const [type,setType]=useState(initialType),[reason,setReason]=useState(''),[reasonCode,setReasonCode]=useState('CLIENT_RETEST');
 const [selected,setSelected]=useState([]),[amendments,setAmendments]=useState([]),[requiresSecondPerson,setRequiresSecondPerson]=useState(null);
 const [limitOverrides,setLimitOverrides]=useState({});
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [reload,setReload]=useState(0),operation=useRef(crypto.randomUUID()),authoriseKeys=useRef(new Map()),generation=useRef(0);
 const dialogRef=useFocusTrap(true,()=>{if(!busy)onClose();});
 useEffect(()=>{
  const current=++generation.current,controller=new AbortController();
  setLoading(true);setAmendments([]);setRequiresSecondPerson(null);
  if(!allowed){setLoading(false);return()=>{generation.current++;};}
  axios.get(`/api/samples/${sampleId}/amendments`,{signal:controller.signal}).then(({data})=>{
   if(generation.current!==current)return;
   setAmendments(data.amendments);setRequiresSecondPerson(data.requiresSecondPerson);setLoading(false);
  }).catch(err=>{if(generation.current!==current||controller.signal.aborted)return;setError(err.response?.data?.error||t('amendment.failed'));setLoading(false);});
  return()=>{generation.current++;controller.abort();};
 },[sampleId,allowed,reload,t]);
 const scientificAvailable=sampleStatus==='APPROVED';
 const candidates=workItems.filter(item=>item.status==='ACCEPTED'&&!item.duplicateOf&&!item.isGate&&item.category!=='Operational Gates');
 const overrides=selected.filter(id=>limitOverrides[id]).map(workItemId=>({workItemId,
  description:limitOverrides[workItemId].description.trim(),impactAssessment:limitOverrides[workItemId].impactAssessment.trim()}));
 const invalidOverride=overrides.some(row=>!row.description||!row.impactAssessment);
 const updateOverride=(id,field,value)=>setLimitOverrides(rows=>({...rows,[id]:{...rows[id],[field]:value}}));
 const send=async(amendment=null)=>{
  if(busy||!allowed||loading)return;
  const current=generation.current;setBusy(true);setError('');setNotice('');
  try{
   if(amendment){
    if(!authoriseKeys.current.has(amendment.id))authoriseKeys.current.set(amendment.id,crypto.randomUUID());
    await axios.post(`/api/samples/${sampleId}/amendments/${amendment.id}/authorise`,
     {expectedVersion:amendment.version,idempotencyKey:authoriseKeys.current.get(amendment.id)});
   }else{
    await axios.post(`/api/samples/${sampleId}/amendments`,{type,reason:reason.trim(),idempotencyKey:operation.current,
     ...(type==='SCIENTIFIC'&&{reasonCode,selectedWorkItemIds:selected,...(overrides.length&&{limitOverrides:overrides})})});
   }
   if(generation.current!==current)return;
   setNotice(t(amendment?'amendment.authorisedNotice':'amendment.pendingNotice'));
   if(!amendment){setReason('');setSelected([]);setLimitOverrides({});operation.current=crypto.randomUUID();}
   onChanged();setReload(value=>value+1);
  }catch(err){if(generation.current===current)setError(err.response?.data?.error||t('amendment.failed'));}
  finally{if(generation.current===current)setBusy(false);}
 };
 return <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4">
  <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="amendment-title" className="w-full max-w-2xl max-h-[90dvh] overflow-y-auto rounded-2xl bg-sf-surface border border-sf-divider p-6 space-y-4">
   <h2 id="amendment-title" className="text-lg font-bold text-sf-text">{t('amendment.title')}</h2>
   <p className="text-sm text-sf-muted">{t('amendment.help')}</p>
   {!allowed?<p role="alert">{t('amendment.permission')}</p>:<>
    <p className="text-sm text-sf-muted">{loading?t('common.loading'):t(requiresSecondPerson?'amendment.secondPerson':'amendment.selfAllowed')}</p>
    <fieldset disabled={busy||loading} className="space-y-3">
     <label className="block text-sm">{t('amendment.type')}<select value={type} onChange={event=>setType(event.target.value)} className="mt-1 w-full p-2 rounded-lg border border-sf-divider bg-sf-canvas">
      {['CLERICAL','SCIENTIFIC','ORDER','REPORT'].map(value=><option key={value} value={value} disabled={value==='SCIENTIFIC'&&!scientificAvailable}>{t('amendment.types.'+value)}</option>)}
     </select></label>
     {type==='SCIENTIFIC'&&<>
      <label className="block text-sm">{t('amendment.repeatReason')}<select value={reasonCode} onChange={event=>setReasonCode(event.target.value)} className="mt-1 w-full p-2 rounded-lg border border-sf-divider bg-sf-canvas">
       {['CLIENT_RETEST','CONFIRMATION'].map(value=><option key={value} value={value}>{t('amendment.reasons.'+value)}</option>)}
      </select></label>
      <div className="space-y-2"><p className="text-sm font-semibold">{t('amendment.selectedLines')}</p>
       {!candidates.length&&<p>{t('amendment.noLines')}</p>}
       {candidates.map(item=><div key={item.id} className="space-y-2 text-sm">
        <label className="flex gap-2 items-start"><input type="checkbox" checked={selected.includes(item.id)} onChange={event=>{setSelected(ids=>event.target.checked?[...ids,item.id]:ids.filter(id=>id!==item.id));
         if(!event.target.checked)setLimitOverrides(rows=>{const next={...rows};delete next[item.id];return next;});}}/><span>{item.analysisName||item.analysis} <span className="text-sf-muted break-all">({item.id})</span></span></label>
        {selected.includes(item.id)&&<div className="ml-6 space-y-2">
         <label className="flex gap-2"><input type="checkbox" data-testid={'amendment-limit-'+item.id} checked={Boolean(limitOverrides[item.id])} onChange={event=>setLimitOverrides(rows=>{const next={...rows};
          if(event.target.checked)next[item.id]={description:'',impactAssessment:''};else delete next[item.id];return next;})}/>{t('amendment.limitOverride')}</label>
         {limitOverrides[item.id]&&<>
          <p className="text-sf-muted">{t('amendment.limitOverrideHelp')}</p>
          <label className="block">{t('amendment.limitDescription')}<textarea data-testid={'amendment-limit-description-'+item.id} value={limitOverrides[item.id].description} onChange={event=>updateOverride(item.id,'description',event.target.value)} className="mt-1 w-full p-2 rounded-lg border border-sf-divider bg-sf-canvas"/></label>
          <label className="block">{t('amendment.limitImpact')}<textarea data-testid={'amendment-limit-impact-'+item.id} value={limitOverrides[item.id].impactAssessment} onChange={event=>updateOverride(item.id,'impactAssessment',event.target.value)} className="mt-1 w-full p-2 rounded-lg border border-sf-divider bg-sf-canvas"/></label>
         </>}
        </div>}
       </div>)}
      </div>
     </>}
     <label className="block text-sm">{t('amendment.reason')}<textarea value={reason} onChange={event=>setReason(event.target.value)} maxLength={4000} className="mt-1 w-full min-h-24 p-2 rounded-lg border border-sf-divider bg-sf-canvas"/></label>
     <button type="button" onClick={()=>send()} disabled={!reason.trim()||type==='SCIENTIFIC'&&(!scientificAvailable||!selected.length||invalidOverride)} className="btn-primary">{t('amendment.request')}</button>
    </fieldset>
    <div className="space-y-3"><h3 className="font-semibold">{t('amendment.history')}</h3>
     {!loading&&!amendments.length&&<p className="text-sm text-sf-muted">{t('amendment.empty')}</p>}
     {amendments.map(amendment=><article key={amendment.id} className="rounded-lg border border-sf-divider p-3 space-y-2 text-sm">
      <p className="font-semibold break-all">{amendment.id}</p><p>{t('amendment.types.'+amendment.type)} · {t('amendment.status.'+amendment.status)}</p>
      <p className="whitespace-pre-wrap">{amendment.reason}</p><p>{t('amendment.requester')}: {amendment.createdBy}</p>
      {amendment.authorizedBy&&<p>{t('amendment.authoriser')}: {amendment.authorizedBy}</p>}
      {amendment.selectedWorkItemIds&&<p className="break-all">{t('amendment.selectedLines')}: {amendment.selectedWorkItemIds}</p>}
      {amendment.status==='PENDING'&&amendment.version!=null&&<>
       {requiresSecondPerson&&amendment.createdBy===user?.username&&<p>{t('amendment.awaitOther')}</p>}
       <button type="button" onClick={()=>send(amendment)} disabled={busy||loading||requiresSecondPerson===null||requiresSecondPerson&&amendment.createdBy===user?.username} className="btn-primary">{t('amendment.authorise')}</button>
      </>}
     </article>)}
    </div>
   </>}
   {error&&<p role="alert" className="text-red-600 dark:text-red-300">{error}</p>}
   {notice&&<p role="status">{notice}</p>}
   <div className="flex justify-end"><button type="button" onClick={onClose} disabled={busy} className="btn-secondary">{t('common.close')}</button></div>
  </section>
 </div>;
}
