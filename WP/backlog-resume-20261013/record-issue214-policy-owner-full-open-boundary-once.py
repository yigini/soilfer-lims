"""Retain OPEN metadata only for the same active full runner; no active test logs."""
import datetime,hashlib,json,shutil,subprocess
from pathlib import Path
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent
run=wp/'issue214-policy-owner-full';dest=wp/'issue214-policy-owner-full-open'
assert not dest.exists() and not (run/'summary.json').exists()
def git(*args):return subprocess.run(['git',*args],cwd=root,capture_output=True,check=True).stdout
assert git('branch','--show-current').strip()==b'audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip()
frozen=json.loads((run/'source-before.json').read_bytes())
assert len(frozen)==421 and all(hashlib.sha256((root/p).read_bytes()).hexdigest()==h for p,h in frozen.items())
inventory=json.loads((run/'inventory-original.json').read_bytes());assert len(inventory)==len(set(inventory))==366
dest.mkdir()
for name in ['source-before.json','inventory-original.json','command.json','config-original.json']:
    shutil.copyfile(run/name,dest/name)
record={'observedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'sessionId':98407,'status':'RUNNING','finalResult':None,
 'frozenPathCount':421,'fullDiscovery':366,'expectedTests':5565,'sourcePRHead':'e47b842c2a7f6b4f06fa4c532f7460c01797821b',
 'base':'6d750914d8565acdd496767a7dd935811b5a89b2','closedFocused':'8/218 PASS','scopeComment':6160619940,
 'localRetentionTeardownOnly':True,'productionOperations':0}
(dest/'open-metadata.json').write_bytes((json.dumps(record,indent=2)+'\n').encode())
index={p.relative_to(root).as_posix():{'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'bytes':p.stat().st_size} for p in dest.iterdir() if p.is_file()}
(dest/'index.json').write_bytes((json.dumps(index,indent=2)+'\n').encode())
readmes=['WP/audit-release-eb6de2e8/README.md','WP/runtime-recovery-kobo/README.md']
lead='''## 2026-10-14 #214 accepted policy owner; one full successor RUNNING

ONE full runner `verify-issue214-policy-owner-full-once.py` / session98407 is RUNNING on421 frozen source/fixture inputs, exact366 discovery, expected5565 tests. NO final result exists. The focused snapshot-preservation predecessor passed8/218; both earlier failures remain retained honestly. OPEN metadata only is at `WP/backlog-resume-20261013/issue214-policy-owner-full-open/open-metadata.json`; no active logs are captured as CLOSED. Never edit frozen source, interrupt/replay or start a concurrent runner. Both ordinary setups/assertions/worker512MB/blanklocal NODE_OPTIONS remain; local visible-storage and retention-only teardown fixtures preserve held files, stockCI hooks unchanged. The UNUSED full-terminal retainer and guarded same-PR fast-forward updater are prepared; read their guards and execute only at the actual closed boundary. Original PR296/e47b/main6d and original failedCI38467368095 are unchanged; never retry that CI. Accepted actualCl6160619940/no normalization governs. Actual full local proof → corrected samePR push/newautomatic realCI → complete greenDocker+server proof → NEW exact-head audit request, then start209 per direct YY instruction. No ready notice/PASS/merge/kit/gate/production/#103 operation. Native human draftn and all prior completed release evidence remain untouched.

'''
for p in readmes:
    f=root/p;f.write_bytes(lead.encode()+f.read_bytes())
helpers=[Path(__file__).relative_to(root).as_posix(),'WP/backlog-resume-20261013/retain-issue214-policy-owner-full-terminal-once.py','WP/backlog-resume-20261013/update-pr296-policy-owner-after-full-pass-once.py']
paths=readmes+helpers+list(index)+[(dest/'index.json').relative_to(root).as_posix()]
git('add','-f','--',*paths);assert set(git('diff','--cached','--name-only').decode().splitlines())<=set(paths)
for p,r in index.items():assert hashlib.sha256(git('show',':'+p)).hexdigest()==r['sha256'],p
git('commit','-m','audit(214): record open full policy-owner successor and guarded next steps')
head=git('rev-parse','HEAD').decode().strip()
for p,r in index.items():assert hashlib.sha256(git('show',head+':'+p)).hexdigest()==r['sha256'],p
git('push','origin','audit/release-eb6de2e8')
assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head
print(json.dumps({'auditHead':head,**record}))
