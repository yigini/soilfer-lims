"""Complete an unpublished owned preparation once after independently confirmed absent ready label."""
import datetime,hashlib,json,os,subprocess,sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf-8')
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent
prepared=wp/'pr297-impact-audit-correction-source-update';dest=wp/'pr297-impact-audit-correction-source-update-completed'
focused=wp/'issue209-pr297-impact-audit-correction-focused-spelling'
index=wp/'pr297-impact-audit-correction-source-update.index'
assert not dest.exists() and index.exists() and not (prepared/'source-update-record.json').exists()
record=json.loads((prepared/'source-head-prepared.json').read_bytes())
old=record['oldHead'];head=record['head'];tree=record['tree'];base=record['base'];audit=record['auditSource']
assert old=='562cab2d24b25a500041a44abf384ffc4dbfad7c' and head=='6bd516c42a07332d0b0653ed150d1526bf7e424e'
assert base=='2242bcb4861a7085bb95e78e0e7b1e4edf11d1b8' and tree=='638580d50f61254609de3abd42d93afc676a5727'
ref='refs/heads/codex/issue-209-order-revisions'
def run(argv):return subprocess.run(argv,cwd=root,capture_output=True,check=True).stdout
def git(*args):return run(['git',*args])
def gh(path):return run(['gh','api',path])
assert git('branch','--show-current').strip()==b'audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip()
assert git('rev-parse','HEAD').decode().strip()==audit
assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==audit
assert git('rev-parse',ref).decode().strip()==old and git('ls-remote','origin',ref).decode().split()[0]==old
assert git('rev-parse',head+'^').decode().strip()==old and git('rev-parse',head+'^{tree}').decode().strip()==tree
assert sorted(git('diff','--name-only',old,head).decode().splitlines())==record['changedPaths']
assert not git('diff','--name-only',old,head,'--','WP','.gitattributes')
terminal=json.loads((focused/'terminal-index.json').read_bytes());summary=terminal['summary']
assert summary['status']=='PASS' and summary['tests']==summary['passedTests']==333 and summary['suites']==5 and terminal['oldIntegrationBytesRecovered']
frozen=json.loads((focused/'source-before.json').read_bytes());assert frozen==json.loads((focused/'source-after.json').read_bytes())
for p,h in frozen.items():assert hashlib.sha256((root/p).read_bytes()).hexdigest()==h,p
for p in terminal['sourceDraftPaths']:
 if p!='.gitattributes':assert git('show',head+':'+p)==(root/p).read_bytes().replace(b'\r\n',b'\n'),p
before={'pr-before-original.json':gh('repos/yigini/soilfer-lims/pulls/297'),
 'main-before-original.json':gh('repos/yigini/soilfer-lims/git/ref/heads/main'),
 'closing-refs-before-original.json':run(['gh','pr','view','297','--repo','yigini/soilfer-lims','--json','closingIssuesReferences'])}
