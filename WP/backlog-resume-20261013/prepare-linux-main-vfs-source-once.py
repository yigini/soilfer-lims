"""ONCE source proof construction; no operator/host/runtime qualification."""
from pathlib import Path
import hashlib,json,subprocess,ast
W=Path(__file__).resolve().parents[2];K=W/'WP/batch-release-kit-be837974-20261016'
proof=K/'linux-main-vfs-source.json';assert not proof.exists()
assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=W).decode().strip()=='a4f29b7a2eecfce3ed15c5763f6ac8e4fccadf83'
sha=lambda b:hashlib.sha256(b).hexdigest()
files=set()
pkg=W/'server/node_modules/better-sqlite3'
for dirname in ('src','lib'):
 files|={p for p in (pkg/dirname).rglob('*') if p.is_file()}
for name in ('binding.gyp','package.json','deps/common.gypi','deps/defines.gypi','deps/sqlite3.gyp','deps/copy.js','deps/sqlite3/sqlite3.c','deps/sqlite3/sqlite3.h','deps/sqlite3/sqlite3ext.h'):
 files.add(pkg/name)
for name in ('kit_linux_main_vfs.py','kit_main_growth.py','kit_main_mutations.py','kit_rollback_journal.py','kit_contract.py','kit_copy_admission.py','retained_contract.py','retained_files.py'):
 files.add(K/name)
bindings={p.relative_to(W).as_posix():{'bytes':len(p.read_bytes()),'sha256':sha(p.read_bytes())} for p in sorted(files)}
native=(pkg/'deps/sqlite3/sqlite3.c').read_bytes();assert len(native)==9389807 and sha(native)=='2bbdd0eff3f46852e954d7881b7945990bf78c1421f806cf7978bc22e187100a'
lines=native.splitlines(keepends=True)
ranges=[('pinned_lock_style',156,175),('platform_default',16094,16123),('default_mmap',15710,15720),('global_default_mmap',23645,23660),('os_dispatch',26915,26931),('syscall_truncate',40201,40214),('syscall_write',42790,42825),('unix_partial_write',42845,42922),('unix_truncate',43163,43200),('size_hint_chunk_and_mmap',43251,43311),('file_controls',43374,43383),('mmap_control',43434,43451),('open_mmap_limit',45296,45308),('open_zero_chunk',45815,45825),('default_vfs',47703,47743),('shm_not_main_truncate',44099,44106),('apple_proxy_guard',46610,46614),('apple_conch_truncate',47102,47119),('apple_proxy_end',47623,47627),('pager_dirty_size_hint_and_write',63349,63412),('pager_truncate',61577,61609),('pager_write_dbsize',65035,65045),('pager_change_counter',65263,65294),('pager_atomic_padding',65535,65549),('pager_commit_padding',65578,65588),('pager_commit_shrink',61066,61079),('rollback_page_guard',61259,61270),('rollback_page_write',61338,61355),('rollback_original_truncate',61815,61825),('savepoint_prior_size',62337,62349),('truncate_image_only_shrinks',62928,62942),('sorter_chunk_is_other_file',106450,106467)]
excerpts=[]
for label,a,b in ranges:
 start=sum(map(len,lines[:a-1]));end=start+sum(map(len,lines[a-1:b]));excerpts.append({'label':label,'startLine':a,'endLine':b,'startByte':start,'endByte':end,'text':native[start:end].decode('utf8')})
