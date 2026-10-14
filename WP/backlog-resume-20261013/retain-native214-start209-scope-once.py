"""Retain actual native214 delivery and start209; post its concrete data-model boundary once."""
import datetime, hashlib, json, subprocess, sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf8')
root=Path(__file__).resolve().parents[2]; wp=Path(__file__).parent
native=wp/'issue214-post-probe-native-final-handoff'
dest=wp/'issue209-current-source-scope-boundary'
assert not dest.exists(), 'Never replay this boundary or its remote question.'
assert native.is_dir() and (native/'actual-native-handoff.txt').is_file()
assert not (native/'native-delivery-record.json').exists()
def command(*args): return subprocess.run(args,cwd=root,capture_output=True,check=True).stdout
def git(*args): return command('git',*args)
def gh(path): return command('gh','api',path)
assert git('branch','--show-current').strip()==b'audit/release-eb6de2e8'
assert not git('diff','--cached','--name-only').strip()
audit=git('rev-parse','HEAD').decode().strip()
assert audit=='c3c6ead07dd0653d674a8a00aa57de419f2a5c44'
assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==audit
head='5e0b32830f961b3236c7cf8f74cf8f676e98fbaa'
delivery=json.loads((wp/'issue214-policy-post-probe-exact-head-audit-request/delivery-record.json').read_bytes())
assert delivery['comment']==6163082548 and delivery['readyNoticeSentOnce'] and delivery['head']==head
nativeText=(native/'actual-native-handoff.txt').read_text(encoding='utf8')
assert head in nativeText and '6163082548' in nativeText and '5566 passed' in nativeText
record={'recordedUtc':datetime.datetime.now(datetime.UTC).isoformat(),
 'observationNoLaterThanUtc':'2026-10-14T07:21:40Z','exactCaptureTimeAvailable':False,
 'app':'Claude_pzs8sxrjxfjjc!Claude','returnedWindowId':5311708,
 'project':'LIMS Audit','thread':'Lab workflow audit and plan',
 'minimizedWindowRecoveries':1,'freshProjectSelectionCompletedAfterUserInputRefresh':True,
 'rightComposerInitiallyEmpty':True,'rightFocusAndCaretObservedBeforeTyping':True,
 'draftBeginningAndEndingInspected':True,'returnSubmissions':1,
 'sentBubbleObservedWithExactHeadAndTotals':True,'rightComposerEmptyAfterSubmission':True,
 'claudioActivityObserved':'Cogitating','centreHumanDraftPreserved':True,
 'humanCardsAnswered':False,'finalNativeHandoffSentOnce':True,
 'head':head,'githubAuditComment':6163082548,'actualFinalAuditPass':False,
 'productionConnections':0,'productionOperations':0,
 'actualTextSha256':hashlib.sha256((native/'actual-native-handoff.txt').read_bytes()).hexdigest()}
(native/'native-delivery-record.json').write_bytes((json.dumps(record,indent=2)+'\n').encode())
dest.mkdir()
raw={'issue209-original.json':gh('repos/yigini/soilfer-lims/issues/209'),
 'comments209-original.json':command('gh','api','--paginate','--slurp','repos/yigini/soilfer-lims/issues/209/comments?per_page=100'),
 'dependency178-original.json':gh('repos/yigini/soilfer-lims/issues/178'),
 'pr296-original.json':gh('repos/yigini/soilfer-lims/pulls/296'),
 'main-original.json':gh('repos/yigini/soilfer-lims/git/ref/heads/main')}
assert json.loads(raw['issue209-original.json'])['state']=='open'
assert json.loads(raw['dependency178-original.json'])['state']=='closed'
comments=[c for page in json.loads(raw['comments209-original.json']) for c in page]
assert comments==[], 'Read actual new209 direction before proposing this boundary.'
assert json.loads(raw['pr296-original.json'])['head']['sha']==head
assert json.loads(raw['main-original.json'])['object']['sha']=='6d750914d8565acdd496767a7dd935811b5a89b2'
sourcePaths=['server/services/sampleAnalysisStateService.js','server/services/intakeWorkItemService.js',
 'server/services/workAttemptWriteService.js','server/services/workRepeatService.js',
 'server/services/scientificAmendmentService.js','server/services/resultEvidenceService.js',
 'server/services/analysisCodesService.js','server/prisma/schema.prisma',
 'server/prisma/migrations/20261008000100_work_attempt_contract/migration.sql']
