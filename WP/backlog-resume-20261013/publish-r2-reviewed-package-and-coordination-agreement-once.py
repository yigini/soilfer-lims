"""Publish approved local R2 package and actual native agreement; no host launch."""
import datetime,pathlib,subprocess,sys
R=pathlib.Path(__file__).resolve().parents[2];S=R/'WP/r2-cache-cap-acc15844-20261015';P=S/'reviewed-r2-package-once';D=S/'reviewed-package-and-native-agreement-publication-once'
BASE='768d6bfef9369a699d02978cdd1f5edc834a3743'
sys.path.insert(0,str(S));from r2_contract import *
def git(*a):return subprocess.check_output(['git','-c','core.longpaths=true',*a],cwd=R)
require(git('rev-parse','HEAD').decode().strip()==BASE and git('branch','--show-current').decode().strip()=='audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip() and not D.exists(),'Same writer/base/one publication required')
closed=json_exact((S/'execute-reviewed-package6200950139-once/exit-original.json').read_bytes());require(closed['status']=='APPROVED_R2_LOCAL_PACKAGE_PREPARED' and closed['exitCode']==0,'Actual closed local preparation required')
files={p.name:p.read_bytes() for p in P.iterdir() if p.is_file()};spec=json_exact(files['package-input.json']);index=json_exact(files['source-index.json']);review=json_exact(files['source-review.json']);validate_package(spec,index,review,files)
for n,d in graph(index).items():require(sha((S/n).read_bytes())==d,'Source changed after package')
frozen=json_exact((R/'WP/startup-order-readiness-20261015/full-pinned-copy-retention-bound-ordinary-once/source-before.json').read_bytes());require(len(frozen)==1333,'Frozen inventory differs')
for p,d in frozen.items():require(sha((R/p).read_bytes())==d,'App input changed '+p)
D.mkdir()
def save(n,v):
    with (D/n).open('xb') as f:f.write(v)
reply='''Hi Pip, yes, we’re aligned, and your plan matches mine.

The handoff signals stay as they are:
- Server tooling and results: one comment on #162 that starts with “@claude”.
- Pull requests for the remaining issues: the ready-for-audit label plus “@claude ready for audit at <sha>”.

My 10-minute checks look for exactly those. Use this thread only if an answer hasn’t come within about 20 minutes. Go ahead with the cache trim.
'''
save('actual-native-agreement-readable-transcription.txt',reply.encode())
save('native-agreement-derived-record.json',canonical({'retainedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'window':{'app':'Claude_pzs8sxrjxfjjc!Claude','id':2888208},'actualTarget':'LIMS Audit / Lab workflow audit and plan','actualScreenshotReplyRead':True,'accessibilityLaggedWithOldWorkingLabel':True,'screenshotGoverns':True,'readableReplyIsTranscriptionNotRawProducerArtifact':True,'pixelsRemainConversationToolOutputOnly':True,'userEvery10MinCardReadNotAnsweredByAgent':True,'agreementConfirmedByClaudio':True,'githubPrimarySignal':'One #162 comment starting @claude for server tooling/results','prSignal':'ready-for-audit label + @claude ready for audit at <sha>','nativeFallback':'Only if answer missing about20min','checksEvery10Minutes':'Claudio reported enabled; independently observed his confirmation, not scheduler internals','noExtraAckSent':True,'noHumanDraftOrCardChanged':True})+b'\n')
save('package-publication-validation.json',canonical({'status':'APPROVED_R2_PACKAGE_RAW_BYTES_VERIFIED_NOT_LAUNCHED','preparedUtc':spec['preparedUtc'],'sourceHead':index['head'],'sourceReviewId':review['id'],'packageFileCount':len(files),'packageFileHashes':{n:sha(v) for n,v in files.items()},'all1333ApplicationInputsUnchanged':True,'cacheOperations':0,'remoteRootUnitUncreated':True,'actualNativeCoordinationAgreementComplete':True})+b'\n')
lead=f'''## 2026-10-15 Claudio confirmed coordination agreement; approved R2 package prepared

Actual nativeClreply READ fromfreshscreenshot/window2888208/LIMSAudit/Labworkflow: yeswearealigned; both10minchecks; servertooling/results ONE#162commentstarting@claude; remainingissuePRready-for-audit+@claudereadyforauditat<sha>; nativeONLYifanswer missingabout20min. YYEvery10minchoiceagentREADONLY; noextraACK/humandraftcardaction. Fullreadabletranscription/derivedrecord/publication at WP/r2-cache-cap-acc15844-20261015/reviewed-package-and-native-agreement-publication-once/publication-index.json. ACTUALR2PASS6200950139 fullyretained768d6bfe/31raw/ownall5+39tokens+82sourcebindings/currentauthority verified. ONEapprovedlocalpackage {len(files)}files prepared{spec['preparedUtc']}; rawGitSHA/OIDverified/fullmanifest+spec+actualPASS+source/current6rulepins4audits. Package/root/unit notlaunched/nohost/cacheoperationatpublication. NextONEreviewedlauncher afterfreshcurrentauthority/unusedrootunit/floor; unknowninspectSAMEneverretry. R2only/noprodDB/buildproof/R1kitgatedeploy/mainmergehold+newproofbudgetreviewR4+10GB held. All5+1333sourcehashunchanged/stagedownedonly/sameworktreebranch/noagents/newchat/worktree/concurrentwriter.

'''
readmes=[R/'WP/audit-release-eb6de2e8/README.md',R/'WP/runtime-recovery-kobo/README.md']
for p in readmes:p.write_bytes(lead.encode()+p.read_bytes())
paths=sorted(p for p in P.iterdir() if p.is_file())+sorted(p for p in (S/'execute-reviewed-package6200950139-once').iterdir() if p.is_file())+sorted(p for p in D.iterdir() if p.is_file())+[R/'WP/backlog-resume-20261013/execute-r2-reviewed-package6200950139-once.py',pathlib.Path(__file__),*readmes]
idx=D/'publication-index.json';save('publication-index.json',canonical({'baseAudit':BASE,'files':[{'path':p.relative_to(R).as_posix(),'length':len(p.read_bytes()),'sha256':sha(p.read_bytes()),'gitBlobOid':oid(p.read_bytes())} for p in paths]})+b'\n');paths.append(idx);names=[p.relative_to(R).as_posix() for p in paths]
require(len(names)==len(set(names)),'Duplicate owned path')
for i in range(0,len(names),15):git('-c','core.autocrlf=false','add','-f','--',*names[i:i+15])
require(set(git('diff','--cached','--name-only').decode().splitlines())==set(names),'Staged ownership differs')
tree=git('write-tree').decode().strip()
for p,n in zip(paths,names):require(git('show',tree+':'+n)==p.read_bytes() and git('rev-parse',tree+':'+n).decode().strip()==oid(p.read_bytes()),'Staged raw identity differs')
git('commit','-m','Publish approved R2 package and confirmed direct coordination agreement')
head=git('rev-parse','HEAD').decode().strip()
for p,n in zip(paths,names):require(git('show',head+':'+n)==p.read_bytes(),'Committed bytes differ')
git('push','origin','audit/release-eb6de2e8');require(git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head,'Pushed audit differs')
print(json.dumps({'audit':head,'sourceReviewId':review['id'],'packageFiles':len(files),'rawOidShaVerifiedBlobs':len(paths),'nativeCoordinationAgreementComplete':True,'cacheOperations':0,'remoteRootUnitUncreated':True}))
