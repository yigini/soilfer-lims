"""Publish ONLY new reviewed-source preparation and original closed guard evidence."""
import datetime,hashlib,json,os,pathlib,subprocess,sys,tempfile
W=pathlib.Path(__file__).resolve().parents[2];REL='WP/batch-proof-jobs-intake-be837974-20261016';B=W/REL
OLD=W/'WP/batch-proof-memory-events-be837974-20261015';A=OLD/'actual-result-accepted6204518776-complete-once'
assert not (B/'source-publication-index323.json').exists()
sys.path.insert(0,str(B))
from proof_contract import *
from proof_budget import TABLE,DB_EQUIVALENTS,TOTAL_DB_COPIES,FIXED_BYTES
from prepare_proof import current_evidence
def command(*a,input=None):return subprocess.check_output(a,cwd=W,input=input)
def digest(b):return hashlib.sha256(b).hexdigest()
assert command('git','branch','--show-current').strip()==b'audit/release-eb6de2e8'
assert command('git','rev-parse','HEAD').strip()==b'9aa32f1a857e8c315a17c9117623763b2de9feca'
assert not command('git','diff','--cached','--name-only').strip()
terminal=exact_json((B/'source-local-host323-exact-once/exit-original.json').read_bytes())
assert terminal['status']=='PASS' and terminal['expectedTests']==323 and terminal['sourceUnchanged']
for n in FILES:assert digest((B/n).read_bytes())==terminal['sourceSha256After'][n]
for n,p in exact_json((OLD/'actual-source-pass6203833517-once/tooling-source-index.json').read_bytes())['files'].items():assert digest((OLD/n).read_bytes())==p['sha256']
frozen=exact_json((W/'WP/startup-order-readiness-20261015/full-pinned-copy-retention-bound-ordinary-once/source-before.json').read_bytes())
assert len(frozen)==1333
for n,d in frozen.items():assert digest((W/n).read_bytes())==d,n
authority=current_evidence();(B/'prepublication-current-authority-original.json').write_bytes(canonical(authority)+b'\n')
scope=exact_json((A/'review-original.json').read_bytes());jobs_scope_authority(scope)
reference=exact_json((B/'fresh-r4-unused-root-reference-once/stdout-original.json').read_bytes())
hashlines='\n'.join('- '+n+' `'+digest((B/n).read_bytes())+'`' for n in sorted(FILES))
readme=f'''# Jobs-on natural intake and broad postflight source

Complete NEW source graph for exact {CANDIDATE}, image {IMAGE}, qualified receipt {BUILD_RECEIPT_SHA}. Prepared for an exact source review; no operational package, root, unit or proof has been created. Accepted startup-only result/scope is [6204518776](https://github.com/yigini/soilfer-lims/issues/162#issuecomment-6204518776). That result is not release qualification.

The sole proposed root is `{ROOT}`; one attempt, no retry. All old roots, helpers and approvals remain consumed. Main merges remain held until actual deployment and Claudio's post-deploy PASS.

The graph creates one independent jobs-OFF/network-none default startup, performs the shipped 31 API checks plus six exact historical read-only probes, then stops and seals full equality with the bound installed209 state (112 tables,42 receipts). A second independent default startup uses jobs-ON/default bridge with no published ports. Only owned bind mounts exist. It observes two real target-config scheduled completions at the unedited interval (bounded to30 minutes to fit this90-minute graph), no manual sync/cursor rewind/clock edit/config substitution. Empty actual pending intake is allowed; fabricated submissions are not. The final watch lasts at least interval+2 minutes from first completion and660 healthy seconds. All four exact refused configurations must remain unchanged and produce two one-to-one paired natural refusals each; any other scheduler error stops.

All old inputs are hash/stat only. SQLite opens occur only on newly owned copies/backups; raw masters are never opened. Original schema, all original rows and42 receipts across all112 tables remain exact. Enumerated new Sample/AuditLog/SampleHold/Notification rows and active-config cursor/clock fields are the only intake delta; the preserved historical verifier checks full provenance, submission/depth cardinality, genuine new IDs at second sync, exact audits/holds/notification scope, integrity and FK. No analytical/QC disposition, order backfill/relink, policy normalization, user/config ownership change or extra installer replay is allowed. Every copied asset file is also unchanged at stopped closure.

Both startup chains require exact integer0 on27 NO_OP and26 READY records, all HTTP200/200/401 and final host memory sample inside unchanged600 seconds. Every actual container uses805306368 memory=memory+swap, host swap.max0 and blank NODE_OPTIONS. The exact host PID/cgroup/membership/inode/device policy from dd14 is retained: oom=oom_kill0, sampled sum of seven nonreclaimable fields<=603979776; peak/max/high/reclaim are observations only. The old releaseCliPeakBytes gate is removed and standalone CLI containers are unconditionally refused. Postflight child processes share the monitored app cgroup. Readiness every-poll and command/intake observations plus final before-stop samples are retained;4096 samples/container with unchanged256MiB/container evidence cap inside existing4GiB logs. Sampling is not a continuous peak claim. Nonblocking bounded stdin prevents a stuck probe pipe bypassing command deadlines. SIGTERM enters the owned-stop/refusal path. Every owned stopped container remains retained.

Closed copy audit: first stage12 equivalents, second13 (including a first-sync consistent backup), total{TOTAL_DB_COPIES},25% margin and minimum{DB_EQUIVALENTS} retained for this NEW jobs scope. Fixed schema89556+seed/secret markers+32 directories/startup,3 asset reserves,{FIXED_BYTES} fixed bytes with margin, floor10556150894+4GiB logs+ADDITIONAL10GB remain. Every AST copy site, runtime claim, remaining consumption and stage physical cap is checked. The metadata-only reference at {reference['observedUtc']} required{reference['requiredBytes']} and found{min(reference['freeBytes'].values())} on EACH of three same-filesystem paths, nonadditive. Proposed root absent/unit not-found then. This is NOT launch authority: exact future package allocation plus fresh R4 before root, immediately before unit and runtime before copies are mandatory.

Final323/323 LOCAL and323/323 ACTUALHOST Python3.9.23 guards passed at {terminal['closedUtc']}. Host sources loaded only in memory; real process/Docker/cache/operator calls blocked. New synthetic fixtures retained. No production SQLite connections or operational proof calls. All270 predecessor assertions retained with new authority/budget fixtures,53 new guards cover actual natural controller and readiness flow, missing completions/refusals/health, strict bool-v-integer0, original-row/receipt/cursor/depth/intake mutations, bounded stdin. A source-generation NameError caused301/311 pass before correction; original failed source/raw logs remain. The first verifier had a LOCAL harness parse error before any test; host never started.316 and318 local+host predecessor PASS evidence is retained. No stock app tests or runtime source changed; all1333 frozen inputs and all15 dd14 source hashes remain unchanged.

Next gates: NEW exact all26-file source PASS, full raw Git binding validation/current authorities, then one new package/launch under fresh capacity/unused root guards. This graph cannot gate or deploy. Final exact-kit review and fresh single-use gate remain required. The kit/gate must disclose several minutes expected restart downtime; prior jobs-off healthy observations were333/392 seconds. Claudio's page-cache charge explanation remains his inference; exact old charge cause is not independently proved and230000 remains FAILED.

## Exact source SHA256

{hashlines}
'''
(B/'README.md').write_bytes(readme.encode())
prefix=('LATEST ACCEPTED STARTUP RESULT + COMPLETE NEW JOBS QUALIFICATION SOURCE - '+datetime.datetime.now(datetime.timezone.utc).isoformat()+'.\nActualCl6204518776 ACCEPTED closed233000 startup-only PASS and gave NEW jobsON source scope. Full8328 indexed rawGitOID-SHA-length plus index reverified; immutable8326locals unchanged/two later README leads verified against currentHEAD separately. Acceptance originals at WP/batch-proof-memory-events-be837974-20261015/actual-result-accepted6204518776-complete-once. First LOCAL retainer refused later-updated README-role assertion before output/host; immutable helper + honest derived refusal retained. NO duplicate ACK/native/result. Clcharge explanation HIS inference/no old retroPASS.\n\nComplete NEW26-file graph at '+REL+'/README.md;323LOCAL+323ACTUALHOST guards PASS/source hashes frozen;25copy equivalents/min64/3assets/25percent/schemafixed/4GiBlogs/floor+10GB. OnejobsOFF broad31+6 +onejobsON natural2syncs, unchanged cursors/interval<=30/660soak/interval+2min,112tables42receipts/4exactrefusals/fullintakeprovenance. Samehost memory.events75percent policy EVERYcontainer; standaloneCLI forbidden/oldpeakgate removed/4096samples256MiBpercontainer/600 unchanged. Reference23:50:57.758441 req60921981038/free95864037376EACH3sameFSnonadditive/rootABSENT/unitnot-found, NOTlaunch authority/exactpackagefuture+freshR4beforeROOT/unit/runtime mandatory. SourceReview NOTYETREQUESTED at this publication; NEWexactallhashPASS beforeANYpackage/operator. Alloldhelpers/tests/roots consumed/no replay. MainMERGEHOLD/jobsOFFacceptedNOT_RELEASE_QUALIFIED/jobsONproof+kitfreshgate+deploy later/heartbeat2min/R2COMPLETE/YYspacealreadyvisible/no103/noagentsnewworktreesconcurrentwriter/humansheld.\n\n')
readmes=['WP/audit-release-eb6de2e8/README.md','WP/runtime-recovery-kobo/README.md']
for rel in readmes:
 p=W/rel;p.write_bytes(prefix.encode()+p.read_bytes())
