from pathlib import Path
import ast,json,hashlib,subprocess
w=Path(__file__).resolve().parents[2];h=w/'WP/backlog-resume-20261013';k=w/'WP/batch-release-kit-be837974-20261016'
old=h/'publish-kit-backup-main540-fixture-successor-once.py';target=h/'publish-kit-backup-main540-paired-count-successor-once.py';assert not target.exists()
partial=k/'backup-main540-fixture-successor-publication-once';assert partial.is_dir() and not (partial/'new-local-fixtures-hash-inventory.json').exists()
v=json.loads((k/'local-tests-backup-main540-second/verification.json').read_bytes());assert v['exitCode']==0 and v['sourceBefore']==v['sourceAfter'] and all(hashlib.sha256((k/n).read_bytes()).hexdigest()==d for n,d in v['sourceBefore'].items())
assert not subprocess.check_output(['git','diff','--cached','--name-only'],cwd=w).strip()
s=old.read_text(encoding='utf8')
def once(a,b):
 global s
 assert s.count(a)==1,(a,s.count(a));s=s.replace(a,b)
once("with_name('backup-main540-fixture-successor-publication-notes-once.txt')","with_name('backup-main540-paired-count-successor-publication-notes-once.txt')")
once("D=K/'backup-main540-fixture-successor-publication-once'","D=K/'backup-main540-paired-count-successor-publication-once'")
once("sum(r['pairedReadonlyVersusWritableQueryOnly'] for r in check_hazard_rows)==3","sum(r['pairedReadonlyVersusWritableQueryOnly'] for r in check_hazard_rows)==3*len(runs)")
once("extras.add(pathlib.Path(__file__).resolve())","""extras|={p for p in (K/'backup-main540-fixture-successor-publication-once').iterdir() if p.is_file()}
for name in ('prepare-backup-main540-paired-count-successor-once.py','backup-main540-paired-count-successor-publication-notes-once.txt','publish-kit-backup-main540-fixture-successor-once.py'):
 extras.add(W/'WP/backlog-resume-20261013'/name)
extras.add(pathlib.Path(__file__).resolve())""")
ast.parse(s)
notes=(h/'backup-main540-fixture-successor-publication-notes-once.txt').read_text(encoding='utf8').replace('Publication WP/batch-release-kit-be837974-20261016/backup-main540-fixture-successor-publication-once.','Publication WP/batch-release-kit-be837974-20261016/backup-main540-paired-count-successor-publication-once.')
note='First actual publisher publish-kit-backup-main540-fixture-successor-once.py REFUSED stale paired-reader-check predicate hardcoded3 after TWO full runs produced6 paired cases. ALL10 publication API originals and20 partial public files retained BEFORE refusal; NEW-only current-boundary fixture reads occurred, BEFORE inventory JSON/README/Git/host mutation. Full234 final sources independently unchanged. Unique count-aware successor rechecks ALL frozen sources/APIs and newly inventories ONLY current delta. Re-reading current NEW delta after refused publication is NOT rereading previously inventoried old payloads. Original error TOOL OUTPUT TRANSCRIPTION ONLY/no independently retained diagnostic stderr file; derived refusal record retains exact stated predicate/source location. No source edit/retest/operational attempt. Both actual publishers consumed; original prepared publish-kit-backup-main540-once.py never executed/superseded/never execute.\n\n'
notes=notes.replace('NEW-only private inventory references ALL46',note+'NEW-only private inventory references ALL46')
notes=notes.replace('publish-kit-backup-main540-fixture-successor-once.py CONSUMED NEVER REPLAY.','publish-kit-backup-main540-fixture-successor-once.py,prepare-backup-main540-paired-count-successor-once.py,publish-kit-backup-main540-paired-count-successor-once.py CONSUMED NEVER REPLAY.')
(h/'backup-main540-paired-count-successor-publication-notes-once.txt').open('x',encoding='utf8').write(notes)
record={'refusedPublisher':old.name,'exactSourceLine':445,'statedReason':'paired reader check count hardcoded3 despite TWO full frozen runs/expected6','type':'TOOL OUTPUT TRANSCRIPTION ONLY','independentlyRetainedDiagnosticStderr':False,'all234FinalSourcesUnchanged':True,'tenApiOriginalsRetainedBeforePredicates':True,'partialPublicFiles':sorted(p.name for p in partial.iterdir() if p.is_file()),'newPrivateInventoryJsonAbsent':True,'readmeOrGitMutation':False,'oldPrivatePayloadsRead':False,'currentBoundaryNewPayloadsWillBeRecheckedByUniqueSuccessor':True,'noRetestRequiredOrDispatched':True}
(h/'backup-main533-entry-1208-once/first-publication-paired-count-refusal.json').open('xb').write((json.dumps(record,sort_keys=True)+'\n').encode())
target.open('x',encoding='utf8',newline='').write(s);print(json.dumps({'publisherPrepared':str(target),'executed':False,'sourceEditsOrRetest':False,'pairedCaseCountPerFullRun':3,'fullRuns':2}))
