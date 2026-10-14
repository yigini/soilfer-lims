"""Retain literal source-line inventory and guarded UNUSED review helpers while same frozen full run remains active."""
import datetime,hashlib,json,subprocess,sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf8')
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent;dest=wp/'issue209-prepared-source-review-boundary';full=wp/'issue209-full-classified-ordinary'
assert not dest.exists() and not (full/'exit-original.txt').exists() and not (full/'summary.json').exists()
frozen=json.loads((full/'source-before.json').read_bytes())
for p,d in frozen.items():assert hashlib.sha256((root/p).read_bytes()).hexdigest()==d,p
assert not (wp/'issue209-classified-source-only-review').exists() and not (wp/'issue209-classified-source-pr-created').exists()
paths=[(wp/n).relative_to(root).as_posix() for n in ['prepare-issue209-classified-source-only-review-once.py','create-issue209-classified-source-pr-once.py','retain-issue209-full-classified-terminal-once.py']]
paths += [p.relative_to(root).as_posix() for p in (wp/'issue209-review-source-line-inventory-preparation').iterdir() if p.is_file()]
pins={p:{'bytes':(root/p).stat().st_size,'sha256':hashlib.sha256((root/p).read_bytes()).hexdigest()} for p in paths}
dest.mkdir();(dest/'index.json').write_bytes((json.dumps({'retainedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'files':pins,'sameFullSession':4994,'fullStillActive':True,'fullPassClaimed':False,'reviewRefCreated':False,'sourcePRCreated':False,'preparedHelpersUnused':True,'stockSourceChanges':0,'productionOperations':0},indent=2)+'\n').encode())
def git(*a):return subprocess.run(['git',*a],cwd=root,capture_output=True,check=True).stdout
assert git('branch','--show-current').strip()==b'audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip()
owned=list(pins)+[(dest/'index.json').relative_to(root).as_posix(),Path(__file__).relative_to(root).as_posix()];git('add','-f','--',*owned)
assert set(git('diff','--cached','--name-only').decode().splitlines())<=set(owned)
for p,pin in pins.items():assert hashlib.sha256(git('show',':'+p)).hexdigest()==pin['sha256'],p
git('commit','-m','audit(209): retain guarded unused source review preparation');head=git('rev-parse','HEAD').decode().strip();objects={}
for entry in git('ls-tree','-r','-z',head,'--',*pins).split(b'\0'):
 if entry:meta,p=entry.split(b'\t',1);objects[p.decode()]=meta.decode().split()[2]
assert set(objects)==set(pins)
for p,pin in pins.items():assert hashlib.sha256(git('cat-file','blob',objects[p])).hexdigest()==pin['sha256'],p
git('push','origin',head+':refs/heads/audit/release-eb6de2e8');assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head
print(json.dumps({'auditHead':head,'preparedReviewBlobsVerified':len(pins),'helpersUnused':True,'stockSourceChanges':0,'productionOperations':0}))
