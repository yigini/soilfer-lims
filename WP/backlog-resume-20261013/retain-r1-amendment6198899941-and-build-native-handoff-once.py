"""Retain the actual R1 amendment and single delivered build-source native handoff. No host operators."""
import datetime,hashlib,json,pathlib,subprocess
R=pathlib.Path(__file__).resolve().parents[2]
BASE='5b2678270e23dc53db4f3226f0861dd835c32d93'
TOOLING='2c0cebca0e9e191d2062c2f43756aa1d46e98c85'
CANDIDATE='be8379745bdfae52ce46496ff26514dc7d729640'
D=R/'WP/host-capacity-r1-amendment-6198899941-20261015'
NATIVE=json.loads("{\"handoffText\":\"Claudio, the NEW build-only tooling is ready for exact-source review. This is the one native handoff for the GitHub request already posted once at https://github.com/yigini/soilfer-lims/issues/162#issuecomment-6198527574 . Earlier native capture was minimized; no handoff had been sent.\\n\\nPR298 was merged once as main be8379745bdfae52ce46496ff26514dc7d729640, tree676b01e71211786d1aeace50f19a0b2c9f9c482e. Main push CI38772398721 attempt1 closed SUCCESS17:30:10UTC: exact373/373 suites5679/5679 tests, all373 paths, client, candidate+supported-baseline Docker builds and real boundary/readiness. FULL original ZIP/API/all22 entry bytes+hashes are published3167ea258780a8590337e89e233083a8ef272695. This is not production600s/805 qualification.\\n\\nComplete NEW five-file source2c0cebca0e9e191d2062c2f43756aa1d46e98c85: WP/batch-build-startup-be837974-20261015/README.md and source-publication-index.json. CLOSED28local+28ACTUALhostPython3.9.23 pure guards/all5compile/hashunchanged. Request6198527574 carries ALL5SHA256 and every literal binding; delivery/authority36raw verified blobs are published5b2678270e23dc53db4f3226f0861dd835c32d93. Please review that exact graph and post its exact all-hash/literal Source review: PASS or findings on #162.\\n\\nNEW /opt/lims/releases/workflow-batch-build-be837974-20261015T180000Z remains uncreated: no operational package/upload/unit/build. R4 computes exact raw-source extraction/package allowances plus floor10556150894+4GiB buildreserve+10000000000B headroom; fresh nonalias STAT/statvfs gates before root, unit and build, subtracting only consumption already charged. Actual next-build fit is NOT established. Build1800/unit2700/controller805306368Swap0/blankheap/accounting120s64KiB/500MB unexplained-growth STOP remain.\\n\\nI have read amendment6198899941 and YY's actual Allow deletion choice; R1 no longer requires a separate copy elsewhere for eligible CLOSED-run derived DB copies/assets. All stated Git small-file/hash/length/reference/latest-passing-candidate protections and item receipts/df remain mandatory. No cleanup has occurred under this amendment. Backups,050000raw and all non-derived evidence stay protected. R2 after-success actualmax-used-space5GB/shared+inuse protection remains a separate bounded-source/item-receipt obligation; this builder prunes NOTHING (cachePruningByThisBuilder=false). R3/R4/R5 unchanged. No proof/kit/gate/deploy/production operation, no cde8/B5/100000 retry; all science/refusal/report/hash/copy/race/600/805/forward-only/no103 constraints remain.\",\"app\":\"Claude_pzs8sxrjxfjjc!Claude\",\"windowId\":7867734,\"nativeDecisionObserved\":\"Allow Pip to delete old test copies of the database after each test? A Allow deletion; You chose · 8:05 PM\",\"nativeReplyObserved\":\"Done. Pip can now remove a finished test’s database copies under the rule (https://github.com/yigini/soilfer-lims/issues/162#issuecomment-6198899941). Backups, the October 3 restore points and raw files stay protected, and I’ll check each cleanup report.\",\"sentVerified\":\"Actual sent NEW build-only tooling bubble, empty right composer, Cultivating indicator; screenshots govern immediate accessibility lag\",\"humanContentPreserved\":true}")
def run(argv):
 p=subprocess.run(argv,cwd=R,capture_output=True)
 assert p.returncode==0,p.stderr.decode('utf-8','replace')
 return p.stdout
