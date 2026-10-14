"""Retain OPEN metadata and one unused terminal successor, never active logs."""
import datetime,hashlib,json,subprocess,sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf8')
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent;dest=wp/'issue209-full-ordinary-companion'
assert not (dest/'summary.json').exists() and not (dest/'open-retention-index.json').exists()
def git(*args):return subprocess.run(['git',*args],cwd=root,capture_output=True,check=True).stdout
assert git('branch','--show-current').strip()==b'audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip()
prior=git('rev-parse','HEAD').decode().strip();assert prior=='27477ea8b241de3f43dce94dd110257b199b295f'
assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==prior
meta=json.loads((dest/'open-metadata.json').read_bytes());assert meta['status']=='RUNNING_METADATA_ONLY' and meta['frozenInputCount']==1310
assert meta['sourceAudit']==prior and meta['inventory']==370 and meta['expectedTests']==5630
before=json.loads((dest/'source-before.json').read_bytes());assert len(before)==1310
for path,digest in before.items():assert hashlib.sha256((root/path).read_bytes()).hexdigest()==digest,path
metadata=['open-metadata.json','command.json','config-original.json','config-stderr-original.log','inventory-original.json',
 'inventory-stderr-original.log','source-before.json','visible-local-storage.json']
owned=[(dest/name).relative_to(root).as_posix() for name in metadata]+[Path(__file__).relative_to(root).as_posix(),
 (wp/'verify-issue209-full-ordinary-companion-once.py').relative_to(root).as_posix(),(wp/'retain-issue209-full-companion-terminal-once.py').relative_to(root).as_posix()]
pins={path:{'bytes':(root/path).stat().st_size,'sha256':hashlib.sha256((root/path).read_bytes()).hexdigest()} for path in owned}
index={'retainedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'status':'OPEN_METADATA_ONLY','sourceAudit':prior,'runnerSession':64340,
 'closedLogsRetained':False,'unusedTerminalHelper':'retain-issue209-full-companion-terminal-once.py','terminalRequiresActualClosure':True,
 'productionOperations':0,'rawFiles':pins}
(dest/'open-retention-index.json').write_bytes((json.dumps(index,indent=2)+'\n').encode())
lead='''## 2026-10-14 #209 full ordinary verification ACTIVE; OPEN metadata retained only

ONEfull ordinary successor verify-issue209-full-ordinary-companion-once.py/session64340 started11:08:15.972198UTC on1310frozeninputs/370inventory/expected5630; no closedreport/PASS exists. Bothordinarysetups/stockassertions/worker512MB/blanklocalNODE_OPTIONS; localhash-identicalvisibleassets+retention-onlyteardown holdallownedDB/WAL/SHM, stockCIhooks unchanged. Never interrupt/replay/startconcurrentrunner/editfrozeninputs. OPENmetadata at issue209-full-ordinary-companion/open-retention-index.json excludes active stdout/stderr asclosed. NEWPREPAREDUNUSED retain-issue209-full-companion-terminal-once.py requiresactualclosure, retainsfailureshonestly; readbeforeuse/neverreplay. Prior8/248PASS27477ea8 at11:07:37.707329/scopedtexture6166518424/older2462 honest77538 intact. Actualappdiffagainstmain2242 is57paths; prior55draftlists omitonlytwoalreadyretainedrequestpaths c759, no source mismatch/loss. No209PR/ready/finalaudit/merge/kit/gate/productionoperation. FullPASS then freshsource-onlyPR/stockrealCI3705630/allDocker209proof/exactheadClPASS. NativeClsaidnothingneededuntilPRaudit/batch206214209suggestion; no obsoletependingquestionhandoff. Samewriter/humancontent/103noapply/214+206sourcegreenundeployed/allhistoryguards hold.

'''
readmes=['WP/audit-release-eb6de2e8/README.md','WP/runtime-recovery-kobo/README.md']
for path in readmes:
 f=root/path;f.write_bytes(lead.encode()+f.read_bytes())
owned += [(dest/'open-retention-index.json').relative_to(root).as_posix()]+readmes
git('add','-f','--',*owned);assert set(git('diff','--cached','--name-only').decode().splitlines())<=set(owned)
for path,pin in pins.items():assert hashlib.sha256(git('show',':'+path)).hexdigest()==pin['sha256'],path
git('commit','-m','audit(209): retain open full-run metadata and unused terminal successor')
retained=git('rev-parse','HEAD').decode().strip()
for path,pin in pins.items():assert hashlib.sha256(git('show',retained+':'+path)).hexdigest()==pin['sha256'],path
git('push','origin','HEAD:refs/heads/audit/release-eb6de2e8')
assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==retained
print(json.dumps({'auditHead':retained,'verifiedMetadataBlobs':len(pins),'status':'OPEN_METADATA_ONLY','productionOperations':0}))
