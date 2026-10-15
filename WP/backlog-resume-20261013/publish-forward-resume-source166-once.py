"""Publish only new complete forward source and closed guards, never an operational package."""
import datetime,hashlib,json,pathlib,subprocess,sys
REPO=pathlib.Path(__file__).resolve().parents[2];SOURCE=REPO/'WP/batch-proof-forward-resume-cde8-20261015';BASE='33ede935884db4f451e840a71401d344548bb155'
sys.path.insert(0,str(SOURCE));from proof_contract import *
from proof_budget import TABLE,TABLE_SHA,TOTAL_DB_COPIES,TOTAL_ASSET_COPIES,DB_EQUIVALENTS,ASSET_RESERVE_MULTIPLIER,copy_site_guard,EXPECTED_SITES
from prepare_proof import raw_git
def cmd(*a,payload=None):return subprocess.check_output(a,cwd=REPO,input=payload)
require(cmd('git','rev-parse','HEAD').decode().strip()==BASE and not cmd('git','diff','--cached','--name-only').strip(),'Writer/staging moved')
require(cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==BASE,'Remote moved')
proof=exact_json((SOURCE/'source-local-host-verification-forward-resume-render-successor-once/exit-original.json').read_bytes())
require(proof['localTests']==proof['actualHostTests']==166 and proof['sourceUnchanged'] and set(proof['sourceSha256After'])==FILES,'Actual166 proof missing')
for n,h in proof['sourceSha256After'].items():require(sha((SOURCE/n).read_bytes())==h,'Source changed since166 verification')
copy_site_guard({n:(SOURCE/n).read_bytes() for n in EXPECTED_SITES})
host=proof['actualHostMetadataNameProof'];require(host['metadataOnly'] and host['containerCreates']==host['installerAttempts']==host['productionSqliteConnections']==0 and host['actualHostMetadataNameProof']['exactNameAbsent'] and host['actualHostMetadataNameProof']['completeInspectedContainers']==65,'Host metadata differs')
meta=exact_json((SOURCE/'reference-metadata-stat-only-once/stdout-original.json').read_bytes());require(meta['databaseReserveBytes']==563326976 and meta['assetReserveBytes']==5787648 and meta['productionFileContentOpens']==meta['productionCopies']==meta['sqlConnections']==0,'Fresh owned reference differs')
required=reserve(meta['databaseReserveBytes'],meta['assetReserveBytes']);free=min(meta['freeBytes'].values());require(required==45851464814 and free>=required,'Reference capacity insufficient')
changed=[];identical=[];added=[]
for n in sorted(FILES):
    if n=='proof_resume.py':added.append(n);continue
    old,_=raw_git('68633fdd8322243a63b0135f3899963525af7fad','WP/batch-proof-snapshot-handoff-cde8-20261015/'+n)
    (identical if old==(SOURCE/n).read_bytes() else changed).append(n)
require(len(changed)==9 and len(identical)==2 and len(added)==1,'Source delta inventory differs')
table={'stages':TABLE,'declaredDbTriples':TOTAL_DB_COPIES,'newAssetCopies':TOTAL_ASSET_COPIES,'assetReserveMultiplier':ASSET_RESERVE_MULTIPLIER,'marginPercent':25,'minimumDbEquivalents':0,'budgetDbEquivalents':DB_EQUIVALENTS,'stageTableSha256':TABLE_SHA,'freshReferenceMetadata':meta,'requiredAtReferenceBytes':required,'referenceSlackBytes':free-required,'fitsReference':True,'forwardDirection':FORWARD_DIRECTION,'priorEvidenceCommit':PRIOR_EVIDENCE,'priorEvidenceIndexSha256':PRIOR_FILES_SHA,'sourceApproval':None,'changedFrom68633':changed,'byteIdenticalTo68633':identical,'added':added,'priorFailedRootMustRemain':str(PRIOR_ROOT)}
def save(n,raw):
    with (SOURCE/n).open('xb') as f:f.write(raw)
