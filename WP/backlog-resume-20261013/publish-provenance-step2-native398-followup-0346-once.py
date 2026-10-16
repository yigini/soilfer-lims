"""Publish the single delivered Step 2 native follow-up. No proof/operator calls."""
import concurrent.futures
import datetime
import hashlib
import json
import os
import pathlib
import subprocess
import tempfile

W = pathlib.Path(__file__).resolve().parents[2]
REL = 'WP/batch-proof-provenance-step2-be837974-20261016'
B = W / REL
D = B / 'native-source-review398-followup-0345-once'
P = B / 'native-source-review398-followup-0346-publication-once'
SOURCE = '937901c7514437fc3937639454e621d1bfd68dc4'
PRIOR_HEAD = '5ec68286212b8446f45085ed429612c75564e919'


def command(*args, input=None):
    return subprocess.check_output(args, cwd=W, input=input, timeout=120)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def encode(value):
    return json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(',', ':')).encode() + b'\n'


def blob(data):
    return hashlib.sha1(('blob ' + str(len(data)) + '\0').encode() + data).hexdigest()


assert not P.exists()
assert command('git', 'branch', '--show-current').decode().strip() == 'audit/release-eb6de2e8'
assert command('git', 'rev-parse', 'HEAD').decode().strip() == PRIOR_HEAD
assert not command('git', 'diff', '--cached', '--name-only').strip()
record = json.loads((D / 'native-delivery-derived-record.json').read_bytes())
intent = json.loads((D / 'native-followup-intent.json').read_bytes())
assert record['delivery'] == 'VISUALLY_VERIFIED_SENT_BUBBLE_AND_EMPTY_RIGHT_COMPOSER_AFTER_ONE_RETURN'
assert record['requestId'] == intent['requestId'] == 6207359773
assert record['returnCount'] == 1 and record['noDuplicateNative'] is True
assert record['sourceOperators'] == record['productionOperations'] == record['testsReplayed'] == 0
assert (D / 'native-followup-actual-sent.txt').read_bytes() == intent['body'].encode()
assert datetime.datetime.fromisoformat(intent['at'].replace('Z', '+00:00')) >= datetime.datetime.fromisoformat('2026-10-16T03:43:36+00:00')
source_index = json.loads((B / 'exact-source-review398-once/source-index.json').read_bytes())
assert source_index['head'] == SOURCE and len(source_index['files']) == 31
for name, pin in source_index['files'].items():
    data = (B / name).read_bytes()
    assert len(data) == pin['bytes'] and sha(data) == pin['sha256'], name
app = json.loads((W / 'WP/startup-order-readiness-20261015/full-pinned-copy-retention-bound-ordinary-once/source-before.json').read_bytes())
assert len(app) == 1333
for name, digest in app.items():
    assert sha((W / name).read_bytes()) == digest, name


def verify_published(ref, index_path, expected_count):
    index_data = command('git', 'show', ref + ':' + index_path)
    assert index_data == (W / index_path).read_bytes()
    rows = json.loads(index_data)['bindings']
    assert len(rows) + 1 == expected_count
    batch = command('git', 'cat-file', '--batch', input=('\n'.join(ref + ':' + row['path'] for row in rows) + '\n').encode())
    at = 0
    for row in rows:
        end = batch.index(b'\n', at)
        oid, kind, size = batch[at:end].decode().split()
        size = int(size)
        at = end + 1
        data = batch[at:at + size]
        at += size
        assert kind == 'blob' and size == row['bytes'] and oid == row['gitBlobOid']
        assert sha(data) == row['sha256'] and blob(data) == oid and batch[at:at + 1] == b'\n', row['path']
        at += 1
    assert at == len(batch)
    return {'head': ref, 'index': index_path, 'indexSha256': sha(index_data), 'indexGitBlobOid': blob(index_data), 'rawBindingsVerifiedIncludingIndex': expected_count}