def git(*a):return run(['git','-c','core.longpaths=true',*a])
def gh(e):return run(['gh','api',e])
def sha(v):return hashlib.sha256(v).hexdigest()
def oid(v):return hashlib.sha1(('blob '+str(len(v))+'\0').encode()+v).hexdigest()
def js(name,value):
 with (D/name).open('x',encoding='utf-8') as f:json.dump(value,f,indent=2,ensure_ascii=False)
assert not D.exists()
assert git('rev-parse','HEAD').decode().strip()==BASE
assert git('branch','--show-current').decode().strip()=='audit/release-eb6de2e8'
assert not git('diff','--cached','--name-only').strip()
assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==BASE
raw={}
for n,e in [
 ('actual-amendment-original.json','repos/yigini/soilfer-lims/issues/comments/6198899941'),
 ('standing-rule-original.json','repos/yigini/soilfer-lims/issues/comments/6189658753'),
 ('activation-original.json','repos/yigini/soilfer-lims/issues/comments/6189669837'),
 ('earlier-cleanup-review-original.json','repos/yigini/soilfer-lims/issues/comments/6191219093'),
 ('build-source-request-original.json','repos/yigini/soilfer-lims/issues/comments/6198527574'),
 ('coordination-after-handoff-original.json','repos/yigini/soilfer-lims/issues/162/comments?since=2026-10-15T17:46:11Z&per_page=100'),
 ('pr298-after-handoff-original.json','repos/yigini/soilfer-lims/issues/298/comments?since=2026-10-15T18:01:00Z&per_page=100'),
 ('main-original.json','repos/yigini/soilfer-lims/git/ref/heads/main'),
 ('main-ci-original.json','repos/yigini/soilfer-lims/actions/runs/38772398721'),
 ('issue191-original.json','repos/yigini/soilfer-lims/issues/191')]:raw[n]=gh(e)
amend=json.loads(raw['actual-amendment-original.json'])
assert amend['id']==6198899941 and amend['created_at']==amend['updated_at']=='2026-10-15T18:05:47Z'
app=amend['performed_via_github_app'];assert app['id']==1236702 and app['slug']=='claude'
for token in ['YY chose "Allow deletion"','2026-10-15T18:05:20Z','No separate verified copy elsewhere is required','latest passing proof of the current candidate','the 050000 raw files','R5 (no backup removal)','df']:assert token in amend['body'],token
assert json.loads(raw['main-original.json'])['object']['sha']==CANDIDATE
ci=json.loads(raw['main-ci-original.json']);assert ci['id']==38772398721 and ci['head_sha']==CANDIDATE and ci['run_attempt']==1 and ci['event']=='push' and ci['status']=='completed' and ci['conclusion']=='success'
pubpath='WP/batch-build-startup-be837974-20261015/source-publication-index.json'
pub=json.loads(git('show',TOOLING+':'+pubpath))
verified=[]
for b in pub['files']:
 v=git('show',TOOLING+':'+b['path'])
 assert len(v)==b['length'] and sha(v)==b['sha256'] and oid(v)==b['gitBlobOid']
 assert git('rev-parse',TOOLING+':'+b['path']).decode().strip()==b['gitBlobOid']
 verified.append(b)
sourcefiles=['batch_build_contract.py','batch_build.py','prepare_batch_build.py','launch_batch_build.py','verify_build_guards.py']
for n in sourcefiles:
 p='WP/batch-build-startup-be837974-20261015/'+n
 assert (R/p).read_bytes()==git('show',TOOLING+':'+p)