helpers=['retain-startup233000-accepted6204518776-once.py','retain-startup233000-accepted6204518776-complete-once.py','prepare-jobs-intake-source6204518776-once.py','verify-jobs-intake-complete-local-host-first-once.py','verify-jobs-intake-complete-local-host-rendered-once.py','verify-jobs-intake316-complete-local-host-once.py','verify-jobs-intake318-bounded-local-host-once.py','verify-jobs-intake323-exact-readiness-local-host-once.py','read-jobs-intake-r4-unused-root-reference-once.py',pathlib.Path(__file__).name]
paths=[p.relative_to(W).as_posix() for p in B.rglob('*') if p.is_file()]+[p.relative_to(W).as_posix() for p in A.rglob('*') if p.is_file()]+['WP/backlog-resume-20261013/'+n for n in helpers]+readmes
assert len(paths)==len(set(paths)) and all('__pycache__' not in n for n in paths)
rows=[]
for n in sorted(paths):
 b=(W/n).read_bytes();rows.append({'path':n,'length':len(b),'sha256':digest(b),'gitBlobOid':hashlib.sha1(('blob '+str(len(b))+'\0').encode()+b).hexdigest()})
index={'status':'COMPLETE_JOBS_SOURCE_AND_CLOSED_GUARDS_NOT_OPERATIONAL_APPROVAL','baseAudit':command('git','rev-parse','HEAD').decode().strip(),'scopeAcceptedId':6204518776,'finalTests':323,'files':rows,'stageTable':TABLE,'referenceOnlyRequiredBytes':reference['requiredBytes'],'operationalExecutions':0}
ip=REL+'/source-publication-index323.json';(W/ip).write_bytes(canonical(index)+b'\n');paths.append(ip)
fd,ps=tempfile.mkstemp(prefix='lims-jobs323-stage-',suffix='.paths');os.close(fd);pathspec=pathlib.Path(ps);pathspec.write_bytes(b'\0'.join(n.encode() for n in paths)+b'\0')
command('git','-c','core.longpaths=true','-c','core.autocrlf=false','--literal-pathspecs','add','--pathspec-from-file='+str(pathspec),'--pathspec-file-nul')
staged={n.decode() for n in command('git','diff','--cached','--name-only','-z').split(b'\0') if n};assert staged==set(paths)
queries='\n'.join(':'+n for n in paths)+'\n';batch=command('git','cat-file','--batch',input=queries.encode());at=0
for n in paths:
 end=batch.index(b'\n',at);oid,kind,sz=batch[at:end].decode().split();sz=int(sz);at=end+1;raw=batch[at:at+sz];at+=sz
 assert kind=='blob' and batch[at:at+1]==b'\n' and raw==(W/n).read_bytes(),n;at+=1
 assert hashlib.sha1(('blob '+str(sz)+'\0').encode()+raw).hexdigest()==oid
assert at==len(batch)
command('git','commit','-m','Publish accepted startup and complete jobs intake proof source with 323 guards')
head=command('git','rev-parse','HEAD').decode().strip()
assert set(command('git','diff-tree','--no-commit-id','--name-only','-r',head).decode().splitlines())==set(paths)
command('git','push','origin','HEAD:audit/release-eb6de2e8')
assert not command('git','diff','--cached','--name-only').strip()
print(json.dumps({'status':'PUBLISHED','head':head,'rawFilesIncludingIndexVerified':len(paths),'sourceFiles':len(FILES),'testsLocalAndActualHost':323,'operators':0,'pathspecRetained':str(pathspec)},ensure_ascii=True))
