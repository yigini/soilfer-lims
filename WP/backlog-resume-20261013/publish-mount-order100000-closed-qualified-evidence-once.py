"""Publish closed immutable qualification evidence with reviewed log exclusions."""
import json, pathlib, sys
sys.dont_write_bytecode = True
W = pathlib.Path(__file__).resolve().parents[2]
H = W / 'WP/backlog-resume-20261013'
sys.path.insert(0, str(H))
from prechecks6210209468_evidence import git, sha, canonical, utc, save
from prechecks6210209468_boundary_publication import boundary_publish
REL = 'WP/batch-proof-mount-order-forward-be837974-20261016/'
B = W / REL
sys.path.insert(0, str(B))
from proof_contract import approval, graph, require, exact_json
import prepare_proof as prep
D = B / 'mount-order100000-closed-originals-once'
V = B / 'mount-order100000-closed-qualified-evidence-publication-once'
BASE = '6c77e19b646b3e25b9b4cf55208cf9a2a40cfa59'
require(git('rev-parse', 'HEAD').decode().strip() == BASE and git('branch', '--show-current').decode().strip() == 'audit/release-eb6de2e8' and not git('diff', '--cached', '--name-only').strip() and not V.exists(), 'Same writer/new publication required')
def read(p): return exact_json(p.read_bytes())
core = read(D / 'independent-startup-memory-accounting-validation.json')
natural = read(D / 'independent-natural-sync-validation.json')
privacy_dir = B / 'closed-all-jobs-on-log-content-review-once'
privacy = read(privacy_dir / 'public-content-review-and-exclusions.json')
hook_dir = B / 'closed-hook-streams-host-only-analysis-once'
hook = read(hook_dir / 'stdout-original.json')
r = read(D / 'closed-retention-record.json')
require(core['allHealthPollsValidated'] == 668 and core['allMemorySamplesValidated'] == 810 and core['allOriginalKernelReadsValidated'] == 6480 and core['rootFilesHashed'] == 12787, 'Complete closed counts required')
require(all(core[k] is True for k in ['all37SourcesAnd1333AppInputsUnchanged', 'all65PackageFilesUnchanged', 'all732SourceRawGitOidShaLengthBindingsVerified', 'controllerOomZeroEveryPhase', 'stopPostErrorsEmpty', 'stopPostNonVacuousTwoOwners', 'systemdSuccessfulDeactivationAfterNonIgnoredStopPost']), 'Full closure validation required')
require(natural['wholeProofClosureValidated'] is True and natural['coreValidationSha256'] == sha((D / 'independent-startup-memory-accounting-validation.json').read_bytes()) and natural['firstAddedRows'] == {'Sample':193,'SampleHold':23,'AuditLog':239,'Notification':1} and natural['secondAllRowsPreservedNoAddedRows'] is True, 'Natural closure validation required')
require(hook['status'] == 'ORIGINAL_SIX_REAL_DOCKER_PS_INSPECT_HOOK_CALLS_INDEPENDENTLY_VERIFIED_HOST_ONLY' and hook['allExactTwoOwnersStoppedRetained'] is True and hook['originalPrivateStreams'] == 12 and hook['privateStreamBytesFetched'] == hook['newDockerCalls'] == hook['sqlConnections'] == 0, 'Original hook streams validation required')
require(privacy['rawLogFiles'] == 156 and privacy['rawLogBytes'] == 17222252 and privacy['rawLogLines'] == 240246 and privacy['allOriginalsPreservedLocalAndHost'] is True and privacy['noPayloadFreeClaim'] is True, 'Full jobs-on privacy review required')
excluded = {W / n for n in privacy['publicContentExclusions']}
require(len(excluded) == 157 and all(p.is_file() for p in excluded) and D / 'stdout-original.json' in excluded, 'All raw logs and embedding transport excluded')
for row in privacy['logs']:
    raw = (W / row['path']).read_bytes()
    require(len(raw) == row['bytes'] and sha(raw) == row['sha256'] and row['publicContentDisposition'] == 'WITHHELD_ENTIRE_ORIGINAL', 'Reviewed log original changed')
