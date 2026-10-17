from pathlib import Path
import ast,json,hashlib,subprocess
w=Path(__file__).resolve().parents[2];h=w/'WP/backlog-resume-20261013';k=w/'WP/batch-release-kit-be837974-20261016';entry=h/'backup-binding540-entry-1236-once'
target=h/'publish-kit-backup-binding547-delta-successor-once.py';assert not target.exists()
partial=k/'backup-binding547-publication-once';assert partial.is_dir() and not (partial/'new-local-fixtures-hash-inventory.json').exists()
v=json.loads((k/'local-tests-backup-binding547-first/verification.json').read_bytes());assert v['exitCode']==0 and v['sourceBefore']==v['sourceAfter'] and len(v['sourceBefore'])==237 and all(hashlib.sha256((k/n).read_bytes()).hexdigest()==digest for n,digest in v['sourceBefore'].items())
assert not subprocess.check_output(['git','diff','--cached','--name-only'],cwd=w).strip()
s=(h/'publish-kit-backup-binding547-once.py').read_text(encoding='utf8')
def once(a,b):
 global s
 assert s.count(a)==1,(a,s.count(a));s=s.replace(a,b)
once("with_name('backup-binding547-publication-notes-once.txt')","with_name('backup-binding547-delta-successor-publication-notes-once.txt')")
once("D=K/'backup-binding547-publication-once'","D=K/'backup-binding547-delta-successor-publication-once'")
old="""    if relative.startswith('backup-binding-local-retained-fixtures/') and path.name in ('snapshot-original.json','plan-before-backup.json','python-case-result.json','destination.db'):
     case=backup_binding_cases.setdefault(path.parent.relative_to(K).as_posix(),{})
     case[path.name]={'path':relative,'bytes':len(raw),'sha256':sha(raw),'value':json.loads(raw) if path.name.endswith('.json') else None}"""
new='\n'.join(line[1:] for line in old.splitlines());once(old,new)
once('extras.add(pathlib.Path(__file__).resolve())',"""extras|={p for p in (K/'backup-binding547-publication-once').iterdir() if p.is_file()}
for name in ('publish-kit-backup-binding547-once.py','prepare-backup-binding547-delta-successor-once.py','backup-binding547-delta-successor-publication-notes-once.txt'):
 extras.add(W/'WP/backlog-resume-20261013'/name)
extras.add(pathlib.Path(__file__).resolve())""")
ast.parse(s)
notes=(h/'backup-binding547-publication-notes-once.txt').read_text(encoding='utf8').replace('Publication WP/batch-release-kit-be837974-20261016/backup-binding547-publication-once.','Publication WP/batch-release-kit-be837974-20261016/backup-binding547-delta-successor-publication-once.')
disclosure='First actual publisher publish-kit-backup-binding547-once.py REFUSED new-feature case-count predicate at line530. Source review identified new backup-binding file selection incorrectly nested under incompatible backup-main prefix. No original counter values independently retained; nesting cause is source-derived. ALL10 API originals/24partialpublicfiles retained; NEW-only current-boundary fixture reads happened BEFORE inventory JSON/README/Git/host mutation. ALL237 frozen sources unchanged. Unique delta-selection successor fixes ONLY publisher indentation, freshly rechecks frozen sources/APIs and inventories ONLY current NEW delta; no source edit/retest. Diagnostic TOOL OUTPUT TRANSCRIPTION ONLY/no independently retained original diagnostic stderr. Both actual publishers consumed/never replayed.\n\n'
notes=notes.replace('NEW private inventory references ALL47',disclosure+'NEW private inventory references ALL47')
notes=notes.replace('publish-kit-backup-binding547-once.py CONSUMED NEVER REPLAY.','publish-kit-backup-binding547-once.py,prepare-backup-binding547-delta-successor-once.py,publish-kit-backup-binding547-delta-successor-once.py CONSUMED NEVER REPLAY.')
(h/'backup-binding547-delta-successor-publication-notes-once.txt').open('x',encoding='utf8').write(notes)
record={'type':'TOOL OUTPUT TRANSCRIPTION ONLY','refusedPublisher':'publish-kit-backup-binding547-once.py','sourceLine':530,'statedReason':'new-feature case-count/pages assertion','sourceDerivedCause':'binding selector nested under incompatible backup-main prefix','originalCountersIndependentlyRetained':False,'independentlyRetainedDiagnosticStderr':False,'all237FrozenSourcesUnchanged':True,'apiOriginalsRetainedBeforePredicates':10,'partialPublicFiles':sorted(p.name for p in partial.iterdir() if p.is_file()),'newInventoryAbsent':True,'readmeOrGitOrHostMutation':False,'currentBoundaryNewPayloadsNotPreviouslyInventoried':True,'oldPrivatePayloadsRead':False,'noRetestNeededOrDispatched':True}
(entry/'first-publication-delta-selection-refusal.json').open('x',encoding='utf8').write(json.dumps(record,sort_keys=True)+'\n')
target.open('x',encoding='utf8',newline='').write(s);print(json.dumps({'prepared':str(target),'executed':False,'selectionSiblingIndentationVerified':True,'sourceEditsOrRetest':False}))
