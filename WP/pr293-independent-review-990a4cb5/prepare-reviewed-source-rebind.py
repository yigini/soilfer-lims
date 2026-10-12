"""Local source preparation only; refuses until PR293 is audited and merged.

This does not build, copy a database, launch a proof, freeze a kit or deploy.
The resulting source still needs its own NEW exact-byte source approval.
Only named mutable helper sources are edited; historical kits are untouched.
"""
import hashlib
import json
import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
BASE = 'f830f900f597f20e12570b583e4e32ce9cb50a1d'
HEAD = '990a4cb535fd3ccb2a81ca019f453123b60a14b8'
TREE = '90ed6a26c72bfab5a348dfdb9d6e59876c61ee4c'
SOURCE_BASE = '14807695'
NAMES = ['proof_contract.py', 'build_candidate.py', 'prepare_candidate_build.py',
    'export_launch_runtime_proof.py', 'collect_runtime_gate.py',
    'runtime_release_contract.py', 'deploy_runtime.py', 'test_runtime_release_contract.py']


def require(value, reason):
    if not value:
        raise RuntimeError(reason)


def gh(endpoint):
    return json.loads(subprocess.check_output(['gh', 'api',
        'repos/yigini/soilfer-lims/' + endpoint], cwd=ROOT))


def exact_replace(text, old, new):
    require(text.count(old) == 1, 'Preparation source span differs: ' + old[:80])
    return text.replace(old, new)