head='be8379745bdfae52ce46496ff26514dc7d729640';docker=subprocess.check_output(['git','show',head+':Dockerfile'],cwd=W)
value={'version':1,'scope':'CONDITIONAL_PINNED_DEFAULT_LINUX_UNIX_MAIN_FILE_LENGTH','applicationHead':head,'nativeSourceSha256':sha(native),'sourceId':'2026-01-09 17:27:48 b270f8339eb13b504d0b2ba154ebca966b7dde08e40c3ed7d559749818cb2075','files':bindings,'nativeExcerpts':excerpts,
 'applicationDockerfile':{'gitBlobOid':hashlib.sha1(('blob '+str(len(docker))+'\0').encode()+docker).hexdigest(),'bytes':len(docker),'sha256':sha(docker),'contentHex':docker.hex()},
 'mainJournalCallerProofSha256':sha((K/'capture-writer-journal-source.json').read_bytes()),'buildMayUsePrebuiltAddon':True,
 'runtimeBinaryToSourceBindingVerified':False,'runtimeDefaultVfsVerified':False,'writerGraphAdmissionImplemented':False,'mainFileLengthOrVfsPreallocationBounded':False,'physicalFilesystemClosureClaimed':False,
 'conditionalDerivation':[
  'For the complete counted native MAIN operation profile, every live Pager.dbSize is bounded by the original pages plus all charged allocations/pending gaps; no freelist/reuse/deletion/rollback credit.',
  'Rollback pager_write_pagelist filters pgno<=dbSize, writes one page ending pgno*P and supplies SIZE_HINT exactly dbSize*P. Pager commit padding writes at most through dbSize*P. Direct change-counter write ends at P.',
  'pager_truncate requests nPage*P. Commit uses current dbSize (or one less at pending page); valid rollback/savepoint uses intact previous size. Playback filters pgno<=restored dbSize. No continued writing after rollback/error; no external journal corruption.',
  'Pinned normal Unix writes preserve offset+remaining through partial-write loops; ordinary pwrite/pwrite64/lseek+write does not extend beyond request end. No append/custom syscall interposition is allowed by the declaration.',
  'Default Unix file open zeroes szChunk; default mmap maximum is0. No MAIN call in pinned capture owners/native binding changes chunk/mmap/VFS. The sole internal CHUNK_SIZE hint is in vdbeSorterExtendFile on a separate temporary-file handle; its scratch allocation is NOT bounded here.',
  'unixTruncate rounds to chunks if configured. fcntlSizeHint may preallocate a rounded chunk via posix_fallocate or byte writes. Its mmap path can ftruncate with szChunk0: chunk0 alone is never a no-extension proof. The declared default profile requires BOTH chunk0 and default mmap0.',
  'SHM ftruncate uses hShm and is not a MAIN descriptor. Apple conch-file truncation is behind __APPLE__ && SQLITE_ENABLE_LOCKING_STYLE and is outside exact Linux defaults. Neither path is silently counted as MAIN or declared closed for its own file.',
  'Complete source package/lib/addon/gyp inputs and raw be Dockerfile are pinned. npm rebuild runs package install prebuild-install || node-gyp rebuild --release; sourceId/compile_options/default source files alone do NOT bind the actual loaded binary to this source or prove active default Unix VFS.',
  'Necessary compile-option preconditions are explicitly insufficient; source-bound declaration never becomes an actual Linux observation or writer admission. Existing capture native MAIN runtime/VFS qualification flag remains false.'
 ],'conditions':['Exact pinned default Linux Unix build, ordinary syscall semantics, unchanged initialized global config and MAIN controls, no VFS/systemcall replacement/automatic extensions/URI-selected VFS','Complete native roots/inserts/overwrites/deletes/implicit/schema/trigger operation inventory; intact supported rollback profile','No ATTACH/VACUUM/backup/deserialize/preformatted-transfer path; no continued writes after rollback/SQL error; no external IO or journal corruption'],
 'excluded':['Actual binary-to-source binding','Actual Linux default-VFS identity','Operational writer admission','Physical allocated blocks or preallocation geometry','WAL/SHM/statement journals/SQL scratch size','Continuous peak or original full journal lifetime','Complete writer/filesystem or release qualification'],
 'officialReferences':['https://sqlite.org/c3ref/c_fcntl_begin_atomic_write.html','https://sqlite.org/mmap.html','https://sqlite.org/vfs.html']}
proof.write_text(json.dumps(value,sort_keys=True,indent=2)+'\n',encoding='utf8',newline='\n')
p=K/'kit_frozen.py';raw=p.read_bytes();needle=b"    'kit_capture_main.py','capture-native-main-source.json',";assert raw.count(needle)==1;p.write_bytes(raw.replace(needle,needle+b"\n    'kit_linux_main_vfs.py','linux-main-vfs-source.json',"))
for name in ('kit_linux_main_vfs.py','verify_kit_linux_main_vfs.py'):ast.parse((K/name).read_bytes())
print(json.dumps({'sourceFilesPinned':len(bindings),'nativeExcerpts':len(excerpts),'newSourceProofSha256':sha(proof.read_bytes()),'runtimeBinaryToSourceBindingVerified':False,'operatorsExecuted':0}))