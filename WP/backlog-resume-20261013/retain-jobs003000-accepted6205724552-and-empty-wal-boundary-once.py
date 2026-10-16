"""Retain actual result acceptance and a concrete metadata-only diagnostic scope boundary."""
import datetime,hashlib,json,pathlib,subprocess,sys
R=pathlib.Path(__file__).resolve().parents[2];S=R/'WP/batch-proof-jobs-intake-be837974-20261016';D=S/'actual-result-accepted6205724552-empty-wal-boundary-once';BASE='27055babfc6dfe482cbd88ef412c846c31ed6ff0';BRANCH='audit/release-eb6de2e8'
sys.path.insert(0,str(S));from proof_contract import canonical,sha,approval,FILES,CANDIDATE
import prepare_proof as prep
def git(*a,payload=None):return subprocess.check_output(['git','-c','core.longpaths=true',*a],cwd=R,input=payload)
assert git('rev-parse','HEAD').decode().strip()==BASE and git('branch','--show-current').decode().strip()==BRANCH and not git('diff','--cached','--name-only').strip() and not D.exists()
D.mkdir();captures=[];original=prep.command
def capture(*args):
 if args[:2]!=('gh','api'):return original(*args)
 prefix='api-original-'+str(len(captures)).zfill(2)
 (D/(prefix+'-command.json')).write_bytes(canonical({'argv':args,'startedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat()}))
 r=subprocess.run(args,cwd=R,capture_output=True,timeout=90)
 (D/(prefix+'.json')).write_bytes(r.stdout);(D/(prefix+'-stderr.log')).write_bytes(r.stderr);(D/(prefix+'-exit.json')).write_bytes(canonical({'exitCode':r.returncode,'closedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat()}))
 captures.append({'file':prefix+'.json','argv':args,'bytes':len(r.stdout),'sha256':sha(r.stdout)})
 assert r.returncode==0,'Actual read failed, not no answer; never replay helper'
 return r.stdout
prep.command=capture
answer_raw=capture('gh','api','repos/yigini/soilfer-lims/issues/comments/6205724552');answer=json.loads(answer_raw)
assert answer['id']==6205724552 and answer['created_at']==answer['updated_at']=='2026-10-16T01:10:39Z' and answer['performed_via_github_app']['id']==1236702 and answer['performed_via_github_app']['slug']=='claude'
assert answer['body'].startswith('Proof result review: 003000 closed refusal accepted (not release qualified)') and 'refuse if either has a WAL' in answer['body']
O=S/'jobs003000-closed-row-refusal-originals-once/remote-originals';review=json.loads((O/'source-review-original.json').read_bytes());index=json.loads((O/'tooling-source-index.json').read_bytes());approval(review,index)
evidence=prep.current_evidence(review,index);assert json.loads(capture('gh','api','repos/yigini/soilfer-lims/issues/191'))['state']=='closed'
retention_path=S/'jobs003000-closed-row-refusal-originals-once/closed-retention-record.json';retention=json.loads(retention_path.read_bytes());rows={x['path']:x for x in retention['rootFileInventoryWithStableHashes']}
names=['startup-1-stopped-seal/backup.db','startup-1-stopped-seal/backup.db-wal','startup-1-stopped-seal/backup.db-shm','first-sync.db','first-sync.db-wal','first-sync.db-shm'];bound={n:rows[n] for n in names}
assert all(bound[n]['mode']==0o400 for n in names) and all(bound[n]['bytes']==0 and bound[n]['sha256']==sha(b'') for n in names if n.endswith('-wal')) and all(bound[n]['bytes']==32768 for n in names if n.endswith('-shm'))
frozen=json.loads((R/'WP/startup-order-readiness-20261015/full-pinned-copy-retention-bound-ordinary-once/source-before.json').read_bytes());assert len(frozen)==1333 and all(sha((R/n).read_bytes())==h for n,h in frozen.items())
for n in FILES:assert (S/n).read_bytes()==(O/n).read_bytes()
sources=['server/controllers/koboController.js','server/services/koboService.js','server/services/koboScheduler.js','server/services/sampleHoldService.js','server/services/intakeProfileService.js','server/services/sampleStateService.js'];sourcepins=[]
for name in sources:
 current=git('show',CANDIDATE+':'+name);old=git('show','959d17e11c357266f7c2a41b0c84ab76914c591e'+':'+name)
 sourcepins.append({'path':name,'bytes':len(current),'sha256':sha(current),'candidateGitBlobOid':git('rev-parse',CANDIDATE+':'+name).decode().strip(),'predecessorGitBlobOid':git('rev-parse','959d17e11c357266f7c2a41b0c84ab76914c591e'+':'+name).decode().strip(),'byteIdenticalToLivePredecessorSource':current==old})
 p=D/'application-source-originals'/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(current)
assert all(x['byteIdenticalToLivePredecessorSource'] for x in sourcepins)
semantic={k:answer[k] for k in ['id','body','created_at','updated_at']};semantic['performed_via_github_app']={k:answer['performed_via_github_app'][k] for k in ['id','slug']}
value={'status':'ACTUAL_FAILED_RESULT_ACCEPTED_DIAGNOSTIC_SCOPE_ONLY_EMPTY_WAL_CLARIFICATION_REQUIRED','retainedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'answerId':answer['id'],'answerUrl':answer['html_url'],'answerBodySha256':sha(answer['body'].encode()),'answerSemanticSha256':sha(canonical(semantic)),'answerIsSourcePass':False,'oldRootUnitPassConsumed':True,'prior233000LatestPassingKeep':True,'mainMergeHeld':True,'diagnosticRuntimeNotImplementedOrExecuted':True,'diagnosticRequiresNewExactSourcePass':True,'literalScopeRefusesAnyWal':True,'actualBothWalFilesPresentEmpty':True,'capturedMetadataUtc':retention['observedUtc'],'retentionRecordSha256':sha(retention_path.read_bytes()),'sixInputFilePinsFromOriginalClosedRetention':bound,'proposedForReviewOnly':'Permit only these exact stable zero-byte WALs (and preserve/hash/stat both SHM files), open ONLY the two new owned backup mains mode=ro&immutable=1, compare all112 tables, refuse nonempty/new/changed WAL or changed main/SHM, before/after full SHA/stat; no copies, checkpoint, delete, network, production or old-input SQL, containers or writes to consumed root. This is a proposed exception to literal no-WAL scope, requiring an actual answer before implementation.','appSourceComparison':sourcepins,'applicationCauseIsStillInferenceNotDiagnosticProof':True,'all26ReviewedSourcesAnd1333FrozenInputsUnchanged':True,'sourceOrTestReplays':0,'hostCalls':0,'sqliteConnections':0,'newRootOrUnitCreated':False,'newProofs':0}
for name,raw in [('actual-answer-original.json',answer_raw),('actual-answer-readable.txt',answer['body'].encode()),('fresh-current-authority-evidence.json',canonical(evidence)+b'\n'),('scope-boundary-record.json',canonical(value)+b'\n'),('api-command-index.json',canonical(captures)+b'\n')]:
 with (D/name).open('xb') as f:f.write(raw)
print(json.dumps({k:value[k] for k in ['status','answerId','answerBodySha256','answerSemanticSha256','actualBothWalFilesPresentEmpty','capturedMetadataUtc','hostCalls','sqliteConnections']},ensure_ascii=True))
