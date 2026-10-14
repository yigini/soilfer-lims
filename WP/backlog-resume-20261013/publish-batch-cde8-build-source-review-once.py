"""Publish only the new, closed build-only source and its retained local verification."""
import datetime, hashlib, json, pathlib, subprocess, sys

REPO=pathlib.Path(__file__).resolve().parents[2]
REL='WP/batch-release-cde8-20261014'
OWNED=REPO/REL
EXPECTED='6e4ec5a5ce7fc52a55e175d44213dd75f57f1733'
def cmd(*args):return subprocess.check_output(args,cwd=REPO)
assert cmd('git','rev-parse','HEAD').decode().strip()==EXPECTED
assert cmd('git','branch','--show-current').decode().strip()=='audit/release-eb6de2e8'
assert not cmd('git','diff','--cached','--name-only').strip(), 'Preserve existing staging'
sys.path.insert(0,str(OWNED))
from batch_build_contract import SOURCE_FILES, CANDIDATE, TREE, MAIN_CI, FIRST_BUILD_ROOT_NAME
terminal=json.loads((OWNED/'actual-cde8-raw-blob-archive-verification-once/exit-original.json').read_bytes())
assert terminal['status']=='PASS' and terminal['sourceUnchanged'] and terminal['verifiedGitBlobCount']==1561
assert all(hashlib.sha256((OWNED/n).read_bytes()).hexdigest()==terminal['sourceSha256After'][n] for n in SOURCE_FILES)
assert b'Ran 14 tests' in (OWNED/'actual-cde8-raw-blob-archive-verification-once/guard-stderr-original.log').read_bytes()
directories=['build-source-guard-verification-20261014T2146','build-source-first-root-bound-guard-verification-once','build-source-disk-bound-final-guard-verification-once','build-source-net-disk-final-guard-verification-once','actual-cde8-git-archive-verification-once','actual-cde8-explicit-tar-mode-verification-once','actual-cde8-raw-blob-archive-verification-once']
paths=[OWNED/n for n in sorted(SOURCE_FILES)]
for name in directories:
    folder=OWNED/name
    assert folder.is_dir() and not folder.is_symlink()
    for p in sorted(folder.rglob('*')):
        assert not p.is_symlink()
        if p.is_file():paths.append(p)
