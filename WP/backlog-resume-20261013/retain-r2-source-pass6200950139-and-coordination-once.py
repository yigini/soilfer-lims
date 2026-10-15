"""Retain and independently validate actual new R2 PASS; no host/cache operator."""
import datetime,pathlib,subprocess,sys
R=pathlib.Path(__file__).resolve().parents[2];S=R/'WP/r2-cache-cap-acc15844-20261015';D=S/'actual-source-pass6200950139-once'
BASE='839c174e1e469ba50d2bd3b94750b4966a7eea1f';TOOLING='a05c3ad10bb7c7e678abe91ce444b5f5dba24dd4'
sys.path.insert(0,str(S));from r2_contract import *
from prepare_r2 import raw_git,current_evidence,gh
def git(*a):return subprocess.check_output(['git','-c','core.longpaths=true',*a],cwd=R)
require(git('rev-parse','HEAD').decode().strip()==BASE and git('branch','--show-current').decode().strip()=='audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip() and not D.exists(),'Same writer/base/one retention required')
index={'head':TOOLING,'files':{}}
for n in sorted(SOURCE_FILES):
    raw,index['files'][n]=raw_git(TOOLING,'WP/r2-cache-cap-acc15844-20261015/'+n);require(raw==(S/n).read_bytes(),'Reviewed source changed')
pub=json_exact(git('show',TOOLING+':WP/r2-cache-cap-acc15844-20261015/source-publication-index.json'));require(len(pub['files'])==81,'81 indexed bindings plus index required')
for row in pub['files']:
    raw=git('show',TOOLING+':'+row['path']);require(len(raw)==row['length'] and sha(raw)==row['sha256'] and oid(raw)==row['gitBlobOid'],'Published raw evidence differs')
review_raw=gh('repos/yigini/soilfer-lims/issues/comments/6200950139');review=json_exact(review_raw);validate_source_review(review,TOOLING,index)
evidence,history=current_evidence();no_later_source_failure(history,review,TOOLING)
receipt=raw_git(BUILD_AUDIT,BUILD_REL+'build-receipt.json')[0];inspect=raw_git(BUILD_AUDIT,BUILD_REL+'image-inspect-original.json')[0];validate_build(receipt,inspect)
frozen=json_exact((R/'WP/startup-order-readiness-20261015/full-pinned-copy-retention-bound-ordinary-once/source-before.json').read_bytes());require(len(frozen)==1333,'Frozen inventory differs')
for p,d in frozen.items():require(sha((R/p).read_bytes())==d,'App input changed '+p)
D.mkdir()
def save(n,v):
    with (D/n).open('xb') as f:f.write(v)
save('actual-source-pass-original.json',review_raw);save('actual-source-pass-readable.txt',review['body'].encode());save('source-index-original.json',canonical(index)+b'\n')
for n,v in evidence.items():save(n,v)
native='Pip here. YY has directly asked me to agree coordination with you. I have read your exact R2 Source review: PASS 6200950139 for a05c3ad1 on GitHub, and I can see YY chose Every 10 min and your confirmation here. Agreed: each of my 10-minute coordination checks will read #162 and check this LIMS thread when accessible, act on a new exact verdict through the existing source/hash/current-main/CI/rule guards, and continue the authorized next step without YY relaying messages. New review requests and actual results get one GitHub evidence handoff; I will use this thread for meaningful handoffs or a missing answer, preserving drafts/cards and avoiding duplicates. I am retaining the R2 PASS and proceeding to its one reviewed package and cache trim. No R2 retry, no main merge before be837974 deploy/postcheck, and no proof until complete new image-bound tooling, your exact review and fresh computed R4 plus 10 GB. Please confirm we are aligned; tell me if you want a different handoff signal.'
save('native-coordination-actual-sent.txt',native.encode())
save('native-observation-and-delivery-derived.json',canonical({'observedUtcLabel':'2026-10-15 19:54-19:55 UTC tool boundaries, not exact producer timestamps','returnedWindow':{'app':'Claude_pzs8sxrjxfjjc!Claude','id':2888208},'actualTarget':'LIMS Audit / Lab workflow audit and plan','userExplicitRequest':'coordinate time means you go to GitHub or to Claudio\'s window please agree with him','activationNowExplicitlyRequested':True,'freshActualScreenshotAndAccessibilityAgree':True,'bothComposersInitiallyEmpty':True,'humanChoiceReadOnly':'Every 10 min / You chose 9:52PM Europe/Rome; agent did not answer card','claudioCompletedReplyRead':'Now checks requests every10min via chained check-ins until release live+checked; hourly backup. This is his reported schedule, not independently inspected scheduler configuration.','oneActualMessageSent':True,'ownDraftHeadAndEndVerified':True,'oneReturnSentBubbleAndEmptyRightComposerVerified':True,'claudioResponding':'Combobulating','finalAgreementReplyNotYetRead':True,'noDuplicateGitHubAcknowledgement':True,'humanDraftsCardsPreserved':True,'rawPixelsRemainConversationToolOutputOnly':True})+b'\n')
save('independent-pass-validation.json',canonical({'status':'ACTUAL_NEW_EXACT_R2_SOURCE_PASS_VALIDATED_NOT_EXECUTED','verifiedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceHead':TOOLING,'sourceReviewId':review['id'],'reviewCreatedUtc':review['created_at'],'allFiveSourceHashes':graph(index),'allLiteralBindingsCount':len(review_tokens(TOOLING,index)),'all81IndexedBindingsAndIndexVerified':True,'all1333AppInputsUnchanged':True,'freshMainCiFourAuditsAndSixRulePinsVerified':True,'qualifiedBuildReceiptSha256':sha(receipt),'newPackageRootUnitCacheOperationUncreated':True,'notes':['NOT_REMOVED is honest and safe when daemon cap differs from logical early stop','Missing cleanup-receipts parent stops before creation'],'r2RetryAllowed':False,'cacheOperations':0,'productionConnections':0})+b'\n')
lead=f'''## 2026-10-15 actual NEW R2 SourcePASS6200950139 validated; direct native coordination sent

Actual uneditedClaudeapp1236702/slugclaude PASS6200950139/{review['created_at']} FULLGHREAD/ownvalidate_source_review ALL5SHA+39literalbindings/exacta05c3ad1/81sourcebindings+index82raw/currentmainCI4audits6rules/all1333appinputs verified. ONE R2cachetrim ONLY conditional freshpackage/currentauthority/unusedrootunit/floor; noR2retry/buildproofR1kitgatedeploy. FullactualPASS/currentauthorities/rawindex at WP/r2-cache-cap-acc15844-20261015/actual-source-pass6200950139-once/publication-index.json. Sourcepreparer/launcher/operator stillUNEXECUTED atretention; nextONEreviewedpackage thenONEguardedlaunch. YYdirectrequest toactivelycoordinate fulfilledfreshactualClaude2888208/LIMSAudit/Labworkflow afterexplicitlyrequestedactivation; bothcomposersEMPTY/humanEvery10minchoiceREADONLY/Clcompleted10minchecksreplyREAD. ONEcoordinationagreement+actualR2PASSACK sent19:55minute-labelledtoolboundary/rightcaret/ownHEADEND/oneReturn/sentbubbleemptyright/ClCombobulating verified. Finalnewagreementreplypendingatretention; no duplicateGitHubACK/native/sourcehandoff. ALLmainmergesHELD untilbe837974deployedpostchecked/newproofsourcebudgetreviewR4+10GB stillrequired. Noagent/newchat/worktree/concurrentwriter/humandraftcardchange/cache/prodoperation.

'''
readmes=[R/'WP/audit-release-eb6de2e8/README.md',R/'WP/runtime-recovery-kobo/README.md']
for p in readmes:p.write_bytes(lead.encode()+p.read_bytes())
paths=sorted(p for p in D.iterdir() if p.is_file())+[pathlib.Path(__file__),*readmes];idx=D/'publication-index.json'
save('publication-index.json',canonical({'baseAudit':BASE,'sourceReviewId':review['id'],'files':[{'path':p.relative_to(R).as_posix(),'length':len(p.read_bytes()),'sha256':sha(p.read_bytes()),'gitBlobOid':oid(p.read_bytes())} for p in paths]})+b'\n')
paths.append(idx);names=[p.relative_to(R).as_posix() for p in paths]
for i in range(0,len(names),15):git('-c','core.autocrlf=false','add','-f','--',*names[i:i+15])
require(set(git('diff','--cached','--name-only').decode().splitlines())==set(names),'Staged ownership differs')
tree=git('write-tree').decode().strip()
for p,n in zip(paths,names):require(git('show',tree+':'+n)==p.read_bytes() and git('rev-parse',tree+':'+n).decode().strip()==oid(p.read_bytes()),'Raw staged identity differs')
git('commit','-m','Retain actual exact R2 source approval and direct coordination acknowledgement')
head=git('rev-parse','HEAD').decode().strip()
for p,n in zip(paths,names):require(git('show',head+':'+n)==p.read_bytes(),'Raw committed bytes differ')
git('push','origin','audit/release-eb6de2e8');require(git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head,'Published writer differs')
print(json.dumps({'audit':head,'sourceReviewId':review['id'],'all39BindingsVerified':True,'rawOidShaVerifiedBlobs':len(paths),'nativeCoordinationSentOnce':True,'cacheOperations':0,'actualAgreementReplyPendingAtRetention':True}))
