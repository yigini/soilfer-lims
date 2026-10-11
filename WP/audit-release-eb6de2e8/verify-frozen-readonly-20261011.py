"""Read-only validation of existing reviewed artifacts; never replays proof."""
import hashlib, json, pathlib, subprocess, sys, tarfile
root = pathlib.Path('/opt/lims/releases/combined-release-eb6de2e8-feac6534-20261010T214130Z')
sys.path.insert(0, str(root))
import prepare_manifest as p
import release_support as s
manifest = json.loads((root / 'prepared-manifest.json').read_text())
assert s.sha(root / 'prepared-manifest.json') == 'e6b8b8decd82fcb5fde05547bb0a8c32ce60081bcad1f76570e05034f724114a'
for name, expected in manifest['files'].items():
    file = root / name
    assert not file.is_symlink() and s.sha(file) == expected
    assert file.stat().st_mode & 0o777 == 0o400
proof = json.loads((root / 'rehearsal-receipt.json').read_text())
build = json.loads((root / 'build-receipt.json').read_text())
gates = json.loads((root / 'pr-gates-prepared.json').read_text())
p.validate(proof, build, gates)
assert s.sha(pathlib.Path(manifest['rehearsalRoot']) / 'rehearsal-receipt.json') == s.sha(root / 'rehearsal-receipt.json')
assert s.sha(root / 'source.tar.gz') == build['sourceArchiveSha256']
assert s.sha(root / 'source-index.json') == build['sourceIndexSha256']
index = json.loads((root / 'source-index.json').read_text())
assert index['head'] == s.HEAD and len(index['entries']) == 2224
with tarfile.open(root / 'source.tar.gz', 'r:gz') as archive:
    members = {member.name:member for member in archive.getmembers() if not member.isdir()}
    assert set(members) == {row['path'] for row in index['entries']}
    for row in index['entries']:
        member = members[row['path']]
        if member.issym():
            assert row['mode'] == '120000' and 'node_modules' in pathlib.PurePosixPath(member.name).parts
            data = member.linkname.encode('utf8')
        else:
            assert member.isfile() and row['mode'] in ['100644', '100755']
            data = archive.extractfile(member).read()
        assert len(data) == row['bytes']
        assert hashlib.sha256(data).hexdigest() == row['sha256']
        assert hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest() == row['blob']
image = json.loads(subprocess.check_output(['docker', 'image', 'inspect', manifest['image']], text=True))[0]
assert image['Id'] == manifest['image'] and image['Size'] == 413507742
assert image['Config']['Labels']['org.opencontainers.image.revision'] == s.HEAD
assert not (root / 'production-gate.json').exists() and not (root / 'production-receipt.json').exists()
print(json.dumps({'status':'VERIFIED_EXISTING_PROOF_AND_KIT_READ_ONLY', 'utc':s.utc(),
    'head':s.HEAD, 'manifestSha256':s.sha(root / 'prepared-manifest.json'),
    'files':len(manifest['files']), 'sourceBlobs':len(index['entries']),
    'installerStages':len(proof['installers']), 'memoryMeasurements':len(proof['cliMemory']),
    'endRepeats':len(proof['repeatInstallers']), 'startupReady':len(proof['startupReady']),
    'apiChecks':proof['apiChecks'], 'probes':len(proof['probes']),
    'maximumCliPeakBytes':max(r['cgroupMemoryPeak']['releaseCliPeakBytes'] for r in proof['cliMemory'].values()),
    'preservation':proof['preservation'], 'image':manifest['image'], 'imageBytes':image['Size']}))
