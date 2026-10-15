"""Publish NEW tested build-only source and owned preparation/test evidence."""
import hashlib,json,pathlib,subprocess
R=pathlib.Path(__file__).resolve().parents[2];D=R/'WP/batch-build-startup-be837974-20261015';BASE='3167ea258780a8590337e89e233083a8ef272695'
def git(*args):
 p=subprocess.run(['git','-c','core.longpaths=true',*args],cwd=R,capture_output=True);assert p.returncode==0,p.stderr.decode('utf-8','replace');return p.stdout
def sha(b):return hashlib.sha256(b).hexdigest()
def oid(b):return hashlib.sha1(('blob '+str(len(b))+'\0').encode()+b).hexdigest()
assert not (D/'source-publication-index.json').exists()
assert git('rev-parse','HEAD').decode().strip()==BASE and git('branch','--show-current').decode().strip()=='audit/release-eb6de2e8'
assert not git('diff','--cached','--name-only').strip()
assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==BASE
v=json.loads((D/'source-local-host-verification-once/exit-original.json').read_bytes())
assert v['status']=='PASS_NEW_BUILD_SOURCE_GUARDS_NOT_EXECUTION' and v['localGuardTests']==v['actualHostGuardTests']==28 and v['sourceSha256Before']==v['sourceSha256After']
for n,h in v['sourceSha256Before'].items():assert sha((D/n).read_bytes())==h
readme="""# NEW be837974 application build source

Complete NEW five-file BUILD-ONLY graph for be8379745bdfae52ce46496ff26514dc7d729640/tree676b01e71211786d1aeace50f19a0b2c9f9c482e, after PR298 actual source-only PASS6195167175 and merge. MainCI38772398721 CLOSED SUCCESS17:30:10UTC/373suites5679tests/exact373inventory/client/bothrealDocker/boundary/readiness; all22archiveentry originals and50verified blobs published3167ea258780a8590337e89e233083a8ef272695 at WP/startup-order-readiness-20261015/main-ci38772398721-closed-originals-once. CI images are disposable and not production builds/startup qualification.

Proposed exact first root /opt/lims/releases/workflow-batch-build-be837974-20261015T180000Z is UNCREATED. No operational package/upload/unit/build/proof/cleanup/kit/gate/deployment has run. NEW actual all-five-hash Source review: PASS with all literal bindings is REQUIRED. Old6608/cde8/B5/PASS/root is not reused. Existing raw-Git application archive verification, all4actualsourceaudit+merge/currentmainCI checks, physical Docker+containerd accounting and all lifetime/memory/floor/500MB guards remain. Historical failure/adoption-refusal references stay immutable and do not authorize this graph or reclassify old failures. New receipt NEW_STARTUP_APP_IMAGE_BUILT_NOT_PROVED_OR_DEPLOYED binds the new revision/image.

R4 model: exact package input lengths rounded to4096B plus2MiB spec/metadata allowance (build-input spec <=1MiB); exact raw-Git source file lengths rounded to4096B plus2blocks/directory+1MiB, then25percent extraction margin rounded up. Verified dependency node_modules entries are not extracted. BEFORE ROOT required free =10556150894B fixedfloor+4GiB buildreserve+10,000,000,000B additionalheadroom+packageallowance+sourceextractionallowance. Immediately BEFORE UNIT the package is already charged, leaving sourceextraction as future allocation. Immediately BEFORE DOCKER BUILD both are charged, leaving fixedfloor+4GiB+10GB. No double-counting own consumption. Exact plan/inputs/sourceindex/planSHA/specsize revalidated locally and onhost. Launcher fresh gates use a hash-verified reviewed pure contract in memory and STAT/statvfs ONLY on required real nonalias /opt/lims,/var/lib/docker,/var/lib/containerd; all3paths/4096block/device/integerfree/one-byte-short refusal. Shared-FS values are not additive. Controller repeats capacity after extraction and records capacity-before-build-original.json before Docker. Actual next-build fit is NOT established by source tests or old42GB/cleanup estimates.

Full actual performance direction6189025975/standingrule6189658753/activation6189669837/amendment6191219093 are separately pinned by id/body/created/updated/Claudeappidentity. Raw responses retained; permissions metadata excluded from semantic projection. Fresh authority/main/CI/all4audits/review/later-rejection guards before upload and immediately before launch. All five source files are closed/hash-bound.

Physical accounting remains exact bounded du -s -B1 of NEWownedroot, disjoint Docker buildkit/overlay2/image/containerd and REQUIRED /var/lib/containerd before/after; real devices/aliases/complete integer rows/descendant mounts/default containerd PID/configSHA/root-state guard;120s/64KiB measurement caps/500000000B unexplained STOP. No volume/DB traversal. Memory805306368/Swap0/blankouterNODE_OPTIONS/build1800/unit2700/Restartno/UMask0077; daemon/build-worker config unchanged. Preflight failure consumes boundary and starts no build; failure after build keeps all artifacts/no success receipt; uncertain outcomes inspect SAMEroot/unit, never redispatch. No heapraise/checkdisable/oldimage start/restore/retry/rebuildretag/cleanup.

R1 NOproofDBremovalpendingYY. R2 AFTER-successful-build actualmax-used-space5GB/inuse+shared protected even above5GB remains a separate bounded-source/item-receipt obligation; THIS BUILD-ONLY GRAPH PRUNES NOTHING. R3 imagesLISTONLY/R5 no backup removal. No application/client/Dockerfile/Compose/CI source edits.

CLOSED28local+28ACTUALhostPython3.9 guard tests/all5compile/hashunchanged. Host tested source in memory/no remote source files/operators/productionconnections. All old20guards retained plus fresh capacity/phase/one-byte-short/changedblock/alias/missingpath/tamperedsource-package and authority-binding guards. Source preparation refusals and beforebytes retained honestly; no test replay. A publisher tool-code preparation SyntaxError occurred before publisher-file creation, retained as transcription in publication index.

Later NEW image-bound proof source/all-hash ClaudioPASS/fresh computedR4+10GB/NEWproofroot required; NEVERcde8/B5/100000retry. No production600s805qualification yet. All science214/four209 directions/refusalCODES+CONDITIONS/fullreports/impact/invalidStoredAnalysisSampleCount/sampleownerlists/approvednonzeroSTOP/nonzerolistsYY/separateClforwardremedy/fullhash/copyrace/600/805/retainedDBWALSHMreadersbackupsassetsreceiptsstoppedcontainers/history/humandrafts/no103APPLYGO remain. JobsONnaturalintake/broadpostflights/exactkitreview/freshsingleusegate still precede production;206214209 undeployedOPEN.
"""
with (D/'README.md').open('x',encoding='utf-8',newline='\n') as f:f.write(readme)
lead="""## 2026-10-15 NEW be837974 build-source28 local+host guards PASS

MainCI38772398721 CLOSED SUCCESS373/5679/all22originalentries/client/bothDocker/boundary/readiness retained3167ea258780a8590337e89e233083a8ef272695. NEW complete five-file BUILD-ONLY source WP/batch-build-startup-be837974-20261015/README.md binds newbe837974/tree676b/all4audits/currentCI/fresh rule pins. CLOSED28local+28actualhostPython3.9/all5compile/hashunchanged; no operator/remote-sourcefile writes. Computed R4 raw-source/package/fixedfloor/4GiB PLUS10GB before root/unit/build; actual launch fit not established. Exact180000root/package/unit UNCREATED; NEW all-hash Claudio SourcePASS REQUIRED/not obtained. R2 AFTER-success actualmax-used-space5GB/sharedinuse protection remains separate bounded-source obligation; this builder prunes nothing. R1 no proofDBremovalpendingYY/R3listing/R5nobackupremoval; allscience/refusal/report/hash/copy/race/600/805/forwardonly/no103/history/human protections hold. Native fresh uniqueClaude capture MINIMIZED/no activationinput/newread; merge/mainCI ACK UNSENT. No build/proof/cleanup/kit/gate/deploy/productionoperation.

"""
readmes=[R/'WP/audit-release-eb6de2e8/README.md',R/'WP/runtime-recovery-kobo/README.md']
for p in readmes:p.write_bytes(lead.encode()+p.read_bytes())
helpers=[R/'WP/backlog-resume-20261013'/n for n in ['prepare-startup-be837974-build-source-once.py','prepare-startup-be837974-build-source-structural-successor-once.py','verify-startup-be837974-build-source-local-host-once.py']]
paths=[p for p in sorted(D.rglob('*')) if p.is_file()]+helpers+[pathlib.Path(__file__)]+readmes
bindings=[]
for p in paths:
 raw=p.read_bytes();bindings.append({'path':p.relative_to(R).as_posix(),'length':len(raw),'sha256':sha(raw),'gitBlobOid':oid(raw)})
