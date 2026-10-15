"""Retain actual exact source approval and current boundaries before any copy/proof."""
import datetime,json,pathlib,subprocess,sys
REPO=pathlib.Path(__file__).resolve().parents[2];SOURCE=REPO/'WP/batch-proof-cde8-20261015';DEST=SOURCE/'actual-source-pass-6183081827';BASE='e4e05ddfe5b6f6c8a578e913fdf627838340680b';TOOLING='ea9ce209d85305f863378d689b443d3134cbb4cf'
sys.path.insert(0,str(SOURCE))
from proof_contract import *
from prepare_proof import current_evidence,raw_git
def cmd(*a):return subprocess.check_output(a,cwd=REPO)
require(not DEST.exists() and cmd('git','rev-parse','HEAD').decode().strip()==BASE and not cmd('git','diff','--cached','--name-only').strip(),'Consumed boundary or writer changed')
require(cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==BASE,'Remote writer moved')
index={'head':TOOLING,'files':{}}
for name in sorted(FILES):
    raw,index['files'][name]=raw_git(TOOLING,'WP/batch-proof-cde8-20261015/'+name);require(raw==(SOURCE/name).read_bytes(),'Actual source changed')
review_raw=cmd('gh','api','repos/yigini/soilfer-lims/issues/comments/6183081827');review=exact_json(review_raw);approval(review,index);evidence=current_evidence(review,index)
DEST.mkdir()
def save(n,raw):
    with (DEST/n).open('xb') as f:f.write(raw)
save('actual-source-pass-original.json',review_raw);save('actual-source-pass-readable.txt',review['body'].encode());save('tooling-source-index.json',canonical(index)+b'\n');save('current-boundary-evidence.json',canonical(evidence)+b'\n')
save('native-actual-verdict-read.json',canonical({'status':'ACTUAL_NATIVE_PASS_AND_SCOPE_READ_ONLY','observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'windowId':7867734,'project':'LIMS Audit','thread':'Lab workflow audit and plan','rightComposerEmpty':True,'centerHumanDraftPreserved':'can you go and ask Pip','actualClaudioSaysSourcePassOnEa9AndOwnValidatorPasses':True,'threeNonblockingSafeStopsRead':True,'actualClaudioRestrictsNewScopeToUpstreamSnapshotStoppedCopyOnly':True,'newMessageSent':False,'productionOperations':0})+b'\n')
lead='''## 2026-10-15 ACTUAL Claudio new stopped-copy SourcePASS6183081827 — one scoped proof now authorized

Actual02:33:38UTC Source review: PASS bindsea9ce209d85305f863378d689b443d3134cbb4cf/all10hashes/cde8tree638/qualifiedb5+c03+6608PASS/NORMALhealthy959d7a8109/root023000/exactscope/pins/accounting/128DB3assets4GiB/floor500MB/memory805unit5400readiness600headroom60+600. Fullraw/current fresh all3appPASS+merges/mainCI at WP/batch-proof-cde8-20261015/actual-source-pass-6183081827/index.json. ActualnativeCl verdict/readscope/ownvalidator/61tests3.11+3.9.23/threeNONBLOCKINGsafeSTOPnotes read fresh7867734/rightEMPTY/centrehumanDraft preserved; no duplicateack. Both87df/6aPASS no longer authorize;020000failure remains sealed. New overlay/source PASS supersedes pendingea9. Exact16retainedviews accepted/unknownowner refused;61tests bothPythonversions/native correction that oldbuild guard was narrower read. ONE new rawsnapshot/ownedstoppedinstallation+jobs-OFFstartup proof authorized understandingYYgo, notjobs-ONqualification/kit/gate/deploy. Exactroot023000/package/unit stillUNCREATED/no productionfilecopy/count/connection/installer/entrypoint/proof yet. Nextprepare/launch actualreviewedgraphONCE afterfreshimmediate source/mainCI/all3audits/PASS/no-later-failure/unusedrootunit. Normalhealthybaseline/newb5 separatelybound; Source10639→11242 notproductionobservations yet. Ifrefused retainall, no samehelper/installer replay; separatelyreviewedforwardfixONLY. AllscientificimpactnonzeroYY/approvedSTOP/secondarysnapshotallocation/policycanonical/allstoppedcontainers/diskmemorypins/human103/history remain.

'''
readme=REPO/'WP/audit-release-eb6de2e8/README.md';readme.write_bytes(lead.encode()+readme.read_bytes())
paths=sorted(p for p in DEST.iterdir() if p.is_file())+[pathlib.Path(__file__),readme];out=DEST/'index.json'
save(out.name,canonical({'status':'ACTUAL_NEW_STOPPED_COPY_SOURCE_PASS_RETAINED_NO_PROOF_RUN','sourceCommit':TOOLING,'actualReviewId':review['id'],'actualReviewUtc':review['created_at'],'scope':SCOPE,'next':'ONE_SOURCE_BOUND_RAW_SNAPSHOT_AND_OWNED_STOPPED_COPY_PROOF','rootCreated':False,'productionCopies':0,'proofOperatorsExecuted':0,'jobsOnQualificationStillRequired':True,'files':[{'path':p.relative_to(REPO).as_posix(),'bytes':p.stat().st_size,'sha256':sha(p.read_bytes())} for p in paths]})+b'\n');paths.append(out);rels=[p.relative_to(REPO).as_posix() for p in paths]
cmd('git','-c','core.autocrlf=false','add','-f','--',*rels);require(set(cmd('git','diff','--cached','--name-only').decode().splitlines())==set(rels),'Staged scope differs');tree=cmd('git','write-tree').decode().strip()
for p,rel in zip(paths,rels):require(raw_git(tree,rel)[0]==p.read_bytes(),'Staged raw bytes differ')
cmd('git','commit','-m','Retain actual exact stopped-copy source approval and unchanged execution boundaries');head=cmd('git','rev-parse','HEAD').decode().strip()
for p,rel in zip(paths,rels):require(raw_git(head,rel)[0]==p.read_bytes(),'Committed raw bytes differ')
cmd('git','push','origin','audit/release-eb6de2e8');require(cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head,'Remote audit differs')
print(json.dumps({'status':'ACTUAL_SOURCE_PASS_RAW_EVIDENCE_PUSHED','head':head,'verifiedOwnedBlobs':len(paths),'actualSourcePass':review['id'],'productionCopies':0,'proofOperatorsExecuted':0}))
