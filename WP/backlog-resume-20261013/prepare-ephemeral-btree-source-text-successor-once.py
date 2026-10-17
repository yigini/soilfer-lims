import ast,hashlib,json,pathlib,subprocess,sys
w=pathlib.Path(__file__).resolve().parents[2];k=w/'WP/batch-release-kit-be837974-20261016';h=w/'WP/backlog-resume-20261013'
assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=w,text=True).strip()=='e765e6c909fee012792bcfe5ee258b9265d46617'
sys.path.insert(0,str(k));from kit_contract import canonical
sha=lambda b:hashlib.sha256(b).hexdigest()
def pin(p):
 b=p.read_bytes();return {'bytes':len(b),'sha256':sha(b)}
base=json.loads((k/'linux-main-vfs-source.json').read_bytes());names=set(base['files'])
for name in ['main-growth-source.json','linux-main-vfs-source.json','readonly-target-wal-source.json','kit_ephemeral_btree.py']:names.add((k/name).relative_to(w).as_posix())
files={name:pin(w/name) for name in sorted(names)}
container=json.loads((k/'readonly-target-wal-source.json').read_bytes())
for name in container['applicationGitBlobs']:
 assert container['applicationSourceText'][name].encode()==subprocess.check_output(['git','show',container['applicationHead']+':'+name],cwd=w)
p=w/'server/node_modules/better-sqlite3/deps/sqlite3/sqlite3.c';raw=p.read_bytes();assert sha(raw)=='2bbdd0eff3f46852e954d7881b7945990bf78c1421f806cf7978bc22e187100a'
lines=raw.splitlines(keepends=True);offsets=[0]
for line in lines:offsets.append(offsets[-1]+len(line))
ranges=[('fresh_ephemeral_open',99797,99909),('empty_null_filename_btree',74965,75009),('zero_reserve_and_auto_vacuum_null_filename',75140,75170),('inherited_mapping_limit_is_separate',75115,75120),('deferred_temporary_pager_default_page_size',63914,63947),('omit_journal_profile',63962,63993),('new_database_single_header_page',75943,75979),('index_root_two',82580,82602),('exclusive_deferred_temp_open',62606,62621),('pager_write_end_and_size_hint',63349,63408),('subjournal_requires_savepoint',59988,60003),('wal_open_excludes_temp',66555,66580),('temp_wal_mode_excluded',66288,66304),('constant_in_rhs_once_conditions',115022,115032),('once_subroutine',115072,115088),('rhs_ephemeral_index',115090,115107),('constant_in_rhs_entries',115170,115230),('normal_table_insert',101073,101113),('normal_index_insert',101850,101884),('subjournal_guard',63502,63508)]
excerpts=[]
for label,first,last in ranges:
 b=raw[offsets[first-1]:offsets[last]];excerpts.append({'label':label,'firstLine':first,'lastLine':last,'startByte':offsets[first-1],'endByte':offsets[last],'bytes':len(b),'sha256':sha(b),'text':b.decode()})
