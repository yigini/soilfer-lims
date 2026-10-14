"""Retain the closed first policy-owner focused failure before any correction."""
import hashlib, json, shutil, datetime
from pathlib import Path
root=Path(__file__).resolve().parents[2]; wp=Path(__file__).parent
run=wp/'issue214-policy-owner-focused'; dest=wp/'issue214-policy-owner-focused-failure'
assert not dest.exists()
summary=json.loads((run/'summary.json').read_bytes())
assert summary['exitCode']==1 and summary['status']=='FAILED_OR_INCOMPLETE'
before=json.loads((run/'source-before.json').read_bytes())
assert before==json.loads((run/'source-after.json').read_bytes())
assert all(hashlib.sha256((root/p).read_bytes()).hexdigest()==digest for p,digest in before.items())
dest.mkdir()
for file in run.iterdir():
    if file.is_file(): shutil.copyfile(file,dest/file.name)
sources=['server/services/labPolicyMigrationSource.js','server/scripts/install_lab_policy_schema.js',
         'server/tests/contracts/issue_214_lab_policy_schema.test.js','server/tests/helpers/workflowWriteScanner.js',
         'server/scripts/rehearsal_deployment_readiness.cjs','server/tests/contracts/deployment_readiness_bootstrap.test.js']
for source in sources: shutil.copyfile(root/source,dest/(Path(source).name+'.original'))
record={'retainedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'summary':summary,'sessionId':48181,
        'failures':['new Lab fixture required country/id','nonexistent selected scanner filename','new test dynamic SQL refused by unchanged scanner','stock bootstrap 20s timeout plus held-file EPERM'],
        'classification':'CLOSED_FAILURE','productionOperations':0}
(dest/'terminal.json').write_text(json.dumps(record,indent=2)+'\n',encoding='utf8')
index={p.relative_to(root).as_posix():{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in dest.iterdir() if p.is_file()}
(dest/'index.json').write_text(json.dumps(index,indent=2)+'\n',encoding='utf8')
print(json.dumps(record))
