import ast,hashlib,json,pathlib,re,subprocess,sys
w=pathlib.Path(__file__).resolve().parents[2];k=w/'WP/batch-release-kit-be837974-20261016'
assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=w,text=True).strip()=='efe60a2862aec2b4734bf48c45f1b2b3331011af'
sys.path.insert(0,str(k));from kit_contract import canonical
sha=lambda raw:hashlib.sha256(raw).hexdigest()
def pin(p):
 raw=p.read_bytes();return {'bytes':len(raw),'sha256':sha(raw)}
head='be8379745bdfae52ce46496ff26514dc7d729640'
base=json.loads((k/'capture-writer-journal-source.json').read_bytes())
application={name for name in base['files'] if not name.startswith('server/node_modules/')}
application.update('server/'+name for name in ['scripts/install_order_revisions.js','services/orderRevisionMigrationSource.js',
 'services/orderLineResolutionService.js','services/orderRevisionContract.js','services/workAttemptReservationService.js',
 'services/workItemKinds.js','services/textureOrderContract.js','workflowContract.js','data/operationalChecklists.json',
 'services/analysisCodesService.js','services/workflowStateRules.js','prisma/migrations/20261014000100_order_revision_contract/migration.sql'])
# Resolve literal relative dependencies from exact Git-tree names, never private filesystem trees.
tree=set(subprocess.check_output(['git','ls-tree','-r','--name-only',head],cwd=w,text=True).splitlines())
queue=list(application)
while queue:
 name=queue.pop()
 if name not in tree:raise RuntimeError('Unknown exact application source: '+name)
 raw=subprocess.check_output(['git','show',head+':'+name],cwd=w)
 if name.endswith('.js'):
  for request in re.findall(r"require\(['\"](\.[^'\"]+)['\"]\)",raw.decode('utf-8')):
   relative=pathlib.PurePosixPath(name).parent/request
   parts=[]
   for part in relative.parts:
    if part=='..':parts.pop()
    elif part!='.':parts.append(part)
   prefix='/'.join(parts)
   # startupContext is undefined in these CLI paths; this optional branch is uncalled.
   if prefix=='server/utils/startupReadinessContext':continue
   if name=='server/seeds/units.js' and prefix=='server/prisma_client':continue # CLI-only seed main is uncalled
   found=next((candidate for candidate in (prefix,prefix+'.js',prefix+'.json',prefix+'/index.js') if candidate in tree),None)
   if found is None:raise RuntimeError('Unresolved application source '+prefix)
   if found not in application:application.add(found);queue.append(found)
application_pins={}
for name in sorted(application):
 raw=subprocess.check_output(['git','show',head+':'+name],cwd=w)
 assert (w/name).read_bytes()==raw,name
 application_pins[name]={'bytes':len(raw),'sha256':sha(raw)}
files={name:pin(w/name) for name in base['files'] if name.startswith('server/node_modules/')}
files.update(application_pins)
for name in ['server/node_modules/better-sqlite3/lib/util.js','server/node_modules/better-sqlite3/lib/methods/wrappers.js',
 'server/node_modules/better-sqlite3/lib/methods/pragma.js']:
 files[name]=pin(w/name)
for name in ['kit_readonly_target_wal.py','kit_wal_content.py','wal-content-source.json','kit_owned.py','kit_contract.py']:
 files[(k/name).relative_to(w).as_posix()]=pin(k/name)
source=w/'server/node_modules/better-sqlite3/deps/sqlite3/sqlite3.c';raw=source.read_bytes()
assert sha(raw)=='2bbdd0eff3f46852e954d7881b7945990bf78c1421f806cf7978bc22e187100a'
lines=raw.splitlines(keepends=True);offsets=[0]
for line in lines:offsets.append(offsets[-1]+len(line))
ranges=[('pager_open_readonly',63864,63883),('pager_readonly_stored',63972,63981),
 ('btree_open_readonly',75124,75135),('btree_readonly_write_refusal',76043,76062),
 ('dirty_list',56628,56642),('pager_write_dirty',64968,65004),('stress_frame_call',63563,63570),
 ('flush_uses_stress',63603,63619),('commit_frame_call',65408,65437),
 ('frame_wrapper',62093,62148),('wal_open_is_not_readonly_promise',68465,68480),
 ('close_can_attempt_checkpoint',69255,69292)]
