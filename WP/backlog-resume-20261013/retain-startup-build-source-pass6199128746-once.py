"""Retain actual exact five-file build-only PASS; no host or build operator."""
import datetime,hashlib,json,pathlib,subprocess,sys
R=pathlib.Path(__file__).resolve().parents[2]
BASE='47a228963cf17e1c45d25900cc2e7dab6da72a83'
TOOLING='2c0cebca0e9e191d2062c2f43756aa1d46e98c85'
S=R/'WP/batch-build-startup-be837974-20261015'
D=S/'actual-source-pass-6199128746-once'
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
 raw,index['files'][n]=raw_git(TOOLING,'WP/batch-build-startup-be837974-20261015/'+n)
 require(raw==(S/n).read_bytes(),'Reviewed working source changed '+n)
review_raw=run('gh','api','repos/yigini/soilfer-lims/issues/comments/6199128746')
review=json_exact(review_raw);validate_source_review(review,TOOLING,index)
require(review['created_at']==review['updated_at']=='2026-10-15T18:16:53Z','Actual verdict timestamp changed')
require(review['performed_via_github_app']['id']==1236702,'Actual Claude app identity changed')
for t in ['one build-only qualification','cachePruningPerformed=False','6198899941','historical']:
 require(t in review['body'],'Full reviewer condition missing '+t)
current=current_evidence()
direction=run('gh','api','repos/yigini/soilfer-lims/issues/comments/'+str(FALLBACK_DIRECTION_ID))
refs={n:raw_git(row['audit'],row['path'])[0] for n,row in REFERENCE_FILES.items()}
for n,v in refs.items():require(sha(v)==REFERENCE_FILES[n]['sha256'],'Original reference changed')
fallback_evidence(json_exact(direction),json_exact(refs['original-build-failure.json']),json_exact(refs['metadata-analysis-original.json']))
history=run('gh','api','--paginate','--slurp','repos/yigini/soilfer-lims/issues/162/comments?per_page=100')
no_later_source_failure([v for p in json_exact(history) for v in p],review,TOOLING)
pub=json_exact(git('show',TOOLING+':WP/batch-build-startup-be837974-20261015/source-publication-index.json'))
for b in pub['files']:
 v=git('show',TOOLING+':'+b['path'])
 require(len(v)==b['length'] and sha(v)==b['sha256'] and oid(v)==b['gitBlobOid'],'Published source evidence changed')
 require(git('rev-parse',TOOLING+':'+b['path']).decode().strip()==oid(v),'Published Git identity changed')
frozen=json_exact((R/'WP/startup-order-readiness-20261015/full-pinned-copy-retention-bound-ordinary-once/source-before.json').read_bytes())
require(len(frozen)==1333,'Frozen inventory differs')
for p,s in frozen.items():require(sha((R/p).read_bytes())==s,'Frozen application changed '+p)
D.mkdir()
def save(n,v):
 with (D/n).open('xb') as f:f.write(v)