metadata={'status':'BUILD_SOURCE_REVIEW_READY_NOT_APPROVED','preparedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'candidate':CANDIDATE,'tree':TREE,'mainCiRun':MAIN_CI,'scope':'BUILD_ONLY_NO_DATABASE_CONNECTION_OR_VOLUME','sourceSha256':terminal['sourceSha256After'],'archiveVerification':str(pathlib.PurePosixPath(REL)/'actual-cde8-raw-blob-archive-verification-once/exit-original.json'),'applicationGitBlobCount':1561,'selectedApplicationBlobCount':1560,'guardTestCount':14,'originalBatchBuildRoot':'/opt/lims/releases/'+FIRST_BUILD_ROOT_NAME,'buildsLaunched':0,'productionConnections':0,'proofLaunches':0,'productionDeployments':0,'newSourceApproval':None,'finalKitReview':None,'freshGate':None}
review_ready=OWNED/'build-source-review-ready.json'
with review_ready.open('x',encoding='utf-8') as f:json.dump(metadata,f,indent=2)
description='''# New batch build-only source review

Candidate cde8c8896f5f9d5f1ab07b0ae16b1a765e0a6367/tree638580d50f61254609de3abd42d93afc676a5727 includes the three individually approved and merged #206/#214/#209 heads. Main CI38636615469 attempt1 closed SUCCESS21:34:24UTC with370/5649 and every actual Docker step; closed originals are retained at audit194b8dfc.

The five source files implement one source-approved immutable package, one new remote build root and one build unit. They perform no database connection or volume mount, impact collection, production-copy proof or deployment. They require a new actual Claudio `Source review: PASS` on the exact published tooling commit and all five raw hashes. Existing #200 helpers and receipts only identify historical predecessor authority; they cannot launch this batch.

The first build root is fixed to `/opt/lims/releases/workflow-batch-build-cde8c889-20261014T221500Z`. The package checks fresh main, all three actual source verdicts, original mainCI, later rejections and complete raw source identity before preparation, upload and immediately before launch. The launcher retains its intent before any SSH; uncertain outcomes forbid replay. The builder retains its intent before one stock Docker build; there is no retry, rebuild, retag or cleanup path.

Build disk guards require floor10556150894 plus4294967296B allocation before/unpack, and preserve the floor after the build. Metadata-only accounting observes the owned build root and disjoint Docker buildkit/overlay2/image/containerd directories; no volume/database path is opened. Signed allocation change per filesystem bounds unexplained loss to less than500000000B; cache shrink cannot conceal unaccounted growth, and a different filesystem cannot cover it. Build timeout2400/unit2700 retain300seconds headroom. Both YY workload pins are mandatory. Production memory/readiness/unit/gate guardrails remain for the separate future proof/kit.

Closed local verification at22:15:18.083367UTC passes14 meaningful archive/authority/disk refusal tests with all five source hashes unchanged. The actual raw Git archive verifies1561 committed blobs, bytes, OIDs, paths, executable modes and complete inventory;1560 blobs are selected after excluding tracked node_modules. It is40,676,098B/SHA2566c54dbed48f4aab4d36286dd5e2a921587c1adae51fc4856f53cd321cf86144a. No archive was extracted and no Docker or production operation was invoked.

Earlier9/11/13/14 guard closures describe earlier draft boundaries. Two actual Git export attempts refused first mode differences and then filtered byte differences before extraction. Their original archives/indexes and explicitly labeled refusal transcriptions remain immutable. The final constructor reads verified raw Git objects and preserves the unchanged strict archive guard; no application source or released assertion changed.

A successful source review authorizes only this first build. A new stopped production-copy proof source, original triple preservation, measured retained allocations, actual policyPRESENT/NO_OP0orSTOP and actual214/209 impact lists still need separate review. Order impact requires COMPLETE214 on a new candidate-owned copy; the original remains immutable. Show nonzero lists to YY; approved-amendment nonzero is STOP and needs separately reviewed forward remedy. No amendment-side order step, backfill, relink or normalizer changes. A final exact-kit review and fresh single-use gate remain required before production.
'''
description_path=OWNED/'build-source-review-ready.md'
with description_path.open('x',encoding='utf-8') as f:f.write(description)
paths.extend([review_ready,description_path,REPO/'WP/backlog-resume-20261013/verify-batch-build-raw-archive-and-guards-once.py',pathlib.Path(__file__)])
lead='''## 2026-10-14 new batch BUILD-ONLY source ready for NEW review

MainCI38636615469 CLOSED SUCCESS370/5649/all inventory/all realDocker194b8dfc. New five-file build-only source at WP/batch-release-cde8-20261014/build-source-review-ready.md passes14 refusal guards and exact1561 rawGit archive verification with unchanged source22:15:18UTC. Earlier export mode/filtered byte refusals and originals retained honestly. No new source approval yet; never run package preparer/launcher/builder until actualCl new exact graph Source review PASS. Fixed firstroot workflow-batch-build-cde8c889-20261014T221500Z only, no DBconnection/volume/proof/deploy. Separate new stopped-copy proof/fullkit review/fresh gate still required. No production counts/build/proof/kit/gate/deployment/103apply; human drafts/cards/history untouched.

'''
readme=REPO/'WP/audit-release-eb6de2e8/README.md'
readme.write_bytes(lead.encode()+readme.read_bytes());paths.append(readme)
batch_readme=OWNED/'README.md'
batch_readme.write_bytes(('## Build-only source prepared for separate review\n\nSee `build-source-review-ready.md` for the five-file source graph, closed verification and exact build-only scope. The authority draft remains unapproved and no build has launched.\n\n').encode()+batch_readme.read_bytes());paths.append(batch_readme)
records=[]
for p in paths:
    raw=p.read_bytes();records.append({'path':p.relative_to(REPO).as_posix(),'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()})
index_path=OWNED/'build-source-publication-index.json'
with index_path.open('x',encoding='utf-8') as f:json.dump({'status':'CLOSED_BUILD_ONLY_SOURCE_AND_VERIFICATION','parentAudit':EXPECTED,'files':records,'newSourceApproval':None,'productionOperations':0},f,indent=2)
paths.append(index_path)
cmd('git','-c','core.autocrlf=false','add','--',*[p.relative_to(REPO).as_posix() for p in paths])
assert set(cmd('git','diff','--cached','--name-only').decode().splitlines())=={p.relative_to(REPO).as_posix() for p in paths}
for p in paths:
    rel=p.relative_to(REPO).as_posix();raw=p.read_bytes();blob=cmd('git','show',':'+rel)
    assert raw==blob, 'Staged raw blob differs '+rel
cmd('git','commit','-m','Prepare source-bound build-only batch package and retain guard proofs')
head=cmd('git','rev-parse','HEAD').decode().strip()
for p in paths:assert cmd('git','show',head+':'+p.relative_to(REPO).as_posix())==p.read_bytes()
cmd('git','push','origin','audit/release-eb6de2e8')
assert cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head
print(json.dumps({'status':'PUSHED_NEW_BUILD_ONLY_SOURCE_REVIEW_READY','head':head,'verifiedBlobs':len(paths),'sourceSha256':terminal['sourceSha256After'],'newSourceApproval':None,'productionOperations':0}))
