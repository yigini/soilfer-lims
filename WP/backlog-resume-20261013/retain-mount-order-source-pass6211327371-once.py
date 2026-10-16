"""Retain and validate the exact NEW mount-order approval. No host operations."""
import pathlib,sys
sys.dont_write_bytecode=True
W=pathlib.Path(__file__).resolve().parents[2]
H=W/'WP/backlog-resume-20261013'
sys.path.insert(0,str(H))
from prechecks6210209468_evidence import git,sha,oid,canonical,utc,save,raw_many,verify_publication
from prechecks6210209468_boundary_publication import boundary_publish
REL='WP/batch-proof-mount-order-forward-be837974-20261016/'
B=W/REL;D=B/'actual-source-pass6211327371-once'
BASE='4563e5c3b9a4fd1a204f89a8460892159e83bc5f'
SOURCE='187636984895aec44044635fb63498b0fcb3102e'
sys.path.insert(0,str(B))
from proof_contract import *
import prepare_proof as prep
require(git('rev-parse','HEAD').decode().strip()==BASE and git('branch','--show-current').decode().strip()=='audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip() and not D.exists(),'Same writer/empty stage/new retention required')
index=exact_json((B/'exact-source-review568-once/source-index.json').read_bytes())
require(index['head']==SOURCE and len(index['files'])==37 and len(tokens(index))==193,'Exact37/193 graph required')
pubs=[verify_publication(SOURCE,REL+'source568-publication-once/publication-index.json',731),verify_publication(BASE,REL+'exact-source-review568-handoff-once/publication-index.json',57),verify_publication('48eb2d20692b2e642a3303dc943dd7ba4f71648a','WP/controller063000-prechecks-be837974-20261016/actual-both-results-accepted6210719791-once/publication-index.json',40)]
raws=raw_many(SOURCE,[REL+n for n in FILES])
for n,r in index['files'].items():
 data=raws[REL+n];require(data==(B/n).read_bytes() and len(data)==r['bytes'] and sha(data)==r['sha256'] and oid(data)==r['blob'],'Reviewed source changed '+n)
old=[]
for source,rel,idx,count in [('a6d8c5d5085bbe07cb649f858ec00acf0e3f8ee1','WP/controller063000-prechecks-be837974-20261016/','exact-source-review94-once/source-index.json',26),('572d8cc94ee5a98c29392f556a57133cedd13128','WP/batch-proof-controller-forward-step2-be837974-20261016/','exact-source-review420-once/source-index.json',31)]:
 # Read the committed index from its actual existing request directory below.
 if not (W/rel/idx).exists():
  candidates=[p for p in (W/rel).glob('*/source-index.json') if exact_json(p.read_bytes()).get('head')==source]
  require(len(candidates)==1,'Unique prior source index required');idx=candidates[0].relative_to(W/rel).as_posix()
 previous=exact_json((W/rel/idx).read_bytes());require(previous['head']==source and len(previous['files'])==count,'Prior graph inventory differs')
 prior=raw_many(source,[rel+n for n in previous['files']])
 for n,r in previous['files'].items():require(prior[rel+n]==(W/rel/n).read_bytes() and sha(prior[rel+n])==r['sha256'],'Prior source changed '+n)
 old.append({'head':source,'files':count,'unchanged':True})
frozen=exact_json((W/'WP/startup-order-readiness-20261015/full-pinned-copy-retention-bound-ordinary-once/source-before.json').read_bytes());require(len(frozen)==1333,'Frozen application inventory differs')
for n,h in frozen.items():require(sha((W/n).read_bytes())==h,'Application input changed '+n)
captures=[];original=prep.command
def capture(*args):
 raw=original(*args)
 if args[:2]==('gh','api'):captures.append((list(args),raw))
 return raw
prep.command=capture
review_raw=capture('gh','api','repos/yigini/soilfer-lims/issues/comments/6211327371');review=exact_json(review_raw);approval(review,index)
require(review['id']==6211327371 and review['created_at']==review['updated_at']=='2026-10-16T08:25:10Z','Actual exact verdict identity differs')
evidence=prep.current_evidence(review,index)
require(exact_json(capture('gh','api','repos/yigini/soilfer-lims/issues/191'))['state']=='closed','Issue191 changed')
receipt=prep.raw_git(BUILD_EVIDENCE,prep.BUILD_REL+'build-receipt.json')[0];inspection=prep.raw_git(BUILD_EVIDENCE,prep.BUILD_REL+'image-inspect-original.json')[0];qualified(exact_json(receipt),receipt,exact_json(inspection)[0])
D.mkdir()
save(D,'actual-source-pass-original.json',review_raw);save(D,'actual-source-pass-readable.txt',review['body'].encode());save(D,'tooling-source-index.json',canonical(index)+b'\n');save(D,'current-authority-evidence.json',canonical(evidence)+b'\n')
for i,(_,raw) in enumerate(captures):save(D,'api-original-'+str(i).zfill(2)+'.json',raw)
save(D,'api-command-index.json',canonical([{'file':'api-original-'+str(i).zfill(2)+'.json','argv':args,'bytes':len(raw),'sha256':sha(raw),'gitBlobOid':oid(raw)} for i,(args,raw) in enumerate(captures)])+b'\n')
record={'status':'ACTUAL_NEW_EXACT_MOUNT_ORDER_SOURCE_PASS_VALIDATED_NOT_EXECUTED','verifiedUtc':utc(),'sourceHead':SOURCE,'sourceReviewId':review['id'],'reviewCreatedUtc':review['created_at'],'reviewBodySha256':sha(review['body'].encode()),'all37SourceHashes':graph(index),'literalBindings':193,'completeSourceOriginalCount':732,'publicationsVerified':pubs,'oldImmutableGraphsVerified':old,'all1333AppInputsUnchanged':True,'currentAuthoritiesVerified':True,'scope':SCOPE,'root':str(ROOT),'unit':'lims-'+ROOT_NAME.lower()+'.service','proofAttemptsAllowed':1,'retryAllowed':False,'packagePrepared':False,'hostOperations':0,'productionSqliteConnections':0,'nativeFallbackCancelled':True,'conditions':['Fresh R4 +10GB BEFORE_ROOT/immediately BEFORE_UNIT/runtime, unused root and unit, one attempt/no retry','No kit/gate/deploy/main merge','memory.stat not yet read through own_snapshot on actual host; first-observe refusal consumes attempt and must be reported, never rerun','Retriable first-sync skip may stall cursor and cause conservative second-fetch comparator refusal; name it if observed','Exact two-owner stop-post retained/stopped nonvacuously, all errors fail, controller raw before/after/post-stop same cgroup OOM0 and actual journal hook exit0 required','All jobsON logs reviewed before public publication; DBs and private keys HOST0400/withheld','Future kit impact186/22 C1 validated, deployment counts may differ; stop grace and actual exit code included in9to10min restart/exact600 failure','Seven queued issues remain held under YY single-writer instruction; Claudio will ask YY directly']}
save(D,'independent-pass-validation.json',canonical(record)+b'\n')
lead=f'''LATEST ACTUAL EXACT MOUNT-ORDER SOURCE PASS6211327371 - 2026-10-16T08:25:10Z.
FULL actual uneditedClaudeapp1236702slugclaude Source review: PASS; own proof_contract.approval validates source187636984895aec44044635fb63498b0fcb3102e/ALL37SHA+193tokens. All732source+58handoff+41acceptance rawGitOID-SHA-length independently verified/all37+old26+31+1333app unchanged/currentmainbeCI38772398721attempt1pushSUCCESS/authorities/#191CLOSED. Full approval at {REL}actual-source-pass6211327371-once/publication-index.json.
ONEnew100000 qualification attempt conditional freshR4+10GB BEFORE_ROOT/immediatelyUNIT/runtime/unusedrootunit/no retry. No operationalpackage/root/unit/attempt yet; NEXT prepare/publishONEpackage then reviewedlauncher. Source request6210983687 ANSWERED;08:24:55nativefallback CANCELLED/NEVERrepeat/no duplicateACK/GH/native. Bundle621132PASSACK ONLY eventual actual result. No kit/gate/deploy/MainMERGEHOLD.
Notes: actualHOSTmemory.stat through own_snapshot NOTyetread; first-observe refusal must be reported/no rerun. First-sync retriable skip can stallcursor and cause conservative second-fetch refusal; name it if observed. Reviewer's stand-in executable/Node/568tests reports are HIS evidence, not our actualhost Docker-stop/proof result. Human SAMEwriter/noagentsnewchatworktreecheckout constraint explicitly accepted; sevenstatus alreadyanswered/ClwillaskYYdirectly. Both exactowners stoppedAndRetained NONVACUOUS/postStopErrorsEMPTY/controllerbeforeafterpoststop rawsamecgroupOOM0/journalhookexit0/fullpreservation mandatory; runtimeAWAITING notclosedPASS. PrivatekeysDBsHOST0400/ALLjobsONlogs contentreview beforepublicGit. 186new22holdsC1validated/countsmaydiff; futurekitstopgraceactualexitincluded9to10minrestart/exact600failure. Old063000/080000 rootunitsPASSoperators CONSUMEDimmutable/no replaycleanup.233000KEEPIT/R2COMPLETE/noprune/nohostgrowrestart/no103/humansheld/SAMEheartbeatACTIVE2min restore10ONLYactualbeDEPLOYED+ClactualpostdeployPASS. Preserve ALL older history verbatim below.

'''
result=boundary_publish(D,[pathlib.Path(__file__)],'Retain exact mount-order source PASS6211327371',lead)
print(json.dumps({**result,'sourceReviewId':review['id'],'sourceFilesVerified':37,'literalBindings':193,'sourceRawOriginalsVerified':732,'hostOperations':0}))
