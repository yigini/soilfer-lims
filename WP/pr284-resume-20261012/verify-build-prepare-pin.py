"""Read the completed original build and create its separately bound local pin."""
import base64
import datetime
import hashlib
import json
import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / 'proof-source-export-f5e59428'))
from import_proof_contract import *

BUILD = '/opt/lims/releases/instrument-import-build-5dd5488d-20261012T104515Z'
UNIT = 'lims-build-instrument-import-build-5dd5488d-20261012t104515z.service'


def main():
    output = ROOT / 'build-5dd5488d-104515'
    assert not output.exists(), 'Never overwrite a build verification'
    code = '''import datetime,hashlib,json,pathlib,shutil,subprocess
r=pathlib.Path(BUILD);u=UNIT
def sha(p):
 h=hashlib.sha256()
 with p.open('rb') as f:
  while b:=f.read(1048576):h.update(b)
 return h.hexdigest()
state=dict(line.split('=',1) for line in subprocess.check_output(['systemctl','show',u,'-p','ActiveState','-p','SubState','-p','ExecMainStatus','-p','Result'],text=True).splitlines())
assert state=={'ActiveState':'inactive','SubState':'dead','ExecMainStatus':'0','Result':'success'},state
built=json.loads((r/'build-receipt.json').read_bytes());spec=json.loads((r/'build-input.json').read_bytes())
source=json.loads((r/'tooling-source-index.json').read_bytes());review=json.loads((r/'proof-source-review.json').read_bytes())
index=json.loads((r/'source-index.json').read_bytes())
assert built['status']=='BUILT_ONLY_NOT_DEPLOYED' and built['toolingCommit']==source['head']==spec['toolingCommit']
assert hashlib.sha256(json.dumps(source,sort_keys=True).encode()).hexdigest()==built['toolingSourceIndexSha256']
assert hashlib.sha256(json.dumps(review,sort_keys=True).encode()).hexdigest()==built['proofSourceReviewRawSha256']
assert index['head']==built['head'] and len(index['entries'])==built['verifiedGitBlobCount']
files={}
for name in ['build-receipt.json','build-input.json','source.tar.gz','source-index.json','tooling-source-index.json','proof-source-review.json',*source['files']]:
 p=r/name;assert p.is_file() and not p.is_symlink() and p.stat().st_mode&0o777==0o400
 files[name]={'sha256':sha(p),'bytes':p.stat().st_size,'mode':'0400'}
assert files['source.tar.gz']['sha256']==built['sourceArchiveSha256']
assert files['source-index.json']['sha256']==built['sourceIndexSha256']
assert all(files[n]['sha256']==v['sha256'] for n,v in source['files'].items())
assert sha(r/'docker-build.log')==built['buildLogSha256']
image=json.loads(subprocess.check_output(['docker','image','inspect',built['image']],text=True,timeout=15))[0]
print(json.dumps({'observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'unitState':state,'root':str(r),'unit':u,'built':built,'source':source,'sourceReview':review,'image':{'Id':image['Id'],'Size':image['Size'],'Config':{'Labels':image['Config']['Labels']}},'files':files,'freeBytes':shutil.disk_usage('/opt/lims').free,'productionMutations':0}))
'''.replace('BUILD', repr(BUILD)).replace('UNIT', repr(UNIT))
    result = subprocess.run(['ssh', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15',
        'root@46.19.33.37', 'python3', '-B', '-'], input=code, text=True,
        encoding='utf-8', capture_output=True, timeout=60)
    assert result.returncode == 0, result.stderr
    evidence = json.loads(result.stdout)
    built = evidence['built']
    hashes = {name: row['sha256'] for name, row in evidence['source']['files'].items()}
    source_review_pass(evidence['sourceReview'], 'f5e59428c1bbf19247db2555f5158bc3a2ac5fad', hashes)
    assert built['proofSourceReviewId'] == evidence['sourceReview']['id'] == 6122670828
    assert built['auditReviewId'] == 6121933894 and built['mainCiRunId'] == 38233444989
    assert built['builderSha256'] == hashes['build_import.py']
    pin = {'head': CANDIDATE_HEAD, 'baseHead': BASE_HEAD, 'auditedPrHead': AUDITED_PR_HEAD,
        'pr': PR_NUMBER, 'tree': MERGED_TREE, 'auditedTree': AUDITED_PR_TREE, 'mergeParents': MERGE_PARENTS,
        'auditReviewId': 6121933894, 'mainCiRunId': 38233444989, 'proofSourceReviewId': 6122670828,
        'buildRoot': BUILD, 'buildReceiptSha256': evidence['files']['build-receipt.json']['sha256'],
        'image': built['image'], 'imageBytes': built['imageBytes'],
        'labAndHubBuildsOwnedByYY': True, 'releaseWindowControl': 'RELEASE_DAY_DISK_ABORTS_ACCEPTED'}
    validate_candidate(pin, built, evidence['image'])
    output.mkdir()
    for name in ['build-receipt.json', 'build-input.json', 'source-index.json',
            'tooling-source-index.json', 'proof-source-review.json', 'docker-build.log']:
        subprocess.run(['scp', '-q', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15',
            'root@46.19.33.37:' + BUILD + '/' + name, str(output / name)],
            check=True, capture_output=True, timeout=60)
        digest = hashlib.sha256((output / name).read_bytes()).hexdigest()
        assert digest == (built['buildLogSha256'] if name == 'docker-build.log' else evidence['files'][name]['sha256'])
    index = json.loads((output / 'source-index.json').read_bytes())
    rows = subprocess.check_output(['git', 'ls-tree', '-r', '-z', CANDIDATE_HEAD]).split(b'\0')
    expected = {}
    for raw in filter(None, rows):
        metadata, path = raw.decode().split('\t', 1)
        mode, kind, blob = metadata.split()
        assert kind == 'blob'
        expected[path] = {'mode': mode, 'blob': blob}
    assert len(expected) == len(index['entries']) == built['verifiedGitBlobCount']
    assert all(row['path'] in expected and all(row[key] == value for key, value in expected[row['path']].items())
        for row in index['entries'])
    evidence['independentRawGitIndexVerified'] = True
    with (output / 'independent-verification.json').open('xb') as stream:
        stream.write((json.dumps(evidence, indent=2) + '\n').encode())
    data = (json.dumps(pin, indent=2) + '\n').encode()
    with (ROOT / 'target-pin-5dd5488d.json').open('xb') as stream:
        stream.write(data)
    print(json.dumps({'status': 'ORIGINAL_BUILD_INDEPENDENT_READ_ONLY_PASS',
        'completedUtc': built['verifiedUtc'], 'head': built['head'], 'image': built['image'],
        'imageBytes': built['imageBytes'], 'buildReceiptSha256': pin['buildReceiptSha256'],
        'verifiedGitBlobCount': built['verifiedGitBlobCount'],
        'targetPinSha256': hashlib.sha256(data).hexdigest(), 'freeBytes': evidence['freeBytes'],
        'productionMutations': 0}))


if __name__ == '__main__':
    main()
