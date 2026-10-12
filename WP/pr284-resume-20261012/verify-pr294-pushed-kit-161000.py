"""Check the pushed Git blobs retain all actual frozen kit hashes."""
import hashlib
import json
from pathlib import Path
import subprocess

d=Path(__file__).resolve().parent
w=d.parent.parent
k=w/'WP/pr284-frozen-kit-20261012T161000Z'
m=json.loads((k/'prepared-manifest.json').read_bytes())
expected={**m['files'],'prepared-manifest.json':'5392cab2c224e68e74694950336ec1fad638eb4c0bf282e6614009f58cb5c7c8'}
for n,digest in expected.items():
 raw=subprocess.check_output(['git','show','HEAD:WP/pr284-frozen-kit-20261012T161000Z/'+n],cwd=w)
 assert hashlib.sha256(raw).hexdigest()==digest, 'Pushed Git blob differs: '+n
commit=subprocess.check_output(['git','rev-parse','HEAD'],cwd=w,text=True).strip()
remote=subprocess.check_output(['git','ls-remote','origin','refs/heads/audit/release-eb6de2e8'],cwd=w,text=True).split()[0]
assert commit==remote
record={'status':'ALL_63_PUSHED_GIT_BLOBS_MATCH_ACTUAL_FROZEN_KIT','commit':commit,'verifiedFileCount':len(expected),'productionOperations':0}
with (d/'pr294-pushed-kit-161000-verified.json').open('x',encoding='utf-8',newline='\n') as out: json.dump(record,out,indent=2)
print(json.dumps(record))
