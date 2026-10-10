"""Build only. Never mounts live volumes, stops writers or deploys an image."""
import datetime, hashlib, json, pathlib, shutil, subprocess, tarfile

ROOT = pathlib.Path(__file__).resolve().parent
HEAD = 'eb6de2e88df889be28972d393662ff0fc0abf711'
SOURCE_SHA256 = '7e6f719cc126f5987a65fdd5ddf0db2318f64153b736bb7bdc2d7589f65f6d29'
RESERVE = 8589934592

def sha(path):
    value = hashlib.sha256()
    with path.open('rb') as stream:
        while block := stream.read(1024 * 1024):
            value.update(block)
    return value.hexdigest()

if __name__ == '__main__':
    assert ROOT.parent == pathlib.Path('/opt/lims/releases')
    assert ROOT.name == 'combined-eb6de2e8-20261010T154300Z'
    assert not (ROOT / 'build-receipt.json').exists(), 'Never replay this build'
    archive = ROOT / 'source.tar.gz'
    assert sha(archive) == SOURCE_SHA256
    before = {path: shutil.disk_usage(path).free for path in ['/opt/lims', '/var/lib/docker']}
    assert min(before.values()) >= RESERVE, 'Insufficient preparation reserve'
    source = ROOT / 'source-retry1'
    source.mkdir(mode=0o700)
    with tarfile.open(archive) as bundle:
        # main contains a tracked node_modules symlink. Docker already excludes
        # node_modules; never materialize an absolute dependency link on the host.
        excluded = [member.name for member in bundle.getmembers()
                    if 'node_modules' in pathlib.PurePosixPath(member.name).parts]
        members = [member for member in bundle.getmembers() if member.name not in excluded]
        assert all(not pathlib.PurePosixPath(member.name).is_absolute()
                   and '..' not in pathlib.PurePosixPath(member.name).parts
                   and not member.issym() and not member.islnk()
                   for member in members)
        bundle.extractall(source, members=members, filter='data')
    tag = 'soilfer-lims:audit-combined-eb6de2e8-20261010T154300Z'
    with (ROOT / 'docker-build.log').open('x') as log:
        result = subprocess.run(['docker', 'build', '--progress=plain',
            '--label', 'org.opencontainers.image.revision=' + HEAD,
            '--label', 'org.opencontainers.image.source=https://github.com/yigini/soilfer-lims',
            '--iidfile', str(ROOT / 'candidate-image.id'), '-t', tag, str(source)],
            stdout=log, stderr=subprocess.STDOUT, timeout=2400)
    assert result.returncode == 0, 'Build failed; see retained log'
    image = (ROOT / 'candidate-image.id').read_text().strip()
    inspected = json.loads(subprocess.check_output(['docker', 'image', 'inspect', image], text=True))[0]
    assert inspected['Config']['Labels']['org.opencontainers.image.revision'] == HEAD
    receipt = {'status': 'BUILT_ONLY_NOT_DEPLOYED', 'head': HEAD, 'image': image,
        'tag': tag, 'sourceArchiveSha256': SOURCE_SHA256,
        'verifiedUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'imageBytes': inspected['Size'], 'reserveBytes': RESERVE,
        'freeBytesBefore': before,
        'freeBytesAfter': {path: shutil.disk_usage(path).free for path in before},
        'buildLogSha256': sha(ROOT / 'docker-build.log'), 'productionDatabaseMounts': 0,
        'dockerIgnoredArchiveMembersNotExtracted': excluded}
    with (ROOT / 'build-receipt.json').open('x') as stream:
        json.dump(receipt, stream, indent=2)
    (ROOT / 'build-receipt.json').chmod(0o400)
    print(json.dumps(receipt), flush=True)
