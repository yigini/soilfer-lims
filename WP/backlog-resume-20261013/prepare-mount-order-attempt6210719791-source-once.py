"""Prepare a genuinely new complete attempt graph. SOURCE ONLY, no operators."""
import ast,hashlib,json,pathlib,sys
sys.dont_write_bytecode=True
W=pathlib.Path(__file__).resolve().parents[2]
O=W/'WP/batch-proof-controller-forward-step2-be837974-20261016'
P=W/'WP/controller063000-prechecks-be837974-20261016'
N=W/'WP/batch-proof-mount-order-forward-be837974-20261016'
assert not N.exists()
oldindex=json.loads((O/'exact-source-review420-once/source-index.json').read_bytes())
assert len(oldindex['files'])==31
old={n:(O/n).read_bytes() for n in oldindex['files']}
assert all(hashlib.sha256(b).hexdigest()==oldindex['files'][n]['sha256'] for n,b in old.items())
N.mkdir()
for n,b in old.items():(N/n).write_bytes(b)
for folder in ['bound-input-records','new-authority-fixtures','application-source-fixtures']:
 for p in (O/folder).rglob('*'):
  if p.is_file():
   q=N/p.relative_to(O);q.parent.mkdir(parents=True,exist_ok=True);q.write_bytes(p.read_bytes())
(N/'compose-source.yml').write_bytes((O/'compose-source.yml').read_bytes())
def edit(name,before,after,count=1):
 p=N/name;s=p.read_text(encoding='utf-8');assert s.count(before)==count,(name,before,s.count(before));p.write_text(s.replace(before,after),encoding='utf-8',newline='\n')
edit('proof_contract.py','workflow-batch-controller-forward-step2-be837974-20261016T063000Z','workflow-batch-mount-order-forward-be837974-20261016T100000Z')
extras=['verify_mount_order_guards.py','writer_fingerprint.cjs','writer-controller-original.js','real-mount-fixtures.json','accepted-prechecks-original.json','map-array-sweep.json']
edit('proof_contract.py',"'verify_provenance_guards.py'})","'verify_provenance_guards.py',"+','.join(repr(n) for n in extras)+"})")
edit('proof_contract.py',"return ['acceptedControllerRefusalId=6207912526'","return ['acceptedPrechecksId=6210719791','acceptedPrechecksSemanticSha256=94c17911c87ec6e9d860001528deab785f24a0c6c83ea69af09b6308c257fe97','mountComparison=FULL_OBJECTS_UNIQUE_DESTINATION_SORTED_ONCE','rotatingMountOrdersBothOwners6x6=true','dockerStopThroughRealCallStandIn=true','mapArrayComparisonSweepBound=true','controllerMemoryStatAnonFileBeforeAfter=true','noAdditionalHostPrecheck=true','acceptedControllerRefusalId=6207912526'")
edit('proof_contract.py',"review.get('id',0)>6207912526","review.get('id',0)>6210719791")
edit('proof_contract.py',"'2026-10-16T04:12:57Z'","'2026-10-16T07:48:56Z'")
with (N/'proof_contract.py').open('a',encoding='utf-8',newline='\n') as f:
 f.write("\nATTEMPT_AUTHORITY_PINS={'6208837867':'f260602d431018eacf632a04fc331515ed53746e9d08b8a2ba938e5d2650927d','6210719791':'94c17911c87ec6e9d860001528deab785f24a0c6c83ea69af09b6308c257fe97'}\ndef attempt_authorities(values):\n    require(set(values)==set(ATTEMPT_AUTHORITY_PINS),'Both actual forward acceptances required')\n    for key,pin in ATTEMPT_AUTHORITY_PINS.items():\n        value=values[key];app=value.get('performed_via_github_app') or {}\n        require(value.get('id')==int(key) and value.get('created_at')==value.get('updated_at') and app.get('id')==1236702 and app.get('slug')=='claude' and sha(canonical(authority_projection(value)))==pin,'Actual forward acceptance changed')\n")
for name in ['prepare_proof.py']:
 edit(name,'WP/batch-proof-controller-forward-step2-be837974-20261016/','WP/batch-proof-mount-order-forward-be837974-20261016/')
 edit(name,"    current(out['main']","    out['attemptAuthorities']={i:gh('repos/yigini/soilfer-lims/issues/comments/'+i) for i in ATTEMPT_AUTHORITY_PINS};attempt_authorities(out['attemptAuthorities'])\n    current(out['main']")
edit('run_stopped_proof.py',"    step2_authorities(evidence['step2Authorities'])","    step2_authorities(evidence['step2Authorities']);attempt_authorities(evidence['attemptAuthorities'])")
edit('run_stopped_proof.py',"'diagnosticAcceptedId':6206990387,","'diagnosticAcceptedId':6206990387,'prechecksAcceptedId':6210719791,'prechecksAcceptanceSemanticSha256':ATTEMPT_AUTHORITY_PINS['6210719791'],")
# Only the already reviewed exact16 fingerprint predicate differs in comparator.
(N/'provenance_rules.py').write_bytes((P/'provenance_rules.py').read_bytes())
edit('verify_provenance_guards.py',"'evidenceFingerprint':'f'*64","'evidenceFingerprint':'f'*16")
for n in ['verify_proof_guards.py','verify_provenance_guards.py']:
 edit(n,'6208000001','6211000001',count=2 if n=='verify_proof_guards.py' else 2)
 edit(n,'2026-10-16T04:14:00Z','2026-10-16T07:49:00Z',count=2)
