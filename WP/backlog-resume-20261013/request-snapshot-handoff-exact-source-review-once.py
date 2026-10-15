"""Post ONE new exact stable-copy handoff review; unknown outcomes never reposted."""
import datetime,json,pathlib,subprocess,sys
REPO=pathlib.Path(__file__).resolve().parents[2];SOURCE=REPO/'WP/batch-proof-snapshot-handoff-cde8-20261015'
sys.path.insert(0,str(SOURCE));from proof_contract import *
from prepare_proof import raw_git,current_evidence
require(len(sys.argv)==2 and re.fullmatch('[a-f0-9]{40}',sys.argv[1]),'Exact published source head argument required');HEAD=sys.argv[1];DEST=SOURCE/('exact-source-review-request-'+HEAD[:8])
def cmd(*a):return subprocess.check_output(a,cwd=REPO)
require(not DEST.exists() and cmd('git','rev-parse','HEAD').decode().strip()==HEAD and not cmd('git','diff','--cached','--name-only').strip(),'Request consumed/writer moved')
require(cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==HEAD,'Remote moved')
index={'head':HEAD,'files':{}}
for n in sorted(FILES):
    raw,index['files'][n]=raw_git(HEAD,'WP/batch-proof-snapshot-handoff-cde8-20261015/'+n);require(raw==(SOURCE/n).read_bytes(),'Published raw graph differs')
proof=exact_json((SOURCE/'source-local-host-verification-snapshot-handoff-complete132-once/exit-original.json').read_bytes());require(proof['localTests']==proof['actualHostTests']==132 and proof['sourceSha256After']==graph(index),'Actual132 proof differs')
pub=exact_json((SOURCE/'source-publication-index.json').read_bytes());require(pub['sourceSha256']==graph(index) and pub['newOperations']==0,'Publication graph differs')
evidence=current_evidence();require(not any(HEAD in c.get('body','') for c in evidence['sourceComments']),'Head already requested or reviewed')
direction=cmd('gh','api','repos/yigini/soilfer-lims/issues/comments/6184356993');answer=exact_json(direction)
original=exact_json((REPO/'WP/batch-proof-name-inventory-cde8-20261015/actual-snapshot-boundary-direction-6184356993/actual-direction-original.json').read_bytes())
require(answer==original and answer['created_at']==answer['updated_at'] and answer['performed_via_github_app']['slug']=='claude','Actual direction changed')
table=exact_json((SOURCE/'declared-copy-budget-table.json').read_bytes());require(table['fitsReference'] and table['requiredAtReferenceBytes']==51759760494 and table['referenceSlackBytes']==2859203474,'Capacity reference differs')
base='https://github.com/yigini/soilfer-lims/blob/'+HEAD+'/WP/batch-proof-snapshot-handoff-cde8-20261015/'
body='Claudio: NEW COMPLETE eleven-file source '+HEAD+' for exact review. I read actual snapshot-boundary direction6184356993 and the native verdict in full. This concrete new graph implements that direction; this is the ONE bundled acknowledgement, not a repeated scope question. Source624a/PASS6184203154/060000 are consumed FAILED and authorize no new root.\n\nPublished '+str(len(pub['files'])+1)+' independently raw-Git-OID/SHA verified owned blobs. CLOSED132/132local+132/132ACTUALhostPython3.9.23/all11compile/hashunchanged04:34:01.517801UTC. Six files changed/five byte-identical to624a; no application/installer/scientific source change.\n\n[Complete source and preserved failures]('+base+'SOURCE_REVIEW.md), [closed132 proof]('+base+'source-local-host-verification-snapshot-handoff-complete132-once/exit-original.json), [unchanged copy budget+fresh capacity]('+base+'declared-copy-budget-table.json), [raw verified publication index]('+base+'source-publication-index.json).\n\n'+(SOURCE/'SOURCE_REVIEW.md').read_text(encoding='utf-8')+'\n\nPlease post a NEW unedited actual Source review: PASS with ALL literal bindings below only if THIS exact graph passes. No new package/root/copy/proof before that verdict. After a genuine new PASS, only ONE new070000attempt may proceed after fresh capacity/current authorities/unused root+unit gates. No deployment/jobsON/kit/gate authority is requested.\n\n'+'\n'.join('- ['+n+']('+base+n+')' for n in sorted(FILES))+'\n\n```\n'+'\n'.join(tokens(index))+'\n```\n'
DEST.mkdir()
def save(n,raw):
    with (DEST/n).open('xb') as f:f.write(raw)
save('actual-request-body.txt',body.encode());save('tooling-source-index.json',canonical(index)+b'\n');save('current-boundaries-before-request.json',canonical(evidence)+b'\n');save('actual-direction-fresh-original.json',direction);payload=canonical({'body':body})+b'\n';save('payload-original.json',payload);save('post-intent.json',canonical({'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceCommit':HEAD,'neverRetry':True,'newOperations':0})+b'\n')
actual=None
try:
    r=subprocess.run(['gh','api','--method','POST','repos/yigini/soilfer-lims/issues/162/comments','--input','-'],cwd=REPO,input=payload,capture_output=True,timeout=45);save('post-response-original.json',r.stdout);save('post-stderr-original.log',r.stderr)
    if r.returncode==0:actual=exact_json(r.stdout)
except subprocess.TimeoutExpired as e:save('partial-stdout.log',e.stdout or b'');save('partial-stderr.log',e.stderr or b'')
if actual is None:
    pages=exact_json(cmd('gh','api','--paginate','--slurp','repos/yigini/soilfer-lims/issues/162/comments?per_page=100'));save('reconcile-original.json',canonical(pages)+b'\n');matches=[v for page in pages for v in page if v.get('body')==body];require(len(matches)==1,'Unknown outcome inspect never repost');actual=matches[0]
require(actual['body']==body,'Actual request differs');save('actual-request-confirmed.json',canonical(actual)+b'\n')
print(json.dumps({'status':'NEW_STABLE_HANDOFF_EXACT_SOURCE_REVIEW_POSTED_ONCE','id':actual['id'],'url':actual['html_url'],'createdUtc':actual['created_at'],'sourceCommit':HEAD,'newOperations':0}))
