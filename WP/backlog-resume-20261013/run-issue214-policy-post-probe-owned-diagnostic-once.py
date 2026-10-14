"""Run one explicitly isolated retained probe diagnostic; no production connection/cleanup."""
import datetime,hashlib,json,os,subprocess,uuid
from pathlib import Path
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent;server=root/'server'
dest=wp/'issue214-policy-post-probe-owned-diagnostic';assert not dest.exists() and not os.environ.get('NODE_OPTIONS')
template=server/'tests/.owned-templates/test_template_33522c62-1788-4298-8db6-06a0d4e5ff38.db'
def triples(p):return {s:hashlib.sha256(Path(str(p)+s).read_bytes()).hexdigest() if Path(str(p)+s).exists() else None for s in ['', '-wal','-shm']}
before=triples(template);assert before['']
context=server/'tests/.tmp'/('test_issue214_policy_probe_context_'+str(uuid.uuid4())+'.db');assert not context.exists()
for suffix,digest in before.items():
 if digest is not None:
  with Path(str(context)+suffix).open('xb') as f:f.write(Path(str(template)+suffix).read_bytes())
assert triples(template)==before and triples(context)==before
dest.mkdir();env=dict(os.environ,NODE_ENV='test',DATABASE_PATH=str(context),LIMS_OWNED_TEST_TEMPLATE=str(template))
argv=['node',str(wp/'diagnose-issue214-policy-post-probe-owned-once.cjs')]
(dest/'command-original.json').write_bytes((json.dumps({'argv':argv,'databasePath':str(context),'sourceTemplate':str(template),
 'templateBefore':before,'nodeOptions':'','productionOperations':0},indent=2)+'\n').encode())
with (dest/'stdout-original.log').open('xb') as out,(dest/'stderr-original.log').open('xb') as err:
 result=subprocess.run(argv,cwd=root,env=env,stdout=out,stderr=err)
(dest/'exit-original.txt').write_bytes((str(result.returncode)+'\n').encode())
assert triples(template)==before
record={'closedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'exitCode':result.returncode,'sourceTemplateTripleUnchanged':True,
 'contextRetained':str(context),'productionConnections':0,'productionOperations':0}
(dest/'closed-boundary.json').write_bytes((json.dumps(record,indent=2)+'\n').encode())
print(json.dumps(record));assert result.returncode==0
