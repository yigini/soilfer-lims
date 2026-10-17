import ast,hashlib,json,pathlib,subprocess,sys
w=pathlib.Path(__file__).resolve().parents[2];k=w/'WP/batch-release-kit-be837974-20261016'
assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=w,text=True).strip()=='2a455a047ff5e4d127c8da8e2a1ce68c10a663c2'
sys.path.insert(0,str(k));from kit_contract import canonical
from kit_wal_dirty_inventory import COEFFICIENTS,LABELS
sha=lambda b:hashlib.sha256(b).hexdigest()
def pin(p):
 b=p.read_bytes();return {'bytes':len(b),'sha256':sha(b)}
# This retained PUBLIC source container holds full raw application Git bytes,
# independent of CRLF checkout files. Its readonly conclusion is NOT borrowed.
a=json.loads((k/'readonly-target-wal-source.json').read_bytes())
assert a['applicationHead']=='be8379745bdfae52ce46496ff26514dc7d729640'
for name,expected in a['applicationGitBlobs'].items():
 raw=subprocess.check_output(['git','show',a['applicationHead']+':'+name],cwd=w)
 assert raw==a['applicationSourceText'][name].encode('utf8')
 assert {'bytes':len(raw),'sha256':sha(raw)}==expected
v=json.loads((k/'wal-content-source.json').read_bytes())
names=set(v['files'])
names.update(name for name in a['files'] if name.startswith('server/node_modules/'))
for name in ['kit_wal_dirty_inventory.py','kit_capture_native_inventory.py','capture-native-inventory-source.json',
 'main-growth-source.json','kit_main_growth.py','kit_main_mutations.py',
 'capture-writer-journal-source.json','readonly-target-wal-source.json','kit_wal_content.py',
 'wal-content-source.json','kit_contract.py']:
 names.add((k/name).relative_to(w).as_posix())
files={name:pin(w/name) for name in sorted(names)}
p=w/'server/node_modules/better-sqlite3/deps/sqlite3/sqlite3.c';raw=p.read_bytes()
assert sha(raw)=='2bbdd0eff3f46852e954d7881b7945990bf78c1421f806cf7978bc22e187100a'
lines=raw.splitlines(keepends=True);offsets=[0]
for line in lines:offsets.append(offsets[-1]+len(line))
ranges=[('fresh_cache_page_clean',56536,56554),('dirty_mark_and_successful_clean',56628,56683),
 ('sector_sanitizer',61611,61664),('rollback_not_forward_frames',62034,62090),('frame_wrapper',62093,62148),
 ('spill_and_explicit_flush',63529,63600),('explicit_flush',63603,63619),
 ('pager_write',64968,65046),('sector_mark_expansion',65060,65135),('pager_write_entry',65154,65169),
 ('commit_fallback',65408,65438),('rekey_preserves_flags',66210,66220),
 ('existing_nonempty_database',75943,75970),('begin_page_count_repair',76181,76192),
 ('allocation',78925,79219),('free_page',79245,79366),('clear_overflow',79376,79443),
 ('fill_new_overflow',79569,79638),('cell_local_write',79729,79814),('cell_fast_write',79826,79885),
 ('quick_balance',80405,80498),('balance_outputs',81060,81093),('balance_rekey',81108,81135),
 ('balance_dividers',81227,81285),('balance_edit_free',81310,81399),('root_deeper',81447,81490),
 ('balance_traversal',81536,81651),('overwrite',81662,81750),('normal_insert',82004,82085),
 ('delete_two_balances',82340,82415),('normal_root_create',82580,82592),('empty_root_clear',82609,82661),
 ('metadata',82870,82892),('set_cookie',99537,99567),('clear_opcode',102260,102278),
 ('create_format_encoding',125686,125700),('schema_cookie',126392,126398),('empty_index_refill',128148,128175)]
excerpts=[]
for label,first,last in ranges:
 part=raw[offsets[first-1]:offsets[last]]
 excerpts.append({'label':label,'firstLine':first,'lastLine':last,'startByte':offsets[first-1],
  'endByte':offsets[last],'bytes':len(part),'sha256':sha(part),'text':part.decode('utf8')})
