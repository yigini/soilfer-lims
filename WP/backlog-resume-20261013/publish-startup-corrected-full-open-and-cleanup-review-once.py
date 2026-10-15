"""Publish immutable new full-run opening metadata and actual independent cleanup review."""
import datetime,hashlib,json,pathlib,re,subprocess
R=pathlib.Path(__file__).resolve().parents[2];D=R/'WP/startup-order-readiness-20261015';F=D/'full-guard-pinned-copy-ordinary-once';O=D/'corrected-full-open-and-cleanup-review-once'
BASE='7611ae485d1a29818d62fb53c32825abaac409f1'
def git(*args):return subprocess.check_output(['git','-c','core.longpaths=true',*args],cwd=R,stderr=subprocess.PIPE)
def sha(value):return hashlib.sha256(value).hexdigest()
assert not O.exists() and not (F/'summary.json').exists()
assert git('rev-parse','HEAD').decode().strip()==BASE and not git('diff','--cached','--name-only').strip()
assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==BASE
meta=json.loads((F/'open-metadata.json').read_bytes());assert meta['inventory']==373 and meta['expectedTests']==5679 and meta['frozenPaths']==1333
frozen=json.loads((F/'source-before.json').read_bytes());assert all(sha((R/n).read_bytes())==v for n,v in frozen.items())
raw=subprocess.check_output(['gh','api','repos/yigini/soilfer-lims/issues/comments/6191219093'],cwd=R)
comment=json.loads(raw);assert comment['id']==6191219093 and comment['performed_via_github_app']['slug']=='claude' and comment['created_at']=='2026-10-15T11:42:12Z'
assert 'It complies.' in comment['body'] and 'no proof DB copy is removed under R1' in comment['body'] and 'max-used-space' in comment['body']
O.mkdir();(O/'actual-claudio-cleanup-review-6191219093-original.json').write_bytes(raw)
(O/'actual-claudio-cleanup-review-6191219093-readable.txt').write_text(comment['body'],encoding='utf-8')
log=(F/'stderr-original.log').read_text(encoding='utf-8');headers=re.findall(r'^(?:PASS|FAIL) .*',log,re.M)
record={'status':'NEW_FULL_RUNNING_OPEN_METADATA_ONLY','observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'session':12570,'helper':'verify-startup-guard-pinned-copy-full-ordinary-once.py','appSourceAudit':BASE,
    'openMetadata':meta,'observedSuiteHeaders':len(headers),'observedFailHeaders':[row for row in headers if row.startswith('FAIL')],
    'all1333FrozenInputsUnchanged':True,'finalSummaryOrPassNotYetObserved':True,
    'activeStdoutStderrLedgerNotPublishedAsClosed':True,
    'cleanupIndependentReview':{'id':6191219093,'actualGithubAppRead':True,'nativeReadNotClaimed':True,
        'receiptComplies':True,'r1NoProofDbCopyRemovalPendingYY':True,'r2CapMaxUsedSpace5GBProtectSharedInUse':True,
        'r4FreshComputedRequirementPlus10GBBeforeEachBuildProof':True,'noNewCleanupOrOperationAuthorized':True},
    'productionOperations':0,'cleanupReplayed':False,'appPrReady':False}
recordFile=O/'opening-and-actual-cleanup-review.json';recordFile.write_text(json.dumps(record,indent=2),encoding='utf-8')
immutable=['open-metadata.json','source-before.json','existing-policy-chart-order-tests-unchanged.json','config-original.json','config-stderr-original.log',
    'command.json','inventory-original.json','inventory-stderr-original.log','visible-local-storage.json','derived-help-manifest-before-original.json']
paths=[F/name for name in immutable]+list(O.iterdir())+[pathlib.Path(__file__),
    R/'WP/backlog-resume-20261013/prepare-startup-guard-pinned-copy-full-runner-once.py',
    R/'WP/backlog-resume-20261013/verify-startup-guard-pinned-copy-full-ordinary-once.py']
