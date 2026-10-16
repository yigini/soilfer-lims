"""Validate complete closed public originals, without fetching private bytes or replaying SQL."""
import base64,datetime,hashlib,json,pathlib,re,sys
sys.dont_write_bytecode=True
W=pathlib.Path(__file__).resolve().parents[2];B=W/'WP/jobs-row-diagnostic-private-be837974-20261016';O=B/'second-diagnostic023000-readonly-originals-once';R=O/'public-originals';D=B/'closed-diagnostic023000-independent-validation-once'
assert not D.exists();sys.path.insert(0,str(B))
from diagnostic_contract import *
import prepare_diagnostic as prep
def j(p):return strict(p.read_bytes())
def h(v):return isinstance(v,str) and re.fullmatch('[0-9a-f]{64}',v) is not None
def ident(v):return isinstance(v,str) and re.fullmatch('[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}',v) is not None
o=j(O/'stdout-original.json');term=j(R/'public-terminal.json');result=j(R/'public-diagnostic-result.json');baseline=j(B/'baseline-logical-original.json');pins=j(B/'diagnostic-pins.json')['inputPins'];fetch=j(B/'first-fetch-original.json')
assert j(O/'exit-original.json')['exitCode']==0 and o['privateFileContentsFetched']==0 and o['productionSqlConnections']==0
inv={v['file']:v for v in o['inventory']};assert len(inv)==len(o['inventory'])==475
assert len({(v['device'],v['inode']) for v in inv.values()})==475
for n,v in inv.items():
 assert v['stableDuringHash'] and v['nlink']==1 and v['device']==64769 and h(v['sha256'])
 assert v['mode']==(0o600 if n in ['unit.stdout','unit.stderr'] else 0o400)
assert sum(v['allocatedBytes'] for v in inv.values())==o['rootAllocatedFileSumBytes']==8839168
assert all(not p.name.startswith('private-') for p in R.iterdir()) and not any(p.name.startswith('private-') for p in O.rglob('*') if p.is_file())
for n,v in o['publicFileBytesBase64'].items():
 b=base64.b64decode(v,validate=True);assert (R/n).read_bytes()==b and sha(b)==inv[n]['sha256'] and len(b)==inv[n]['bytes']
P=B/'package-workflow-batch-row-diagnostic-be837974-20261016T023000Z';index=j(P/'source-index.json');review=j(P/'source-review.json');approval(review,index);prep.published(index)
for p in P.iterdir():assert inv[p.name]['sha256']==sha(p.read_bytes()) and inv[p.name]['bytes']==p.stat().st_size
old=j(W/'WP/batch-proof-jobs-intake-be837974-20261016/exact-source-review323-once/tooling-source-index.json')
assert len(old['files'])==26
for n,pin in old['files'].items():assert sha((W/'WP/batch-proof-jobs-intake-be837974-20261016'/n).read_bytes())==pin['sha256']
od=j(W/'WP/jobs-row-diagnostic-be837974-20261016/exact-source-review80-git-aware-once/source-index.json')
for group in ['files','data']:
 for n,pin in od[group].items():assert sha((W/'WP/jobs-row-diagnostic-be837974-20261016'/n).read_bytes())==pin['sha256']
early=j(B/'first-diagnostic023000-readonly-originals-once/stdout-original.json')
for v in early['inventory']:
 if v['file'] not in ['unit.stdout','unit.stderr']:assert inv[v['file']]==v
assert set(term)=={'status','failure','releaseQualified','retryAllowed','rawValuesWithheld','privateFiles','files'}
assert term['status']=='DIAGNOSTIC_OBSERVED_CLASSIFIED_AWAITING_CLAUDIO_ACCEPTANCE' and term['failure'] is None and term['releaseQualified'] is False and term['retryAllowed'] is False and term['rawValuesWithheld'] is True
seen=set()
for v in term['files']:
 assert set(v)=={'file','bytes','sha256','withheld'} and v['file'] not in seen;seen.add(v['file']);a=inv[v['file']]
 assert v['bytes']==a['bytes'] and v['sha256']==a['sha256'] and v['withheld']==a['privateBytesWithheld']
