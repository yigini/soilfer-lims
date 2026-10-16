"""Independently retain the new exact jobs source approval; no host operations."""
import datetime, hashlib, json, os, pathlib, subprocess, sys, tempfile
W = pathlib.Path(__file__).resolve().parents[2]
REL = 'WP/batch-proof-jobs-intake-be837974-20261016/'
B = W / REL
D = B / 'actual-source-pass6205111918-once'
BASE = '5a8fa4b18d3949560e1df36eca8ad2655c6839ef'
SOURCE = '04c99271e761198937aa798131075f199e86b679'
sys.path.insert(0, str(B))
from proof_contract import *
import prepare_proof as prep

def git(*args, input=None):
    return subprocess.check_output(['git', '-c', 'core.longpaths=true', *args], cwd=W, input=input)

def oid(raw):
    return hashlib.sha1(('blob ' + str(len(raw)) + '\0').encode() + raw).hexdigest()

require(git('rev-parse', 'HEAD').decode().strip() == BASE and git('branch', '--show-current').decode().strip() == 'audit/release-eb6de2e8' and not git('diff', '--cached', '--name-only').strip() and not D.exists(), 'Same writer/base/one retention required')
index = exact_json((B / 'exact-source-review323-once/tooling-source-index.json').read_bytes())
require(index['head'] == SOURCE and len(index['files']) == 26 and len(tokens(index)) == 149, 'Exact26source/149bindings required')
pubraw = git('show', SOURCE + ':' + REL + 'source-publication-index323.json')
pub = exact_json(pubraw)
require(len(pub['files']) == 712, 'Complete712indexed originals required')
raws = prep.raw_git_many(SOURCE, [r['path'] for r in pub['files']])
for row in pub['files']:
    data = raws[row['path']]
    require(len(data) == row['length'] and sha(data) == row['sha256'] and oid(data) == row['gitBlobOid'], 'Published raw identity differs ' + row['path'])
completionraw, _ = prep.raw_git(SOURCE, REL + 'source323-publication-completion-index.json')
completion = exact_json(completionraw)
require(len(completion['files']) == 3 and completion['sourceIndexPath'] == REL + 'source-publication-index323.json' and completion['sourceIndexSha256'] == sha(pubraw), 'Completion binding differs')
completionraws = prep.raw_git_many(SOURCE, [r['path'] for r in completion['files']])
for row in completion['files']:
    data = completionraws[row['path']]
    require(len(data) == row['length'] and sha(data) == row['sha256'] and oid(data) == row['gitBlobOid'], 'Completion raw identity differs ' + row['path'])
require(len(raws) + len(completionraws) + 2 == 717, 'Complete717 originals required')
for name, pin in index['files'].items():
    data = raws[REL + name]
    require(data == (B / name).read_bytes() and len(data) == pin['bytes'] and sha(data) == pin['sha256'] and oid(data) == pin['blob'], 'Source changed ' + name)
frozen = exact_json((W / 'WP/startup-order-readiness-20261015/full-pinned-copy-retention-bound-ordinary-once/source-before.json').read_bytes())
require(len(frozen) == 1333, 'App inventory differs')
for name, digest in frozen.items():
    require(sha((W / name).read_bytes()) == digest, 'App changed ' + name)
old = exact_json((W / 'WP/batch-proof-memory-events-be837974-20261015/actual-source-pass6203833517-once/tooling-source-index.json').read_bytes())
require(len(old['files']) == 15, 'Old source inventory differs')
for name, pin in old['files'].items():
    require(sha((W / 'WP/batch-proof-memory-events-be837974-20261015' / name).read_bytes()) == pin['sha256'], 'Old immutable source changed ' + name)
captures = []
original = prep.command
def capture(*args):
    raw = original(*args)
    if args[:2] == ('gh', 'api'):
        captures.append((list(args), raw))
    return raw
prep.command = capture
review_raw = capture('gh', 'api', 'repos/yigini/soilfer-lims/issues/comments/6205111918')
review = exact_json(review_raw)
approval(review, index)
require(review['id'] == 6205111918 and review['created_at'] == review['updated_at'] == '2026-10-16T00:21:31Z', 'Actual new verdict identity differs')
evidence = prep.current_evidence(review, index)
issue191 = exact_json(capture('gh', 'api', 'repos/yigini/soilfer-lims/issues/191'))
require(issue191['state'] == 'closed', 'Issue191 changed')
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
save('source-publication-index323-original.json', pubraw)
save('source323-completion-index-original.json', completionraw)
save('current-authority-evidence.json', canonical(evidence) + b'\n')
for i, (_, raw) in enumerate(captures):
    save('api-original-' + str(i).zfill(2) + '.json', raw)
