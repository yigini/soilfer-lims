"""Prepare a NEW source-only graph and retain actual6203416404 direction; no server operator."""
import hashlib,json,pathlib,shutil,subprocess
R=pathlib.Path(__file__).resolve().parents[2];old=R/'WP/batch-proof-startup-be837974-20261015';new=R/'WP/batch-proof-memory-events-be837974-20261015'
assert not new.exists();new.mkdir();before=new/'source-preparation-before';before.mkdir()
names=sorted(json.loads((old/'proof230000-closed-memory-originals-once/remote-originals/tooling-source-index.json').read_bytes())['files'])
for n in names:
 raw=(old/n).read_bytes();(before/n).write_bytes(raw);(new/n).write_bytes(raw)
for n in ['application-source-fixtures','bound-input-records','new-authority-fixtures']:shutil.copytree(old/n,new/n)
(new/'compose-source.yml').write_bytes((old/'compose-source.yml').read_bytes())
d=new/'actual-memory-direction6203416404-once';d.mkdir()
r=subprocess.run(['gh','api','repos/yigini/soilfer-lims/issues/comments/6203416404'],cwd=R,capture_output=True,timeout=60)
(d/'stdout-original.json').write_bytes(r.stdout);(d/'stderr-original.log').write_bytes(r.stderr);assert r.returncode==0
v=json.loads(r.stdout);assert v['id']==6203416404 and v['created_at']==v['updated_at']=='2026-10-15T22:16:57Z' and v['performed_via_github_app']['id']==1236702 and v['performed_via_github_app']['slug']=='claude'
projection={k:v[k] for k in ['id','body','created_at','updated_at']};projection['app']={k:v['performed_via_github_app'][k] for k in ['id','slug']}
pin=hashlib.sha256(json.dumps(projection,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()).hexdigest()
(d/'direction-readable.txt').write_bytes(v['body'].encode());(d/'semantic-pin.json').write_bytes(json.dumps({'projection':projection,'sha256':pin},sort_keys=True).encode())
(new/'new-authority-fixtures/memory-direction6203416404.json').write_bytes(r.stdout)
(new/'new-authority-fixtures/prior230000-closed-result.json').write_bytes((old/'proof230000-closed-memory-publication-once/closed-result.json').read_bytes())
def change(n,a,b):
 p=new/n;s=p.read_text(encoding='utf-8');assert a in s,(n,a[:100]);p.write_bytes(s.replace(a,b).encode())
oldrel='WP/batch-proof-startup-be837974-20261015/';newrel='WP/batch-proof-memory-events-be837974-20261015/'
change('proof_contract.py','workflow-batch-startup-be837974-20261015T230000Z','workflow-batch-startup-memory-be837974-20261015T233000Z')
change('proof_contract.py',"'proof_render.py'})","'proof_render.py','proof_memory.py'})")
change('proof_contract.py',"review.get('id',0)>6202615241","review.get('id',0)>6203416404")
change('proof_contract.py',"review['created_at']>'2026-10-15T21:25:49Z'","review['created_at']>'2026-10-15T22:16:57Z'")
change('proof_contract.py',"'r2CompleteNoFurtherPrune=true']", "'r2CompleteNoFurtherPrune=true','memoryDirection=6203416404','memoryDirectionSha256='+MEMORY_DIRECTION_SHA,'memoryEventsOomAndOomKillMustBeZero=true','containerHostCgroupExactIdEveryHealthPoll=true','sampledNonReclaimableMaximumBytes=603979776','memoryNonReclaimableFields=anon+shmem+slab_unreclaimable+kernel_stack+pagetables+percpu+sock','memoryPeakAndMaxHighPgscanPgstealObservationOnly=true','readyMaxRssBytesRecorded=true','prior230000ConsumedFailureSha256=ff22ab7627ab90aa3848dd5ae0cf3078cc4fb60b787f33944185a9415e42ab1d']")
with (new/'proof_contract.py').open('ab') as f:f.write(("\nMEMORY_DIRECTION_SHA="+repr(pin)+"\ndef memory_authority(value):\n    require(value.get('id')==6203416404 and value.get('created_at')==value.get('updated_at')=='2026-10-15T22:16:57Z' and value.get('performed_via_github_app',{}).get('id')==1236702 and value.get('performed_via_github_app',{}).get('slug')=='claude' and sha(canonical(authority_projection(value)))==MEMORY_DIRECTION_SHA,'Actual memory direction changed')\n").encode())
change('prepare_proof.py',oldrel,newrel)
change('prepare_proof.py',"    current(out['main']", "    out['memoryDirection']=gh('repos/yigini/soilfer-lims/issues/comments/6203416404');memory_authority(out['memoryDirection'])\n    current(out['main']")
change('run_stopped_proof.py',"post_reboot_authorities(evidence['postRebootAuthorities'])", "post_reboot_authorities(evidence['postRebootAuthorities']);memory_authority(evidence['memoryDirection'])")
# Synthetic review identities must be later than the NEW actual direction floor.
change('verify_proof_guards.py','6203000001','6203500001')
change('verify_proof_guards.py','2026-10-15T21:50:00Z','2026-10-15T22:20:00Z')
change('verify_proof_guards.py',"v['updated_at']='2026-10-15T21:51:00Z'", "v['updated_at']='2026-10-15T22:21:00Z'")
change('verify_proof_guards.py',"'created_at':'2026-10-15T21:52:00Z'", "'created_at':'2026-10-15T22:22:00Z'")
print(json.dumps({'newSourceFolder':str(new),'copiedFrozenSourceFiles':len(names),'directionId':v['id'],'semanticSha256':pin,'serverOperations':0,'sourceGraphStillBeingImplemented':True},ensure_ascii=True))
