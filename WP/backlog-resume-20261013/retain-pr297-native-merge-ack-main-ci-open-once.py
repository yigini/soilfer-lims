"""Retain the verified one-time native merge acknowledgement and OPEN main CI."""
import datetime,hashlib,json,subprocess,sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf-8')
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent
dest=wp/'pr297-native-merge-ack-main-ci-open'
merge_head='cde8c8896f5f9d5f1ab07b0ae16b1a765e0a6367'
source_head='6bd516c42a07332d0b0653ed150d1526bf7e424e'
tree='638580d50f61254609de3abd42d93afc676a5727'
base='2242bcb4861a7085bb95e78e0e7b1e4edf11d1b8'
audit_merge='df40c77f3430f2c1f03d6f8e24429825f6668dee'
def command(*args):return subprocess.check_output(args,cwd=root)
def git(*args):return command('git',*args).decode('utf-8').strip()
def blob(revision,path):
    e=command('git','ls-tree','-z',revision,'--',path).split(b'\t',1)[0].split();assert len(e)==3 and e[1]==b'blob'
    return command('git','cat-file','blob',e[2].decode())
assert not dest.exists(),'Consumed acknowledgement checkpoint; never replay.'
assert git('branch','--show-current')=='audit/release-eb6de2e8' and not git('diff','--cached','--name-only')
assert git('rev-parse','HEAD')==audit_merge and git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').split()[0]==audit_merge
raw={}
def retain(name,path):
    d=command('gh','api',path);raw[name]=d;return json.loads(d)
run=retain('main-run-open-original.json','repos/yigini/soilfer-lims/actions/runs/38636615469')
assert run['id']==38636615469 and run['head_sha']==merge_head and run['event']=='push' and run['run_attempt']==1
assert run['status']!='completed' and run['conclusion'] is None,'Already closed; use a new closed boundary.'
jobs=retain('main-jobs-open-original.json','repos/yigini/soilfer-lims/actions/runs/38636615469/jobs?per_page=100')
runs=retain('one-main-head-run-original.json','repos/yigini/soilfer-lims/actions/runs?head_sha='+merge_head+'&event=push&per_page=100')
assert len(runs['workflow_runs'])==1 and runs['workflow_runs'][0]['id']==run['id']
main=retain('main-original.json','repos/yigini/soilfer-lims/git/ref/heads/main');assert main['object']['sha']==merge_head
pr=retain('pr-merged-original.json','repos/yigini/soilfer-lims/pulls/297')
assert pr['merged'] and pr['merge_commit_sha']==merge_head and pr['head']['sha']==source_head
verdict=retain('actual-pass-original.json','repos/yigini/soilfer-lims/issues/comments/6178123314')
assert verdict['body'].startswith('Audit passed: OK to merge and deploy.') and source_head in verdict['body'] and verdict['performed_via_github_app']['slug']=='claude'
issue=retain('issue209-original.json','repos/yigini/soilfer-lims/issues/209');assert issue['state']=='open'
raw['closing-refs-original.json']=command('gh','pr','view','297','--repo','yigini/soilfer-lims','--json','closingIssuesReferences')
assert json.loads(raw['closing-refs-original.json'])['closingIssuesReferences']==[]
text=(wp/'pr297-native-merge-ack-actual-sent.txt').read_bytes()
assert source_head.encode() in text and merge_head.encode() in text and b'38636615469' in text and b'5649/5649' in text
raw['native-actual-sent.txt']=text
prepared=wp/'retain-pr297-main-ci-38636615469-terminal-once.py'
raw['prepared-unused-main-terminal-helper.py']=prepared.read_bytes()
record={'retainedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'status':'MAIN_CI_OPEN_NATIVE_MERGE_ACK_DELIVERED',
    'number':297,'issue':209,'run':38636615469,'attempt':1,'head':merge_head,'sourceHead':source_head,'tree':tree,'base':base,
    'ciStatus':run['status'],'conclusion':None,'runUrl':run['html_url'],'mainCiLogsCollected':False,'ciDispatches':0,
    'sourceMergeEvidenceAudit':audit_merge,'actualAuditCommentId':6178123314,'nativeMergeAcknowledgementDeliveredOnce':True,
    'nativeVerification':{'window':7867734,'app':'Claude_pzs8sxrjxfjjc!Claude','project':'LIMS Audit','thread':'Lab workflow audit and plan',
        'freshWindowTargetAndEmptyRightComposer':True,'focusCaretVerified':True,'ownDraftHeadAndEndInspected':True,
        'singleReturn':True,'actualSentBubbleVisible':True,'rightComposerEmptyAfterSend':True,'claudioDoingVisibleAfterSend':True,
        'centreHumanDraft':'can you go and ask Pip','centreDraftPreserved':True,'humanCardsUntouched':True,
        'actualNewHeadNativePassReadBeforeAcknowledgement':True,'noDuplicateAuditRequest':True},
    'mainTerminalHelperStatus':'PREPARED_UNUSED_REQUIRES_ACTUAL_SAME_RUN_CLOSURE_READ_ORIGINALS_AND_HELPER',
    'productionOperations':0,'productionCountsCollected':False,'kitGateExists':False,'issue209State':'open','closingIssuesReferences':[],
    'files':{n:{'bytes':len(d),'sha256':hashlib.sha256(d).hexdigest()} for n,d in raw.items()}}
