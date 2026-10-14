"""Retain completed native merge acknowledgement and metadata of the same automatic mainCI; never replay."""
import datetime,hashlib,json,subprocess,sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf8')
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent
dest=wp/'pr296-native-merge-acknowledgement'
assert dest.is_dir() and not (dest/'native-delivery-record.json').exists()
def command(*args):return subprocess.run(args,cwd=root,capture_output=True,check=True).stdout
def git(*args):return command('git',*args)
def read(name,path):
 raw=command('gh','api',path);(dest/name).write_bytes(raw);return json.loads(raw)
assert git('branch','--show-current').strip()==b'audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip()
audit=git('rev-parse','HEAD').decode().strip();assert audit=='c4378a2cc2355bc87e08424fc08502b3067cefb6'
assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==audit
merge='2242bcb4861a7085bb95e78e0e7b1e4edf11d1b8'
text=(dest/'actual-native-acknowledgement.txt').read_text(encoding='utf8')
assert merge in text and '6163178638' in text and '38528593695' in text
pr=read('pr-merged-original.json','repos/yigini/soilfer-lims/pulls/296');assert pr['merged'] and pr['merge_commit_sha']==merge
main=read('main-original.json','repos/yigini/soilfer-lims/git/ref/heads/main');assert main['object']['sha']==merge
run=read('main-ci-original.json','repos/yigini/soilfer-lims/actions/runs/38528593695')
assert run['head_sha']==merge and run['run_attempt']==1 and run['event']=='push'
jobs=read('main-ci-jobs-original.json','repos/yigini/soilfer-lims/actions/runs/38528593695/jobs?per_page=100')
assert len(jobs['jobs'])<=1
record={'recordedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'observationNoLaterThanUtc':'2026-10-14T07:31:14Z',
 'exactCaptureTimeAvailable':False,'returnedWindowId':5311708,'app':'Claude_pzs8sxrjxfjjc!Claude',
 'project':'LIMS Audit','thread':'Lab workflow audit and plan','actualClAuditPassObserved':6163165778,
 'rightComposerInitiallyEmpty':True,'rightComposerFocusedBeforeTyping':True,'beginningAndEndingInspected':True,
 'returnSubmissions':1,'sentBubbleObservedWithMerge':True,'rightComposerEmptyAfterSubmission':True,
 'claudioActivityObserved':'Ferfluffing','centreHumanDraftPreserved':True,'humanCardsAnswered':False,
 'mergeAcknowledgementSentOnce':True,'actualMerge':merge,'mainCi':38528593695,'mainCiStatus':run['status'],
 'mainCiConclusion':run['conclusion'],'mainCiLogsCollected':False,'issue209Started':True,'issue209ScopeComment':6163178638,
 'productionConnections':0,'productionOperations':0,'ciDispatches':0,
 'actualTextSha256':hashlib.sha256((dest/'actual-native-acknowledgement.txt').read_bytes()).hexdigest()}
(dest/'native-delivery-record.json').write_bytes((json.dumps(record,indent=2)+'\n').encode())
pins={p.relative_to(root).as_posix():{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in dest.iterdir() if p.is_file()}
(dest/'index.json').write_bytes((json.dumps(pins,indent=2)+'\n').encode())
lead=f'''## 2026-10-14 #214 actual merge native acknowledgement COMPLETE; #209 current scope started

Cl6163165778 PASS/PR296 exacthead5e0b mergedONCE as{merge} at07:28:52UTC; actualparents6d+5e/treef215 matchesauditedsource. Pushedverdict5c1dce63/mergec4378a2c immutable. Native MERGE acknowledgement deliveredONCE and visuallyverified no laterthan07:31:14UTC afterfreshreturnedClaude5311708/correctLIMS Audit/Labworkflowthread/rightEMPTY/focus/drafthead+end/oneReturn/sentbubble/emptyright/ClFerfluffing; centre HUMAN DRAFT preserved. Exacttext/record at pr296-native-merge-acknowledgement/index.json. Neverduplicate finalauditrequest, mergeack or merge. ONE automaticmainCI38528593695 attempt1/head2242 actualstatus{run['status']}/{run['conclusion']}; metadataONLY/no closedlogs yet, observeSAMErun/no dispatch-retry-replay. #214+#206 source-merged butundeployed/open, no kit/gate/productionconnection/collection/operation. KitreadonlypolicyPRESENT/NO_OP0 orSTOP+snapshotdisk+actualchartcontext/unstartedunboundLRMcounts+Clkitreview remain required. #209 STARTED/current defects inspected/questions6163178638 postedONCE, actualdata-modeldirection pending; readcurrent209 before schema/historychanges, no209applicationchangeyet. Independentvalidation/testplanning canproceed. Samewriter/humancontent/103noapply/owner no normalization/scientific/historyguards hold.

'''
readmes=['WP/audit-release-eb6de2e8/README.md','WP/runtime-recovery-kobo/README.md']
for path in readmes:
 f=root/path;f.write_bytes(lead.encode()+f.read_bytes())
owned=list(pins)+[(dest/'index.json').relative_to(root).as_posix(),Path(__file__).relative_to(root).as_posix()]+readmes
git('add','-f','--',*owned);assert set(git('diff','--cached','--name-only').decode().splitlines())<=set(owned)
for path,pin in pins.items():assert hashlib.sha256(git('show',':'+path)).hexdigest()==pin['sha256'],path
git('commit','-m','audit(214): retain actual native merge acknowledgement and main CI boundary')
retained=git('rev-parse','HEAD').decode().strip()
for path,pin in pins.items():assert hashlib.sha256(git('show',retained+':'+path)).hexdigest()==pin['sha256'],path
git('push','origin','HEAD:refs/heads/audit/release-eb6de2e8')
assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==retained
print(json.dumps({'auditHead':retained,'nativeMergeAckSentOnce':True,'mainCi':38528593695,'mainCiStatus':run['status'],'mainCiConclusion':run['conclusion'],'verifiedBlobs':len(pins)}))
