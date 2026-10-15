"""Post one concrete snapshot-preservation scope boundary, no operator/retry."""
import datetime,json,pathlib,subprocess,sys
REPO=pathlib.Path(__file__).resolve().parents[2];SOURCE=REPO/'WP/batch-proof-name-inventory-cde8-20261015';DEST=SOURCE/'fresh-seal-preservation-boundary-060000-once';BASE='681e3a3522b7f5712798fa7547193169bbc82e53'
sys.path.insert(0,str(SOURCE));from proof_contract import *
from prepare_proof import current_evidence
def cmd(*a):return subprocess.check_output(a,cwd=REPO)
require(cmd('git','rev-parse','HEAD').decode().strip()==BASE and not cmd('git','diff','--cached','--name-only').strip() and not (DEST/'post-intent.json').exists(),'Consumed boundary or writer changed')
require(cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==BASE,'Remote moved')
index=exact_json((SOURCE/'actual-source-pass-6184203154/tooling-source-index.json').read_bytes());review=exact_json((SOURCE/'actual-source-pass-6184203154/actual-source-pass-original.json').read_bytes());evidence=current_evidence(review,index)
marker='stopped-copy-060000-fresh-seal-preservation-6ebd4f87'
require(not any(marker in c.get('body','') for c in evidence['sourceComments']),'Boundary already posted; inspect never duplicate')
r=exact_json((SOURCE/'first-proof-060000-closed-source-preservation-stop/closed-retention-record.json').read_bytes());require(r['originalRefusal']['closedUtc']=='2026-10-15T04:16:51.486060+00:00' and r['retainedRawMasterBytesMatchOriginalCopyAuthority'] and r['rootFileCount']==39 and r['installerOrEntrypointAttempts']==0,'Boundary evidence differs')
body=(DEST/'actual-boundary-body.txt').read_text(encoding='utf-8')
def save(n,raw):
    with (DEST/n).open('xb') as f:f.write(raw)
save('fresh-current-evidence-before-post.json',canonical(evidence)+b'\n');payload=canonical({'body':body})+b'\n';save('payload-original.json',payload);save('post-intent.json',canonical({'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'marker':marker,'neverRetry':True,'newOperations':0})+b'\n')
actual=None
try:
    result=subprocess.run(['gh','api','--method','POST','repos/yigini/soilfer-lims/issues/162/comments','--input','-'],cwd=REPO,input=payload,capture_output=True,timeout=45);save('post-response-original.json',result.stdout);save('post-stderr-original.log',result.stderr)
    if result.returncode==0:actual=exact_json(result.stdout)
except subprocess.TimeoutExpired as e:save('partial-stdout.log',e.stdout or b'');save('partial-stderr.log',e.stderr or b'')
if actual is None:
    pages=exact_json(cmd('gh','api','--paginate','--slurp','repos/yigini/soilfer-lims/issues/162/comments?per_page=100'));save('reconcile-original.json',canonical(pages)+b'\n');matches=[c for page in pages for c in page if c.get('body')==body];require(len(matches)==1,'Uncertain outcome; inspect never repost');actual=matches[0]
require(actual['body']==body,'Actual body differs');save('actual-boundary-confirmed.json',canonical(actual)+b'\n')
print(json.dumps({'status':'ACTUAL_FRESH_SEAL_PRESERVATION_SCOPE_BOUNDARY_POSTED_ONCE','id':actual['id'],'url':actual['html_url'],'createdUtc':actual['created_at'],'newOperations':0}))
