"""Build ONE new immutable candidate from verified raw Git source, no DB mounts."""
import datetime
import hashlib
import json
import os
import pathlib
import shutil
import subprocess
import sys
import tarfile
from import_proof_contract import *

ROOT = pathlib.Path(__file__).resolve().parent
FLOOR = 10556150894


def require(value, reason):
    if not value:
        raise RuntimeError(reason)


def sha(path):
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        while block := stream.read(1024 * 1024):
            digest.update(block)
    return digest.hexdigest()


def main():
    require(os.geteuid() == 0 and sys.flags.optimize == 0, 'Root and plain Python required')
    require(ROOT.parent == pathlib.Path('/opt/lims/releases') and ROOT.name.startswith('instrument-import-build-'),
        'Unexpected new build root')
    require(not (ROOT / 'build-receipt.json').exists() and not (ROOT / 'source').exists(), 'Never replay a build')
    bound_candidate()
    spec = json.loads((ROOT / 'build-input.json').read_bytes())
    source = json.loads((ROOT / 'tooling-source-index.json').read_bytes())
    require(source['head'] == spec['toolingCommit'] and
        hashlib.sha256(json.dumps(source, sort_keys=True).encode()).hexdigest() == spec['toolingSourceIndexSha256'],
        'Build tooling source identity differs')
    for name in ['build-input.json', 'tooling-source-index.json', 'proof-source-review.json', 'source.tar.gz', 'source-index.json']:
        path = ROOT / name
        require(not path.is_symlink() and path.is_file() and path.stat().st_mode & 0o777 == 0o400,
            'Build authority or source is not immutable')
    require_source_set({name: item['sha256'] for name, item in source['files'].items()})
    for name, item in source['files'].items():
        require(pathlib.PurePosixPath(name).name == name and not (ROOT / name).is_symlink() and
            (ROOT / name).stat().st_mode & 0o777 == 0o400 and sha(ROOT / name) == item['sha256'], 'Build tooling changed')
    source_review = json.loads((ROOT / 'proof-source-review.json').read_bytes())
    require(source_review['id'] == spec['proofSourceReviewId'] and
        hashlib.sha256(json.dumps(source_review, sort_keys=True).encode()).hexdigest() == spec['proofSourceReviewRawSha256'],
        'Build source authority differs')
    source_review_pass(source_review, source['head'], {name: item['sha256'] for name, item in source['files'].items()})
    require(spec['rootName'] == ROOT.name and spec['head'] ==
        CANDIDATE_HEAD and spec['auditedPrHead'] ==
        AUDITED_PR_HEAD and spec['baseHead'] ==
        BASE_HEAD and spec['pr'] == PR_NUMBER and
        spec['mergeBaseHead'] == MERGE_BASE_HEAD and
        spec['mergeParents'] == [MERGE_BASE_HEAD, spec['auditedPrHead']] and
        type(spec['auditReviewId']) is int and spec['auditReviewId'] == AUDIT_REVIEW_ID and
        spec['originalProofRoot'] == EXPECTED_PROOF_ROOT and spec['firstProofPolicy'] == FIRST_PROOF_POLICY, 'Exact forward merge required')
    require(spec['tree'] == MERGED_TREE and
        spec['auditedTree'] == MERGED_TREE and
        spec['auditReviewId'] and spec['mainCiRunId'], 'Audited merged union evidence required')
    require(spec['labAndHubBuildsOwnedByYY'] is True and
        spec['releaseWindowControl'] == 'RELEASE_DAY_DISK_ABORTS_ACCEPTED', 'Both workload pins required')
    archive = ROOT / 'source.tar.gz'
    index_path = ROOT / 'source-index.json'
    require(sha(archive) == spec['archiveSha256'] and sha(index_path) == spec['indexSha256'], 'Raw source hashes differ')
    index = json.loads(index_path.read_bytes())
    require(index['head'] == spec['head'] and index['status'] == 'COMMITTED_GIT_BLOB_INDEX', 'Wrong Git source head')
    expected = {row['path']: row for row in index['entries']}
    require(len(expected) == len(index['entries']), 'Duplicate archive identity')
    before = {path: shutil.disk_usage(path).free for path in ['/opt/lims', '/var/lib/docker']}
    require(min(before.values()) >= FLOOR + 4 * 1024 * 1024 * 1024, 'Build allocation reserve refused')
    source = ROOT / 'source'; source.mkdir(mode=0o700)
    with tarfile.open(archive) as bundle:
        files = [member for member in bundle.getmembers() if not member.isdir()]
        require(len(files) == len(expected) and {member.name for member in files} == set(expected), 'Archive inventory differs')
        for member in files:
            name = pathlib.PurePosixPath(member.name)
            require(not name.is_absolute() and '..' not in name.parts, 'Unsafe archive path')
            row = expected[member.name]
            if member.issym():
                require(row['mode'] == '120000' and 'node_modules' in name.parts, 'Unexpected source symlink')
                data = member.linkname.encode('utf-8')
            else:
                require(member.isfile() and row['mode'] in ['100644', '100755'], 'Unexpected source file type')
                data = bundle.extractfile(member).read()
            require(len(data) == row['bytes'] and hashlib.sha256(data).hexdigest() == row['sha256'],
                'Archive bytes differ: ' + member.name)
            require(hashlib.sha1(('blob ' + str(len(data)) + '\0').encode() + data).hexdigest() == row['blob'],
                'Archive Git blob identity differs: ' + member.name)
        ignored = [member.name for member in bundle.getmembers() if 'node_modules' in pathlib.PurePosixPath(member.name).parts]
        members = [member for member in bundle.getmembers() if member.name not in ignored]
        require(all(not member.issym() and not member.islnk() for member in members), 'Unexpected extracted link')
        bundle.extractall(source, members=members, filter='data')
    tag = 'soilfer-lims:audit-' + ROOT.name
    with (ROOT / 'docker-build.log').open('x', encoding='utf-8') as log:
        result = subprocess.run(['docker', 'build', '--progress=plain',
            '--label', 'org.opencontainers.image.revision=' + spec['head'],
            '--label', 'org.opencontainers.image.source=https://github.com/yigini/soilfer-lims',
            '--iidfile', str(ROOT / 'candidate-image.id'), '-t', tag, str(source)],
            stdout=log, stderr=subprocess.STDOUT, timeout=2400)
    require(result.returncode == 0, 'Candidate build failed; retain its log and source')
    image = (ROOT / 'candidate-image.id').read_text().strip()
    inspected = json.loads(subprocess.check_output(['docker', 'image', 'inspect', image], text=True, timeout=15))[0]
    require(inspected['Id'] == image and inspected['Config']['Labels']['org.opencontainers.image.revision'] == spec['head'],
        'Built image revision differs')
    after = {path: shutil.disk_usage(path).free for path in before}
    require(min(after.values()) >= FLOOR, 'Post-build reserve refused; do not copy/deploy')
    receipt = {'status': 'BUILT_ONLY_NOT_DEPLOYED', 'head': spec['head'], 'image': image, 'tag': tag,
        'sourceArchiveSha256': spec['archiveSha256'], 'sourceIndexSha256': spec['indexSha256'],
        'verifiedGitBlobCount': len(expected), 'verifiedUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'imageBytes': inspected['Size'], 'reserveBytes': FLOOR, 'freeBytesBefore': before, 'freeBytesAfter': after,
        'buildLogSha256': sha(ROOT / 'docker-build.log'), 'productionDatabaseMounts': 0,
        'dockerIgnoredArchiveMembersNotExtracted': ignored, 'auditReviewId': spec['auditReviewId'],
        'mainCiRunId': spec['mainCiRunId'], 'tree': spec['tree']}
    receipt.update({'toolingCommit': spec['toolingCommit'], 'proofSourceReviewId': spec['proofSourceReviewId'],
        'toolingSourceIndexSha256': spec['toolingSourceIndexSha256'],
        'proofSourceReviewRawSha256': spec['proofSourceReviewRawSha256'], 'builderSha256': sha(pathlib.Path(__file__))})
    with (ROOT / 'build-receipt.json').open('x', encoding='utf-8') as out:
        json.dump(receipt, out, indent=2)
    (ROOT / 'build-receipt.json').chmod(0o400)
    print(json.dumps(receipt), flush=True)


if __name__ == '__main__':
    main()
