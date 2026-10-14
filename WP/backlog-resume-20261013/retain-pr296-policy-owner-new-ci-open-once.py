"""Retain ONE automatic CI on the genuinely corrected PR296 head; no dispatch/retry."""
import datetime,hashlib,json,subprocess,sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf-8')
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent
source=wp/'issue214-policy-owner-source-pr-update'
record=json.loads((source/'source-head.json').read_bytes());head=record['head'];base=record['base']
dest=wp/'issue214-policy-owner-new-ci-open'
assert not dest.exists(),'Already retained: never replay.'
def command(args):return subprocess.run(args,cwd=root,capture_output=True,check=True).stdout
def git(*args):return command(['git',*args])
def gh(path):return command(['gh','api',path])
assert git('branch','--show-current').strip()==b'audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip()
raw={'pr-original.json':gh('repos/yigini/soilfer-lims/pulls/296'),
     'main-original.json':gh('repos/yigini/soilfer-lims/git/ref/heads/main'),
     'runs-original.json':gh(f'repos/yigini/soilfer-lims/actions/workflows/ci.yml/runs?head_sha={head}&event=pull_request&per_page=100'),
     'closing-refs-original.json':command(['gh','pr','view','296','--repo','yigini/soilfer-lims','--json','closingIssuesReferences'])}
pr=json.loads(raw['pr-original.json']);runs=json.loads(raw['runs-original.json'])['workflow_runs']
assert pr['state']=='open' and pr['head']['sha']==head and pr['base']['sha']==base
assert pr['body']==(source/'pr-body-successor.md').read_text(encoding='utf8')
assert json.loads(raw['main-original.json'])['object']['sha']==base
assert json.loads(raw['closing-refs-original.json'])['closingIssuesReferences']==[]
assert len(runs)==1 and runs[0]['head_sha']==head and runs[0]['event']=='pull_request' and runs[0]['run_attempt']==1
ci=runs[0];identifier=ci['id'];assert identifier!=38467368095
assert any(p['number']==296 for p in ci['pull_requests'])
raw['run-original.json']=gh(f'repos/yigini/soilfer-lims/actions/runs/{identifier}')
raw['jobs-original.json']=gh(f'repos/yigini/soilfer-lims/actions/runs/{identifier}/jobs?per_page=100')
assert json.loads(raw['run-original.json'])['head_sha']==head
assert git('ls-remote','origin','refs/heads/codex/issue-214-control-charts').decode().split()[0]==head
assert git('rev-parse',head+'^{tree}').decode().strip()==record['tree']
dest.mkdir()
for name,data in raw.items():(dest/name).write_bytes(data)
index={'observedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'status':'API_METADATA_ONLY_NO_TERMINAL_LOGS',
 'number':296,'head':head,'tree':record['tree'],'base':base,'run':identifier,'attempt':1,'runUrl':ci['html_url'],
 'actualStatus':ci['status'],'actualConclusion':ci['conclusion'],'ciDispatches':0,'productionOperations':0,
 'files':{name:{'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()} for name,data in raw.items()}}
(dest/'index.json').write_bytes((json.dumps(index,indent=2)+'\n').encode())
lead=f'''## 2026-10-14 #214 accepted owner pushed; automatic new CI{identifier} observed

PR296 is now exact corrected head{head}/tree{record['tree']}/base{base}; canonical policy owner accepted inside this PR by actual6160619940. Full local366/5565 and focused8/218 PASS retained; stock realCI is independently required. ONE new automatic PR CI{identifier} attempt1 status{ci['status']}/{ci['conclusion']}; this record contains API metadata only, no active logs as CLOSED. Original CI38467368095 remains FAILED and never replays. Owner refuses partial/tampered storage0 without normalization, leaves stored values unchanged, and classifies readonly using retained snapshots preserving original DB/WAL/SHM. Read-only production kit must PRESENT/NO_OP0 with disk allocation accounted, otherwiseSTOP/noapply. No ready notice, final exact-head audit request/PASS, merge, release/kit/gate/production operation; request only after actual closedgreennewCI, then start209. Human draftn/#103noapply and historical guards preserved.

'''
readmes=['WP/audit-release-eb6de2e8/README.md','WP/runtime-recovery-kobo/README.md']
for p in readmes:
 f=root/p;f.write_bytes(lead.encode()+f.read_bytes())
owned=[p.relative_to(root).as_posix() for p in dest.iterdir()]+[p.relative_to(root).as_posix() for p in source.iterdir() if p.is_file()]
owned+=readmes+[Path(__file__).relative_to(root).as_posix(),'WP/backlog-resume-20261013/retain-pr296-policy-owner-new-ci-terminal-once.py']
pins={p:hashlib.sha256((root/p).read_bytes()).hexdigest() for p in owned if p not in readmes}
git('add','-f','--',*owned)
assert set(git('diff','--cached','--name-only').decode().splitlines())<=set(owned)
for p,digest in pins.items():assert hashlib.sha256(git('show',':'+p)).hexdigest()==digest,p
git('commit','-m',f'audit(214): bind corrected PR296 to automatic CI{identifier}')
audit=git('rev-parse','HEAD').decode().strip()
for p,digest in pins.items():assert hashlib.sha256(git('show',audit+':'+p)).hexdigest()==digest,p
git('push','origin','HEAD:refs/heads/audit/release-eb6de2e8')
assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==audit
print(json.dumps({'auditHead':audit,'run':identifier,'head':head,'status':ci['status'],'conclusion':ci['conclusion'],'verifiedBlobs':len(pins)}))
