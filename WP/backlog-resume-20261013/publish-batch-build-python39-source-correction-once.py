"""Publish the verified two-reference build-only Python3.9 correction for new review."""
import hashlib,json,pathlib,subprocess
REPO=pathlib.Path(__file__).resolve().parents[2]
SOURCE=REPO/'WP/batch-release-cde8-20261014'
DEST=SOURCE/'build-python39-source-host-verification-once'
def cmd(*args):return subprocess.check_output(args,cwd=REPO)
assert cmd('git','rev-parse','HEAD').decode().strip()=='e4e835e8c54b111f079ca0d80e13f87318f90bb8'
assert not cmd('git','diff','--cached','--name-only').strip()
terminal=json.loads((DEST/'exit-original.json').read_bytes())
assert terminal['status']=='PASS' and terminal['localGuardTests']==terminal['hostGuardTests']==14 and terminal['sourceUnchanged'] and terminal['host']['rootAbsent'] and terminal['onlyDelta']=='TWO_BUILDER_DATETIME_UTC_TO_TIMEZONE_UTC_REFERENCES'
for n,d in terminal['sourceSha256After'].items():assert hashlib.sha256((SOURCE/n).read_bytes()).hexdigest()==d
description='''# New exact build-only source review after actual Python3.9 refusal

Previous actual Claudio Source review PASS6179796996 approved9ef893b3. A separate read-only host compatibility probe found Python3.9.23, which lacks datetime.UTC, with tarfile data filters backported. The probe refused BEFORE any package preparation, build root, unit or Docker build. All original approval/probe/refusal evidence is retained at actual-build-source-pass-6179796996/index.json. The old9ef source remains historical and must not launch.

The only change in the five-file build graph is two timestamp references in batch_build.py: datetime.UTC becomes datetime.timezone.utc. This preserves the same UTC values on the actual host. All four other graph files and every build/root/scope/disk/lifetime/archive/YY pin remain byte-identical to9ef. The unchanged fixed first221500Z root remains absent; this is still the first build, with zero build attempts.

Closed new verification passes14 ordinary local guard tests and the same14 pure contract tests on the actual host Python3.9.23. All five exact current source blobs compile in that runtime in memory; the timestamp API and tar extract filter are supported. No remote source file was written and no builder or operational main function executed. All five source hashes are unchanged across verification. The prior1561rawGit archive verification remains applicable because candidate, preparer and archive contract are unchanged. Original logs, narrow source delta, exact in-memory verifier and host result are retained in build-python39-source-host-verification-once.

A NEW exact-head Claudio Source review PASS binding all five current hashes is required before package preparation/upload/build. It authorizes only the same first build-only root/unit, no database connection or volume/impact/proof/kit/gate/deploy. All actual3issuePASS/mainCI38636615469/candidatecde8/tree638 bindings remain. Future stopped production-copy proof/source and exact-kit review/fresh gate stay unapproved, with all actual214/209 lists/policyPRESENTNO_OP0orSTOP/retained allocation/YYnonzero/approvednonzeroSTOP requirements.
'''
description_path=SOURCE/'build-source-python39-review-ready.md'
with description_path.open('x',encoding='utf-8') as f:f.write(description)
paths=sorted(p for p in DEST.iterdir() if p.is_file())+[description_path,SOURCE/'batch_build.py',REPO/'WP/backlog-resume-20261013/verify-batch-build-python39-source-and-host-once.py',pathlib.Path(__file__)]
readme=REPO/'WP/audit-release-eb6de2e8/README.md'
readme.write_bytes(('## 2026-10-14 build-only Python3.9 correction verified; NEW source review required\n\nOnly2timestamp references inbatch_build.py use datetime.timezone.utc; four other graph files remain9ef-byteidentical. New14local+14actualhostguardPASS/all5sourcecompileinmemory/hashunchanged, no remote sourcefiles/builder/DB/build operations. Actualhost3.9.23 supports timestampAPI and backportedtarfilter; first221500rootABSENT. Historical9efPASS6179796996/preflightrefusal retainede4e; no root/unit/build attempt. New exact source review required before prepare/upload/build. Full scope/closed evidence at build-source-python39-review-ready.md and build-python39-source-host-verification-once. All futureproof/impact/kit/gate/deploy authority remains empty.\n\n').encode()+readme.read_bytes());paths.append(readme)
index_path=DEST/'publication-index.json'
with index_path.open('x',encoding='utf-8') as f:json.dump({'status':'PYTHON39_CORRECTION_NEW_REVIEW_READY','sourceSha256':terminal['sourceSha256After'],'oldSourcePass':6179796996,'newSourcePass':None,'files':[{'path':p.relative_to(REPO).as_posix(),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in paths],'productionOperations':0,'buildsLaunched':0},f,indent=2)
paths.append(index_path);rels=[p.relative_to(REPO).as_posix() for p in paths]
cmd('git','-c','core.autocrlf=false','add','-f','--',*rels)
assert set(cmd('git','diff','--cached','--name-only').decode().splitlines())==set(rels)
for p,rel in zip(paths,rels):assert cmd('git','show',':'+rel)==p.read_bytes(),rel
cmd('git','commit','-m','Bind first batch builder timestamps to actual Python3.9 runtime')
head=cmd('git','rev-parse','HEAD').decode().strip()
for p,rel in zip(paths,rels):assert cmd('git','show',head+':'+rel)==p.read_bytes(),rel
changed=cmd('git','diff','--name-only','9ef893b38fe381061d4dc8aa90968d1d7a4f6fff',head,'--',*[('WP/batch-release-cde8-20261014/'+n) for n in terminal['sourceSha256After']]).decode().splitlines()
assert changed==['WP/batch-release-cde8-20261014/batch_build.py']
cmd('git','push','origin','audit/release-eb6de2e8')
assert cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head
print(json.dumps({'status':'PUSHED_PYTHON39_BUILD_SOURCE_NEW_REVIEW_READY','head':head,'verifiedBlobs':len(paths),'sourceSha256':terminal['sourceSha256After'],'newSourcePass':None,'buildsLaunched':0,'productionConnections':0}))
