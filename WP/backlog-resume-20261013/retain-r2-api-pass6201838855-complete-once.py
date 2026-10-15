"""Retain the actual new exact R2 API/display review; no SSH or cache calls."""
import datetime,pathlib,subprocess,sys
R=pathlib.Path(__file__).resolve().parents[2];REL='WP/r2-cache-api-identity-acc15844-20261015/';S=R/REL;D=S/'actual-source-pass6201838855-once'
BASE='02716adcdf40fc60157f37dde8d8ebe40cee5098';TOOLING='edfe56e7e77431689a58c4a641c86d538a6f795b'
sys.path.insert(0,str(S));from r2_contract import *
from prepare_r2 import raw_git,current_evidence,gh
def git(*a):return subprocess.check_output(['git','-c','core.longpaths=true',*a],cwd=R)
require(git('rev-parse','HEAD').decode().strip()==BASE and git('branch','--show-current').decode().strip()=='audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip() and not D.exists(),'Same writer/base/one retention required')
index={'head':TOOLING,'files':{}}
for n in sorted(SOURCE_FILES):
    raw,index['files'][n]=raw_git(TOOLING,REL+n);require(raw==(S/n).read_bytes(),'Reviewed source changed')
pubraw=git('show',TOOLING+':'+REL+'source-publication-index.json');pub=json_exact(pubraw);require(len(pub['files'])==60,'60 indexed bindings plus index required')
for row in pub['files']:
    raw=git('show',TOOLING+':'+row['path']);require(len(raw)==row['length'] and sha(raw)==row['sha256'] and oid(raw)==row['gitBlobOid'],'Published raw source/evidence differs')
review_raw=gh('repos/yigini/soilfer-lims/issues/comments/6201838855');review=json_exact(review_raw);validate_source_review(review,TOOLING,index)
require(review['id']==6201838855 and len(review_tokens(TOOLING,index))==44,'Exact new review and all44 bindings required')
evidence,history=current_evidence();no_later_source_failure(history,review,TOOLING)
receipt=raw_git(BUILD_AUDIT,BUILD_REL+'build-receipt.json')[0];inspection=raw_git(BUILD_AUDIT,BUILD_REL+'image-inspect-original.json')[0];validate_build(receipt,inspection)
render_failure=raw_git(PRIOR_RENDER_FAILURE_AUDIT,PRIOR_RENDER_FAILURE_PATH)[0];validate_prior_render_failure(render_failure)
du_failure=raw_git(PRIOR_DU_FAILURE_AUDIT,PRIOR_DU_FAILURE_PATH)[0];validate_prior_du_failure(du_failure)
frozen=json_exact((R/'WP/startup-order-readiness-20261015/full-pinned-copy-retention-bound-ordinary-once/source-before.json').read_bytes());require(len(frozen)==1333,'Frozen inventory differs')
for p,d in frozen.items():require(sha((R/p).read_bytes())==d,'App input changed '+p)
D.mkdir()
def save(n,v):
    with (D/n).open('xb') as f:f.write(v)
save('actual-source-pass-original.json',review_raw);save('actual-source-pass-readable.txt',review['body'].encode());save('source-index-original.json',canonical(index)+b'\n');save('source-publication-index-original.json',pubraw)
for n,v in evidence.items():save(n,v)
save('independent-pass-validation.json',canonical({'status':'ACTUAL_NEW_EXACT_R2_SOURCE_PASS_VALIDATED_NOT_EXECUTED','verifiedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceHead':TOOLING,'sourceReviewId':review['id'],'reviewCreatedUtc':review['created_at'],'allFiveSourceHashes':graph(index),'allLiteralBindingsCount':44,'all60IndexedBindingsAndIndexVerified':True,'all1333AppInputsUnchanged':True,'freshMainCiFourAuditsAndSixRulePinsVerified':True,'qualifiedBuildReceiptSha256':sha(receipt),'priorRenderFailureSha256':sha(render_failure),'priorDuFailureSha256':sha(du_failure),'approvedAuthorityChange':'Exact Docker API full planned identity before and after Buildx; Buildx byte/time human strings are bounded evidence only. Exact reference/protection fields remain independent.','newPackageRootUnitCacheOperationUncreated':True,'scope':'ONE_NEW_220000_R2_TRIM_ONLY','old210000And213000ConsumedNeverReplay':True,'r2RetryAllowed':False,'cacheOperations':0,'productionConnections':0})+b'\n')
lead=f'''## 2026-10-15 actual NEW exact API R2 PASS6201838855 independently validated

Actual uneditedClaudeapp1236702/slugclaude SourcePASS6201838855/{review['created_at']} FULLREAD/ownvalidator exactedfe56e7 ALL5SHA+44literalbindings/60sourcebindings+index61raw/currentmainCI4audits6rulepins/all1333appinputs verified. Explicit authoritychange APPROVED: exact whole initial API identity BEFORE+AFTERBuildx; bounded human byte/time display EVIDENCEONLY, independent exact reference/protection fields. Authorizes ONE NEW220000R2trim only; both old210000and213000graphpackagehelpers consumed NEVERretry/replay. FullactualPASS/currentauthorities/sourceindex at {REL}actual-source-pass6201838855-once/publication-index.json. Newpackage/root/unit/cacheoperation UNCREATED atretention; nextONEreviewed33filepackage/publish/ONEfreshguardedlaunch. Existingheartbeat2min/restores10afteractualbe837974deploy+ClpostcheckPASS; Clreported10min unchanged/no duplicateACK/native/request. AllmainmergesHOLD/newproofbudgetreviewR4+10GB/sciencehistoryR1-R5/humans guards held. Noagents/newchat/worktree/concurrentwriter/productionoperation.

'''
readmes=[R/'WP/audit-release-eb6de2e8/README.md',R/'WP/runtime-recovery-kobo/README.md']
for p in readmes:p.write_bytes(lead.encode()+p.read_bytes())
paths=sorted(p for p in D.iterdir() if p.is_file())+[pathlib.Path(__file__),*readmes];idx=D/'publication-index.json'
save('publication-index.json',canonical({'baseAudit':BASE,'sourceReviewId':review['id'],'files':[{'path':p.relative_to(R).as_posix(),'length':len(p.read_bytes()),'sha256':sha(p.read_bytes()),'gitBlobOid':oid(p.read_bytes())} for p in paths]})+b'\n');paths.append(idx);names=[p.relative_to(R).as_posix() for p in paths]
for i in range(0,len(names),15):git('-c','core.autocrlf=false','add','-f','--',*names[i:i+15])
require(set(git('diff','--cached','--name-only').decode().splitlines())==set(names),'Staged ownership differs')
tree=git('write-tree').decode().strip()
for p,n in zip(paths,names):require(git('show',tree+':'+n)==p.read_bytes() and git('rev-parse',tree+':'+n).decode().strip()==oid(p.read_bytes()),'Raw staged identity differs')
git('commit','-m','Retain exact API R2 approval6201838855');head=git('rev-parse','HEAD').decode().strip()
for p,n in zip(paths,names):require(git('show',head+':'+n)==p.read_bytes(),'Raw committed bytes differ')
git('push','origin','audit/release-eb6de2e8');require(git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head,'Published writer differs')
print(json.dumps({'audit':head,'sourceReviewId':review['id'],'all44BindingsVerified':True,'rawOidShaVerifiedBlobs':len(paths),'cacheOperations':0}))
