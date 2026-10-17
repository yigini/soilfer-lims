import ast,hashlib,json,pathlib,subprocess,sys
w=pathlib.Path(__file__).resolve().parents[2];k=w/'WP/batch-release-kit-be837974-20261016';h=w/'WP/backlog-resume-20261013'
assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=w,text=True).strip()=='b720cc1ab40b6a0c65fb44bb83b7104f5df71348'
sys.path.insert(0,str(k));from kit_contract import canonical
sha=lambda b:hashlib.sha256(b).hexdigest()
def pin(p):
 raw=p.read_bytes();return {'bytes':len(raw),'sha256':sha(raw)}
base=json.loads((k/'general-sorter-source.json').read_bytes());names=set(base['files'])
for name in ('kit_fingerprint_sorter.py','general-sorter-source.json'):names.add((k/name).relative_to(w).as_posix())
files={name:pin(w/name) for name in sorted(names)}
path=w/'server/node_modules/better-sqlite3/deps/sqlite3/sqlite3.c';raw=path.read_bytes();assert sha(raw)=='2bbdd0eff3f46852e954d7881b7945990bf78c1421f806cf7978bc22e187100a'
lines=raw.splitlines(keepends=True);offset=[0]
for line in lines:offset.append(offset[-1]+len(line))
ranges=[('temp_in_memory_compile_modes',187578,187593),('memory_disables_workers',106106,106121),
 ('zeroed_sorter_and_no_pma_threshold',106128,106185),('only_write_flush_gate',106974,107012),
 ('rewind_memory_branch',107765,107783),('next_memory_branch',107816,107847),('reset_preserves_no_pma',106386,106427),
 ('flush_starts_pma_mode',106879,106892),('pma_file_open_is_flush_only',106730,106784),
 ('partial_order_block_reset',147543,147585),('sorter_make_record_no_affinity',147463,147477),
 ('sorter_record_fields',147484,147542),('one_sorter_insert_site',147611,147620),
 ('output_calls_sorter_once',148218,148230),('output_field_omission_and_disabled_references',147929,148040),
 ('no_limit_uses_sorter_not_temp_index',155097,155121),('single_standard_source_scan',155123,155201),
 ('ordered_index_elides_sorter',155150,155168),('sorter_insert_expands_full_blob',101889,101911),
 ('full_serialized_header_and_zero_bytes',98956,99021)]
excerpts=[]
for label,first,last in ranges:
 b=raw[offset[first-1]:offset[last]];excerpts.append({'label':label,'firstLine':first,'lastLine':last,'startByte':offset[first-1],'endByte':offset[last],'bytes':len(b),'sha256':sha(b),'text':b.decode()})
caller=k/'retained_files.py';raw_caller=caller.read_bytes();caller_lines=raw_caller.splitlines(keepends=True);caller_offsets=[0]
for line in caller_lines:caller_offsets.append(caller_offsets[-1]+len(line))
caller_excerpts=[]
for node in ast.parse(raw_caller).body:
 if isinstance(node,(ast.FunctionDef,ast.AsyncFunctionDef)) and node.name in ('quote','table_fingerprint','memory_temporaries','logical'):
  b=raw_caller[caller_offsets[node.lineno-1]:caller_offsets[node.end_lineno]];caller_excerpts.append({'function':node.name,'firstLine':node.lineno,'lastLine':node.end_lineno,'startByte':caller_offsets[node.lineno-1],'endByte':caller_offsets[node.end_lineno],'sha256':sha(b),'text':b.decode()})
