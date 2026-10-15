"""Correct the actually reproduced earlier order race, after retaining failed bytes."""
import datetime,hashlib,json,pathlib
R=pathlib.Path(__file__).resolve().parents[2];D=R/'WP/startup-order-readiness-20261015/pinned-policy-alias-source-successor-once'
assert not D.exists()
F=R/'WP/startup-order-readiness-20261015/closed-guard-wal-race-focused-once'
summary=json.loads((F/'summary.json').read_bytes());report=json.loads((F/'report-original.json').read_bytes())
assert summary['passed']==165 and summary['failed']==1 and summary['sourceUnchanged'] and summary['exactInventory']
frozen=json.loads((F/'source-after.json').read_bytes());assert all(hashlib.sha256((R/n).read_bytes()).hexdigest()==v for n,v in frozen.items())
cases=[case for suite in report['testResults'] for case in suite['assertionResults']]
failures=[case for case in cases if case['status']=='failed'];assert len(failures)==1 and 'after-policy-capture' in failures[0]['fullName']
wal=[case for case in cases if 'owned WAL-mode' in case['fullName']];assert len(wal)==3 and all(case['status']=='passed' for case in wal)
D.mkdir()
names=['server/utils/startupReadinessContext.js','server/scripts/install_lab_policy_schema.js','server/scripts/install_order_revisions.js']
for name in names:
    p=D/'source-before'/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes((R/name).read_bytes())
(D/'actual-failure-and-wal-results-parsed-derived.json').write_text(json.dumps({'observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'focusedSummary':summary,'actualEarlierRaceFailure':failures,'actualWalCases':wal,
    'walNormalizationNotNeededForObservedCases':True,'originalClosedReportUntouched':True,'productionOperations':0},indent=2),encoding='utf-8')
file=R/'server/utils/startupReadinessContext.js';text=file.read_text(encoding='utf-8')
text=text.replace('    let policy, chart;', '    let policy, chart, policyCopyHashes;\n    const retainedSnapshots = new Set();')
old="""            if (resolved !== original && resolved !== policy?.readonlySnapshot.path && resolved !== activePath)
                throw new TypeError('A startup context belongs to one database and its retained snapshot.');
            if (connection) return facade;"""
new="""            if (resolved !== original && !retainedSnapshots.has(resolved) && resolved !== activePath)
                throw new TypeError('A startup context belongs to one database and its retained snapshot.');
            if (connection && resolved !== original && resolved !== activePath) {
                releaseReader();
                const version = optionalDataHashes(resolved);
                if (!checkedVersion || !same(checkedVersion, version)) checks = new Map();
                firstReadVersion = version;
                checkedVersion = checks.size ? version : null;
            }
            if (connection) return facade;"""
assert old in text;text=text.replace(old,new)
old="""        reviewPolicy(target, source, hashes, review) {
            if (!original) original = path.resolve(target);
            if (policy && policy.sourceSha256 === source.sha256 && same(policy.readonlySnapshot.originalDbWalShmSha256, hashes)) return structuredClone(policy);
            // If the source files evolved between stages, retain a new snapshot
            // through the unchanged owner guards; never reuse stale results.
            releaseReader();
            policy = chart = null;
            policy = review();
            return structuredClone(policy);
        },"""
new="""        reviewPolicy(target, source, hashes, review, snapshotHashes) {
            const resolved = path.resolve(target);
            if (!original) original = resolved;
            if (policy && policy.sourceSha256 === source.sha256) {
                if (resolved === policy.readonlySnapshot.path && same(policyCopyHashes, hashes)) {
                    // A nested owner is reviewing the already pinned copy.
                    // Validate that copy and the source, without refreshing
                    // from the original midway through the outer order check.
                    const pinned = structuredClone(policy);
                    pinned.readonlySnapshot.originalDbWalShmSha256 = structuredClone(hashes);
                    return pinned;
                }
                if (resolved === original && same(policy.readonlySnapshot.originalDbWalShmSha256, hashes))
                    return structuredClone(policy);
            }
            // Changed source/copy bytes use the unchanged full owner review.
            // Its copy and race guards still decide the existing refusal.
            releaseReader();
            policy = chart = null;
            policyCopyHashes = null;
            policy = review();
            retainedSnapshots.add(policy.readonlySnapshot.path);
            policyCopyHashes = snapshotHashes(policy.readonlySnapshot.path);
            return structuredClone(policy);
        },"""
assert old in text;text=text.replace(old,new)
text=text.replace('finally { closed = true; checks.clear(); policy = chart = null; }','finally { closed = true; checks.clear(); retainedSnapshots.clear(); policy = chart = policyCopyHashes = null; }')
file.write_bytes(text.encode())
file=R/'server/scripts/install_lab_policy_schema.js';text=file.read_text(encoding='utf-8')
old='startupContext.reviewPolicy(target, source, fileHashes(target), () => reviewReadonlySnapshot(target, source, startupContext))'
new='startupContext.reviewPolicy(target, source, fileHashes(target), () => reviewReadonlySnapshot(target, source, startupContext), fileHashes)'
assert old in text;text=text.replace(old,new);file.write_bytes(text.encode())
file=R/'server/scripts/install_order_revisions.js';text=file.read_text(encoding='utf-8')
old='.assertControlChartStartupReady(startupContext && !apply ? target : copy, apply ? undefined : startupContext)'
assert old in text;text=text.replace(old,'.assertControlChartStartupReady(copy, apply ? undefined : startupContext)');file.write_bytes(text.encode())
runner=R/'WP/backlog-resume-20261013/verify-startup-pinned-policy-alias-focused-once.py';assert not runner.exists()
prior=(R/'WP/backlog-resume-20261013/verify-startup-closed-guard-wal-race-focused-once.py').read_text(encoding='utf-8')
runner.write_bytes(prior.replace('closed-guard-wal-race-focused-once','pinned-policy-alias-focused-once').encode())
(D/'preparation.json').write_text(json.dumps({'changedPaths':names,'nestedChartUsesSameCapturedCopyAsLegacy':True,
    'copyAliasFullHashAndSourceValidation':True,'originalFinalOrderHashGuardUnchanged':True,
    'noNewRefusalCodeOrCondition':True,'noOriginalFullCopyOrRaceGuardRelaxed':True,'testsNotRunYet':True,
    'nextUniqueRunner':runner.relative_to(R).as_posix()},indent=2),encoding='utf-8')
print(json.dumps({'status':'PINNED_COPY_ALIAS_CORRECTION_PREPARED_NOT_TESTED','actualWalCasesPassed':3}))
