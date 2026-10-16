"""Retain actual exact Step 2 approval and current authorities, without host operations."""
import datetime, hashlib, json, os, pathlib, subprocess, sys, tempfile
W = pathlib.Path(__file__).resolve().parents[2]
REL = 'WP/batch-proof-provenance-step2-be837974-20261016/'
B = W / REL
D = B / 'actual-source-pass6207628146-once'
BASE = 'd2a046f065f2801f81b03e0125328de96b8aa531'
SOURCE = '937901c7514437fc3937639454e621d1bfd68dc4'
sys.dont_write_bytecode = True
sys.path.insert(0, str(B))
from proof_contract import *
import prepare_proof as prep

def git(*args, input=None):
    return subprocess.check_output(['git', '-c', 'core.longpaths=true', *args], cwd=W, input=input)

def oid(raw):
    return hashlib.sha1(('blob ' + str(len(raw)) + '\0').encode() + raw).hexdigest()

require(git('rev-parse', 'HEAD').decode().strip() == BASE and git('branch', '--show-current').decode().strip() == 'audit/release-eb6de2e8' and not git('diff', '--cached', '--name-only').strip() and not D.exists(), 'Same writer/base/one retention required')
index = exact_json((B / 'exact-source-review398-once/source-index.json').read_bytes())
require(index['head'] == SOURCE and len(index['files']) == 31 and len(tokens(index)) == 170, 'Exact31source/170bindings required')
pubraw = git('show', SOURCE + ':' + REL + 'source398-complete-publication-once/publication-index.json')
pub = exact_json(pubraw)
require(len(pub['bindings']) == 736, 'Complete736 indexed originals required')
raws = prep.raw_git_many(SOURCE, [r['path'] for r in pub['bindings']])
for row in pub['bindings']:
    data = raws[row['path']]
    require(len(data) == row['bytes'] and sha(data) == row['sha256'] and oid(data) == row['gitBlobOid'], 'Published raw identity differs ' + row['path'])
for name, pin in index['files'].items():
    data = raws[REL + name]
    require(data == (B / name).read_bytes() and len(data) == pin['bytes'] and sha(data) == pin['sha256'] and oid(data) == pin['blob'], 'Source changed ' + name)
frozen = exact_json((W / 'WP/startup-order-readiness-20261015/full-pinned-copy-retention-bound-ordinary-once/source-before.json').read_bytes())
require(len(frozen) == 1333, 'App inventory differs')
for name, digest in frozen.items():
    require(sha((W / name).read_bytes()) == digest, 'App changed ' + name)
old_graphs = [
    ('04c99271e761198937aa798131075f199e86b679', 'WP/batch-proof-jobs-intake-be837974-20261016/', 'exact-source-review323-once/tooling-source-index.json', 26, []),
    ('46338c544e44e56091eb3b18edc515ece5d44095', 'WP/jobs-row-diagnostic-private-be837974-20261016/', 'exact-source-review105-private-once/source-index.json', 8, ['diagnostic-pins.json', 'first-fetch-original.json', 'baseline-logical-original.json']),
    ('bb2d337dc4e39021bf413dbe31c2749bb02da65a', 'WP/jobs-row-diagnostic-be837974-20261016/', 'exact-source-review80-git-aware-once/source-index.json', 8, ['diagnostic-pins.json', 'first-fetch-original.json', 'baseline-logical-original.json']),
]
old_verified = []
for head, rel, idxpath, count, data_names in old_graphs:
    old = exact_json((W / rel / idxpath).read_bytes())
    require(len(old['files']) == count and old['head'] == head, 'Old immutable graph differs')
    names = list(old['files']) + data_names
    originals = prep.raw_git_many(head, [rel + n for n in names])
    for name in names:
        data = (W / rel / name).read_bytes()
        require(data == originals[rel + name], 'Old immutable bytes differ ' + rel + name)
        if name in old['files']:
            require(sha(data) == old['files'][name]['sha256'], 'Old source pin differs ' + name)
    old_verified.append({'head': head, 'sourceFiles': count, 'metadataFiles': len(data_names)})
captures = []
original = prep.command
def capture(*args):
    raw = original(*args)
    if args[:2] == ('gh', 'api'):
        captures.append((list(args), raw))
    return raw
