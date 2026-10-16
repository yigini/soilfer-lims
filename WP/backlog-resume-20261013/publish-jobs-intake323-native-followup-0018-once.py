"""Retain the one delivered native follow-up; no source tests or host operators."""
import concurrent.futures, datetime, hashlib, json, os, pathlib, subprocess, tempfile

W = pathlib.Path(__file__).resolve().parents[2]
REL = 'WP/batch-proof-jobs-intake-be837974-20261016'
B = W / REL
D = B / 'native-source-review323-followup-0018-once'
P = B / 'native-source-review323-followup-0018-publication-once'

def command(*args, input=None):
    return subprocess.check_output(args, cwd=W, input=input)

def encode(value):
    return json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(',', ':')).encode() + b'\n'

def sha(data):
    return hashlib.sha256(data).hexdigest()

assert not P.exists()
assert command('git', 'branch', '--show-current').decode().strip() == 'audit/release-eb6de2e8'
assert command('git', 'rev-parse', 'HEAD').decode().strip() == '4a0492aaa3b4918ba625dace5d54b8854607ddde'
assert not command('git', 'diff', '--cached', '--name-only').strip()
record = json.loads((D / 'native-delivery-derived-record.json').read_bytes())
assert record['delivery'] == 'VISUALLY_VERIFIED_SENT_BUBBLE_AND_EMPTY_RIGHT_COMPOSER_AFTER_ONE_RETURN'
assert record['requestId'] == 6204775812 and record['noDuplicateNative'] is True
assert record['productionOperations'] == record['sourceOperators'] == 0
intent = json.loads((D / 'native-followup-intent.json').read_bytes())
assert (D / 'native-followup-actual-sent.txt').read_bytes() == intent['body'].encode()
assert datetime.datetime.fromisoformat(intent['at'].replace('Z', '+00:00')) >= datetime.datetime.fromisoformat('2026-10-16T00:16:30+00:00')
source_index = json.loads((B / 'exact-source-review323-once/tooling-source-index.json').read_bytes())
assert len(source_index['files']) == 26 and source_index['head'] == '04c99271e761198937aa798131075f199e86b679'
for name, pin in source_index['files'].items():
    data = (B / name).read_bytes()
    assert len(data) == pin['bytes'] and sha(data) == pin['sha256'], name
app = json.loads((W / 'WP/startup-order-readiness-20261015/full-pinned-copy-retention-bound-ordinary-once/source-before.json').read_bytes())
assert len(app) == 1333
for name, digest in app.items():
    assert sha((W / name).read_bytes()) == digest, name
endpoints = {
    'fresh-overlap-comments-original.json': 'repos/yigini/soilfer-lims/issues/162/comments?since=2026-10-15T23:56:00Z&per_page=100',
    'fresh-main-original.json': 'repos/yigini/soilfer-lims/commits/main',
    'fresh-main-ci-original.json': 'repos/yigini/soilfer-lims/actions/runs/38772398721',
    'fresh-issue191-original.json': 'repos/yigini/soilfer-lims/issues/191',
}
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
    raw = dict(zip(endpoints, executor.map(lambda endpoint: command('gh', 'api', endpoint), endpoints.values())))
comments = json.loads(raw['fresh-overlap-comments-original.json'])
assert len(comments) < 100
own = next(c for c in comments if c['id'] == 6204775812)
assert own['created_at'] == own['updated_at'] == '2026-10-15T23:56:30Z'
assert sha(own['body'].encode()) == '9b3c4aeb79cca7cf5bf9860b306f93d9d6ba1797ba1a2838e7babd4b246d8580'
assert json.loads(raw['fresh-main-original.json'])['sha'] == 'be8379745bdfae52ce46496ff26514dc7d729640'
ci = json.loads(raw['fresh-main-ci-original.json'])
assert (ci['status'], ci['conclusion'], ci['run_attempt'], ci['event'], ci['head_sha']) == ('completed', 'success', 1, 'push', 'be8379745bdfae52ce46496ff26514dc7d729640')
assert json.loads(raw['fresh-issue191-original.json'])['state'] == 'closed'
new_ids = [c['id'] for c in comments if c['id'] != own['id']]
observed = datetime.datetime.now(datetime.timezone.utc).isoformat()
P.mkdir()
for name, data in raw.items():
    (P / name).write_bytes(data)
derived = {'observedAt': observed, 'sourceHead': source_index['head'], 'sourceFilesVerified': 26, 'appFilesVerified': 1333,
           'nativeDelivery': record, 'newOverlapCommentIds': new_ids, 'actualSourceVerdictIndependentlyRetained': False,
           'newCommentsRequireFullReadBeforeAnyOperator': True, 'testsReplayed': 0, 'hostCalls': 0, 'proofOperatorCalls': 0}
(P / 'independent-boundary-record.json').write_bytes(encode(derived))
status = ('No later GH comment observed at this capture; actual NEW exact SourcePASS still pending.' if not new_ids else
          'Later GH comments observed: ' + ','.join(map(str, new_ids)) + '; MUST read and independently retain full actual verdict/conditions before any operator.')
