"""Finish new source metadata and exact literal sites; no runtime or host action."""
import ast,json,pathlib,sys
sys.dont_write_bytecode=True
W=pathlib.Path(__file__).resolve().parents[2];B=W/'WP/batch-proof-mount-order-forward-be837974-20261016'
P=W/'WP/controller063000-prechecks-be837974-20261016'
assert not (B/'map-array-sweep.json').exists()
sys.path.insert(0,str(B));import proof_contract as c
evidence=json.loads((P/'actual-both-results-accepted6210719791-once/current-authority-evidence.json').read_bytes())
accepted=json.loads((B/'accepted-prechecks-original.json').read_bytes())
(B/'new-authority-fixtures/attempt-directions.json').write_bytes(c.canonical({'6208837867':evidence['accepted063000'],'6210719791':accepted})+b'\n')
def function_for(tree,line):
 names=[(n.end_lineno-n.lineno,n.name) for n in ast.walk(tree) if isinstance(n,(ast.FunctionDef,ast.AsyncFunctionDef)) and n.lineno<=line<=n.end_lineno]
 return min(names)[1] if names else '<module>'
inventory=[];sites=[]
for name in sorted(c.FILES):
 if not name.endswith('.py') or name.startswith('verify') or name=='provenance_privacy.py':continue
 tree=ast.parse((B/name).read_bytes())
 for node in ast.walk(tree):
  if isinstance(node,ast.Compare) and any(isinstance(op,(ast.Eq,ast.NotEq)) for op in node.ops):
   inventory.append({'file':name,'line':node.lineno,'expression':ast.unparse(node)})
 # List every container inspection/map conversion consumer explicitly below.
 for node in ast.walk(tree):
  if isinstance(node,ast.FunctionDef) and (name,node.name) in {
   ('stop_owned.py','selected'),('stop_owned.py','stop_exact'),('proof_contract.py','healthy_predecessor'),('proof_contract.py','qualified'),
   ('proof_docker.py','all_containers'),('proof_docker.py','mount_objects'),('proof_docker.py','preserved_containers'),('proof_docker.py','validate'),
   ('proof_memory.py','container_identity'),('proof_memory.py','snapshot'),('proof_disk.py','mount_guard'),('proof_disk.py','topology_check'),
   ('runtime_proof_policies.py','validate_build'),('run_stopped_proof.py','run')}:
   sites.append({'file':name,'function':node.name,'line':node.lineno,'endLine':node.end_lineno})
