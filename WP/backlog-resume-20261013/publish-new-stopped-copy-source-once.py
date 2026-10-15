"""Retain synthetic originals, publish only owned closed source/evidence; no proof operation."""
import base64,datetime,hashlib,json,pathlib,subprocess,sys
REPO=pathlib.Path(__file__).resolve().parents[2];SOURCE=REPO/'WP/batch-proof-cde8-20261015';BASE='a2a0b0d4e7d99c51333ab828fbadbb5e43ca4587'
sys.path.insert(0,str(SOURCE))
from proof_contract import *
from prepare_proof import raw_git
def cmd(*a):return subprocess.check_output(a,cwd=REPO)
require(cmd('git','rev-parse','HEAD').decode().strip()==BASE and not cmd('git','diff','--cached','--name-only').strip(),'Same writer and empty staging required')
require(cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==BASE,'Remote audit moved')
proof=exact_json((SOURCE/'source-local-host-verification-canonical-once/exit-original.json').read_bytes())
require(proof['localTests']==proof['actualHostTests']==40 and proof['sourceUnchanged'] and proof['productionFileCopies']==proof['productionConnections']==proof['proofOperatorsExecuted']==0,'Current closed source proof required')
for n,h in proof['sourceSha256After'].items():require(sha((SOURCE/n).read_bytes())==h,'Source changed since40-test proof')
retained=SOURCE/'synthetic-host-originals-retained-once';require(not retained.exists(),'Synthetic retainer consumed');retained.mkdir()
script='''import base64,hashlib,json,os,pathlib,stat
roots=['/tmp/lims-owned-stopped-copy-source-guards-20261015T013000Z','/tmp/lims-owned-stopped-copy-source-guards-20261015T013500Z']
rows=[];total=0
for number,root in enumerate(roots):
 p=pathlib.Path(root);assert p.is_dir() and not p.is_symlink()
 for directory,children,files in os.walk(p,followlinks=False):
  children.sort();files.sort();d=pathlib.Path(directory);assert not d.is_symlink()
  for child in children:assert not (d/child).is_symlink()
  for name in files:
   f=d/name;a=f.stat();assert f.is_file() and not f.is_symlink() and a.st_size<=1048576
   raw=f.read_bytes();b=f.stat();assert (a.st_size,a.st_mtime_ns,a.st_ino,a.st_mode)==(b.st_size,b.st_mtime_ns,b.st_ino,b.st_mode)
   total+=len(raw);assert total<=8388608 and len(rows)<256
   rows.append({'path':str(number)+'/'+f.relative_to(p).as_posix(),'source':str(f),'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'mode':stat.S_IMODE(b.st_mode),'data':base64.b64encode(raw).decode()})
print(json.dumps({'status':'SYNTHETIC_GUARD_FIXTURE_RAW_FILES_ONLY','roots':roots,'files':rows,'productionConnections':0,'productionOperations':0,'noCleanup':True}))
'''
(retained/'retainer-source.py').write_text(script,encoding='utf-8');r=subprocess.run(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=15','root@46.19.33.37','python3','-B','-'],cwd=REPO,input=script.encode(),capture_output=True,timeout=45)
(retained/'stdout-original.json').write_bytes(r.stdout);(retained/'stderr-original.log').write_bytes(r.stderr);require(r.returncode==0,'Retain original synthetic retainer failure; never replay')
record=exact_json(r.stdout)
for row in record['files']:
    rel=pathlib.PurePosixPath(row['path']);require(not rel.is_absolute() and '..' not in rel.parts,'Unsafe retained relative path');raw=base64.b64decode(row['data']);require(len(raw)==row['bytes'] and sha(raw)==row['sha256'],'Synthetic raw hash mismatch');p=retained/'files'/str(rel);p.parent.mkdir(parents=True,exist_ok=True)
    with p.open('xb') as f:f.write(raw)
    row.pop('data')
(retained/'index.json').write_bytes(canonical(record)+b'\n')
readme=REPO/'WP/audit-release-eb6de2e8/README.md'
lead='''## 2026-10-15 NEW complete snapshot/stopped-copy jobs-OFF source40local+40host PASS — exact review REQUIRED

Ten-file NEW graph WP/batch-proof-cde8-20261015/SOURCE_REVIEW.md implements stable production raw-file snapshot inputs (no liveSQLite), immutable raw masters/WAL-aware owned seals, qualifiedb5/c03 vs NORMALhealthy959d/7a/8109 separately, canonicalpolicyPRESENTNOOP0orSTOP,206214209dry/apply/repeat independentpreservation, actual214209lists+invalidStoredAnalysisSampleCount/sample-owner/primary+secondarysnapshotallocation/approvednonzeroSTOP, two independent jobs-OFF default starts27NOOP0/26READY0 expectations/readiness600/mem805/stoppedstateequal. ALLcontainersretained/nohistoricalstartcleanup. Fullphysicalretainedreleases+Docker+ctrd/accounting/floor10556150894/128DB+3asset+4GiBlogreserve/500MBabort/headroom/unit5400/bothpins.40local+40actualhost3.9 PASS/all10compile/hashunchanged CLOSED01:17:10.875UTC/syntheticfixturesONLY;37priorgraph retainedimmutable beforeexplicitcanonicalshape guard. NO productionfilecopy/SQLitecount/installer/entrypoint/proof/root/package/kit/gate/deploy/103. ExactNEWactualSourcePASSrequired; thisscope also leaves jobs-ONqualification/broaderpostflights/finalexactkit/freshgate required, not releasequalification. Source_reviewrequest not yet sent atpublication. Allrawfixtures/guards retained, allhistory/humandrafts/cards/dirt preserved.

'''
readme.write_bytes(lead.encode()+readme.read_bytes())
paths=[SOURCE/n for n in sorted(FILES)]+[SOURCE/'SOURCE_REVIEW.md',readme,pathlib.Path(__file__),REPO/'WP/backlog-resume-20261013/verify-new-stopped-copy-source-local-host-once.py',REPO/'WP/backlog-resume-20261013/verify-new-stopped-copy-canonical-source-local-host-once.py']
for directory in ['source-local-host-verification-once','source-local-host-verification-canonical-once','synthetic-host-originals-retained-once']:
    paths.extend(sorted(p for p in (SOURCE/directory).rglob('*') if p.is_file()))
index=SOURCE/'closed-source-publication-index.json';require(not index.exists(),'Publication consumed')
index.write_bytes(canonical({'status':'NEW_COMPLETE_SCOPED_STOPPED_COPY_GRAPH_REVIEW_READY_NOT_APPROVED','createdUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'scope':SCOPE,'sourceSha256':proof['sourceSha256After'],'localTests':40,'actualHostTests':40,'root':str(ROOT),'actualSourceReview':None,'productionSnapshotsCollected':False,'proofsRun':0,'jobsOnQualificationStillRequired':True,'files':[{'path':p.relative_to(REPO).as_posix(),'bytes':p.stat().st_size,'sha256':sha(p.read_bytes())} for p in paths]})+b'\n');paths.append(index)
rels=[p.relative_to(REPO).as_posix() for p in paths];require(len(rels)==len(set(rels)),'Duplicate owner')
for start in range(0,len(rels),15):cmd('git','-c','core.autocrlf=false','add','-f','--',*rels[start:start+15])
require(set(cmd('git','diff','--cached','--name-only').decode().splitlines())==set(rels),'Staged owned scope changed')
tree=cmd('git','write-tree').decode().strip()
for p,rel in zip(paths,rels):require(raw_git(tree,rel)[0]==p.read_bytes(),'Staged raw bytes differ '+rel)
cmd('git','commit','-m','Implement new source-bound raw snapshot and stopped-copy batch installation/startup proof')
head=cmd('git','rev-parse','HEAD').decode().strip()
for p,rel in zip(paths,rels):require(raw_git(head,rel)[0]==p.read_bytes(),'Committed raw bytes differ '+rel)
cmd('git','push','origin','audit/release-eb6de2e8');require(cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head,'Pushed audit differs')
print(json.dumps({'status':'NEW_COMPLETE_SCOPED_SOURCE_PUSHED_REVIEW_REQUIRED','head':head,'verifiedOwnedBlobs':len(paths),'localTests':40,'hostTests':40,'productionCopies':0,'proofOperatorsExecuted':0,'actualSourceReview':None,'jobsOnQualificationStillRequired':True}))