excerpts=[]
for label,first,last in ranges:
 part=raw[offsets[first-1]:offsets[last]];excerpts.append({'label':label,'firstLine':first,'lastLine':last,
 'startByte':offsets[first-1],'endByte':offsets[last],'bytes':len(part),'sha256':sha(part),'text':part.decode('utf-8')})
proof={'version':1,'scope':'SOURCE_REVIEWED_DRY_ORIGINAL_TARGET_ZERO_WAL_FRAMES','applicationHead':head,
 'labels':{'206-dry':'install_sample_containers.js','214-dry':'install_control_charts.js','209-dry':'install_order_revisions.js'},
 'files':files,'applicationGitBlobs':application_pins,'nativeSource':{'path':source.relative_to(w).as_posix(),**pin(source)},
 'nativeExcerpts':excerpts,'wholeOwnerFrameInventoryVerified':False,'writerGraphAdmissionImplemented':False,
 'runtimeBinaryToSourceBindingVerified':False,'runtimeDefaultVfsVerified':False,
 'derivation':['Exact CLI --dry-run means apply=false/startupContext undefined; no writable original-target constructor is reached',
 '206/214 prerequisite install/assert calls pass apply=false; every original-target SQLite handle is explicit readonly/fileMustExist',
 'Lab-policy prerequisite filesystem-copies all original DB/WAL/SHM before opening its distinct readonly snapshot; 209 classifies that copy',
 'Addon readonly boolean maps to SQLITE_OPEN_READONLY; ordinary VFS reports it to pager; BTS_READ_ONLY refuses a write transaction',
 'A fresh read-only original-target pager has no forward dirty episodes; spill, explicit PagerFlush and commit therefore send no original-target pList entries',
 'Original-target native frame entries/frame sets/commit sets all zero; retain entire initial physical WAL extent with no truncation credit',
 'WAL open still requests READWRITE/CREATE and close may attempt checkpoint: zero frame requests is NOT absence of WAL/SHM/VFS/file producers',
 'Scratch, distinct retained-copy handles and optional startup context not inventoried; APPLY/REPEAT/no-op-result substitutions refuse'],
 'conditions':['Exact source/native build semantics, fixed ordinary non-URI target, no custom VFS/syscalls/extensions/module replacement',
 'No startupContext, shared-cache writer, attached alternate target writer or concurrent original-target writer',
 'Not runtime attestation: loaded Linux binary/default VFS still unbound',
 'Full source recheck and descriptor observation are not before-create held writer admission or independent private-database proof']}
p=k/'readonly-target-wal-source.json';assert not p.exists();p.write_bytes(canonical(proof)+b'\n')
p=k/'kit_frozen.py';s=p.read_text(encoding='utf-8');needle="    'kit_wal_content.py','wal-content-source.json',";assert s.count(needle)==1
p.write_text(s.replace(needle,needle+"\n    'kit_readonly_target_wal.py','readonly-target-wal-source.json',"),encoding='utf-8',newline='')
for build in ['build_stop_post.py','build_capture_stop_post.py']:
 r=subprocess.run([sys.executable,'-B',str(k/build),'--write-unreviewed-source'],cwd=w,capture_output=True)
 if r.returncode:raise RuntimeError(r.stderr.decode('utf-8','replace'))
p=k/'capture-statement-journal-source.json';v=json.loads(p.read_bytes());v['files']={n:pin(k/n) for n in v['files']};p.write_bytes(canonical(v)+b'\n')
for p in k.iterdir():
 if p.is_file() and p.suffix=='.py':ast.parse(p.read_bytes())
print(json.dumps({'fullFiles':len(files),'applicationGitFiles':len(application_pins),'nativeExcerpts':len(excerpts),
 'newProofSha256':sha((k/'readonly-target-wal-source.json').read_bytes()),'operatorsExecuted':0,'hooksExecuted':False}))
