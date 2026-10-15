"""Retain exactly one posted source-review request and honest native-minimized observation."""
import datetime,hashlib,json,pathlib,subprocess
R=pathlib.Path(__file__).resolve().parents[2];S=R/'WP/batch-build-startup-be837974-20261015';D=S/'exact-source-review-request-2c0cebca-once'
BASE='2c0cebca0e9e191d2062c2f43756aa1d46e98c85'
def run(argv):
 p=subprocess.run(argv,cwd=R,capture_output=True);assert p.returncode==0,p.stderr.decode('utf-8','replace');return p.stdout
def git(*args):return run(['git','-c','core.longpaths=true',*args])
def gh(endpoint):return run(['gh','api',endpoint])
def sha(v):return hashlib.sha256(v).hexdigest()
def oid(v):return hashlib.sha1(('blob '+str(len(v))+'\0').encode()+v).hexdigest()
def js(n,x):
 with (D/n).open('x',encoding='utf-8') as f:json.dump(x,f,indent=2)
assert not (D/'publication-index.json').exists()
assert git('rev-parse','HEAD').decode().strip()==BASE and git('branch','--show-current').decode().strip()=='audit/release-eb6de2e8'
assert not git('diff','--cached','--name-only').strip()
assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==BASE
posted=json.loads((D/'actual-request-confirmed.json').read_bytes());assert posted['id']==6198527574
fresh=gh('repos/yigini/soilfer-lims/issues/comments/6198527574')
actual=json.loads(fresh);assert actual['body']==posted['body'] and actual['created_at']==posted['created_at']
with (D/'actual-request-fresh-original.json').open('xb') as f:f.write(fresh)
coord=gh('repos/yigini/soilfer-lims/issues/162/comments?since=2026-10-15T17:46:11Z&per_page=100')
with (D/'coordination-after-request-original.json').open('xb') as f:f.write(coord)
main=gh('repos/yigini/soilfer-lims/git/ref/heads/main')
with (D/'main-after-request-original.json').open('xb') as f:f.write(main)
assert json.loads(main)['object']['sha']=='be8379745bdfae52ce46496ff26514dc7d729640'
record={'observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':'NEW_EXACT_BUILD_SOURCE_REVIEW_REQUESTED_ONCE','requestId':actual['id'],'requestUrl':actual['html_url'],'requestCreatedUtc':actual['created_at'],'toolingCommit':BASE,
 'sourceFiles':5,'closedLocalGuards':28,'closedActualHostGuards':28,'sourceUnchanged':True,
 'native':{'freshReturnedApp':'Claude_pzs8sxrjxfjjc!Claude','freshUniqueReturnedWindow':7867734,'stateCapture':'window is minimized; call activate_window, refresh with get_window, then retry get_window_state','actualCurrentNativeContentObtained':False,'activationInputNavigationTypingOrMessage':False,'nativeAcknowledgementOrHandoffSent':False,'humanDraftsCardsUntouched':True},
 'mainCiAcknowledgement':'Bundled ONCE in source-review request6198527574; no separate duplicate GH ACK/native message.',
 'exactNewSourcePassClaimed':False,'newOperationalPackageOrRoot':False,'builds':0,'proofs':0,'cleanup':0,'productionOperations':0,
 'preparationRefusal':{'kind':'TOOL_OUTPUT_TRANSCRIPTION','error':'functions exec SyntaxError Invalid or unexpected token due Markdown fence in JS source template; before any helper file creation or post; unique corrected helper posted once','remotePostCount':1}}
js('delivery-record.json',record)
lead="""## 2026-10-15 NEW be837974 build-source exact review6198527574 requested ONCE

Actual #162 comment6198527574 at17:46:11UTC binds tooling2c0cebca0e9e191d2062c2f43756aa1d46e98c85/all5hashes/ALLliteralbindings/newbe837974/tree676b/mainCI38772398721/all4audits/fresh semantic rule pins/R4computed+10GB before root/unit/build. https://github.com/yigini/soilfer-lims/issues/162#issuecomment-6198527574. CLOSED28local+28ACTUALhostPython3.9/all5compile/hashunchanged/source36rawverified. MainCImergeACK bundledONLYhere/no duplicate request/ACK/native. Fresh uniqueClaude7867734 state capture MINIMIZED/no currentnative content/activationinputnavigationmessage; human content protected/nativehandoff UNSENT. Actual NEW exact-source PASS remains required; no operationalpackage/newroot/unit/build/proof/cleanup/kit/gate/deploy. R2 aftersuccessfulbuild actualmax-used-space5GB/sharedinuse protection remains separate concrete bounded-source/receipt obligation; this builder prunesnothing. R1 no proofDBremovalpendingYY/R3listing/R5nobackupremoval; allscience/refusal/reports/impact/hash/copyrace/600/805/forwardonly/no103/history held. Full request/authority/current APIs/delivery record at WP/batch-build-startup-be837974-20261015/exact-source-review-request-2c0cebca-once. Next actual NEW verdict/findings; never replay consumed helpers/oldPASScde8B5100000.

"""
readmes=[R/'WP/audit-release-eb6de2e8/README.md',R/'WP/runtime-recovery-kobo/README.md']
for p in readmes:p.write_bytes(lead.encode()+p.read_bytes())
paths=[p for p in sorted(D.rglob('*')) if p.is_file()]+[R/'WP/backlog-resume-20261013/request-startup-be837974-build-source2c0cebca-once.py',pathlib.Path(__file__),*readmes]
bindings=[]
for p in paths:
 v=p.read_bytes();bindings.append({'path':p.relative_to(R).as_posix(),'length':len(v),'sha256':sha(v),'gitBlobOid':oid(v)})
index=D/'publication-index.json';js('publication-index.json',{'baseAudit':BASE,'requestId':6198527574,'toolingCommit':BASE,'files':bindings,'productionOperations':0})
paths.append(index);names=[p.relative_to(R).as_posix() for p in paths];assert len(names)==len(set(names))
git('-c','core.autocrlf=false','add','-f','--',*names)
assert set(git('diff','--cached','--name-only').decode().splitlines())==set(names)
tree=git('write-tree').decode().strip()
for p,n in zip(paths,names):
 v=git('show',tree+':'+n);assert v==p.read_bytes() and oid(v)==git('rev-parse',tree+':'+n).decode().strip()
git('commit','-m','Retain new be837974 build source review request6198527574')
head=git('rev-parse','HEAD').decode().strip();git('push','origin','audit/release-eb6de2e8')
assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head
print(json.dumps({'audit':head,'rawVerifiedOwnedBlobs':len(paths),'requestId':6198527574,'newSourcePassClaimed':False,'newOtherComments':[{'id':c['id'],'created_at':c['created_at'],'body':c['body']} for c in json.loads(coord) if c['id']!=6198527574],'productionOperations':0}))

