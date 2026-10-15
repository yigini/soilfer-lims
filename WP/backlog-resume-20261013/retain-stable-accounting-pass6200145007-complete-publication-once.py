"""Retain the actual new exact build-only PASS; no host/operator execution."""
import datetime,hashlib,json,pathlib,subprocess,sys
R=pathlib.Path(__file__).resolve().parents[2]
BASE='69a6802f0ad73771f3f73731b07919de09274ee9'
TOOLING='4de3e334d8e498783a4cf20df4a5f93acfdbeb21'
S=R/'WP/batch-build-stable-accounting-be837974-20261015'
D=S/'actual-source-pass-6200145007-complete-publication-once'
def run(*argv):
 p=subprocess.run(argv,cwd=R,capture_output=True)
 assert p.returncode==0,p.stderr.decode('utf-8','replace')
 return p.stdout
def git(*a):return run('git','-c','core.longpaths=true',*a)
def sha(v):return hashlib.sha256(v).hexdigest()
def oid(v):return hashlib.sha1(('blob '+str(len(v))+'\0').encode()+v).hexdigest()
assert not D.exists() and git('rev-parse','HEAD').decode().strip()==BASE
assert git('branch','--show-current').decode().strip()=='audit/release-eb6de2e8'
assert not git('diff','--cached','--name-only').strip()
assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==BASE
sys.path.insert(0,str(S))
from batch_build_contract import *
from prepare_batch_build import raw_git,current_evidence
index={'head':TOOLING,'files':{}}
for n in sorted(SOURCE_FILES):
 raw,index['files'][n]=raw_git(TOOLING,'WP/batch-build-stable-accounting-be837974-20261015/'+n)
 require(raw==(S/n).read_bytes(),'Reviewed working source changed '+n)
review_raw=run('gh','api','repos/yigini/soilfer-lims/issues/comments/6200145007')
review=json_exact(review_raw);validate_source_review(review,TOOLING,index)
require(review['created_at']==review['updated_at']=='2026-10-15T19:08:01Z','Actual verdict timestamp changed')
require(review['performed_via_github_app']['id']==1236702,'Actual Claude app identity changed')
for t in ['one build-only qualification','second complete du','partial totals are never credited','6198899941','historical','180000 image stays unqualified']:
 require(t in review['body'],'Full reviewer condition missing '+t)
require(len(review_tokens(TOOLING,index))==47,'Complete literal binding count changed')
current=current_evidence()
direction=run('gh','api','repos/yigini/soilfer-lims/issues/comments/'+str(FALLBACK_DIRECTION_ID))
refs={n:raw_git(row['audit'],row['path'])[0] for n,row in REFERENCE_FILES.items()}
for n,v in refs.items():require(sha(v)==REFERENCE_FILES[n]['sha256'],'Original reference changed')
fallback_evidence(json_exact(direction),json_exact(refs['original-build-failure.json']),json_exact(refs['metadata-analysis-original.json']))
validate_prior_startup_failure(json_exact(refs['startup-180000-build-failure.json']))
amend_raw=run('gh','api','repos/yigini/soilfer-lims/issues/comments/6198899941')
amend=json_exact(amend_raw)
amend_old=json_exact(git('show','47a228963cf17e1c45d25900cc2e7dab6da72a83:WP/host-capacity-r1-amendment-6198899941-20261015/actual-amendment-original.json'))
def semantic(v):
 a=v.get('performed_via_github_app') or {}
 return {**{k:v[k] for k in ['id','body','created_at','updated_at']},'app':{'id':a.get('id'),'slug':a.get('slug')}}