prep.command = capture
review_raw = capture('gh', 'api', 'repos/yigini/soilfer-lims/issues/comments/6207628146')
review = exact_json(review_raw)
approval(review, index)
require(review['id'] == 6207628146 and review['created_at'] == review['updated_at'] == '2026-10-16T03:47:20Z', 'Actual new verdict identity differs')
evidence = prep.current_evidence(review, index)
require(exact_json(capture('gh', 'api', 'repos/yigini/soilfer-lims/issues/191'))['state'] == 'closed', 'Issue191 changed')
receipt = prep.raw_git(BUILD_EVIDENCE, prep.BUILD_REL + 'build-receipt.json')[0]
inspection = prep.raw_git(BUILD_EVIDENCE, prep.BUILD_REL + 'image-inspect-original.json')[0]
qualified(exact_json(receipt), receipt, exact_json(inspection)[0])
D.mkdir()
def save(name, data):
    with (D / name).open('xb') as handle:
        handle.write(data)
save('actual-source-pass-original.json', review_raw)
save('actual-source-pass-readable.txt', review['body'].encode())
save('tooling-source-index.json', canonical(index) + b'\n')
save('source-publication-index398-original.json', pubraw)
save('current-authority-evidence.json', canonical(evidence) + b'\n')
for i, (_, raw) in enumerate(captures):
    save('api-original-' + str(i).zfill(2) + '.json', raw)
save('api-command-index.json', canonical([{'file': 'api-original-' + str(i).zfill(2) + '.json', 'argv': argv, 'length': len(raw), 'sha256': sha(raw), 'gitBlobOid': oid(raw)} for i, (argv, raw) in enumerate(captures)]) + b'\n')
record = {'status': 'ACTUAL_NEW_EXACT_STEP2_SOURCE_PASS_VALIDATED_NOT_EXECUTED', 'verifiedUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
          'sourceHead': SOURCE, 'sourceReviewId': review['id'], 'reviewCreatedUtc': review['created_at'], 'reviewBodySha256': sha(review['body'].encode()),
          'all31SourceHashes': graph(index), 'literalBindings': len(tokens(index)), 'completeSourceOriginalCount': 737,
          'all737RawGitOidShaLengthVerified': True, 'all1333AppInputsUnchanged': True, 'oldImmutableGraphsVerified': old_verified,
          'currentMainCiFourAuditsSixRulesTwoPostRebootMemoryJobsScopesPrivacyDiagnosticAcceptanceR2NoLaterFailureVerified': True,
          'scope': SCOPE, 'root': str(ROOT), 'unit': 'lims-' + ROOT_NAME.lower(), 'proofAttemptsAllowed': 1, 'retryAllowed': False,
          'packagePrepared': False, 'hostOperations': 0, 'productionSqliteConnections': 0,
          'reviewConditions': ['Fresh exact authority/R4+10GB/unused root-unit; one attempt, no retry',
            'Qualification only; no kit/gate/deploy; main merges held',
            'Runtime receipt AWAITING_EXEC_STOP_POST or terminal refusal; stop-post allExactOwnedStopped true, no errors, both retained stopped, controller OOM0; journal hook exit0',
            'Controller before/after same cgroup; first/second/full preservation; reconstructed same-sync labels',
            'Public logs require review before publication; private key and DBs stay host',
            'Future kit: first-sync provenance impact/counts may differ; 9to10 minute restart and exact600s behavior'],
          'nonBlockingNextGraphNotes': ['Stop first then verify hashes if future graph changes; current exact graph accepted without changes',
            'If this attempt refuses, identify safe literal require source message only without interpolated/private values; never replay operation']}
