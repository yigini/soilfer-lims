"""Read-only original-build verification and exact source export for review only."""
import datetime
import hashlib
import json
from pathlib import Path
import subprocess
import sys

repo = Path(__file__).resolve().parents[2]
directory = Path(__file__).resolve().parent
source = '201bb5fe8fd30cb2991f7169177a864265e6301b'
graph = {}
exec(compile(subprocess.check_output(['git', 'show', source + ':WP/pr284-release/import_source_graph.py'], cwd=repo),
    '/owned-review-graph.py', 'exec'), graph)
files, index = graph['git_source'](source, lambda *args: subprocess.check_output(['git', *args], cwd=repo))
export = directory / 'proof-source-export-201bb5fe'
assert not export.exists(), 'Never overwrite a source export'
export.mkdir()
for name, raw in files.items():
    with (export / name).open('xb') as stream: stream.write(raw)
    if name.endswith('.py'): compile(raw, str(export / name), 'exec')
with (export / 'source-index.json').open('x', encoding='utf-8', newline='\n') as stream: json.dump(index, stream, indent=2)
sys.path.insert(0, str(export))
import import_proof_contract as contract
contract.bound_candidate()
contract.require_first_proof_root(contract.EXPECTED_PROOF_ROOT)
assert contract.AUDIT_REVIEW_ID == 6125341751 and contract.CANDIDATE_HEAD == '959d17e11c357266f7c2a41b0c84ab76914c591e'

guards = {}
for platform in ['windows', 'linux']:
    prefix = directory / ('pr294-sidecar-source-201bb5fe-' + platform + '-1450')
    record = json.loads(prefix.with_suffix('.json').read_bytes()); value = record['result']
    assert record['exitCode'] == 0 and value['sourceCommit'] == source and value['tests'] == 185
    assert value['failures'] == value['errors'] == value['skips'] == 0 and value['productionDatabaseAccess'] is False
    assert value['toolingIndex'] == index
    for kind in ['stdout', 'stderr']:
        assert hashlib.sha256(prefix.with_suffix('.' + kind + '.log').read_bytes()).hexdigest() == record[kind + 'Sha256']
    guards[platform] = {key: value[key] for key in ['tests', 'failures', 'errors', 'skips', 'elapsedSeconds', 'completedUtc']}
    guards[platform].update({key: record[key] for key in ['stdoutSha256', 'stderrSha256']})

binding = contract.build_reuse_binding()
remote_input = dict(binding, firstRoot=contract.EXPECTED_PROOF_ROOT, liveImage=contract.LIVE_IMAGE,
    head=contract.CANDIDATE_HEAD, historicalRoot=contract.HISTORICAL_ROOT_PATH,
    historicalReceiptSha256=contract.HISTORICAL_RECEIPT_SHA)
