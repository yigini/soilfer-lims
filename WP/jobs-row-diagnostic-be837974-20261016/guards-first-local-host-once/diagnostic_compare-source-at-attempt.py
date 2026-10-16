"""Streaming full-store diff and conservative code-bound provenance diagnosis.

This reports observed changes. It does not authorize a preservation exception,
produce a release PASS, repair data, or draft the Step 2 proof.
"""
import datetime,hashlib,json,re
from urllib.parse import quote
from diagnostic_contract import *
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
    expected.update({'status':'ACTIVE','reason':reason,'primaryOccurrence':po,'conflictingCount':len(new_meta['conflictingSubmissions']),'updatedAt':new.get('updatedAt')})
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
        keys=[e['occurrenceKey'] for e in b['conflictingSubmissions']];require(len(keys)==len(set(keys)),'Reappended occurrence key')
        scopes=[scope_entry(before,e,configs,fetch) for e in appended]
        reason=marker_expected(a,b,primary)
        expected_field=dict(fa)
        if 'provenanceHold' in fa:
            require(isinstance(fa['provenanceHold'],dict),'Field hold mirror malformed');expected_field['provenanceHold']={**fa['provenanceHold'],'value':'ACTIVE'}
        require(fb==expected_field,'Field metadata changed outside exact mirror writer')
        pairing=paired(before['id'],before,holds,audits,len(appended),reason)
        public.update({'classification':'PRIMARY_REVISION' if primary else 'CROSS_SUBMISSION_DUPLICATE','configIds':sorted(set(scopes)),'conflictSubmissionIds':[str(e['kobo_id']) for e in appended],'appendedCount':len(appended),'pairing':pairing,'oldValuesOutsideWriterRetainedCount':1})
    except (ValueError,TypeError,KeyError,RuntimeError) as e:
        # Error messages are static classifications; NEVER include raw values.
        public['refusalClassSha256']=value_hash(type(e).__name__+':'+str(e));public['classification']='UNEXPLAINED'
    return public
