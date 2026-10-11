"""Explicit image-only cleanup authorized by YY via the current user request.

Inventory first; a separate invocation removes only named, unreferenced LIMS
application images. No force, prune, container removal or filesystem cleanup.
"""
import datetime, hashlib, json, os, pathlib, subprocess, sys

KIT = pathlib.Path('/opt/lims/releases/combined-release-eb6de2e8-feac6534-20261010T214130Z')
EVIDENCE = pathlib.Path('/opt/lims/releases/image-cleanup-feac6534-20261011T053500Z')
LIVE_IMAGE = 'sha256:b02ddff8d7549e981edc49215fef2d54ca654adaa2a8924eceb5d4ea0af00394'
RELEASE_IMAGE = 'sha256:159057d56c456a0c7cdef917fd04f53f9a66d6285cc476d7203d63047bfff8e1'
CANDIDATES = [
    'sha256:4636304d489ccbb9610f285d3d75cc2be7072aafc6ae819ba35f24f0fb983d9f',
    'sha256:45b0ad6e63c16fdded0f8198d313509710a0e81fd98b2a67da151ff1526a4523',
    'sha256:76d5d7ae83a0f97f1732ded554a24670c1ee4c6bd189a01cf9ce2905c559913d',
]

def utc():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()

def run(args):
    return subprocess.check_output(args, text=True, timeout=90)

def sha(file):
    return hashlib.sha256(pathlib.Path(file).read_bytes()).hexdigest()

def save(name, data):
    with (EVIDENCE / name).open('x') as stream:
        stream.write(data if isinstance(data, str) else json.dumps(data, indent=2) + '\n')

def images():
    ids = sorted(set(run(['docker', 'image', 'ls', '-q', '--no-trunc']).split()))
    rows = json.loads(run(['docker', 'image', 'inspect'] + ids))
    return {r['Id']: {'id':r['Id'], 'tags':r.get('RepoTags') or [],
        'digests':r.get('RepoDigests') or [], 'layers':r.get('RootFS', {}).get('Layers', []),
        'parent':r.get('Parent'), 'size':r['Size'],
        'revision':r.get('Config', {}).get('Labels', {}).get('org.opencontainers.image.revision')
        if r.get('Config', {}).get('Labels') else None} for r in rows}

def containers():
    ids = run(['docker', 'ps', '-aq', '--no-trunc']).split()
    rows = json.loads(run(['docker', 'inspect'] + ids)) if ids else []
    return [{'id':r['Id'], 'name':r['Name'], 'image':r['Image'],
        'running':r['State']['Running']} for r in rows]

def kit_check():
    assert sha(KIT / 'prepared-manifest.json') == 'e6b8b8decd82fcb5fde05547bb0a8c32ce60081bcad1f76570e05034f724114a'
    manifest = json.loads((KIT / 'prepared-manifest.json').read_text())
    for name, expected in manifest['files'].items():
        file = KIT / name
        assert not file.is_symlink() and sha(file) == expected, name
    assert not (KIT / 'production-gate.json').exists()
    assert not (KIT / 'production-receipt.json').exists()
    return {'manifestSha256':sha(KIT / 'prepared-manifest.json'),
        'verifiedFrozenFiles':len(manifest['files']), 'checkedUtc':utc()}

def reserve():
    sys.path.insert(0, str(KIT))
    import release_support as s
    db = s.LIVE.stat().st_size
    assets = sum(p.stat().st_size for p in s.ASSETS.rglob('*') if p.is_file())
    image = int(run(['docker', 'image', 'inspect', RELEASE_IMAGE, '--format', '{{.Size}}']))
    required = s.disk_reserve(db, image, assets)
    # The coordinator consumes the stopped DB/assets backups and logs before
    # its installer reserve checks. Include a conservative 256 MiB log budget.
    headroom = db + assets + 268435456
    return {'reserveBytes':required, 'dbBackupBytes':db, 'assetsBytes':assets,
        'logBudgetBytes':268435456, 'backupHeadroomBytes':headroom,
        'requiredFreeBytes':required + headroom, 'freeBytes':s.disk_free(), 'utc':utc()}

def protected(image_map, container_rows):
    keep = {r['image'] for r in container_rows} | {LIVE_IMAGE, RELEASE_IMAGE}
    # Keep all images outside this explicit three-image allowlist, including
    # every YY workload, unnamed builder/base, and previous rollback image.
    keep |= set(image_map) - set(CANDIDATES)
    protected_layers = [image_map[x]['layers'] for x in [LIVE_IMAGE, RELEASE_IMAGE]]
    for key, image in image_map.items():
        layers = image['layers']
        if any(layers and base[:len(layers)] == layers for base in protected_layers):
            keep.add(key)
        if any(image_map[x].get('parent') == key for x in keep if x in image_map):
            keep.add(key)
    return keep