require(semantic(amend)==semantic(amend_old),'Current R1 amendment changed')
note_raw=run('gh','api','repos/yigini/soilfer-lims/issues/comments/6200229685')
note=json_exact(note_raw)
require(note['created_at']==note['updated_at']=='2026-10-15T19:12:37Z' and note['performed_via_github_app']['id']==1236702 and note['performed_via_github_app']['slug']=='claude' and '6200145007' in note['body'] and 'fresh root, unit and R4 checks pass' in note['body'],'Actual YY-requested Claudio note differs')
history=run('gh','api','--paginate','--slurp','repos/yigini/soilfer-lims/issues/162/comments?per_page=100')
no_later_source_failure([v for p in json_exact(history) for v in p],review,TOOLING)
pub=json_exact(git('show',TOOLING+':WP/batch-build-stable-accounting-be837974-20261015/source-publication-index.json'))
require(len(pub['files'])==63,'Complete source publication binding count differs; 64 blobs includes the index itself')
for b in pub['files']:
 v=git('show',TOOLING+':'+b['path'])
 require(len(v)==b['length'] and sha(v)==b['sha256'] and oid(v)==b['gitBlobOid'],'Published source evidence changed')
 require(git('rev-parse',TOOLING+':'+b['path']).decode().strip()==oid(v),'Published Git identity changed')
frozen=json_exact((R/'WP/startup-order-readiness-20261015/full-pinned-copy-retention-bound-ordinary-once/source-before.json').read_bytes())
require(len(frozen)==1333,'Frozen inventory differs')
for p,s in frozen.items():require(sha((R/p).read_bytes())==s,'Frozen application changed '+p)
require(not (S/('build-package-'+FIRST_BUILD_ROOT_NAME)).exists(),'Local package already consumed')
D.mkdir()
def save(n,v):
 with (D/n).open('xb') as f:f.write(v)
