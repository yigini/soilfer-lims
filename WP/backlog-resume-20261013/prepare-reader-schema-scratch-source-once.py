import ast,hashlib,json,pathlib,subprocess,sys
w=pathlib.Path(__file__).resolve().parents[2];k=w/'WP/batch-release-kit-be837974-20261016';h=w/'WP/backlog-resume-20261013'
assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=w,text=True).strip()=='aaf2de9370b300095a5c41e2f3d30fe9c9d43acf'
sys.path.insert(0,str(k));from kit_contract import canonical
import kit_reader_schema_scratch as schema
sha=lambda b:hashlib.sha256(b).hexdigest()
def pin(p):
 b=p.read_bytes();return {'bytes':len(b),'sha256':sha(b)}
base=json.loads((k/'fingerprint-sorter-source.json').read_bytes());names=set(base['files'])
for n in ('kit_reader_schema_scratch.py','fingerprint-sorter-source.json'):names.add((k/n).relative_to(w).as_posix())
files={n:pin(w/n) for n in sorted(names)}
raw=(w/base['nativeSource']['path']).read_bytes();assert sha(raw)==base['nativeSource']['sha256'];lines=raw.splitlines(keepends=True);offset=[0]
for line in lines:offset.append(offset[-1]+len(line))
excerpts=list(base['nativeExcerpts'])
for label,first,last in [('schema_alias_to_builtin_main',124726,124741),('builtin_schema_readonly_columns',145882,145902)]:
 b=raw[offset[first-1]:offset[last]];excerpts.append({'label':label,'firstLine':first,'lastLine':last,'startByte':offset[first-1],'endByte':offset[last],'bytes':len(b),'sha256':sha(b),'text':b.decode()})
callers=[]
for name,functions in [('retained_files.py',('memory_temporaries','logical')),('kit_schema_collection.py',('collect_full_schema',))]:
 p=k/name;rawp=p.read_bytes();ls=rawp.splitlines(keepends=True);off=[0]
 for line in ls:off.append(off[-1]+len(line))
 for node in ast.parse(rawp).body:
  if isinstance(node,ast.FunctionDef) and node.name in functions:
   b=rawp[off[node.lineno-1]:off[node.end_lineno]];callers.append({'path':p.relative_to(w).as_posix(),'function':node.name,'firstLine':node.lineno,'lastLine':node.end_lineno,'startByte':off[node.lineno-1],'endByte':off[node.end_lineno],'sha256':sha(b),'text':b.decode()})
assert len(callers)==3
assert all(any(query in (k/n).read_text(encoding='utf8') for n in ('retained_files.py','kit_schema_collection.py')) for _,query,_,_ in schema.QUERIES)
v={'version':1,'scope':'CONDITIONAL_EXPLICIT_OWNED_READER_SCHEMA_SELECT_SCRATCH','files':files,'nativeSource':base['nativeSource'],'nativeExcerpts':excerpts,'callerExcerpts':callers,'queries':[{'label':label,'sql':sql} for label,sql,_,_ in schema.QUERIES],'readerSqliteBinaryToPinnedNativeSourceVerified':False,'beforeInitialReaderSqlAdmissionImplemented':False,'derivation':[
'Exact three explicit schema SELECTs in retained_files.logical/kit_schema_collection.collect_full_schema are pinned byte-for-byte. Logical objects and table-name SELECTs always execute once; full unfiltered schema SELECT executes once only under full_schema=True. Their original unqualified sqlite_master/sqlite_schema names require a fresh unshadowed reader/no attached or named TEMP schema/custom functions/collations/autoextensions/intact stable source. Pinned builtin schema is readonly five ordinary columns; preferred name resolves to main legacy schema. No SQL or later schema/profile input is needed by this source inventory.',
'All three are simple single-source SRT_Output SELECTs with ORDER BY, no LIMIT/DISTINCT/joins/subquery/group/window/expressions in projection. Pinned compiler permits at most one sorter init per query and no other query TEMP Btree under exact conditions. Filter scalar LIKE/equality use ordinary builtin semantics. Maximum fields are order columns+selected data+optional sequence:7/8/3. No measured dynamic counts, row payload byte bound or source schema row-count bound before SQL is invented. All possible sorter handles charged independently with no overlap/cleanup/reuse credit.',
'Inherited exact native MEMORY source derivation pins compile TEMP_STORE1/2 with pragma2 orSTORE3. Zeroed sorter skips PMA threshold setup, workers0/mxPmaSize0, flush gated by nonzero threshold; rewind/next/reset remain in-memory. Zero PMA file creations/xWrite bytes/SIZE_HINT arguments holds independent of schema row count/payload/PMA partition. OOM propagates, no disk fallback. This does not bound heap or physical memory; no default scientific RAM-only credit.',
'No later full-schema/record profile/logical fingerprint is required for the conditional zero-PMA result, avoiding retroactive use of later observations to authorize initial schema SQL. Nevertheless no initial reader admission is implemented: loaded Python engine/source/build binding and actual reader/runtime configuration remain unproved. Implicit schema initialization SELECTs, integrity/FK/table_info/profile/backup/fingerprints and main/WAL/SHM/recovery/checkpoint/whole logical reader scratch remain separate.',
'NEW-memory-only Python metadata preflight preparation has no filename parameter and opens only :memory:. Necessary checker refuses unmatched version/sourceID/TEMP_STORE/sorter-reference profiles and exact metadata/authority substitutions. Matching version/sourceID/options/pragma metadata still does not establish loaded binary-to-source/build/defaultVFS, fresh ownership/locks/kernel/routing or admission. LOCAL Python3.49.1 differs from pinned Node/native3.51.2b270; no production version inferred. No actual owner is wired to this observation/checker/inventory.',
'NEW LOCAL actual unmodified logical(full_schema false/true) traces and exact schema query programs on Python plus pinned Node at512/4096/65536; internal implicit indexes/stat rows/NULL SQL/rootpages preserved. Original new main bytes unchanged. Static EXPLAIN and empty temp samples are not native call/continuous peak/full lifetime/physical measurements. WINDOWS only, no Linux/full scientific owner/installer/container/default startup execution. All source/authority/boolean/foreign/memory/default/engine mismatches refuse without target SQL in planner/replay.'
]}
(k/'reader-schema-scratch-source.json').write_bytes(canonical(v)+b'\n')
p=k/'kit_frozen.py';s=p.read_text(encoding='utf8');needle="    'kit_fingerprint_sorter.py','fingerprint-sorter-source.json',";assert s.count(needle)==1;s=s.replace(needle,needle+"\n    'kit_reader_schema_scratch.py','reader-schema-scratch-source.json',");p.write_text(s,encoding='utf8',newline='')
for name in ('build_stop_post.py','build_capture_stop_post.py'):
 r=subprocess.run([sys.executable,'-B',str(k/name),'--write-unreviewed-source'],cwd=w,capture_output=True);assert r.returncode==0,r.stderr
p=k/'capture-statement-journal-source.json';value=json.loads(p.read_bytes());value['files']={n:pin(k/n) for n in value['files']};p.write_bytes(canonical(value)+b'\n')
for p in k.iterdir():
 if p.is_file() and p.suffix=='.py':ast.parse(p.read_bytes())
out={'sourceProofSha256':sha((k/'reader-schema-scratch-source.json').read_bytes()),'fullSourcePins':len(files),'nativeExcerpts':len(excerpts),'fullCallerFunctions':len(callers),'hooksExecuted':False,'operatorsExecuted':0}
(h/'reader-schema498-entry-1019-once/source-preparation-record.json').write_bytes(canonical(out)+b'\n');print(json.dumps(out))
