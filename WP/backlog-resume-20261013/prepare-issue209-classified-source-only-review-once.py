"""PREPARED ONLY. Bind a source-only review ref after actual retained local full PASS."""
import datetime,hashlib,json,os,subprocess,sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf8')
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent;base='2242bcb4861a7085bb95e78e0e7b1e4edf11d1b8';ref='refs/heads/codex/issue-209-order-revisions'
def run(argv,env=None,data=None):
 r=subprocess.run(argv,cwd=root,env=env,input=data,capture_output=True,check=True);return r.stdout
def git(*a,env=None,data=None):return run(['git',*a],env,data)
def api(path):return json.loads(run(['gh','api',path]))
terminal=json.loads((wp/'issue209-full-classified-ordinary/terminal-index.json').read_bytes());summary=terminal['summary']
assert summary['status']=='PASS' and summary['exit']==0 and summary['suites']==summary['passedSuites']==370 and summary['tests']==summary['passedTests']==5642
assert summary['failed']==summary['failedSuites']==summary['pending']==summary['todo']==0 and summary['sourceUnchanged'] and summary['selectedInventoryEqual'] and summary['visibleAssetsUnchanged']
frozen=json.loads((wp/'issue209-full-classified-ordinary/source-before.json').read_bytes());assert frozen==json.loads((wp/'issue209-full-classified-ordinary/source-after.json').read_bytes())
for p,d in frozen.items():assert hashlib.sha256((root/p).read_bytes()).hexdigest()==d,p
ledger=json.loads((wp/'issue209-original-case-reconciliation-650/case-ledger.json').read_bytes());assert ledger['resolvedAssertionOccurrences']==650 and ledger['unresolvedAssertionOccurrences']==0
assert git('branch','--show-current').strip()==b'audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip()
source=git('rev-parse','HEAD').decode().strip();objects={}
for entry in git('ls-tree','-r','-z',source,'--',*terminal['rawFiles']).split(b'\0'):
 if entry:meta,p=entry.split(b'\t',1);objects[p.decode()]=meta.decode().split()[2]
assert set(objects)==set(terminal['rawFiles'])
for p,pin in terminal['rawFiles'].items():assert hashlib.sha256(git('cat-file','blob',objects[p])).hexdigest()==pin['sha256'],p
assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==source
main=api('repos/yigini/soilfer-lims/git/ref/heads/main');assert main['object']['sha']==base,'Main changed: inspect and bind a new base.'
assert git('rev-parse','origin/main').strip()==base.encode()
assert not api('repos/yigini/soilfer-lims/pulls?state=all&head=yigini:codex/issue-209-order-revisions')
assert subprocess.run(['git','show-ref','--verify','--quiet',ref],cwd=root).returncode==1 and not git('ls-remote','origin',ref)
paths=git('diff','--name-only',base,source,'--','.',':!WP').decode().splitlines();assert len(paths)==122 and set(paths)==set(terminal['sourceDraftPaths'])
for p in paths:assert git('show',source+':'+p)==(root/p).read_bytes().replace(b'\r\n',b'\n'),p
dest=wp/'issue209-classified-source-only-review';index=wp/'issue209-classified-source-only-review.index';assert not dest.exists() and not index.exists();dest.mkdir()
(dest/'main-original.json').write_bytes((json.dumps(main,indent=2)+'\n').encode());env=dict(os.environ,GIT_INDEX_FILE=str(index));git('read-tree',base,env=env)
pins=['server/prisma/migrations/20261014000100_order_revision_contract/migration.sql text eol=lf','server/services/orderRevisionMigrationSource.js text eol=lf']
for p in paths:
 entry=git('ls-tree',source,'--',p).decode().strip();meta,listed=entry.split('\t',1);mode,kind,blob=meta.split();assert kind=='blob' and listed==p
 if p=='.gitattributes':
  old=git('show',base+':'+p);current=git('show',source+':'+p)
  applicationLines=lambda b:[l for l in b.decode().splitlines() if l.strip() and not l.startswith(('#','WP/'))]
  assert applicationLines(current)==applicationLines(old)+pins
  blob=git('hash-object','-w','--stdin',data=old.rstrip(b'\r\n')+b'\n'+('\n'.join(pins)+'\n').encode()).decode().strip()
 git('update-index','--add','--cacheinfo',mode+','+blob+','+p,env=env)
tree=git('write-tree',env=env).decode().strip();assert sorted(git('diff','--name-only',base,tree).decode().splitlines())==sorted(paths)
assert not git('diff','--name-only',source,tree,'--','.',':!WP',':!.gitattributes')
head=git('commit-tree',tree,'-p',base,data=b'feat(workflow): bind executions to reasoned order revisions\n').decode().strip();assert git('rev-parse',head+'^').strip()==base.encode();git('update-ref',ref,head,'0'*40)
record={'preparedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'auditSource':source,'base':base,'reviewHead':head,'reviewTree':tree,'reviewRef':ref,'paths':paths,'sourcePathCount':122,'fullLocalSummary':summary,'applicationEqualityVerified':True,'attributeDelta':pins,'newAuditWpAttributesExcluded':True,'auditCheckoutUnchanged':True,'newCheckouts':0,'newWorktrees':0,'productionOperations':0}
(dest/'review-ref.json').write_bytes((json.dumps(record,indent=2)+'\n').encode());assert git('rev-parse','HEAD').strip()==source.encode()
print(json.dumps({k:v for k,v in record.items() if k not in ['paths','fullLocalSummary']}))