def js(n,v):save(n,(json.dumps(v,indent=2,ensure_ascii=False)+'\n').encode())
for n,v in {'actual-source-review-original.json':review_raw,'actual-source-review-readable.txt':review['body'].encode(),'fallback-direction-original.json':direction,'coordination-full-history-original.json':history,'r1-amendment-current-original.json':amend_raw,'claudio-note-6200229685-original.json':note_raw,**current,**refs}.items():save(n,v)
js('source-index-original.json',index)
js('first-retainer-refusal-derived.json',{'source':'Conversation tool output transcription, not a separately retained original stderr file','helper':'WP/backlog-resume-20261013/retain-stable-accounting-source-pass6200145007-once.py','exitCode':1,'error':'RuntimeError: Complete source publication count differs','guardLine':49,'actualPublicationBindings':63,'publishedBlobsIncludingIndex':64,'beforeOutputDirectoryCreation':True,'headUnchanged':'69a6802f0ad73771f3f73731b07919de09274ee9','stagedEmpty':True,'operationsBeforeRefusal':'Local raw Git verification plus GitHub reads only; no host or operator','neverReplay':True})
js('native-readonly-derived.json',{'observedWindow':'2026-10-15 19:12 UTC tool boundary; minute label only','app':'Claude_pzs8sxrjxfjjc!Claude','windowId':7867734,'target':'LIMS Audit / Lab workflow audit and plan','actualScreenshot':'Both composers empty. Completed new review explanation links actual6200145007; human forwarded you send that please and Claude actively processing the nudge. No activation/navigation/input/message/card action by Pip.','accessibilityAgrees':True,'nativeNewReviewExplanationRead':True,'inputActivationNavigationMessages':0,'humanDraftsPreserved':True,'obsoleteSourceRequestNotSent':True,'pixels':'Conversation tool output only, no local pixel artifact claimed','causalityLimit':'Native shorthand Docker cache folder vanished does not prove the process causing snapshot12671 disappearance; the original failed record and all partial totals remain unchanged.'})
js('pass-record.json',{'status':'ACTUAL_NEW_STABLE_ACCOUNTING_BUILD_ONLY_SOURCE_PASS_VALIDATED','observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceReviewId':review['id'],'sourceReviewUtc':review['created_at'],'sourceReviewUrl':review['html_url'],'toolingCommit':TOOLING,'allFiveRawSourceHashesAndAll47LiteralBindingsVerified':True,'allPublishedSourceBindingsVerified':len(pub['files']),'all1333ApplicationInputsUnchanged':True,'freshMainCiAndAllFourActualAppAuditsAndRulePinsVerified':True,'currentR1AmendmentSemanticIdentityVerified':True,'noLaterExactSourceFailure':True,'historicalPendingYYTokenAcceptedByActualReviewer':True,'r1Amendment':6198899941,'scope':SCOPE,'oneNewBuildConditionalOnAllFreshGuards':True,'newRoot':str(safe_build_root(FIRST_BUILD_ROOT_NAME)),'localPackageStillUncreated':True,'remoteUnusedRootUnitChecksStillRequired':True,'newBuilds':0,'proofs':0,'cleanup':0,'productionOperations':0,'hostConnectionsByThisRetainer':0,'r2AfterSuccessfulBuildStillRequiresSeparateBoundedSourceAndItemReceipt':True})
lead='''## 2026-10-15 actual NEW stable-accounting SourcePASS6200145007 retained

Unedited actual Claude-app Source review: PASS6200145007 at19:08:01UTC binds exact4de3e334/all5SHA/ALL47literal bindings, mainbe837974/tree676b/mainCI38772398721 and all4application audits. Own validator/current authorities/currentR1amendment/no later failure/all63published source bindings plus the index (64 blobs)/all1333frozen application hashes independently verified. Authorizes ONE new BUILD-ONLY qualification in190000 ONLY after fresh R4 before-root/unit/build and all unused-root/unit/authority guards. No operational package/root/unit/build executed yet; no proof/cleanup/kit/gate/deploy/R2prune or180000adoption/measurement authority. Every partial measurement remains uncredited; ONLY one narrowly guarded prospective additional COMPLETE postmeasurement. Builder prunesnothing; R2after-success separate bounded-source/itemreceipt remains. Full originals at WP/batch-build-stable-accounting-be837974-20261015/actual-source-pass-6200145007-complete-publication-once/publication-index.json.

Fresh actual native readonly19:12 tool boundary confirms completed new review explanation/link6200145007; both composers empty, human nudge and active Claude response preserved. No activation/navigation/input/message/card action. Obsolete source-request handoff not sent; prior619852handoff complete. All science/refusal/report/hash/copy/race/600/805/forwardonly/no103/history/human protections remain.

'''
readmes=[R/'WP/audit-release-eb6de2e8/README.md',R/'WP/runtime-recovery-kobo/README.md']
for p in readmes:p.write_bytes(lead.encode()+p.read_bytes())
paths=sorted(p for p in D.iterdir() if p.is_file())+[pathlib.Path(__file__),R/'WP/backlog-resume-20261013/retain-stable-accounting-source-pass6200145007-once.py',*readmes]
bindings=[{'path':p.relative_to(R).as_posix(),'length':len(p.read_bytes()),'sha256':sha(p.read_bytes()),'gitBlobOid':oid(p.read_bytes())} for p in paths]
js('publication-index.json',{'baseAudit':BASE,'toolingCommit':TOOLING,'sourceReviewId':review['id'],'files':bindings})
paths.append(D/'publication-index.json');names=[p.relative_to(R).as_posix() for p in paths]
for i in range(0,len(names),15):git('-c','core.autocrlf=false','add','-f','--',*names[i:i+15])
require(set(git('diff','--cached','--name-only').decode().splitlines())==set(names),'Staged ownership differs')
tree=git('write-tree').decode().strip()
for p,n in zip(paths,names):require(git('show',tree+':'+n)==p.read_bytes() and git('rev-parse',tree+':'+n).decode().strip()==oid(p.read_bytes()),'Staged raw bytes differ')
git('commit','-m','Retain exact stable-accounting SourcePASS6200145007 and fresh authorities')
head=git('rev-parse','HEAD').decode().strip()
for p,n in zip(paths,names):require(git('show',head+':'+n)==p.read_bytes(),'Committed raw bytes differ')
git('push','origin','audit/release-eb6de2e8')
require(git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head,'Pushed audit differs')
require(not git('diff','--cached','--name-only').strip(),'Staged delta remains')
print(json.dumps({'audit':head,'sourceReviewId':review['id'],'rawOidShaVerifiedBlobs':len(paths),'all47Bindings':True,'all1333Unchanged':True,'builds':0,'hostConnections':0}))
