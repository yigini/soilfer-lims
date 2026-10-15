"""Retain the one qualified-build notice and honest native non-delivery boundary."""
import datetime,hashlib,json,pathlib,subprocess,sys
R=pathlib.Path(__file__).resolve().parents[2]
S=R/'WP/batch-build-stable-accounting-be837974-20261015'
D=S/'qualified-build190000-handoff-once'
BASE='5f86a1966af536f83a345ebdb02983bbe2a166ad'
def run(*a):return subprocess.check_output(a,cwd=R)
def git(*a):return run('git','-c','core.longpaths=true',*a)
def sha(b):return hashlib.sha256(b).hexdigest()
def oid(b):return hashlib.sha1(('blob '+str(len(b))+'\0').encode()+b).hexdigest()
assert D.is_dir() and not (D/'publication-index.json').exists()
assert git('rev-parse','HEAD').decode().strip()==BASE and not git('diff','--cached','--name-only').strip()
assert git('branch','--show-current').decode().strip()=='audit/release-eb6de2e8'
assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==BASE
sys.path.insert(0,str(S));from batch_build_contract import *
from prepare_batch_build import current_evidence
def save(n,v):
 with (D/n).open('xb') as f:f.write(v)
def js(n,v):save(n,(json.dumps(v,indent=2,ensure_ascii=False)+'\n').encode())
actual_raw=run('gh','api','repos/yigini/soilfer-lims/issues/comments/6200455534');actual=json_exact(actual_raw)
require(actual['body'].encode()==(D/'actual-qualified-notice-body.txt').read_bytes() and actual['created_at']==actual['updated_at']=='2026-10-15T19:24:35Z','Actual one-time notice differs')
save('actual-notice-fresh-original.json',actual_raw)
current=current_evidence()
for n,v in current.items():save(n,v)
history=run('gh','api','--paginate','--slurp','repos/yigini/soilfer-lims/issues/162/comments?per_page=100');save('coordination-after-notice-original.json',history)
review=json_exact((S/'actual-source-pass-6200145007-complete-publication-once/actual-source-review-original.json').read_bytes())
no_later_source_failure([v for page in json_exact(history) for v in page],review,'4de3e334d8e498783a4cf20df4a5f93acfdbeb21')
save('issue191-current-original.json',run('gh','api','repos/yigini/soilfer-lims/issues/191'))
require(json_exact((D/'issue191-current-original.json').read_bytes())['state']=='closed','191 changed')
frozen=json_exact((R/'WP/startup-order-readiness-20261015/full-pinned-copy-retention-bound-ordinary-once/source-before.json').read_bytes())
require(len(frozen)==1333,'Frozen app inventory differs')
for p,d in frozen.items():require(sha((R/p).read_bytes())==d,'Frozen application changed '+p)
index=json_exact((S/'build-package-workflow-batch-build-be837974-20261015T190000Z/tooling-source-index.json').read_bytes())
for n,row in index['files'].items():require(sha((S/n).read_bytes())==row['sha256'],'Reviewed tooling changed '+n)
js('native-not-delivered-derived.json',{'source':'Conversation Computer Use tool output; screenshots remain only in conversation, no local pixel artifact claimed','observedUtcLabel':'2026-10-15 19:24-19:25 UTC tool boundary, minute label only','selectedReturnedApp':'Claude_pzs8sxrjxfjjc!Claude','selectedReturnedWindowId':7867734,'accessibility':'Returned prior LIMS Audit/Lab workflow text, empty composers and running labels','actualScreenshot':'Displayed a different browser app rather than the selected Claude conversation; screenshot and accessibility disagreed','nativeCurrentClaudeReadOrDeliveryClaimed':False,'nativeBuildOutcomeHandoffSent':False,'reason':'No current actual Claude target/composer could be confirmed from the screenshot; preserve human activity in the other app','inputActivationNavigationTypingMessagesCards':0,'lastActualNativeRead':'19:12 tool boundary confirmed the completed new review explanation6200145007','githubNoticeAlreadyDelivered':6200455534,'laterNativeHandoffOnlyAtMeaningfulFreshActualTargetEmptyComposerBoundary':True,'neverDuplicateGithubNoticeOrApprovalAcknowledgement':True})
js('delivery-record.json',{'status':'QUALIFIED_NEW_BUILD_RESULT_GIVEN_ONCE_GITHUB_NATIVE_DEFERRED','observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'commentId':actual['id'],'commentUrl':actual['html_url'],'commentCreatedUtc':actual['created_at'],'bundledSourcePassAcknowledgement':6200145007,'bundledYyRequestedClaudioNoteAcknowledgement':6200229685,'qualifiedBuildAudit':BASE,'qualifiedReceiptSha256':'cd3a2757d8ecb0bf933f49231031eb7fb61eb5abaac17d05f3585c1baaf89f0a','image':'sha256:acc158447f5571068bf150fc0e8fa6f0889aeb38f9aec8be08978d903bd5be6a','all1333ApplicationAndFiveToolingSourcesUnchanged':True,'freshMainCiAndAllFourAppAuditsAndRulePinsVerified':True,'nativeHandoffSent':False,'noNewSourceReviewRequestForUnimplementedR2Graph':True,'next':'Actually implement complete bounded R2 source with meaningful local/host guards, publish, then request new exact source review before any cache operation; next image-bound proof tooling needs its own all-hash review/fresh R4/new root','newBuildsProofsCleanupProductionOperationsByThisRetainer':0})
lead='''## 2026-10-15 qualified NEW build190000 result6200455534 handed off ONCE; R2 source next

Actual ONEnew190000/exact4de3/PASS6200145007 build is independently QUALIFIED, closed19:19:41.759023UTC/Dockerexit0/3.773966252s/imageacc15844/receiptcd3a2757. Full64raw original artifacts and independent qualification published5f86a196. ONE#162result6200455534 at19:24:35UTC bundles actualPASS6200145007 and YY-requestedClnote6200229685 acknowledgement ONLYhere; never duplicate notice/ACK. All5+1333hashes/currentmainbe/mainCI4audits/rules reverified. Both measurements firstattempt complete/empty stderr/no extraattempt/unexplained0/fresh3R4gates PASS; no proof/deploy/cleanup.

Native result handoff UNSENT: fresh returnedClaude7867734 state19:24-19:25 tool boundary produced a different browser screenshot while accessibility retained old LIMS content. Screenshot governs; NOactualcurrentClaude/composer/read/deliveryclaim, NOactivation/navigation/input/message/cardaction; preserve human activity. GitHub result already given. Native only later meaningful fresh actual target/empty composer; no obsolete source request or duplicate GH/ACK.

Next ACTUALLYimplement complete bounded R2 cache-maintenance source + meaningful local/host tests + publication + exact all-hash review before any cache operation. No R2 graph/request/operator exists yet; do not wait approval of an unimplemented graph. Actualmax-used-space5GB/protectinuse/shared evenabove/immutableitemreceipt/df required; builder prunesnothing. ThenNEWacc-image-boundcompleteprooftooling/allhashClPASS/freshR4computed+10GB/NEWproofroot. Nevercde8/B5/100000retry. New190000root/unit/PASS/helpers consumed neverrebuild/retag/retry/replay/cleanup. Failed180000/a61/221500/residual/B5/allhistory protected; no productionDB/settings/restart/103/proof/kit/gate/deploy. All R1amend/R2-R5/science/refusal/report/impact/approvednonzeroSTOP/YYlists/hash/copyrace/600/805/forwardonly/humans/history hold.

'''
readmes=[R/'WP/audit-release-eb6de2e8/README.md',R/'WP/runtime-recovery-kobo/README.md']
for p in readmes:p.write_bytes(lead.encode()+p.read_bytes())
paths=sorted(p for p in D.iterdir() if p.is_file())+[R/'WP/backlog-resume-20261013/post-stable-accounting190000-qualified-boundary-once.py',pathlib.Path(__file__),*readmes]
js('publication-index.json',{'baseAudit':BASE,'status':'QUALIFIED_BUILD_NOTICE_POSTED_ONCE_NATIVE_NOT_DELIVERED','commentId':actual['id'],'files':[{'path':p.relative_to(R).as_posix(),'length':len(p.read_bytes()),'sha256':sha(p.read_bytes()),'gitBlobOid':oid(p.read_bytes())} for p in paths]})
paths.append(D/'publication-index.json');names=[p.relative_to(R).as_posix() for p in paths];require(len(names)==len(set(names)),'Duplicate owned paths')
for i in range(0,len(names),15):git('-c','core.autocrlf=false','add','-f','--',*names[i:i+15])
require(set(git('diff','--cached','--name-only').decode().splitlines())==set(names),'Staged ownership differs')
tree=git('write-tree').decode().strip()
for p,n in zip(paths,names):require(git('show',tree+':'+n)==p.read_bytes() and git('rev-parse',tree+':'+n).decode().strip()==oid(p.read_bytes()),'Staged raw identity differs')
git('commit','-m','Retain qualified build190000 result and protected native boundary')
head=git('rev-parse','HEAD').decode().strip()
for p,n in zip(paths,names):require(git('show',head+':'+n)==p.read_bytes(),'Committed raw bytes differ')
git('push','origin','audit/release-eb6de2e8');require(git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head,'Pushed audit differs')
require(not git('diff','--cached','--name-only').strip(),'Staged delta remains')
print(json.dumps({'audit':head,'rawOidShaVerifiedBlobs':len(paths),'commentId':actual['id'],'nativeSent':False,'all1333AndFiveUnchanged':True,'noActiveBuild':True}))
