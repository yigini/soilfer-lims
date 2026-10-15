"""Publish only NEW complete source and closed synthetic guards, not a package."""
import datetime,json,pathlib,subprocess,sys
REPO=pathlib.Path(__file__).resolve().parents[2];SOURCE=REPO/'WP/batch-proof-snapshot-handoff-cde8-20261015';BASE='d3640e611613accea243e762b6a3988cd4864677'
sys.path.insert(0,str(SOURCE))
from proof_contract import *
from proof_budget import TABLE,TABLE_SHA,TOTAL_DB_COPIES,DB_EQUIVALENTS,copy_site_guard,EXPECTED_SITES
from prepare_proof import raw_git
def cmd(*a):return subprocess.check_output(a,cwd=REPO)
require(cmd('git','rev-parse','HEAD').decode().strip()==BASE and not cmd('git','diff','--cached','--name-only').strip(),'Writer/staging moved')
require(cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==BASE,'Remote moved')
proof=exact_json((SOURCE/'source-local-host-verification-snapshot-handoff-complete132-once/exit-original.json').read_bytes())
require(proof['localTests']==proof['actualHostTests']==132 and proof['sourceUnchanged'] and set(proof['sourceSha256After'])==FILES,'Actual132 proof missing')
for n,h in proof['sourceSha256After'].items():require(sha((SOURCE/n).read_bytes())==h,'Source changed since132 verification')
copy_site_guard({n:(SOURCE/n).read_bytes() for n in EXPECTED_SITES})
host=proof['actualHostMetadataNameProof'];require(host['metadataOnly'] and host['containerCreates']==host['installerAttempts']==host['productionSqliteConnections']==0 and host['actualHostMetadataNameProof']['exactNameAbsent'] and host['actualHostMetadataNameProof']['completeInspectedContainers']==61,'Host metadata proof differs')
require(host['actualHostCgroupMemoryStat']['anonBytes']>=0 and host['actualHostCgroupMemoryStat']['fileBytes']>=0,'Actual verification cgroup counters missing')
meta=exact_json((SOURCE/'reference-metadata-stat-only-once/stdout-original.json').read_bytes());require(meta['databaseReserveBytes']==REFERENCE_DB_BYTES and meta['assetReserveBytes']==REFERENCE_ASSET_BYTES and meta['productionFileContentOpens']==meta['productionCopies']==meta['sqlConnections']==0,'Fresh reference differs')
required=reserve(REFERENCE_DB_BYTES,REFERENCE_ASSET_BYTES);free=min(meta['freeBytes'].values());require(required==51759760494 and free>=required,'Reference capacity insufficient')
changed=[];identical=[]
for n in sorted(FILES):
    old,_=raw_git('624aab7b9219bc7b9986396ce63915c91ad80502','WP/batch-proof-name-inventory-cde8-20261015/'+n)
    (identical if old==(SOURCE/n).read_bytes() else changed).append(n)
require(len(changed)==6 and len(identical)==5,'Source delta inventory differs')
table={'stages':TABLE,'declaredDbTriples':TOTAL_DB_COPIES,'assetCopies':3,'marginPercent':25,'minimumDbEquivalents':64,'budgetDbEquivalents':DB_EQUIVALENTS,'stageTableSha256':TABLE_SHA,'freshReferenceMetadata':meta,'requiredAtReferenceBytes':required,'referenceSlackBytes':free-required,'fitsReference':True,'snapshotBoundaryDirection':6184356993,'sourceApproval':None,'changedFrom624a':changed,'byteIdenticalTo624a':identical,'priorFailedRootMustRemain':'/opt/lims/releases/workflow-batch-stopped-copy-cde8c889-20261015T060000Z'}
def save(n,raw):
    with (SOURCE/n).open('xb') as f:f.write(raw)