def compare_all(old,new,fetch,baseline,sink,expected_tables=112):
    old_tables=tables(old);new_tables=tables(new);reasons=[]
    schema_old=schema(old);schema_new=schema(new)
    if old_tables!=new_tables or len(old_tables)!=expected_tables or schema_old!=schema_new:reasons.append('SCHEMA_OR_TABLE_INVENTORY_CHANGED')
    summaries={};diffs={};changed_samples=[];additions={k:[] for k in APPEND};configs={}
    for t in sorted(set(old_tables)|set(new_tables)):
        if t not in old_tables or t not in new_tables:
            summaries[t]={'classification':'MISSING_OR_ADDED_TABLE'};continue
        a=layout(old,t);b=layout(new,t)
        if a!=b:reasons.append('TABLE_LAYOUT_CHANGED');summaries[t]={'classification':'LAYOUT_CHANGED'};continue
        cols=[r[1] for r in a if r[6]==0];keys=[r[1] for r in sorted(a,key=lambda r:r[5]) if r[5]>0]
        if not keys:
            keys=['__diagnostic_rowid'];selection='rowid AS __diagnostic_rowid,'+','.join(map(quoted,cols));sort='rowid'
        else:selection=','.join(map(quoted,cols));sort=','.join(map(quoted,keys))
        query='SELECT '+selection+' FROM '+quoted(t)+' ORDER BY '+sort
        aa=iter(old.execute(query));bb=iter(new.execute(query));x=next(aa,None);y=next(bb,None)
        bh=hashlib.sha256();ah=hashlib.sha256();bc=ac=0;records=[]
        def rawrow(r):return {k:r[k] for k in cols}
        def put(kind,one,two):
            require(sum(len(v) for v in diffs.values())+len(records)<MAX_DIFF_ROWS,'Changed-row bound')
            r=one if one is not None else two;pub={**identity(r,keys),'classification':kind,'columns':[k for k in cols if one is None or two is None or one[k]!=two[k]],'beforeSha256':value_hash(rawrow(one)) if one else None,'afterSha256':value_hash(rawrow(two)) if two else None}
            records.append(pub)
            sink.write('private-row-'+str(sum(len(v) for v in diffs.values())+len(records)).zfill(6)+'.json',{'table':t,'classification':kind,'before':rawrow(one) if one else None,'after':rawrow(two) if two else None})
            if kind=='DELETED':reasons.append('DELETED_ORIGINAL')
            if t not in APPEND|{'KoboConfig'}:reasons.append('PROTECTED_NON_INTAKE_TABLE_CHANGED')
            elif kind=='CHANGED' and t!='Sample' and t!='KoboConfig':reasons.append('PROTECTED_ORIGINAL_INTAKE_ROW_CHANGED')
            if t=='Sample' and kind=='CHANGED':changed_samples.append((rawrow(one),rawrow(two)))
            if t in APPEND and kind=='ADDED':additions[t].append(rawrow(two))
            if t=='KoboConfig':
                if kind!='CHANGED' or one['id'] in REFUSALS or one['isActive']!=1 or not one['projectCode'] or not set(pub['columns'])<={'lastSubmissionId','lastSyncAt','updatedAt'}:reasons.append('UNEXPLAINED_CONFIG_CHANGE')
                else:
                    for k in pub['columns']:
                        if k=='lastSubmissionId':
                            ov=str(one[k] or '0');nv=str(two[k] or '')
                            if not (ov.isdigit() and nv.isdigit() and int(nv)>int(ov) and nv in {str(i) for i in fetch.get(one['id'],{}).get('submissionIds',[])}):reasons.append('UNEXPLAINED_CONFIG_CURSOR')
                        elif not monotonic(one[k],two[k]):reasons.append('UNEXPLAINED_CONFIG_CLOCK')
        while x is not None or y is not None:
            if x is not None and (y is None or key_of(x,keys)<key_of(y,keys)):
                bh.update(encoded([x[k] for k in cols])+b'\n');bc+=1;put('DELETED',x,None);x=next(aa,None)
            elif y is not None and (x is None or key_of(y,keys)<key_of(x,keys)):
                ah.update(encoded([y[k] for k in cols])+b'\n');ac+=1;put('ADDED',None,y);y=next(bb,None)
            else:
                bh.update(encoded([x[k] for k in cols])+b'\n');ah.update(encoded([y[k] for k in cols])+b'\n');bc+=1;ac+=1
                if t=='KoboConfig':configs[x['id']]=rawrow(x)
                if any(x[k]!=y[k] for k in cols):put('CHANGED',x,y)
                x=next(aa,None);y=next(bb,None)
        diffs[t]=records;summaries[t]={'beforeCount':bc,'afterCount':ac,'beforeSha256':bh.hexdigest(),'afterSha256':ah.hexdigest(),'changedCount':sum(r['classification']=='CHANGED' for r in records),'deletedCount':sum(r['classification']=='DELETED' for r in records),'addedCount':sum(r['classification']=='ADDED' for r in records)}
        if t in baseline.get('tables',{}) and bc!=baseline['tables'][t]['count']:reasons.append('BASELINE_RECORDED_COUNT_MISMATCH')
    require(len(summaries)<=expected_tables+10,'Schema inventory bound')
    receipt=summaries.get('_schema_migrations',{})
    if receipt.get('beforeCount')!=42 or receipt.get('afterCount')!=42 or receipt.get('beforeSha256')!=receipt.get('afterSha256'):reasons.append('SCHEMA_RECEIPTS_CHANGED')
    sample_reports=[classify_sample(a,b,configs,fetch,additions['SampleHold'],additions['AuditLog']) for a,b in changed_samples]
    if any(r['classification']=='UNEXPLAINED' for r in sample_reports):reasons.append('UNEXPLAINED_OR_PROTECTED_SAMPLE_CHANGE')
    # All additions are also checked, including holds and audits unrelated to
    # the first changed Sample. The entire 112-table diff precedes refusal.
    known_sample_ids={s['id'] for s in additions['Sample']}|{a['id'] for a,b in changed_samples}
    known_hold_ids={h['id'] for h in additions['SampleHold']}
    for h in additions['SampleHold']:
        if h.get('sampleId') not in known_sample_ids or h.get('type')!='PROVENANCE' or h.get('raisedBy')!='system:kobo-sync' or h.get('compatMarker')!='KOBO_PROVENANCE' or h.get('attributionSource')!='LIVE' or any(h.get(k) is not None for k in ['resolvedAt','resolvedBy','resolution']):reasons.append('UNEXPLAINED_ADDED_HOLD')
    for a in additions['AuditLog']:
        if a.get('entity')=='SAMPLE_HOLD':ok=a.get('entityId') in known_hold_ids and a.get('action')=='HOLD_RAISED' and a.get('performedBy')=='system:kobo-sync'
        else:ok=a.get('entity')=='SAMPLE' and a.get('entityId') in known_sample_ids and a.get('action') in ('CREATE_KOBO_SYNC','KOBO_INTRA_SUBMISSION_DUPLICATE','KOBO_CONFLICTING_PROVENANCE') and a.get('performedBy')=='KOBO_SCHEDULER'
        if not ok:reasons.append('UNEXPLAINED_ADDED_AUDIT')
    new_scopes={};sample_pairs=set()
    for s in additions['Sample']:
        try:
            m=object_json(s.get('metadata'));config_id=scope_entry(s,m,configs,fetch,conflict=False);new_scopes[s['id']]=config_id
            pair=(config_id,str(m.get('kobo_id')),m.get('depth'));require(pair not in sample_pairs,'Duplicate added submission/depth');sample_pairs.add(pair)
            require(s.get('status')=='EXPECTED' and s.get('labId') is None and all(s.get(k) is None for k in ['acceptedBy','acceptedAt','approvedBy','approvedAt','receivedBy','receptionDate']),'Added Sample invented lifecycle authority')
            creates=[a for a in additions['AuditLog'] if a.get('entity')=='SAMPLE' and a.get('entityId')==s['id'] and a.get('action')=='CREATE_KOBO_SYNC']
            require(len(creates)==1 and creates[0].get('sampleId')==s['id'] and creates[0].get('labId')==s.get('assignedLab'),'Added Sample creation audit mismatch')
        except (ValueError,RuntimeError,KeyError,TypeError):reasons.append('UNEXPLAINED_ADDED_SAMPLE')
    for h in additions['SampleHold']:
        try:
            aa=[a for a in additions['AuditLog'] if a.get('entity')=='SAMPLE_HOLD' and a.get('entityId')==h['id']]
            require(len(aa)==1,'Unpaired added hold');a=aa[0];bound=object_json(a.get('after'))
            require(set(bound)==set(h) and all(bound[k]==h[k] for k in h if k!='raisedAt') and same_instant(bound['raisedAt'],h['raisedAt']),'Added hold audit payload mismatch')
            require(a.get('sampleId')==h.get('sampleId') and same_instant(a.get('timestamp'),h.get('raisedAt')),'Added hold audit scope/time mismatch')
        except (ValueError,RuntimeError,KeyError,TypeError):reasons.append('UNEXPLAINED_ADDED_HOLD_PAIR')
    managers={r['id']:r['labId'] for r in old.execute("SELECT id,labId FROM User WHERE isActive=1 AND role='LAB_MANAGER'")} if 'User' in old_tables else {}
    for n in additions['Notification']:
        try:
            lab=managers.get(n.get('userId'));matches=[]
            for i in set(new_scopes.values()):
                config=configs[i];count=sum(x==i for x in new_scopes.values())
                link='/samples?view=expected&projects='+quote(config['projectCode'],safe="~!*'()")+'&labs='+quote(config['labId'],safe="~!*'()")
                if lab==config['labId'] and n.get('link')==link:matches.append((i,count))
            message=re.fullmatch(r'(\d+) new samples? synced from Kobo \(.+\)',n.get('message') or '')
            require(len(matches)==1 and message is not None and int(message[1])==matches[0][1] and n.get('type')=='SUCCESS' and n.get('title')=='\U0001f33e New Field Samples Collected' and not n.get('isRead') and all(n.get(k) is None for k in ['senderId','titleCode','titleParams','messageCode','messageParams']),'Added notification outside exact Kobo intake')
        except (ValueError,RuntimeError,KeyError,TypeError):reasons.append('UNEXPLAINED_ADDED_NOTIFICATION')
    public={'status':'DIAGNOSTIC_STOP_REPORT_NO_REMEDY' if reasons else 'DIAGNOSTIC_OBSERVED_CLASSIFIED_AWAITING_CLAUDIO_ACCEPTANCE','releaseQualified':False,'schemaBeforeSha256':value_hash(schema_old),'schemaAfterSha256':value_hash(schema_new),'tableCount':len(summaries),'tables':summaries,'rows':diffs,'changedSamples':sample_reports,'stopClassifications':sorted(set(reasons)),'step2Authorized':False,'rawValuesWithheld':True}
    return public
