"""Retain the one new-head OPEN CI metadata boundary only, never active logs as closed."""
import datetime,hashlib,json,subprocess,sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf-8')
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent;dest=wp/'pr297-impact-ci-38629458186-open'
assert not dest.exists()
head='6bd516c42a07332d0b0653ed150d1526bf7e424e';base='2242bcb4861a7085bb95e78e0e7b1e4edf11d1b8';identifier=38629458186
def run(a):return subprocess.run(a,cwd=root,capture_output=True,check=True).stdout
def git(*a):return run(['git',*a])
def gh(p):return run(['gh','api',p])
assert git('branch','--show-current').strip()==b'audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip()
raw={'pr-original.json':gh('repos/yigini/soilfer-lims/pulls/297'),
 'main-original.json':gh('repos/yigini/soilfer-lims/git/ref/heads/main'),
 'run-original.json':gh(f'repos/yigini/soilfer-lims/actions/runs/{identifier}'),
 'jobs-original.json':gh(f'repos/yigini/soilfer-lims/actions/runs/{identifier}/jobs?per_page=100'),
 'head-runs-original.json':gh(f'repos/yigini/soilfer-lims/actions/runs?head_sha={head}&event=pull_request&per_page=100'),
 'source-commit-original.json':gh(f'repos/yigini/soilfer-lims/git/commits/{head}'),
 'closing-refs-original.json':run(['gh','pr','view','297','--repo','yigini/soilfer-lims','--json','closingIssuesReferences']),
 'comments-original.json':gh('repos/yigini/soilfer-lims/issues/297/comments?per_page=100')}
pr=json.loads(raw['pr-original.json']);ci=json.loads(raw['run-original.json']);runs=json.loads(raw['head-runs-original.json'])['workflow_runs']
assert pr['state']=='open' and pr['head']['sha']==head and pr['base']['sha']==base
assert pr['body']==(wp/'pr297-impact-audit-correction-source-update-completed/pr-body-successor.md').read_text(encoding='utf-8')
assert not any(l['name']=='ready-for-audit' for l in pr['labels'])
assert json.loads(raw['main-original.json'])['object']['sha']==base and json.loads(raw['closing-refs-original.json'])['closingIssuesReferences']==[]
assert ci['id']==identifier and ci['head_sha']==head and ci['run_attempt']==1 and ci['event']=='pull_request'
assert ci['status'] in ['queued','in_progress'] and ci['conclusion'] is None
assert len(runs)==1 and runs[0]['id']==identifier
source=json.loads(raw['source-commit-original.json'])
assert source['tree']['sha']=='638580d50f61254609de3abd42d93afc676a5727' and source['parents'][0]['sha']=='562cab2d24b25a500041a44abf384ffc4dbfad7c'
terminalHelper=wp/'retain-pr297-impact-ci-38629458186-terminal-once.py'
raw['prepared-terminal-helper-original.py']=terminalHelper.read_bytes()
record={'recordedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'number':297,'head':head,'tree':source['tree']['sha'],'base':base,
 'run':identifier,'attempt':1,'status':'OPEN_METADATA_ONLY','runStatus':ci['status'],'conclusion':None,'expectedSuites':370,'expectedTests':5649,
 'bodyBytes':len(pr['body'].encode()),'closingReferences':[],'readyLabelAbsent':True,'newReadyNoticeSent':False,'newFinalNativeHandoffSent':False,
 'actualNewHeadAuditPass':False,'ciDispatches':0,'productionOperations':0,
 'nativeReadonlyObservation':{'windowId':7867734,'project':'LIMS Audit','thread':'Lab workflow audit and plan',
  'latestActualReply':'Old-head audit failed on two report points; each needs a test; nothing needed from YY',
  'rightComposerEmpty':True,'centreHumanDraft':'can you go and ask Pip','inputOrMessageSentAtThisBoundary':False}}
dest.mkdir()
for n,data in raw.items():(dest/n).write_bytes(data)
(dest/'index.json').write_bytes((json.dumps(record,indent=2)+'\n').encode())
pins={p.relative_to(root).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in dest.iterdir()}
readmes=['WP/audit-release-eb6de2e8/README.md','WP/runtime-recovery-kobo/README.md']
lead=f'''## 2026-10-14 #209 corrected PR297 one new stock CI{identifier} ACTIVE

PR297 exact newhead{head}/tree{source['tree']['sha']}/base{base}, parentold562. ONE automatic pull_request CI{identifier} attempt1 ACTIVE/null conclusion; observe SAME newrun, never retry/dispatch/substitute. Current focused5/333PASS20:01:53.328013/all1327 frozen/full370 discovery/bothordinarysetups/scanners retained762472b4c8bba4394a23960faff8a940b20267fa at issue209-pr297-impact-audit-correction-focused-spelling/terminal-index.json. Exactly3 tested source paths changed for actual audit6176831479: ACCEPTED/duplicateOfNULL approved impact and total malformed-list reporting +7newcases/doc; old assertions recovered. Old stockCI38615738432/localfull370/5642/oldfailedaudit remain bound to562, never replay or infer newfullPASS. Actual sourceupdate completionfb90 retained absent-readylabel preparation refusal honestly; no Piplabel mutation. Newfull370expected5649/allrealDocker must PASS then unique newhead auditfollowup/finalnativehandoffONCE/fresh actualemptycomposer; actualCl newheadPASS+freshchecks beforemerge. OPEN API/sourcebody/closingrefs/oneactualrun/preparedterminalhelper at pr297-impact-ci-38629458186-open/index.json; no active logs captured as CLOSED. Prepared UNUSED terminal helper bound tothisnewrun/head/attempt; read actualclosed originals/helper before execution ONCE, retain failure honestly and exactsummary/inventory/realDocker/policychart209preservation. Native readonly newsource boundary shows oldfailed reply/rightEMPTY/centrehumanDraft preserved/no input/ack. No newready/auditPASS/merge/kit/gate/production/counts/103apply. All historical/source scope/readonly lists/approvednonzeroSTOP/history guards hold.

'''
for p in readmes:
 f=root/p;f.write_bytes(lead.encode()+f.read_bytes())
owned=list(pins)+readmes+[Path(__file__).relative_to(root).as_posix(),terminalHelper.relative_to(root).as_posix()]
git('add','-f','--',*owned);assert set(git('diff','--cached','--name-only').decode().splitlines())<=set(owned)
git('commit','-m','audit(209): retain corrected PR297 one new CI open boundary')
audit=git('rev-parse','HEAD').decode().strip()
for p,h in pins.items():assert hashlib.sha256(git('show',audit+':'+p)).hexdigest()==h,p
git('push','origin','HEAD:refs/heads/audit/release-eb6de2e8')
assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==audit
print(json.dumps({'auditCommit':audit,'run':identifier,'head':head,'status':record['status'],'verifiedBlobs':len(pins),'productionOperations':0}))