prefix = f'''LATEST NATIVE JOBS SOURCE FOLLOW-UP DELIVERED ONCE - {record['observedAt']}.
ONE agreed native follow-up for SourceReview6204775812 delivered after the 00:16:30UTC threshold to fresh actual Claude2888208 / LIMS Audit / Lab workflow audit and plan. Correct thread, EMPTY right composer/caret, whole own draft inspected, ONE Return, actual sent bubble plus EMPTY right composer visually verified. Centre empty/human drafts/cards preserved. Accessibility lagged former composer contents; screenshot governed/no repeated input. Exact sent text and original accessibility with explicit visual-derived record at {REL}/native-source-review323-followup-0018-once. Native follow-up COMPLETE; NEVER duplicate it, the GH request, ACK or result.

Actual native checklist: exact04c99271 hashes/149bindings/323guards all check out and WRITING VERDICT; working status listing 53 new jobs guard test names. This is displayed progress only, NOT actual final SourcePASS or independent reviewer-process proof. Fresh GH {observed}: {status}
All26 source hashes/lengths and all1333 frozen app inputs reverified unchanged; mainbe837974 / mainCI38772398721 attempt1 push CLOSED SUCCESS / #191CLOSED. NEW prepare/launch/run still UNEXECUTED except prior import/compile/closed fake guards; no package/root/unit/container/copy/proof/production operation. 233000 remains latest passing KEEPIT; R2COMPLETE/no prune/YYspace already visible/no host grow-restart. MainMERGEHOLD. SAME heartbeat ACTIVE2min, restore10 ONLY actualbeDEPLOYED + Cl actualpostdeployPASS. No agents/newchat/worktree/checkout/concurrent writer/no103/human files-drafts-cards held.
NEXT full actual NEW exact04c/all26SHA/149tokens verdict and conditions; own approval id>6204518776/time>23:36:01/uneditedapp1236702slugclaude. On PASS retain all raw/current authorities +717sourcebindings/26source/1333app before ONE package/publish/launcher with fresh exact future-package R4+10GB beforeROOT, immediately beforeUNIT/runtime, and unused root/unit. No source approval inferred from checklist/tests. Findings require NEW source/meaningful unique guards/review. Unknown operator outcome inspect SAME newrootunit/never redispatch. JobsON qualification/kitreview/fresh single-use gate/deploy remain separate; 600/805blankheapSwap0/science/refusal conditions/fullreports/retention/forward-only unchanged; futurekit downtime note mandatory. Preserve ALL older history verbatim below.

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
    rows.append({'path': rel, 'length': len(data), 'sha256': sha(data),
                 'gitBlobOid': hashlib.sha1(('blob ' + str(len(data)) + '\0').encode() + data).hexdigest()})
(P / 'publication-index.json').write_bytes(encode({'sourceHead': source_index['head'], 'nativeFollowupComplete': True, 'files': rows}))
paths.append((P / 'publication-index.json').relative_to(W).as_posix())
descriptor, path_file = tempfile.mkstemp(prefix='lims-native323-0018-', suffix='.paths')
os.close(descriptor)
pathlib.Path(path_file).write_bytes(b'\0'.join(p.encode() for p in paths) + b'\0')
command('git', '-c', 'core.longpaths=true', '-c', 'core.autocrlf=false', '--literal-pathspecs', 'add', '-f', '--pathspec-from-file=' + path_file, '--pathspec-file-nul')
assert {p.decode() for p in command('git', 'diff', '--cached', '--name-only', '-z').split(b'\0') if p} == set(paths)
def verify_batch(ref):
    raw_batch = command('git', 'cat-file', '--batch', input=('\n'.join(ref + p for p in paths) + '\n').encode())
    at = 0
    for rel in paths:
        end = raw_batch.index(b'\n', at)
        oid, kind, size = raw_batch[at:end].decode().split()
        size = int(size); at = end + 1
        data = raw_batch[at:at+size]; at += size
        assert kind == 'blob' and data == (W / rel).read_bytes() and raw_batch[at:at+1] == b'\n', rel
        assert hashlib.sha1(('blob ' + str(size) + '\0').encode() + data).hexdigest() == oid
        at += 1
    assert at == len(raw_batch)
verify_batch(':')
command('git', 'commit', '-m', 'Retain single native jobs source review follow-up and progress')
head = command('git', 'rev-parse', 'HEAD').decode().strip()
verify_batch(head + ':')
command('git', 'push', 'origin', 'HEAD:audit/release-eb6de2e8')
assert not command('git', 'diff', '--cached', '--name-only').strip()
print(json.dumps({'status': 'PUBLISHED', 'head': head, 'rawGitFilesVerified': len(paths), 'newOverlapIds': new_ids,
                  'nativeFollowupComplete': True, 'checkpointPrefixChars': len(prefix), 'sourceUnchanged': 26, 'appUnchanged': 1333}, ensure_ascii=True))