publications = [
    verify_published(SOURCE, REL + '/source398-complete-publication-once/publication-index.json', 737),
    verify_published(PRIOR_HEAD, REL + '/exact-source-review398-handoff-publication-once/publication-index.json', 56),
]
endpoints = {
    'fresh-overlap-comments-original.json': 'repos/yigini/soilfer-lims/issues/162/comments?since=2026-10-16T03:23:00Z&per_page=100',
    'fresh-main-original.json': 'repos/yigini/soilfer-lims/commits/main',
    'fresh-main-ci-original.json': 'repos/yigini/soilfer-lims/actions/runs/38772398721',
    'fresh-issue191-original.json': 'repos/yigini/soilfer-lims/issues/191',
}
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
    raw = dict(zip(endpoints, executor.map(lambda endpoint: command('gh', 'api', endpoint), endpoints.values())))
comments = json.loads(raw['fresh-overlap-comments-original.json'])
assert len(comments) < 100
own = next(c for c in comments if c['id'] == 6207359773)
assert own['created_at'] == own['updated_at'] == '2026-10-16T03:23:36Z'
assert sha(own['body'].encode()) == '9c5c0f2a285a9654d9cf11daca6fb4046bf09aa00e004edf3e59a60ff3d2d8eb'
assert json.loads(raw['fresh-main-original.json'])['sha'] == 'be8379745bdfae52ce46496ff26514dc7d729640'
ci = json.loads(raw['fresh-main-ci-original.json'])
assert (ci['status'], ci['conclusion'], ci['run_attempt'], ci['event'], ci['head_sha']) == ('completed', 'success', 1, 'push', 'be8379745bdfae52ce46496ff26514dc7d729640')
assert json.loads(raw['fresh-issue191-original.json'])['state'] == 'closed'
new_ids = [c['id'] for c in comments if c['id'] != 6207359773]
observed = datetime.datetime.now(datetime.timezone.utc).isoformat()
P.mkdir()
for name, data in raw.items():
    (P / name).write_bytes(data)
derived = {'observedAt': observed, 'sourceHead': SOURCE, 'sourceFilesVerified': 31, 'appFilesVerified': 1333,
           'publicationsReverified': publications, 'nativeDelivery': record, 'newOverlapCommentIds': new_ids,
           'actualSourceVerdictIndependentlyRetained': False, 'newCommentsRequireFullReadBeforeAnyOperator': True,
           'testsReplayed': 0, 'hostCalls': 0, 'proofOperatorCalls': 0}
(P / 'independent-boundary-record.json').write_bytes(encode(derived))
status = ('No later GH comment observed at this capture; actual NEW exact SourcePASS still pending.' if not new_ids else
          'Later GH comments observed: ' + ','.join(map(str, new_ids)) + '; FULL actual verdict/conditions require independent retention before any operator.')
prefix = f'''LATEST NATIVE STEP2 SOURCE FOLLOW-UP DELIVERED ONCE - {record['observedAt']}.
ONE agreed 20-minute native follow-up for exact SourceReview6207359773 delivered after03:43:36UTC to fresh actual Claude2888208 / LIMS Audit / Lab workflow audit and plan. Correct matching thread, BOTH composers EMPTY/right caret, exact whole own draft readback/head+end inspected, ONE Return, actual sent bubble plus EMPTY right composer visually verified. Centre/human drafts/cards preserved. Accessibility lagged type/send; screenshot governed/no repeated input. Exact sent text and original accessibility/explicit visual-derived record at {REL}/native-source-review398-followup-0345-once. Native follow-up COMPLETE; NEVER duplicate native/GH request/ACK/result.
Actual native displayed checklist says398/398 Python3.12+3.9 and four authority pins/170 bindings matched; stop-post/controller source review IN PROGRESS and verdict posting NOT DONE. This is displayed reviewer progress ONLY, not independent reviewer-process/test/finalPASS proof. Fresh GH {observed}: {status}
All31 source/1333 frozen app hashes unchanged; all737 sourcepublication and56 handoff rawGitOID-SHA256-length bindings reverified. Source937901c7514437fc3937639454e621d1bfd68dc4 remains frozen/final398LOCAL+398ACTUALhost3.9.23 remains closed, no test replay. Mainbe837974/mainCI38772398721 attempt1 push CLOSED SUCCESS/#191CLOSED. New prepare/launch/run UNEXECUTED except priorcompile/import/closedfakeguards; no package/root050000/unit/proof/production operation. No private diagnostic bytes fetched/keyHOST0400.
NEXT FULL actual NEW exact31SHA+170tokens verdict/conditions, uneditedapp1236702slugclaude/id>6206990387/created>02:55:36Z. On PASS retain raw/ownapproval/all737sourcebindings/all31+1333/current4audits6rules2postreboot memory/jobs/diagnostic scopes/privacy/acceptance/nolaterfailure BEFOREONEpackage/publish/launcher with freshR4+10GB beforeROOT/immediatelyUNIT/runtime/unusedrootunit. Findings=>genuinelyNEWsource+meaningfulguards/newreview/no oldhelper replay. UnknowninspectSAMEnewrootunitNEVERredispatch. SourcePASS qualification-only/notkitgate/deploy. Strictpairing/addedrows/orphans/secondnaturalidempotence/ownunitmemory+exactownerExecStopPost/EVERYcontainer805600/refusals/full11242/science/N25MIN64/floor4GiBlogs10GB/500MB retained. Futurekitgate disclose174newEXPECTED22holds20existingZMB-LAB1/managerimpact/countsmaydiff PLUS9to10minrestart/exactproduction600deadlinefailure. MainMERGEHOLD/233000latestpassingKEEPIT/R2COMPLETE/noprune/YY320GiBalreadyvisible/no growrestart/no103/noagentsnewchatworktreecheckoutconcurrentwriter/humansheld. SAMEheartbeatACTIVE2min/restore10ONLYactualbeDEPLOYED+ClactualpostdeployPASS. Preserve ALL older history verbatim below.

'''
(P / 'checkpoint-prefix.txt').write_bytes(prefix.encode())
readmes = ['WP/audit-release-eb6de2e8/README.md', 'WP/runtime-recovery-kobo/README.md']
for rel in readmes:
    path = W / rel
    old = path.read_bytes()
    path.write_bytes(prefix.encode() + old)
    assert path.read_bytes()[len(prefix.encode()):] == old
