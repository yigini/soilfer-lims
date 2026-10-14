"""Reconcile original failed assertion occurrences against retained closed proofs, once."""
import collections,datetime,hashlib,json,subprocess,sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf8')
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent;dest=wp/'issue209-original-case-reconciliation-566'
assert not dest.exists()
base=wp/'issue209-full-ordinary-companion/report-original.json'
baseline=json.loads(base.read_bytes())
assert baseline['numFailedTests']==650 and baseline['numTotalTests']==5630
counts=collections.Counter((Path(s['name']).name,a['fullName']) for s in baseline['testResults'] for a in s['assertionResults'] if a['status']=='failed')
assert sum(counts.values())==650 and len(counts)==648
best=collections.Counter();evidence={};references={}
for ix in sorted(wp.glob('issue209-*/index.json')):
 d=json.loads(ix.read_bytes());summary=d.get('summary',{})
 if summary.get('status')!='PASS':continue
 for name,pin in d.get('rawFiles',{}).items():
  if not name.endswith('/report-original.json'):continue
  p=root/name
  assert hashlib.sha256(p.read_bytes()).hexdigest()==pin['sha256'],name
  r=json.loads(p.read_bytes())
  if not r.get('success') or any(r.get(k)!=0 for k in ['numFailedTests','numPendingTests','numTodoTests','numFailedTestSuites','numPendingTestSuites']):continue
  current=collections.Counter((Path(s['name']).name,c['fullName']) for s in r['testResults'] for c in s['assertionResults'] if c['status']=='passed')
  for key,total in current.items():
   if key in counts and total>best[key]:best[key]=total;evidence[key]=name;references[name]={'sha256':pin['sha256'],'retentionIndex':ix.relative_to(root).as_posix(),'proofKind':'CLOSED_PASS_REPORT_REFERENCED_BY_PASS_RETENTION_INDEX'}
# These two closed successful children preceded a separate third-child failure.
# The third child's failure and aggregate remain unchanged; do not infer aggregate PASS.
partial=wp/'issue209-result-policy-qc-cancellation-serial-singles/index.json';d=json.loads(partial.read_bytes())
assert d['summary']['status']=='FAILED_OR_INCOMPLETE'
allowed={'audit_0_15_duplicate_loq.test.js':63,'audit_1_0_lab_policies.test.js':36}
before=json.loads((partial.parent/'source-before.json').read_bytes())
for name,pin in d['rawFiles'].items():
 if not name.endswith('/report-original.json'):continue
 p=root/name;r=json.loads(p.read_bytes())
 if len(r.get('testResults',[]))!=1:continue
 suite=r['testResults'][0];n=Path(suite['name']).name
 if n not in allowed:continue
 s=json.loads((p.parent/'observed-closed-summary.json').read_bytes())
 assert s['status']=='PASS' and s['sourceUnchanged'] and int((p.parent/'exit-original.txt').read_text())==0
 assert r['success'] and r['numTotalTests']==r['numPassedTests']==allowed[n]
 assert all(r[k]==0 for k in ['numFailedTests','numPendingTests','numTodoTests','numFailedTestSuites','numPendingTestSuites'])
 assert hashlib.sha256(p.read_bytes()).hexdigest()==pin['sha256']
 fixture='server/tests/contracts/'+n
 assert hashlib.sha256((root/fixture).read_bytes()).hexdigest()==before[fixture]
 current=collections.Counter((n,c['fullName']) for c in suite['assertionResults'] if c['status']=='passed')
 for key,total in current.items():
  if key in counts and total>best[key]:best[key]=total;evidence[key]=name;references[name]={'sha256':pin['sha256'],'retentionIndex':partial.relative_to(root).as_posix(),'proofKind':'CLOSED_PASS_CHILD_OF_HONEST_FAILED_AGGREGATE','childClosedUtc':s['closedUtc'],'fixtureCurrentHashEqualsOriginalDispatch':True,'noCurrentFullRuntimeProofInferred':True}
resolved=sum(min(v,best[k]) for k,v in counts.items())
assert resolved==566 and sum(counts.values())-resolved==84
rows=[];remaining=collections.Counter()
for suite in baseline['testResults']:
 occurrences=collections.Counter()
 for ordinal,c in enumerate(suite['assertionResults'],1):
  key=(Path(suite['name']).name,c['fullName']);occurrences[key]+=1
  if c['status']!='failed':continue
  outcome=occurrences[key]<=best[key]
  if not outcome:remaining[key[0]]+=1
  rows.append({'suite':key[0],'originalOrdinalInSuite':ordinal,'test':key[1],'titleOccurrenceInSuite':occurrences[key],'originalFailureSha256':hashlib.sha256('\n'.join(c['failureMessages']).encode()).hexdigest(),'closedPassingProofMatched':outcome,'closedPassingReport':evidence.get(key) if outcome else None,'unresolvedCasesRequireSourceClassificationBeforeCorrection':not outcome})