assert len(seen)==456 and term['privateFiles']==[v for v in term['files'] if v['withheld']] and len(term['privateFiles'])==443
assert {v['file'] for v in term['privateFiles']}=={n for n in inv if n.startswith('private-')}
assert inv['private-value-hmac-key.json']['bytes']==120 and len([n for n in inv if n.startswith('private-row-')])==442
sink_bytes=sum(v['bytes'] for v in term['files'])+inv['public-terminal.json']['bytes'];assert sink_bytes==4204211 and sink_bytes<=MAX_OUTPUT
assert {'controller-memory-before.json','controller-memory-after.json'}<=seen
before=j(R/'input-before.json');after=j(R/'input-after.json');assert before==after and set(before)==set(pins) and len(before)==6
assert len({(v['device'],v['inode']) for v in before.values()})==6
for n,pin in pins.items():
 assert pin['path']==n and before[n]['nlink']==1 and before[n]['ctimeNs']>0
 for k,v in pin.items():
  if k!='path':assert before[n][k]==v
for label in ['before','after']:
 m=j(R/('controller-memory-'+label+'.json'));assert m['membership']=='0::/system.slice/'+UNIT+'.service\n' and m['path']=='/sys/fs/cgroup/system.slice/'+UNIT+'.service'
 assert set(m['raw'])=={'memory.events','memory.max','memory.swap.max','memory.peak'}
 fields={}
 for line in m['raw']['memory.events'].splitlines():
  k,v=line.split();assert k not in fields and v.isdigit();fields[k]=int(v)
 assert fields['oom']==fields['oom_kill']==0 and m['raw']['memory.max'].strip()==str(MEMORY) and m['raw']['memory.swap.max'].strip()=='0'
 assert int(m['raw']['memory.peak'])<=MEMORY
for i in range(2):
 extent=j(R/('main-'+str(i)+'-extent.json'));quick=j(R/('main-'+str(i)+'-quick-check.json'));header=j(R/('main-'+str(i)+'-header.json'))
 assert extent['pageCount']*extent['pageSize']==extent['pageBytes']==563322880 and quick['okCount']==quick['resultCount']==1 and h(quick['resultsSha256']) and header=={'header18':2,'header19':2}
assert len(j(R/'main-integrity-before-tables.json'))==2
assert set(result)=={'status','releaseQualified','schemaBeforeSha256','schemaAfterSha256','tableCount','tables','rows','changedSamples','stopClassifications','step2Authorized','rawValuesWithheld','inputAfterVerifiedCount','resultValidCount'}
assert result['status']==term['status'] and result['releaseQualified'] is False and result['step2Authorized'] is False and result['rawValuesWithheld'] is True and result['inputAfterVerifiedCount']==result['resultValidCount']==1 and result['stopClassifications']==[]
assert h(result['schemaBeforeSha256']) and result['schemaBeforeSha256']==result['schemaAfterSha256']
assert set(result['tables'])==set(result['rows'])==set(baseline['tables']) and result['tableCount']==len(result['tables'])==112
counts={};rowids={};diff_total=0
for name,summary in result['tables'].items():
 assert set(summary)=={'beforeCount','afterCount','beforeSha256','afterSha256','changedCount','deletedCount','addedCount'}
 assert all(type(summary[k]) is int and summary[k]>=0 for k in ['beforeCount','afterCount','changedCount','deletedCount','addedCount'])
 assert summary['beforeCount']==baseline['tables'][name]['count'] and summary['afterCount']==summary['beforeCount']-summary['deletedCount']+summary['addedCount'] and h(summary['beforeSha256']) and h(summary['afterSha256'])
 rows=result['rows'][name];actual={k:sum(r['classification']==v for r in rows) for k,v in [('changedCount','CHANGED'),('addedCount','ADDED'),('deletedCount','DELETED')]}
 assert all(summary[k]==v for k,v in actual.items()) and actual['deletedCount']==0
 rowids[name]={}
 for r in rows:
  assert set(r)=={'id','columns','classification','beforeSha256','afterSha256'} and ident(r['id']) and r['id'] not in rowids[name];rowids[name][r['id']]=r
  assert r['classification'] in ['CHANGED','ADDED'] and len(set(r['columns']))==len(r['columns']) and set(r['columns'])<=set(baseline['tables'][name]['columns']) and h(r['afterSha256'])
  assert r['beforeSha256'] is None if r['classification']=='ADDED' else h(r['beforeSha256']) and r['beforeSha256']!=r['afterSha256']
  if r['classification']=='ADDED':assert r['columns']==baseline['tables'][name]['columns']
 diff_total+=len(rows)
 if rows:counts[name]={k:summary[k] for k in ['beforeCount','afterCount','changedCount','addedCount','deletedCount']}
 else:assert summary['beforeSha256']==summary['afterSha256']