readme=R/'WP/audit-release-eb6de2e8/README.md'
lead='''## 2026-10-15 NEW corrected full373/5679 ACTIVE / independent cleanup review complies

Corrected36-path app draft and every closed failure/successor byte published7611ae48 (131raw verified ownedblobs). Final focused5suites167/167PASS0failpending, including both original full failed suites, all26 report equivalence/exactly-once checks, all3 actual owned WAL cases, earlier/after-chart order races and retained-copy tamper invalidation. All371 original test sources unchanged. Original full76923 CLOSED FAILED373/5672 with2fail retained787aa569, never rerun/overwrite. ONE genuinely NEW full ordinary helper verify-startup-guard-pinned-copy-full-ordinary-once.py / session12570 is now ACTIVE:373uniqueinventory/expected5679tests/1333frozeninputs. Both ordinary setups/stockassertions/oneworker512000000/blankNODE_OPTIONS/local physical-retention+byte-identical-visible-storage fixtures only. No final total/PASS/CI/startupqualification. SOURCEFROZEN: no edits/interruption/redispatch/concurrentrunner; observe SAME12570 at reasonable interval, retain CLOSED originals honestly with a new unique retainer after completion. Only immutable opening metadata/command/config/inventory/source-before and captured derived-output-before published; active logs/ledger are not closed evidence.

Actual Claudio independent cleanup review6191219093/11:42:12UTC FULL GitHub-app text read/retained: receipt6190239878/aced589b complies with exact approval/standing rule; max-used-space5GB amendment accepted, shared/in-use protected even above5GB; actual verified copy elsewhere required. EXPLICIT R1 clarification: NO proof DB copy removed under R1 pending YY answer. R4 next image-bound run requirement+10GB measured fresh; current fit not established. Native read not claimed; human other-project boundary preserved/no interruption/no duplicate receipt/cleanup replay. P1 actual skip remains flat-file allowlist46files+4dirs, not proven changed file bytes. No production operation/appPR/newCI/build/proof/deploy/no103. Same writer/history/science/refusal/600/805306368/forward-only guards hold.

'''
readme.write_bytes(lead.encode()+readme.read_bytes());paths.append(readme)
bindings=[]
for p in paths:
    value=p.read_bytes();bindings.append({'path':p.relative_to(R).as_posix(),'length':len(value),'sha256':sha(value),
        'gitBlobOid':hashlib.sha1(('blob '+str(len(value))+'\0').encode()+value).hexdigest()})
index=O/'publication-index.json';index.write_text(json.dumps({'sourceAudit':BASE,'status':'CORRECTED_FULL_OPEN_NOT_QUALIFICATION',
    'session':12570,'openMetadata':meta,'actualCleanupReview':6191219093,'files':bindings,'productionOperations':0},indent=2),encoding='utf-8');paths.append(index)
names=[p.relative_to(R).as_posix() for p in paths];git('-c','core.autocrlf=false','add','-f','--',*names)
assert set(git('diff','--cached','--name-only').decode().splitlines())<=set(names)
tree=git('write-tree').decode().strip()
for p,n in zip(paths,names):
    value=git('show',tree+':'+n);oid=git('rev-parse',tree+':'+n).decode().strip();assert value==p.read_bytes() and hashlib.sha1(('blob '+str(len(value))+'\0').encode()+value).hexdigest()==oid
assert all(sha((R/n).read_bytes())==v for n,v in frozen.items())
git('commit','-m','Record corrected full-suite opening and independent cleanup compliance review')
head=git('rev-parse','HEAD').decode().strip();git('push','origin','audit/release-eb6de2e8');assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head
print(json.dumps({'head':head,'rawVerifiedOwnedBlobs':len(paths),'session':12570,'fullStillOpen':not (F/'summary.json').exists(),
    'suiteHeaders':len(headers),'failHeaders':record['observedFailHeaders'],'cleanupReview':6191219093}))