frozen=json.loads((R/'WP/startup-order-readiness-20261015/full-pinned-copy-retention-bound-ordinary-once/source-before.json').read_bytes())
assert len(frozen)==1333
for p,s in frozen.items():assert sha((R/p).read_bytes())==s,p
D.mkdir()
for n,v in raw.items():
 with (D/n).open('xb') as f:f.write(v)
with (D/'amendment-readable.txt').open('x',encoding='utf-8') as f:f.write(amend['body'])
with (D/'native-handoff-actual-sent.txt').open('x',encoding='utf-8') as f:f.write(NATIVE['handoffText'])
projection={k:amend[k] for k in ['id','body','created_at','updated_at']}
projection['app']={'id':app['id'],'slug':app['slug']}
js('amendment-authority-pin.json',{'projection':projection,'projectionSha256':sha(json.dumps(projection,sort_keys=True,separators=(',',':'),ensure_ascii=True).encode()),'rawApiSha256':sha(raw['actual-amendment-original.json'])})
js('native-observation-and-delivery-derived.json',{
 'recordedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),
 'observationWindow':'2026-10-15 18:12-18:14 UTC; minute-labelled tool boundary, not exact producer send timestamp',
 'actual':NATIVE,
 'decisionObservedInAccessibility':True,'nativeCompletedReplyAndPendingBuildChecklistRead':True,
 'sentBubbleEmptyRightComposerAndCultivatingVerifiedInScreenshot':True,
 'immediateAccessibilityAfterTypeAndSendLagged':True,'screenshotsGovern':True,
 'pixelsLocation':'Conversation tool output only; no local pixel file claimed',
 'activation':False,'navigation':False,'agentAnsweredHumanCard':False,
 'separateGithubPostOrDuplicateAcknowledgement':False})
