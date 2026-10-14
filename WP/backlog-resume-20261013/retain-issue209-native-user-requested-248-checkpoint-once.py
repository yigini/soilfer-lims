"""Retain actual once-sent update and fresh auditor caution; no UI or production operation."""
import datetime,hashlib,json,subprocess,sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf8')
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent;dest=wp/'issue209-native-user-requested-248-checkpoint'
assert not (dest/'native-delivery-record.json').exists() and not (dest/'index.json').exists()
actual=(dest/'native-actual-sent.txt').read_text(encoding='utf8')
reply=(dest/'claudio-reply-transcription.txt').read_text(encoding='utf8')
assert actual.startswith('Pip here. YY asked me to check in') and '248/248' in actual and '74376ec4' in actual
assert 'No #209 PR or final audit request yet.' in actual and 'runtime gap' in reply and 'both groups' in reply
record={'recordedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'deliveryObservedNoLaterThanUtc':'2026-10-14T11:32:39Z',
 'replyObservedNoLaterThanUtc':'2026-10-14T11:34:02Z','exactCaptureTimeAvailable':False,
 'window':{'id':5311708,'app':'Claude_pzs8sxrjxfjjc!Claude','project':'LIMS Audit','thread':'Lab workflow audit and plan'},
 'oneMinimizedWindowRecovery':True,'freshActualWindowTarget':True,'rightComposerInitiallyEmpty':True,'focusCaretObservedBeforeTyping':True,
 'draftHeadAndEndInspected':True,'returnKeyCount':1,'actualSentBubbleVerified':True,'rightComposerEmptyAfter':True,'claudioStateAtSend':'Cogitating',
 'centreHumanDraft':'can you go and ask Pip','humanDraftPreserved':True,'cardsAnswered':False,
 'progressCheckpoint':True,'finalAuditRequest':False,'fullServerPassClaimed':False,'productionOperations':0,
 'replyAuthority':'Visual transcription of the actual current auditor reply; not a native API export or final audit PASS',
 'newReviewRequirement':'Before fixture corrections classify each failing context against released production creation paths; report reachable runtime gaps and distinct readonly impact causes; list runtime gaps and fixture-only contexts in the audit request'}
(dest/'native-delivery-record.json').write_bytes((json.dumps(record,indent=2)+'\n').encode())
pins={p.relative_to(root).as_posix():{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in dest.iterdir() if p.is_file()}
(dest/'index.json').write_bytes((json.dumps({'record':record,'rawFiles':pins},indent=2)+'\n').encode())
lead='''## 2026-10-14 #209 user-requested Claudio check complete; new runtime-versus-fixture review requirement

FreshactualClaude5311708/LIMS Audit/Labworkflowaudit afterONEminimized recovery/rightEMPTY/centreHUMANDRAFT "can you go and ask Pip" preserved. ActualClpreviousstatussaidnothingwaitingonYY butfractionfixpending; corrected248/248+fullRUNNING progressupdate SENTONCE/visuallyverified no laterthan11:32:39UTC/focuscaret/draftheadend/oneReturn/sentbubbleemptyright/Cogitating. Neverduplicate thischeckpoint. FreshactualClreply read no laterthan11:34:02UTC: fraction248/248 ontrack/leavefullrununtouched; BEFOREaddingordercontexts tofailures inspectEACHagainstrealproductioncreationpaths. Ifreachablewithmissingrevision/matchingline, runtimegap notfixture-only: reporthere/countdistinctreadonlyimpactcause/YY list beforegate. Ifunreachable, explicitfixtureordercontext isfine. ListBOTHgroups in auditrequest. Reply isnotfinal209PASS. Exactsenttext/replyvisualtranscription/record at issue209-native-user-requested-248-checkpoint/index.json. Originalscope6163271808 allowslegacyexactsinglematchotherwise409/zero writes+reasonedrevisionremedy; no automaticbackfill/relink/broadenedfallback. Source-readmain2242 confirmsnormalintakealreadycreatesinitialrevision+legacyNULLmatchinglines; classifyhistorical/alternativewriters separately afteractualfullclosure, do notassumeallfailuresfixture-only. SAMEfull64340 remainsactive1310frozeninputs/370expected5630; activeoldfixture failures/no finaltotals/retainclosedhonestlyfirst. No applicationchanges/fullPASS/209PR/ready/finalaudit/merge/kit/gate/productionoperation. Samewriter/humancontent/103noapply/214+206sourcegreenundeployed/allhistoryguards hold.

'''
readmes=['WP/audit-release-eb6de2e8/README.md','WP/runtime-recovery-kobo/README.md']
for name in readmes:
 f=root/name;f.write_bytes(lead.encode()+f.read_bytes())
owned=list(pins)+[(dest/'index.json').relative_to(root).as_posix(),Path(__file__).relative_to(root).as_posix()]+readmes
def git(*args):return subprocess.run(['git',*args],cwd=root,capture_output=True,check=True).stdout
assert git('branch','--show-current').strip()==b'audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip()
git('add','-f','--',*owned);assert set(git('diff','--cached','--name-only').decode().splitlines())<=set(owned)
for name,pin in pins.items():assert hashlib.sha256(git('show',':'+name)).hexdigest()==pin['sha256'],name
git('commit','-m','audit(209): retain user-requested Claudio check and compatibility caution')
retained=git('rev-parse','HEAD').decode().strip()
for name,pin in pins.items():assert hashlib.sha256(git('show',retained+':'+name)).hexdigest()==pin['sha256'],name
git('push','origin','HEAD:refs/heads/audit/release-eb6de2e8')
assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==retained
print(json.dumps({'auditHead':retained,'rawBlobsVerified':len(pins),'nativeCheckpointSentOnce':True,'actualAuditorReplyRetained':True,'finalAuditRequest':False,'productionOperations':0}))