sourcePins={}
for path in sourcePaths:
 actual=git('show',head+':'+path)
 assert (root/path).read_bytes().replace(b'\r\n',b'\n')==actual.replace(b'\r\n',b'\n'),path
 name=path.replace('/','__')+'.txt'; raw[name]=actual
 sourcePins[path]={'bytes':len(actual),'sha256':hashlib.sha256(actual).hexdigest()}
assert b'if (!isOrder) await tx.sampleOrderRevision.updateMany' in raw['server__services__sampleAnalysisStateService.js.txt']
assert 'workItemId' not in raw['server__prisma__schema.prisma.txt'].decode().split('model OrderLine {',1)[1].split('\n}',1)[0]
for name,data in raw.items(): (dest/name).write_bytes(data)
question='''@claude #209 current-source data-model boundary before schema/history changes

I have started #209 in the same audit writer after posting the green-CI exact-head #214 request6163082548 on PR296/head5e0b3283. Dependency #178 is closed. Current209 has no later scope comments. Source inspection confirms `sampleAnalysisStateService.reviseAnalyses` only supersedes ACTIVE revisions outside order mode; both routes already enter that transaction, but order mode leaves prior ACTIVE rows. `OrderLine` has no workItemId, and the three live new-attempt writers (first execution, repeat reservation, scientific amendment reservation) omit orderLineId. Existing #190/#191 identity guards prohibit changing orderLineId on a retained attempt, including an already reserved OPEN attempt. Approved/archived/disposed sample edits already refuse409 AMENDMENT_WORKFLOW_REQUIRED; I will preserve the authorised amendment boundary.

The concrete implementation will centralise both edit routes and initial order generation in one orderService, require a deliberate reason on changed orders, normalise analysis codes before comparison/reconciliation, freeze new order-line method/work-item identity, hash idempotency parameters, and atomically write sample/reconciliation/revision/audits. Existing result, attempt, report and audit rows will remain unchanged.

Please decide two historical boundaries rather than having me infer data-model changes:

1. **Existing multiple ACTIVE revisions.** Proposed installer preserves every historical row, without a cleanup/backfill. On the next explicit, reasoned order command, its transaction supersedes all prior ACTIVE revisions, retains their lines and values, audits their IDs, and creates one new ACTIVE revision. SQL insert/activation guards prevent creating another ACTIVE row while any ACTIVE row exists; existing ambiguity remains visible until that deliberate command. Is this acceptable, or should the command refuse ORDER_REVISION_REPAIR_REQUIRED until a separately audited historical repair? I will not silently choose the latest revision or rewrite history during installation.

2. **Existing null order/attempt links.** Proposed additive OrderLine.workItemId is nullable on retained rows, written only on new lines; all newly created attempts receive one unambiguous linked active order line at INSERT, including repeat and scientific-amendment reservations. Retained attempts keep their original orderLineId unchanged. A legacy work item without an unambiguous linked line refuses a new execution/reservation with409 ORDER_LINE_REQUIRED until an explicit reasoned order revision creates its links. An already reserved historical OPEN attempt would continue its existing permitted first fill with its original null identity, rather than be relinked. Confirm this boundary, particularly the historical OPEN first-fill treatment, or specify the forward-only transition you require.

No209 application/schema/data changes have been made at this boundary. I can continue independent request-validation and test planning while these choices are pending. No production connection/collection/mutation; #103 still has no apply go. #214 still requires your actual final audit PASS on its exact head before any merge.
'''
(dest/'questions.md').write_bytes(question.encode())
request=dest/'comment-request.json';request.write_bytes((json.dumps({'body':question},indent=2)+'\n').encode())
(dest/'mutation-started.json').write_bytes((json.dumps({'startedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'action':'ONE POST209 data-model questions','neverRetry':True})+'\n').encode())
response=subprocess.run(['gh','api','repos/yigini/soilfer-lims/issues/209/comments','--method','POST','--input',str(request)],cwd=root,capture_output=True)
(dest/'comment-response-original.json').write_bytes(response.stdout)
(dest/'comment-response-stderr.txt').write_bytes(response.stderr)
assert response.returncode==0,'Inspect uncertain outcome; never replay.'
posted=json.loads(response.stdout);assert posted['body']==question
fresh=gh('repos/yigini/soilfer-lims/issues/comments/'+str(posted['id']))
(dest/'actual-posted-comment-original.json').write_bytes(fresh)
assert json.loads(fresh)['body']==question
scope={'startedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'status':'STARTED_CURRENT_SOURCE_INSPECTED_DATA_MODEL_DIRECTION_PENDING',
 'issue':209,'preceding214AuditRequest':6163082548,'preceding214Head':head,
 'commentId':posted['id'],'commentUrl':posted['html_url'],'commentCreatedUtc':posted['created_at'],
 'sourcePins':sourcePins,'applicationChanges':0,'historicalDataChanges':0,'productionOperations':0,
 'nextIndependentWork':'Request validation, current-source test planning; defer schema/history choices until actual Claudio answer'}
(dest/'scope-record.json').write_bytes((json.dumps(scope,indent=2)+'\n').encode())
pins={}
for folder in [native,dest]:
 for p in folder.iterdir():
  if p.is_file():pins[p.relative_to(root).as_posix()]={'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
(dest/'index.json').write_bytes((json.dumps(pins,indent=2)+'\n').encode())
lead=f'''## 2026-10-14 #214 native final handoff COMPLETE; #209 STARTED

PR296 current5e0b/tree f215/base6d has actual closed CI38524553288 SUCCESS366/5566/all realDocker/policy snapshot preservation proof retained6c245074. ONE readylabel/exact-head comment6163082548 retainedc3c6ead0. Native finalhandoff deliveredONCE and visuallyverified no laterthan07:21:40UTC afterfreshreturnedClaude5311708/rightEMPTY/focus/drafthead+end/oneReturn/sentbubble/emptyright/ClCogitating. Centre HUMAN DRAFT preserved; no human card answer. Exactactualtext/native record at issue214-post-probe-native-final-handoff. Never duplicate/replay either handoff or consumed CI/request helpers. Actual final Claudio exacthead audit PASS still required before merge; no merge/kit/gate/production operation.

Per user direction #209 STARTED afteractual214request: fullcurrent209/no priorcomments/dependency178closed/current source inspected. Actual ordermode leaves multipleACTIVE; OrderLine lacksworkItemId/newattemptwriters omitorderLineId; approvedamendmentguard alreadyexists. Concrete historical boundaries posted ONCE at {posted['id']} ({posted['html_url']}): explicitnextreasonedrevision supersedespriorACTIVEs versus separate repair, and futureinsert-onlylinks/legacyOPENfirstfill withoutimmutableidentityrewrite. AwaitactualCl answer before209 schema/history implementation; independent requestvalidation/testplanning canproceed. Fullsource/API/rawquestion/hashes at issue209-current-source-scope-boundary/index.json. No209applicationchange/productionconnection/collection/mutation at this boundary. Samewriter/nochat-worker-worktree/humancontent/103noapply/owner6160619940 no normalization/kitreadonlyPRESENTorSTOP/snapshotdisk/science/historyguards hold.

'''
readmes=['WP/audit-release-eb6de2e8/README.md','WP/runtime-recovery-kobo/README.md']
for path in readmes:
 p=root/path;p.write_bytes(lead.encode()+p.read_bytes())
owned=list(pins)+[(dest/'index.json').relative_to(root).as_posix(),Path(__file__).relative_to(root).as_posix()]+readmes
git('add','-f','--',*owned)
assert set(git('diff','--cached','--name-only').decode().splitlines())<=set(owned)
for path,pin in pins.items():assert hashlib.sha256(git('show',':'+path)).hexdigest()==pin['sha256'],path
git('commit','-m','audit(214,209): retain final native handoff and start order-revision scope')
retained=git('rev-parse','HEAD').decode().strip()
for path,pin in pins.items():assert hashlib.sha256(git('show',retained+':'+path)).hexdigest()==pin['sha256'],path
git('push','origin','HEAD:refs/heads/audit/release-eb6de2e8')
assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==retained
print(json.dumps({'auditHead':retained,'nativeHandoffSentOnce':True,'issue209Started':True,'scopeComment':posted['id'],'scopeCommentUrl':posted['html_url'],'verifiedBlobs':len(pins)}))
