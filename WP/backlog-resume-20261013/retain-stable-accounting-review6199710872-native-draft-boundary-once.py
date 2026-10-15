"""Retain fresh new-review/native-human-draft boundary; no host connection or UI input."""
import datetime,hashlib,json,pathlib,subprocess
R=pathlib.Path(__file__).resolve().parents[2];S=R/'WP/batch-build-stable-accounting-be837974-20261015';D=S/'native-human-draft-and-review6199710872-boundary-once';BASE='57fca9003400e1cd62cd80125ed8ed2d767d2e02'
def run(*a):return subprocess.check_output(a,cwd=R)
def git(*a):return run('git','-c','core.longpaths=true',*a)
def sha(v):return hashlib.sha256(v).hexdigest()
def oid(v):return hashlib.sha1(('blob '+str(len(v))+'\0').encode()+v).hexdigest()
assert not D.exists() and git('rev-parse','HEAD').decode().strip()==BASE and not git('diff','--cached','--name-only').strip()
raw={n:run('gh','api',e) for n,e in [('request-original.json','repos/yigini/soilfer-lims/issues/comments/6199710872'),('coordination-after-request-original.json','repos/yigini/soilfer-lims/issues/162/comments?since=2026-10-15T18:46:51Z&per_page=100'),('pr298-comments-original.json','repos/yigini/soilfer-lims/issues/298/comments?since=2026-10-15T18:15:00Z&per_page=100'),('issue191-original.json','repos/yigini/soilfer-lims/issues/191'),('main-original.json','repos/yigini/soilfer-lims/git/ref/heads/main'),('main-ci-original.json','repos/yigini/soilfer-lims/actions/runs/38772398721')]}
assert json.loads(raw['request-original.json'])['body']==(S/'exact-source-review-request-4de3e334-once/request-body-original.md').read_text(encoding='utf-8')
assert json.loads(raw['main-original.json'])['object']['sha']=='be8379745bdfae52ce46496ff26514dc7d729640'
ci=json.loads(raw['main-ci-original.json']);assert ci['status']=='completed' and ci['conclusion']=='success' and ci['run_attempt']==1
closed=json.loads((S/'source-local-host-verification39-once/exit-original.json').read_bytes())
for n,s in closed['sourceSha256After'].items():assert sha((S/n).read_bytes())==s
frozen=json.loads((R/'WP/startup-order-readiness-20261015/full-pinned-copy-retention-bound-ordinary-once/source-before.json').read_bytes());assert len(frozen)==1333
for n,s in frozen.items():assert sha((R/n).read_bytes())==s,n
D.mkdir()
def save(n,v):
 with (D/n).open('xb') as f:f.write(v)
