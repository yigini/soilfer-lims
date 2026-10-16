"""Retain actual exact C1/C2 approval and current authorities before any package."""
import sys,pathlib,json,subprocess
from prechecks6210209468_evidence import *
sys.dont_write_bytecode=True;sys.path.insert(0,str(B))
import diagnostic_contract as c, diagnostic_authority as authority, prepare_diagnostic as prep
BASE='c7739b55473fc7cd15d44efbe99cc5bbd6d87d67';SOURCE='a6d8c5d5085bbe07cb649f858ec00acf0e3f8ee1';D=B/'actual-source-pass6210209468-once'
assert git('rev-parse','HEAD').decode().strip()==BASE and git('branch','--show-current').decode().strip()=='audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip() and not D.exists()
publications=[verify_publication(SOURCE,c.REL+'source94-publication-once/publication-index.json',142),verify_publication(BASE,c.REL+'exact-source-review94-handoff-once/publication-index.json',69)]
files,index=prep.source_index(SOURCE);assert len(files)==26 and len(c.tokens(index))==41
frozen=json.loads((W/'WP/startup-order-readiness-20261015/full-pinned-copy-retention-bound-ordinary-once/source-before.json').read_bytes());assert len(frozen)==1333
for name,digest in frozen.items():assert sha((W/name).read_bytes())==digest
old_rel='WP/batch-proof-controller-forward-step2-be837974-20261016/'
old=json.loads((W/old_rel/'exact-source-review420-once/source-index.json').read_bytes());assert old['head']=='572d8cc94ee5a98c29392f556a57133cedd13128' and len(old['files'])==31
old_raw=raw_many(old['head'],[old_rel+n for n in old['files']])
for name,pin in old['files'].items():assert (W/old_rel/name).read_bytes()==old_raw[old_rel+name] and sha(old_raw[old_rel+name])==pin['sha256']
captures=[];original=subprocess.check_output
def capture(args,*a,**kw):
    raw=original(args,*a,**kw)
    if args[:2]==['gh','api']:captures.append((args,raw))
    return raw
