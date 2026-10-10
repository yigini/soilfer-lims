"""Build committed, individually verified source bytes without live mounts."""
import datetime, hashlib, json, pathlib, shutil, subprocess, tarfile

ROOT = pathlib.Path(__file__).resolve().parent
RESERVE = 8589934592

def sha(file):
    value = hashlib.sha256()
    with pathlib.Path(file).open('rb') as stream:
        while block := stream.read(1024 * 1024):
            value.update(block)
    return value.hexdigest()

if __name__ == '__main__':
    assert ROOT.parent == pathlib.Path('/opt/lims/releases') and ROOT.name.startswith('combined-eb6de2e8-')
    assert not (ROOT / 'build-receipt.json').exists(), 'Never replay a retained build'
    spec = json.loads((ROOT / 'build-input.json').read_text())
    assert spec['rootName'] == ROOT.name and len(spec['head']) == 40
    archive = ROOT / 'source.tar.gz'
    assert sha(archive) == spec['archiveSha256']
    assert sha(ROOT / 'source-index.json') == spec['indexSha256']
    index = json.loads((ROOT / 'source-index.json').read_text())
    assert index['head'] == spec['head'] and index['status'] == 'COMMITTED_GIT_BLOB_INDEX'
    expected = {row['path']: row for row in index['entries']}
    before = {path: shutil.disk_usage(path).free for path in ['/opt/lims', '/var/lib/docker']}
    assert min(before.values()) >= RESERVE, 'Insufficient preparation reserve'
    source = ROOT / 'source'
    source.mkdir(mode=0o700)
    with tarfile.open(archive) as bundle:
        files = [member for member in bundle.getmembers() if not member.isdir()]
        assert len(files) == len(expected) and {member.name for member in files} == set(expected)
        for member in files:
            row = expected[member.name]
            assert not pathlib.PurePosixPath(member.name).is_absolute() and '..' not in pathlib.PurePosixPath(member.name).parts
            if member.issym():
                assert row['mode'] == '120000' and 'node_modules' in pathlib.PurePosixPath(member.name).parts
                data = member.linkname.encode('utf8')
            else:
                assert member.isfile() and row['mode'] in ['100644','100755']
                data = bundle.extractfile(member).read()
            assert len(data) == row['bytes'] and hashlib.sha256(data).hexdigest() == row['sha256'], 'Archive bytes differ: ' + member.name
        excluded = [member.name for member in bundle.getmembers() if 'node_modules' in pathlib.PurePosixPath(member.name).parts]
        members = [member for member in bundle.getmembers() if member.name not in excluded]
        assert all(not member.issym() and not member.islnk() for member in members)
        bundle.extractall(source, members=members, filter='data')
    tag = 'soilfer-lims:audit-' + ROOT.name
    with (ROOT / 'docker-build.log').open('x') as log:
        result = subprocess.run(['docker', 'build', '--progress=plain',
            '--label', 'org.opencontainers.image.revision=' + spec['head'],
            '--label', 'org.opencontainers.image.source=https://github.com/yigini/soilfer-lims',
            '--iidfile', str(ROOT / 'candidate-image.id'), '-t', tag, str(source)],
            stdout=log, stderr=subprocess.STDOUT, timeout=2400)
    assert result.returncode == 0, 'Build failed; see retained log'
    image = (ROOT / 'candidate-image.id').read_text().strip()
    inspected = json.loads(subprocess.check_output(['docker','image','inspect',image],text=True))[0]
    assert inspected['Config']['Labels']['org.opencontainers.image.revision'] == spec['head']
    receipt = {'status':'BUILT_ONLY_NOT_DEPLOYED','head':spec['head'],'image':image,'tag':tag,
        'sourceArchiveSha256':spec['archiveSha256'],'sourceIndexSha256':spec['indexSha256'],
        'verifiedGitBlobCount':len(expected),'verifiedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'imageBytes':inspected['Size'],'reserveBytes':RESERVE,'freeBytesBefore':before,
        'freeBytesAfter':{path:shutil.disk_usage(path).free for path in before},
        'buildLogSha256':sha(ROOT/'docker-build.log'),'productionDatabaseMounts':0,
        'dockerIgnoredArchiveMembersNotExtracted':excluded}
    with (ROOT/'build-receipt.json').open('x') as stream:
        json.dump(receipt,stream,indent=2)
    (ROOT/'build-receipt.json').chmod(0o400)
    print(json.dumps(receipt),flush=True)
