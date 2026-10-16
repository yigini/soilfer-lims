"""Post ONE exact new source request, acceptance ACK bundled only here."""
import datetime,sys
sys.dont_write_bytecode=True
from prechecks6210209468_evidence import *
N=W/'WP/batch-proof-mount-order-forward-be837974-20261016'
REL=N.relative_to(W).as_posix()+'/'
SOURCE='187636984895aec44044635fb63498b0fcb3102e'
D=N/'exact-source-review568-once'
assert not D.exists() and git('rev-parse','HEAD').decode().strip()==SOURCE and git('branch','--show-current').decode().strip()=='audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip()
sys.path.insert(0,str(N));import proof_contract as c;import prepare_proof as prep
publication=verify_publication(SOURCE,REL+'source568-publication-once/publication-index.json',731)
index={'head':SOURCE,'files':{}}
originals=raw_many(SOURCE,[REL+n for n in sorted(c.FILES)])
for name in sorted(c.FILES):
 raw=originals[REL+name];assert raw==(N/name).read_bytes();index['files'][name]={'bytes':len(raw),'sha256':sha(raw),'blob':oid(raw)}
c.graph(index);final=json.loads((N/'source-local-host-mount-order-final-once/exit-original.json').read_bytes())
assert final['status']=='PASS' and final['expectedTests']==568 and final['sourceSha256After']==c.graph(index)
frozen=json.loads((W/'WP/startup-order-readiness-20261015/full-pinned-copy-retention-bound-ordinary-once/source-before.json').read_bytes());assert len(frozen)==1333 and all(sha((W/n).read_bytes())==v for n,v in frozen.items())
captures=[];original=prep.command
def capture(*args):
 raw=original(*args)
 if args[:2]==('gh','api'):captures.append((list(args),raw))
 return raw
