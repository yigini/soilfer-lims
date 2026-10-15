"""Publish exact closed refusal and metadata-only reserve diagnosis; no operator replay."""
import json,pathlib,subprocess,sys
REPO=pathlib.Path(__file__).resolve().parents[2];SOURCE=REPO/'WP/batch-proof-cde8-20261015';DEST=SOURCE/'first-proof-023000-closed-reserve-stop';BASE='09c642426088a464fa4258ba6ac3c914e294efcb'
sys.path.insert(0,str(SOURCE))
from proof_contract import *
from prepare_proof import raw_git
def cmd(*a):return subprocess.check_output(a,cwd=REPO)
require(cmd('git','rev-parse','HEAD').decode().strip()==BASE and not cmd('git','diff','--cached','--name-only').strip(),'Writer/staging moved')
require(cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==BASE,'Remote moved')
r=exact_json((DEST/'closed-retention-record.json').read_bytes())
require(r['packageUnchanged'] and r['allRootFilesUnchanged'] and r['allHistoricalStoppedContainersPreserved'] and r['newOwnedContainers']==0 and len(r['files'])==25,'Actual preservation differs')
require(r['originalRefusal']['closedUtc']=='2026-10-15T02:37:54.846974+00:00' and r['originalRefusal']['error']=='RuntimeError: Measured/scaled reserve STOP','Exact terminal differs')
diagnostic=r['postFailureMetadataOnly'];require(diagnostic['notOriginalFailedBindInputs'] and not diagnostic['productionFileContentsOpened'],'Metadata-only role differs')
allocation=exact_json((DEST/'remote-originals/allocation-before.json').read_bytes())
require(allocation['duSingleFilesystem'] and len(allocation['verifiedOverlayViewsBefore'])==len(allocation['verifiedOverlayViewsAfter'])==16 and allocation['overlayViewsCreditedBytes']==0,'Original overlay accounting differs')
lead=('## 2026-10-15 actual023000 proof CLOSED reserve STOP — no snapshot copy or installer\n\n'
      'ONEea9/6183081827 proof ran02:36:49–02:37:54UTC, invocationf65cb69ccc5542339f09fcab778bed23, terminal02:37:54.846974UTC FAILED_OR_REFUSED_RETAIN_ALL_FORWARD_FIX_ONLY/Measured-scaled reserve STOP. Initial verified-overlay physical du-x succeeded/all16views checked before+after/0viewcredit; owned root25immutablefiles/all17packagehashes unchanged. Journal/finalsystemctlMemoryMax805306368/Swap0/Runtime90m/actualpeak84631552 preserved. Controller reached filesystem-only sourcehash/asset inspection then128xreserve.bind STOP, BEFORE fresh-production-snapshot/copy/SQLite/tablecounts/installer/defaultentrypoint/newcontainer. No snapshot/rawmaster/installedDB/scientificlists exist. Allhistoricalcontainers identity/state/starttimes/fullmountobjects preserved, no newownedcontainers; fresh selectedproduction959d7a8109 healthy/flagslimitsvolumes unchanged. Root023000/unit/helpers CONSUMED never replay/retry/cleanup. Old020000failed/qualifiedB5c03/history remain untouched.\n\n'
      'NEW02:40:31.909041UTC postfailure filesystem METADATA ONLY (stat, no production content open/SQL/copy) diagnosis: DBtriple reserveallocation567558144B, assets5787648B. Pinned formula10556150894+128*DB+3*assets+4294967296 requires87515923566B; freshfree58602573824B on all3sameFS, shortfall28913349742B. These are fresh postfailure stats, NOT invented original bind inputs or production scientific/tablecounts. Original failure/source lacks a sealed measured-copy-reserve record because guard throws first; that absence remains honest. No newdu or proofcollector replay. Capacity remedy needs review and concrete authority before newgraph/root; keep128/floor/500MB/allassetslogs/retention/memory/pins unchanged. No cleanup/prune/delete/move/restore/settingschange or gate/deployment. Actualclosedoriginals+diagnosis at first-proof-023000-closed-reserve-stop/index.json. JobsONnaturalintake/broadpostflights/exactkit/freshgate stilllater. Allscientificpolicycanonical/YYnonzerolists/approvedSTOP/separateforwardremedy/103/humanfilesdraftscards/forwardonly hold.\n\n')
readme=REPO/'WP/audit-release-eb6de2e8/README.md';readme.write_bytes(lead.encode()+readme.read_bytes())
paths=sorted(p for p in DEST.rglob('*') if p.is_file())+sorted(p for p in (SOURCE/'first-proof-023000-second-observation-once').rglob('*') if p.is_file())+[pathlib.Path(__file__),REPO/'WP/backlog-resume-20261013/read-closed-023000-reserve-evidence-remote-once.py',REPO/'WP/backlog-resume-20261013/retain-023000-closed-reserve-evidence-once.py',REPO/'WP/backlog-resume-20261013/observe-stopped-copy-023000-second-boundary-readonly-once.py',readme]
out=DEST/'index.json';require(not out.exists(),'Publication consumed')
with out.open('xb') as f:f.write(canonical({'status':r['status'],'sourceCommit':'ea9ce209d85305f863378d689b443d3134cbb4cf','sourcePass':6183081827,'actualProofFailure':True,'terminalUtc':r['originalRefusal']['closedUtc'],'invocationId':'f65cb69ccc5542339f09fcab778bed23','productionCopies':0,'productionSqliteConnections':0,'installerAttempts':0,'defaultEntrypointAttempts':0,'newOwnedContainers':0,'originalAllocationBefore':allocation,'postFailureMetadataOnly':diagnostic,'allHistoricalStoppedContainersPreserved':True,'files':[{'path':p.relative_to(REPO).as_posix(),'bytes':p.stat().st_size,'sha256':sha(p.read_bytes())} for p in paths]})+b'\n')
paths.append(out);rels=[p.relative_to(REPO).as_posix() for p in paths];require(len(rels)==len(set(rels)),'Duplicate owner')
for start in range(0,len(rels),15):cmd('git','-c','core.autocrlf=false','add','-f','--',*rels[start:start+15])
require(set(cmd('git','diff','--cached','--name-only').decode().splitlines())==set(rels),'Unowned staging')
tree=cmd('git','write-tree').decode().strip()
for p,rel in zip(paths,rels):require(raw_git(tree,rel)[0]==p.read_bytes(),'Staged raw differs')
cmd('git','commit','-m','Retain closed overlay proof reserve refusal and exact metadata-only capacity diagnosis')
head=cmd('git','rev-parse','HEAD').decode().strip()
for p,rel in zip(paths,rels):require(raw_git(head,rel)[0]==p.read_bytes(),'Committed raw differs')
cmd('git','push','origin','audit/release-eb6de2e8');require(cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head,'Remote differs')
print(json.dumps({'status':'CLOSED_RESERVE_STOP_RAW_EVIDENCE_PUSHED','head':head,'verifiedOwnedBlobs':len(paths),'requiredBytesPostFailure':diagnostic['requiredReserveBytes'],'freeBytesPostFailure':diagnostic['currentFreeBytes']['/opt/lims'],'productionCopies':0,'installerAttempts':0}))
