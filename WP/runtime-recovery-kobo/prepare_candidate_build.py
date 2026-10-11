"""Prepare ONE build while merged-main CI runs; never deploy or start the app.

PR audit and PR CI must already pass. Main CI may still be running because this
operation only builds the immutable image. The rehearsal launcher separately
requires exact merged-main CI SUCCESS before taking any fresh-copy proof.
"""
import base64
import datetime
import hashlib
import json
import pathlib
import re
import subprocess
import sys
import tempfile
from proof_contract import AUDITED_PR_HEAD, require


def github(endpoint):
    return json.loads(subprocess.check_output(['gh', 'api', endpoint], text=True, encoding='utf-8'))


def main():
    tooling, review_id, ci_id, remote_root, unit = sys.argv[1:]
    require(len(tooling) == 40 and all(char in '0123456789abcdef' for char in tooling), 'Exact source commit required')
    root = pathlib.PurePosixPath(remote_root)
    require(root.parent == pathlib.PurePosixPath('/opt/lims/releases') and
        re.fullmatch(r'runtime-kobo-build-[A-Za-z0-9_-]+', root.name),
        'Unexpected fresh build root')
    require(unit == 'lims-build-' + root.name.lower() + '.service', 'Unexpected owned build unit')
    pr = github('repos/yigini/soilfer-lims/pulls/292')
    require(pr['merged'] and pr['head']['sha'] == AUDITED_PR_HEAD, 'Exact audited PR292 must merge first')
    head = pr['merge_commit_sha']
    require(github('repos/yigini/soilfer-lims/git/ref/heads/main')['object']['sha'] == head, 'Current main changed')
    reviewed_commit = github('repos/yigini/soilfer-lims/git/commits/' + AUDITED_PR_HEAD)
    merged_commit = github('repos/yigini/soilfer-lims/git/commits/' + head)
    tree = merged_commit['tree']['sha']
    require(reviewed_commit['tree']['sha'] == tree, 'Merged tree differs from the audited source')
    review = github('repos/yigini/soilfer-lims/issues/comments/' + review_id)
    require(review['html_url'].startswith('https://github.com/yigini/soilfer-lims/pull/292#') and
        'Audit passed: OK to merge and deploy' in review['body'] and
        (AUDITED_PR_HEAD in review['body'] or AUDITED_PR_HEAD[:8] in review['body']), 'Formal audit missing')
    comments = json.loads(subprocess.check_output(['gh', 'api',
        'repos/yigini/soilfer-lims/issues/292/comments?per_page=100', '--paginate', '--slurp'], text=True, encoding='utf-8'))
    require(not any('audit failed' in row['body'].lower() and row['created_at'] > review['created_at']
        for page in comments for row in page), 'Later audit failure exists')
    checks = github('repos/yigini/soilfer-lims/commits/' + AUDITED_PR_HEAD + '/check-runs')['check_runs']
    require(checks and all(row['status'] == 'completed' and row['conclusion'] == 'success' for row in checks),
        'Exact PR CI is not green')
    ci = github('repos/yigini/soilfer-lims/actions/runs/' + ci_id)
    require(ci['head_sha'] == head and ci['name'] == 'CI' and ci['event'] == 'push' and
        (ci['status'] != 'completed' or ci['conclusion'] == 'success'), 'Main CI is absent or failed')
    subprocess.run(['git', 'fetch', 'origin', 'main'], check=True, capture_output=True)
    require(subprocess.check_output(['git', 'rev-parse', head + '^{tree}'], text=True).strip() == tree,
        'Local raw source differs from GitHub tree')
    local = pathlib.Path(tempfile.gettempdir()) / ('lims-runtime-build-export-' + root.name)
    require(not local.exists(), 'Never overwrite a local source export')
    local.mkdir(mode=0o700)
    rows = subprocess.check_output(['git', 'ls-tree', '-r', '-z', head]).split(b'\0')
    entries = []
    for raw in filter(None, rows):
        metadata, path = raw.decode('utf-8').split('\t', 1)
        mode, kind, blob = metadata.split()
        require(kind == 'blob' and mode in ['100644', '100755', '120000'], 'Unexpected committed source type')
        entries.append({'path': path, 'mode': mode, 'blob': blob})
    objects = subprocess.check_output(['git', 'cat-file', '--batch'],
        input=('\n'.join(row['blob'] for row in entries) + '\n').encode())
    offset = 0
    for row in entries:
        newline = objects.index(b'\n', offset)
        blob, kind, size = objects[offset:newline].decode().split()
        require(blob == row['blob'] and kind == 'blob', 'Git object frame identity differs')
        size = int(size); offset = newline + 1
        data = objects[offset:offset + size]; offset += size
        require(objects[offset:offset + 1] == b'\n', 'Git object frame delimiter differs'); offset += 1
        require(hashlib.sha1(('blob ' + str(size) + '\0').encode() + data).hexdigest() == blob, 'Git blob checksum differs')
        row.update({'bytes': size, 'sha256': hashlib.sha256(data).hexdigest()})
    require(offset == len(objects), 'Unexpected raw Git object suffix')
    archive = local / 'source.tar.gz'
    subprocess.run(['git', '-c', 'core.autocrlf=false', 'archive', '--format=tar.gz', '--output=' + str(archive), head],
        check=True, capture_output=True)
    index = {'status': 'COMMITTED_GIT_BLOB_INDEX', 'head': head, 'entries': entries}
    index_bytes = (json.dumps(index, indent=2) + '\n').encode()
    (local / 'source-index.json').write_bytes(index_bytes)
    builder = subprocess.check_output(['git', 'show', tooling + ':WP/runtime-recovery-kobo/build_candidate.py'])
    spec = {'rootName': root.name, 'head': head, 'tree': tree, 'auditedTree': tree,
        'auditedPrHead': AUDITED_PR_HEAD, 'auditReviewId': int(review_id), 'mainCiRunId': int(ci_id),
        'archiveSha256': hashlib.sha256(archive.read_bytes()).hexdigest(),
        'indexSha256': hashlib.sha256(index_bytes).hexdigest(), 'builderSha256': hashlib.sha256(builder).hexdigest(),
        'toolingCommit': tooling, 'labAndHubBuildsOwnedByYY': True,
        'releaseWindowControl': 'RELEASE_DAY_DISK_ABORTS_ACCEPTED',
        'preparedUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'mainCiStatusAtBuildPreparation': ci['status'], 'mainCiConclusionAtBuildPreparation': ci['conclusion']}
    (local / 'build-input.json').write_text(json.dumps(spec, indent=2), encoding='utf-8')
    (local / 'build_candidate.py').write_bytes(builder)
    payload = base64.b64encode(json.dumps({'root': remote_root, 'unit': unit, 'spec': spec}).encode()).decode()
    initialize = '''import base64,json,pathlib,subprocess
p=json.loads(base64.b64decode(PAYLOAD));r=pathlib.Path(p['root'])
assert r.parent.resolve()==pathlib.Path('/opt/lims/releases').resolve() and not r.exists()
names=subprocess.check_output(['docker','ps','--format','{{.Names}}'],text=True).splitlines()
assert not any(n.startswith('lims-owned-') for n in names),'Another owned rehearsal is active'
r.mkdir(mode=0o700)
'''.replace('PAYLOAD', repr(payload))
    result = subprocess.run(['ssh', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15', 'root@46.19.33.37', 'python3', '-B', '-'],
        input=initialize, text=True, capture_output=True, timeout=40)
    require(result.returncode == 0, 'New build root refused: ' + result.stderr)
    subprocess.run(['scp', '-q', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15',
        *map(str, [archive, local / 'source-index.json', local / 'build-input.json', local / 'build_candidate.py']),
        'root@46.19.33.37:' + remote_root + '/'], check=True, capture_output=True, timeout=120)
    launch = '''import base64,hashlib,json,pathlib,subprocess
p=json.loads(base64.b64decode(PAYLOAD));r=pathlib.Path(p['root']);s=p['spec']
for name,digest in [('source.tar.gz',s['archiveSha256']),('source-index.json',s['indexSha256']),
 ('build_candidate.py',s['builderSha256'])]:
 assert hashlib.sha256((r/name).read_bytes()).hexdigest()==digest
 (r/name).chmod(0o400)
assert json.loads((r/'build-input.json').read_bytes())==s
(r/'build-input.json').chmod(0o400)
result=subprocess.run(['systemd-run','--unit='+p['unit'],'--property=Type=exec','--property=RuntimeMaxSec=2700',
 '--property=StandardOutput=append:'+str(r/'unit.stdout'),'--property=StandardError=append:'+str(r/'unit.stderr'),
 '/usr/bin/python3','-B',str(r/'build_candidate.py')],text=True,capture_output=True,timeout=20)
assert result.returncode==0,result.stderr
print(json.dumps({'root':str(r),'unit':p['unit'],'head':s['head'],'builderSha256':s['builderSha256'],
 'productionMutations':0,'status':'BUILD_LAUNCHED_NOT_DEPLOYED','mainCiMustPassBeforeProof':True}))
'''.replace('PAYLOAD', repr(payload))
    result = subprocess.run(['ssh', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15', 'root@46.19.33.37', 'python3', '-B', '-'],
        input=launch, text=True, capture_output=True, timeout=40)
    require(result.returncode == 0, 'New build launch refused: ' + result.stderr)
    print(result.stdout, end='')


if __name__ == '__main__':
    main()
