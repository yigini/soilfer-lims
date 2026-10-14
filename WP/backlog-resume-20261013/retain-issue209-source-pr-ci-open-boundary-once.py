"""Retain actual PR297 and its one active38615738432 CI, once; never active logs as completed."""
import datetime,hashlib,json,subprocess,sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf8')
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent;created=wp/'issue209-classified-source-pr-created';reviewDir=wp/'issue209-classified-source-only-review';dest=wp/'issue209-source-pr-ci-open-boundary'
assert not dest.exists()
creation=json.loads((created/'creation-record.json').read_bytes());review=json.loads((reviewDir/'review-ref.json').read_bytes());head=creation['head'];base=creation['base'];number=creation['number'];identifier=38615738432
assert number==297 and head==review['reviewHead']=='562cab2d24b25a500041a44abf384ffc4dbfad7c'
def command(argv):return subprocess.run(argv,cwd=root,capture_output=True,check=True).stdout
def git(*a):return command(['git',*a])
def gh(path):return command(['gh','api',path])
assert git('branch','--show-current').strip()==b'audit/release-eb6de2e8' and git('rev-parse','HEAD').strip()==creation['auditSource'].encode() and not git('diff','--cached','--name-only').strip()
frozen=json.loads((wp/'issue209-full-classified-ordinary/source-before.json').read_bytes());assert len(frozen)==1327
for p,d in frozen.items():assert hashlib.sha256((root/p).read_bytes()).hexdigest()==d,p
raw={'pr-original.json':gh(f'repos/yigini/soilfer-lims/pulls/{number}'),'main-original.json':gh('repos/yigini/soilfer-lims/git/ref/heads/main'),'issue209-original.json':gh('repos/yigini/soilfer-lims/issues/209'),'pr-comments-original.json':gh(f'repos/yigini/soilfer-lims/issues/{number}/comments?per_page=100'),'runs-original.json':gh(f'repos/yigini/soilfer-lims/actions/runs?event=pull_request&head_sha={head}&per_page=100'),'run-original.json':gh(f'repos/yigini/soilfer-lims/actions/runs/{identifier}'),'jobs-original.json':gh(f'repos/yigini/soilfer-lims/actions/runs/{identifier}/jobs?per_page=100')}
pr=json.loads(raw['pr-original.json']);ci=json.loads(raw['run-original.json']);jobs=json.loads(raw['jobs-original.json'])['jobs'];runs=json.loads(raw['runs-original.json'])['workflow_runs']
assert pr['state']=='open' and pr['head']['sha']==head and pr['base']['sha']==base and pr['body']==(created/'pr-body-original.md').read_text(encoding='utf8')
assert json.loads(raw['main-original.json'])['object']['sha']==base and json.loads(raw['issue209-original.json'])['state']=='open'
assert not json.loads(raw['pr-comments-original.json']),'Read new actual comments before retaining an open boundary.'
assert len([r for r in runs if r['head_sha']==head and r['event']=='pull_request' and r['name']=='CI'])==1
assert ci['head_sha']==head and ci['event']=='pull_request' and ci['run_attempt']==1 and ci['status'] in ['queued','in_progress'] and ci['conclusion'] is None
assert len(jobs)<=1 and all(j['status'] in ['queued','in_progress'] and j['conclusion'] is None for j in jobs)
raw['closing-refs-original.json']=command(['gh','pr','view',str(number),'--repo','yigini/soilfer-lims','--json','closingIssuesReferences']);assert json.loads(raw['closing-refs-original.json'])['closingIssuesReferences']==[]
dest.mkdir()
for n,b in raw.items():(dest/n).write_bytes(b)
record={'retainedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'status':'OPEN_METADATA_ONLY','number':number,'url':pr['html_url'],'head':head,'tree':creation['tree'],'base':base,'auditSource':creation['auditSource'],'run':identifier,'runUrl':ci['html_url'],'attempt':1,'runStatus':ci['status'],'conclusion':None,'localSuites':370,'localTests':5642,'activeLogsCaptured':False,'readyNoticeSent':False,'finalNativeAuditRequestSent':False,'actualFinalAuditPass':False,'ciDispatches':0,'productionOperations':0,'files':{n:{'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()} for n,b in raw.items()},'preparedUnusedTerminalHelper':'retain-issue209-source-pr-ci-terminal-once.py'}
(dest/'index.json').write_bytes((json.dumps(record,indent=2)+'\n').encode())
lead=f'## 2026-10-14 #209 source PR297 created; one actual CI38615738432 ACTIVE\n\nPR297 is OPEN on exact source-only head{head}, tree{creation["tree"]}, base{base}. It is attached to this chat; closing references are empty. Actual pull_request CI38615738432 attempt1 is in progress with no conclusion. Observe THIS SAME run; never retry/dispatch/replay or duplicate PR/notice. Standard unchanged CI must run ordinary npm test without local storage hooks, build client and both actual candidate/baseline48d Docker images, then real disposable boundary/readiness. No active logs captured as CLOSED. Original full local370/5642 PASS18:25:08.403282UTC, all1327 source hashes unchanged, full inventory and original help manifest before+after94717B hashes retained23 verified blobs5cd at issue209-full-classified-ordinary/terminal-index.json. All650 original cases independently reconciled59reports/122appdraft paths. PR original body lists both runtime-reachable and fixture-only groups, ONE accepted receipt0to1 and every87 test/fixture old/new line range with complete literal1653-line diff. All four actual scope answers re-read unchanged before creation. New prepared UNUSED CI terminal helper requires actual same-run closure/read originals and retains failures honestly; no ready label/comment/final native audit request yet. Exact current-head Claudio final audit PASS plus actual green stock CI/freshmain/base checks required before merge. No kit/gate/production operation; #209 staysOPEN for deploy/postcheck,206+214greenundeployedopen,103noapply. PreservehumanDraft/cards/history/all old failed runs and consumed helpers.\n\n'
readmes=['WP/audit-release-eb6de2e8/README.md','WP/runtime-recovery-kobo/README.md']
for p in readmes:f=root/p;f.write_bytes(lead.encode()+f.read_bytes())
folders=[created,reviewDir,dest];paths=[p.relative_to(root).as_posix() for d in folders for p in d.iterdir() if p.is_file()]
paths += [(wp/n).relative_to(root).as_posix() for n in ['issue209-classified-source-only-review.index','prepare-issue209-classified-source-only-review-once.py','create-issue209-classified-source-pr-once.py','prepare-issue209-ci-terminal-successor-once.py','retain-issue209-source-pr-ci-terminal-once.py',Path(__file__).name]]
pins={p:hashlib.sha256((root/p).read_bytes()).hexdigest() for p in paths};owned=paths+readmes
git('add','-f','--',*owned);assert set(git('diff','--cached','--name-only').decode().splitlines())<=set(owned)
for p,d in pins.items():assert hashlib.sha256(git('show',':'+p)).hexdigest()==d,p
git('commit','-m','audit(209): retain PR297 and actual open CI38615738432');audit=git('rev-parse','HEAD').decode().strip();objects={}
for entry in git('ls-tree','-r','-z',audit,'--',*pins).split(b'\0'):
 if entry:meta,p=entry.split(b'\t',1);objects[p.decode()]=meta.decode().split()[2]
assert set(objects)==set(pins)
for p,d in pins.items():assert hashlib.sha256(git('cat-file','blob',objects[p])).hexdigest()==d,p
git('push','origin',audit+':refs/heads/audit/release-eb6de2e8');assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==audit
print(json.dumps({'auditCommit':audit,'number':number,'head':head,'run':identifier,'runStatus':ci['status'],'verifiedBlobs':len(pins),'productionOperations':0}))
