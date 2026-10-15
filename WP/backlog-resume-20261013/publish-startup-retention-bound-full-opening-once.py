"""Publish only immutable opening records of the new exact-directory full run."""
import datetime,hashlib,json,pathlib,re,subprocess
R=pathlib.Path(__file__).resolve().parents[2];D=R/'WP/startup-order-readiness-20261015';F=D/'full-pinned-copy-retention-bound-ordinary-once';O=D/'retention-bound-full-opening-once'
BASE='3b0460b803589f280721f8d7ccc1b72f4b2fa507'
def git(*args):return subprocess.check_output(['git','-c','core.longpaths=true',*args],cwd=R,stderr=subprocess.PIPE)
def sha(value):return hashlib.sha256(value).hexdigest()
assert not O.exists() and not (F/'summary.json').exists()
assert git('rev-parse','HEAD').decode().strip()==BASE and not git('diff','--cached','--name-only').strip()
meta=json.loads((F/'open-metadata.json').read_bytes());assert meta['inventory']==373 and meta['expectedTests']==5679 and meta['frozenPaths']==1333 and meta['sourceAudit']==BASE
frozen=json.loads((F/'source-before.json').read_bytes());assert all(sha((R/n).read_bytes())==v for n,v in frozen.items())
headers=re.findall(r'^(?:PASS|FAIL) .*',(F/'stderr-original.log').read_text(encoding='utf-8'),re.M)
O.mkdir()
record={'status':'RUNNING_METADATA_ONLY','observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'session':29474,
    'helper':'verify-startup-pinned-copy-retention-bound-full-ordinary-once.py','openMetadata':meta,'appSourceAudit':'7611ae485d1a29818d62fb53c32825abaac409f1',
    'observedSuiteHeaders':len(headers),'observedFailHeaders':[row for row in headers if row.startswith('FAIL')],
    'all1333FrozenInputsUnchanged':True,'closedResultNotObserved':True,'activeLogsOrLedgerNotPublishedAsClosed':True,
    'localSetupExactRootPreflights':[0,1,1],'priorZeroTestRefusalRetained':'full-retention-refusal-closed-once/publication-index.json',
    'actualCleanupComplianceReview':6191219093,'r1NoProofDbRemovalPendingYY':True,'productionOperations':0}
(O/'opening-observation.json').write_text(json.dumps(record,indent=2),encoding='utf-8')
immutable=['open-metadata.json','source-before.json','existing-policy-chart-order-tests-unchanged.json','config-original.json','config-stderr-original.log',
    'command.json','inventory-original.json','inventory-stderr-original.log','visible-local-storage.json','derived-help-manifest-before-original.json']
paths=[F/n for n in immutable]+[O/'opening-observation.json',pathlib.Path(__file__)]
readme=R/'WP/audit-release-eb6de2e8/README.md'
lead='''## 2026-10-15 exact-retention-bound full373/5679 ACTIVE / corrected app167focusedPASS

ONE NEW verify-startup-pinned-copy-retention-bound-full-ordinary-once.py / session29474 ACTIVE on373uniqueinventory/expected5679tests/1333frozeninputs, sourceAudit3b0460b8/appsource7611ae48. LOCAL retention copy is now bound to this exact new evidence directory; real valid/wrong-root/non-test preflights0/1/1 retained. Both ordinary setups/stock assertions/oneworker512000000/blankNODE_OPTIONS and LOCAL retention+byte-identical visible assets only. No final total/PASS/CI/startup qualification. SOURCEFROZEN: no edits/interruption/redispatch/concurrentrunner; observe SAME29474 at reasonable interval. After CLOSED retain full original report/logs/exit/exactinventory/source-after honestly via NEW unique retainer. Opening publication includes immutable metadata/config/command/inventory/source-before/captured manifest-before only; active logs and physical ledger are not closed records.

Original full76923 FAILED371/373suites5670/5672tests2fail retained787aa569. Corrected app36paths + every closed focused failure/successor published7611ae48/131raw verifiedblobs: final5suites167PASS0failpending including both original failures, all3 genuine owned WAL cases, earlier order snapshot race and copy-tamper cache invalidation; all371 stock test sources unchanged. Intermediate full12570 CLOSED zero-test setup refusal before all373test bodies, unchanged app/source, retained34raw3b0460b8/no replay; earlier opening publisher refused before mutation after closure and stays consumed. All original failed bytes remain. ActualCl6191219093 independent cleanup compliance review retained: R2max-used-space5GB cap/shared-in-use protection accepted, R1NO proof DB copy removal pendingYY, R4fresh image-bound computed requirement+10GB. No native read/other-project interruption/duplicate cleanup receipt/cleanup replay. No appPR/newCI/build/proof/deploy/productionSQL/no103. Same writer/science/refusal/fullhash/copy/race/600/805306368/forward-only/history guards hold.

'''
readme.write_bytes(lead.encode()+readme.read_bytes());paths.append(readme)
bindings=[]
for p in paths:
    value=p.read_bytes();bindings.append({'path':p.relative_to(R).as_posix(),'length':len(value),'sha256':sha(value),
        'gitBlobOid':hashlib.sha1(('blob '+str(len(value))+'\0').encode()+value).hexdigest()})
index=O/'publication-index.json';index.write_text(json.dumps({'baseAudit':BASE,'status':'FULL_RUNNING_OPEN_METADATA_ONLY','session':29474,
    'appSourceAudit':'7611ae485d1a29818d62fb53c32825abaac409f1','files':bindings,'productionOperations':0},indent=2),encoding='utf-8');paths.append(index)
names=[p.relative_to(R).as_posix() for p in paths];git('-c','core.autocrlf=false','add','-f','--',*names)
assert set(git('diff','--cached','--name-only').decode().splitlines())<=set(names)
tree=git('write-tree').decode().strip()
for p,n in zip(paths,names):
    value=git('show',tree+':'+n);oid=git('rev-parse',tree+':'+n).decode().strip();assert value==p.read_bytes() and hashlib.sha1(('blob '+str(len(value))+'\0').encode()+value).hexdigest()==oid
assert all(sha((R/n).read_bytes())==v for n,v in frozen.items())
git('commit','-m','Record exact-retention-bound corrected full-suite opening')
head=git('rev-parse','HEAD').decode().strip();git('push','origin','audit/release-eb6de2e8');assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head
print(json.dumps({'head':head,'rawVerifiedOwnedBlobs':len(paths),'session':29474,'fullStillOpen':not (F/'summary.json').exists(),'observedHeaders':len(headers),'failHeaders':record['observedFailHeaders']}))