assert diff_total==442 and set(counts)=={'Sample','AuditLog','SampleHold','Notification','KoboConfig'}
assert {n:(c['changedCount'],c['addedCount']) for n,c in counts.items()}=={'Sample':(20,174),'AuditLog':(0,218),'SampleHold':(0,22),'Notification':(0,1),'KoboConfig':(7,0)}
receipt=result['tables']['_schema_migrations'];assert receipt['beforeCount']==receipt['afterCount']==42 and receipt['beforeSha256']==receipt['afterSha256']
for r in result['rows']['KoboConfig']:assert r['id'] not in REFUSALS and set(r['columns'])<={'lastSyncAt','lastSubmissionId','updatedAt'}
changed={r['id']:r for r in result['rows']['Sample'] if r['classification']=='CHANGED'};sample_ids=set();pair_hold_ids=set();pair_audit_ids=set();summary_samples=[]
for s in result['changedSamples']:
 assert set(s)=={'id','columns','beforeSha256','afterSha256','classification','statusBeforeSha256','statusAfterSha256','labIdSha256','projectIdSha256','statusBeforeExpectedCount','statusAfterExpectedCount','rejectionBeforeEmptyCount','rejectionAfterExactCount','metadataDiff','fieldMetadataDiff','configIds','conflictSubmissionIds','appendedCount','pairing','oldValuesOutsideWriterRetainedCount'}
 assert s['id'] in changed and s['id'] not in sample_ids;sample_ids.add(s['id']);r=changed[s['id']]
 assert s['classification']=='CROSS_SUBMISSION_DUPLICATE' and s['columns']==r['columns']==['metadata','rejectionReason','updatedAt'] and s['beforeSha256']==r['beforeSha256'] and s['afterSha256']==r['afterSha256']
 for k,v in s.items():
  if k.endswith('Sha256'):assert h(v)
 assert s['statusBeforeSha256']==s['statusAfterSha256']
 assert all(s[k]==1 for k in ['statusBeforeExpectedCount','statusAfterExpectedCount','rejectionBeforeEmptyCount','rejectionAfterExactCount','appendedCount','oldValuesOutsideWriterRetainedCount'])
 assert s['fieldMetadataDiff']=={'arrays':[],'changes':[],'everyOldValueRetained':True}
 m=s['metadataDiff'];assert set(m)=={'arrays','changes','everyOldValueRetained'} and m['arrays']==[] and m['everyOldValueRetained'] is True and len(m['changes'])==2
 assert {x['path'] for x in m['changes']}=={'$.conflictingSubmissions','$.provenanceHold'}
 for x in m['changes']:assert set(x)=={'path','classification','beforeSha256','afterSha256'} and x['classification']=='ADDED' and h(x['beforeSha256']) and h(x['afterSha256'])
 assert len(s['configIds'])==1 and ident(s['configIds'][0]) and s['configIds'][0] not in REFUSALS and len(s['conflictSubmissionIds'])==1 and s['conflictSubmissionIds'][0].isdigit()
 assert s['conflictSubmissionIds'][0] in set(map(str,fetch[s['configIds'][0]]['submissionIds']))
 pair=s['pairing'];assert set(pair)=={'holdIds','conflictAuditIds','holdAuditIds','holdCount','conflictAuditCount','holdAuditCount','classification'} and pair['classification']=='EXACT_PROVENANCE_PAIRS'
 for count,ids,table in [('holdCount','holdIds','SampleHold'),('conflictAuditCount','conflictAuditIds','AuditLog'),('holdAuditCount','holdAuditIds','AuditLog')]:
  assert pair[count]==len(pair[ids])==1 and all(x in rowids[table] and rowids[table][x]['classification']=='ADDED' for x in pair[ids])
  used=pair_hold_ids if table=='SampleHold' else pair_audit_ids
  assert not used.intersection(pair[ids]);used.update(pair[ids])
 summary_samples.append({k:s[k] for k in ['id','columns','classification','configIds','conflictSubmissionIds','appendedCount','pairing','oldValuesOutsideWriterRetainedCount']})
