from pathlib import Path
import hashlib,json,subprocess
w=Path(__file__).resolve().parents[2];h=w/'WP/backlog-resume-20261013';k=w/'WP/batch-release-kit-be837974-20261016';e=h/'startup-policy-copy565-entry-1508-once'
out=e/'startup-policy-copy-context-source-review.json';assert not out.exists()
def sha(b):return hashlib.sha256(b).hexdigest()
def oid(b):return hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()
parent_path=h/'startup-a94-prefix565-entry-1451-once/startup-a94-already-applied-prefix-source-review.json'
parent_raw=parent_path.read_bytes();assert sha(parent_raw)=='2457ed3662f6e6c832f2dea92bf4505a23ebd0a55accda6332e35598c25ec526'
parent=json.loads(parent_raw);files=dict(parent['files'])
def pin(p):
 b=p.read_bytes();files[p.relative_to(w).as_posix()]={'bytes':len(b),'sha256':sha(b)};return b
pin(parent_path)
candidate_path=h/'candidate-startup565-entry-1440-once/candidate-default-startup-source-review.json';candidate=json.loads(candidate_path.read_bytes())
head='be8379745bdfae52ce46496ff26514dc7d729640'
selected=['docker-entrypoint.sh','server/index.js','server/scripts/install_lab_policy_schema.js','server/scripts/install_control_charts.js','server/scripts/install_order_revisions.js']
bindings=[];source_by_name={}
for name in selected:
 x=next(x for x in candidate['releaseSourceOriginals'] if x['sourcePath']==name)
 r=subprocess.run(['git','show',head+':'+name],cwd=w,capture_output=True)
 assert r.returncode==0 and r.stdout==(w/x['retainedSourceOriginal']).read_bytes() and len(r.stdout)==x['bytes'] and sha(r.stdout)==x['sha256'] and oid(r.stdout)==x['gitBlobOid']
 pin(w/x['retainedSourceOriginal']);bindings.append(x);source_by_name[name]=x
name='server/utils/startupReadinessContext.js';r=subprocess.run(['git','show',head+':'+name],cwd=w,capture_output=True)
(e/'release-context-git-show-stderr-original.txt').write_bytes(r.stderr)
(e/'release-context-git-show-exit-original.json').write_text(json.dumps({'argv':['git','show',head+':'+name],'exitCode':r.returncode})+'\n',encoding='utf8')
assert r.returncode==0
p=e/'release-startup-readiness-context-original.txt';p.write_bytes(r.stdout);pin(p)
x={'sourcePath':name,'releaseHead':head,'gitBlobOid':oid(r.stdout),'bytes':len(r.stdout),'sha256':sha(r.stdout),'retainedSourceOriginal':p.relative_to(w).as_posix()};bindings.append(x);source_by_name[name]=x
excerpts=[]
def excerpt(name,label,start,end):
 x=source_by_name[name];p=w/x['retainedSourceOriginal'];raw=p.read_bytes();lines=raw.splitlines(keepends=True)
 b=b''.join(lines[start-1:end]);offset=sum(map(len,lines[:start-1]))
 excerpts.append({'name':label,'sourcePath':name,'path':p.relative_to(w).as_posix(),'startLine':start,'endLine':end,'startByte':offset,'endByte':offset+len(b),'bytes':len(b),'sha256':sha(b),'text':b.decode('utf8')})