save('api-command-index.json', canonical([{'file': 'api-original-' + str(i).zfill(2) + '.json', 'argv': argv, 'length': len(raw), 'sha256': sha(raw), 'gitBlobOid': oid(raw)} for i, (argv, raw) in enumerate(captures)]) + b'\n')
record = {'status': 'ACTUAL_NEW_EXACT_JOBS_SOURCE_PASS_VALIDATED_NOT_EXECUTED', 'verifiedUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
          'sourceHead': SOURCE, 'sourceReviewId': review['id'], 'reviewCreatedUtc': review['created_at'], 'reviewBodySha256': sha(review['body'].encode()),
          'all26SourceHashes': graph(index), 'literalBindings': len(tokens(index)), 'completeSourceOriginalCount': 717,
          'all717RawGitOidShaLengthVerified': True, 'all1333AppInputsUnchanged': True, 'all15OldImmutableSourcesUnchanged': True,
          'currentMainCiFourAuditsSixRulesTwoPostRebootMemoryJobsScopeR2AndNoLaterFailureVerified': True,
          'scope': SCOPE, 'root': str(ROOT), 'unit': UNIT, 'proofAttemptsAllowed': 1, 'retryAllowed': False,
          'packagePrepared': False, 'hostOperations': 0, 'productionSqliteConnections': 0,
          'reviewConditions': ['Fresh exact authority/R4+10GB/unused-root-unit at launch boundaries', 'Qualification only; kit/gate/deploy separate; main merges held until actual deploy and Claudio postcheck',
                               'Inspect jobs-ON raw logs for Kobo submission content before any public publication; hashes acceptable either way',
                               'Backup180s or escalation-row refusal is forward-fix only, never rerun', 'Future kit and gate disclose several-minute restart window (333/392s prior healthy)']}
save('independent-pass-validation.json', canonical(record) + b'\n')
lead = f'''LATEST ACTUAL NEW JOBS SOURCE PASS6205111918 - {review['created_at']}.
FULL actual uneditedClaudeapp1236702slugclaude Source review: PASS read and own proof_contract.approval validated exact04c99271e761198937aa798131075f199e86b679 / ALL26SHA / ALL149literalbindings. All717 sourcepublication rawGitOID/SHA256/length files independently reverified, all26locals/all1333app/all15oldimmutable sources unchanged. Fresh mainbe837974 / mainCI38772398721 attempt1 push CLOSED SUCCESS / 4appaudits6rules2postreboot + memorydirection/jobsScope/R2accepted/no laterfailure and #191CLOSED verified. Full raw actualPASS/current authorities/independent record at {REL}actual-source-pass6205111918-once/publication-index.json.
Authorizes ONE new003000 jobs qualification attempt only, conditional fresh authority + exact-package R4+10GB + unusedroot/unit. No operational package/root/unit/proof yet. Prepare/publish ONE package next, then reviewed launcher. Native follow-up already delivered ONCE and now answered; NO duplicate native/GH/request/ACK. Bundle NEWPASS ACK only with eventual actual result. MainMERGEHOLD/kit-gate-deploy separately reviewed later.
Review notes: inspect jobsON logs before public publication for Kobo submission content; preserve originals/hashes, no unsafe raw-content publication. Backup180s timeout/escalation row refusal => retain failure/separate audited forward fix/no rerun. Futurekit/gate disclose several-minute restart window/priorhealthy333392s/600 unchanged. ALL science/refusalCODESCONDITIONS/fullreports/nonzeroYYapprovedSTOP/805blankheapSwap0/floorlogs+10GB/history/retention/forwardonly/no103/humans held. 233000 latestpassingKEEPIT/R2COMPLETE/no prune/YYspacealreadyvisible/nohostgrowrestart. SAMEheartbeat2min/restore10 ONLY actualdeploy+ClpostcheckPASS. Preserve older history verbatim below.

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
fd, path_file = tempfile.mkstemp(prefix='lims-jobs-pass620511-', suffix='.paths'); os.close(fd)
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
git('commit', '-m', 'Retain exact jobs qualification source PASS6205111918')
head = git('rev-parse', 'HEAD').decode().strip(); verify(head + ':')
git('push', 'origin', 'HEAD:audit/release-eb6de2e8')
require(git('ls-remote', 'origin', 'refs/heads/audit/release-eb6de2e8').decode().split()[0] == head, 'Remote publication differs')
print(json.dumps({'audit': head, 'actualPass': review['id'], 'sourceOriginalsVerified': 717, 'literalBindings': 149, 'sourceFilesVerified': 26, 'appInputsVerified': 1333, 'rawGitFilesVerified': len(paths), 'serverOperations': 0}))
