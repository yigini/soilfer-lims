"""Publish the complete new startup-only source and closed171 local/host evidence."""
import hashlib,json,pathlib,subprocess,sys
REPO=pathlib.Path(__file__).resolve().parents[2];S=REPO/'WP/batch-proof-startup-forward-cde8-20261015';BASE='4173a26209060a462479c30ee67c30cc9eb40de0'
sys.path.insert(0,str(S));from proof_contract import FILES,PRIOR_FILES,PRIOR_FILES_SHA,COMPOSE_PIN,canonical,sha,require
from proof_budget import TABLE,TABLE_SHA,TOTAL_DB_COPIES,DB_EQUIVALENTS,copy_site_guard,EXPECTED_SITES
from prepare_proof import raw_git
def cmd(*a,payload=None):return subprocess.check_output(a,cwd=REPO,input=payload)
require(cmd('git','rev-parse','HEAD').decode().strip()==BASE and not cmd('git','diff','--cached','--name-only').strip(),'Writer/staging moved')
require(cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==BASE,'Remote moved')
proof=json.loads((S/'source-local-host-verification-complete171-once/exit-original.json').read_bytes());require(proof['status']=='PASS' and proof['localExitCode']==proof['hostExitCode']==0 and proof['expectedTests']==171 and proof['sourceSha256Before']==proof['sourceSha256After']=={n:sha((S/n).read_bytes()) for n in FILES},'Actual frozen171 proof differs')
for n in FILES:compile((S/n).read_bytes(),n,'exec')
copy_site_guard({n:(S/n).read_bytes() for n in EXPECTED_SITES});require(TOTAL_DB_COPIES==24 and DB_EQUIVALENTS==30 and len(TABLE)==2 and len(PRIOR_FILES)==20,'Complete graph/model differs')
for n,pin in PRIOR_FILES.items():
 b,m=raw_git('dd496777400e9c2f4f0ace73009f8cf8c86022d0',pin['path']);require(m=={k:pin[k] for k in ['bytes','sha256','blob']} and b==(S/'bound-input-records'/n).read_bytes(),'Bound real prior blob differs '+n)