# Full static call-site ledger. Includes declarations/comments; does not claim
# dynamic counts. All executable write routes are counted or explicitly excluded.
def classify(n):
 if n<59458:return 'Declaration or explanatory comment, not a runtime call'
 if n in (63538,64441,65050,65154,65174,65227,74761,77479,78893):return 'Definition/comment, not an additional runtime call'
 if n==65278:return 'Rollback-journal commit change-counter branch; WAL commit takes the separate dirty-list branch'
 if n==66095:return 'PagerMovepage relocation; no-autovacuum/non-relocating source conditions exclude it'
 if n==73538:return 'Autovacuum pointer map, excluded by current effective page-one autovacuum fields zero'
 if n==75955:return 'newDatabase only when nPage==0; strict existing receipt table requires nonempty database'
 if n==76188:return 'Counted once: fresh writer transaction page-count repair'
 if n in (76413,76596,76674,79033,79041,79063,79076,79190,82553):return 'Autovacuum relocation/exact allocator/pointer-map path, excluded'
 if n==77493:return 'Incremental blob/BtreePutData path, uncalled by exact DDL and bound receipt INSERT'
 if n in (78968,79010,79132,79141,79174,79204):return 'Counted in allocation: at most three writes including page one, trunk and allocated page'
 if n in (79257,79267,79328,79351):return 'Counted in free: at most three writes including secure-delete and trunk/page one'
 if n in (79773,79863):return 'Counted one per native insertCell/insertCellFast invocation'
 if n==81069:return 'Counted reused output page, at most five per balance level'
 if n==81460:return 'Counted root-deeper root write plus its allocation'
 if n==81577:return 'Counted parent write once per non-root balance level'
 if n in (81675,81689):return 'Counted up to two writes per overwrite payload page'
 if n==82012:return 'Counted normal insertion local write plus insertCellFast'
 if n in (82343,82375):return 'Counted delete local writes plus divider insertCell'
 if n==82655:return 'Counted extra empty-new-root clear allowance; populated clears not supported'
 if n==82879:return 'Counted metadata cookie write; at most three cookie opcodes per CREATE statement'
 if n==83920:return 'Journal mode/version-changing pragma path, uncalled by exact fixed WAL caller'
 if n in (84240,84480):return 'Backup destination handle, uncalled by the single target writer profile'
 if n==230332:return 'dbpage virtual-table module, excluded by exact SQL/schema profile and no extensions'
 raise AssertionError(('Unreviewed PagerWrite occurrence',n))
ledger=[]
for i,line in enumerate(lines,1):
 if b'sqlite3PagerWrite(' in line:ledger.append({'line':i,'text':line.decode('utf8').rstrip('\r\n'),'classification':classify(i)})
