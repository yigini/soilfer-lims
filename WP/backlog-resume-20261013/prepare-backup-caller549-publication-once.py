from pathlib import Path
import ast,json
w=Path(__file__).resolve().parents[2];h=w/'WP/backlog-resume-20261013';target=h/'publish-kit-backup-caller549-once.py';assert not target.exists()
s=(h/'publish-kit-backup-binding547-delta-successor-once.py').read_text(encoding='utf8')
def once(a,b):
 global s
 assert s.count(a)==1,(a,s.count(a));s=s.replace(a,b)
once("with_name('backup-binding547-delta-successor-publication-notes-once.txt')","with_name('backup-caller549-publication-notes-once.txt')")
once("D=K/'backup-binding547-delta-successor-publication-once'","D=K/'backup-caller549-publication-once'")
once("=='acc235f7275046062a7b23d95439cc12aa55490c'","=='d5233af14d0969b5d2a5f9ccbed7273a51586300'")
once("runs=['backup-binding547-first']","runs=['backup-caller549-first']")
once("zip(runs,[0],[547],[237],['OK'])","zip(runs,[0],[549],[237],['OK'])")
once('assert len(prior_names)==47',"prior_names.append('backup-binding547-delta-successor-publication-once/new-local-fixtures-hash-inventory.json')\nassert len(prior_names)==48")
once('backup_binding_cases={}','backup_binding_cases={};backup_caller_cases={}')
once("import sys\nsys.path.insert(0,str(K))", """   if relative.startswith('backup-caller-local-retained-fixtures/') and path.name in ('program-original.cjs','argv-original.json','stdout-original.json','stderr-original.txt','exit-original.json'):
    case=backup_caller_cases.setdefault(path.parent.relative_to(K).as_posix(),{})
    case[path.name]={'path':relative,'bytes':len(raw),'sha256':sha(raw),'value':json.loads(raw) if path.name.endswith('.json') and raw.strip() else None}
import sys
sys.path.insert(0,str(K))""")
once("save(D,'new-local-fixtures-hash-inventory.json'", """caller_rows=[];scripted_transcripts=0;foreign_lock_cases=0
for folder,case in sorted(backup_caller_cases.items()):
 assert case['exit-original.json']['value']['exitCode']==0 and case['stderr-original.txt']['bytes']==0
 out=case['stdout-original.json'];value=out['value'];kind=value['kind']
 if kind=='SCRIPTED_ACTUAL_JS_METHOD_BOUNDARY':
  assert not value['nativeSqliteReturnCodesMeasured'] and not value['actualOwnerNoBusyOrRestartProfileVerified'] and len(value['observations'])==4
  names={r['name'] for r in value['observations']};assert names=={'initial-zero','repeated-progress','increasing-remaining','callback-refusal'}
  for row in value['observations']:
   assert row['closed']==1 and row['scriptedBoundaryOnly'] and not row['progressObjectsContainNativeStatus']
   if row['name']=='initial-zero':assert row['callbacks']==0 and row['result']=={'totalPages':0,'remainingPages':0}
   if row['name']=='callback-refusal':assert row['error']=='SYNTHETIC_CALLBACK_REFUSAL' and row['result'] is None
  scripted_transcripts+=len(value['observations'])
 elif kind=='NEW_LOCAL_FOREIGN_DESTINATION_LOCK_DIAGNOSTIC':
  assert not value['nativeSourceProfilePass'] and not value['releaseOrCapacityPass'] and {r['pageSize'] for r in value['observations']}=={512,4096,65536}
  for row in value['observations']:
   assert row['nativeMethodProgress']==row['wrapperProgress']=={'totalPages':0,'remainingPages':0} and row['ownedRefusal']=='Exact pinned backup length required'
   assert row['retainedDestinationBytes']==0 and row['sourceMainShaUnchanged'] and row['consumedDestinationRefusedBeforeNewSourceOpen']
   assert row['foreignDestinationWriterIntentionallyIntroduced'] and not row['strictNoOtherUsersProfileApplicable'] and not row['nativeSqliteReturnCodeMeasured'] and row['nativeBusyBranchSourceDerived']
  foreign_lock_cases+=len(value['observations'])
 else:raise AssertionError('Unreviewed NEW caller fixture kind')
 assert not value['physicalFilesystemClosureClaimed']
 caller_rows.append({'folder':folder,'kind':kind,'stdoutOriginal':original_pin(out),'programOriginal':original_pin(case['program-original.cjs']),'argvOriginal':original_pin(case['argv-original.json']),'exitOriginal':original_pin(case['exit-original.json']),
  'parameterObservations':value['observations'],'nativeSqliteReturnCodesMeasured':False,'actualOwnerStrictNoBusyOrRestartProfileVerified':False,'physicalFilesystemClosureClaimed':False})
assert len(caller_rows)==2*len(runs) and scripted_transcripts==4*len(runs) and foreign_lock_cases==3*len(runs)
source_review_path=W/'WP/backlog-resume-20261013/backup-caller547-entry-1254-once/caller-source-profile-review.json';source_review_raw=source_review_path.read_bytes();source_review=json.loads(source_review_raw)
assert source_review['scope']=='ACTUAL_BACKUP_CALLER_SOURCE_PROFILE_COMPATIBILITY_REVIEW_ONLY' and len(source_review['files'])==98
for name,pin in source_review['files'].items():
 raw=(W/name).read_bytes();assert {'bytes':len(raw),'sha256':sha(raw)}==pin
for part in source_review['completeCallerExcerpts']:
 raw=(W/part['path']).read_bytes()[part['startByte']:part['endByte']];assert raw.decode()==part['text'] and sha(raw)==part['sha256']
save(D,'new-local-backup-caller-boundary-summary.json',canonical({'newLocalNodeCommandExecutions':len(caller_rows),'scriptedActualJsBoundaryTranscripts':scripted_transcripts,'actualForeignDestinationLockParameterCases':foreign_lock_cases,
 'sourceReviewOriginal':{'path':source_review_path.relative_to(W).as_posix(),'bytes':len(source_review_raw),'sha256':sha(source_review_raw)},'cases':caller_rows,'sourceBytesReadOnlyFromNewFixtureDelta':True,
 'nativeSqliteReturnCodesMeasured':False,'actualOwnerStrictNoBusyOrRestartProfileVerified':False,'actualOwnerCombinedAdmissionIntegrated':False,'releaseOrCapacityPass':False,'physicalFilesystemClosureClaimed':False})+b'\\n')
save(D,'new-local-fixtures-hash-inventory.json'""")
once("prior_external=K/'backup-main540-paired-count-successor-publication-once/new-external-runtime-hash-inventory.json'","prior_external=K/'backup-binding547-delta-successor-publication-once/new-external-runtime-hash-inventory.json'")
once("'tests':547,'uniqueTests':547,'sourceFiles':237,","'tests':549,'uniqueTests':549,'sourceFiles':237,'actualBackupCallerSourceCompatibilityReviewImplemented':True,'backupCallerSourceReviewSha256':sha(source_review_raw),'newCallerLocalCommands':len(caller_rows),'scriptedActualJsBoundaryTranscripts':scripted_transcripts,'foreignDestinationLockParameterCases':foreign_lock_cases,'actualOwnerStrictNoBusyOrRestartProfileVerified':False,")
once("'actualAutomaticWakeObservedUtc':'2026-10-17T12:36:17.279Z'","'actualAutomaticWakeObservedUtc':'2026-10-17T12:54:17.438Z'")
once("'exploratoryMissingGuessedMetadataFilenameTranscribedOnly':True","'exploratoryMissingGuessedMetadataFilenameTranscribedOnly':False")
start=s.index("extras|={p for p in (W/'WP/backlog-resume-20261013/backup-binding540-entry-1236-once')")
end=s.index('extras.add(pathlib.Path(__file__).resolve())',start)
s=s[:start]+"""extras|={p for p in (W/'WP/backlog-resume-20261013/backup-caller547-entry-1254-once').iterdir() if p.is_file()}
for name in ('prepare-backup-caller547-entry-once.py','prepare-backup-caller-source-review-once.py','prepare-backup-caller549-publication-once.py','backup-caller549-publication-notes-once.txt'):
 extras.add(W/'WP/backlog-resume-20261013'/name)
"""+s[end:]
once("'feat(release): bind future backup snapshot and logical charges'","'test(release): audit backup caller status and profile gaps'")
ast.parse(s)
# New selector is a sibling of other prefix branches, never nested under one.
lines=s.splitlines();branch=next(x for x in lines if "if relative.startswith('backup-caller-local-retained-fixtures/')" in x);assert len(branch)-len(branch.lstrip())==3
notes=(h/'backup-caller549-publication-notes-once.txt').read_text(encoding='utf8');notes.format(when='PENDING',summary='PENDING',started='PENDING',closed='PENDING')
target.open('x',encoding='utf8',newline='').write(s)
record={'publisherPrepared':str(target),'executed':False,'expectedUniqueTests':549,'expectedSourceFiles':237,'priorInventoriesLoadedBeforePayloadRead':48,'newLocalFeatureCommands':2,'scriptedTranscripts':4,'foreignLockCases':3,'newSelectorSiblingIndentationChecked':True,'actualOperationalSourcesChanged':False,'oldPrivatePayloadsRead':False}
(h/'backup-caller547-entry-1254-once/publication-preparation-record.json').open('x',encoding='utf8').write(json.dumps(record,sort_keys=True)+'\n');print(json.dumps(record))