subprocess.check_output=capture
review_raw=capture(['gh','api','repos/yigini/soilfer-lims/issues/comments/6210209468']);review=json.loads(review_raw);c.approval(review,index)
assert review['id']==6210209468 and review['created_at']==review['updated_at']=='2026-10-16T07:15:43Z'
evidence=authority.current_evidence();prep.later_comments(evidence,review,index)
fresh=capture(['gh','api','repos/yigini/soilfer-lims/issues/comments/6210209468']);assert json.loads(fresh)==review
D.mkdir();save(D,'actual-source-pass-original.json',review_raw);save(D,'actual-fresh-readback.json',fresh);save(D,'actual-source-pass-readable.txt',review['body'].encode());save(D,'source-index.json',canonical(index)+b'\n');save(D,'current-authority-evidence.json',canonical(evidence)+b'\n')
for i,(_,raw) in enumerate(captures):save(D,'api-original-'+str(i).zfill(2)+'.json',raw)
save(D,'api-command-index.json',canonical([{'file':'api-original-'+str(i).zfill(2)+'.json','argv':args,'length':len(raw),'sha256':sha(raw)} for i,(args,raw) in enumerate(captures)])+b'\n')
record={'status':'ACTUAL_EXACT_PRECHECK_SOURCE_PASS_VALIDATED_NOT_EXECUTED','verifiedUtc':utc(),'sourceHead':SOURCE,'sourceReviewId':review['id'],'reviewCreatedUtc':review['created_at'],'bodySha256':sha(review['body'].encode()),'all26SourceHashes':c.bindings(index),'literalBindings':41,'publicationsVerified':publications,'all1333AppInputsUnchanged':True,'old06300031SourceUnchanged':True,'currentAuthoritiesAndNoLaterRejectionVerified':True,'allowedChecks':['comparator','hook'],'oneRunEachNoRetry':True,'packagePrepared':False,'hostOperations':0,'qualificationAttemptAllowed':False,'nativeFallbackCancelledAnswered':True,'conditions':['C1 then C2 sequentially, one run each, fresh R4+10GB/root and both unused units','All raw inspect streams/key/DB bytes remain HOST0400; never fetch','C1 missing public result prevents C2 under this graph; bring back to reviewer','If run_diagnostic HMAC literal refuses, compare only closed source literal list under HOST key and disclose only match','Actual Claudio acceptance of BOTH results before distinct reviewed attempt graph; no kit/gate/deploy/main merge','Future kit first-sync impact/counts may differ plus9to10 minute restart/exact600s failure']}
save(D,'independent-pass-validation.json',canonical(record)+b'\n')
lead=f'''LATEST ACTUAL EXACT PRECHECK SOURCE PASS6210209468 - 2026-10-16T07:15:43Z.
Full uneditedClaudeapp1236702slugclaude Source review: PASS validates own diagnostic_contract.approval/exacta6d8c5d5085bbe07cb649f858ec00acf0e3f8ee1/ALL26SHA+41tokens. All143source+70handoff rawGitOID-SHA-length verified/26source+old06300031+1333app unchanged/current4audits6rules2rebootmemoryjobsprivacyaccepted063R2/mainbeCI38772398721attempt1pushCLOSEDSUCCESS/#191CLOSED/no laterrejection. Full actual review/currentauthority at {c.REL}actual-source-pass6210209468-once/publication-index.json.
Authorizes C1 comparator THEN C2 hook ONErunEACH/noretry, PRECHECKS_ONLY_NOT_RELEASE_QUALIFIED. No package/root/units/check yet. FreshR4floor+4GiBlogs+10GB+two563326976Bcopies+exactfuturepkgROOTONLY/unusedrootBOTHunits before launch. Read FULL conditions: run_diagnostic literals HMAC-only; if refusal HOSTkey closedliteral comparison may disclose only match. If C1 fails without comparator/public-result.json C2 cannot run; return actual result to Claudio. Reviewer reports freshprocessMemorySource and stand-inDocker path are HIS tests, NOTactualC1C2.
07:12:31nativefallback CANCELLEDanswered/no native input/message/no duplicateACK/GH/request. ActualPASSACK ONLYeventualtwo-check result. Native fresh returnedClaude2888208/LIMS Audit/Lab workflow checklist displayed reviewposted; humancomposers/cards preserved. ALLrawinspectstdoutstderr HOST0400/ENV-JWT NEVERFETCH/privatekeysDBsHOST. C1copiesONLY2mains/openNEWcopiesROimmutable/full11242/zeroRefusals/allholdauditsconsumed/original6SHAstatbeforeafter. C2newunpatchedstop_exact+realcall/readonlypsinspectONLY/BOTHalreadySTOPPED063owners/Typeexec805Swap0UMask0077journal/no stopstart. Need actualClBOTHresultsacceptance THENdistinctattemptgraphbindsacceptance+ownexactSourcePASS/freshR4unusedrootunit/ONEattempt. Noqualification/kit/gate/deploy now.
Allold063000source572d/PASS620818/rootunit/package/operators/oncehelpersCONSUMEDimmutable NEVERpatchretryreplaycleanup. MainMERGEHOLD/233000KEEPIT/R2COMPLETE/noprune/nohostgrowrestart/no103/noagentsnewchatworktreecheckoutconcurrentwriter/humansheld. Futurekit186/22LOGONLYuntilC1/countsmaydiff+9to10minrestart/exact600failure. SAMEheartbeatACTIVE2min/restore10ONLYactualbeDEPLOYED+ClactualpostdeployPASS. Preserve ALLolderhistoryverbatimbelow.

'''
out=publish(D,[pathlib.Path(__file__),pathlib.Path(__file__).with_name('prechecks6210209468_evidence.py'),B/'native-source-pass0717-readonly-original.json'],'Retain exact precheck source PASS6210209468',lead);print(json.dumps({**out,'actualPass':6210209468,'bindings':26,'hostOperations':0}))