proof={'version':1,'scope':'CONDITIONAL_STRICT_PRE_206_214_TARGET_PAGER_DIRTY_INVENTORY',
 'labels':LABELS,'coefficients':COEFFICIENTS,'files':files,
 'applicationHead':a['applicationHead'],'applicationGitBlobs':a['applicationGitBlobs'],
 'applicationSourceContainer':'readonly-target-wal-source.json',
 'applicationContainerReadonlyConclusionUsedForApply':False,
 'nativeSource':{'path':p.relative_to(w).as_posix(),**pin(p)},'nativeExcerpts':excerpts,'staticPagerWriteOccurrences':ledger,
 'collectorBindingImplemented':False,'writerGraphAdmissionImplemented':False,'runtimeBinaryToSourceBindingVerified':False,
 'derivation':[
 'Fresh ordinary writer cache starts clean. A successful stress/explicit flush emits one page-list entry and makes that page clean; commit sends the remaining dirty list once. Charge every possible dirty mark, including repeated marks after spills, plus one clean synthetic page-one commit fallback.',
 'Every PagerWrite marks at most max(1,65536/pageSize) pages via the large-sector path. No assumed4096 sector, dirty coalescing, freelist, reuse, deletion, rollback or close credit.',
 'Normal no-autovacuum BTALLOC_ANY allocation touches at most page one, a freelist trunk, and the allocated page. Frees touch page one, optional secure-delete page, and one trunk or the freed page: three each, including reused pages.',
 'Expand every separate table/index/schema/internal insertion, own-placeholder schema overwrite and conservative schema deletion from the strict PRE inventory. Existing receipt rows are never replaced; extra receipt triggers/indexes/default/FK/generated profiles refuse. All created tables are empty; explicit new-index refill loops insert zero keys.',
 'One balance traversal has at most21 levels. At each charge parent1, all5 outputs as allocations3 each AND reused writes1 each, divider insertions4, and four frees3 each, giving37 per level. Add root deeper4 and quick balance4, giving785. Reused and allocated alternatives deliberately both charged.',
 'Each normal mutation charges local2, all new overflow allocations3 each, all controlled old-schema overflow frees3 each, same-length overwrite2 per full payload page, and one full balance traversal. Each delete charges local3, controlled overflow frees3 each, and two full balance traversals.',
 'Sibling payload overflow chains are copied/moved by cell pointers, never rewritten or cleared by balance. BalanceRekey only moves already dirty referenced pages and preserves dirty flags; it is not the excluded PagerMovepage relocation path.',
 'Every created root charges allocator3; every CREATE charges three metadata-cookie writes (format, encoding, schema); charge an extra empty-root clear per root and one initial page-count repair. No generic populated clear, old application-row UPDATE/DELETE, REPLACE, bulk transfer or preformat support.',
 'Only forward ordinary writes are inventoried. On SQLite error caller exits/rolls back without continued SQL writing. Statement-savepoint playback direct marks cannot create later frames under this condition; whole WAL rollback only undoes frames/cache. Custom pcache, incremental blob, backup target, page relocation, autovacuum, ATTACH/VACUUM/module/custom-extension paths excluded.',
 'The descriptor wrapper reads the last WAL page-one image rather than stale checkpoint main header, requiring UTF8/zero reserved/autovacuum0/ordinary payload fractions and matching last committed database size. Full CRC source observation still does not prove schema/content association, recovered native WAL index, intact semantic DB or source quiescence.'
 ],'conditions':['Exact pinned raw application and native semantics, only strict PRE206/214 original target, one fresh writer handle/one forward transaction/at most one commit',
 'Full declared schema and intact current database; no concurrent or alternate original-target writer, custom extension/VFS/pcache or global settings changes',
 'No scientific owner executed or runtime binary/defaultVFS attested; other handles/scratch/checkpoint/SHM/VFS/physical and held writer admission remain open']}
out=k/'wal-dirty-inventory-source.json';assert not out.exists();out.write_bytes(canonical(proof)+b'\n')
q=k/'verify_kit_wal_dirty_inventory.py';s=q.read_text(encoding='utf8')
s=s.replace("receipt['receiptSha256']=sha(canonical(receipt)) # same byte length; this fixture is not scientific preservation evidence", "receipt['receiptSha256']=sha(json.dumps(receipt,separators=(',',':')).encode())")
q.write_text(s,encoding='utf8',newline='')
p=k/'kit_frozen.py';s=p.read_text();needle="    'kit_readonly_target_wal.py','readonly-target-wal-source.json',";assert s.count(needle)==1
p.write_text(s.replace(needle,needle+"\n    'kit_wal_dirty_inventory.py','wal-dirty-inventory-source.json',"),encoding='utf8',newline='')
for build in ['build_stop_post.py','build_capture_stop_post.py']:
 r=subprocess.run([sys.executable,'-B',str(k/build),'--write-unreviewed-source'],cwd=w,capture_output=True)
 assert r.returncode==0,r.stderr.decode('utf8','replace')
p=k/'capture-statement-journal-source.json';v=json.loads(p.read_bytes());v['files']={n:pin(k/n) for n in v['files']};p.write_bytes(canonical(v)+b'\n')
for p in k.iterdir():
 if p.is_file() and p.suffix=='.py':ast.parse(p.read_bytes())
print(json.dumps({'fullPins':len(files),'rawApplicationBlobs':len(a['applicationGitBlobs']),'nativeExcerpts':len(excerpts),
 'staticPagerWriteOccurrences':len(ledger),'proofSha256':sha(out.read_bytes()),'hooksExecuted':False,'operatorsExecuted':0}))