index=D/'source-publication-index.json'
with index.open('x',encoding='utf-8') as f:json.dump({'baseAudit':BASE,'status':'NEW_BUILD_SOURCE28_LOCAL_HOST_VERIFIED_NOT_APPROVED_OR_EXECUTED','candidate':'be8379745bdfae52ce46496ff26514dc7d729640','files':bindings,'productionOperations':0,'publisherPrepRefusal':{'kind':'TOOL_OUTPUT_TRANSCRIPTION','error':'SyntaxError: Unexpected identifier Source in functions exec source template; before publisher-file creation','oldSourceUnchanged':True}},f,indent=2)
paths.append(index);names=[p.relative_to(R).as_posix() for p in paths];assert len(names)==len(set(names))
git('-c','core.autocrlf=false','add','-f','--',*names)
assert set(git('diff','--cached','--name-only').decode().splitlines())==set(names)
tree=git('write-tree').decode().strip()
for p,n in zip(paths,names):
 raw=git('show',tree+':'+n);assert raw==p.read_bytes() and oid(raw)==git('rev-parse',tree+':'+n).decode().strip()
for n,h in v['sourceSha256Before'].items():assert sha((D/n).read_bytes())==h
git('commit','-m','Prepare be837974 build source with fresh R4 computed capacity gates')
head=git('rev-parse','HEAD').decode().strip();git('push','origin','audit/release-eb6de2e8')
assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head
print(json.dumps({'audit':head,'rawVerifiedOwnedBlobs':len(paths),'localGuards':28,'hostGuards':28,'operatorsExecuted':0,'productionOperations':0}))