excerpt('server/utils/startupReadinessContext.js','COMPLETE startup context and facade / cache / release implementation',1,151)
excerpt('server/scripts/install_lab_policy_schema.js','COMPLETE three-file hash and retained snapshot review functions',79,104)
excerpt('server/scripts/install_lab_policy_schema.js','COMPLETE installLabPolicySchema and assertLabPolicyStartupReady',118,147)
excerpt('server/scripts/install_control_charts.js','COMPLETE chart installer and startup assertion',63,92)
excerpt('server/scripts/install_order_revisions.js','COMPLETE order installer and startup assertion',193,239)
excerpt('docker-entrypoint.sh','Actual separate default CLI processes and final server exec',195,203)
excerpt('server/index.js','Actual shared context construction',17,19)
excerpt('server/index.js','Actual selected policy / charts / order startup call sequence',93,104)
excerpt('server/index.js','Actual error and finally context-close sites',105,131)
policy=next(x for x in excerpts if x['name'].startswith('COMPLETE three-file'))['text']
assert "fs.mkdtempSync(path.join(os.tmpdir(), 'lims-policy-schema-readonly-'))" in policy
assert "for (const suffix of ['', '-wal', '-shm'])" in policy and 'fs.constants.COPYFILE_EXCL' in policy
assert policy.index('fs.mkdtempSync')<policy.index('fs.copyFileSync')<policy.index('openReadonlyDatabase')
context=excerpts[0]['text'];assert 'retainedSnapshots.clear()' in context and not any(t in context for t in ['unlinkSync(', 'rmSync(', 'rmdirSync('])
assert 'if (key === \'close\') return () => {};' in context and 'if (connection.inTransaction) connection.exec(\'ROLLBACK\')' in context
pin(k/'kit_budget.py');budget=(k/'kit_budget.py').read_text(encoding='utf8');assert "'startup-policy-chain':8" in budget
v=json.loads((k/'local-tests-checkpoint-originals565-first/verification.json').read_bytes())
assert v['exitCode']==0 and v['sourceBefore']==v['sourceAfter'] and len(v['sourceBefore'])==243
assert all(sha((k/name).read_bytes())==digest for name,digest in v['sourceBefore'].items() if name!='README.md')
families=[
 {'name':'Standalone default CLI copy chain','finding':'Selected literal shell calls run separate Node processes without a startupContext. Policy --apply always reviews a retained copy before PRESENT return. Chart --apply calls policy once before chart return. Order --apply calls policy on target, then chart assertion on that policy copy, and the chart assertion calls policy again on that copy. Selected explicit opportunities are 1+1+2=4; imports and other helper/provider effects remain outside this ledger.'},
 {'name':'Shared application context copy chain','finding':'Selected app policy/chart/order calls share one explicit context. Their direct policy-review opportunities are likewise 1+1+2=4. reviewPolicy can reuse the prior retained copy only under its source-hash and full triple-hash equality predicates; a miss calls full review again. No global one-copy guarantee follows from the context or completed NO_OP labels.'},
 {'name':'Conditional stable-cache illustration','finding':'If no earlier or nested excluded helper effects alter the context, source and triple hashes remain compatible, and all selected checks succeed, the first selected policy review can create one copy and the next three policy opportunities can be cache hits, including the nested copy path. This is conditional caller-source control flow, not an observed cache state or physical bound.'},
 {'name':'Exact selected explicit JS copy count scope','finding':'Under one non-reentrant execution of each selected shell/app call site and no extra imported/helper/callback producers, at most eight explicit review callbacks reach the one mkdir site. Each callback loops over the three present MAIN/WAL/SHM names once: at most 24 direct fs.copyFileSync invocations in this selected ledger, with per-callback zero-to-three calls on a failing prefix. These are JS invocation opportunities, not kernel copy calls, native pager writes, bytes, file extents, or whole-startup closure.'},
 {'name':'Retained prefix and lifetime','finding':'mkdtemp and COPYFILE_EXCL precede opening copied SQLite and classifying PRESENT. Errors after mkdir or partial copy leave that prefix. Old successful copies remain when reviewPolicy refreshes; clearing retainedSnapshots at close only clears a Set and does not delete directories. No failure/NO_OP/cache/close/deletion capacity credit and no cleanup authority are granted.'},
 {'name':'Hash binding versus held descriptor admission','finding':'Policy fileHashes serially reads pathname MAIN/WAL/SHM and compares content before/after copying/classification. It does not hold a descriptor tuple, check inode/device/link identity, reserve a namespace or capacity, establish native read transaction/other-writer exclusion, or close a check-copy race. Equal hashes do not independently bind private scientific bytes or same-byte inode replacement. Cache dataHashes intentionally excludes SHM; policy-copy equality separately uses all three.'},
 {'name':'Native copied reader and shared close frontier','finding':'Standalone copied reader uses readonly and fileMustExist without an accepted MEMORY policy; context.open constructs before BEGIN, facade close is a no-op and releaseReader later rolls back/closes. Constructor/schema/integrity/FK/TEMP/recovery/WAL-SHM/rollback/source-close/log/callback/termination producers require separate source-original and runtime evidence. A transaction wrapper or final returned NO_OP does not bound those effects or prove finalization/full lifetime.'},
 {'name':'Current charge is not copy-site qualification','finding':'Existing DB_COST startup-policy-chain=8 and candidate-startup table entry stay unchanged; this selected source catalogue supplies no measured sizes, full native/all-helper inventory, before-start held capacity, loaded image/source binding, filesystem allocation/metadata/log/overlay closure, or operational PASS. Main/WAL/index full extents and all concurrent retained copies need separately reviewed original-bound charges before use.'}
]
opportunities=[
 {'phase':'default shell standalone policy --apply','directPolicyReviewOpportunities':1,'context':'none'},
 {'phase':'default shell standalone charts --apply','directPolicyReviewOpportunities':1,'context':'none'},
 {'phase':'default shell standalone orders --apply / nested chart assertion','directPolicyReviewOpportunities':2,'context':'none'},
 {'phase':'app shared policy assertion','directPolicyReviewOpportunities':1,'context':'explicit shared context, cache predicates apply'},
 {'phase':'app shared charts assertion','directPolicyReviewOpportunities':1,'context':'explicit shared context, cache predicates apply'},
 {'phase':'app shared orders assertion / nested chart assertion','directPolicyReviewOpportunities':2,'context':'explicit shared context, cache predicates apply'}
]
record={'version':1,'scope':'SOURCE_DOCUMENTATION_ONLY_SELECTED_EXPLICIT_COPY_CHAIN_NOT_WHOLE_STARTUP_ADMISSION','priorHead':'482d17179299892096e2a8fd1ea4264eca143a8a','parentA94PrefixReview':{'path':parent_path.relative_to(w).as_posix(),'sha256':sha(parent_raw)},'files':files,'fullReleaseSourceOriginalBindings':bindings,'exactReleaseSourceExcerpts':excerpts,'selectedCallerOpportunityLedger':opportunities,'conditionalSelectedExplicitReviewOpportunities':8,'conditionalDirectJsCopyFileInvocationLimit':24,'conditions':'One non-reentrant invocation per selected default shell/app call site; selected successful or stop-first-error prefixes; no imported/helper/provider/reentrant extra producers. This is a source-only JS ledger, not an operational native/all-producer bound.','sourceFamilies':families,'conditionalSelectedExplicitSnapshotCallbackCatalogueRetained':True,'actualDefaultStartupOrCacheHitObserved':False,'wholeStartupCopyInventoryComplete':False,'nativeCopyOrPagerOrSyscallCountsMeasured':False,'fullSourceOriginalGeometryAndAllRetainedPayloadsBound':False,'descriptorOwnershipAndSnapshotLockExclusionVerified':False,'runtimeBinaryToSourceBuildBindingVerified':False,'actualDefaultVfsAndCallbacksVerified':False,'beforeDefaultStartupHeldAdmissionImplemented':False,'wholeReaderConstructorAndCloseLifetimeBounded':False,'physicalFilesystemClosureClaimed':False,'writerGraphAdmissionImplemented':False,'actualOwnerOrTestCodeChanged':False,'earlier565SuiteNotRerunOrRelabeled':True,'all242NonReadmeSourcesUnchangedSince565':True,'newTestRuns':0,'newSqlExecutions':0,'newFixtureFiles':0,'newPrivateInventoryGenerated':False,'oldPrivatePayloadsRead':False}
for name,pin_value in files.items():
 b=(w/name).read_bytes();assert {'bytes':len(b),'sha256':sha(b)}==pin_value
out.write_text(json.dumps(record,sort_keys=True,separators=(',',':'))+'\n',encoding='utf8')
print(json.dumps({'review':out.relative_to(w).as_posix(),'sha256':sha(out.read_bytes()),'fullSourcePins':len(files),'exactReleaseSourceExcerpts':len(excerpts),'fullReleaseOriginalBindings':len(bindings),'sourceFamilies':len(families),'selectedExplicitReviewOpportunities':8,'directJsCopyFileInvocationLimitConditional':24,'newSql':0,'newTestRuns':0,'allAuthorityFlagsFalse':True}))