def main():
    require(sys.argv[1:] == ['--prepare-local-reviewed-merged-identity'],
        'Explicit local preparation mode required')
    pr = gh('pulls/293')
    require(pr['merged'] and pr['head']['sha'] == HEAD,
        'Exact PR293 audit must merge first')
    merged = gh('git/commits/' + pr['merge_commit_sha'])
    require(gh('git/ref/heads/main')['object']['sha'] == merged['sha'] and
        merged['tree']['sha'] == TREE and [p['sha'] for p in merged['parents']] == [BASE, HEAD],
        'Actual main parent/union tree differs')
    pages = json.loads(subprocess.check_output(['gh', 'api', '--paginate', '--slurp',
        'repos/yigini/soilfer-lims/issues/293/comments?per_page=100'], cwd=ROOT))
    comments = [c for page in pages for c in page]
    passes = [c for c in comments if c['body'].lstrip().splitlines()[0].strip('*_# ').startswith(
        'Audit passed: OK to merge and deploy') and HEAD in c['body'] and
        c['html_url'].startswith('https://github.com/yigini/soilfer-lims/pull/293#')]
    require(passes, 'Full exact-head formal audit missing')
    review = max(passes, key=lambda c: c['created_at'])
    require(not any('audit failed' in c['body'].lower() and c['created_at'] > review['created_at']
        for c in comments), 'Later audit failure exists')
    checks = gh('commits/' + HEAD + '/check-runs?per_page=100')['check_runs']
    require(checks and all(c['status'] == 'completed' and c['conclusion'] == 'success' for c in checks),
        'Exact PR CI must pass')
    subprocess.run(['git', 'fetch', 'origin', 'main'], cwd=ROOT, check=True, capture_output=True)
    union = subprocess.check_output(['git', 'merge-tree', '--write-tree', BASE, HEAD], cwd=ROOT).decode().strip()
    require(union == TREE, 'Independent union tree differs')
    replacements = {
        '171dd36c5b2dbeea8763520dd18fbdb158ffca05': BASE,
        '5d3550d709f0b62ef013f9114e9da9344f9818a1': HEAD,
        BASE: merged['sha'],
        '48678dda23fa876d8d233db812149c8d1792bf16': TREE,
        '2292fbf2a2626ad89c5abdcc49843dffffdefd02': TREE,
        'sha256:bac52bc8ee6a7d94d17fbdf2064fd09e8bc8dc533677304f4cc2d3e128fc4320':
            'sha256:4894eabc1d2e70528b83e6e77b151b43c8e67adff15228cfd067485ffd7c5413',
        '/opt/lims/releases/runtime-kobo-release-171dd36c-20261011T222300Z':
            '/opt/lims/releases/runtime-kobo-release-f830f900-20261012T012552Z',
        'ac4ffc39c0b8e2c27f7aa1494edffcfd45e5c47d2c4aa5b7fffee1c2b6b1781e':
            '0b8c3f54ab70e404d5797266f349d3b2a819151dc3afa9c5059f63a27727a8d7',
        '/291': '/293', 'PR291': 'PR293', 'releasePr=291': 'releasePr=293',
        'PR_NUMBER = 291': 'PR_NUMBER = 293', "spec['pr'] == 291": "spec['pr'] == 293"}
    # Simultaneous substitutions prevent BASE -> candidate cascading.
    import re
    pattern = re.compile('|'.join(re.escape(k) for k in sorted(replacements, key=len, reverse=True)))
    prepared = {}
    for name in NAMES:
        path = ROOT / 'WP/runtime-recovery-kobo' / name
        original = subprocess.check_output(['git', 'show', SOURCE_BASE + ':WP/runtime-recovery-kobo/' + name], cwd=ROOT)
        require(path.read_bytes() == original, 'Named mutable source changed: ' + name)
        text = pattern.sub(lambda m: replacements[m[0]], original.decode('utf-8').replace('\r\n', '\n'))
        prepared[name] = (path, original, text)
    # Do not carry the previous stopped-held entry allowance into a healthy release.
    path, original, text = prepared['runtime_release_contract.py']
    text = exact_replace(text, "'allowedEntryStates': ['RUNNING_NORMAL', 'STOPPED_HELD']}",
        "'allowedEntryStates': ['RUNNING_NORMAL'], 'entryPolicy': 'HEALTHY_RUNNING_NORMAL_ONLY'}")
    text = exact_replace(text, "'RUNNING_NORMAL', 'STOPPED_HELD', 'NO_SECOND_STOP',",
        "'RUNNING_NORMAL', 'entryPolicy=HEALTHY_RUNNING_NORMAL_ONLY', 'historicalFailedWalEvidenceOnly=true',")
    text = exact_replace(text, "elif entry['mode'] == 'STOPPED_HELD':\n",
        "elif entry['mode'] == 'STOPPED_HELD':\n        raise RuntimeError('Historical held entry is not authority for this new release')\n")
    prepared['runtime_release_contract.py'] = (path, original, text)
    path, original, text = prepared['deploy_runtime.py']
    text = exact_replace(text, "receipt['head'] == CANDIDATE_HEAD and", "receipt['head'] == BASE_HEAD and")
    text = exact_replace(text, "if live['State']['Running'] and ingress_sha == ORIGINAL_INGRESS_SHA:",
        "require(live['State']['Running'] and not live['State']['OOMKilled'] and\n        live['State'].get('Health', {}).get('Status') == 'healthy' and\n        ingress_sha == ORIGINAL_INGRESS_SHA, 'Healthy normal predecessor required')\n    if live['State']['Running'] and ingress_sha == ORIGINAL_INGRESS_SHA:")
    prepared['deploy_runtime.py'] = (path, original, text)
    # Validate all syntax and source preconditions before the first local edit.
    for name, (_, _, text) in prepared.items():
        compile(text, name, 'exec')
    require(gh('git/ref/heads/main')['object']['sha'] == merged['sha'], 'Main changed during preparation')
    output = pathlib.Path(__file__).with_name('actual-reviewed-source-rebind.json')
    require(not output.exists(), 'Never overwrite source preparation evidence')
    evidence = {'status': 'LOCAL_SOURCE_PREPARED_NOT_REVIEWED_OR_EXECUTED', 'pr': pr,
        'merged': merged, 'auditReview': review, 'sourceApprovalStillRequired': True,
        'newProofSourceReviewIdBound': False, 'productionMutations': 0, 'files': {}}
    for name, (path, original, text) in prepared.items():
        data = (text.replace('\n', '\r\n') if b'\r\n' in original else text).encode('utf-8')
        path.write_bytes(data)
        evidence['files'][name] = {'beforeSha256': hashlib.sha256(original).hexdigest(),
            'afterSha256': hashlib.sha256(data).hexdigest()}
    output.write_text(json.dumps(evidence, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'status': evidence['status'], 'head': merged['sha'], 'evidence': str(output)}))


if __name__ == '__main__':
    main()
