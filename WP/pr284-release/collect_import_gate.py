"""Collect fresh GitHub evidence only after frozen-kit and headroom readiness.

Run locally against a downloaded byte-exact kit. The remote gate is created
once with exclusive creation, never overwritten. This does not deploy.
"""
import base64
import datetime
import json
import pathlib
import subprocess
import sys
from import_release_contract import *


def github(endpoint, pages=False):
    args = ['gh', 'api', 'repos/yigini/soilfer-lims/' + endpoint]
    if pages:
        args += ['--paginate', '--slurp']
    value = json.loads(subprocess.check_output(args, text=True, encoding='utf-8'))
    return [row for page in value for row in page] if pages else value


def remote(code):
    result = subprocess.run(['ssh', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15', 'root@46.19.33.37',
        'python3', '-B', '-'], input=code, text=True, capture_output=True, timeout=60)
    require(result.returncode == 0, 'Fresh gate readiness refused: ' + result.stderr)
    return json.loads(result.stdout)


def main():
    kit, review_id, output = sys.argv[1:]
    kit = pathlib.Path(kit); output = pathlib.Path(output)
    require(not output.exists(), 'Never overwrite an execution gate')
    evidence = frozen_directory(kit)
    manifest = json.loads(safe_reference(evidence, 'prepared-manifest.json').read_bytes())
    root = str(safe_root(manifest['root'], 'instrument-import-release-'))
    manifest_sha = sha(evidence / 'prepared-manifest.json')
    require_unused_outputs(kit, FROZEN_FILE_SET)
    for name, digest in manifest['files'].items():
        require(pathlib.PurePosixPath(name).name == name and
            sha(safe_reference(evidence, name)) == digest, 'Downloaded frozen kit differs: ' + name)
    payload = base64.b64encode(json.dumps({'root': root, 'manifestSha256': manifest_sha}).encode()).decode()
    preflight = '''import base64,json,pathlib,sys
p=json.loads(base64.b64decode(PAYLOAD));r=pathlib.Path(p['root']);sys.path.insert(0,str(r/'frozen'))
from deploy_import import execution_preflight
print(json.dumps(execution_preflight(r,p['manifestSha256'],require_unused_gate=True)))
'''.replace('PAYLOAD', repr(payload))
    readiness = remote(preflight)
    require(readiness['productionMutations'] == 0 and readiness['ready'] is True, 'Remote kit is not ready')
    pin = json.loads(safe_reference(evidence, 'target-pin.json').read_bytes())
    pr = github('pulls/' + str(PR_NUMBER)); current = github('git/ref/heads/main')['object']['sha']
    require(pr['merged'] and pr['head']['sha'] == AUDITED_PR_HEAD and
        pr['merge_commit_sha'] == current == pin['head'], 'Exact merged-main head changed')
    merged_commit = github('git/commits/' + current)
    audited_commit = github('git/commits/' + AUDITED_PR_HEAD)
    validate_merge_identity(merged_commit, audited_commit)
    candidate_identity(pin)
    tree = merged_commit['tree']['sha']; audited_tree = audited_commit['tree']['sha']
    review = github('issues/comments/' + str(pin['auditReviewId'])); formal_pr_review(review)
    pr_comments = github('issues/' + str(PR_NUMBER) + '/comments?per_page=100', True)
    later_pr_failure = any(has_failed_verdict(row['body']) and row['created_at'] > review['created_at']
        for row in pr_comments)
    checks = github('commits/' + AUDITED_PR_HEAD + '/check-runs?per_page=100')['check_runs']
    ci = github('actions/runs/' + str(pin['mainCiRunId']))
    kit_review = github('issues/comments/' + review_id)
    kit_comments = github('issues/162/comments?per_page=100', True)
    source_review = github('issues/comments/' + str(manifest['sourceReviewId']))
    production_source = github('issues/comments/' + str(manifest['productionBaselineSourceReviewId']))
    frozen_production_source = json.loads(safe_reference(evidence, 'production-baseline-source-review.json').read_bytes())
    require(production_source['body'] == frozen_production_source['body'] and
        production_source['created_at'] == frozen_production_source['created_at'], 'Production source verdict changed')
    later_production_failure = any(has_failed_verdict(row['body'], include_source=True) and
        row['created_at'] > production_source['created_at']
        for row in kit_comments)
    later_source_failure = any(has_failed_verdict(row['body'], include_source=True) and
        row['created_at'] > source_review['created_at']
        for row in kit_comments)
    later_kit_failure = any(has_failed_verdict(row['body']) and row['created_at'] > kit_review['created_at']
        for row in kit_comments)
    yy = json.loads(safe_reference(evidence, 'yy-authorization-evidence.md').read_bytes())
    require(yy['confirmedByYY'] is True and yy['scopeText'] == 'my go covers all' and
        yy['authorizationMode'] == 'AUTO_AFTER_REVIEW', 'Original YY standing go missing')
    gate = {'status': 'FRESH_SINGLE_USE_IMPORT_GATE', 'executionRoot': root, 'head': current,
        'outputNamespace': manifest['outputNamespace'],
        'buildReuseBinding': build_reuse_binding(), 'repeatPhysicalPolicy': REPEAT_POLICY,
        'frozenFiles': manifest['files'], 'currentMainHead': current, 'image': pin['image'], 'manifestSha256': manifest_sha,
        'coordinatorSha256': manifest['files']['deploy_import.py'],
        'rehearsalReceiptSha256': manifest['files']['rehearsal-receipt.json'],
        'targetPinSha256': manifest['files']['target-pin.json'],
        'yyEvidenceSha256': manifest['files']['yy-authorization-evidence.md'],
        'proofAuthoritySha256': manifest['files']['proof-authority.json'],
        'proofSourceIndexSha256': manifest['files']['proof-source-index.json'],
        'diskMeasurementGuardSha256': MEASUREMENT_GUARD_SHA,
        'baselineMeasurementGuardSha256': BASELINE_GUARD_SHA,
        'proofBaselineLayoutGuardSha256': manifest['files']['known_core_disk_guard_import.py'],
        'proofBaselineLayoutPolicy': PROOF_BASELINE_LAYOUT_POLICY,
        'productionBaselineAdapterSha256': manifest['files']['known_core_disk_guard_import_deploy.py'],
        
        'productionBaselineSourceReviewSha256': manifest['files']['production-baseline-source-review.json'],
        'productionBaselineSourceReview': production_source,
        'laterProductionSourceAuditFailure': later_production_failure,
        'copyVerifierSha256': REVIEWED_VERIFIER_SHA, 'proofContractSha256': manifest['files']['import_proof_contract.py'],
        'refusalScopeCommentId': REFUSAL_SCOPE_COMMENT_ID,
        'schedulerRefusalPolicy': REFUSAL_POLICY, 'intakeCardinalityPolicy': CARDINALITY_POLICY,
        'refusalPairingScopeCommentId': REFUSAL_PAIRING_SCOPE_COMMENT_ID,
        'schedulerRefusalPairing': REFUSAL_PAIRING_POLICY,
        'REFUSAL_PAIR_WINDOW_SECONDS': REFUSAL_PAIR_WINDOW_SECONDS,
        'baselineVanishedProcessPolicy': BASELINE_POLICY,
        'BASELINE_ATTEMPTS_MAX': BASELINE_ATTEMPTS_MAX,
        'BASELINE_CONFIRMATION_DEADLINE_SECONDS': BASELINE_CONFIRMATION_SECONDS,
        'coreDeallocationConfirmationDeadlineSeconds': CORE_CONFIRMATION_SECONDS,
        'proofSourceReview': source_review, 'laterSourceAuditFailure': later_source_failure,
        'workloadControl': WORKLOAD_PINS, 'readOnlyExecutionReadiness': readiness,
        'entryBinding': manifest['entryBinding'],
        'pr': {'number': PR_NUMBER, 'merged': pr['merged'], 'head': pr['head']['sha'], 'mergeCommit': current,
            'tree': tree, 'auditedTree': audited_tree, 'mergeParents': MERGE_PARENTS,
            'review': review, 'checks': checks,
            'laterAuditFailure': later_pr_failure},
        'mainCi': {key: ci[key] for key in ['id', 'head_sha', 'name', 'event', 'status', 'conclusion', 'updated_at']},
        'kitReview': kit_review, 'laterKitAuditFailure': later_kit_failure,
        'yyGo': {'authorizationMode': yy['authorizationMode'], 'standingScopeText': yy['scopeText'],
            'evidenceSha256': manifest['files']['yy-authorization-evidence.md'], 'releaseHead': current}}
    # Re-read main after all GitHub evidence; freshness starts only now.
    require(github('git/ref/heads/main')['object']['sha'] == current, 'Main changed during gate collection')
    gate['verifiedUtc'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
    verify_gate(manifest, gate, manifest_sha)
    data = (json.dumps(gate, indent=2) + '\n').encode()
    with output.open('xb') as out:
        out.write(data)
    encoded = base64.b64encode(data).decode()
    install = '''import base64,hashlib,json,pathlib,sys
p=json.loads(base64.b64decode(PAYLOAD));r=pathlib.Path(p['root']);sys.path.insert(0,str(r/'frozen'))
from deploy_import import execution_preflight
from import_release_contract import verify_gate,verify_entry_readiness
actual=execution_preflight(r,p['manifestSha256'],require_unused_gate=True)
data=base64.b64decode(DATA);g=json.loads(data);m=json.loads((r/'frozen'/'prepared-manifest.json').read_bytes())
verify_gate(m,g,p['manifestSha256'])
verify_entry_readiness(m,g,actual)
with (r/'production-gate.json').open('xb') as out:out.write(data)
(r/'production-gate.json').chmod(0o400)
print(json.dumps({'root':str(r),'gateSha256':hashlib.sha256(data).hexdigest(),'verifiedUtc':g['verifiedUtc'],
 'status':'FRESH_GATE_CREATED_NOT_EXECUTED'}))
'''.replace('PAYLOAD', repr(payload)).replace('DATA', repr(encoded))
    print(json.dumps(remote(install)), flush=True)


if __name__ == '__main__':
    main()