# Retain the real-call evidence path from the accepted precheck, and restore the
# complete attempt's stop-first/verification/memory/private-key main afterwards.
s=(P/'stop_owned.py').read_text(encoding='utf-8').split("if __name__=='__main__':")[0]
s+=old['stop_owned.py'].decode().split('def verify_retained_graph(root):',1)[1].join(['def verify_retained_graph(root):',''])
assert "def verify_retained_graph" in s and s.count('def main():')==1
(N/'stop_owned.py').write_text(s,encoding='utf-8',newline='\n')
edit('stop_owned.py',"    return {'id':v['Id']","    require(len({m['Destination'] for m in v['Mounts']})==len(v['Mounts']),'Stop duplicate mount destination refused')\n    mounts=sorted(v['Mounts'],key=lambda m:m['Destination'])\n    return {'id':v['Id']")
edit('stop_owned.py',"'mounts':v['Mounts']}","'mounts':mounts}")
edit('stop_owned.py',"before=selected(rows[0],owner)","require(rows[0].get('Id')==id,'Exact inspected owner ID differs');before=selected(rows[0],owner)")
edit('stop_owned.py',"after=selected(rows[0],owner)","require(rows[0].get('Id')==id,'Exact inspected owner ID differs');after=selected(rows[0],owner)")
edit('stop_owned.py'," result,errors=post_stop(root)"," configure_records(root)\n result,errors=post_stop(root)")
edit('stop_owned.py'," result['postStopErrors']="," result=public_result(result)\n result['postStopErrors']=")
edit('verify_provenance_guards.py',"'errors':[{'errorType':'RuntimeError'}] if owner_error else []","'errors':[{'owner':'synthetic','phase':'stop','_privateException':RuntimeError('PRIVATE-owner')}] if owner_error else []")
edit('verify_provenance_guards.py',"with mock.patch.object(stop,'ROOT',root),","with mock.patch.object(stop,'_record_root',None),mock.patch.object(stop,'ROOT',root),")
# Required bounded stat evidence, retained before any predicate like the other
# controller reads. Peak/max/high remain observations; OOM/limits stay exact.
edit('controller_guard.py',"['memory.events','memory.current','memory.peak','memory.max','memory.swap.max']","['memory.events','memory.current','memory.peak','memory.max','memory.swap.max','memory.stat']")
edit('controller_guard.py',"    events=parse_events(raws['memory.events']);scalars={}","    memory_stat={}\n    for line in raws['memory.stat'].decode('ascii').splitlines():\n        bits=line.split();require(len(bits)==2 and bits[0] not in memory_stat and re.fullmatch('0|[1-9][0-9]*',bits[1]),'Controller memory.stat malformed')\n        memory_stat[bits[0]]=int(bits[1]);require(memory_stat[bits[0]]<2**64,'Controller memory.stat overflow')\n    require({'anon','file'}<=set(memory_stat),'Controller memory.stat anon/file missing')\n    events=parse_events(raws['memory.events']);scalars={}")
edit('controller_guard.py',"'events':events,'scalars':scalars,","'events':events,'scalars':scalars,'memoryStat':memory_stat,")
edit('verify_provenance_guards.py',"values={'memory.events':","values={'memory.stat':b'anon 123\\nfile 456\\n','memory.events':")
edit('verify_provenance_guards.py',"len(reads),7","len(reads),8")
edit('verify_provenance_guards.py',"len(records),7","len(records),8")
# Writer original bytes are the same bound application source; wrapper only
# redirects its fixture path for the flat immutable operational package.
(N/'writer-controller-original.js').write_bytes((P/'application-source-fixtures/server/controllers/koboController.js').read_bytes())
(N/'writer_fingerprint.cjs').write_text((P/'writer_fingerprint.cjs').read_text(encoding='utf-8').replace("'application-source-fixtures/server/controllers/koboController.js'","'writer-controller-original.js'"),encoding='utf-8',newline='\n')
pins=json.loads((P/'diagnostic-pins.json').read_bytes())
(N/'real-mount-fixtures.json').write_bytes(json.dumps({'source':'ACCEPTED080000_PUBLIC_OWNER_PINS_ONLY','oldRoot':str(pins['root']) if 'root' in pins else '/opt/lims/releases/workflow-batch-controller-forward-step2-be837974-20261016T063000Z','owners':pins['owners'],'adaptation':'Only root, generated name and label are adapted to the NEW root; every mount-object key is preserved.'},sort_keys=True,separators=(',',':')).encode()+b'\n')
(N/'accepted-prechecks-original.json').write_bytes((P/'actual-both-results-accepted6210719791-once/actual-acceptance-original.json').read_bytes())
# Update the complete static literal-site inventory after all subsequent source
# modules/tests are present; no dynamic text is made readable.
record={'kind':'SOURCE_ONLY_PREPARATION','oldSourceHead':oldindex['head'],'old31Sha256':{n:hashlib.sha256(v).hexdigest() for n,v in old.items()},'newFolder':N.relative_to(W).as_posix(),'newRoot':'/opt/lims/releases/workflow-batch-mount-order-forward-be837974-20261016T100000Z','sourceReviewRequired':True,'operatorsExecuted':0,'hostCalls':0,'oldSourcesUnchanged':all((O/n).read_bytes()==v for n,v in old.items())}
(N/'source-preparation.json').write_bytes(json.dumps(record,indent=2).encode())
print(json.dumps(record))
