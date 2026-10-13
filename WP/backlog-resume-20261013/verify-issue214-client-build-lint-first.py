import datetime, hashlib, json, os, subprocess, sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf-8')
root=Path(__file__).resolve().parents[2]
dest=Path(__file__).parent/'issue214-client-build-lint-first'
assert not dest.exists() and not os.environ.get('NODE_OPTIONS')
dest.mkdir()
paths=list((root/'client/src').rglob('*.jsx'))+list((root/'client/src').rglob('*.json'))+[root/'client/src/utils/workflowContract.js',root/'server/workflowContract.js']
def hashes():return {str(p.relative_to(root)).replace('\\','/'):hashlib.sha256(p.read_bytes()).hexdigest() for p in paths}
before=hashes();(dest/'source-before.json').write_bytes((json.dumps(before,indent=2)+'\n').encode())
results=[]
for name,args in [('build',['npm.cmd','run','build']),('lint',['npm.cmd','run','lint'])]:
 command=['cmd.exe','/d','/c',*args]
 with (dest/(name+'-stdout-original.log')).open('wb') as out,(dest/(name+'-stderr-original.log')).open('wb') as err:
  result=subprocess.run(command,cwd=root/'client',stdout=out,stderr=err)
 (dest/(name+'-exit-original.txt')).write_bytes((str(result.returncode)+'\n').encode())
 results.append({'name':name,'argv':command,'exitCode':result.returncode})
after=hashes();(dest/'source-after.json').write_bytes((json.dumps(after,indent=2)+'\n').encode())
summary={'observedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'commands':results,'sourceUnchanged':before==after,'productionOperations':0}
(dest/'summary.json').write_bytes((json.dumps(summary,indent=2)+'\n').encode());print(json.dumps(summary),flush=True)
assert before==after and all(row['exitCode']==0 for row in results)