compose,m=raw_git('cde8c8896f5f9d5f1ab07b0ae16b1a765e0a6367','docker-compose.yml');require(m=={k:COMPOSE_PIN[k] for k in ['bytes','sha256','blob']} and compose==(S/'compose-source.yml').read_bytes(),'Compose pin differs')
assessment=json.loads((S/'reference-owned209-capacity-metadata-once/reference-assessment.json').read_bytes());require(assessment['N']==24 and assessment['equivalents']==30 and assessment['tableSha256']==TABLE_SHA and assessment['slackBytes']==1339976594,'Reference model differs')
index={'files':{n:{'sha256':sha((S/n).read_bytes()),'bytes':(S/n).stat().st_size} for n in sorted(FILES)},'actualLocalTests':171,'actualHostTests':171,'proofClosedUtc':proof['closedUtc'],'inputPins':20,'priorEvidenceIndexSha256':PRIOR_FILES_SHA,'composePin':COMPOSE_PIN,'direction':6187223904,'noOperatorsExecuted':True}
with (S/'complete-source-static-index.json').open('xb') as f:f.write(canonical(index)+b'\n')
with (S/'declared-copy-budget-table.json').open('xb') as f:f.write(canonical({'table':TABLE,'tableSha256':TABLE_SHA,'declaredDbTriples':24,'dbEquivalents':30,'marginPercent':25,'minimumDbEquivalents':0,'assetsReserveMultiplier':3,'freshReference':assessment,'copySiteGuardPassedOnRealSources':True,'sameBoundApplicationStartupSnapshotMaximaAsAccepted080000':True})+b'\n')
doc='''# New installed209 startup-only forward proof source

This is a COMPLETE new source graph for Claudio's exact review under actual scope direction [6187223904](https://github.com/yigini/soilfer-lims/issues/162#issuecomment-6187223904), posted07:50:16UTC. It is not approved or executed. The new proposed root is `/opt/lims/releases/workflow-batch-startup-forward-cde8c889-20261015T090000Z`; no operational package, host root or unit has been created. SourcePASS, current app/source authority, fresh capacity before root and unit, and unused root/unit are required before one attempt. Every unknown outcome is inspected at that same root, never replayed.

080000 remains FAILED and immutable. Its accepted214/209 installation evidence is carried; this graph never replays206/214/209, target-policy, production snapshotting or any failed startup/container. It runs exactly TWO NEW ordinary jobsOFF startups, each from the sealed installed209 backup. SQL is used only for NEW owned stopped seals, never old input databases. No app/client/Dockerfile/Compose/CI changes, image rebuild/retag, cleanup, jobsON, kit, gate or deployment.

## Inputs and independent provenance

`proof_contract.PRIOR_FILES` pins20 exact raw Git blobs from dd496777400e9c2f4f0ace73009f8cf8c86022d0 by path, Git OID, SHA256 and length. The preparer independently fetches/verifies them. These include080000 full4517-row closed inventory, exact failure, source/PASS/input authority, installed209 raw+reader copy authorities/seal/recorded logical state,214+209 stage/preservation, installation result, full8060-context chart/order impact, canonical policy NO_OP, original baseline/asset handoff and carried input record. All20 real blobs are also retained here for pure tests; they are metadata, not database copies.

`validate_records` requires the exact consumed080000 failure and source/image/YY identities, nine stopped retained containers, accepted214/209 modes and integer0 repeat/backfill, preservation112tables/41then42receipts, canonical policy PRESENT/CANONICAL/NO_OP0, scientific approved-amendment STOP, installed209 raw/reader/backup identities and recorded11242 logical hash/integrity/FK0. `retained_guard` hashes/stat-checks each raw/reader/backup triple and every old package file against the closed inventory, and verifies070000 raw assets against their independent handoff. It is called before copying, AFTER EACH startup's clone+asset copy before create/start, after each stopped seal, and at final closure. Old raw files are never opened in SQLite or made writable. The recorded logical state is compared with only the new stopped backups.

070000 and080000 are required read-only dependencies; they remain retained. The published33.613GB/16-root conditional disk estimate is not a safe-delete list or cleanup authority. A separate native dependency correction was delivered once; no human card has been answered.

## Derived healthcheck and actual Docker CLI representation

`compose-source.yml` is the exact cde8c889 raw Git blob, bound by length/SHA256/GitOID in `COMPOSE_PIN`. `proof_health` validates those bytes BEFORE parsing the single lims healthcheck block, rejects missing/duplicate/unexpected fields and derives the exec argv, retry count and nanosecond durations from those bytes. No probe or duration values are retyped in runtime source.

Docker CLI's `--health-cmd` is represented as `CMD-SHELL`, unlike Compose's original `CMD` array. This is established by the [Docker CLI source](https://github.com/docker/cli/blob/master/cli/command/container/opts.go) and the [create options](https://docs.docker.com/reference/cli/docker/container/create/). The graph retains both representations: original `composeTest`, and the exact CLI config `Test=["CMD-SHELL", "exec "+shlex.join(composeTest[1:])]`. `exec` preserves the parsed wget argv without an extra long-lived shell. Thus the expected Config.Healthcheck test is the DERIVED CLI representation, not an impossible literal Compose CMD-array equality through this flag. Interval, timeout, retries and start period equal the parsed values exactly; optional StartInterval is accepted only at zero.

`docker create` receives all five derived health flags. `Docker.validate` asserts the entire expected test/duration fields after create BEFORE any start, at each readiness validation and after stop. The startup performs an additional explicit prestart assertion before recording its default-entrypoint attempt. Null, changed duration/test, extra field or incompatible limit/mount/flag STOPs before start. The running container's `unhealthy` state produces a retained exact state/healthcheck receipt and an IMMEDIATE STOP; missing/unknown running health also refuses. No600s wait for unhealthy.

The600-second readiness deadline, networkNONE, memory805306368/blankNODE_OPTIONS/no swap, exact27entrypointNO_OP0+26READY0 inventories, HTTP200health/200login/401unauthorized receipt probes, stopped full logical equality, retained containers and all floor/physical/memory/readiness/headroom/history/scientific guards remain. Health alone does not qualify a startup; HTTP and stopped-state checks must pass. Failures use the independent strictly-owned stop and preserve everything; only a separately audited forward fix can follow.

## Exact budget and capacity

The real Python AST copy-site guard passes. There are ONLY startup-1 and startup-2 stages. Each has one backup clone, two seal triples, one seal backup, one asset tree and eight existing internal application policy snapshots (four entrypoint/four READY), totaling12 DB triple equivalents. N24 =>ceil(24*1.25)=30, minimum0 explicitly permitted by6187223904. All12 executed source files are bound, including the budget/health/input files and launcher/preparer. No prior input copy stage or installer/impact copy producers exist.

The unchanged consumption-aware Budget reserves remaining stages+padding and enforces per-stage actual disjoint du-x growth caps with25% margin, floor10556150894,4GiB logs,3x assets,500MB unexplained-growth STOP and all retained releases/Docker/containerd. New inputs do not credit or remove old copies. The capacity probe measures metadata of the installed209 raw triple AND its backup and charges the larger conservative allocation, with stable before/after metadata; it does not open production content or SQL.

Fresh reference08:08:39.693551UTC: T563326976B/A5787648B, required31768290414B, free33108267008B across all3paths, slack1339976594B. This is REFERENCE ONLY. Launcher fresh gates before root and immediately before unit remain mandatory; insufficient space STOPs without cleanup/margin reduction.

## Closed verification and retained predecessors

FINAL171/171 local +171/171 ACTUAL host Python3.9.23, all12 compile/hash unchanged, are in `source-local-host-verification-complete171-once/exit-original.json`. Tests use only new retained synthetic local/host fixtures and recorded metadata. No operator, real Docker create, old SQL, production copy or default entrypoint is executed by them. Coverage includes missing/tampered Compose pin, null/mismatched healthcheck before start, unhealthy immediate STOP with evidence, healthy+HTTP two-startup control flow, failed HTTP, changed stopped state, actual Docker validation of flags/mounts/memory/health, required post-copy input rechecks, input/authority/row/receipt/policy tamper, exact24/30 budget and copy overrun/order/reserve/physical/mount/name/WAL guards.

Earlier163, extended170 and input-recheck170 successful source snapshots/logs remain honestly retained with their own bytes; only the final171 graph is submitted. `SOURCE_PREPARATION_ONLY.json` and initial19-pin index describe their historical preparation boundary; current20-pin index/static source index/final proof supersede those preparation-only labels. No failed operator has been replayed. Fixtures/source roots under /tmp and local Temp remain; no cleanup.

The final receipt can only be `FORWARD_TWO_JOBS_OFF_STARTUPS_PASS_FROM_BOUND_INSTALLED209_NOT_RELEASE_QUALIFIED`. JobsON natural intake and broader postflights still need separate source/proof; exact-kit review and fresh single-use gate remain later. #206/#214/#209 are merged and undeployed/open; historical#200 stays complete.

## Twelve raw source SHA256 bindings

```
'''
doc+='\n'.join(n+'='+r['sha256'] for n,r in index['files'].items())+'\n```\n'
with (S/'SOURCE_REVIEW.md').open('x',encoding='utf-8') as f:f.write(doc)
lead='## 2026-10-15 COMPLETE NEW startup-only graph171 local+host / exact SourceReview next\n\nActualClscope6187223904 implemented in twelve-file NEW WP/batch-proof-startup-forward-cde8-20261015, proposed090000startup-forwardroot UNCREATED/no operationalpackage/unit. FINAL171local+171actualhost3.9.23/all12compile/hashunchanged'+proof['closedUtc']+';20actualdd496777rawGitpins verified/canonicalpolicyNOOP/raw209readerbackupstate+fullpriorresults/allcopyASTN24/30equiv25percent/min0/3assets/table'+TABLE_SHA+'. Health derivespinnedcde8Composebytes/GitOID/SHA, CLI CMD-SHELL execargvderivedrepresentationexplicitlydocumented (ComposeoriginalCMDarraycannotbeliteralCLIrepresentation);all5flags/exactprestartConfigassert/unhealthyimmediateSTOP/evidence/unchanged600s27NOOP0READY26/HTTP200200401/fullstoppedstate. Inputhashstatonly/recheckafterEACHcloneassetsBEFOREstart/aftereachstoppedseal/closure;no oldSQL/206214209policyreplay/newproductioncopy/failedstartrestart. Oldproof_files+proof_diskbyteidenticalb9af; othernewsourcebound. Freshreference08:08:39T563326976/A5787648/free33108267008/required31768290414/slack1339976594 REFERENCEONLY/freshlaunchergatesmandatory. No new operator authority. NEXTONEconcreteNEWexactall12hashSourceReview/fullbindings/nativehandoff; actualNEWSourcePASS requiredbeforeANYoperationalpackage/root/launch. DoNOTwaitapprovalnonexistentgraph;graphNOWcomplete. AllYYsciencepolicy/retentionfloorlogs500MB/memory805blankheapSwap0/readiness600unit5400headroom60+600/forwardonlyno103humanhistoryguards hold. NOT_RELEASE_QUALIFIED/jobsONpostflights/exactkitfreshgate later. 080000CLOSEDFAILEDimmutable/dd496777allraws/NORMALhealthyunchanged; diskreport6ab31b4b/actualscope4173a262/handofffaec8522 bound. HumancleanupcardUNANSWERED;one dependencycorrectiondelivered/all16rootsstillretained. Noagents/newchat/worktree/checkout/concurrentwriter/broadstage/resetclean/unrelateddirt.\n\n'
readme=REPO/'WP/audit-release-eb6de2e8/README.md';readme.write_bytes(lead.encode()+readme.read_bytes())
helpers=['prepare-startup-forward-complete-source-successor-once.py','verify-startup-forward-source-local-host-once.py','verify-startup-forward-owned-health-successor-local-host-once.py','verify-startup-forward-input-rechecks-complete-local-host-once.py','verify-startup-forward-complete171-local-host-once.py','read-startup-forward-reference-stat-once.py']
fixed=[pathlib.Path(__file__),*[REPO/'WP/backlog-resume-20261013'/n for n in helpers],readme];paths=sorted(p for p in S.rglob('*') if p.is_file())+fixed
require(all(p.suffix not in ['.db','.sqlite','.pyc'] for p in paths),'No database/bytecode publication')
out=S/'source-publication-index.json';require(not out.exists(),'Consumed publication')
with out.open('xb') as f:f.write(canonical({'status':'COMPLETE_STARTUP_ONLY_SOURCE171_READY_FOR_NEW_EXACT_REVIEW_NOT_APPROVED','sourceStaticIndex':index,'budgetTableSha256':TABLE_SHA,'referenceCapacity':assessment,'operatorExecutions':0,'files':[{'path':p.relative_to(REPO).as_posix(),'bytes':p.stat().st_size,'sha256':sha(p.read_bytes())} for p in paths]})+b'\n')
paths.append(out);rels=[p.relative_to(REPO).as_posix() for p in paths]
cmd('git','-c','core.autocrlf=false','-c','core.longpaths=true','add','-f','--pathspec-from-file=-','--pathspec-file-nul',payload=b'\0'.join(n.encode() for n in rels)+b'\0');require(set(cmd('git','diff','--cached','--name-only').decode().splitlines())==set(rels),'Unowned staging')
def verify(head):
    entries={}
    for row in cmd('git','ls-tree','-r','-z',head,'--',S.relative_to(REPO).as_posix(),*[p.relative_to(REPO).as_posix() for p in fixed]).split(b'\0'):
        if not row:continue
        meta,name=row.split(b'\t');mode,kind,oid=meta.decode().split();require(kind=='blob' and mode in ['100644','100755'],'Raw regular blob required');entries[name.decode()]=oid
    require(set(entries)==set(rels),'Raw inventory differs');oids=[entries[n] for n in rels];data=cmd('git','cat-file','--batch',payload=('\n'.join(oids)+'\n').encode());at=0
    for p,oid in zip(paths,oids):
        end=data.index(b'\n',at);returned,kind,length=data[at:end].decode().split();size=int(length);b=data[end+1:end+1+size];require(returned==oid and kind=='blob' and hashlib.sha1(('blob '+str(size)+'\0').encode()+b).hexdigest()==oid and b==p.read_bytes(),'Independent raw blob differs');require(data[end+1+size:end+2+size]==b'\n','Batch delimiter differs');at=end+2+size
    require(at==len(data),'Trailing raw batch bytes')
verify(cmd('git','write-tree').decode().strip());cmd('git','commit','-m','Publish complete new installed209 startup-only source and171 guards');head=cmd('git','rev-parse','HEAD').decode().strip();verify(head)
cmd('git','push','origin','audit/release-eb6de2e8');require(cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head,'Remote differs')
print(json.dumps({'status':'COMPLETE_NEW_STARTUP_SOURCE171_PUBLISHED_NOT_APPROVED','head':head,'rawVerifiedBlobs':len(paths),'allPythonHashes':index['files'],'operatorExecutions':0}))