verdicts=[
 {'site':'stop_owned.selected/stop_exact','verdict':'CHANGED: unique Destination then sort FULL dictionaries once in selected; before/after equality remains exact for every dictionary key; inspected ID must equal the requested full ID. Exact owner, name, image, startedAt, stopped state and inventory guards remain.'},
 {'site':'proof_docker.mount_objects/preserved_containers','verdict':'ALREADY ORDER INDEPENDENT: rejects duplicate Destination and compares sorted canonical bytes of FULL objects; labels are dictionaries. ID inventory is a dict keyed by full ID, with sets for membership. No in-order ps output equality.'},
 {'site':'proof_contract.healthy_predecessor and run.predecessor comparison','verdict':'ALREADY ORDER INDEPENDENT: input Mounts keyed by Destination; safe result mount list emitted in an explicit fixed destination order. Config.Env is converted to a dictionary; flags and State are scalar fields.'},
 {'site':'proof_docker.validate','verdict':'ALREADY ORDER INDEPENDENT: Mounts and Config.Env keyed by Destination/name; no incoming mount-array equality. Exact actual historical preservation uses mount_objects; hook rejects duplicate/missing/extra mount and full-object changes.'},
 {'site':'proof_memory.container_identity/snapshot/Sampler','verdict':'No map-derived array equality: identity and cgroup descriptor are dictionaries/scalars. Ordered kernel membership raw bytes retained and compared for identity/race, not a Go map output.'},
 {'site':'proof_disk.mount_guard/topology_check and runtime_proof_policies','verdict':'Mountinfo is a positional kernel protocol, not a map-derived array; overlay options are parsed into dictionaries; actual daemon config/PID/topology are dicts. Git mergeParents order is semantically first-parent/second-parent and remains ordered.'},
 {'site':'proof_contract.qualified and run fresh whole image inspection','verdict':'Exact ENTIRE image object retained unchanged. Its single inspect result wrapper is ordered by the single requested ID. RootFS.Layers and Config.Env/Cmd/Entrypoint/Healthcheck.Test are ordered OCI configuration/commands, not mount-map enumeration; JSON object key order is canonicalized/dict equality.'},
 {'site':'proof_health; proof_files; proof_inputs; provenance rules/privacy; proof_jobs/startup; preparer/launcher/budget/render','verdict':'Full scan found no other inspect/map-derived array equality. SQL column/schema order, ordered provenance prefixes/audit pairing, upstream stream order, command argv, Git parent order and source-controlled literal lists are semantic order and remain strict. Object tables/file inventories are dicts/sets or explicitly sorted.'},
 {'site':'postflight-qc-runs.cjs:29,36; other five postflight/smoke CJS files','verdict':'Measurement array explicitly sorted by ID before comparison against ORDER BY id observations. Object.fromEntries table counts use object deep equality. Other checks use scalar/type/count/property tests; no map-derived array equality.'},
 {'site':'writer_fingerprint.cjs/writer-controller-original.js','verdict':'Test-only entire unchanged application controller evaluated with inert imports and synthetic data; no attempt runtime invocation. Fingerprint canonical field/attachment order is semantic application behavior and is unchanged.'},
]
record={'scope':'ENTIRE_37_FILE_ATTEMPT_GRAPH_RUNTIME_AND_EMBEDDED_TEMPLATES','allRuntimeEqualityComparisons':inventory,'inspectionConsumers':sites,'siteVerdicts':verdicts,'embeddedTemplates':['proof_budget.HARDWARE_SOURCE/capacity_probe_source: explicit path-keyed dict hardware; set inventories; no incoming-map arrays','launch_proof.PREFLIGHT_TEMPLATE/CREATE_TEMPLATE/UNIT_TEMPLATE: set file inventory; fixed argv order; no inspect arrays'], 'priorHostDockerStopThroughThisCall':{'verified':False,'basis':'C2 actual retained six calls were ps/inspect only. Old063000 call() had no per-call streams; its hook reason is unknown. Actual earlier emergency stops used proof_docker.Docker.stop, a distinct subprocess.run path. No verified earlier host docker-stop-through-stop_owned.call claim is made. New running-owner case uses the real call and closed stand-in Docker, no new host check.'},'old063000HookCause':'UNKNOWN; reviewer same-cause explanation is explicitly an inference','noNewHostPrecheck':True,'newAttemptRequiresOwnExactSourcePass':True}
(B/'map-array-sweep.json').write_bytes(c.canonical(record)+b'\n')
# Rebuild only source-literal allowlist; dynamic errors remain keyed.
actual={}
for name in sorted(c.FILES):
 if not name.endswith('.py') or name=='provenance_privacy.py':continue
 for node in ast.walk(ast.parse((B/name).read_bytes())):
  text=None
  if isinstance(node,ast.Call) and isinstance(node.func,ast.Name) and node.func.id=='require' and len(node.args)>1 and isinstance(node.args[1],ast.Constant) and type(node.args[1].value) is str:text=node.args[1].value
  if isinstance(node,ast.Raise) and isinstance(node.exc,ast.Call) and isinstance(node.exc.func,ast.Name) and node.exc.func.id=='RuntimeError' and len(node.exc.args)==1 and isinstance(node.exc.args[0],ast.Constant) and type(node.exc.args[0].value) is str:text=node.exc.args[0].value
  if text is not None:actual.setdefault((name,node.lineno),[]).append(text)