def js(n,v):save(n,(json.dumps(v,indent=2,ensure_ascii=False)+'\n').encode())
for n,v in {'actual-source-review-original.json':review_raw,'actual-source-review-readable.txt':review['body'].encode(),'fallback-direction-original.json':direction,'coordination-full-history-original.json':history,**current,**refs}.items():save(n,v)
js('source-index-original.json',index)
js('native-readonly-derived.json',{'observedWindow':'2026-10-15 18:26 UTC tool boundary; minute label only','app':'Claude_pzs8sxrjxfjjc!Claude','windowId':7867734,'target':'LIMS Audit / Lab workflow audit and plan','actualScreenshot':'Latest issue-count answer visible; right composer contains HUMAN DRAFT 669 with caret; left composer empty. No build PASS visible in the current viewport.','accessibilityAgreesHumanDraft':'document_text 669','nativeBuildPassReadClaimed':False,'inputActivationNavigationMessages':0,'humanDraftPreserved':True,'pixels':'Conversation tool output only, no local pixel artifact claimed','earlierReadAttempt':'Unsupported sky.get_app_state returned not-a-function; no input or state change; refreshed supported list_apps/get_window/get_window_state succeeded.'})
js('pass-record.json',{'status':'ACTUAL_NEW_STARTUP_BUILD_ONLY_SOURCE_PASS_VALIDATED','observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceReviewId':review['id'],'sourceReviewUtc':review['created_at'],'sourceReviewUrl':review['html_url'],'toolingCommit':TOOLING,'allFiveRawSourceHashesAndLiteralTokensVerified':True,'allPublishedSourceBindingsVerified':len(pub['files']),'all1333ApplicationInputsUnchanged':True,'freshMainCiAndAllFourActualAppAuditsAndRulePinsVerified':True,'noLaterExactSourceFailure':True,'historicalPendingYYTokenAcceptedByActualReviewer':True,'r1Amendment':6198899941,'scope':SCOPE,'oneNewBuildConditionalOnAllFreshGuards':True,'newRoot':str(safe_build_root(FIRST_BUILD_ROOT_NAME)),'packageRootUnitStillUncreated':True,'newBuilds':0,'proofs':0,'cleanup':0,'productionOperations':0,'hostConnectionsByThisRetainer':0,'r2AfterSuccessfulBuildStillRequiresSeparateBoundedSourceAndItemReceipt':True})
lead='''## 2026-10-15 actual NEW build-only SourcePASS6199128746 retained

Unedited actual Claude-app Source review: PASS6199128746 at18:16:53UTC binds exact2c0cebca/all5SHA/ALLliteral tokens, mainbe837974/tree676b/mainCI38772398721 and all4application audits. Own validator/current authorities/no later failure/all36published source bindings/all1333frozen application hashes independently verified. Authorizes ONE new BUILD-ONLY qualification only after fresh R4 before-root/unit/build and every guard. No package/root/unit/build yet; no proof/cleanup/kit/gate/deploy authority. Builder prunesnothing. Actual reviewer accepts historical noProofDatabaseRemovalPendingYY token; amendment6198899941 governs future R1 without changing build source. R2 after-success actualmax-used-space5GB/shared-inuse protection remains a separate bounded-source/item-receipt obligation. Full originals and exact bindings at WP/batch-build-startup-be837974-20261015/actual-source-pass-6199128746-once/publication-index.json.

Fresh native readonly LIMS Audit/Lab workflow viewport shows issue-count answer and HUMAN right-composer draft669; preserved/no input/activation/navigation/message/ACK. No native build PASS claimed. GitHub full actual verdict governs. Earlier native handoff18:12-14 already complete; never repeat. All science/refusal/report/hash/copy/race/600/805/forwardonly/no103/history guards remain.

'''
readmes=[R/'WP/audit-release-eb6de2e8/README.md',R/'WP/runtime-recovery-kobo/README.md']
for p in readmes:p.write_bytes(lead.encode()+p.read_bytes())
paths=sorted(p for p in D.iterdir() if p.is_file())+[pathlib.Path(__file__),*readmes]
bindings=[{'path':p.relative_to(R).as_posix(),'length':len(p.read_bytes()),'sha256':sha(p.read_bytes()),'gitBlobOid':oid(p.read_bytes())} for p in paths]
js('publication-index.json',{'baseAudit':BASE,'toolingCommit':TOOLING,'sourceReviewId':review['id'],'files':bindings})
paths.append(D/'publication-index.json');names=[p.relative_to(R).as_posix() for p in paths]
for i in range(0,len(names),15):git('-c','core.autocrlf=false','add','-f','--',*names[i:i+15])
require(set(git('diff','--cached','--name-only').decode().splitlines())==set(names),'Staged ownership differs')
tree=git('write-tree').decode().strip()
for p,n in zip(paths,names):require(git('show',tree+':'+n)==p.read_bytes() and git('rev-parse',tree+':'+n).decode().strip()==oid(p.read_bytes()),'Staged raw bytes differ')
git('commit','-m','Retain exact startup build SourcePASS6199128746 and fresh authorities')
head=git('rev-parse','HEAD').decode().strip()
for p,n in zip(paths,names):require(git('show',head+':'+n)==p.read_bytes(),'Committed raw bytes differ')
git('push','origin','audit/release-eb6de2e8')
require(git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head,'Pushed audit differs')
require(not git('diff','--cached','--name-only').strip(),'Staged delta remains')
print(json.dumps({'audit':head,'sourceReviewId':review['id'],'rawOidShaVerifiedBlobs':len(paths),'all1333Unchanged':True,'builds':0,'hostConnections':0}))
