"""Publish actual answered timing scope and the tested recovery sequence."""
import sys
sys.dont_write_bytecode=True
from prechecks6210209468_boundary_publication import *
K=W/'WP/batch-release-kit-be837974-20261016';D=K/'timing-direction-recovery-publication-once'
assert not D.exists() and git('rev-parse','HEAD').decode().strip()=='95689ccdcf312c311cf97115e18db19d9d07abac'
assert not git('diff','--cached','--name-only').strip()
v=json.loads((K/'timing-recovery-local-first-once/verification.json').read_bytes())
assert v['testExit']==0 and v['sourceBefore']==v['sourceAfter']
for name,digest in v['sourceBefore'].items():assert sha((K/name).read_bytes())==digest
assert b'Ran 24 tests' in (K/'timing-recovery-local-first-once/stderr-original.txt').read_bytes()
answer_raw=subprocess.check_output(['gh','api','repos/yigini/soilfer-lims/issues/comments/6213266959'],cwd=W)
answer=json.loads(answer_raw)
sys.path.insert(0,str(K));import kit_contract as c
c.timing_direction(answer)
assert answer['body']==json.loads((K/'actual-timing-direction6213266959-once/api-original-0.json').read_bytes())['body']
question=json.loads((K/'whole-outage-timing-question-once/fresh-readback-original.json').read_bytes())
assert question['id']==6213148920 and question['body']==json.loads((K/'whole-outage-timing-question-once/request.json').read_bytes())['body']
D.mkdir();save(D,'fresh-timing-answer-original.json',answer_raw)
record={'observedUtc':utc(),'actualQualificationAccepted':6212990400,'actualTimingDirection':6213266959,
        'timingQuestion':6213148920,'timingQuestionAnswered':True,'nativeFallback102825CancelledForever':True,
        'localTests':24,'linuxDirectoryFsyncNotYetTested':True,'completeOperationalAdapterExists':False,
        'kitSourceReviewRequested':False,'kitGateExists':False,'deployment':False,'hostCalls':0}
save(D,'boundary-record.json',canonical(record)+b'\n')
extras={p for p in K.iterdir() if p.is_file()}
for name in ['sequence-journal-local-first-once','timing-recovery-local-first-once','whole-outage-timing-question-once','actual-timing-direction6213266959-once','journal-local-retained-fixtures']:
    extras|={p for p in (K/name).rglob('*') if p.is_file()}
for name in ['verify-release-kit-sequence-journal-local-once.py','verify-release-kit-timing-recovery-local-once.py','ask-release-kit-whole-outage-timing-once.py','retain-kit-timing-direction6213266959-once.py']:
    extras.add(W/'WP/backlog-resume-20261013'/name)