assert sample_ids==set(changed) and len(sample_ids)==20 and len(pair_hold_ids)==20 and len(pair_audit_ids)==40
assert not (R/'unit.stderr').read_bytes() and j(R/'unit.stdout')=={'privateFileCount':443,'releaseQualified':False,'status':term['status']}
status=dict(line.split('=',1) for line in (O/'systemctl-stdout-original').read_text().splitlines() if '=' in line);assert status['ActiveState']=='inactive' and status['SubState']=='dead' and status['MainPID']=='0' and status['LoadState']=='not-found'
journal=[strict(z) for z in (O/'journal-stdout-original').read_bytes().splitlines()];assert len(journal)==4 and all(v.get('INVOCATION_ID')=='9026c0ad2c4849e3ac5f2595aeaeec77' and v.get('_PID')=='1' for v in journal)
assert 'Starting ' in journal[0]['MESSAGE'] and 'Started ' in journal[1]['MESSAGE'] and 'Deactivated successfully' in journal[2]['MESSAGE'] and 'Consumed ' in journal[3]['MESSAGE']
started=datetime.datetime.fromtimestamp(int(journal[1]['__REALTIME_TIMESTAMP'])/1000000,datetime.timezone.utc);closed=datetime.datetime.fromtimestamp(int(journal[2]['__REALTIME_TIMESTAMP'])/1000000,datetime.timezone.utc)
record={'status':'CLOSED_PRIVATE_DIAGNOSTIC_PUBLIC_EVIDENCE_VALIDATED_AWAITING_CLAUDIO_ACCEPTANCE','validatedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceReviewId':review['id'],'sourceHead':index['head'],'root':str(ROOT),'unit':UNIT,'invocationId':'9026c0ad2c4849e3ac5f2595aeaeec77','actualStartedUtc':started.isoformat(),'actualClosedUtc':closed.isoformat(),'elapsedStartedToDeactivationSeconds':(closed-started).total_seconds(),'terminalSha256':inv['public-terminal.json']['sha256'],'resultSha256':inv['public-diagnostic-result.json']['sha256'],'tableCount':112,'schemaReceiptCount':42,'changedTables':counts,'changedOriginalSampleCount':20,'changedOriginalSampleClassification':'CROSS_SUBMISSION_DUPLICATE','allChangedSampleColumns':['metadata','rejectionReason','updatedAt'],'allChangedSampleStatusExpectedAndOldValuesRetained':True,'existingSampleExactHoldPairs':20,'existingSampleExactAuditPairs':40,'allDiffRows':442,'privateRowFilesHostOnly':442,'privateHmacKeyFileHostOnly':True,'privateFileContentsFetched':0,'allSixInputBeforeAfterShaStatCtimeNlinkEqual':True,'all475RootFilesStableHashStatAnd15PackageUnchanged':True,'sharedSinkBytesIncludingTerminal':sink_bytes,'sharedSinkCapBytes':MAX_OUTPUT,'bothControllerMemoryRecordsInSinkAndTerminal':True,'controllerOomAndOomKillBeforeAfter':0,'controllerMemoryPeakAfterBytes':int(j(R/'controller-memory-after.json')['raw']['memory.peak']),'controllerMemoryEventsMaxAfter':6859,'peakAndMaxAreObservationsOnly':True,'rootAllocatedFileSumBytes':8839168,'freeBytesAtClosedObservation':o['freeBytes'],'wholeStoreGrowthAccountingClaimed':False,'all8Source3Data1333App26OldSourcesOld8Source3DataUnchanged':True,'privacyReview':'Complete public result shape, every row, all20 classifiers and metadata diffs inspected; public content limited to IDs/columns/keypaths/counts/classifications/HMACs and approved whole-file/table hashes; no private bytes fetched. HMACs and raw row predicates were computed by unchanged reviewed runtime; not recomputed with the withheld key or by replaying SQL.','stopClassifications':[],'releaseQualified':False,'step2Authorized':False,'retryAllowed':False}
D.mkdir()
for name,value in [('closed-independent-result.json',record),('changed-original-sample-summary.json',summary_samples),('private-host-retention-manifest.json',[v for v in o['inventory'] if v['privateBytesWithheld']])]:
 with (D/name).open('xb') as f:f.write(canonical(value)+b'\n')
print(json.dumps(record))
