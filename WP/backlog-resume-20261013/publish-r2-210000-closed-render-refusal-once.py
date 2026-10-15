"""Retain complete actual remote parse refusal and fresh absence; no replay or cache call."""
import datetime,pathlib,subprocess,sys
R=pathlib.Path(__file__).resolve().parents[2];S=R/'WP/r2-cache-cap-acc15844-20261015';D=S/'first-launch-210000-closed-render-refusal-publication-once';BASE='598bcb3d189d7934e88f4db1d9bcb2cb8c3948ab'
sys.path.insert(0,str(S));from r2_contract import *
def git(*a):return subprocess.check_output(['git','-c','core.longpaths=true',*a],cwd=R)
require(git('rev-parse','HEAD').decode().strip()==BASE and not git('diff','--cached','--name-only').strip() and git('branch','--show-current').decode().strip()=='audit/release-eb6de2e8' and not D.exists(),'Same writer/one retention required')
original=S/'launch-reviewed-r2-once';closed=json_exact((S/'execute-reviewed-launch6200950139-once/exit-original.json').read_bytes());require(closed['exitCode']==1,'Actual launcher failure missing')
raw=(original/'exclusive-root-upload-source.py').read_bytes();err=(original/'exclusive-root-upload-stderr.log').read_bytes()
require((original/'exclusive-root-upload-stdout.json').read_bytes()==b'' and b'SyntaxError: invalid syntax' in err,'Actual remote parser refusal missing')
try:compile(raw,'retained-original-remote-source.py','exec')
except SyntaxError as e:parse={'type':type(e).__name__,'line':e.lineno,'message':e.msg,'sourceLine':e.text}
else:raise RuntimeError('Original generated source unexpectedly compiles')
require(parse['line']==10 and "BUILD_'" in parse['sourceLine'],'Original placeholder collision differs')
absence=json_exact((S/'failed-render-210000-readonly-absence-once/stdout-original.json').read_bytes());require(absence['rootAbsent'] is True and absence['unitNotFound'] is True and absence['cacheCalls']==0,'Fresh absent root/unit proof missing')
record=json_exact((S/'actual-source-pass6200950139-once/independent-pass-validation.json').read_bytes())
for n,h in record['allFiveSourceHashes'].items():require(sha((S/n).read_bytes())==h,'Original reviewed source changed')
D.mkdir()
def save(n,v):
    with (D/n).open('xb') as f:f.write(v)
