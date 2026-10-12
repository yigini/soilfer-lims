"""Read-only local evidence verification and exclusive checkpoint records."""
import datetime
import hashlib
import json
from pathlib import Path
import re
import subprocess

repo = Path(__file__).resolve().parents[2]
here = Path(__file__).resolve().parent
head = '5e65fe5b587747efc717f167f9b61469effa9afe'
base = '5dd5488d138514351fffd54d0b0232ae19fcb64d'
def git(*args):
    return subprocess.check_output(['git', *args], cwd=repo)
def digest(path):
    result = hashlib.sha256()
    with path.open('rb') as stream:
        while data := stream.read(1024 * 1024): result.update(data)
    return result.hexdigest()
def decoded(path):
    raw = path.read_bytes()
    return raw.decode('utf-16' if raw.startswith(b'\xff\xfe') else 'utf-8-sig')

changed = git('diff', '--name-only', base, head).decode().splitlines()
assert len(changed) == 5
files = {}
for relative in changed:
    raw = git('show', head + ':' + relative)
    blob = git('hash-object', '--path=' + relative, relative).decode().strip()
    current = git('cat-file', 'blob', blob)
    assert current == raw, relative
    files[relative] = hashlib.sha256(raw).hexdigest()
variants_path = changed[0]
prior = json.loads(git('show', base + ':' + variants_path))
current = json.loads(git('show', head + ':' + variants_path))
assert len(prior) == 6 and all(current[key] == value for key, value in prior.items())
test_path = 'server/tests/contracts/audit_4_7_instrument_import_install.test.js'
before, after = git('show', base + ':' + test_path), git('show', head + ':' + test_path)
for prefix in [b'    mapping:', b'    sourceSha256:', b'        const rawValue =']:
    assert [line for line in before.splitlines() if line.startswith(prefix)] == [line for line in after.splitlines() if line.startswith(prefix)]

inventory_file = here / 'native-workbench-full-5e65fe5b-1133.inventory.json'
inventory = json.loads(decoded(inventory_file))
listed = {str(Path(path)).casefold() for path in inventory}
actual = {str(repo / relative.replace('\\', '/')).casefold() for relative in
    subprocess.check_output(['rg', '--files', 'server/tests'], cwd=repo).decode().splitlines() if relative.endswith('.test.js')}
assert listed == actual and len(actual) == 360, (len(listed), len(actual))
original = json.loads((here / 'before-protected-local-databases.json').read_bytes())
protected = []
for row in original['files']:
    path = Path(row['path']); observed = {'path': str(path), 'bytes': path.stat().st_size, 'sha256': digest(path)}
    assert observed['bytes'] == row['bytes'] and observed['sha256'] == row['sha256'], str(path)
    protected.append(observed)
assert len(protected) == 6
guard_records = {}
for platform, name in [('Windows', 'native-forward-authority-final-windows-1140.log'),
        ('Linux', 'native-forward-authority-final-linux-1141.log')]:
    path = here / name
    record = next(json.loads(line) for line in decoded(path).splitlines() if line.startswith('{'))
    assert record['tests'] == 175 and record['failures'] == record['errors'] == record['skips'] == 0
    assert record['productionDatabaseAccess'] is False
    guard_records[platform] = {'sourceCommit': record['sourceCommit'], 'tests': record['tests'],
        'elapsedSeconds': record['elapsedSeconds'], 'completedUtc': record['completedUtc'], 'logSha256': digest(path),
        'packagingSourceHashes': record['packagingSourceHashes']}
assert guard_records['Windows']['sourceCommit'] == guard_records['Linux']['sourceCommit']
active_log = here / 'native-workbench-full-5e65fe5b-1133.log'
text = decoded(active_log)
record = {'observedUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'applicationHead': head, 'applicationTree': git('rev-parse', head + '^{tree}').decode().strip(),
    'applicationFiles': files, 'sixOldVariantBytesUnchanged': True, 'originalUnicodeLinesUnchanged': True,
    'fullInventoryCount': 360, 'fullInventoryEqualsAllActualTests': True,
    'fullValidation': {'status': 'IN_PROGRESS_NOT_A_PASS', 'session': 79434,
        'completedPassingSuites': len(re.findall(r'^PASS ', text, re.M)),
        'completedFailingSuites': len(re.findall(r'^FAIL ', text, re.M)), 'log': active_log.name},
    'protectedOriginalLocalDatabaseFiles': protected, 'proposedSourceGuards': guard_records,
    'newPullRequestCreated': False, 'newPrPermissionQuestion': 'PENDING_NO_ANSWER_ASSUMED',
    'nativeClaudioEncodingUpdateDelivered': True, 'githubEncodingUpdateCommentId': 6123429193,
    'productionMutations': 0, 'sourceReviewOrExecutionAuthorityClaimed': False}
with (here / 'native-forward-prepared-verified-1140.json').open('x', encoding='utf-8') as stream:
    json.dump(record, stream, indent=2)
summary = 'PR284 corrected native-workbench checkpoint ' + record['observedUtc'] + ': prepared clean app' + head + '/tree' + record['applicationTree'] + ' oncodex/native-workbench-import-forward-fix, samefiveapplicationfiles. Claudio caught originalUnicode re-encoding ind150; THREEoriginaltestlinesrestoredbyte-for-bytefrom5dd, sixoldvariantbytesunchanged. Correctedfocused4/120PASS12.134s. d150fullSTOPPED25PASS/0FAIL/incomplete/rawretained; nofullpassclaim. NEWfullunfiltered360suite SAMEsession79434/lognative-workbench-full-5e65fe5b-1133 IN_PROGRESS, ' + str(record['fullValidation']['completedPassingSuites']) + ' completedPASS/' + str(record['fullValidation']['completedFailingSuites']) + 'FAIL atobservation; all360actualinventoryidentical, noappedit/concurrentJest. NOcorrectionPR/CI: YYsavedNoNewPRconstraint, alreadyaskedasyncclarificationSTILLPENDING. NEWproposedsource' + guard_records['Windows']['sourceCommit'] + '175/175Windows+175/175LinuxguardsPASS0failure/error/skip/noproductionDB. Bindsmergebasemain5ddSEPARATELYfromlive51f, exactfutureappauditID/rawrecord, exactsource-reviewedFIRSTproofrootexcludingFAILED105200, sixtysecondCLI/readinessheadroom and measured5400unitbudgetwithunmeasuredcostsexplicit. ActualappPR/merge/review/proofroot/sourcebindingsUNBOUND_REFUSE; noapprovalinvented. Proposedsourcecannotbuild/proof/freeze/gate/deploy. Sixoriginalhuman/managedlocalDB/WAL/SHMrawhashesunchanged. Nativecorrectedheaddeliveryvisuallyverified;162/6123429193posted. Originalf5e105200FAILED511c/valid5ddbuild92be+5757 retainedNEVERreplay/rebuild/retry; completedPR293/healthyold51f productionuntouched. Samewritercontinuesvalidation/forwardsourceprep; otherappmergeshelduntil200live/Clpostchecked.\n\nPrevious checkpoint follows:\n\n'
for relative in ['WP/audit-release-eb6de2e8/README.md', 'WP/runtime-recovery-kobo/README.md']:
    path = repo / relative
    path.write_text(summary + path.read_text(encoding='utf-8'), encoding='utf-8', newline='\n')
print(json.dumps({'observedUtc': record['observedUtc'], 'applicationHead': head, 'fullValidation': record['fullValidation'],
    'originalLocalFilesUnchanged': len(protected), 'proposedGuardTestsPerPlatform': 175, 'actualTestFiles': len(actual)}))
