"""Retain one closed failed scanner successor and its exact source honestly."""
import datetime,hashlib,json,subprocess,sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf-8')
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent
run=wp/'issue214-scanner-caller-focused';dest=wp/'issue214-scanner-caller-focused-failure'
summary=json.loads((run/'summary.json').read_bytes());report=json.loads((run/'report-original.json').read_bytes())
assert summary['status']=='FAILED_OR_INCOMPLETE' and summary['exitCode']==1 and not report['success']
assert summary['suites']==14 and summary['tests']==293 and summary['failed']==1 and summary['pending']==0
assert summary['sourceUnchanged'] and summary['inventoryEqual']
before=json.loads((run/'source-before.json').read_bytes())
assert len(before)==415 and before==json.loads((run/'source-after.json').read_bytes())
assert all(hashlib.sha256((root/path).read_bytes()).hexdigest()==digest for path,digest in before.items())
failures=[{'suite':suite['name'],'test':case['fullName'],'failureMessages':case['failureMessages']}
          for suite in report['testResults'] for case in suite['assertionResults'] if case['status']=='failed']
assert len(failures)==1 and 'HISTORICAL_FIXTURE_CALLER_NOT_ALLOWED' in ''.join(failures[0]['failureMessages'])
def git(*args,binary=False):
    result=subprocess.run(['git',*args],cwd=root,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    if result.returncode:raise RuntimeError(result.stderr.decode('utf-8','replace'))
    return result.stdout if binary else result.stdout.decode('utf-8').strip()
assert git('branch','--show-current')=='audit/release-eb6de2e8' and git('rev-parse','HEAD')=='e6911e32c2c66fd6dbd52d306b3ebed34d52f959'
assert not git('diff','--cached','--name-only') and not dest.exists();dest.mkdir()
record={'retainedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'sessionId':72037,'summary':summary,'failedCases':failures,
        'finding':'Caller registration is present; the fixture must also use the existing destructured-import/direct-call/identifier-argument form. Do not relax scanner predicates.',
        'unusedHelpersMustNotExecute':['retain-issue214-scanner-caller-focused-pass-once.py','verify-issue214-scanner-caller-full-once.py'],
        'productionOperations':0}
(dest/'terminal-boundary.json').write_bytes((json.dumps(record,indent=2)+'\n').encode())
lead=('## 2026-10-13 #214 focused caller registration CLOSED FAILED\n\n'
      f"The unique successor closed at {summary['observedUtc']}: 13/14 suites and 292/293 tests PASS, one scanner failure, zero pending; all 415 frozen inputs unchanged. "
      'The specific caller is registered, but its inline member call does not satisfy the existing scanner requirement '
      'for one destructured export, a direct immutable binding call and one owned-file identifier argument. '
      'Retain the original result/source at `WP/backlog-resume-20261013/issue214-scanner-caller-focused-failure/index.json`; '
      'fix only the fixture call form, keeping the pinned helper and all scanner predicates/assertions unchanged. '
      'Use new unique successors. The unused PASS retainer and prepared full helper in the terminal record must not execute. '
      'No #214 PR, CI, audit PASS, merge, kit, gate or production operation exists; #103 has no production connection/apply go.\n\n')
readmes=['WP/audit-release-eb6de2e8/README.md','WP/runtime-recovery-kobo/README.md']
for path in readmes:(root/path).write_bytes(lead.encode()+(root/path).read_bytes())
evidence=[path.relative_to(root).as_posix() for folder in [run,dest,wp/'issue214-scanner-caller-correction'] for path in folder.iterdir() if path.is_file()]
evidence += ['server/tests/helpers/workflowWriteScanner.js',Path(__file__).relative_to(root).as_posix(),
             'WP/backlog-resume-20261013/prepare-issue214-scanner-caller-successors-once.py',
             'WP/backlog-resume-20261013/verify-issue214-scanner-caller-focused-once.py']
evidence += ['WP/backlog-resume-20261013/'+name for name in record['unusedHelpersMustNotExecute']]
index={path:{'bytes':(root/path).stat().st_size,'sha256':hashlib.sha256((root/path).read_bytes()).hexdigest()} for path in evidence}
(dest/'index.json').write_bytes((json.dumps(index,indent=2)+'\n').encode())
owned=evidence+readmes+[(dest/'index.json').relative_to(root).as_posix()]
git('add','-f','--',*owned)
assert set(git('diff','--cached','--name-only').splitlines())<=set(owned)
git('commit','-m','Retain scanner fixture call-form failure without weakening predicates')
head=git('rev-parse','HEAD')
for path,row in index.items():assert hashlib.sha256(git('show',head+':'+path,binary=True)).hexdigest()==row['sha256'],path
git('push','origin','HEAD:refs/heads/audit/release-eb6de2e8')
assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').split()[0]==head
print(json.dumps({'status':'FOCUSED_SCANNER_FAILURE_RETAINED','auditCommit':head,'exactBlobsVerified':len(index),'summary':summary}))