save('independent-pass-validation.json', canonical(record) + b'\n')
lead = f'''LATEST ACTUAL EXACT STEP2 SOURCE PASS6207628146 - {review['created_at']}.
FULL actual uneditedClaudeapp1236702slugclaude Source review: PASS read; own proof_contract.approval validates exact937901c7514437fc3937639454e621d1bfd68dc4 / ALL31SHA / ALL170tokens. All737 sourcepublication rawGitOID/SHA256/length independently reverified; all31source/1333app/old26proof+both8source3data diagnosticgraphs unchanged. Fresh mainbe837974/mainCI38772398721 attempt1 push CLOSED SUCCESS/4audits6rules2postreboot memory/jobs/diagnostic scopes/privacy/acceptance/R2/no laterfailure/#191CLOSED verified. Full rawPASS/current authorities/independent validation at {REL}actual-source-pass6207628146-once/publication-index.json.
ONE new050000 Step2 qualification attempt permitted conditional fresh exact-package R4+10GB beforeROOT/immediatelyUNIT/runtime + unusedrootunit. No package/root/unit/proof yet. Prepare and publish ONE package next, then unchanged reviewed launcher. Native follow-up delivered ONCE03:46 and now ANSWERED; NEVER duplicate native/GH/request/ACK. Bundle620762PASS ACK ONLY eventual actual result. MainMERGEHOLD; SourcePASS not kit/gate/deploy.
Result review requires runtime receipt AWAITING_EXEC_STOP_POST or refusal; stop-post allExactOwnedStopped true/errorsEMPTY/both retainedSTOPPED/controllerOOM0/journalExecStopPostexit0; controller beforeafter samecgroup; firstsecondfull preservation/reconstructedlabels. Nonblocking NEXTgraph note stop-first-before-source-verification is accepted current0400 graph, no currentpatch/review replay. If refusal identify safe literal require message without private/interpolated values. Full jobsON logs contentreview before public publication/privatekeyDBsHOST0400. Futurekitgate disclose174newEXPECTED22holds20existingZMB-LAB1/managerimpact/deploycountsmaydiff PLUS9to10minrestart/exactproduction600deadlinefailure. Strictpairing/orphans/secondnaturalidempotence/EVERYcontainer805600/full11242/refusals/science/N25MIN64/floor4GiBlogs10GB/500MB/oneattempt retained. 233000latestpassingKEEPIT/R2COMPLETE/noprune/YY320GiBvisible/no growrestart/no103/noagentsnewchatworktreecheckoutconcurrentwriter/humansheld. SAMEheartbeat2min/restore10ONLYactualbeDEPLOYED+ClactualpostdeployPASS. Preserve ALL older history verbatim below.

'''
save('checkpoint-prefix.txt', lead.encode())
readmes = [W / 'WP/audit-release-eb6de2e8/README.md', W / 'WP/runtime-recovery-kobo/README.md']
for path in readmes:
    prior = path.read_bytes(); path.write_bytes(lead.encode() + prior)
    require(path.read_bytes()[len(lead.encode()):] == prior, 'Prior history changed')
paths = sorted(p for p in D.iterdir() if p.is_file()) + [pathlib.Path(__file__), *readmes]
save('publication-index.json', canonical({'baseAudit': BASE, 'sourceReviewId': review['id'], 'files': [{'path': p.relative_to(W).as_posix(), 'length': len(p.read_bytes()), 'sha256': sha(p.read_bytes()), 'gitBlobOid': oid(p.read_bytes())} for p in paths]}) + b'\n')
paths.append(D / 'publication-index.json')
names = [p.relative_to(W).as_posix() for p in paths]
fd, path_file = tempfile.mkstemp(prefix='lims-step2-pass620762-', suffix='.paths'); os.close(fd)
pathlib.Path(path_file).write_bytes(b'\0'.join(n.encode() for n in names) + b'\0')
git('-c', 'core.autocrlf=false', '--literal-pathspecs', 'add', '-f', '--pathspec-from-file=' + path_file, '--pathspec-file-nul')
require({n.decode() for n in git('diff', '--cached', '--name-only', '-z').split(b'\0') if n} == set(names), 'Staged ownership differs')
def verify(ref):
    data = git('cat-file', '--batch', input=('\n'.join(ref + n for n in names) + '\n').encode()); at = 0
    for path in paths:
        end = data.index(b'\n', at); given, kind, length = data[at:end].decode().split(); length = int(length); at = end + 1
        raw = data[at:at+length]; at += length
        require(kind == 'blob' and raw == path.read_bytes() and oid(raw) == given and data[at:at+1] == b'\n', 'Raw publication differs'); at += 1
    require(at == len(data), 'Expanded publication')
verify(':')
git('commit', '-m', 'Retain exact Step 2 source PASS6207628146')
head = git('rev-parse', 'HEAD').decode().strip(); verify(head + ':')
git('push', 'origin', 'HEAD:audit/release-eb6de2e8')
require(git('ls-remote', 'origin', 'refs/heads/audit/release-eb6de2e8').decode().split()[0] == head, 'Remote publication differs')
require(not git('diff', '--cached', '--name-only').strip(), 'Staged output remains')
print(json.dumps({'audit': head, 'actualPass': review['id'], 'sourceOriginalsVerified': 737, 'literalBindings': 170, 'sourceFilesVerified': 31, 'appInputsVerified': 1333, 'rawGitFilesVerified': len(paths), 'serverOperations': 0}))
