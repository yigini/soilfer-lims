"""Retain actual Claudio acceptance and independently verify the immutable R2 publication."""
import datetime,pathlib,subprocess,sys
R=pathlib.Path(__file__).resolve().parents[2];S=R/'WP/r2-cache-api-identity-acc15844-20261015';D=S/'actual-r2-result-accepted6202252017-once';BASE='2cd0dc63c8c0fb556c0f91b1ae3b6f18b2da054c';CLOSED='8badd08bd9e613a331be15b0ffc35453c46d71bf'
sys.path.insert(0,str(S));from r2_contract import *
from prepare_r2 import gh,current_evidence
def git(*a):return subprocess.check_output(['git','-c','core.longpaths=true',*a],cwd=R)
require(not D.exists() and git('rev-parse','HEAD').decode().strip()==BASE and git('branch','--show-current').decode().strip()=='audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip(),'Same writer/base/one retention required')
raw=gh('repos/yigini/soilfer-lims/issues/comments/6202252017');v=json_exact(raw);app=v.get('performed_via_github_app') or {}
require(v['id']==6202252017 and app.get('id')==1236702 and app.get('slug')=='claude' and v['created_at']==v['updated_at']=='2026-10-15T21:04:54Z' and v['body'].startswith('R2 result check: accepted') and all(x in v['body'] for x in ['8badd08','c9e4e8ba','R2 is therefore satisfied','please don\'t plan another R2 run for this release','acc158/cd3a-bound proof graph','fresh R4 requirement plus 10 GB']),'Actual unedited exact R2 acceptance required')
pubpath='WP/r2-cache-api-identity-acc15844-20261015/r2-220000-closed-publication-once/publication-index.json';pubraw=git('show',CLOSED+':'+pubpath);pub=json_exact(pubraw);require(len(pub['files'])==225,'225 indexed plus index226 raw blobs required')
ids=[r['gitBlobOid'] for r in pub['files']];batch=subprocess.check_output(['git','cat-file','--batch'],cwd=R,input=('\n'.join(ids)+'\n').encode());at=0
for row in pub['files']:
    end=batch.index(b'\n',at);header=batch[at:end].decode().split();require(header[0]==row['gitBlobOid'] and header[1]=='blob' and int(header[2])==row['length'],'Immutable Git batch header differs')
    at=end+1;b=batch[at:at+row['length']];at+=row['length'];require(batch[at:at+1]==b'\n','Git batch separator differs');at+=1
    require(len(b)==row['length'] and sha(b)==row['sha256'] and oid(b)==row['gitBlobOid'],'Published raw OID/SHA/length differs '+row['path'])
require(at==len(batch),'Extra Git batch bytes')
idx=json_exact((S/'reviewed-r2-package-once/source-index.json').read_bytes());review=json_exact((S/'reviewed-r2-package-once/source-review.json').read_bytes());evidence,history=current_evidence();no_later_source_failure(history,review,idx['head'])
for n,h in graph(idx).items():require(sha((S/n).read_bytes())==h,'Reviewed source changed')
frozen=json_exact((R/'WP/startup-order-readiness-20261015/full-pinned-copy-retention-bound-ordinary-once/source-before.json').read_bytes());require(len(frozen)==1333,'Frozen inventory differs')
for n,h in frozen.items():require(sha((R/n).read_bytes())==h,'App input changed '+n)
C=S/'r2-220000-closed-originals-once';events=[json_exact(p.read_bytes()) for p in sorted(C.glob('*-api-read.json'))];inventories=[cache_rows(json_exact(e['rawUtf8'])['BuildCache']) for e in events if e['endpoint']=='/v1.52/system/df'];first=inventories[0];last=inventories[-1]
require(len(first)==len(last)==380 and first==last,'All380 initial/final records must agree')
unshared=sum(r['Size'] for r in first.values() if not r['Shared']);shared=sum(r['Size'] for r in first.values() if r['Shared']);require(unshared==2494910338 and shared==5577243796 and unshared<CAP,'Actual shared/unshared logical breakdown differs')
preservations=[json_exact(p.read_bytes())['value'] for p in sorted(C.glob('*-safe-selected-preservation.json'))];require(len(preservations)==6 and all(x==preservations[0] for x in preservations) and len(preservations[0]['images'])==35,'Six complete preservation snapshots/35 images differ')
D.mkdir()
def save(n,raw):
    p=D/n;p.parent.mkdir(parents=True,exist_ok=True)
    with p.open('xb') as f:f.write(raw)
save('actual-acceptance-original.json',raw);save('actual-acceptance-readable.txt',v['body'].encode());save('closed-publication-index-original.json',pubraw)
for n,b in evidence.items():save('fresh/'+n,b)
record={'status':'ACTUAL_CLAUDIO_R2_RESULT_ACCEPTED_R2_SATISFIED_NO_MORE_R2_THIS_RELEASE','retainedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'acceptanceCommentId':v['id'],'acceptanceCreatedUtc':v['created_at'],'acceptanceUrl':v['html_url'],'acceptanceSemanticSha256':sha(canonical({'id':v['id'],'body':v['body'],'created_at':v['created_at'],'updated_at':v['updated_at'],'app':{'id':app['id'],'slug':app['slug']}})),'closedAudit':CLOSED,'all225IndexedBlobsAndIndex226Verified':True,'cacheRecordCount':380,'initialAndFinalEntireCacheRecordsUnchanged':True,'unsharedLogicalBytes':unshared,'sharedLogicalBytes':shared,'preservationSnapshotCount':6,'imageCount':35,'actualPruneInvocations':2,'removedIds':0,'r2SatisfiedByActualClaudio':True,'noAnotherR2ForThisRelease':True,'all5And1333Unchanged':True,'newProofGraphStillRequiresExactSourceReviewFreshR4PlusAdditional10GB':True,'diskResizeHeadsUpOnlyNotAuthority':{'reportedByClaudio':'YY may resize the server disk tonight and it needs a reboot; tell YY when between steps if asked','noResizeOrRebootAskedOrPerformedByUs':True,'currentServerOperationsIdle':True},'sourceWorkCanContinueWithoutServerRun':True,'noDuplicateAckOrNativeMessage':True,'productionOperationsByRetainer':0}
save('accepted-result-derived-record.json',canonical(record)+b'\n')
lead=f'''## 2026-10-15 actual Claudio R2 result6202252017 ACCEPTED; R2 SATISFIED/no more R2 for release

FULLactualuneditedClaudeapp1236702slugclaude6202252017/{v['created_at']} {v['html_url']} independentlyread/retained. Accepts220000receipt/8badd08b/c9e4e8ba; saysR2SATISFIED andexplicitlyNOANOTHERR2forrelease. IndependentlyreverifiedALL225indexed+index226rawOID/SHA/length, entire380cacheinitial=final, shared5577243796/unshared2494910338(<5GB), all6preservations/35images equal/all5+1333unchanged/freshmainCI4audits6rules/nolaterfailure. TWOcommands0B/2NOT_REMOVED+30childSKIPPED/zero removed/NOreclaimcredit/NOadditionalprune/allgraphsrootshelpersconsumed. Rawacceptance/currentauthority/derivedrecord at WP/r2-cache-api-identity-acc15844-20261015/actual-r2-result-accepted6202252017-once/publication-index.json. No duplicateACK/native/receiptneeded; acknowledgementbundleONLYnextmeaningfulnewsourcehandoff. ClaudioexplainsBuildKitcapusesunsharedbytes; primaryobservedbreakdownverified, mechanismreportedbyClaudio/notnewoperatorpermission. NEXTcompleteNEWacc158cd3a-boundproofgraph/source-derivedALLcopyTMPDIRbudget/meaningfullocalhostguards/publish/newexactallhashClSourcePASS/freshR4COMPUTED+ADDITIONAL10GB/newroot; nofitSTOPqualifiedR1options. No newproofgraph/requestyet/donotwaitapprovalnonexistentgraph. Clheads-upYYMAYresizeDISKtonightwithreboot: scopeHEADSUPONLY/notresize-rebootauthority; IFYYasksreportbetweensteps/nevermidrun. NoactiveR2/build/proof/localrunnerretainer; sourceanalysiscancontinuewithoutserveroperation. MainmergeHOLD/heartbeat2min/restores10afteractualbeDeploy+Clpostcheck/sciencehistoryR1-R5/humans held. No productionDB/settings/restart/buildproofR1kitgatedeploy/103.

'''
readmes=[R/'WP/audit-release-eb6de2e8/README.md',R/'WP/runtime-recovery-kobo/README.md']
for p in readmes:p.write_bytes(lead.encode()+p.read_bytes())
paths=sorted(p for p in D.rglob('*') if p.is_file())+[pathlib.Path(__file__),*readmes];names=[p.relative_to(R).as_posix() for p in paths]
save('publication-index.json',canonical({'baseAudit':BASE,'acceptanceCommentId':v['id'],'files':[{'path':n,'length':len(p.read_bytes()),'sha256':sha(p.read_bytes()),'gitBlobOid':oid(p.read_bytes())} for p,n in zip(paths,names)]})+b'\n');paths.append(D/'publication-index.json');names.append((D/'publication-index.json').relative_to(R).as_posix())
for i in range(0,len(names),15):git('-c','core.autocrlf=false','add','-f','--',*names[i:i+15])
require(set(git('diff','--cached','--name-only').decode().splitlines())==set(names),'Staged ownership differs');tree=git('write-tree').decode().strip()
for p,n in zip(paths,names):require(git('show',tree+':'+n)==p.read_bytes() and git('rev-parse',tree+':'+n).decode().strip()==oid(p.read_bytes()),'Raw staged identity differs')
git('commit','-m','Retain actual R2 acceptance and no-more-R2 boundary');head=git('rev-parse','HEAD').decode().strip()
for p,n in zip(paths,names):require(git('show',head+':'+n)==p.read_bytes(),'Committed raw bytes differ')
git('push','origin','audit/release-eb6de2e8');require(git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head,'Pushed writer differs')
print(json.dumps({'audit':head,'rawOidShaVerifiedBlobs':len(paths),'acceptanceCommentId':v['id'],'r2Satisfied':True,'noAnotherR2ForThisRelease':True}))