paths = sorted({p.relative_to(W).as_posix() for p in D.iterdir() if p.is_file()} |
               {p.relative_to(W).as_posix() for p in P.iterdir() if p.is_file()} |
               {pathlib.Path(__file__).resolve().relative_to(W).as_posix()} | set(readmes))
rows = []
for rel in paths:
    data = (W / rel).read_bytes()
    rows.append({'path': rel, 'bytes': len(data), 'sha256': sha(data), 'gitBlobOid': blob(data)})
(P / 'publication-index.json').write_bytes(encode({'sourceHead': SOURCE, 'nativeFollowupComplete': True, 'bindings': rows}))
paths.append((P / 'publication-index.json').relative_to(W).as_posix())
descriptor, path_file = tempfile.mkstemp(prefix='lims-native398-0346-', suffix='.paths')
os.close(descriptor)
pathlib.Path(path_file).write_bytes(b'\0'.join(p.encode() for p in paths) + b'\0')
command('git', '-c', 'core.longpaths=true', '-c', 'core.autocrlf=false', '--literal-pathspecs', 'add', '-f', '--pathspec-from-file=' + path_file, '--pathspec-file-nul')
assert {p.decode() for p in command('git', 'diff', '--cached', '--name-only', '-z').split(b'\0') if p} == set(paths)


def verify_batch(ref):
    batch = command('git', 'cat-file', '--batch', input=('\n'.join(ref + p for p in paths) + '\n').encode())
    at = 0
    for rel in paths:
        end = batch.index(b'\n', at)
        oid, kind, size = batch[at:end].decode().split()
        size = int(size)
        at = end + 1
        data = batch[at:at + size]
        at += size
        assert kind == 'blob' and data == (W / rel).read_bytes() and blob(data) == oid and batch[at:at + 1] == b'\n', rel
        at += 1
    assert at == len(batch)


verify_batch(':')
command('git', 'commit', '-m', 'Retain single native Step 2 source review follow-up')
head = command('git', 'rev-parse', 'HEAD').decode().strip()
verify_batch(head + ':')
command('git', 'push', 'origin', 'HEAD:audit/release-eb6de2e8')
assert not command('git', 'diff', '--cached', '--name-only').strip()
print(json.dumps({'status': 'PUBLISHED', 'head': head, 'rawGitFilesVerified': len(paths), 'newOverlapIds': new_ids,
                  'nativeFollowupComplete': True, 'checkpointPrefixChars': len(prefix), 'sourceUnchanged': 31, 'appUnchanged': 1333}, ensure_ascii=True))