for n,endpoint in [('main-original.json','git/ref/heads/main'),('main-ci-original.json','actions/runs/38772398721')]:save(n,subprocess.check_output(['gh','api','repos/yigini/soilfer-lims/'+endpoint],cwd=R))
require(json_exact((D/'main-original.json').read_bytes())['object']['sha']==CANDIDATE,'Main moved')
ci=json_exact((D/'main-ci-original.json').read_bytes());require(ci['status']=='completed' and ci['conclusion']=='success' and ci['head_sha']==CANDIDATE,'Main CI differs')
failure={'status':'R2_REMOTE_SOURCE_PARSE_REFUSED_BEFORE_ANY_ROOT_UNIT_OR_CACHE_OPERATION','closedUtc':closed['closedUtc'],'sourceHead':'a05c3ad10bb7c7e678abe91ce444b5f5dba24dd4','sourceReviewId':6200950139,'root':ROOT,'unit':UNIT,'exitCode':1,'remoteStderrSha256':sha(err),'generatedRemoteSourceSha256':sha(raw),'independentRetainedSourceCompileRefusal':parse,'cause':'Sequential str.replace replaced ROOT_VALUE inside BUILD_ROOT_VALUE, leaving invalid BUILD_quotedpath syntax. Remote Python refused entire stdin before executing any statement.','originalReviewedSourceUnchanged':True,'freshAbsenceObservedUtc':absence['observedUtc'],'rootAbsent':True,'unitNotFound':True,'cacheOperations':0,'productionConnections':0,'neverRetryThisGraphRootOrLauncher':True,'requiresNewCorrectedSourceAndReview':True}
save('closed-render-refusal.json',canonical(failure)+b'\n')
save('coordination-status.json',canonical({'actualNativeAgreementPublished':'598bcb3d189d7934e88f4db1d9bcb2cb8c3948ab','githubPrimary':'One#162commentstarting@claude','prSignal':'ready-for-audit+@claudereadyforauditat<sha>','nativeOnlyIfMissingAnswerAbout20min':True,'noNewNativeOrGitHubFailureMessageYet':'Bundle with concrete corrected source request once prepared, avoid duplicate notices','oldPreparedFirstObserver':'observe-r2-cache210000-first-readonly-once.py NEVER EXECUTED; now superseded because root absent'})+b'\n')
lead='''## 2026-10-15 first R2 launch210000 CLOSED remote parser refusal; ZERO cache operations

Actuala05/PASS6200950139/local31filepackage598bcb3d/ONElauncher CLOSED20:00:50.151782UTC exit1. Remote generated Python SyntaxError line10 BEFOREany statement: sequential ROOT_VALUE replacement corrupted BUILD_ROOT_VALUE. Full generated3.58MBsource/stdoutEMPTY/stderr/rawlauncher/currentauthorities/localwrapper retained at WP/r2-cache-cap-acc15844-20261015/first-launch-210000-closed-render-refusal-publication-once/publication-index.json. Independent retained-only compile reproduces SyntaxError. Fresh20:01:57.120085UTC metadataONLY proves210000rootABSENT/unitnot-found/MainPID0/InvocationIDempty; 0cachecalls/0filewrites/prodconnections. No remote upload/root/unit/prune/cleanup occurred. Old5sourcebytesUNCHANGED/oldgraphPASSpackagehelperCONSUMEDneverreplay; R2NOretry. Next genuinelyNEWcorrected-source graph/newroot with collision-safe renderer and tests compiling actual generated remote scripts (missing from prior44), publish/newexactClreview beforeANYnewpackage/root/unit/operator. Bundle failure only with concrete newsource request, no duplicate native/GHACK. Coordinationagreement COMPLETEpublished598bcb3d: activeGH10min/one@claude#162handoff/PRready-for-audit+exactSHA/nativefallbackabout20min. Samewriterbranch/mainbeCIgreen/mainmergeHOLD/allsciencehistoryR1-R5 held; no productionDB/buildproof/kitgatedeploy. Qualified190000acc158cd3a unchanged; futureproofsourcebudgetnewreviewfreshR4+10GB stillrequired.

'''
readmes=[R/'WP/audit-release-eb6de2e8/README.md',R/'WP/runtime-recovery-kobo/README.md']
for p in readmes:p.write_bytes(lead.encode()+p.read_bytes())
paths=sorted(p for p in original.iterdir() if p.is_file())+sorted(p for p in (S/'execute-reviewed-launch6200950139-once').iterdir() if p.is_file())+sorted(p for p in (S/'failed-render-210000-readonly-absence-once').iterdir() if p.is_file())+sorted(p for p in D.iterdir() if p.is_file())+[R/'WP/backlog-resume-20261013/execute-r2-reviewed-launch6200950139-once.py',R/'WP/backlog-resume-20261013/read-r2-210000-render-refusal-absence-once.py',R/'WP/backlog-resume-20261013/observe-r2-cache210000-first-readonly-once.py',pathlib.Path(__file__),*readmes]
idx=D/'publication-index.json';save('publication-index.json',canonical({'baseAudit':BASE,'files':[{'path':p.relative_to(R).as_posix(),'length':len(p.read_bytes()),'sha256':sha(p.read_bytes()),'gitBlobOid':oid(p.read_bytes())} for p in paths]})+b'\n');paths.append(idx);names=[p.relative_to(R).as_posix() for p in paths]
for i in range(0,len(names),15):git('-c','core.autocrlf=false','add','-f','--',*names[i:i+15])
require(set(git('diff','--cached','--name-only').decode().splitlines())==set(names),'Staged owner differs')
tree=git('write-tree').decode().strip()
for p,n in zip(paths,names):require(git('show',tree+':'+n)==p.read_bytes() and git('rev-parse',tree+':'+n).decode().strip()==oid(p.read_bytes()),'Raw staged identity differs')
git('commit','-m','Retain first R2 remote render refusal with zero operations and fresh absent root proof')
head=git('rev-parse','HEAD').decode().strip()
for p,n in zip(paths,names):require(git('show',head+':'+n)==p.read_bytes(),'Committed raw bytes differ')
git('push','origin','audit/release-eb6de2e8');require(git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head,'Pushed writer differs')
print(json.dumps({'audit':head,'rawOidShaVerifiedBlobs':len(paths),'failureSha256':sha((D/'closed-render-refusal.json').read_bytes()),'rootAbsent':True,'unitNotFound':True,'cacheOperations':0}))