save('declared-copy-budget-table.json',canonical(table)+b'\n')
doc=(SOURCE/'SOURCE_REVIEW.md').read_bytes();require(b'CLOSED132/132' in doc and b'6184356993' in doc,'Complete new review document missing')
readme=REPO/'WP/audit-release-eb6de2e8/README.md';lead='## NEW complete stable-copy handoff source132local+132host / exactreview required\n\nNew eleven-file graph WP/batch-proof-snapshot-handoff-cde8-20261015 implements actual6184356993: stablefullbefore/copy/after-equal raw+asset handoffs/UTC/no crossfileatomicity, productionposthandoffownedraw+readerbackupONLY, ownedsourceguard unchanged, laterstat-onlyliveevolutionafterfreshsnapshot+terminal notauthority, bothstatessealedbeforeliveequalitySTOP, cgroupanon/fileatEVERYbudgetcheck. CLOSED132local+132actualhost3.9.23/all11compile/hashunchanged04:34:01.517801UTC; nonemptyWAL+laterproducer write/othernegativeguards verified; all113priorguards retained. Initial129local124PASS1FAIL4ERROR retained; onlynewfixturepaths+deterministicmutation corrected, hostnotstarted;129then130bothversionsPASS graphs byteverified.6fileschanged/5byteidenticalto624a/N52/65/tablea009unchanged. Fresh04:33:02 stat-onlyT567558144/A5787648/free54618963968 required51759760494/slack2859203474 REFERENCEFIT. New070000root UNCREATED/no package/unit/proof/operator; NEWexactreview required. Fullgraph/provenance/guards at SOURCE_REVIEW.md; old060000/050000/020000023000failures/040000uncreated/B5c03build/healthyprod/history untouched.\n\n';readme.write_bytes(lead.encode()+readme.read_bytes())
helpers=['prepare-snapshot-handoff-source-successor-once.py','verify-snapshot-handoff129-local-host-once.py','verify-snapshot-handoff-short-path129-local-host-once.py','verify-snapshot-handoff-wal130-local-host-once.py','verify-snapshot-handoff-complete132-local-host-once.py','read-snapshot-handoff-reference-stat-once.py']
paths=sorted(p for p in SOURCE.rglob('*') if p.is_file())+[pathlib.Path(__file__),*[REPO/'WP/backlog-resume-20261013'/n for n in helpers],readme]
save('source-publication-index.json',canonical({'status':'NEW_COMPLETE_SNAPSHOT_HANDOFF_SOURCE_REVIEW_REQUIRED','closedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceSha256':proof['sourceSha256After'],'localTests':132,'actualHostTests':132,'actualHostMetadataNameProof':host,'root':str(ROOT),'sourceApproval':None,'newRootCreated':False,'newOperations':0,'table':table,'files':[{'path':p.relative_to(REPO).as_posix(),'bytes':p.stat().st_size,'sha256':sha(p.read_bytes())} for p in paths]})+b'\n')
paths.append(SOURCE/'source-publication-index.json');rels=[p.relative_to(REPO).as_posix() for p in paths];require(len(rels)==len(set(rels)),'Duplicate owner')
for start in range(0,len(rels),15):cmd('git','-c','core.autocrlf=false','-c','core.longpaths=true','add','-f','--',*rels[start:start+15])
require(set(cmd('git','diff','--cached','--name-only').decode().splitlines())==set(rels),'Unowned staging');tree=cmd('git','write-tree').decode().strip()
for p,rel in zip(paths,rels):require(raw_git(tree,rel)[0]==p.read_bytes(),'Staged raw differs '+rel)
cmd('git','commit','-m','Seal stable filesystem snapshot handoffs and record later live evolution separately');head=cmd('git','rev-parse','HEAD').decode().strip()
for p,rel in zip(paths,rels):require(raw_git(head,rel)[0]==p.read_bytes(),'Committed raw differs '+rel)
cmd('git','push','origin','audit/release-eb6de2e8');require(cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head,'Remote differs')
print(json.dumps({'status':'NEW_COMPLETE_SNAPSHOT_HANDOFF_SOURCE_PUSHED_REVIEW_REQUIRED','head':head,'verifiedOwnedBlobs':len(paths),'localTests':132,'actualHostTests':132,'capacityFitsReference':True,'referenceSlackBytes':free-required,'changedFiles':changed,'identicalFiles':identical,'newRootCreated':False,'newOperations':0}))
