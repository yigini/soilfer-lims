"""Retain only actual OPEN full-run inputs and prepared terminal helper; never active logs as closed."""
import datetime,hashlib,json,subprocess,sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf8')
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent;dest=wp/'issue209-full-classified-ordinary'
assert not (dest/'open-retention-index.json').exists() and not (dest/'exit-original.txt').exists() and not (dest/'summary.json').exists()
meta=json.loads((dest/'open-metadata.json').read_bytes());assert meta['status']=='RUNNING_METADATA_ONLY' and meta['inventory']==370 and meta['expectedTests']==5642
before=json.loads((dest/'source-before.json').read_bytes())
for p,d in before.items():assert hashlib.sha256((root/p).read_bytes()).hexdigest()==d,p
names=['source-before.json','inventory-original.json','inventory-stderr-original.log','derived-help-manifest-before-original.json','derived-output-policy-open.json','visible-local-storage.json','config-original.json','config-stderr-original.log','command.json','open-metadata.json']
raw={ (dest/n).relative_to(root).as_posix():{'bytes':(dest/n).stat().st_size,'sha256':hashlib.sha256((dest/n).read_bytes()).hexdigest()} for n in names}
(dest/'open-retention-index.json').write_bytes((json.dumps({'retainedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'metadata':meta,'rawOpenFiles':raw,'activeLogsRetainedAsClosed':False,'terminalHelperPreparedUnused':'retain-issue209-full-classified-terminal-once.py','productionOperations':0},indent=2)+'\n').encode())
def git(*a):return subprocess.run(['git',*a],cwd=root,capture_output=True,check=True).stdout
assert git('branch','--show-current').strip()==b'audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip()
lead='## 2026-10-14 #209 full classified ordinary successor ACTIVE\n\n'+json.dumps(meta)+'. Same once-dispatched verify-issue209-full-classified-ordinary-once.py/session4994 continues on1327 frozen inputs/370 inventory/5642 expected. No source edits/concurrent runner/interrupt/replay; observe SAME runner. Exact OPEN inputs/config/discovery/command and original derivedhelpmanifest BEFORE bytes/hash at issue209-full-classified-ordinary/open-retention-index.json; no active stdout/stderr/report retained as closed. NEW prepared UNUSED retain-issue209-full-classified-terminal-once.py requires actual closure and retains failure honestly; read after actual closed originals before use. Independent650/650 original assertion occurrences reconciled2e99/59 verified reports; NOT fullPASS. No209PR/ready/finalaudit/merge/kit/gate/production operation. Native512checkpoint/Clnothingneeded reply30049 once complete/humanDraft/cards/no duplicates/four settled scopeanswers/ONE keyedreceipt0to1/legacyruntimeorphans0writes/readonly causes+YYlists/approvednonzeroSTOP/noamendmentorderstep/backfill/relink/103noapply/206+214greenundeployedopen/history guards hold.\n\n'
readmes=['WP/audit-release-eb6de2e8/README.md','WP/runtime-recovery-kobo/README.md']
for p in readmes:f=root/p;f.write_bytes(lead.encode()+f.read_bytes())
owned=list(raw)+[(dest/'open-retention-index.json').relative_to(root).as_posix(),Path(__file__).relative_to(root).as_posix(),(wp/'verify-issue209-full-classified-ordinary-once.py').relative_to(root).as_posix(),(wp/'retain-issue209-full-classified-terminal-once.py').relative_to(root).as_posix()]+readmes
git('add','-f','--',*owned);assert set(git('diff','--cached','--name-only').decode().splitlines())<=set(owned)
for p,pin in raw.items():assert hashlib.sha256(git('show',':'+p)).hexdigest()==pin['sha256'],p
git('commit','-m','audit(209): retain OPEN classified full run inputs');head=git('rev-parse','HEAD').decode().strip()
objects={}
for entry in git('ls-tree','-r','-z',head,'--',*raw).split(b'\0'):
 if entry:meta,p=entry.split(b'\t',1);objects[p.decode()]=meta.decode().split()[2]
assert set(objects)==set(raw)
for p,pin in raw.items():assert hashlib.sha256(git('cat-file','blob',objects[p])).hexdigest()==pin['sha256'],p
git('push','origin',head+':refs/heads/audit/release-eb6de2e8');assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head
print(json.dumps({'auditHead':head,'rawOpenGitBlobsVerified':len(raw),'terminalHelperUnused':True,'productionOperations':0}))
