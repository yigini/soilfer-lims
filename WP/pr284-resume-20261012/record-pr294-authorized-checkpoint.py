"""Retain the actual one-time PR authorization and current validation state."""
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

def command(*args):
    return subprocess.check_output(args, cwd=repo)

def digest(path):
    result = hashlib.sha256()
    with path.open('rb') as stream:
        while data := stream.read(1024 * 1024):
            result.update(data)
    return result.hexdigest()

def exclusive(name, value):
    with (here / name).open('x', encoding='utf-8') as stream:
        json.dump(value, stream, indent=2)

api_raw = command('gh', 'api', 'repos/yigini/soilfer-lims/issues/comments/6124009441')
api = json.loads(api_raw)
assert api['id'] == 6124009441 and 'one new application PR is allowed' in api['body']
assert head in api['body'] and 'Exactly one PR' in api['body']
with (here / 'yy-one-time-pr-exception-6124009441.json').open('xb') as stream:
    stream.write(api_raw)
pr = json.loads(command('gh', 'pr', 'view', '294', '--repo', 'yigini/soilfer-lims', '--json',
    'number,url,headRefOid,baseRefOid,isDraft,state,files,statusCheckRollup,body'))
assert pr['headRefOid'] == head and pr['baseRefOid'] == base and pr['isDraft'] and pr['state'] == 'OPEN'
assert 'Refs #200' in pr['body'] and not re.search(r'(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+#200', pr['body'], re.I)
changed = command('git', 'diff', '--name-only', base, head).decode().splitlines()
assert len(changed) == 5 and set(changed) == {row['path'] for row in pr['files']}
for relative in changed:
    expected = command('git', 'show', head + ':' + relative)
    blob = command('git', 'hash-object', '--path=' + relative, relative).decode().strip()
    assert command('git', 'cat-file', 'blob', blob) == expected, relative
exclusive('pr294-created-exact-head-1214.json', pr)
old = json.loads((here / 'native-workbench-full-memory-failure-1156.json').read_bytes())
assert old['completedPassingSuites'] == 91 and old['completedFailingSuites'] == 0
assert digest(here / 'native-workbench-full-5e65fe5b-1133.log') == old['logSha256']
log = here / 'native-workbench-full-5e65fe5b-sequential-1157.log'
raw = log.read_bytes()
text = raw.decode('utf-16' if raw.startswith(b'\xff\xfe') else 'utf-8-sig')
record = {
    'observedUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'applicationHead': head,
    'applicationTree': command('git', 'rev-parse', head + '^{tree}').decode().strip(),
    'applicationFiles': changed,
    'pr': 294, 'prUrl': pr['url'], 'draft': True, 'artifactAttached': True,
    'authorization': {
        'githubCommentId': 6124009441,
        'githubRawSha256': hashlib.sha256(api_raw).hexdigest(),
        'nativeDirectObservation': True,
        'nativeHumanMessagesVerbatim': ['ask claudio to decide', "sorry you;re claudio", 'i thought pip was asking'],
        'nativeClaudioDecisionVerbatim': "I've decided: Pip can open one PR for the instrument import fix, as a one-off exception.",
        'scope': 'Exactly one PR, existing branch, five pre-reviewed files, Refs #200, normal gates unchanged',
        'agentAnsweredDecisionCard': False,
    },
    'priorFullValidation': old,
    'currentFullValidation': {
        'status': 'IN_PROGRESS_NOT_A_PASS', 'session': 38507,
        'completedPassingSuites': len(re.findall(r'^PASS ', text, re.M)),
        'completedFailingSuites': len(re.findall(r'^FAIL ', text, re.M)),
        'log': log.name, 'maxWorkers': 1, 'workerIdleMemoryLimitBytes': 512000000,
        'runInBand': False, 'heapLimitRaised': False, 'allActualSuiteInventory': 360,
        'normalGlobalAndSuiteHooksRetained': True, 'concurrentJestOrSetup': False,
    },
    'nativeFailureAndAuthorizationAcknowledgementDelivered': True,
    'githubFullFailureCommentId': 6123795981,
    'sourceExecutionAuthorityClaimed': False, 'productionMutations': 0,
    'failedOriginalProofReplayed': False,
}
exclusive('pr294-authorized-current-validation-1214.json', record)
summary = (
    'PR294 authorized correction checkpoint ' + record['observedUtc'] + ': YY directly delegated the one-PR decision to Claudio in native LIMS Audit; actual one-time five-file exception is recorded on #162/6124009441. Opened and attached ONE DRAFT PR294 from codex/native-workbench-import-forward-fix at unchanged app ' + head + '/tree ' + record['applicationTree'] + ', based on main ' + base + '. Exactly five pre-reviewed files, Refs #200; no issue closure. Exact PR CI38247731718 is IN_PROGRESS. No ready-for-audit/formal pass/merge claimed. Previous monolithic full79434 FAILED default Node heap OOM after91 completed PASS/0 FAIL/no final JSON; raw log d1ac0343 and failure record retained, INCOMPLETE not PASS. SAME active full session38507 is unfiltered360 suites, single sequential test child/maxWorkers1/512MB idle recycling, no heap raise/application edit/concurrent Jest/setup, normal hooks/owned template/all360 inventory retained. At this observation ' + str(record['currentFullValidation']['completedPassingSuites']) + ' completed PASS/' + str(record['currentFullValidation']['completedFailingSuites']) + ' FAIL; no full-pass claim or aggregation. Focused4/120 and Claudio actual100 installer pre-review passed. Proposed sources4e591feb175/175Windows+Linux remain UNREVIEWED/UNBOUND_REFUSE, no build/proof/freeze/gate/deploy. Native exception/failure acknowledgement delivered and visually verified. Failed f5e105200 receipt511c and original5dd build92be/image5757 stay sealed/never replayed; completedPR293 and healthyold51f production untouched. Same writer continues full/CI/audit then NEW reviewed forward source/build/first proof/kit/deploy chain. Other application merges held until#200live/Clpostchecked.\n\nPrevious checkpoint follows:\n\n'
)
for relative in ['WP/audit-release-eb6de2e8/README.md', 'WP/runtime-recovery-kobo/README.md']:
    path = repo / relative
    path.write_text(summary + path.read_text(encoding='utf-8'), encoding='utf-8', newline='\n')
print(json.dumps({'pr': 294, 'applicationHead': head, 'observedUtc': record['observedUtc'], 'fullValidation': record['currentFullValidation']}))
