"""Retain fresh native read-only boundary; no UI/message/production operation."""
import datetime,hashlib,json,subprocess
from pathlib import Path
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent
dest=wp/'issue214-corrected-push-native-readonly';assert not dest.exists()
def git(*args):return subprocess.run(['git',*args],cwd=root,capture_output=True,check=True).stdout
assert git('branch','--show-current').strip()==b'audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip()
record={'observedBoundaryUtc':'2026-10-14T05:13:00Z','recordedUtc':datetime.datetime.now(datetime.UTC).isoformat(),
 'returnedApp':'Claude_pzs8sxrjxfjjc!Claude','returnedWindowId':5311708,'returnedTitle':'Claude',
 'actualProject':'LIMS Audit','actualThread':'Lab workflow audit and plan','minimizedRecoveryActivations':1,
 'freshWindowBindingAfterActivation':True,'centreComposerHumanDraftPresent':True,'centreHumanDraftPreserved':True,
 'rightThreadComposerEmpty':True,'newNativeAcceptanceObserved':'Policy-schema fix inside PR296, then actual green CI and audit',
 'nativeMessagesSent':0,'typingClicksNavigation':0,'humanCardsUntouched':True,
 'issue103SeeListAcknowledged':True,'issue103ApplyGo':False,'issue103ProductionConnections':0,
 'correctedPRHead':'8d564c24f05a3b069bf027bbb7ba4f92cea597b0','newAutomaticCI':38515104824,
 'ciStatus':'IN_PROGRESS','finalAuditRequestSent':False,'productionOperations':0,
 'supersedesPriorWindowAndDraftObservation':True,'nativeFinalHandoffNeedsFreshEmptyComposerFocusObservation':True}
dest.mkdir();(dest/'native-readonly-record.json').write_bytes((json.dumps(record,indent=2)+'\n').encode())
lead='''## 2026-10-14 #214 corrected push native READ-ONLY boundary

Fresh returned Claude window5311708/LIMS Audit/Lab workflow audit and plan read after ONE minimized-window activation/rebind. Right actual thread contains accepted same-PR policy scope and next green-CI/audit direction; right composer EMPTY. Centre HUMAN DRAFT present, preserved; no clicking/typing/navigation/message or card answer. This supersedes older window3408874/rightdraftn observations; final native handoff still requires fresh target/focus/EMPTYcomposer at actual greenCI. SourcePR2968d564c24/new automatic CI38515104824 IN_PROGRESS; no final request/PASS/merge/kit/gate/productionoperation. #103 SeeList acknowledgement grants NOAPPLYGO; no productionconnection/collection/mutation. Actual record at `WP/backlog-resume-20261013/issue214-corrected-push-native-readonly/native-readonly-record.json`. Full local366/5565/focused8/218 PASS retained; owner6160619940/no normalization/kitreadonlyPRESENTorSTOP and historical guards hold. Send exact-head request only after actual newgreenCI, then start209.

'''
readmes=['WP/audit-release-eb6de2e8/README.md','WP/runtime-recovery-kobo/README.md']
for p in readmes:
 f=root/p;f.write_bytes(lead.encode()+f.read_bytes())
owned=readmes+[Path(__file__).relative_to(root).as_posix(),(dest/'native-readonly-record.json').relative_to(root).as_posix(),
 'WP/backlog-resume-20261013/request-pr296-policy-owner-exact-head-audit-after-green-once.py']
pins={p:hashlib.sha256((root/p).read_bytes()).hexdigest() for p in owned if p not in readmes}
git('add','--',*owned);assert set(git('diff','--cached','--name-only').decode().splitlines())<=set(owned)
for p,d in pins.items():assert hashlib.sha256(git('show',':'+p)).hexdigest()==d,p
git('commit','-m','audit(214): preserve fresh native human draft at corrected push boundary')
head=git('rev-parse','HEAD').decode().strip()
for p,d in pins.items():assert hashlib.sha256(git('show',head+':'+p)).hexdigest()==d,p
git('push','origin','HEAD:refs/heads/audit/release-eb6de2e8')
assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head
print(json.dumps({'auditHead':head,'verifiedBlobs':len(pins),'nativeMessagesSent':0,'humanDraftPreserved':True}))