save('declared-copy-budget-table.json',canonical(table)+b'\n')
doc=(SOURCE/'SOURCE_REVIEW.md').read_bytes();require(b'CLOSED166/166' in doc and b'6184928681' in doc,'Complete source review missing')
readme=REPO/'WP/audit-release-eb6de2e8/README.md'
lead='## NEW complete forward raw206 resume source166local+166host / exactreview required\n\nNEW twelve-file graph WP/batch-proof-forward-resume-cde8-20261015 implements actual6184928681:22rawOID/SHA pinned070000e283originals, hash-only206repeat evaluation afterclosure/sealedrecords+retainedfiles NOToldunsealedtuples, installed206RAWTRIPLE inputcopyONCE/no inputSQL/newproductioncopy/policy206replay, carryactual10639/10840/policy/206results; continue214impact209+BOTHjobsOFFstarts. Correctedmainexact/WALabsentemptyequivalenceONLY/nonemptyexact/SHMexcluded/NOOPinteger0backfill0/bothcomparedstates0400beforeSTOP. Priorlogicalfingerprints validatedfromreaderbackuphashes; downstreamdelta readsONLYNEWbackup/allrowsreceipts/schema/EMPTYtables/NULL209 preserved. CLOSED166local+166actualhost3.9.23/all12compile/hashunchanged05:24:57.621339UTC/65actualreadonlycontainernameproof. Initial165local163PASS2newWindowsmodeassertionsFAIL/hostnotstarted/all12failedbytesretained; portable166localPASS/hostscriptSyntaxErrorbeforetests fromverifierplaceholdercollision/sourceunchanged; unique166successorbothPASS. No operator/package/root/unit.\n\nAST/runtime source-derivedN44=1+7+2+10+12+12 =>55equivalents/25percent/min64DROPPEDperCl/3assetsreserve(2future+1padding)/floor10556150894/logs4GiB/physicaldu-xstagecaps/allretention. Fresh05:26:53 metadataONLYOWNEDraw206T563326976/A5787648/free49517506560 required45851464814/slack3666041746 REFERENCEFIT; launcherfreshcapacitybeforeROOT+beforeunit/controllerbindmandatory. Proposed080000notcreatedbythiswork/no operationalpackage/unit/sourcePASS; NEWexactall12hashreview required. Fullgraph/provenance SOURCE_REVIEW.md; everyfailedroot/container/rawtriple/B5c03B1/NORMALhealthy959d7a8109 remains. Actual214209science/11242/startupsUNKNOWN. AllYYsciencepolicy/nonzeroYYapprovedSTOP/separateforwardremedy/retentionmemoryreadiness/forwardonly103humanhistoryguards hold. JobsONnaturalintake+broadpostflights/exactkitfreshgate later/notreleasequalified.\n\n'
readme.write_bytes(lead.encode()+readme.read_bytes())
helpers=['prepare-forward-resume-source-successor-once.py','verify-forward-resume-source-local-host-once.py','verify-forward-resume-source-portable-local-host-once.py','verify-forward-resume-source-render-successor-local-host-once.py','read-forward-resume-reference-stat-once.py']
paths=sorted(p for p in SOURCE.rglob('*') if p.is_file())+[pathlib.Path(__file__),*[REPO/'WP/backlog-resume-20261013'/n for n in helpers],readme]
save('source-publication-index.json',canonical({'status':'NEW_COMPLETE_FORWARD_RESUME_SOURCE_REVIEW_REQUIRED','closedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceSha256':proof['sourceSha256After'],'localTests':166,'actualHostTests':166,'actualHostMetadataNameProof':host,'root':str(ROOT),'sourceApproval':None,'newRootCreated':False,'newOperations':0,'table':table,'files':[{'path':p.relative_to(REPO).as_posix(),'bytes':p.stat().st_size,'sha256':sha(p.read_bytes())} for p in paths]})+b'\n')
paths.append(SOURCE/'source-publication-index.json');rels=[p.relative_to(REPO).as_posix() for p in paths];require(len(rels)==len(set(rels)),'Duplicate owner')
for start in range(0,len(rels),15):cmd('git','-c','core.autocrlf=false','-c','core.longpaths=true','add','-f','--',*rels[start:start+15])
require(set(cmd('git','diff','--cached','--name-only').decode().splitlines())==set(rels),'Unowned staging')
def verify(head):
    prefixes=[SOURCE.relative_to(REPO).as_posix(),pathlib.Path(__file__).relative_to(REPO).as_posix(),*[str((REPO/'WP/backlog-resume-20261013'/n).relative_to(REPO).as_posix()) for n in helpers],readme.relative_to(REPO).as_posix()]
    raw=cmd('git','ls-tree','-r','-z',head,'--',*prefixes);entries={}
    for row in raw.split(b'\0'):
        if not row:continue
        meta,path=row.split(b'\t',1);mode,kind,oid=meta.decode().split();require(kind=='blob' and mode in ['100644','100755'],'Regular raw Git blob required');entries[path.decode()]=oid
    require(set(entries)==set(rels),'Raw Git inventory differs')
    oids=[entries[n] for n in rels];data=cmd('git','cat-file','--batch',payload=('\n'.join(oids)+'\n').encode());at=0
    for p,oid in zip(paths,oids):
        end=data.index(b'\n',at);actual,kind,length=data[at:end].decode().split();size=int(length);value=data[end+1:end+1+size];require(data[end+1+size:end+2+size]==b'\n','Raw batch framing differs');at=end+2+size
        require(actual==oid and kind=='blob' and len(value)==size and hashlib.sha1(('blob '+str(size)+'\0').encode()+value).hexdigest()==oid and value==p.read_bytes(),'Independent raw Git OID/bytes differ')
    require(at==len(data),'Trailing raw Git output')
verify(cmd('git','write-tree').decode().strip());cmd('git','commit','-m','Implement bound raw206 forward proof and corrected absent-empty WAL identity rule');head=cmd('git','rev-parse','HEAD').decode().strip();verify(head)
cmd('git','push','origin','audit/release-eb6de2e8');require(cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head,'Remote differs')
print(json.dumps({'status':'NEW_COMPLETE_FORWARD_RESUME_SOURCE_PUSHED_REVIEW_REQUIRED','head':head,'verifiedOwnedBlobs':len(paths),'localTests':166,'actualHostTests':166,'referenceSlackBytes':free-required,'changedFiles':changed,'identicalFiles':identical,'added':added,'newRootCreated':False,'newOperations':0}))
