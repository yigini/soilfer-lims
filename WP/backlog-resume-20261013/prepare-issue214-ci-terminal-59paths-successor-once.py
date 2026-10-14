"""Prepare a unique CI retainer for verified actual59-path source; preserve old unused58 variant."""
import datetime,hashlib,json,subprocess
from pathlib import Path
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent
old=wp/'retain-pr296-policy-owner-new-ci-terminal-once.py'
successor=wp/'retain-pr296-policy-owner-new-ci-terminal-59paths-once.py'
dest=wp/'issue214-policy-owner-source-equivalence-59paths'
assert not successor.exists() and not dest.exists()
def git(*args):return subprocess.run(['git',*args],cwd=root,capture_output=True,check=True).stdout
assert git('branch','--show-current').strip()==b'audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip()
head='8d564c24f05a3b069bf027bbb7ba4f92cea597b0';base='6d750914d8565acdd496767a7dd935811b5a89b2';prior='e47b842c2a7f6b4f06fa4c532f7460c01797821b'
paths=git('diff','--name-only',base,head).decode().splitlines();priorPaths=git('diff','--name-only',base,prior).decode().splitlines()
newlyChanged=sorted(set(paths)-set(priorPaths))
assert len(paths)==59 and len(priorPaths)==55 and not (set(priorPaths)-set(paths))
assert newlyChanged==['server/scripts/install_lab_policy_schema.js','server/scripts/rehearsal_deployment_readiness.cjs','server/services/labPolicyMigrationSource.js','server/tests/contracts/issue_214_lab_policy_schema.test.js']
assert not any(p.startswith('WP/') for p in paths)
pins={}
for p in paths:
 data=git('show',head+':'+p);pins[p]=hashlib.sha256(data).hexdigest()
 if p!='.gitattributes':assert data==(root/p).read_bytes().replace(b'\r\n',b'\n'),p
attrs=git('show',prior+':.gitattributes').rstrip(b'\r\n')+b'\nserver/prisma/migrations/20261004085500_add_lab_policy_settings/migration.sql text eol=lf\nserver/services/labPolicyMigrationSource.js text eol=lf\n'
assert git('show',head+':.gitattributes')==attrs
frozen=json.loads((wp/'issue214-policy-owner-full/source-before.json').read_bytes())
assert len(frozen)==421 and all(hashlib.sha256((root/p).read_bytes()).hexdigest()==digest for p,digest in frozen.items())
data=old.read_bytes();text=data.decode();assert text.count('len(paths)==58')==1
text=text.replace('len(paths)==58','len(paths)==59')
text=text.replace('"""Retain CLOSED original corrected-head CI honestly once; never dispatch/retry."""','"""Retain CLOSED corrected-head CI against actual verified59 paths, once; no dispatch/retry.\nSupersedes the UNUSED58-path retainer; preserve and NEVER EXECUTE that earlier variant.\n"""')
successor.write_bytes(text.encode())
dest.mkdir()
record={'verifiedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'head':head,'base':base,
 'sourcePathCount':59,'previousSourcePathCount':55,'newlyChangedAgainstBase':newlyChanged,
 'oldToNewAcceptedPaths':git('diff','--name-only',prior,head).decode().splitlines(),
 'allPushedApplicationFilesMatchTestedLFContent':True,'exactTwoIntendedNewAttributePins':True,
 'sourceGitBlobSha256':pins,'frozen421InputsUnchanged':True,'wpPaths':[],
 'firstReadOnlyCheckRefusedWrongExpectedCount58':True,'applicationOrCiFailure':False,
 'supersededUnusedRetainer':old.relative_to(root).as_posix(),'supersededRetainerSha256':hashlib.sha256(data).hexdigest(),
 'supersededRetainerMustNeverExecute':True,'newPreparedUnusedRetainer':successor.relative_to(root).as_posix(),
 'applicationChanges':0,'ciDispatches':0,'productionOperations':0}
(dest/'source-equivalence.json').write_bytes((json.dumps(record,indent=2)+'\n').encode())
lead='''## 2026-10-14 #214 actual59 source paths verified; unused retainer expectation corrected

PR296 exact8d564c24/base6d contains59 application paths, all equal tested LF content; exact2newapp attribute pins/noWP/all421frozeninputsunchanged. OldPR55 gains3newowner/loader/test files plus existing readiness rehearsal now changed againstbase. Accepted old→new delta remains exact12paths. First independent read-only check refused its wrong expected58 count; this is NOT an application/CI failure and changed no source. Evidence at `WP/backlog-resume-20261013/issue214-policy-owner-source-equivalence-59paths/source-equivalence.json`. Earlier UNUSED retain-pr296-policy-owner-new-ci-terminal-once.py assumes58 and MUST NEVER EXECUTE; original preserved. NEW PREPARED UNUSED retain-pr296-policy-owner-new-ci-terminal-59paths-once.py is bound to same actual38515104824/newhead and59paths; readbeforeuse onlyafteractualCLOSED, retain honestly. CurrentCIactive/no finalauditrequest; requestnewexacthead onlyafterclosedgreen366/5565+allactualDocker+policyproof, then209. Samewriter/no source/production change/humancontentpreserved/allguards hold.

'''
readmes=['WP/audit-release-eb6de2e8/README.md','WP/runtime-recovery-kobo/README.md']
for p in readmes:
 f=root/p;f.write_bytes(lead.encode()+f.read_bytes())
owned=readmes+[Path(__file__).relative_to(root).as_posix(),successor.relative_to(root).as_posix(),(dest/'source-equivalence.json').relative_to(root).as_posix()]
hashes={p:hashlib.sha256((root/p).read_bytes()).hexdigest() for p in owned if p not in readmes}
git('add','--',*owned);assert set(git('diff','--cached','--name-only').decode().splitlines())<=set(owned)
git('commit','-m','audit(214): verify actual59 source paths and prepare unique CI retainer')
audit=git('rev-parse','HEAD').decode().strip()
for p,digest in hashes.items():assert hashlib.sha256(git('show',audit+':'+p)).hexdigest()==digest,p
assert old.read_bytes()==data
git('push','origin','HEAD:refs/heads/audit/release-eb6de2e8')
assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==audit
print(json.dumps({'auditHead':audit,'sourcePathCount':59,'newlyChangedAgainstBase':newlyChanged,'sourceMatchedTested':True,'verifiedBlobs':len(hashes),'applicationChanges':0}))
