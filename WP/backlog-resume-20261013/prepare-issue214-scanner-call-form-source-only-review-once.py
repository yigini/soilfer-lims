"""Prepare one source-only review ref after the closed, retained full PASS.

Keep the audit checkout and its unrelated working-tree changes untouched.
Never execute this helper twice or overwrite an existing review ref/index.
"""
import datetime, hashlib, json, os, subprocess, sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf-8')
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent
base='6d750914d8565acdd496767a7dd935811b5a89b2'
ref='refs/heads/codex/issue-214-control-charts'

def command(argv,env=None,data=None):
    result=subprocess.run(argv,cwd=root,env=env,input=data,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    if result.returncode:raise RuntimeError(result.stderr.decode('utf-8','replace'))
    return result.stdout
def git(*args,env=None,data=None,binary=False):
    value=command(['git',*args],env=env,data=data)
    return value if binary else value.decode('utf-8').strip()
def gh(path):return json.loads(command(['gh','api',path]))

summary=json.loads((wp/'issue214-scanner-call-form-full/summary.json').read_bytes())
assert summary['status']=='PASS' and summary['exitCode']==0
assert summary['suites']==summary['passedSuites']==365 and summary['tests']==summary['passedTests']==5547
assert summary['failed']==summary['pending']==summary['failedSuites']==0
assert summary['inventoryEqual'] and summary['sourceUnchanged'] and summary['nodeOptions']==''
retention=json.loads((wp/'issue214-scanner-call-form-full-pass/index.json').read_bytes())
source=git('rev-parse','HEAD')
for path,row in retention.items():
    assert hashlib.sha256(git('show',source+':'+path,binary=True)).hexdigest()==row['sha256'],path
frozen=json.loads((wp/'issue214-scanner-call-form-full/source-before.json').read_bytes())
assert frozen==json.loads((wp/'issue214-scanner-call-form-full/source-after.json').read_bytes()) and len(frozen)==415
assert all(hashlib.sha256((root/path).read_bytes()).hexdigest()==digest for path,digest in frozen.items())
assert git('branch','--show-current')=='audit/release-eb6de2e8' and not git('diff','--cached','--name-only')
main=gh('repos/yigini/soilfer-lims/git/ref/heads/main')
assert main['object']['sha']==base,'Main changed: inspect and bind a new reviewed base, never guess.'
assert git('rev-parse','origin/main')==base
assert not gh('repos/yigini/soilfer-lims/pulls?state=all&head=yigini:codex/issue-214-control-charts')
assert subprocess.run(['git','show-ref','--verify','--quiet',ref],cwd=root).returncode==1
assert not git('ls-remote','origin',ref)
owned=set(json.loads((wp/'issue214-draft-checkpoint-1917/source-raw-before-stage.json').read_bytes()))
owned.add('server/tests/contracts/audit_2_3_compatibility_runs.test.js')
paths=git('diff','--name-only',base,source,'--','.',':!WP').splitlines()
assert len(paths)==55 and set(paths)<=owned and '.gitattributes' in paths
for path in paths:
    raw=(root/path).read_bytes();blob=git('show',source+':'+path,binary=True)
    expected=raw if path=='server/tests/fixtures/pre214-native-run-source.cjs' else raw.replace(b'\r\n',b'\n')
    assert blob==expected,path

dest=wp/'issue214-scanner-call-form-source-only-review'
index=wp/'issue214-scanner-call-form-source-only-review.index'
assert not dest.exists() and not index.exists()
dest.mkdir()
(dest/'main-original.json').write_bytes((json.dumps(main,indent=2)+'\n').encode())
env=dict(os.environ,GIT_INDEX_FILE=str(index))
git('read-tree',base,env=env)
pins=['server/prisma/migrations/20261013000200_control_charts/migration.sql text eol=lf',
      'server/services/controlChartMigrationSource.js text eol=lf',
      'server/tests/fixtures/pre214-native-run-source.cjs -text']
for path in paths:
    mode,kind,remainder=git('ls-tree',source,'--',path).split(' ',2)
    blob,listed=remainder.split('\t',1)
    assert kind=='blob' and listed==path
    if path=='.gitattributes':
        old=git('show',base+':'+path,binary=True)
        current=git('show',source+':'+path,binary=True)
        applicationLines=lambda value:[line for line in value.decode('utf-8').splitlines() if line.strip() and not line.startswith(('#','WP/'))]
        assert applicationLines(current)==applicationLines(old)+pins
        attrs=old.rstrip(b'\r\n')+b'\n'+('\n'.join(pins)+'\n').encode()
        blob=git('hash-object','-w','--stdin',data=attrs)
    git('update-index','--add','--cacheinfo',mode+','+blob+','+path,env=env)
tree=git('write-tree',env=env)
assert sorted(git('diff','--name-only',base,tree).splitlines())==sorted(paths)
assert not git('diff','--name-only',source,tree,'--','.',':!WP',':!.gitattributes')
head=git('commit-tree',tree,'-p',base,data=b'feat(214): freeze control chart limits and QC review evidence\n\nRequire prebound LRM lots for newly started chart-mode runs; preserve fixed-window and historical run behavior.\n')
assert git('rev-parse',head+'^')==base
git('update-ref',ref,head,'0'*40)
record={'preparedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'auditSource':source,'base':base,
        'reviewHead':head,'reviewTree':tree,'reviewRef':ref,'paths':paths,'sourcePathCount':len(paths),
        'fullLocalSummary':summary,'applicationEqualityVerified':True,
        'attributeDelta':pins,'historicalWpAttributesExcluded':True,'auditCheckoutUnchanged':True,
        'newCheckouts':0,'newWorktrees':0,'productionOperations':0}
(dest/'review-ref.json').write_bytes((json.dumps(record,indent=2)+'\n').encode())
assert git('rev-parse','HEAD')==source and git('branch','--show-current')=='audit/release-eb6de2e8'
print(json.dumps(record))