assert len(caller_excerpts)==4
v={'version':1,'scope':'CONDITIONAL_OWNED_READER_FINGERPRINT_SORTER_SOURCE_INVENTORY','files':files,'nativeSource':base['nativeSource'],
 'nativeExcerpts':excerpts,'callerSource':{'path':caller.relative_to(w).as_posix(),**pin(caller)},'callerExcerpts':caller_excerpts,
 'readerSqliteBinaryToPinnedNativeSourceVerified':False,'writerGraphAdmissionImplemented':False,
 'derivation':[
 'Actual retained_files.logical creates a new readonly Python sqlite3 connection, calls existing memory_temporaries BEFORE integrity/schema/fingerprint data SQL, then one BEGIN transaction. memory_temporaries refuses TEMP_STORE0/unadvertised builds, requests temp_store=MEMORY and verifies2. Existing behavior is unchanged. This is SOURCE ordering; neither loaded Python SQLite binary/source/build nor native runtime state attested by source hashes. Python collector observed3.49.1 and Node fixture3.51.2b270 are distinct engines.',
 'Exact table_fingerprint SQL is SELECT every complete quoted ordinary column FROM quoted ordinary table ORDER BY the identical full column tuple, one execute/one row iteration per table. Source has no expressions/CAST/explicit collation/WHERE/joins/subqueries/CTEs/DISTINCT/GROUP/window/LIMIT/OFFSET. Fresh unshadowed connection/no attached or named TEMP tables/custom callbacks/converters/collations/autoextensions/intact stable source are explicit conditions. Stored COLLATE profiles conservatively refuse. No target SQL executed by inventory/replay.',
 'Pinned native SELECT SRT_Output uses SorterOpen when LIMIT absent; one pushOntoSorter site in standard source loop, at most one native SorterWrite attempt per source row, one possible sorter handle per fingerprint. Ordered indexes may eliminate sorter. Partial-index ORDER BY may emit ResetSorter and multiple rewinds; this is explicitly supported, NOT mistaken for one normal disk-sorter Init/Rewind profile. Count upper bounds are source N (not SQL statement counts/static opcode counts/final sizes), resets<=N SQL opcodes, rewinds<=N+1. Other simple-SELECT TEMP Btrees excluded by no DISTINCT/joins/subquery/LIMIT/group/window and disabled sorter-reference optimization. Whole logical-reader PRAGMAs/schema SQL are separate.',
 'Complete sorter record nBase=nExpr+bSeq+nData<=2*C+1 for SRT_Output and disabled SQLITE_ENABLE_SORTER_REFERENCES. nExpr=C, nData<=C, optional sequence charged8. ECEL omission and nOBSat prefix removal only reduce fields. No packed-result BLOB destination SRT_Table/EphemTab/CTE, no extra deferred PK columns, no LIMIT deferred-load branch. MakeRecord emitted without affinity string; every source data field charged TWICE plus full headers/scalars and one sequence8 through existing full_record_bound. Complete >2000 fields or2GiB record refuses, never clips. Collector maxima remain source observations, not independently proved private contents.',
 'SQLITE_TEMP_STORE1/pragma2, STORE2/pragma2, STORE3/any => sqlite3TempInMemory true. Sorter allocation is zeroed; memory branch sets workers0 and skips ALL mnPmaSize/mxPmaSize setup and large allocation. VdbeSorterWrite flush ONLY under mxPmaSize nonzero, so no first FlushPMA/bUsePMA. Rewind on bUsePMA0 sorts/returns memory list without final PMA. Next follows memory list; Reset cleans memory and resets bUsePMA0, so partial-order block reset cannot enable spills. No OOM-to-disk fallback: errors propagate. PMA open/writes/SIZE_HINT/file creations0 CONDITIONALLY, regardless record count/page/PMA override/HeapNearlyFull. No source-based RAM-only assumption for default scientific handles; scope is exact existing owned-reader MEMORY setting ONLY.',
 'Zero PMA requests is NOT zero heap or physical memory use; every record may remain in RAM. It does NOT close process memory/cgroup allocation, main/WAL/SHM/index/checkpoint behavior, other schema/integrity/FK/backup queries/record scans/TEMP databases/whole logical reader or whole owner filesystem. No runtime binary/defaultVFS/kernel locks/quiescence/standard builtins/fresh connection attestation. No existing settings, transactions, scientific argv/default heap or deadlines changed.',
 'Profile already depends on an earlier logical fingerprint. Source-bound wrapper is explicitly for a FUTURE invocation only: never retroactively admits that earlier initial scan/schema sort. Requires ENTIRE profile/fullschema/logical/source descriptor plan replay. Full private DB bytes not packaged; independentProfileToPrivateDbBytesProof false. No capture owner, held admission, native preflight, content originals, package controls or budget wired. Native C source declaration is not Python engine attestation.',
 'NEW LOCAL full source/real caller pin mutation and SQL-disabled/inode/authority/type refusal tests; exact unmodified Python table_fingerprint on NEW owned readers plus pinned Node readonly full-sort and partial-index block-sort cases512/4096/65536. All fields/counts/SQL/programs and original main hashes retained. Static opcodes and empty temp samples do NOT measure dynamic sorter/file calls or continuous peak; no absence=>no-spill inference. WINDOWS only/no full installer/scientific owner/Linux/VFS/physical proof.'
 ]}
(k/'fingerprint-sorter-source.json').write_bytes(canonical(v)+b'\n')
p=k/'kit_frozen.py';s=p.read_text(encoding='utf8');needle="    'kit_general_sorter.py','general-sorter-source.json',";assert s.count(needle)==1;s=s.replace(needle,needle+"\n    'kit_fingerprint_sorter.py','fingerprint-sorter-source.json',");p.write_text(s,encoding='utf8',newline='')
for name in ('build_stop_post.py','build_capture_stop_post.py'):
 r=subprocess.run([sys.executable,'-B',str(k/name),'--write-unreviewed-source'],cwd=w,capture_output=True);assert r.returncode==0,r.stderr.decode('utf8','replace')
p=k/'capture-statement-journal-source.json';value=json.loads(p.read_bytes());value['files']={n:pin(k/n) for n in value['files']};p.write_bytes(canonical(value)+b'\n')
for p in k.iterdir():
 if p.is_file() and p.suffix=='.py':ast.parse(p.read_bytes())
out={'fullSourcePins':len(files),'nativeExcerpts':len(excerpts),'fullCallerFunctions':len(caller_excerpts),'sourceProofSha256':sha((k/'fingerprint-sorter-source.json').read_bytes()),'sourceCopyMaximumPathLengthEstimate':len(str(k/'fingerprint-sorter-local-retained-fixtures/fp-12345678'))+1+max(map(len,names)),'hooksExecuted':False,'operatorsExecuted':0}
(h/'fingerprint491-entry-0956-once/source-preparation-record.json').write_bytes(canonical(out)+b'\n');print(json.dumps(out))