pr=json.loads(before['pr-before-original.json'])
assert pr['state']=='open' and pr['head']['sha']==old and pr['base']['sha']==base
assert pr['body']==json.loads((prepared/'pr-before-original.json').read_bytes())['body']
assert not any(l['name']=='ready-for-audit' for l in pr['labels'])
assert not any(l['name']=='ready-for-audit' for l in json.loads((prepared/'pr-before-original.json').read_bytes())['labels'])
assert json.loads(before['main-before-original.json'])['object']['sha']==base
assert json.loads(before['closing-refs-before-original.json'])['closingIssuesReferences']==[]
body=(prepared/'pr-body-successor.md').read_text(encoding='utf-8')
assert head in body and 'expected5649' in body
record['preparationRefusedBeforeRemoteMutation']='Absent predecessor ready label; original updater/read-only preparation preserved, no remote outcome replay'
dest.mkdir()
for n,data in before.items():(dest/n).write_bytes(data)
(dest/'pr-body-successor.md').write_bytes(body.encode())
git('update-ref',ref,head,old)
git('push','origin',head+':'+ref)
assert git('ls-remote','origin',ref).decode().split()[0]==head
request=dest/'pr-update-request.json';request.write_bytes((json.dumps({'body':body},indent=2)+'\n').encode())
response=run(['gh','api','repos/yigini/soilfer-lims/pulls/297','--method','PATCH','--input',str(request)])
(dest/'pr-update-response-original.json').write_bytes(response)
fresh=json.loads(response);assert fresh['head']['sha']==head and fresh['base']['sha']==base and fresh['body']==body and fresh['state']=='open'
assert not any(l['name']=='ready-for-audit' for l in fresh['labels'])
record.update({'completedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'sourceRefAdvancedOnce':True,'prBodyUpdatedOnce':True,'oldReadyLabelWasAlreadyAbsent':True,'labelRemovals':0,'newReadyNoticeSent':False,'newNativeHandoffSent':False})
(dest/'source-update-record.json').write_bytes((json.dumps(record,indent=2)+'\n').encode())
pins={p.relative_to(root).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in dest.iterdir() if p.is_file()}
pins[index.relative_to(root).as_posix()]=hashlib.sha256(index.read_bytes()).hexdigest()
for p in prepared.iterdir():
 if p.is_file():pins[p.relative_to(root).as_posix()]=hashlib.sha256(p.read_bytes()).hexdigest()
p=wp/'update-pr297-impact-audit-correction-source-once.py';pins[p.relative_to(root).as_posix()]=hashlib.sha256(p.read_bytes()).hexdigest()
(dest/'index.json').write_bytes((json.dumps(pins,indent=2)+'\n').encode())
readmes=['WP/audit-release-eb6de2e8/README.md','WP/runtime-recovery-kobo/README.md']
lead=f'''## 2026-10-14 #209 PR297 advanced ONCE after scoped audit correction focused PASS

Same PR297 exact newhead{head}/tree{tree}/base{base}; parent old562 whose actual audit FAILED6176831479/oldCI3705642green immutable. ONLY3-path report/7newtests/doc delta, current focused5/333PASS/all1327unchanged/bothscanners/full370discovery, everyoldintegrationbyte recovered. Correct closed PASS evidence path is issue209-pr297-impact-audit-correction-focused-spelling/terminal-index.json at audit{audit}; the predecessor focused-owned index remains honestly FAILED332/333 despite the copied README path typo. The first source updater refused an absent predecessor readylabel before any remote mutation; its local head/tree/body/index preparation is preserved. A unique completion revalidated all current state and reused that unpublished prepared head. Original PR bodies/current87fixture diff/source-ref/tempindex/actual responses at pr297-impact-audit-correction-source-update-completed/index.json. Old readylabel already absent; no Pip label mutation; new actual automatic stock CI must be observed, no newready/audit/native request until actual complete green370/expected5649/allrealDocker. No current full localPASS claimed, no newhead finalPASS/merge/kit/gate/production. Native priorfinal handoff completeonce/humanDraft preserved; all old650failures/scope/approvednonzeroSTOP/readonly lists/103noapply/history guards hold.

'''
for p in readmes:
 f=root/p;f.write_bytes(lead.encode()+f.read_bytes())
owned=list(pins)+[(dest/'index.json').relative_to(root).as_posix(),Path(__file__).relative_to(root).as_posix()]+readmes
git('add','-f','--',*owned);assert set(git('diff','--cached','--name-only').decode().splitlines())<=set(owned)
git('commit','-m','audit(209): advance same PR297 with scoped impact report corrections')
retained=git('rev-parse','HEAD').decode().strip()
for p,h in pins.items():assert hashlib.sha256(git('show',retained+':'+p)).hexdigest()==h,p
git('push','origin','HEAD:refs/heads/audit/release-eb6de2e8')
assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==retained
print(json.dumps({'auditCommit':retained,'oldHead':old,'head':head,'tree':tree,'base':base,'number':297,'verifiedBlobs':len(pins),'expectedFullTests':5649,'productionOperations':0}))
