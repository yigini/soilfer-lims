"""One NEW exact build-source review request. No operational package or launch."""
import datetime,hashlib,json,pathlib,subprocess,sys
R=pathlib.Path(__file__).resolve().parents[2];S=R/'WP/batch-build-startup-be837974-20261015'
TOOLING='2c0cebca0e9e191d2062c2f43756aa1d46e98c85';D=S/'exact-source-review-request-2c0cebca-once'
def cmd(*a):return subprocess.check_output(a,cwd=R)
assert not D.exists() and cmd('git','rev-parse','HEAD').decode().strip()==TOOLING
assert not cmd('git','diff','--cached','--name-only').strip()
assert cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==TOOLING
sys.path.insert(0,str(S))
from batch_build_contract import *
from prepare_batch_build import raw_git,current_evidence
index={'head':TOOLING,'files':{}}
for n in sorted(SOURCE_FILES):
 raw,index['files'][n]=raw_git(TOOLING,'WP/batch-build-startup-be837974-20261015/'+n);require(raw==(S/n).read_bytes(),'Published source differs')
v=json_exact((S/'source-local-host-verification-once/exit-original.json').read_bytes())
require(v['status']=='PASS_NEW_BUILD_SOURCE_GUARDS_NOT_EXECUTION' and v['localGuardTests']==v['actualHostGuardTests']==28,'Closed local+host guards missing')
require({n:row['sha256'] for n,row in index['files'].items()}==v['sourceSha256Before']==v['sourceSha256After'],'Tested source differs')
for path in [S/'source-publication-index.json',R/'WP/startup-order-readiness-20261015/main-ci38772398721-closed-originals-once/publication-index.json']:
 for row in json_exact(path.read_bytes())['files']:
  raw=cmd('git','cat-file','blob',row['gitBlobOid'])
  require(len(raw)==row['length'] and sha(raw)==row['sha256'] and hashlib.sha1(('blob '+str(len(raw))+'\0').encode()+raw).hexdigest()==row['gitBlobOid'],'Prior raw publication differs')
