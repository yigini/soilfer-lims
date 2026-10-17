import ast,hashlib,json,pathlib,subprocess,sys
w=pathlib.Path(__file__).resolve().parents[2];k=w/'WP/batch-release-kit-be837974-20261016'
assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=w,text=True).strip()=='10335630a81f8a8650388501f393d8ab3f902db6'
sys.path.insert(0,str(k));from kit_contract import canonical
sha=lambda raw:hashlib.sha256(raw).hexdigest()
def pin(p):
 raw=p.read_bytes();return {'bytes':len(raw),'sha256':sha(raw)}
p=k/'kit_frozen.py';s=p.read_text(encoding='utf-8');needle="    'kit_statement_journal.py','statement-journal-source.json',";assert s.count(needle)==1
p.write_text(s.replace(needle,needle+"\n    'kit_wal_content.py','wal-content-source.json',"),encoding='utf-8',newline='')
for build in ('build_stop_post.py','build_capture_stop_post.py'):
 r=subprocess.run([sys.executable,'-B',str(k/build),'--write-unreviewed-source'],cwd=w,capture_output=True)
 if r.returncode:raise RuntimeError(r.stderr.decode('utf-8','replace'))
p=k/'capture-statement-journal-source.json';v=json.loads(p.read_bytes());v['files']={n:pin(k/n) for n in v['files']};p.write_bytes(canonical(v)+b'\n')
package='server/node_modules/better-sqlite3/'
pkg=json.loads((k/'live-backup-sqlite-source.json').read_bytes())
names=[package+n for n in pkg['files']]
names += [package+n for n in ('lib/database.js','lib/methods/transaction.js','src/objects/database.cpp')]
names += [(k/name).relative_to(w).as_posix() for name in ('kit_wal_content.py','kit_copy_admission.py',
 'kit_app_snapshots.py','retained_files.py','retained_contract.py','kit_contract.py','live-backup-sqlite-source.json')]
source=w/(package+'deps/sqlite3/sqlite3.c');raw=source.read_bytes();assert sha(raw)=='2bbdd0eff3f46852e954d7881b7945990bf78c1421f806cf7978bc22e187100a'
lines=raw.splitlines(keepends=True);offsets=[0]
for line in lines:offsets.append(offsets[-1]+len(line))
ranges=[('frame_constants',67230,67258),('checksum',67613,67672),('frame_encode',67715,67752),
 ('frame_decode',67755,67802),('recover_header',68166,68235),('recover_frames',68235,68298),
 ('maximum_sector',59335,59343),('sector_sanitizer',61611,61629),('pager_frame_wrapper',62093,62148),
 ('pager_cache_spill',63549,63577),('pager_commit',65411,65442),('restart_no_growth_credit',70600,70650),
 ('write_split_and_frame',70665,70715),('checksum_rewrites',70718,70764),('new_header',70815,70858),
 ('normal_frame_or_overwrite',70876,70908),('commit_padding',70913,70947),('truncate_only_if_larger',69133,69152),
 ('checkpoint_main_writes',69026,69070),('frame_index_update',70963,70999)]
excerpts=[]
for label,first,last in ranges:
 part=raw[offsets[first-1]:offsets[last]];excerpts.append({'label':label,'firstLine':first,'lastLine':last,
  'startByte':offsets[first-1],'endByte':offsets[last],'bytes':len(part),'sha256':sha(part),'text':part.decode('utf-8')})
v={'version':1,'scope':'CONDITIONAL_DECLARED_NATIVE_WAL_FRAME_CONTENT','files':{n:pin(w/n) for n in names},
 'nativeSource':{'path':source.relative_to(w).as_posix(),**pin(source)},'nativeExcerpts':excerpts,
 'nativePackageProofSha256':sha((k/'live-backup-sqlite-source.json').read_bytes()),'sqliteVersion':pkg['sqliteVersion'],
 'sqliteSourceId':pkg['sqliteSourceId'],'maximumSectorBytes':65536,'completeApplicationFrameInventory':False,
 'writerGraphAdmissionImplemented':False,'walFileLengthOrVfsPreallocationBounded':False,'physicalFilesystemClosureClaimed':False,
 'primaryDocumentation':['https://www.sqlite.org/fileformat2.html#walformat','https://www.sqlite.org/wal.html'],
 'conditions':['Complete native pList frame-entry and frame-set inventory, not SQL/B-tree/page counts',
  'One native Wal handle, one forward transaction, no concurrent writer or continued writes after rollback/error',
  'Intact source and native wal-index recovery required separately; SQL-free observations are not integrity proof',
  'Initial full whole-frame checksum-valid committed WAL prefix only; stale/partial/uncommitted tails refuse',
  'No header/page-count equality borrowed from rollback mode; checkpoint main-file writes remain unclosed'],
 'derivation':['32-byte WAL header; each normal frame-entry is conservatively charged an append of P+24 bytes',
  'walFrames may overwrite existing transaction frames; walRewriteChecksums stays within existing frame slots; no credit',
  'FULL-sync commit can repeat final frame until sanitized sector boundary; charge ceil(65535/(P+24)) frames',
  'Restart resets indices; walLimitSize/checkpoint truncation requests do not increase content; no shrink/reuse credit',
  'Bound initial physical extent plus declared frames and padding, refuse >32GiB, no physical/VFS/default runtime claim']}
p=k/'wal-content-source.json';assert not p.exists();p.write_bytes(canonical(v)+b'\n')
for p in k.iterdir():
 if p.is_file() and p.suffix=='.py':ast.parse(p.read_bytes())
print(json.dumps({'sourceFiles':len(names),'excerpts':len(excerpts),'walProofSha256':sha((k/'wal-content-source.json').read_bytes()),
 'captureStatementProofSha256':sha((k/'capture-statement-journal-source.json').read_bytes()),'operatorsExecuted':0,
 'hooksBuiltAsSourceOnly':True,'hooksExecuted':False}))