index = read(B / 'actual-source-pass6211327371-once/tooling-source-index.json')
review = read(B / 'actual-source-pass6211327371-once/actual-source-pass-original.json')
approval(review, index)
require(len(graph(index)) == 37 and index['head'] == core['sourceHead'], 'Reviewed source required')
for n, digest in graph(index).items(): require(sha((B / n).read_bytes()) == digest, 'Reviewed source changed ' + n)
frozen = read(W / 'WP/startup-order-readiness-20261015/full-pinned-copy-retention-bound-ordinary-once/source-before.json')
require(len(frozen) == 1333 and all(sha((W / n).read_bytes()) == digest for n, digest in frozen.items()), 'Frozen application changed')
evidence = prep.current_evidence(review, index)
V.mkdir()
save(V, 'fresh-current-authority-evidence.json', canonical(evidence) + b'\n')
save(V, 'full-same-invocation-journal-original.jsonl', r['journalOriginal']['stdout'].encode())
save(V, 'unloaded-systemctl-original.txt', r['systemctlOriginal']['stdout'].encode())
save(V, 'local-generator-syntax-refusal-derived.json', canonical({'status':'LOCAL_GENERATOR_SYNTAX_ERROR_BEFORE_HELPER_FILE_CREATION', 'literal':'SyntaxError: invalid decimal literal', 'cause':'Nested triple-single-quoted source generator ended its outer string at the intended checkpoint f-string', 'helperCreated':False, 'publicationCreated':False, 'hostCalls':0, 'stageChanges':0, 'operatorReplay':False}) + b'\n')
result = {
 'status':'CLOSED_MOUNT_ORDER100000_QUALIFICATION_CHECKS_PASS_AWAITING_CLAUDIO_RESULT_ACCEPTANCE_NOT_DEPLOYED',
 'validatedUtc':utc(), 'root':core['root'], 'invocation':core['invocation'], 'sourceHead':core['sourceHead'], 'sourceReviewId':6211327371,
 'qualificationChecksPassed':True, 'actualClaudioResultAcceptancePending':True, 'releaseQualified':False, 'deployments':0, 'releaseKit':None, 'gate':None,
 'terminalSha256':core['terminalSha256'], 'stopPostSha256':core['stopPostSha256'], 'terminalSealedUtc':core['terminalUtc'], 'successfulDeactivationUtc':'2026-10-16T09:19:58.494170+00:00',
 'originalRuntimeAwaitingStopPostStatusUnchanged':True, 'nonVacuousTwoOwnersStoppedRetained':True, 'stopPostErrorsEmpty':True, 'hookExitZeroDerivedFromSuccessfulNonIgnoredLifecycleNotUnloadedDefaults':True,
 'rootFilesHashed':12787, 'allPublicSmallOriginalsLocallyRetained':11740, 'allHealthPollsValidated':668, 'allMemorySamplesValidated':810, 'allOriginalKernelReadsValidated':6480, 'allControllerRawReadsValidated':24, 'controllerTelemetryRecords':3041,
 'all37Source1333App65Package732SourcePublicationBindingsValidated':True,
 'coreValidationSha256':sha((D / 'independent-startup-memory-accounting-validation.json').read_bytes()), 'naturalValidationSha256':sha((D / 'independent-natural-sync-validation.json').read_bytes()),
 'privacyReviewSha256':sha((privacy_dir / 'public-content-review-and-exclusions.json').read_bytes()), 'hookStreamAnalysisSha256':sha((hook_dir / 'stdout-original.json').read_bytes()),
 'naturalSyncPublicValidation':natural,
 'privateRowHmacAndNewHoldAuditPredicatesComputedByFrozenReviewedRuntimeNotIndependentlySqlOrKeyRecomputedByRetainer':True,
 'all156JobsOnLogOriginalsAndEmbeddingTransportWithheld':True, 'withheldLogBytes':17222252, 'withheldLogLines':240246, 'publicExclusionCount':157,
 'bothPrivateHmacKeysAndDatabaseFilesAnd12InspectStreamsHostOnly0400':True, 'privateFileBytesFetched':0, 'retainerSqlConnections':0, 'newDuMeasurements':0, 'proofRetries':0,
 'sampledMemoryOnlyNotContinuousPeak':True, 'exactNewKitReviewAndFreshSingleUseGateStillRequired':True, 'futureDeploymentIntakeCountsMayDiffer':True,
 'originalPhysicalTerminalGrowth':core['originalPhysicalAccounting'][-1]['growth'], 'remainingBudgetBytes':0,
 'mainMergeHold':True, 'r2CompleteNoPrune':True
}
save(V, 'independent-closed-qualification-result.json', canonical(result) + b'\n')
folders = [D, B/'tenth-mount-order-100000-readonly-observation-once', B/'closed-independent-core-validation-once', B/'closed-independent-core-complete-validation-once', hook_dir, B/'closed-independent-natural-sync-validation-once', B/'closed-independent-natural-sync-complete-validation-once', B/'closed-independent-natural-sync-observed-pairs-validation-once', B/'closed-independent-natural-sync-hash-domains-validation-once', privacy_dir]
extras = {p for folder in folders for p in folder.rglob('*') if p.is_file() and p not in excluded}
helpers = ['observe-mount-order-100000-tenth-readonly-once.py','read-mount-order100000-closed-originals-readonly-once.py','retain-mount-order100000-closed-originals-once.py','validate-mount-order100000-closed-startups-memory-once.py','validate-mount-order100000-closed-startups-memory-complete-once.py','analyse-mount-order100000-retained-hook-streams-host-only-once.py','validate-mount-order100000-closed-natural-sync-public-once.py','validate-mount-order100000-closed-natural-sync-public-complete-once.py','validate-mount-order100000-closed-natural-sync-observed-pairs-once.py','validate-mount-order100000-closed-natural-sync-hash-domains-once.py','review-mount-order100000-all-jobs-on-logs-before-publication-once.py']
extras.update(H / n for n in helpers)
extras.add(pathlib.Path(__file__))
require(not extras & excluded and all(p.is_file() and p.is_relative_to(W) for p in extras), 'Explicit owned public evidence only')
require(not any(p.suffix in ['.db','.bin'] or p.name.endswith(('-wal','-shm')) or p.name.startswith('private-') for p in extras), 'Private bytes refused')
save(V, 'public-exclusion-summary.json', canonical({'excludedPaths':sorted(p.relative_to(W).as_posix() for p in excluded), 'allOriginalsRetainedUnchanged':True, 'noPayloadFreeClaim':True}) + b'\n')
lead = f'''LATEST ACTUAL CLOSED MOUNT-ORDER100000 QUALIFICATION CHECKS PASS / CLAUDIO RESULT ACCEPTANCE PENDING - {result['validatedUtc']}.
ONE source187636984895aec44044635fb63498b0fcb3102e/PASS6211327371/inv119b9c19c39e46d8bb482c144bd432ea CLOSED successfully09:19:58.494170UTC. Original receipt SHA{core['terminalSha256']} sealed09:19:57.422519UTC retains its runtime-AWAITING-ExecStopPost status; independent acceptance combines original nonignored stop-post SHA{core['stopPostSha256']} with all4 same-invocation PID1 lifecycle records. Both exact owners STOPPED AND RETAINED NONVACUOUS/errorsEMPTY/postStopErrorsEMPTY/controllerMemoryErrorNULL; successful lifecycle derives hookexit0, not unloaded-systemctl defaults. No deployment/kit/gate/MainMERGEHOLD.
Full12787file hashstat retention/11740small originals/65package/37source+1333app/732raw source-publication bindings verified. ALL668 FULLhealth polls +810 memory samples +6480 kernel originals +24 controller before/after/poststop originals +3041telemetry validated; exact identities805memorySwap0/controllerSwap0/OOM0, sampled seven-field limits603979776. Not continuous peak. FIRST349health389memory/healthy423.1075271220034s/readiness424.82602363400656s; SECOND319health421memory/healthy393.53061386999616s. BOTH27NO_OPinteger0+26exactREADYinteger0/HTTP200200401/final before-stop samples; OFF31API+6exactprobes/full112tables42receipts unchanged. All83 historical containers, normal production predecessor, old input triples/readers/backups/assets and qualified acc158/cd3a image receipt preserved.
Natural jobsON FIRST08:53:11.502274269UTC193Sample23SampleHold239AuditLog1Notification/99submissions/D1=98D2=95/20old CROSS_SUBMISSION_DUPLICATE pairs/0new same-sync-cross conflicts. SECOND09:08:56.032714234UTC0adds0changes; all107other tables exact/full112schema42receipts. Original15min scheduler untouched/76healthy captures1025.2284910678864s/four refused configs18exact pairs EACH72total. Actual counts differ priorC1=186/22; future deploy counts may differ; skipped23 is log description. Public evidence independently checked; raw-value/HMAC/new-hold-audit predicates computed by frozen reviewed runtime, not independently replayed via SQL/private keys. Logical all-column versus intake PK-order seal hashes compared only within their own domains.
Full original physical du-x accounting BEFORE/stage1/stage2/TERMINAL independently rederived; terminal free65193848832/required24851118190, known growth10821836800/free drop10823077888/unexplained1241088<500MB. N25MIN64/25percent/3assets/floor10556150894+4GiBlogs+extra10GB/R4 beforeROOT-beforeUNIT-runtime preserved, not new measurements. No retry/new SQL/du/production mutation/cleanup.
ALL156jobsON raw logs17222252B/240246lines FULLbyte reviewed and WITHHELD together with94287149B embedding transport; full hashes/lengths/line hashes public. DBs/BOTHkeys/12raw inspect streams HOST0400/no private bytes fetched. Six original hook ps/inspect calls independently checked HOSTONLY without new Docker/key reads. Local offline validator assumptions and source-generator syntax refusal retained honestly with unique successors, no operator/source replay.
Complete publication {REL}mount-order100000-closed-qualified-evidence-publication-once/publication-index.json. NEXT ONE actual @claude162 closed result with621132PASSACK ONLY there; actual result acceptance and separately reviewed concrete new kit direction required before a kit/gate/deploy. No duplicate ACK/GH/native; source621098 answered and08:24:55nativefallback cancelled forever. Consumed roots/units/operators remain immutable. Future kit includes actual stop grace+exit in9-to10min restart/exact600 failure. R2COMPLETE/233000KEEPIT/no prune/nohostgrowrestart/no103/humansheld. New09:27Claude comment6212445417 records YY parallel-work direction for isolated backlog, release one-writer/merge hold; retain exact actual wording/current direct user constraints. HeartbeatACTIVE2min, restore10 only after actualbeDEPLOYED+actualClpostdeployPASS. Preserve ALL prior history verbatim below.

'''
published = boundary_publish(V, extras, 'Retain independently validated closed mount-order qualification and privacy exclusions', lead)
print(json.dumps({**published, 'qualificationChecksPassed':True, 'deployments':0, 'privateFileBytesFetched':0, 'withheldFiles':157, 'resultSha256':sha((V/'independent-closed-qualification-result.json').read_bytes())}))