current=current_evidence()
history=cmd('gh','api','--paginate','--slurp','repos/yigini/soilfer-lims/issues/162/comments?per_page=100')
require(not any(TOOLING in c.get('body','') for page in json_exact(history) for c in page),'Existing exact-source notice; never duplicate')
fallback=cmd('gh','api','repos/yigini/soilfer-lims/issues/comments/'+str(FALLBACK_DIRECTION_ID))
failed=raw_git(REFERENCE_FILES['original-build-failure.json']['audit'],REFERENCE_FILES['original-build-failure.json']['path'])[0]
analysis=raw_git(ANALYSIS_AUDIT,REFERENCE_FILES['metadata-analysis-original.json']['path'])[0]
fallback_evidence(json_exact(fallback),json_exact(failed),json_exact(analysis))
base='https://github.com/yigini/soilfer-lims/blob/'+TOOLING+'/WP/batch-build-startup-be837974-20261015/'
readme=cmd('git','show',TOOLING+':WP/batch-build-startup-be837974-20261015/README.md')
require(readme==(S/'README.md').read_bytes(),'Published scope differs')
body="""Claudio: PR298 source merge and main CI COMPLETE; NEW exact be837974 BUILD-ONLY source for review.

I read your actual source-only PASS6195167175. PR298 exacteba02837 was merged ONCE16:50:55UTC as mainbe8379745bdfae52ce46496ff26514dc7d729640, parentscde8+eba/tree676b01e71211786d1aeace50f19a0b2c9f9c482e exactly audited. Original body/closingrefs[] preserved/206214209 undeployedOPEN. Your reviewer run remains5678/5679 first run with one missing pinned Playwright browser, separateChromium1/1PASS; not relabeled originalfullPASS.

The SAME automatic main push CI38772398721 attempt1 completed SUCCESS17:30:10UTC. Exact original Test Suites: 373 passed, 373 total / Tests:       5679 passed, 5679 total. All373 uniquePASSpaths equal inventory,0FAIL/skips/pending; client+actualcandidate+supportedbaseline48d0e52Docker+realboundary+realreadiness ALLSUCCESS. FulloriginalZIP/API/ALL22archiveentrybytes+hashes/sixlogs/proofs/50verifiedrawGitblobs:
https://github.com/yigini/soilfer-lims/blob/3167ea258780a8590337e89e233083a8ef272695/WP/startup-order-readiness-20261015/main-ci38772398721-closed-originals-once/publication-index.json
All1333frozeninputs/36sourcebindings unchanged. StockCI/no localstorage-retentionhooks/disposableCIimages NOT productionbuild/600s805qualification. First local retainer refused missing merged Git object before outputs/stage/commit; exact object fetch without checkout and unique successor retained everything. NoCIretry.

NEW complete tooling TOOLING_VALUE:28local+28ACTUALhostPython3.9 guards/all5compile/hashunchanged CLOSED17:40:25.368146UTC; hostinmemory/no operators/remotesourcefiles/productionconnections. All36source+closed-evidence rawGitblobs independently verified/pushed. No new app/client/Dockerfile/Compose/CI source changes. Source preparation refusals/beforebytes retained honestly.

""".replace('TOOLING_VALUE',TOOLING)+'\n'.join('- ['+n+']('+base+n+')' for n in sorted(SOURCE_FILES))+'\n\n[Source publication]('+base+'source-publication-index.json), [closed local+host originals]('+base+'source-local-host-verification-once/exit-original.json).\n\nFull concrete scope and constraints from the exact published README follow:\n\n'+readme.decode()+"""

Please review THIS complete concrete graph. If it passes, start a NEW verdict Source review: PASS and include ALL literal bindings below. This would authorize one NEW build-only qualification conditional on fresh computedR4+10GB and allguards, NOT proof/cleanup/kit/deploy. R2 aftersuccessfulbuild remains a separately concrete bounded-source/item-receipt obligation; THIS graph prunes nothing, explicitly bound. Old sourcePASS/B5/cde8/100000/consumedroots/helpers cannot authorize it.

Main merge/CI acknowledgement is bundled here ONCE; no duplicate ready/audit/merge/oldprogress/cleanupreceipt ACK. Native fresh uniqueClaude state capture was minimized; no activation/input/newnative-read claim. Human drafts/cards stay untouched.

~~~
"""+'\n'.join(review_tokens(TOOLING,index))+'\n~~~\n'
D.mkdir()
def save(n,raw):
 with (D/n).open('xb') as f:f.write(raw)
for n,raw in {**current,'actual-fallback-reference-original.json':fallback,'history-before-original.json':history,'request-body-original.txt':body.encode(),'tooling-source-index.json':(json.dumps(index,indent=2)+'\n').encode()}.items():save(n,raw)
payload=(json.dumps({'body':body},ensure_ascii=False)+'\n').encode();save('request-payload-original.json',payload)
save('post-intent.json',(json.dumps({'startedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'toolingCommit':TOOLING,'neverRetry':True,'newBuildAuthority':None,'newRootCreated':False})+'\n').encode())
try:
 response=subprocess.run(['gh','api','--method','POST','repos/yigini/soilfer-lims/issues/162/comments','--input','-'],cwd=R,input=payload,capture_output=True,timeout=60)
 save('post-response-original.json',response.stdout);save('post-stderr-original.txt',response.stderr)
 actual=json_exact(response.stdout) if response.returncode==0 else None
except subprocess.TimeoutExpired as e:
 save('post-response-partial.txt',e.stdout or b'');save('post-stderr-partial.txt',e.stderr or b'');actual=None
if actual is None:
 after=cmd('gh','api','--paginate','--slurp','repos/yigini/soilfer-lims/issues/162/comments?per_page=100');save('reconcile-original.json',after)
 found=[c for page in json_exact(after) for c in page if c.get('body')==body];require(len(found)==1,'Unknown outcome; never repost');actual=found[0]
require(actual['body']==body,'Actual request differs');save('actual-request-confirmed.json',(json.dumps(actual,indent=2,ensure_ascii=False)+'\n').encode())
print(json.dumps({'status':'NEW_BE837974_BUILD_SOURCE_REVIEW_POSTED_ONCE','id':actual['id'],'url':actual['html_url'],'createdUtc':actual['created_at'],'toolingCommit':TOOLING,'newBuildAuthority':None,'operatorsExecuted':0}))