dest.mkdir()
for n,d in raw.items():(dest/n).write_bytes(d)
(dest/'index.json').write_bytes((json.dumps(record,indent=2)+'\n').encode())
lead=f'## 2026-10-14 #209 merged; mainCI38636615469 ACTIVE; native acknowledgement ONCE\n\nPR297 actualCl finalPASS6178123314/20:48:25UTC on head{source_head}; actualPR stockCI38629458186 CLOSED SUCCESS370/5649/allinventory/all realDocker/preservation originals401f0721. ONE merge20:58:55UTC created main{merge_head}, auditedtree{tree}, fresh guarded source/body/base/main/checks and parents retaineddf40c77f. ONE automatic main push CI38636615469 attempt1 ACTIVE/null conclusion; observe SAME run, never retry/dispatch/substitute, no active logs capturedasCLOSED. Prepared UNUSED retain-pr297-main-ci-38636615469-terminal-once.py requires actual closure/read originals/helper and exact370/5649/allrealDocker; failure retained honestly. Native actual newheadPASS read, then ONE merge acknowledgement sent/actualbubble+emptyright verified after freshClaude7867734/LIMS Audit/Lab workflow target/emptycomposer/caret/draftHEAD+END/oneReturn, ClDoing; actualtext/OPEN API/helper originals at pr297-native-merge-ack-main-ci-open/index.json. Centre HUMAN DRAFT can you go and ask Pip preserved/cards untouched. Never repeat ready/audit request/PASS/merge/ack. No kit/gate/production counts/operation/103apply;206+214+209source merged undeployedopen. Next exact #206/#214/#209 kit after actualmainCIgreen: policyPRESENTNO_OP0orSTOP, retainedsnapshotdisk, actual214chart/unstarted-unboundLRM,209causes/approved/invalidStoredAnalysisSampleCount+sample/ownerlists, show nonzeroYY/approvednonzeroSTOP/separateClreviewedforwardremedy, Cl exact-kit review then freshsingle-usegate. All historicalroots/receipts/failures/guards immutable; samewriter/worktree/branch.\n\n'
readmes=['WP/audit-release-eb6de2e8/README.md','WP/runtime-recovery-kobo/README.md']
for rel in readmes:p=root/rel;p.write_bytes(lead.encode()+p.read_bytes())
owned=[p.relative_to(root).as_posix() for p in dest.iterdir()]+[Path(__file__).relative_to(root).as_posix(),prepared.relative_to(root).as_posix(),(wp/'pr297-native-merge-ack-actual-sent.txt').relative_to(root).as_posix()]+readmes
pins={p:hashlib.sha256((root/p).read_bytes()).hexdigest() for p in owned}
git('add','-f','--',*owned);assert set(git('diff','--cached','--name-only').splitlines())==set(owned)
git('commit','-m','Retain PR297 native merge acknowledgement and open main CI38636615469')
audit=git('rev-parse','HEAD')
for p,d in pins.items():assert hashlib.sha256(blob(audit,p)).hexdigest()==d,p
git('push','origin','HEAD:refs/heads/audit/release-eb6de2e8');assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').split()[0]==audit
print(json.dumps({'status':record['status'],'audit':audit,'run':run['id'],'head':merge_head,'verifiedBlobs':len(pins),'nativeAcknowledgementOnce':True,'productionOperations':0}))
