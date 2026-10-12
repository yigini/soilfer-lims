"""Verify a NEW actual primary exact-kit verdict before any gate collection."""
import datetime
import hashlib
import json
from pathlib import Path
import subprocess
import sys

d=Path(__file__).resolve().parent
k=d.parent/'pr284-frozen-kit-20261012T161000Z'
sys.path.insert(0,str(k))
import import_release_contract as c

review_id=int(sys.argv[1]);assert review_id>6131168211
output=d/('pr294-kit-pass-'+str(review_id)+'-verified.json')
assert not output.exists()
def gh(endpoint):
 return json.loads(subprocess.check_output(['gh','api','repos/yigini/soilfer-lims/'+endpoint]))
raw=subprocess.check_output(['gh','api','repos/yigini/soilfer-lims/issues/comments/'+str(review_id)])
review=json.loads(raw)
manifest=json.loads((k/'prepared-manifest.json').read_bytes())
digest=c.sha(k/'prepared-manifest.json')
assert digest=='5392cab2c224e68e74694950336ec1fad638eb4c0bf282e6614009f58cb5c7c8'
tokens=c.review_tokens(manifest,digest)
assert review['id']==review_id and review['html_url']=='https://github.com/yigini/soilfer-lims/issues/162#issuecomment-'+str(review_id)
assert next(line.strip().strip('*_# ') for line in review['body'].splitlines() if line.strip())==c.PHRASE
assert not c.has_failed_verdict(review['body']) and all(token in review['body'] for token in tokens)
for name,value in manifest['files'].items(): assert c.sha(k/name)==value
later=gh('issues/162/comments?since='+review['created_at']+'&per_page=100')
assert len(later)<100 and not any(c.has_failed_verdict(row['body'],include_source=True) and row['created_at']>review['created_at'] for row in later)
current=gh('git/ref/heads/main')['object']['sha'];assert current==manifest['head']
ci=gh('actions/runs/38256676268');assert ci['head_sha']==current and ci['status']=='completed' and ci['conclusion']=='success'
with (d/('pr294-kit-pass-'+str(review_id)+'-api.json')).open('xb') as out: out.write(raw)
record={'status':'ACTUAL_NEW_EXACT_KIT_PASS_VERIFIED_NOT_EXECUTED','observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'reviewId':review_id,'reviewUrl':review['html_url'],'reviewApiSha256':hashlib.sha256(raw).hexdigest(),'manifestSha256':digest,'verifiedTokenCount':len(tokens),'currentMainHead':current,'mainCiConclusion':ci['conclusion'],'productionOperations':0}
with output.open('x',encoding='utf-8',newline='\n') as out: json.dump(record,out,indent=2)
print(json.dumps(record))