p=B/'provenance_privacy.py';s=p.read_text(encoding='utf-8');s=s[:s.index('STATIC_FAILURE_SITES=')]+'STATIC_FAILURE_SITES='+repr({k:tuple(v) for k,v in actual.items()})+'\n';p.write_text(s,encoding='utf-8',newline='\n')
readme='''Complete NEW mount-order forward attempt source under actual6210719791 (07:48:56Z).

This is a distinct attempt graph; all080000 prechecks and063000 source/PASS/root/unit/operators remain consumed and unchanged. Actual acceptance is bound by semantic SHA94c17911c87ec6e9d860001528deab785f24a0c6c83ea69af09b6308c257fe97 together with actual063000 scope6208837867. Own NEW exact source PASS, fresh R4+10GB beforeROOT/immediatelyUNIT/runtime, unused100000root+unit and ONEattempt remain mandatory. No package/root/unit/attempt exists yet.

The full31-file prior attempt is carried forward with the C1-validated exact16 lowercase fingerprint predicate. Hook selected() requires unique mount Destinations then sorts full mount dictionaries once. Every full-object key stays in equality; every identity/running/start/owner guard remains, and returned inspect ID must match the requested ID. Real call() retains complete private stdout/stderr0400 and public argv/code/elapsed/hash/length metadata BEFORE predicates. Every error fails; each owner is attempted; stop precedes source verification and controller memory; independent private hook HMAC key follows those operations. No real inspect bytes or keys are fetched/published.

The new tests exercise actual call+stop_exact/real filesystem retention with only the subprocess Docker replaced by a closed stand-in: all6x6 orders EACH owner, every key of each real public mount object changed, duplicate/missing/extra/unknown/removed fields, identity/state changes, running-owner real-call stop, error continuation, stderr and timeout retention. Old tests remain with updated fresh-authority/16hex/memory.stat fixtures. Exact unpatched bound application controller writer is evaluated locally in Node with inert non-crypto imports; host Python consumes that retained LOCAL output and makes no host-Node claim. Map-array-sweep.json lists every relevant site/verdict plus the exhaustive runtime equality inventory.

There is NO verified earlier host docker stop through THIS stop_owned.call; C2 proved only ps/inspect end to end. Old063000 emergency stops used a distinct Docker.stop subprocess interface; its hook cause remains UNKNOWN. Tests cover the requested running-owner stop branch with a stand-in. Actual scope explicitly requires NO further host check before this graph.

Controller numeric PID/no-ancestor-alias/membership/device-inode/805Swap0/OOM guards remain; memory.stat anon/file and every counter are now retained before predicates before/after and poststop. Peaks/max/high remain observations only. Runtime receipt remains AWAITING_EXEC_STOP_POST, never closed PASS. No qualification claim until actual full closure/independent acceptance.

Full112tables42receipts, strict existing+same-sync-new provenance/hold/audit pairing, second natural conflict idempotence, broad31API+6readonly probes, two natural syncs/refusal pairs, every container805blankheapSwap0/600total, N25/MIN64/25percent/3assets/floor10556150894+4GiBlogs+10GB/500MB remain. In-place existing-conflict metadata-array revision remains a conservative refusal, as documented in the accepted prechecks. C1 validated186new22holds on063000 data; skipped22 is log description only and future counts may differ. Future kit must disclose manager hold impact, stop grace/actual exit code and grace included in9to10minute restart/exact600 failure behavior. MainMERGEHOLD/233000KEEPIT/R2COMPLETE/noprune/nohostgrowrestart/no103/human files/drafts/cards preserved. External separate-checkout request is not performed under direct human no-new-checkout/agent constraints.
'''
(B/'README.md').write_text(readme,encoding='utf-8',newline='\n')
for name in c.FILES:
 raw=(B/name).read_bytes()
 if name.endswith('.py'):ast.parse(raw,filename=name,feature_version=(3,9));compile(raw,name,'exec')
print(json.dumps({'sourceBindings':len(c.FILES),'runtimeEqualitySites':len(inventory),'inspectionConsumers':len(sites),'literalSiteEntries':len(actual),'sourceOnly':True,'hostOperations':0}))
