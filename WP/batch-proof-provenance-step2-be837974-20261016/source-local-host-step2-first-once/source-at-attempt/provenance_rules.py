"""New Step2 structural transition predicates derived from accepted Step1.
Strict global row/audit consumption below adds same-sync and intra checks.
"""
import datetime,hashlib,json,re
from urllib.parse import quote
from provenance_privacy import *
def quoted(n):return '"'+n.replace('"','""')+'"'
def encoded(row):return json.dumps(list(row),ensure_ascii=False,separators=(',',':'),default=lambda b:{'blobSha256':sha(b)}).encode()
def schema(db):return [tuple(r) for r in db.execute("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name")]
def tables(db):return [r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")]
def layout(db,t):return [tuple(r) for r in db.execute('PRAGMA table_xinfo('+quoted(t)+')')]
def ordering(v):
    if v is None:return (0,0)
    if isinstance(v,(int,float)):return (1,v)
    if isinstance(v,str):return (2,v)
    if isinstance(v,bytes):return (3,v)
    raise RuntimeError('Unsupported SQLite key type')
def key_of(row,keys):return tuple(ordering(row[k]) for k in keys)
def identity(row,keys):
    return {'id':row['id']} if keys==['id'] else {'keyColumns':keys,'keySha256':value_hash([row[k] for k in keys])}
def structural(old,new,path='$',depth=0):
    require(depth<=40,'JSON depth bound')
    if type(old) is type(new) and old==new:return {'changes':[],'arrays':[],'everyOldValueRetained':True}
    changes=[];arrays=[];preserved=True
    def entry(kind,p,a,b):return {'classification':kind,'path':p,'beforeSha256':value_hash(a),'afterSha256':value_hash(b)}
    if isinstance(old,dict) and isinstance(new,dict):
        for k in sorted(set(old)|set(new)):
            # Raw arbitrary JSON keys remain private. Public key paths expose
            # only ordinary field identifiers; other keys are hashed.
            p=path+'.'+(k if re.fullmatch('[A-Za-z_][A-Za-z0-9_]{0,79}',k) else '{keySha256:'+value_hash(k)+'}')
            if k not in old:changes.append(entry('ADDED',p,None,new[k]))
            elif k not in new:changes.append(entry('REMOVED',p,old[k],None));preserved=False
            else:
                r=structural(old[k],new[k],p,depth+1);changes+=r['changes'];arrays+=r['arrays'];preserved &= r['everyOldValueRetained']
    elif isinstance(old,list) and isinstance(new,list):
        arrays.append({'path':path,'beforeCount':len(old),'afterCount':len(new),'classification':'GREW' if len(new)>len(old) else 'SHRANK' if len(new)<len(old) else 'SAME_LENGTH'})
        for i in range(max(len(old),len(new))):
            p=path+'['+str(i)+']'
            if i>=len(old):changes.append(entry('ADDED',p,None,new[i]))
            elif i>=len(new):changes.append(entry('REMOVED',p,old[i],None));preserved=False
            else:
                r=structural(old[i],new[i],p,depth+1);changes+=r['changes'];arrays+=r['arrays'];preserved &= r['everyOldValueRetained']
    else:changes.append(entry('CHANGED',path,old,new));preserved=False
    require(len(changes)<=20000,'Structural diff bound')
    return {'changes':changes,'arrays':arrays,'everyOldValueRetained':bool(preserved)}
def object_json(v):
    obj=strict(v or '{}');require(isinstance(obj,dict),'Metadata must be an object');return obj
def instant(v):
    if type(v) in (int,float):return v
    require(isinstance(v,str),'Timestamp required')
    d=datetime.datetime.fromisoformat(v.replace('Z','+00:00'));require(d.tzinfo is not None,'Timestamp zone required');return round(d.timestamp()*1000)
def same_instant(a,b):
    try:return instant(a)==instant(b)
    except (ValueError,RuntimeError,TypeError):return False
def monotonic(a,b):
    try:return instant(b)>=instant(a)
    except (ValueError,RuntimeError,TypeError):return False
def array_append(a,b):return isinstance(a,list) and isinstance(b,list) and len(b)>=len(a) and b[:len(a)]==a
def parse_arrays(old,new,name):
    a=old.get(name,[]);b=new.get(name,[]);require(array_append(a,b),'Old metadata array changed');return b[len(a):]
def scope_entry(sample,entry,configs,fetch,conflict=True):
    matches=[(i,c) for i,c in configs.items() if c.get('isActive')==1 and i not in REFUSALS and c.get('projectCode') and c.get('labId')==sample.get('assignedLab') and c.get('projectCode')==sample.get('projectCode') and c.get('koboServerUrl')==entry.get('sourceServerUrl') and c.get('formId')==entry.get('sourceFormId')]
    require(len(matches)==1,'Conflict scope not uniquely active and non-refusal');i,c=matches[0];f=fetch.get(i)
    require(isinstance(f,dict) and f.get('configId')==i and f.get('labId')==c.get('labId') and f.get('projectCode')==c.get('projectCode'),'Retained first-fetch scope mismatch')
    require(f.get('sourceIdentitySha256')==sha(json.dumps([c['koboServerUrl'],c['formId']]).encode()),'Retained fetch source identity mismatch')
    sid=str(entry.get('kobo_id',''));require(sid.isdigit() and sid in {str(x) for x in f.get('submissionIds',[])},'Conflict id absent from retained first fetch')
    require(entry.get('depth') in ('D1','D2'),'Conflict depth identity missing')
    occurrence=str(c.get('koboServerUrl') or '')+':'+str(c.get('formId') or '')+':'+sid+':'+entry['depth']
    if conflict:require(entry.get('occurrenceKey')==occurrence,'Conflict occurrence key mismatch')
    return i
def marker_expected(old_meta,new_meta,primary):
    old=old_meta.get('provenanceHold',{});new=new_meta.get('provenanceHold')
    require(isinstance(old,dict) and isinstance(new,dict),'Invalid hold marker')
    reason=PRIMARY_REASON if primary else CROSS_REASON
    po={k:old_meta[k] for k in ['kobo_id','kobo_uuid','submission_time','surveyor','site_id'] if k in old_meta}
    if primary and 'evidenceFingerprint' in old_meta:po['evidenceFingerprint']=old_meta['evidenceFingerprint']
    expected={k:v for k,v in old.items() if k not in ('createdByResolution','boundHoldIds')}
    expected.update({'status':HOLD_ACTIVE,'reason':reason,'primaryOccurrence':po,'conflictingCount':len(new_meta['conflictingSubmissions']),'updatedAt':new.get('updatedAt')})
    if primary:expected['revisionCount']=len(new_meta['revisions'])
    require(new==expected,'Hold marker differs from exact current code')
    require(isinstance(new.get('updatedAt'),str) and monotonic(new['updatedAt'],new['updatedAt']),'Marker time malformed')
    return reason
def paired(sample_id,sample,holds,audits,count,reason):
    hs=[h for h in holds if h.get('sampleId')==sample_id]
    cs=[a for a in audits if a.get('entity')=='SAMPLE' and a.get('entityId')==sample_id and a.get('action')=='KOBO_CONFLICTING_PROVENANCE']
    require(len(hs)==len(cs)==count and count>0,'Conflict hold/audit count mismatch')
    used=set();hold_audits=[]
    for h in hs:
        require(h.get('type')=='PROVENANCE' and h.get('raisedBy')=='system:kobo-sync' and h.get('compatMarker')=='KOBO_PROVENANCE' and h.get('attributionSource')=='LIVE' and h.get('reason') in (CROSS_REASON,PRIMARY_REASON) and all(h.get(k) is None for k in ['resolvedBy','resolvedAt','resolution']),'Hold type/actor/marker/resolution differs')
        aa=[a for a in audits if a.get('entity')=='SAMPLE_HOLD' and a.get('entityId')==h['id']]
        require(len(aa)==1,'Hold audit not uniquely paired');a=aa[0];d=object_json(a.get('after'))
        require(a.get('action')=='HOLD_RAISED' and a.get('performedBy')=='system:kobo-sync' and a.get('sampleId')==sample_id and a.get('labId')==(sample.get('assignedLab') or None),'Hold audit authority differs')
        require(set(d)==set(h) and all(d[k]==h[k] for k in h if k!='raisedAt') and same_instant(d['raisedAt'],h['raisedAt']) and same_instant(a.get('timestamp'),h['raisedAt']),'Hold audit does not bind complete hold')
        require(a['id'] not in used,'Duplicate hold audit');used.add(a['id']);hold_audits.append(a)
    require(any(h['reason']==reason for h in hs),'Final hold reason not paired')
    require(all(c.get('performedBy')=='KOBO_SCHEDULER' and c.get('sampleId') is None and c.get('labId') is None for c in cs),'Conflict audit actor/scope differs from code')
    return {'holdIds':[h['id'] for h in hs],'conflictAuditIds':[a['id'] for a in cs],'holdAuditIds':[a['id'] for a in hold_audits],'holdCount':len(hs),'conflictAuditCount':len(cs),'holdAuditCount':len(hold_audits),'classification':'EXACT_PROVENANCE_PAIRS'}
def classify_sample(before,after,configs,fetch,holds,audits):
    changed=[k for k in before if before[k]!=after[k]]
    public={'id':before['id'],'columns':changed,'beforeSha256':value_hash(before),'afterSha256':value_hash(after),'classification':'UNEXPLAINED','statusBeforeSha256':value_hash(before.get('status')),'statusAfterSha256':value_hash(after.get('status')),'labIdSha256':value_hash(before.get('assignedLab')),'projectIdSha256':value_hash(before.get('projectCode')),'statusBeforeExpectedCount':int(before.get('status')=='EXPECTED'),'statusAfterExpectedCount':int(after.get('status')=='EXPECTED'),'rejectionBeforeEmptyCount':int(not before.get('rejectionReason')),'rejectionAfterExactCount':int(after.get('rejectionReason')==REJECTION)}
    try:
        a=object_json(before.get('metadata'));b=object_json(after.get('metadata'));fa=object_json(before.get('fieldMetadata'));fb=object_json(after.get('fieldMetadata'))
        public['metadataDiff']=structural(a,b);public['fieldMetadataDiff']=structural(fa,fb)
        require(before.get('status')==after.get('status')=='EXPECTED','Changed original is not EXPECTED')
        require(set(changed)<=SAMPLE_FIELDS and 'metadata' in changed,'Protected Sample column changed')
        require(before.get('rejectionReason')==after.get('rejectionReason') or not before.get('rejectionReason') and after.get('rejectionReason')==REJECTION,'Rejection reason overwritten')
        require('updatedAt' not in changed or monotonic(before['updatedAt'],after['updatedAt']),'Sample updatedAt regressed')
        appended=parse_arrays(a,b,'conflictingSubmissions');revisions=parse_arrays(a,b,'revisions')
        require(appended,'No append-only conflict evidence')
        primary=bool(revisions)
        allowed={'conflictingSubmissions','provenanceHold'}|({'revisions'} if primary else set())
        require(all(a.get(k)==b.get(k) for k in set(a)|set(b) if k not in allowed),'Old metadata value changed outside exact writer')
        if primary:require(revisions==appended and all(e.get('reason')=='PRIMARY_OCCURRENCE_REVISED_EVIDENCE' and str(e.get('kobo_id'))==str(a.get('kobo_id')) and e.get('sourceServerUrl')==a.get('sourceServerUrl') and e.get('sourceFormId')==a.get('sourceFormId') for e in revisions),'Primary revision evidence mismatch')
        else:require(all(str(e.get('kobo_id'))!=str(a.get('kobo_id')) or e.get('sourceServerUrl')!=a.get('sourceServerUrl') or e.get('sourceFormId')!=a.get('sourceFormId') or e.get('depth')!=a.get('depth') for e in appended),'Unclassified primary occurrence')
        entry_fields={'profileEvidence','profileFingerprint','occurrenceKey','evidenceFingerprint','sourceServerUrl','sourceFormId','kobo_id','kobo_uuid','submission_time','surveyor','site_id','depth','lat','lng','collected_at','attachments','recordedAt'}|({'reason'} if primary else set())
        require(all(isinstance(e,dict) and set(e)<=entry_fields and all(k in e for k in ['occurrenceKey','sourceServerUrl','sourceFormId','kobo_id','depth','evidenceFingerprint','recordedAt']) for e in appended),'Conflict entry shape differs')
        keys=[(e.get('occurrenceKey'),e.get('evidenceFingerprint')) for e in b['conflictingSubmissions']];require(len(keys)==len(set(keys)),'Reappended occurrence evidence')
        scopes=[scope_entry(before,e,configs,fetch) for e in appended]
        reason=marker_expected(a,b,primary)
        expected_field=dict(fa)
        if 'provenanceHold' in fa:
            require(isinstance(fa['provenanceHold'],dict),'Field hold mirror malformed');expected_field['provenanceHold']={**fa['provenanceHold'],'value':HOLD_ACTIVE}
        require(fb==expected_field,'Field metadata changed outside exact mirror writer')
        pairing=paired(before['id'],before,holds,audits,len(appended),reason)
        public.update({'classification':'PRIMARY_REVISION' if primary else 'CROSS_SUBMISSION_DUPLICATE','configIds':sorted(set(scopes)),'conflictSubmissionIds':[str(e['kobo_id']) for e in appended],'appendedCount':len(appended),'pairing':pairing,'oldValuesOutsideWriterRetainedCount':1})
    except (ValueError,TypeError,KeyError,RuntimeError) as e:
        public['refusal']=public_failure(e);public['classification']='UNEXPLAINED'
    return public

def fresh_submission(config_id,sid,prior):
    require(str(sid).isdigit(),'Numeric conflict submission required')
    if prior is not None:
        require(config_id in prior,'Second sync lacks first fetch')
        ids={str(x) for x in prior[config_id]}
        require(str(sid) not in ids and (not ids or int(sid)>max(map(int,ids))),'Second sync conflict/intake re-append or old submission')

def check_fetch(configs,records,ids):
    require(isinstance(records,dict) and set(ids)<=set(records),'Full retained fetch records required')
    for i,values in ids.items():
        r=records[i];c=configs[i]
        require(r.get('configId')==i and r.get('labId')==c['labId'] and r.get('projectCode')==c['projectCode'] and r.get('sourceIdentitySha256')==sha(json.dumps([c['koboServerUrl'],c['formId']]).encode()),'Retained fetch authority differs')
        require(len(values)==len(set(map(str,values))) and sorted(map(str,values),key=int)==sorted(map(str,r.get('submissionIds',[])),key=int),'Fetch IDs differ from retained records')

def checked_cross(before,after,configs,fetch,holds,audits,prior):
    hs=[h for h in holds if h.get('sampleId')==after['id'] and h.get('reason') in (CROSS_REASON,PRIMARY_REASON)]
    hids={h['id'] for h in hs}
    aa=[a for a in audits if a.get('entity')=='SAMPLE' and a.get('entityId')==after['id'] and a.get('action')=='KOBO_CONFLICTING_PROVENANCE' or a.get('entity')=='SAMPLE_HOLD' and a.get('entityId') in hids]
    report=classify_sample(before,after,configs,fetch,hs,aa)
    require(report['classification'] in ('CROSS_SUBMISSION_DUPLICATE','PRIMARY_REVISION'),'Sample change lacks exact reviewed provenance transition')
    old=object_json(before.get('metadata'));new=object_json(after.get('metadata'))
    entries=parse_arrays(old,new,'conflictingSubmissions')
    for e in entries:
        i=scope_entry(before,e,configs,fetch);fresh_submission(i,e['kobo_id'],prior)
        require(isinstance(e.get('evidenceFingerprint'),str) and re.fullmatch('[a-f0-9]{64}',e['evidenceFingerprint']) and monotonic(e['recordedAt'],e['recordedAt']),'Conflict evidence identity/time malformed')
    # Every hold and conflict audit is consumed once, with code-exact reason,
    # scope, actor and temporal order. Hold-audit payload binds the complete row.
    reason=PRIMARY_REASON if report['classification']=='PRIMARY_REVISION' else CROSS_REASON
    require(all(h['reason']==reason for h in hs),'Mixed or extra conflict hold reason')
    conflicts=[a for a in aa if a['entity']=='SAMPLE'];remaining=sorted(conflicts,key=lambda a:(instant(a['timestamp']),a['id']))
    ordered_holds=sorted(hs,key=lambda h:(instant(h['raisedAt']),h['id']))
    ordered_entries=sorted(entries,key=lambda e:instant(e['recordedAt']))
    for e,h,a in zip(ordered_entries,ordered_holds,remaining):
        require(instant(e['recordedAt'])<=instant(h['raisedAt'])<=instant(a['timestamp']) and instant(a['timestamp'])-instant(e['recordedAt'])<=600000,'Conflict pair time order or bounded transaction differs')
        require(a.get('before') is None and a.get('after') is None and a.get('details') is None,'Conflict audit invented payload')
    return report

def validate_added_and_changed(changed,new_samples,holds,audits,notifications,configs,fetch,ids,managers,prior=None,notification_batches=None):
    """One global exact partition: every added hold/audit/notification consumed."""
    check_fetch(configs,fetch,ids);used_holds=set();used_audits=set();reports=[];scopes={};pairs={i:set() for i,c in configs.items() if c.get('isActive') and c.get('projectCode')};depths={i:{} for i in pairs};submissions={};counts={i:0 for i in pairs}
    def consume(report):
        p=report['pairing'];hh=set(p['holdIds']);aa=set(p['holdAuditIds'])|set(p['conflictAuditIds'])
        require(not used_holds.intersection(hh) and not used_audits.intersection(aa),'Hold/audit consumed more than once')
        used_holds.update(hh);used_audits.update(aa);reports.append(report)
    for before,after in changed:consume(checked_cross(before,after,configs,fetch,holds,audits,prior))
    for sid,s in new_samples.items():
        m=object_json(s.get('metadata'));i=scope_entry(s,m,configs,fetch,conflict=False);scopes[sid]=i
        require(s.get('status')=='EXPECTED' and s.get('labId') is None and all(s.get(k) is None for k in ['acceptedBy','acceptedAt','approvedBy','approvedAt','receivedBy','receptionDate','holdPriorStatus','legacyStatus']),'New Sample invented lifecycle authority')
        submission=str(m.get('kobo_id'));fresh_submission(i,submission,prior);pair=(submission,m.get('depth'))
        require(pair not in pairs[i],'Duplicate added submission/depth');pairs[i].add(pair);counts[i]+=1;depths[i][pair[1]]=depths[i].get(pair[1],0)+1;submissions.setdefault(i,set()).add(submission)
        creates=[a for a in audits if a.get('entity')=='SAMPLE' and a.get('entityId')==sid and a.get('action')=='CREATE_KOBO_SYNC']
        require(len(creates)==1,'Exactly one create per NEW Sample required');a=creates[0]
        require(a.get('performedBy')=='KOBO_SCHEDULER' and a.get('sampleId')==sid and a.get('labId')==s.get('assignedLab') and a.get('before') is None and a.get('after') is None and object_json(a.get('details'))=={'status':'EXPECTED','context':'ordinary'},'New Sample create audit scope/actor/payload differs')
        used_audits.add(a['id'])
        intra=m.get('intraSubDuplicates',[]);cross=m.get('conflictingSubmissions',[])
        require(isinstance(intra,list) and isinstance(cross,list),'New Sample conflict arrays malformed')
        if intra:
            mirror=object_json(s.get('fieldMetadata')).get('provenanceHold')
            require(isinstance(mirror,dict) and mirror.get('value')==HOLD_ACTIVE,'New intra field marker differs')
            keys=set();allowed={'sourceServerUrl','sourceFormId','depth','site_id','lat','lng','collected_at','kobo_submission_id','kobo_uuid','attachments','reason'}
            for e in intra:
                require(isinstance(e,dict) and set(e)<=allowed and e.get('reason')=='INTRA_SUBMISSION_DUPLICATE_BARCODE','Intra duplicate entry shape differs')
                scoped={**e,'kobo_id':e.get('kobo_submission_id')};require(scope_entry(s,scoped,configs,fetch,conflict=False)==i and str(e['kobo_submission_id'])==submission and e['depth']!=m.get('depth'),'Intra duplicate source/depth differs')
                occurrence=(i,submission,e['depth']);require(occurrence not in keys,'Repeated intra occurrence');keys.add(occurrence)
            hs=[h for h in holds if h.get('sampleId')==sid and h.get('reason')==INTRA_REASON]
            aa=[a for a in audits if a.get('entity')=='SAMPLE' and a.get('entityId')==sid and a.get('action')=='KOBO_INTRA_SUBMISSION_DUPLICATE']
            require(len(hs)==len(aa)==1,'Exact intra hold/audit pair required');h=hs[0];a=aa[0]
            require(a.get('performedBy')=='KOBO_SCHEDULER' and a.get('sampleId') is None and a.get('labId') is None and all(a.get(k) is None for k in ['before','after','details']) and instant(a['timestamp'])>=instant(h['raisedAt']),'Intra audit differs')
            require(s.get('rejectionReason')==INTRA_REJECTION,'New intra rejection differs')
            used_holds.add(h['id']);used_audits.add(a['id'])
        else:require(s.get('rejectionReason')==(REJECTION if cross else None),'New Sample rejection outside exact writer')
        if cross:
            base=dict(s);bm=dict(m);bm.pop('conflictingSubmissions',None);bm.pop('revisions',None);bm.pop('provenanceHold',None)
            if intra:bm['provenanceHold']={'status':HOLD_ACTIVE,'reason':INTRA_REASON,'duplicates':intra,'updatedAt':m['provenanceHold']['updatedAt']}
            base['metadata']=json.dumps(bm);base['rejectionReason']=INTRA_REJECTION if intra else None
            consume(checked_cross(base,s,configs,fetch,holds,audits,prior))
        elif intra:
            marker=m.get('provenanceHold');require(isinstance(marker,dict) and set(marker)=={'status','reason','duplicates','updatedAt'} and marker['status']==HOLD_ACTIVE and marker['reason']==INTRA_REASON and marker['duplicates']==intra and monotonic(marker['updatedAt'],marker['updatedAt']),'New intra marker differs')
        else:require('provenanceHold' not in m and 'revisions' not in m,'New Sample unexplained marker/revision')
    # Bind ALL hold rows and their one exact HOLD_RAISED audit, including intra.
    samples={after['id']:after for before,after in changed};samples.update(new_samples)
    for h in holds:
        require(h['id'] in used_holds and h.get('sampleId') in samples and h.get('type')=='PROVENANCE' and h.get('raisedBy')=='system:kobo-sync' and h.get('compatMarker')=='KOBO_PROVENANCE' and h.get('attributionSource')=='LIVE' and all(h.get(k) is None for k in ['resolvedAt','resolvedBy','resolution']),'Orphan/extra or malformed hold')
        aa=[a for a in audits if a.get('entity')=='SAMPLE_HOLD' and a.get('entityId')==h['id']];require(len(aa)==1,'Hold missing or duplicate HOLD_RAISED')
        a=aa[0];d=object_json(a.get('after'));s=samples[h['sampleId']]
        require(a.get('action')=='HOLD_RAISED' and a.get('performedBy')=='system:kobo-sync' and a.get('sampleId')==s['id'] and a.get('labId')==s['assignedLab'] and a.get('before') is None and a.get('details') is None and set(d)==set(h) and all(d[k]==h[k] for k in h if k!='raisedAt') and same_instant(d['raisedAt'],h['raisedAt']) and same_instant(a.get('timestamp'),h['raisedAt']),'Hold audit does not bind exact complete hold')
        used_audits.add(a['id'])
    require(used_holds=={h['id'] for h in holds} and used_audits=={a['id'] for a in audits},'Orphan or extra audit/hold including CREATE on original')
    # Runtime emits one notification for EACH active manager in a config's lab.
    # The accepted fixture had one manager. No manager means no notification.
    expected=[{'configId':i,'userId':u,'count':counts[i]} for i in counts if counts[i] for u,lab in managers.items() if lab==configs[i]['labId']]
    if notification_batches is not None:
        expected=[dict(r) for batch in notification_batches for r in batch]
        require(all(r['configId'] in counts and r['userId'] in managers and managers[r['userId']]==configs[r['configId']]['labId'] and type(r['count']) is int and r['count']>0 for r in expected),'Full notification batch authority malformed')
        for i in counts:
            for u,lab in managers.items():
                if lab==configs[i]['labId']:require(sum(r['count'] for r in expected if r['configId']==i and r['userId']==u)==counts[i],'Full notification batch count differs from new Sample rows')
    pending=list(expected)
    for n in notifications:
        matches=[]
        for k,e in enumerate(pending):
            c=configs[e['configId']];link='/samples?view=expected&projects='+quote(c['projectCode'],safe="~!*'()")+'&labs='+quote(c['labId'],safe="~!*'()")
            message=re.fullmatch(r'(\d+) new samples? synced from Kobo \(.+\)',n.get('message') or '')
            if n.get('userId')==e['userId'] and n.get('link')==link and message and int(message[1])==e['count']:matches.append(k)
        require(matches,'Notification orphan/count/link differs');pending.pop(matches[0])
        require(n.get('type')=='SUCCESS' and n.get('title')=='\U0001f33e New Field Samples Collected' and not n.get('isRead') and all(n.get(k) is None for k in ['senderId','titleCode','titleParams','messageCode','messageParams']),'Notification outside exact intake fields')
    require(not pending,'Missing intake notification')
    return {'changedSamples':reports,'newSampleCount':counts,'newSubmissionIds':{i:sorted(v,key=int) for i,v in submissions.items()},'newSamplePairs':{i:[{'kobo_id':x,'depth':y} for x,y in sorted(v,key=lambda p:(int(p[0]),p[1]))] for i,v in pairs.items()},'newSampleDepthSplit':depths,'notificationExpectations':expected,'allAddedHoldAuditRowsExactlyConsumed':True}