from kit_ephemeral_btree import STATUS_SQL,STATUS_VALUES
proof={'version':1,'scope':'CONDITIONAL_ONE_FRESH_EPHEMERAL_BTREE','files':files,'nativeSource':{'path':p.relative_to(w).as_posix(),**pin(p)},'nativeExcerpts':excerpts,'orderStatusSql':STATUS_SQL,'orderStatusValues':list(STATUS_VALUES),'applicationHead':container['applicationHead'],'applicationGitBlobs':container['applicationGitBlobs'],'runtimeBinaryToSourceBindingVerified':False,'writerGraphAdmissionImplemented':False,'physicalFilesystemClosureClaimed':False,'officialReferences':['https://www.sqlite.org/tempfiles.html'],'derivation':[
'ONE newly allocated OpenEphemeral handle only, NULLfilename/READWRITE|CREATE|EXCLUSIVE|DELETEONCLOSE|TRANSIENT_DB, OMIT_JOURNAL|SINGLE. Cursor reuse/clear/OpenDup/reset/alternate handles/savepoints/error continuation/custom pcache/preformatted cells/overwrite/delete/replacement EXCLUDED. Named CREATE TEMP TABLE is a different database and NOT covered.',
'Fresh calloc BtShared/NULLfilename leaves autovacuum0/reserve0. newDatabase creates ONE standard header page/no schema objects/root1 INTKEY. Index creates root2. Charge every separately counted native insertion FULL serialized payload including headers/nZero, each additional root and existing complete balance/overflow allocation proof. No SQL count substituted for native calls.',
'Original counted insertion primitive charges107 balance allocations percall plus ceil(FULLpayload/(P-4)) overflow/each root/TWO pageincrements eachallocation forpendinggap. Synthetic ONE-page arithmeticheader is NOT observed target/privateDBproof. Complete32GiB/all8pageprofile refuses ANY oversized case, never clips or assumes main page size.',
'Ephemeral pager accepts independent SQLITE_DEFAULT_PAGE_SIZE/delays physicalopen; does NOT inherit scientific main page_size. Mapping limit may be inherited separately. Explicit supported page size or all8 complete declarations only, not observed runtime/compile default.',
'OMIT_JOURNAL=>useJournal0/journalModeOFF; tempFile blocks WALopen. Subjournal is nSavepoint-driven: OMIT_JOURNAL alone does NOT prove absence. Exactprofile requires ZERO native savepointcalls. No error/rollback continuation. No scientific journal/temp settings changed.',
'Pager writes pgno*P with pgno<=dbSize and SIZE_HINT dbSize*P stay in conditional logical highwater. Successful fresh writableemptycreate/routing/VFS/runtime/syscalls/filelength/physicalallocation/lifetime/peaks require separate evidence. No owner/admission/preflight/packagecontrols/budget integration.',
'Raw be order-impact status IN list has FOUR distinct constant ASCII strings/max15chars. Conditional RHS ephemeral path uses Once/one IdxInsert perconstant, ONEroot2+4keyattempts, FULL one-fieldserialized key<=32 evenUTF16/header. All42 raw application texts independently Git-verified. Other ORDERBY/sorter/automaticindex/schema/collation/runtime/wholecaller are NOT covered; RHS subproducer only.',
'NEW LOCAL Windows pinned native readonly-main MATERIALIZEDtable/INindex/rawstatus-query fixtures retain full programs/streams/options/sourceID/optional temp originals. TESTONLY UDF/temp_storeFILE/page/largepayload. No Linux VFS/nativefile-call/continuouspeak/fulltransient/physical proof; no samples never proves no spill. Scientific argv/defaultheap/journal-temp settings/transactions/original600 clocks/deadlines/signals/quotas unchanged.'
]}
assert len(excerpts)==20
p=k/'ephemeral-btree-source.json';assert not p.exists();p.write_bytes(canonical(proof)+b'\n')
p=k/'kit_frozen.py';s=p.read_text(encoding='utf8');needle="    'kit_linux_sorter_vfs.py','linux-sorter-vfs-source.json',";assert s.count(needle)==1;p.write_text(s.replace(needle,needle+"\n    'kit_ephemeral_btree.py','ephemeral-btree-source.json',"),encoding='utf8',newline='')
for name in ['build_stop_post.py','build_capture_stop_post.py']:
 r=subprocess.run([sys.executable,'-B',str(k/name),'--write-unreviewed-source'],cwd=w,capture_output=True);assert r.returncode==0,r.stderr.decode('utf8','replace')
p=k/'capture-statement-journal-source.json';v=json.loads(p.read_bytes());v['files']={n:pin(k/n) for n in v['files']};p.write_bytes(canonical(v)+b'\n')
for p in k.iterdir():
 if p.is_file() and p.suffix=='.py':ast.parse(p.read_bytes())
record={'fullSourcePins':len(files),'nativeExcerpts':len(excerpts),'rawApplicationOriginalsVerified':len(container['applicationGitBlobs']),'proofSha256':sha((k/'ephemeral-btree-source.json').read_bytes()),'sourceCopyMaximumPathLengthEstimate':len(str(k/'ephemeral-btree-local-retained-fixtures/eph-12345678'))+1+max(map(len,names)),'hooksExecuted':False,'operatorsExecuted':0}
(h/'temp-btree470-entry-0845-once/source-preparation-record.json').write_bytes(canonical(record)+b'\n');print(json.dumps(record))