def js(n,v):save(n,(json.dumps(v,indent=2,ensure_ascii=False)+'\n').encode())
for n,v in raw.items():save(n,v)
js('native-readonly-derived.json',{'observedWindow':'2026-10-15 18:47-18:48 UTC tool boundary, minute label only','app':'Claude_pzs8sxrjxfjjc!Claude','returnedWindowId':7867734,'actualTarget':'LIMS Audit / Lab workflow audit and plan','actualScreenshot':'Current issue-count response; right HUMAN draft now begins669oo; followed by a long sequence of p characters. This differs from earlier669. Left composer empty.','accessibility':'document_text still669; accessibility tail includes prior actual6199128746 source-PASS reply/link and issue-count answer. Screenshot governs changed human draft.','nativeNew4de3SourceVerdictRead':False,'humanDraftPreserved':True,'nativeNewSourceHandoffDelivered':False,'activationNavigationTypingClicksMessagesCards':0,'pixels':'Conversation tool output only, no local image claimed','noInterruptionOfHumanWork':True})
new=[c for c in json.loads(raw['coordination-after-request-original.json']) if c['id']!=6199710872]
record={'recordedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':'NEW_SOURCE_REVIEW_REQUEST_POSTED_NATIVE_DEFERRED_FOR_HUMAN_DRAFT','sourceCommit':'4de3e334d8e498783a4cf20df4a5f93acfdbeb21','sourceRequestId':6199710872,'requestCreatedUtc':'2026-10-15T18:46:51Z','actualNewSourcePassClaimed':False,'newComments':[{'id':c['id'],'created_at':c['created_at'],'body':c['body']} for c in new],'allFiveCurrentSourcesAnd1333ApplicationHashesUnchanged':True,'prior180000FailedEvidenceAudit':'23e8dad8d6442321586b7d0bf4920c48a8681054','candidateA61Excluded':True,'new190000PackageRootUnitUncreated':True,'nativeNewHandoffUnsentPreserveHumanDraft':True,'hostConnectionsByRetainer':0,'buildsProofsCleanupProductionOperations':0}
js('boundary-record.json',record)
lead='''## 2026-10-15 new4de3 source request6199710872; native deferred for HUMAN draft

Fresh actualClaude7867734/LIMS Audit/Lab workflow readonly18:47-18:48 tool boundary shows right HUMAN draft changed from669 to669oo; plus long p sequence. Preserved/no activation/navigation/input/message/card action; accessibility document_text still669/screenshots govern. Prior619912 PASS reply/link appears in accessibility, NOT new4de3 verdict. New native handoff remains UNSENT; GH6199710872 already posted18:46:51UTC/full5SHA+allliteral bindings/failure23e8+newcomplete39both graph/64raw source4de3 bundled ONCE; do not duplicate GH/request/ACK. Source PASS still must be actually obtained/fully validated for exact4de3 before new190000 package/root/unit/build. Currentmainbe/mainCI38772398721 attempt1completedSUCCESS/1333app+all5source hashes unchanged. Latest full new-comment bodies and exact native derived boundary at WP/batch-build-stable-accounting-be837974-20261015/native-human-draft-and-review6199710872-boundary-once. No active build;180000failed/rootunithelpers consumed/a61unqualified; no cleanup/proof/kit/gate/deploy/productionDB. All R1amend6198899941/R2-R5/science/refusal/report/hash/copy/race/600/805/forwardonly/no103/history/human protections remain.

'''
readmes=[R/'WP/audit-release-eb6de2e8/README.md',R/'WP/runtime-recovery-kobo/README.md']
for p in readmes:p.write_bytes(lead.encode()+p.read_bytes())
paths=sorted(p for p in D.iterdir() if p.is_file())+[pathlib.Path(__file__),*readmes]
js('publication-index.json',{'baseAudit':BASE,'sourceCommit':record['sourceCommit'],'requestId':6199710872,'files':[{'path':p.relative_to(R).as_posix(),'length':len(p.read_bytes()),'sha256':sha(p.read_bytes()),'gitBlobOid':oid(p.read_bytes())} for p in paths]});paths.append(D/'publication-index.json')
names=[p.relative_to(R).as_posix() for p in paths]
git('-c','core.autocrlf=false','add','-f','--',*names)
assert set(git('diff','--cached','--name-only').decode().splitlines())==set(names)
tree=git('write-tree').decode().strip()
for p,n in zip(paths,names):assert git('show',tree+':'+n)==p.read_bytes() and git('rev-parse',tree+':'+n).decode().strip()==oid(p.read_bytes())
git('commit','-m','Retain new source review boundary and preserve active human native draft')
head=git('rev-parse','HEAD').decode().strip()
for p,n in zip(paths,names):assert git('show',head+':'+n)==p.read_bytes()
git('push','origin','audit/release-eb6de2e8');assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head
print(json.dumps({'audit':head,'rawOidShaVerifiedBlobs':len(paths),'newComments':[{'id':c['id'],'created_at':c['created_at'],'firstLine':c['body'].splitlines()[0] if c['body'] else ''} for c in new],'nativeNewHandoffUnsentHumanDraftPreserved':True,'actualNewSourcePassClaimed':False,'all1333And5Unchanged':True}))
