"""Retain full actual accepted refusal/count boundary and the once-sent native handoff."""
import datetime,hashlib,json,subprocess,sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf8')
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent;dest=wp/'issue209-approved-orphan-decisions-6167740581'
assert (dest/'native-handoff-actual-text.txt').exists() and not (dest/'index.json').exists()
def command(*args):return subprocess.run(args,cwd=root,capture_output=True,check=True).stdout
def git(*args):return command('git',*args)
assert git('branch','--show-current').strip()==b'audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip()
prior=git('rev-parse','HEAD').decode().strip();assert prior=='bcb3e0c935e8df5a6f1f5e622959449f63046fe3'
assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==prior
raw={name:command('gh','api',path) for name,path in [
 ('answer-original.json','repos/yigini/soilfer-lims/issues/comments/6167740581'),
 ('question-original.json','repos/yigini/soilfer-lims/issues/comments/6167703632'),
 ('issue209-original.json','repos/yigini/soilfer-lims/issues/209'),
 ('main-original.json','repos/yigini/soilfer-lims/git/ref/heads/main')]}
answer=json.loads(raw['answer-original.json'])
assert answer['id']==6167740581 and answer['created_at']==answer['updated_at']=='2026-10-14T11:54:20Z'
assert answer['performed_via_github_app']['slug']=='claude' and 'answering 6167703632' in answer['body']
for required in ['Do not add an order step','No new orphans','prospective approved-amendment refusals','STOP for that list','fixture-only gaps']:
 assert required in answer['body'],required
assert json.loads(raw['main-original.json'])['object']['sha']=='2242bcb4861a7085bb95e78e0e7b1e4edf11d1b8'
for name,data in raw.items():(dest/name).write_bytes(data)
(dest/'answer-original.md').write_bytes(answer['body'].encode())
record={'recordedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'status':'ACTUAL_APPROVED_ORPHAN_SCOPE_ACCEPTED_BEFORE_IMPLEMENTATION',
 'comment':6167740581,'question':6167703632,'commentUrl':answer['html_url'],'createdUtc':answer['created_at'],
 'nativeHandoff':{'deliveryObservedNoLaterThanUtc':'2026-10-14T11:54:20Z','replyObservedNoLaterThanUtc':'2026-10-14T11:54:53Z',
  'exactCaptureTimeAvailable':False,'window':{'id':5311708,'app':'Claude_pzs8sxrjxfjjc!Claude','project':'LIMS Audit','thread':'Lab workflow audit and plan'},
  'oneVisibleProjectSelection':True,'freshDelayedAuditStateVerified':True,'rightComposerInitiallyEmpty':True,'focusCaretBeforeTyping':True,
  'draftHeadAndEndInspected':True,'returnKeyCount':1,'actualSentBubbleVerified':True,'rightComposerEmptyAfter':True,'claudioStateAtSend':'Hatching',
  'centreHumanDraft':'can you go and ask Pip','humanDraftPreserved':True,'cardsAnswered':False,'sentOnce':True,'finalAuditRequest':False},
 'newAmendmentOrderStepAuthorized':False,'runtimeGuardRelaxation':False,'actualProductionCountsCollected':False,
 'approvedAmendmentNonzeroListRequiresStop':True,'newIntakeRollbackTestRequired':True,'sourceAndFixtureChangesAtRetention':0,'productionOperations':0}
(dest/'decision-and-native-record.json').write_bytes((json.dumps(record,indent=2)+'\n').encode())
pins={p.relative_to(root).as_posix():{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in dest.iterdir() if p.is_file()}
(dest/'index.json').write_bytes((json.dumps({'record':record,'rawFiles':pins},indent=2)+'\n').encode())
lead='''## 2026-10-14 #209 actual approved-orphan decision6167740581: keep refusal, count, STOP if approved list nonzero

ActualClFULLanswer6167740581 at11:54:20UTC answers ONCE6167703632; retained issue209-approved-orphan-decisions-6167740581. RuntimeUNCHANGED/zero-write no-usable-line INSERT refusal; approvededit409 andscientificpreflightbeforePROCESSING held. NO amendment-sideorderstep/backfill/relink/widerfallback in209. Addrealcurrentintakeinitialorder/linefailure test provingALLnewWIs/orders/lines/auditsrollback inSAME TX; fixcurrentnew-orphan bugifany. Kitreadonlyseparatelists+sampleIDs: noACTIVE, ACTIVEnomatchingline, ambiguous/multipleACTIVE/fractionowners, continuingOPENseparate, prospectiveapproved-amendmentrefusals forAPPROVED/REPORTED/othernoneditable samples withanyunresolvableWI. OpenlistsnonzeroYYseeslist/reasonedrevisionremedy; approvedlistZEROrecordthenproceed, NONZERO STOP/showYY/Clopensseparate reviewedforwardfixissue. Noactualproductioncountsnow. Auditlistsruntime-reachablevsfixture-only; onlycurrentintake-equivalentfixturecontexts/noassertionchange. Nativenewquestionhandoff SENTONCE/freshreturned5311708/ONEauditselection/delayedtarget/rightEMPTY/focus/draftheadend/Return/sentbubbleemptyright/Hatching verified no laterthan11:54:20UTC; replyreadno laterthan11:54:53. CentreHumanDraft preserved/neverduplicatehandoff/question. Full650failure originals20blobsdaca/all1309core+57appunchanged/derivedhelpmanifestprovenance honest. Sourceanalysis9blobsb5e2/questions9blobsbcb3 immutable. No runner/fullPASS/209PR/ready/finalaudit/merge/kit/gate/productionoperation. SAMEwriter/Cloriginal6163271808+fraction6166518424/humancontent/103noapply/214+206sourcegreenundeployed/allhistoricalguards hold.

'''
readmes=['WP/audit-release-eb6de2e8/README.md','WP/runtime-recovery-kobo/README.md']
for path in readmes:
 f=root/path;f.write_bytes(lead.encode()+f.read_bytes())
owned=list(pins)+[(dest/'index.json').relative_to(root).as_posix(),Path(__file__).relative_to(root).as_posix()]+readmes
git('add','-f','--',*owned);assert set(git('diff','--cached','--name-only').decode().splitlines())<=set(owned)
for path,pin in pins.items():assert hashlib.sha256(git('show',':'+path)).hexdigest()==pin['sha256'],path
git('commit','-m','audit(209): retain actual approved orphan refusal and kit stop decision')
retained=git('rev-parse','HEAD').decode().strip()
for path,pin in pins.items():assert hashlib.sha256(git('show',retained+':'+path)).hexdigest()==pin['sha256'],path
git('push','origin','HEAD:refs/heads/audit/release-eb6de2e8')
assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==retained
print(json.dumps({'auditHead':retained,'comment':6167740581,'rawBlobsVerified':len(pins),'actualScopeAccepted':True,'newAmendmentOrderStepAuthorized':False,'productionOperations':0}))