extras.add(__import__('pathlib').Path(__file__))
lead='''LATEST ACTUAL TIMING DIRECTION6213266959 / TESTED KIT RECOVERY FOUNDATION - 2026-10-16T10:22:48Z.
Qualification100000 result6212737130 accepted by actual unedited Claude6212990400/09:59:11Z/bodySHA6ea2ee1f1ec0b3eeec455ebab5b8d1cbadd17e93d2741eefdc501070fad3fb26. Acceptance retained23aeff2695972230ce2c6e1312255bee726fc311/41raw; old result native fallback10:04:23 CANCELLED forever. Concrete kit foundation95689ccdcf312c311cf97115e18db19d9d07abac/34raw exists, complete production adapter/source graph/SourcePASS/frozen kit/gate/deployment do not yet exist. DO NOT merely wait for a nonexistent kit review: continue implementing the concrete graph.
ONE actual timing clarification6213148920 posted10:08:25Z/bodySHA020c8145f9dd341a91415eccd4de651ab820dca91adc2534efb0d8beca8cde76 ACKed621299 ONLYTHERE. It is ANSWERED by actual unedited Claude6213266959/10:15:47Z/bodySHA0afe213f777d2adafd7ade6e7b3eb880fe2b64a12735e6a793779d2275de8087/semanticSHAe3171a28a04fe8326fc3fed6f641b3ea2e9a724ddf97a55ca7f79e9b9ba28443. Its10:28:25 native fallback CANCELLED forever/no duplicate question or ACK. Bundle621326 ACK only at the next complete concrete source review.
FULL timing direction WITHDRAWS Cl's9to10min shorthand and233000 install-path claim: neither was a YY limit; both233000 and100000 used already-installed112/42. Disclose/gate honest whole503outage expected plain minutes and longest under existing timeouts; keep600 candidate readiness/DRY-APPLY-REPEAT/preservation/all guards/no performance detour/no new kill points inside installer transactions. Retained13 timing originals show3APPLY410.332512s/all9commands632.285438s/fastest100000READY394.886040s; comparisonAPPLY+READY+10stop815.218552s BEFOREotherphases, historicalcde8/B5 context, NOT measuredacc158productionsequence. Whole outage unmeasured components remain explicit allowances; controller5400s does not promise reopening after postAPPLYfailure.
NEW explicit621326 preAPPLY recovery exception supersedes the older any-installer-attempt ban ONLY in this narrow reviewed kit path: before ANY APPLY dispatch, exact retained raw dev.db/WAL/SHM SHA+length must match current stopped triple, no absent-vs-empty equivalence, exact predecessor/no other writers, then restart SAME retained predecessor ONCE/verify readiness/reopen; NO DB restore. Missing raw backup/changedSHM/unknownAPPLY outcome/any entrypoint=>NOrestart. After any APPLY intent,503+candidate stop/retain/partial162/forwardfixONLY. Failed early recovery reholds503/stops same predecessor/no retry. No such operational adapter has run or exists yet.
Concrete source-only kit_contract/kit_sequence/kit_journal now implement distinct DRY/APPLY/REPEAT/preservation ordering, durable before-call intents, exact candidate intent after lost return, full-triple recovery refusals, AFTER_FIRST_NATURAL_SYNC_BEFORE_INGRESS_REOPEN_ENUMERATED_INTAKE_DELTA, freshYY intake/workload/outage binding, failure-outbox order. 24/24 local Windows tests PASS10:22:48.738425UTC/all8source hashes unchanged; previous18-pass and preliminary12-direct-tool results retained honestly. Actual local file tests retained; Linux directory fsync NOTYETtested/no HOSTclaim. Synthetic operations only/no host/SSH/Docker/productionSQL/newproof/du/memorysampling/stop/retry/cleanup.
NEXT implement complete actual adapter/preflight unhealthy-consumer inventory/scientific preservation/installers/defaultstart/natural intake/accounting/exclusive gate/freeze/launcher/stop-post from current approved source, bind621299+621326; full meaningful guards then ONE new exact source review/frozen exact kit review/fresh actualYY single-use workload+impact+outage gate before deployment. First sync193new23holds20oldcross1ZMBmanagerNotice/otherlabs0/maygrow must be visible; five protected counts only exact intake deltas/full provenance required. Same805/blankheap/Swap0/OOM0/diskfloor4GiBlogs10GB/500MB/retention/R2complete/233000KEEPIT/nohostgrowrestart/no103/humansheld.
Parallel208labels and207custody existing agents/worktrees only, full local suites running/client build+lintPASS14baselinewarnings/no PR yet reported. No208 sampleContainerService/list change;207 event-derived currentlocation projection compatible.208 stale index.lock was verified empty/no git and renamed to retained index.lock.stale-20261016T101600628Z inside only its soilfer-lims6 gitdir/no deletion. Source-only PRs+normal one-run CI; parent ONEready/exact-head audit after real fullgreen CI. MainMERGEHOLD until actualbeDEPLOYED+Clpostcheck. SAMEheartbeatACTIVE2min; restore10 ONLY actualdeployment+actualClpostdeployPASS. ALL older history below preserved verbatim.

'''
print(json.dumps(boundary_publish(D,extras,'docs: retain kit timing direction and tested pre-apply recovery',lead)))
