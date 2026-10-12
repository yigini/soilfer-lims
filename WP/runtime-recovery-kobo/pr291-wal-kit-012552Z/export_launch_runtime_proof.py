"""Export reviewed bytes and launch ONE new isolated candidate proof.

This launcher cannot deploy, change production settings, restart a retained
proof or use the historical jobs-off writer. A valid merged-main candidate
and its actual audited build are prerequisites, verified read-only first.
"""
import base64
import datetime
import hashlib
import json
import pathlib
import subprocess
import sys
from proof_contract import *


def github(endpoint):
    return json.loads(subprocess.check_output(['gh', 'api', endpoint], text=True, encoding='utf-8'))


def main():
    tooling, pin_file, root, unit = sys.argv[1:]
    require(len(tooling) == 40 and all(character in '0123456789abcdef' for character in tooling), 'Exact tooling commit required')
    remote = pathlib.PurePosixPath(root)
    require(remote.parent == pathlib.PurePosixPath('/opt/lims/releases') and
        remote.name.startswith('runtime-kobo-proof-'), 'Unexpected new proof root')
    require(unit == 'lims-owned-' + remote.name.lower() + '.service', 'Unexpected owned unit')
    pin_bytes = pathlib.Path(pin_file).read_bytes()
    pin = json.loads(pin_bytes)
    pr = github('repos/yigini/soilfer-lims/pulls/291')
    require(pr['merged'] and pr['head']['sha'] == AUDITED_PR_HEAD and pr['merge_commit_sha'] == pin['head'],
        'PR291 exact audited head must be merged first')
    main_ref = github('repos/yigini/soilfer-lims/git/ref/heads/main')
    require(main_ref['object']['sha'] == pin['head'], 'Current main differs from the candidate')
    audited = github('repos/yigini/soilfer-lims/git/commits/' + AUDITED_PR_HEAD)
    merged = github('repos/yigini/soilfer-lims/git/commits/' + pin['head'])
    validate_merge_identity(merged, audited)
    candidate_identity(pin)
    review = github('repos/yigini/soilfer-lims/issues/comments/' + str(pin['auditReviewId']))
    require(review['html_url'].startswith('https://github.com/yigini/soilfer-lims/pull/291#') and
        'Audit passed: OK to merge and deploy' in review['body'] and
        (AUDITED_PR_HEAD in review['body'] or AUDITED_PR_HEAD[:8] in review['body']),
        'Formal exact-head PR audit is missing')
    comments = json.loads(subprocess.check_output(['gh', 'api',
        'repos/yigini/soilfer-lims/issues/291/comments?per_page=100', '--paginate', '--slurp'],
        text=True, encoding='utf-8'))
    require(not any('audit failed' in comment['body'].lower() and
        comment['created_at'] > review['created_at'] for page in comments for comment in page),
        'Later PR audit failure exists')
    checks = github('repos/yigini/soilfer-lims/commits/' + AUDITED_PR_HEAD + '/check-runs')['check_runs']
    require(checks and all(check['status'] == 'completed' and check['conclusion'] == 'success' for check in checks),
        'Exact PR CI is not fully green')
    ci = github('repos/yigini/soilfer-lims/actions/runs/' + str(pin['mainCiRunId']))
    require(ci['head_sha'] == pin['head'] and ci['name'] == 'CI' and
        ci['status'] == 'completed' and ci['conclusion'] == 'success', 'Exact merged-main CI is not green')
    # This is rehearsal evidence, not a production execution gate.
    authority = {'observedUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'head': pin['head'], 'baseHead': BASE_HEAD, 'auditedPrHead': AUDITED_PR_HEAD,
        'tree': MERGED_TREE, 'auditedTree': AUDITED_PR_TREE, 'mergeParents': MERGE_PARENTS, 'review': review,
        'mainCi': {key: ci[key] for key in ['id', 'head_sha', 'name', 'status', 'conclusion', 'updated_at']},
        'checks': [{key: value[key] for key in ['name', 'status', 'conclusion', 'head_sha']} for value in checks]}
    paths = {name: 'WP/runtime-recovery-kobo/' + name for name in [
        'rehearse_runtime.py', 'proof_contract.py', 'capture_kobo_fetch.py', 'kobo_copy_preservation.py',
        'known_core_disk_guard_v2.py', 'known_core_disk_guard_v3.py', 'known_core_disk_guard_proof.py',
        'build_candidate.py', 'prepare_candidate_build.py', 'export_launch_runtime_proof.py']}
    paths['known_core_disk_guard.py'] = 'WP/runtime-containment-ae64f169/known_core_disk_guard.py'
    paths.update({name: 'WP/forward-ae64f169/' + name for name in ['release_support.py', 'startup_common.py',
        'postflight-roles.cjs', 'postflight-auth.cjs', 'postflight-reference.cjs', 'postflight-qc-runs.cjs',
        'postflight-policy.cjs', 'readonly-smoke.cjs']})
    files, index = {}, {}
    for name, git_path in paths.items():
        row = subprocess.check_output(['git', 'ls-tree', tooling, '--', git_path]).decode().strip()
        mode, kind, blob = row.split('\t')[0].split()
        require(mode in ['100644', '100755'] and kind == 'blob', 'Unexpected raw source object')
        data = subprocess.check_output(['git', 'cat-file', 'blob', blob])
        require(hashlib.sha1(('blob ' + str(len(data)) + '\0').encode() + data).hexdigest() == blob,
            'Raw Git blob identity mismatch')
        files[name] = base64.b64encode(data).decode()
        index[name] = {'path': git_path, 'blob': blob, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}
    source_review = github('repos/yigini/soilfer-lims/issues/comments/' + str(pin['proofSourceReviewId']))
    source_review_pass(source_review, tooling, index['rehearse_runtime.py']['sha256'],
        index['known_core_disk_guard_v2.py']['sha256'],
        verifier_sha=index['kobo_copy_preservation.py']['sha256'], contract_sha=index['proof_contract.py']['sha256'],
        baseline_guard_sha=index['known_core_disk_guard_v3.py']['sha256'], stream_pairing=True,
        proof_layout_sha=index['known_core_disk_guard_proof.py']['sha256'],
        authority_hashes=[index[name]['sha256'] for name in
            ['build_candidate.py', 'prepare_candidate_build.py', 'export_launch_runtime_proof.py']])
    source_comments = json.loads(subprocess.check_output(['gh', 'api',
        'repos/yigini/soilfer-lims/issues/162/comments?per_page=100', '--paginate', '--slurp'],
        text=True, encoding='utf-8'))
    require(not any(('source review: failed' in comment['body'].lower() or
        'audit failed' in comment['body'].lower()) and comment['created_at'] > source_review['created_at']
        for page in source_comments for comment in page), 'Later source audit failure exists')
    require(github('repos/yigini/soilfer-lims/git/ref/heads/main')['object']['sha'] == pin['head'],
        'Main changed during proof preparation')
    authority['proofSourceReview'] = source_review
    payload = base64.b64encode(json.dumps({'root': root, 'unit': unit, 'files': files,
        'pin': base64.b64encode(pin_bytes).decode(), 'authority': authority,
        'index': {'head': tooling, 'files': index}}).encode()).decode()
    code = '''import base64,hashlib,json,pathlib,subprocess
p=json.loads(base64.b64decode(PAYLOAD));r=pathlib.Path(p['root']);u=p['unit']
assert r.parent.resolve()==pathlib.Path('/opt/lims/releases').resolve() and not r.exists()
names=subprocess.check_output(['docker','ps','--format','{{.Names}}'],text=True).splitlines()
assert not any(name.startswith('lims-owned-') for name in names), 'An owned writer is already active'
r.mkdir(mode=0o700)
for name,encoded in p['files'].items():
 assert pathlib.PurePosixPath(name).name==name
 data=base64.b64decode(encoded);assert hashlib.sha256(data).hexdigest()==p['index']['files'][name]['sha256']
 with (r/name).open('xb') as out:out.write(data)
 (r/name).chmod(0o400)
for name,value in [('source-index.json',p['index']),('candidate-rehearsal-authority.json',p['authority'])]:
 with (r/name).open('x',encoding='utf-8') as out:json.dump(value,out,indent=2)
 (r/name).chmod(0o400)
with (r/'target-pin.json').open('xb') as out:out.write(base64.b64decode(p['pin']))
(r/'target-pin.json').chmod(0o400)
args=['systemd-run','--unit='+u,'--property=Type=exec','--property=RuntimeMaxSec=7200',
 '--property=KillMode=process','--property=StandardOutput=append:'+str(r/'unit.stdout'),
 '--property=StandardError=append:'+str(r/'unit.stderr'),'/usr/bin/python3','-B',
 str(r/'rehearse_runtime.py'),'--new-owned-runtime-proof']
result=subprocess.run(args,text=True,capture_output=True,timeout=20);assert result.returncode==0,result.stderr
print(json.dumps({'root':str(r),'unit':u,'sourceCommit':p['index']['head'],
 'sourceIndexSha256':hashlib.sha256((r/'source-index.json').read_bytes()).hexdigest(),
 'coordinatorSha256':p['index']['files']['rehearse_runtime.py']['sha256'],
 'productionMutations':0,'productionGateCollected':False}))
'''.replace('PAYLOAD', repr(payload))
    result = subprocess.run(['ssh', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15', 'root@46.19.33.37',
        'python3', '-B', '-'], input=code, text=True, capture_output=True, timeout=40)
    require(result.returncode == 0, 'New proof launch refused: ' + result.stderr)
    print(result.stdout, end='')


if __name__ == '__main__':
    main()