def snapshot(label):
    data = {'utc':utc(), 'images':images(), 'containers':containers(), 'reserve':reserve(),
        'kit':kit_check()}
    save(label + '-images.txt', run(['docker', 'image', 'ls', '--digests', '--no-trunc']))
    save(label + '-df.txt', run(['df', '-B1']))
    save(label + '.json', data)
    return data

mode = sys.argv[1:]
assert mode in [['--inventory'], ['--remove'], ['--sample-2']], 'Explicit mode required'
if mode == ['--inventory']:
    EVIDENCE.mkdir(mode=0o700)
    before = snapshot('before')
    keep = protected(before['images'], before['containers'])
    plan = {'authorization':'Current user request and #162 comment 6105830882; no native-card inspection claimed',
        'protectedImages':sorted(keep), 'candidates':[]}
    for key in CANDIDATES:
        image = before['images'][key]
        assert key not in keep and len(image['tags']) == 1
        assert image['tags'][0].startswith('soilfer-lims:audit-combined-eb6de2e8-')
        assert image['digests'] == ['soilfer-lims@' + key]
        plan['candidates'].append(image)
    save('plan.json', plan)
    print(json.dumps({'evidence':str(EVIDENCE), 'protectedCount':len(keep),
        'candidates':[{'id':r['id'], 'tags':r['tags'], 'size':r['size']} for r in plan['candidates']],
        'reserve':before['reserve'], 'kit':before['kit']}))
elif mode == ['--remove']:
    assert not (EVIDENCE / 'removed.json').exists(), 'Never replay removal'
    before = json.loads((EVIDENCE / 'before.json').read_text())
    plan = json.loads((EVIDENCE / 'plan.json').read_text())
    removed = []
    target = max(11000000000, reserve()['requiredFreeBytes'])
    for key in CANDIDATES:
        if min(reserve()['freeBytes'].values()) >= target:
            break
        current = images()
        refs = containers()
        assert key not in protected(current, refs) and key not in plan['protectedImages']
        assert current[key] == before['images'][key]
        assert run(['docker', 'inspect', 'soilfer-lims', '--format', '{{.Image}}']).strip() == LIVE_IMAGE
        kit_check()
        start = reserve()
        args = ['docker', 'image', 'rm', key]
        result = subprocess.run(args, capture_output=True, text=True, timeout=180)
        row = {'utc':utc(), 'command':args, 'exitCode':result.returncode,
            'stdout':result.stdout, 'stderr':result.stderr, 'before':start, 'after':reserve()}
        save('removal-' + str(len(removed) + 1) + '.json', row)
        assert result.returncode == 0, 'Removal refused; no force or retry'
        assert key not in images(), 'Image still present'
        removed.append(row)
    save('removed.json', removed)
    after = snapshot('after')
    for key in plan['protectedImages']:
        assert after['images'][key] == before['images'][key], 'Protected image changed'
    assert after['containers'] == before['containers'], 'Container inventory changed'
    assert min(after['reserve']['freeBytes'].values()) >= after['reserve']['requiredFreeBytes']
    save('sample-1.json', after['reserve'])
    print(json.dumps({'removed':[r['command'][-1] for r in removed],
        'bytesFreedOnReleaseFilesystem':after['reserve']['freeBytes']['/opt/lims'] - before['reserve']['freeBytes']['/opt/lims'],
        'sample1':after['reserve'], 'protectedImagesUnchanged':len(plan['protectedImages']), 'kit':after['kit']}))
else:
    first = json.loads((EVIDENCE / 'sample-1.json').read_text())
    second = reserve()
    elapsed = (datetime.datetime.fromisoformat(second['utc']) - datetime.datetime.fromisoformat(first['utc'])).total_seconds()
    assert elapsed >= 300, 'Samples must be at least five minutes apart'
    assert min(second['freeBytes'].values()) >= second['requiredFreeBytes']
    drops = {k:first['freeBytes'][k] - second['freeBytes'][k] for k in first['freeBytes']}
    assert max(drops.values()) <= 500000000, 'Unexplained drop exceeds 500 MB'
    save('sample-2.json', second)
    print(json.dumps({'sample2':second, 'elapsedSeconds':elapsed, 'dropBytes':drops, 'kit':kit_check()}))
