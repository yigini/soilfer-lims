"""Record the single source PR and pending real CI, without claiming acceptance."""
import datetime, hashlib, json, subprocess
from pathlib import Path
root = Path(__file__).resolve().parents[2]
evidence = Path(__file__).resolve().parent
destination = evidence / 'pr-295-open-boundary.json'
assert not destination.exists()
source = json.loads((evidence / 'issue-206-context-review-ref.json').read_bytes())
def gh(*args):
    return subprocess.check_output(['gh', *args], cwd=root)
raw_pr = gh('pr', 'view', '295', '--repo', 'yigini/soilfer-lims', '--json',
    'number,url,state,headRefOid,baseRefOid,closingIssuesReferences,statusCheckRollup,body,createdAt')
raw_ci = gh('run', 'view', '38393187129', '--repo', 'yigini/soilfer-lims', '--json',
    'databaseId,url,status,conclusion,headSha,createdAt,updatedAt,jobs')
pr, ci = json.loads(raw_pr), json.loads(raw_ci)
assert pr['number'] == 295 and pr['state'] == 'OPEN'
assert pr['headRefOid'] == ci['headSha'] == source['reviewHead']
assert pr['baseRefOid'] == source['base'] and pr['closingIssuesReferences'] == []
assert ci['status'] != 'completed', 'Inspect any completed CI result before recording pending.'
assert not subprocess.check_output(['git','diff','--cached','--name-only'],cwd=root).strip()
files = {}
for name, data in [('pr-295-open-raw.json', raw_pr), ('ci-38393187129-initial-raw.json', raw_ci)]:
    file = evidence / name
    assert not file.exists()
    file.write_bytes(data)
    files[name] = dict(bytes=len(data), sha256=hashlib.sha256(data).hexdigest())
body = evidence / 'issue-206-pr-body.md'
files[body.name] = dict(bytes=body.stat().st_size, sha256=hashlib.sha256(body.read_bytes()).hexdigest())
record = dict(observedUtc=datetime.datetime.now(datetime.UTC).isoformat(), pr=295,
    url=pr['url'], reviewHead=source['reviewHead'], base=source['base'],
    rawCoverageCommit='c56414a5148cb2b17547680a55550d66c9a1b013',
    localCoverage='PASS: 362 unique suites / 5508 tests', ciRun=ci['databaseId'],
    ciStatus=ci['status'], ciConclusion=ci['conclusion'], automaticClosingReferences=[],
    actualClaudioFinalVerdict='NOT YET', finalNativeHandoff='NOT YET', productionMutations=0,
    nativeRead='Actual LIMS Audit / Lab workflow audit and plan unchanged: phone instructions visible; See first / Approve now clarification unanswered; both composers empty; no input sent.',
    files=files)
destination.write_bytes((json.dumps(record,indent=2)+'\n').encode())
prefix = f'''# #206 PR295 open; real CI pending — 2026-10-13

[PR295]({pr['url']}) is OPEN at `{source['reviewHead']}`, base `{source['base']}`. Complete local frozen-source coverage is PASS (362 unique suites / 5,508 tests) and all closed raw evidence is pushed at `c56414a5148cb2b17547680a55550d66c9a1b013`. Actual GitHub `closingIssuesReferences=[]`; #206 remains open for Claudio's post-deploy check. ONE real CI run [38393187129]({ci['url']}) is {ci['status']}; its current snapshot is not a complete CI verdict. Observe the same run. Standard CI must pass before ready-for-audit and the final exact-head native handoff. No final Claudio verdict or new production operation exists. PR/source/initial CI records and hashes: `WP/backlog-resume-20261013/pr-295-open-boundary.json`.

Fresh actual native read: LIMS Audit / Lab workflow audit and plan still shows the phone instructions and unanswered #103 See first / Approve now clarification. Both composers are empty; no message or human-card response was sent. Same writer/worktree/branch. Completed release helpers, data, evidence and notices remain immutable. Historical pending/failed statements below keep their original meaning; current status is this PR with local coverage complete and real CI pending.

---

'''.encode()
readmes = ['WP/audit-release-eb6de2e8/README.md', 'WP/runtime-recovery-kobo/README.md']
for relative in readmes:
    file = root / relative
    file.write_bytes(prefix + file.read_bytes())
paths = ['WP/backlog-resume-20261013/' + name for name in files]
paths += [str(destination.relative_to(root)).replace('\\','/'), str(Path(__file__).relative_to(root)).replace('\\','/')] + readmes
subprocess.check_call(['git','add','-f','--']+paths,cwd=root)
for name, pin in files.items():
    blob = subprocess.check_output(['git','show',':WP/backlog-resume-20261013/'+name],cwd=root)
    assert hashlib.sha256(blob).hexdigest() == pin['sha256']
assert set(subprocess.check_output(['git','diff','--cached','--name-only'],cwd=root).decode().splitlines()).issubset(set(paths))
print(json.dumps({key:value for key,value in record.items() if key!='files'},indent=2))