assert len(rows)==650 and sum(r['closedPassingProofMatched'] for r in rows)==566
assert sum(remaining.values())==84 and len(remaining)==21
source=json.loads((wp/'issue209-mobile-offline-context-singles/index.json').read_bytes())['sourceDraftPaths'];assert len(source)==101
def git(*a):return subprocess.run(['git',*a],cwd=root,capture_output=True,check=True).stdout
assert git('branch','--show-current').strip()==b'audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip()
head=git('rev-parse','HEAD').decode().strip();assert head=='75824dca7024b5a3169e9ef2333608abd719a704'
objects={}
for entry in git('ls-tree','-r','-z',head,'--',*references).split(b'\0'):
 if entry:
  meta,p=entry.split(b'\t',1);objects[p.decode()]=meta.decode().split()[2]
assert set(objects)==set(references)
for p,pin in references.items():assert hashlib.sha256(git('cat-file','blob',objects[p])).hexdigest()==pin['sha256'],p
dest.mkdir()
ledger={'reconciledUtc':datetime.datetime.now(datetime.UTC).isoformat(),'originalReport':base.relative_to(root).as_posix(),'originalReportSha256':hashlib.sha256(base.read_bytes()).hexdigest(),'originalFailedAssertions':650,'uniqueFailedSuiteTitlePairs':648,'twoRepeatedTitlesPreservedByOccurrence':True,'resolvedAssertionOccurrences':566,'unresolvedAssertionOccurrences':84,'unresolvedSuites':dict(sorted(remaining.items())),'cases':rows,'passingReportReferences':references,'twoPriorPassChildrenOfFailedAggregateKeptDistinct':True,'focusedProofsOnly':True,'currentFull370Pass':False,'futureFullExpectedTests':5642,'sourceDraftPaths':source,'productionOperations':0}
(dest/'case-ledger.json').write_bytes((json.dumps(ledger,indent=2)+'\n').encode())
pin={'bytes':(dest/'case-ledger.json').stat().st_size,'sha256':hashlib.sha256((dest/'case-ledger.json').read_bytes()).hexdigest()}
(dest/'index.json').write_bytes((json.dumps({'ledger':pin,'previousAuditHead':head,'resolved':566,'remaining':84,'productionOperations':0},indent=2)+'\n').encode())
lead='## 2026-10-14 #209 original failed assertion ledger independently reconciled566/650\n\nRetained closed report references independently reconcile all650 original failed assertion occurrences:566 have matching closed passing proofs,84 remain across21 suites. Two repeated legacy-result titles kept as separate occurrences; no title-set undercount. Two prior LOQ63/policy36 PASS children remain explicitly separate from their honest failed aggregate; their current fixture bytes equal original dispatch. Referenced report Git blobs independently verified at75824dca. Case ledger and original ordinal/failure hashes at issue209-original-case-reconciliation-566/index.json; focused evidence only/no current full370PASS. Latest closed mobile/offline6/334/101draftpaths46raw+4review75824d and validation11/354/99paths b133 immutable. No runner/PR/ready/finalaudit/merge/kit/gate/production operation. Next remaining cases require source classification before additions; QC-controls1/texture-policy2 read only so far. Native unlocked512 checkpoint/Cl nothing-needed reply30049 already once complete, human draft/cards untouched/no duplicate notice. Future full370 expected5642, derived help manifest only mutable output before/after bytes/hash; all source/shared/Prisma/scenarios/template/other inputs frozen. All four actual scope answers/ONE accepted receipt expectation/runtime orphan refusals/readonly impact lists/approvednonzeroSTOP/no amendmentorderstep/backfill/relink/103noapply/206+214 green undeployed/open/history guards hold.\n\n'
readmes=['WP/audit-release-eb6de2e8/README.md','WP/runtime-recovery-kobo/README.md']
for p in readmes:
 f=root/p;f.write_bytes(lead.encode()+f.read_bytes())
owned=[(dest/'case-ledger.json').relative_to(root).as_posix(),(dest/'index.json').relative_to(root).as_posix(),Path(__file__).relative_to(root).as_posix()]+readmes
git('add','-f','--',*owned);assert set(git('diff','--cached','--name-only').decode().splitlines())<=set(owned)
git('commit','-m','audit(209): reconcile original failed case occurrences566')
head=git('rev-parse','HEAD').decode().strip()
assert hashlib.sha256(git('show',head+':'+(dest/'case-ledger.json').relative_to(root).as_posix())).hexdigest()==pin['sha256']
git('push','origin',head+':refs/heads/audit/release-eb6de2e8')
assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head
print(json.dumps({'auditHead':head,'originalAssertions':650,'resolved':566,'remaining':84,'remainingSuites':21,'verifiedReferencedReportBlobs':len(references),'productionOperations':0}))