js('frozen-inputs-reverified.json',{'observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'toolingCommit':TOOLING,'allPublishedSourceBindings':verified,'fiveCurrentSourceFilesUnchanged':sourcefiles,'frozenApplicationInputs':len(frozen),'all1333Unchanged':True})
record={
 'observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),
 'status':'ACTUAL_R1_AMENDMENT_RETAINED_SINGLE_BUILD_NATIVE_HANDOFF_DELIVERED',
 'amendmentId':6198899941,'amendmentUrl':amend['html_url'],
 'humanChoice':'Actual native Allow deletion choice read; exact18:05:20Z supplied by unedited actual Claude-app GitHub amendment.',
 'r1NowAllows':'Only eligible CLOSED proof-run derived DB working copies/triples and copied assets, passed or failed; separate verified copy elsewhere no longer required.',
 'mandatoryGuards':['Committed evidence; every retained small file matched to Git blob','Published SHA256 and length for every removed file','No container mount, open process file, open/next run/current or retained release/rollback kit reference','Not latest passing proof of current candidate until release post-deploy passes','Per-file receipt on162 with evidence/reference checks and df before/after'],
 'excluded':['Production DB volume','All /opt/lims/backups and October3 restorepoints','050000raw','Non-derived raw logs/receipts','Analytical/QC/audit records of record','Blanket prune'],
 'r2r3r4r5':'Unchanged; R2 actualmax-used-space5GB aftersuccessfulbuild protects shared/inuse evenabove5GB; R3listing/R4computed+10GB/R5nobackupremoval.',
 'frozenBuildSource':'2c0cebca unchanged; prunesnothing; amendment does not confer SourcePASS or new cleanup operator authority.',
 'buildSourceRequest':6198527574,'actualNewBuildSourcePassClaimed':False,'nativeHandoffDeliveredOnce':True,
 'new162Comments':[{'id':c['id'],'created_at':c['created_at'],'body':c['body']} for c in json.loads(raw['coordination-after-handoff-original.json']) if c['id']!=6198527574],
 'hostConnectionsByThisRetainer':0,'builds':0,'proofs':0,'cleanupOperations':0,'productionOperations':0}
js('boundary-record.json',record)
lead="""## 2026-10-15 actual R1 amendment6198899941; NEW build native handoff delivered ONCE

Unedited actual Claude-app amendment6198899941 at18:05:47UTC records YY Allow deletion18:05:20UTC; fresh actual native LIMS Audit/Lab workflow thread choice and completed reply independently read. R1 now permits eligible CLOSED proof-run derived DB working copies/triples and copied assets without another verified copy, ONLY with committed/hash-matched small evidence, published each-file SHA256+length, no mount/open-process/open-next-run/current-retained-release/rollback-kit references, and not latest passing current-candidate proof until postdeploy passes. Per-file162receipt/referencechecks/df before+after mandatory. Production DB/backups/October3 restorepoints/050000raw/non-derived logs-receipts/records of record protected; no blanketprune. R2max-used-space5GB/sharedinuse/R3listing/R4computed+10GB/R5nobackupremoval unchanged. This supersedes earlier R1 pendingYY/separate-copy-required language ONLY.

ONE previously UNSENT build-source native handoff now DELIVERED at18:12-18:14UTC tool boundary: fresh actualClaude7867734/LIMS Audit/Lab workflow, both empty composers, rightcaret, ownedHEAD+END, oneReturn, actual sent6198527574/2c0/source5b267/mainCI3167 bubble+emptyright/Cultivating verified. No activation/navigation/human-card answer; immediate accessibility lag labelled/screenshots govern. MainCImerge+R1ack bundledONLYhere; no duplicateGH/request/ACK/native. Exact build source2c0/all5hashes/28both unchanged/all1333inputs reverified; actual NEW build SourcePASS still required. No package/root/unit/build/proof/cleanup/kit/gate/deploy or productionoperation. Full originalamendment/nativeactualtext/currentAPIs/publication at WP/host-capacity-r1-amendment-6198899941-20261015. Samewriter/branch; all science/refusal/report/hash/copy/race/600/805/forwardonly/no103/history held.

"""
readmes=[R/'WP/audit-release-eb6de2e8/README.md',R/'WP/runtime-recovery-kobo/README.md']
for p in readmes:p.write_bytes(lead.encode()+p.read_bytes())
paths=[p for p in sorted(D.rglob('*')) if p.is_file()]+[pathlib.Path(__file__),*readmes]
bindings=[]
for p in paths:
 v=p.read_bytes();bindings.append({'path':p.relative_to(R).as_posix(),'length':len(v),'sha256':sha(v),'gitBlobOid':oid(v)})
js('publication-index.json',{'baseAudit':BASE,'amendmentId':6198899941,'toolingCommit':TOOLING,'files':bindings,'hostOrProductionOperations':0})
paths.append(D/'publication-index.json')
names=[p.relative_to(R).as_posix() for p in paths];assert len(names)==len(set(names))
git('-c','core.autocrlf=false','add','-f','--',*names)
assert set(git('diff','--cached','--name-only').decode().splitlines())==set(names)
tree=git('write-tree').decode().strip()
for p,n in zip(paths,names):
 v=git('show',tree+':'+n);assert v==p.read_bytes() and oid(v)==git('rev-parse',tree+':'+n).decode().strip()
git('commit','-m','Retain R1 amendment6198899941 and single build-source native handoff')
head=git('rev-parse','HEAD').decode().strip()
git('push','origin','audit/release-eb6de2e8')
assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head
assert not git('diff','--cached','--name-only').strip()
print(json.dumps({'audit':head,'rawOidShaVerifiedBlobs':len(paths),'amendmentId':6198899941,'nativeHandoffDeliveredOnce':True,'all1333AndFiveSourceUnchanged':True,'new162Comments':[{'id':c['id'],'created_at':c['created_at']} for c in json.loads(raw['coordination-after-handoff-original.json']) if c['id'] not in [6198527574,6198899941]],'productionOperations':0}))

