"""Retain the NEW exact forward-resume approval; no package or remote operator."""
import datetime,json,pathlib,subprocess,sys
REPO=pathlib.Path(__file__).resolve().parents[2]
SOURCE=REPO/'WP/batch-proof-forward-resume-cde8-20261015'
DEST=SOURCE/'actual-source-pass-6185240820'
BASE='d25374510818fdd0e7af610e8fc07bcba96ea05e'
TOOLING='b9af37993632ca10b56943ae894fc0a816b8efcc'
sys.path.insert(0,str(SOURCE))
from proof_contract import *
from prepare_proof import current_evidence,raw_git
def cmd(*a):return subprocess.check_output(a,cwd=REPO)
require(not DEST.exists() and cmd('git','rev-parse','HEAD').decode().strip()==BASE and not cmd('git','diff','--cached','--name-only').strip(),'Consumed boundary or writer changed')
require(cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==BASE,'Remote writer moved')
index={'head':TOOLING,'files':{}}
for n in sorted(FILES):
    raw,index['files'][n]=raw_git(TOOLING,'WP/batch-proof-forward-resume-cde8-20261015/'+n)
    require(raw==(SOURCE/n).read_bytes(),'Source changed '+n)
review_raw=cmd('gh','api','repos/yigini/soilfer-lims/issues/comments/6185240820')
review=exact_json(review_raw);approval(review,index);evidence=current_evidence(review,index)
DEST.mkdir()
def save(n,raw):
    with (DEST/n).open('xb') as f:f.write(raw)
save('actual-source-pass-original.json',review_raw)
save('actual-source-pass-readable.txt',review['body'].encode())
save('tooling-source-index.json',canonical(index)+b'\n')
save('current-boundary-evidence.json',canonical(evidence)+b'\n')
save('native-actual-verdict-read.json',canonical({'status':'ACTUAL_NATIVE_FORWARD_PASS_READ_ONLY','observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'windowId':7867734,'project':'LIMS Audit','thread':'Lab workflow audit and plan','rightComposerEmpty':True,'centerHumanDraftPreserved':'can you go and ask Pip','actualSourcePass':6185240820,'exactSource':TOOLING,'testsBothPythonVersionsAndRealPriorPinsRead':True,'oneForwardAttemptConditionalOnFreshCapacityAndAuthority':True,'capacityShortfallGoesToYY':True,'jobsOnKitGateDeploymentNotApproved':True,'newMessageSent':False,'productionOperations':0})+b'\n')
lead='## 2026-10-15 actual b9af3799 SourcePASS6185240820 / one conditional forward080000 attempt\n\nActual05:35:02UTC uneditedCl Source review: PASS binds b9af37993632ca10b56943ae894fc0a816b8efcc/all12hashes/ALLliteralbindings/080000root/N44/55/table6e70. Own approval() and fresh currentmainCI38636615469/all3 actual app audits/no laterfailure validated. Cl independently ran166tests on3.11+3.9.23/hashunchanged/realASTinventory, fetched all22e283pins/OID-SHA-length, validated real1765inventory and corrected206repeat using installedseal+closedinventory afterclosure (NOTunsealedoldtuples). Newinput installed206RAWTRIPLE/copyONCE/no priorSQL/newproductioncopy/policy206replay; carried10639/10840/policy206. Future214impact209/BOTHjobsOFFstarts; mainexact/WALabsentemptyONLYequivalence/nonemptyexact/0400statesbeforeSTOP/NOOPinteger0backfill0/fullpriorfingerprintpreservationSQLONLYNEWbackup accepted. ActualnativePASS and conditional scope read/rightEMPTY/centreHUMANDRAFT preserved/no duplicateack.\n\nOnlyONEnewforward owned214209/jobsOFFattempt conditionalfreshauthority/capacity/unusedrootunit. N44=1+7+2+10+12+12/55equiv/25percent/min64droppedONLYperactualCl/3assetreserve/floor10556150894/logs4GiB/500MB/physicaldu-x/remainingbudget/allretention unchanged. Lastreference05:26:53 T563326976/A5787648/free49517506560 required45851464814/slack3666041746 REFERENCEONLY; freshcapacityBEFOREROOT+beforeunit/controllerbind mandatory. No package/root/unit/proof created atthisretention. Old070000FAIL/e283/allinputsandfourstoppedcontainers remainimmutable/no206replay; actual214209scientificlists/11242/startupsUNKNOWN. QualifiedB5c03B1/NORMAL959d7a8109/currentmainCI3audits bound. AllYYscience/nonzeroYYapprovedSTOP/separateforwardremedy/policy/allocations/memoryreadiness/forwardonly103humanhistoryguards hold. NOT_RELEASE_QUALIFIED; jobsONnaturalintake+broadpostflights/exactkit/freshgate later.\n\n'
readme=REPO/'WP/audit-release-eb6de2e8/README.md';readme.write_bytes(lead.encode()+readme.read_bytes())
paths=sorted(p for p in DEST.iterdir() if p.is_file())+[pathlib.Path(__file__),readme]
save('index.json',canonical({'status':'ACTUAL_NEW_FORWARD_SOURCE_PASS_RETAINED_NO_OPERATOR','sourceCommit':TOOLING,'actualReviewId':review['id'],'actualReviewUtc':review['created_at'],'scope':SCOPE,'rootCreated':False,'proofOperatorsExecuted':0,'productionCopies':0,'jobsOnQualificationStillRequired':True,'files':[{'path':p.relative_to(REPO).as_posix(),'bytes':p.stat().st_size,'sha256':sha(p.read_bytes())} for p in paths]})+b'\n')
paths.append(DEST/'index.json');rels=[p.relative_to(REPO).as_posix() for p in paths]
cmd('git','-c','core.autocrlf=false','add','-f','--',*rels)
require(set(cmd('git','diff','--cached','--name-only').decode().splitlines())==set(rels),'Staged scope differs')
tree=cmd('git','write-tree').decode().strip()
for p,rel in zip(paths,rels):require(raw_git(tree,rel)[0]==p.read_bytes(),'Staged raw differs')
cmd('git','commit','-m','Retain exact forward-resume source approval and one-attempt scope')
head=cmd('git','rev-parse','HEAD').decode().strip()
for p,rel in zip(paths,rels):require(raw_git(head,rel)[0]==p.read_bytes(),'Committed raw differs')
cmd('git','push','origin','audit/release-eb6de2e8')
require(cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head,'Remote audit differs')
print(json.dumps({'status':'ACTUAL_EXACT_FORWARD_SOURCE_PASS_RETAINED','head':head,'actualSourcePass':review['id'],'verifiedOwnedBlobs':len(paths),'rootCreated':False,'proofOperatorsExecuted':0}))