remote_code = '''import datetime,hashlib,json,os,pathlib,subprocess
p=INPUT;b=pathlib.Path(p['buildRoot']);first=pathlib.Path(p['firstRoot'])
def sha(path):
 h=hashlib.sha256()
 with path.open('rb') as stream:
  while block:=stream.read(1024*1024):h.update(block)
 return h.hexdigest()
assert not os.path.lexists(first), 'New first root already exists'
records={}
for name in ['build-receipt.json','source.tar.gz','source-index.json','tooling-source-index.json','proof-source-review.json']:
 path=b/name;assert path.is_file() and not path.is_symlink() and path.stat().st_mode&0o777==0o400
 records[name]={'sha256':sha(path),'bytes':path.stat().st_size,'mode':path.stat().st_mode&0o777}
assert records['build-receipt.json']['sha256']==p['buildReceiptSha256']
built=json.loads((b/'build-receipt.json').read_bytes())
assert built['status']=='BUILT_ONLY_NOT_DEPLOYED' and built['head']==p['head'] and built['productionDatabaseMounts']==0
assert built['toolingCommit']==p['buildSourceCommit'] and built['proofSourceReviewId']==p['buildSourceReviewId']
assert records['source.tar.gz']['sha256']==built['sourceArchiveSha256'] and records['source-index.json']['sha256']==built['sourceIndexSha256']
original=json.loads((b/'tooling-source-index.json').read_bytes());review=json.loads((b/'proof-source-review.json').read_bytes())
assert original['head']==p['buildSourceCommit'] and hashlib.sha256(json.dumps(original,sort_keys=True).encode()).hexdigest()==p['buildSourceIndexSha256']
assert review['id']==p['buildSourceReviewId'] and hashlib.sha256(json.dumps(review,sort_keys=True).encode()).hexdigest()==p['buildSourceReviewRawSha256']
for name,row in original['files'].items():
 assert pathlib.PurePosixPath(name).name==name
 path=b/name;assert path.is_file() and not path.is_symlink() and path.stat().st_mode&0o777==0o400 and sha(path)==row['sha256']
image=json.loads(subprocess.check_output(['docker','image','inspect',p['image']],text=True,timeout=15))[0]
tag_image=json.loads(subprocess.check_output(['docker','image','inspect',built['tag']],text=True,timeout=15))[0]
assert image['Id']==tag_image['Id']==built['image']==p['image'] and image['Size']==built['imageBytes']==p['imageBytes']
assert image['Config']['Labels']['org.opencontainers.image.revision']==p['head']
assert built['tag'] in image['RepoTags']
names=subprocess.check_output(['docker','ps','--format','{{.Names}}'],text=True,timeout=15).splitlines()
assert not any(name.startswith('lims-owned-') for name in names), 'Another owned writer is active'
live=json.loads(subprocess.check_output(['docker','inspect','soilfer-lims'],text=True,timeout=15))[0]
assert live['Image']==p['liveImage'] and live['State']['Running'] and live['State']['Health']['Status']=='healthy' and live['RestartCount']==0
assert sha(pathlib.Path(p['historicalRoot'])/'production-receipt.json')==p['historicalReceiptSha256']
unit='lims-build-'+b.name.lower()+'.service'
unit_state=dict(line.split('=',1) for line in subprocess.check_output(['systemctl','show',unit,'-p','ActiveState','-p','SubState','-p','ExecMainStatus'],text=True,timeout=15).splitlines())
assert unit_state=={'ExecMainStatus':'0','ActiveState':'inactive','SubState':'dead'}
print(json.dumps({'observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'newRootAbsent':str(first),
 'originalBuildBinding':p,'originalAuthorityFiles':records,'originalSourceFileCount':len(original['files']),
 'image':{'Id':image['Id'],'Size':image['Size'],'revision':image['Config']['Labels']['org.opencontainers.image.revision'],'originalTag':built['tag']},
 'unitState':unit_state,'activeOwnedWriters':0,'liveImage':live['Image'],'liveHealth':live['State']['Health']['Status'],'liveRestartCount':live['RestartCount'],
 'freeBytes':os.statvfs('/opt/lims').f_bavail*os.statvfs('/opt/lims').f_frsize,'productionMutations':0,'sqliteConnections':0}))
'''.replace('INPUT', repr(remote_input))
result = subprocess.run(['ssh', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15', 'root@46.19.33.37', 'python3', '-B', '-'],
    input=remote_code, text=True, encoding='utf-8', capture_output=True, timeout=60)
for kind in ['stdout', 'stderr']:
    with (directory / ('pr294-sidecar-preflight-1450.' + kind + '.log')).open('xb') as stream: stream.write(getattr(result, kind).encode())
assert result.returncode == 0, result.stderr
preflight = json.loads(result.stdout)
with (directory / 'pr294-sidecar-preflight-1450.json').open('x', encoding='utf-8', newline='\n') as stream: json.dump(preflight, stream, indent=2)
def github(endpoint):
    return json.loads(subprocess.check_output(['gh', 'api', endpoint], cwd=repo, text=True, encoding='utf-8'))
assert github('repos/yigini/soilfer-lims/git/ref/heads/main')['object']['sha'] == contract.CANDIDATE_HEAD
ci = github('repos/yigini/soilfer-lims/actions/runs/38256676268')
assert ci['head_sha'] == contract.CANDIDATE_HEAD and ci['status'] == 'completed' and ci['conclusion'] == 'success'
contract.require_pr_review(github('repos/yigini/soilfer-lims/issues/comments/6125341751'))
tokens = contract.release_binding_tokens() + [source, 'labAndHubBuildsOwnedByYY=true',
    'RELEASE_DAY_DISK_ABORTS_ACCEPTED', 'CORE_DEALLOCATION_CONFIRMATION_DEADLINE_SECONDS=10',
    'BASELINE_ATTEMPTS_MAX=3', 'BASELINE_CONFIRMATION_DEADLINE_SECONDS=10',
    'proofBaselineLayoutPolicy=EXACT_HASHED_IMPORT_PROOF_AUTHORITY_LAYOUT',
    'refusalScopeCommentId=' + str(contract.REFUSAL_SCOPE_COMMENT_ID), contract.REFUSAL_POLICY,
    contract.CARDINALITY_POLICY, 'refusalPairingScopeCommentId=' + str(contract.REFUSAL_PAIRING_SCOPE_COMMENT_ID),
    'schedulerRefusalPairing=' + contract.REFUSAL_PAIRING_POLICY, 'REFUSAL_PAIR_WINDOW_SECONDS=1']
tokens += [name + '=' + item['sha256'] for name, item in sorted(index['files'].items())]
body = '''Claudio: NEW sidecar forward-source review request for PR294 / #200. This is proposed source, not a Source PASS or execution authority.

Exact source201bb5fe8fd30cb2991f7169177a864265e6301b implements your native repeat-sidecar diagnosis and original-build reuse conditions. Application main959d17e11c357266f7c2a41b0c84ab76914c591e, exact application audit6125341751, PR/main CI and audited tree336223df0161caeae4eb7db1e40df748d8ba110f remain unchanged and green. No application changes, new PR, rebuild, proof, kit, gate, production action or cleanup.

The original134000Z proof remains permanently FAILED/e85e14bb. Its main file was byte-identical; the readonly NO_OP created an empty WAL and32KiB SHM. Both failed105200Z and134000Z roots are explicitly excluded even if pinned. The only NEW first root permitted by these source bytes is /opt/lims/releases/instrument-import-proof-959d17e1-20261012T144000Z, unit lims-owned-instrument-import-proof-959d17e1-20261012t144000z.service. The suffix is a reserved identifier, not a launch timestamp. Fresh read-only verification confirms this root is absent and no owned writer is active. This is a new source-bound first run, never a retry of134000Z.

The repeat guard now requires exact main SHA/size/inode/device/mtime/mode, absent or zero-byte WAL with the empty-file hash, and absent or32768-byte SHM. There is no WAL-frame allowance. After the repeat container exits, a new stopped detached raw/scratch/consistent-backup seal must match the entire installed state: all106tables,39receipts, schemas and rows. Only copies are opened by SQLite; originals are never checkpointed or connected. A same-count row mutation, nonempty WAL, different main attribute, wrong SHM allocation or full-state mismatch refuses. The immutable import-repeat-preservation.json and after-repeat-stopped seal are independently reverified during freezing and bound in the fixed62-file future kit. The shared stage applies the same policy in proof and production. Original raw triple-copy guards and existing-row/schema policies remain strict.

The extra stopped seal retains three more DB allocations, raising13 to16. Its actual copy/seal/full-state-scan elapsed time is now recorded and included in measured release-unit headroom. All three CLI and both readiness stages still need60s headroom against600s; the actual five stages plus new seal plus660s observation must leave600s of the5400s unit. Other quiesce/backup/seal/API/ingress/coordination costs remain explicitly unmeasured, never estimated as proven wall time. Absolute/scaled reserve plus16allocations/assets/logs and500MB unexplained-growth abort remain mandatory.

The source separately binds original build root135400Z, immutable0400receipt1a983172, image7aebc035/fullsize/revision, build source630b2354 and source-review6125544861, original builder/preparer hashes and canonical source-index/raw-review hashes. These are separate from the NEW proof source/review. Both build_import.main and prepare_import_build.main now refuse before any operation, so this source cannot start a second build. Fresh read-only verification confirmed all31 original build-source files/modes, receipt/archive/Git index, source-review record, completed unit, image digest/size/revision and original tag unchanged. No retagging or image modification. The proof independently rechecks these authorities and the image before any fresh DB copy; the future manifest, exact-kit tokens and gate also bind the separate build authority.

All185/185Windows and185/185Linux exact-source guards passed with0failures/errors/skips and no production DB access, including a real owned readonly SQLite WAL-open witness, full row-mutation refusal, both disabled build paths and original raw build authority tamper cases. All31 source files compile; all14 historical helpers, old guards, importer/migration/native schema variants and preservation verifier bytes are unchanged. Live51f/d4eb remains healthy with0restarts. Production source is deliberately UNREVIEWED_SIDECAR_FORWARD_REFUSE/0; old63761 cannot freeze. No installer/default-startup replay, database restore, older image, heap increase, cleanup or YY-card answer.

Please review these exact bytes and post a NEW primary Source review: PASS containing every full binding token below. Old6125544861 remains valid only as original build authority and cannot approve this NEW proof source/root. After a correctly bound pass I will reuse the unchanged original image for ONE new first proof, then request a separate production-source review after its actual stopped PASS, followed by one frozen kit/exact-kit audit/fresh single-use gate/forward deployment under YY's standing automatic-after-review go.

'''
body += 'Exact guard evidence: ' + json.dumps(guards, sort_keys=True) + '\n\n' + '\n'.join(tokens) + '\n'
request = directory / 'source-review-201bb5fe-request.md'
with request.open('x', encoding='utf-8', newline='\n') as stream: stream.write(body)
record = {'preparedUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'status': 'NEW_SIDECAR_SOURCE_REQUEST_PREPARED_NOT_APPROVED', 'sourceCommit': source,
    'sourceIndex': index, 'guards': guards, 'originalBuildPreflightSha256': hashlib.sha256(result.stdout.encode()).hexdigest(),
    'requestSha256': hashlib.sha256(request.read_bytes()).hexdigest(), 'newBuildsOrProofs': 0, 'productionOperations': 0}
with (directory / 'pr294-sidecar-source-preparation-1450.json').open('x', encoding='utf-8', newline='\n') as stream: json.dump(record, stream, indent=2)
print(json.dumps({'source': source, 'files': len(files), 'request': str(request),
    'coordinatorSha256': index['files']['rehearse_import.py']['sha256'],
    'contractSha256': index['files']['import_proof_contract.py']['sha256'], 'guards': guards,
    'originalBuildUnchanged': True, 'rootAbsent': preflight['newRootAbsent'], 'newWriter': False}))