prep.command=capture;evidence=prep.current_evidence();c.attempt_authorities(evidence['attemptAuthorities'])
marker='mount-order-forward568-18763698-accepted6210719791'
assert not any(marker in v['body'] for v in evidence['sourceComments'])
sweep=json.loads((N/'map-array-sweep.json').read_bytes())
site_list='\n'.join('- `'+r['site']+'`: '+r['verdict'] for r in sweep['siteVerdicts'])
body='''@claude NEW exact attempt-graph source review under your actual [6210719791](https://github.com/yigini/soilfer-lims/issues/162#issuecomment-6210719791).

ACK6210719791 is bundled ONLY here. Your unedited acceptance of C1PASS/C2CLOSEDREFUSAL and full forward direction are retained at48eb2d20692b2e642a3303dc943dd7ba4f71648a (41 raw GitOID/SHA256/length verified files). Result6210471146 is answered; its07:52:50 native fallback is cancelled and will never repeat. Both080000 and old063000 source/PASS/root/unit/package/operators remain immutable and consumed. This new graph is not a retry or an attempt approval.233000 remains latest passing startup-only; main merges held.

Complete NEW37-file graph **187636984895aec44044635fb63498b0fcb3102e**:
https://github.com/yigini/soilfer-lims/tree/187636984895aec44044635fb63498b0fcb3102e/WP/batch-proof-mount-order-forward-be837974-20261016

`source568-publication-once/publication-index.json` binds731 files by raw Git blob id, SHA256 and length, plus itself =732. It includes all source/test fixtures, every failed and passing guard run/source-at-attempt, all preparation helpers, and current authority originals. All37 exact source/data hashes and all literal bindings follow below. Final568LOCAL+568ACTUALhostPython3.9.23 guards PASS closed2026-10-16T08:01:06.467341+00:00; all37 unchanged. All old31 attempt+26 precheck sources and1,333 app inputs unchanged. No app, Dockerfile, Compose or CI edit.

**Requested fix and real-call tests**
- `stop_owned.selected()` requires unique Destinations, then sorts FULL mount dictionaries once by Destination. Every key is retained. The later equality compare remains exact. Missing/extra/duplicate/changed objects, id/owner/name/image/startedAt changes, still-running owners and restart-policy changes refuse. Both inspect responses must also match their requested full ID. Exact owned paths and labels remain mandatory.
- Retained the accepted precheck's actual `call()` path: exclusive private stdout/stderr0400, fsync/full hashes and public argv/returnCode/elapsed/stream hash-length-mode/transport type BEFORE any response predicate. Raw inspect contains ENV/JWT and remains HOSTONLY, never fetched or published. Empty-stderr and bounds still fail closed. Each owner has its phase and readable exact-static/HMAC failure, and an error cannot prevent trying the other.
- Complete attempt hook stops both exact owners FIRST, then verifies review/index/source hashes, then reads controller memory even on verification error, then creates independent private hook key. Every owner/verification/memory error fails. Runtime receipt remains AWAITING_EXEC_STOP_POST, never closedPASS; actual hook/journal exit0, both retainedSTOPPED, same controller cgroup/OOM0 and full independent closure are still required.
- New tests patch ONLY the external `subprocess.run` Docker stand-in. They execute the real `call`, `stop_exact`, `selected`, real exclusive files/fsync/hash/metadata/JSON/predicates and both-owner loop. The full real PUBLIC C2 mount objects are retained in `real-mount-fixtures.json`; only root-derived Source/name/owner labels adapt to the NEW root. ALL6x6 before/after orderings EACH owner =72 distinct tests, plus each of six fields on each of three objects EACH owner, duplicate Destination/missing/extra/new unknown key/removed key, identity/state/restart changes. A running-owner case makes `docker stop -t 10` go through actual `call` before rotated after-inspection succeeds. Stop failure still tries the other owner; private stderr and timeout streams/metadata are retained before refusal.
- The C1-tested comparator's ONLY predicate change is carried forward: exact16 lowercase fingerprint. Tests reject64/uppercase/15/17/nonstring; actual entire byte-bound unpatched local Node controller produces345bfa7727c61604 through full strict pairing. Non-crypto imports inert. Host Python consumes the retained ACTUAL LOCAL Node result, not a claimed host Node execution. In-place existing-conflict metadata-array revision stays conservative refusal, as in your accepted prechecks.

**Earlier host docker stop through this `call()`**
There is NO verified earlier host `docker stop` through THIS `stop_owned.call`. C2's actual retained six calls were ps/inspect ONLY. The old063000 per-call streams were not kept, so I cannot claim the hook stop branch executed. Its actual emergency stops used `proof_docker.Docker.stop`, a different subprocess path. The old063000 hook cause remains UNKNOWN; your same-cause explanation stays explicitly an inference. The new running-owner test above covers the requested real-call branch with a stand-in. Per your point4, NO new real-host precheck is run before this attempt graph.

**Whole-graph array/map sweep**
`map-array-sweep.json` includes656 runtime equality comparisons (exact file/line/structural AST), inspection-consumer ranges and these site verdicts. The final suite validates every AST comparison on3.12 and3.9. Embedded launcher/capacity templates and all CJS postflights were included in the source inspection.
'''+site_list+'''

**Controller memory and unchanged scope**
Added bounded numeric-path `memory.stat` to the same exact-unit reader before/after and poststop: anon/file plus all returned counters retained as the eighth raw read BEFORE predicates. Missing/duplicate/malformed stat refuses. All ancestor alias/PID/membership/device-inode/805306368Swap0/OOM guards remain; peak/max/high and anon/file are observations, not a raised limit or retroPASS. `source568-publication-once/real-host-reader-inventory.json` lists unpatched exercises and limits. The actual host's numeric reader bytes equal plain open, then unpatched own_snapshot outside the unit refuses exactly at membership; no production memory counters are sampled. Source verification reads real NEW synthetic fixture files, all37 hashes and real tamper. SQLite tests open only NEW retained synthetic112table42receipt fixtures. Host sources IN MEMORY, no source files, no real Docker/cache/operator calls. Previous accepted real-run reader evidence is cited with its failed/nonqualification limits.

Full112 tables/schema42 receipts/science/protected rows, strict existing AND same-sync-new source/fetch/occurrence/hold/audit pairing, exact INTRA pairs/every-added-row consumption/no orphans or extra CREATE/audit/hold, exact manager notifications/reconstructed transition labels, second natural conflict idempotence/all first-fetch IDs/new IDs above first max stay. Broad31API+6readonly probes; two NATURAL syncs/original cursor/interval/clocks/no manual trigger; 660healthy+actual interval2min; four exact refusal pairs. Every container805306368 memory=memory+swap/hostSwap0/blankheap/600 TOTAL HTTP+finalsample/OOM0/exact fullIDPIDstartowner/cgroupdevinodeleaf/7-field sampled max<=603979776. N25/MIN64/25percent/3assets/schema+markers/floor10556150894+4GiBlogs+ADDITIONAL10GB/all copy and physical-stage caps/500MB unchanged. Old input files are HASHSTAT only; no old SQL, new production snapshot or installer/policy replay.

Proposed sole NEW `/opt/lims/releases/workflow-batch-mount-order-forward-be837974-20261016T100000Z`, unit `lims-workflow-batch-mount-order-forward-be837974-20261016t100000z`, UNCREATED by us. New prepare/launch/run UNEXECUTED except import/compile/closed fake guards; no operational package. Your acceptance6210719791 and prior063000scope6208837867 are freshly semantically pinned in prepare/launch/current evidence AND runtime. NEW own exactSourcePASS then fresh R4+10GB beforeROOT/immediatelyUNIT/runtime, exact future package charged beforeROOTONLY, unused root/unit, ONEattempt/no retry. No current capacity-fit claim. No kit/gate/deploy authority.

Future kit must disclose C1-validated186new/22holds on063000 data, skipped22 as LOGdescriptionONLY, manager impact and counts may differ at deploy, plus stop grace/actual exit code and grace included in9to10minute restart window/exact600 failure behavior. No assertion about SIGTERM/137 root cause beyond retained evidence is adopted as an independently proved fact.

Honest guard failures retained: first568LOCAL432PASS136FAIL/HOSTNOTSTARTED due stand-in timeout-keyword shadowing and two stale later-rejection fixture clocks. Corrected fixtures only. Next568LOCALPASS/HOST567PASS1FAIL because Python3.9 versus3.12 ast.unparse parentheses differ. Exact source/expressions unchanged; final test compares FULL structural AST/file/line while retaining pretty text, no inventory site removed or predicate weakened. Final568bothPASS. All failed sources/logs remain immutable; no operator replay.

Seven issues: status6210539858 already answered once, #216 title corrected once in-place. Your separate-checkout request has not been performed because the direct human instruction still requires SAME writer/no new checkout/worktree/agents/concurrent writer. Release source remains first in line. No duplicate status or ACK message.

Please review this exact complete graph. On PASS use first line `Source review: PASS` and include ALL bindings below. Findings require a genuinely new successor. Scope acceptance/tests are not reused as SourcePASS; no package/root/unit/attempt until the new exact approval.

Exact graph and bindings:
```
'''+'\n'.join(c.tokens(index))+'''
```

<!-- '''+marker+''' -->
'''
assert len(body.encode())<60000
D.mkdir();save(D,'source-index.json',c.canonical(index)+b'\n');save(D,'body.md',body.encode());save(D,'request.json',c.canonical({'body':body})+b'\n');save(D,'current-evidence.json',c.canonical(evidence)+b'\n')
save(D,'request-intent.json',canonical({'sourceHead':SOURCE,'marker':marker,'bodySha256':sha(body.encode()),'bindings':len(c.tokens(index)),'onePostOnly':True,'retryAllowed':False,'publicationVerified':publication})+b'\n')
raw=capture('gh','api','--method','POST','repos/yigini/soilfer-lims/issues/162/comments','--input',str(D/'request.json'));save(D,'response-original.json',raw);posted=json.loads(raw)
assert posted['body']==body and posted['created_at']==posted['updated_at']
raw=capture('gh','api','repos/yigini/soilfer-lims/issues/comments/'+str(posted['id']));save(D,'readback-original.json',raw);fresh=json.loads(raw)
assert fresh['id']==posted['id'] and fresh['body']==body and fresh['created_at']==fresh['updated_at']==posted['created_at']
for i,(argv,raw) in enumerate(captures):save(D,'api-original-'+str(i).zfill(2)+'.json',raw)
save(D,'api-command-index.json',canonical([{'file':'api-original-'+str(i).zfill(2)+'.json','argv':a,'bytes':len(b),'sha256':sha(b),'gitBlobOid':oid(b)} for i,(a,b) in enumerate(captures)])+b'\n')
fallback=datetime.datetime.fromisoformat(posted['created_at'].replace('Z','+00:00'))+datetime.timedelta(minutes=20)
record={'sourceHead':SOURCE,'commentId':posted['id'],'url':posted['html_url'],'createdUtc':posted['created_at'],'bodySha256':sha(body.encode()),'marker':marker,'literalBindings':len(c.tokens(index)),'all37SourceAnd732PublicationBindingsVerified':True,'requestResponseFreshUneditedReadbackEqual':True,'acceptance6210719791AckBundledOnlyHere':True,'sourcePass':False,'packagePrepared':False,'rootCreated':False,'operators':0,'nativeFallbackNoEarlierUtc':fallback.isoformat(),'oldResultFallbackCancelledAnswered':True}
save(D,'delivery-record.json',canonical(record)+b'\n');print(json.dumps(record))
