import ast,hashlib,json,pathlib,subprocess,sys
w=pathlib.Path(__file__).resolve().parents[2];k=w/'WP/batch-release-kit-be837974-20261016';h=w/'WP/backlog-resume-20261013'
assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=w,text=True).strip()=='36d1aff914ff18b92db1672c8f5b494f163c355f'
sys.path.insert(0,str(k));from kit_contract import canonical
sha=lambda b:hashlib.sha256(b).hexdigest()
def pin(p):
 raw=p.read_bytes();return {'bytes':len(raw),'sha256':sha(raw)}
old=json.loads((k/'sorter-scratch-source.json').read_bytes());record=json.loads((k/'record-payload-source.json').read_bytes())
names=set(old['files'])|set(record['files'])
for name in ('kit_general_sorter.py','sorter-scratch-source.json','record-payload-source.json'):names.add((k/name).relative_to(w).as_posix())
files={name:pin(w/name) for name in sorted(names)}
v={'version':1,'scope':'CONDITIONAL_NORMAL_SORTER_FULL_SERIALIZED_RECORD_REQUESTS','files':files,
 'nativeSource':old['nativeSource'],'nativeExcerpts':old['nativeExcerpts']+record['nativeExcerpts'],
 'maximumDeclaredSerializedKeyBytes':16*1024**2,'defaultPmaPages':250,'maximumDeclaredSorterRecordHeaderBytes':16,
 'runtimeSorterConfigurationVerified':False,'writerGraphAdmissionImplemented':False,
 'derivation':[
 'One complete declared normal sorter: one Init/one Rewind/monotonic Next, no reset/reuse/repeated rewind/custom file changes/global PMA override/SQL or IO error continuation. Count EVERY SorterWrite input, including duplicates and complete serialized record headers/scalars/nZero. Full record bound and native call count are independent declarations; no SQL/Btree/frame/final-size substitution.',
 'B is COMPLETE serialized record upper bound, 1..16MiB. Proof-input limit only: never sets SQLite limits or scientific quotas. With declared sizeof(SorterRecord)<=16, each rounded memory record <=ROUND8(B+16). Both allocation modes included: contiguous pre-insert flush implies (k+1)*M>mnPmaSize; separate allocations flush only after szPMA>mnPmaSize, even HeapNearlyFull. Every nonfinal PMA has >=max(1,floor(250*P/M)) records. The max(1,...) is ESSENTIAL for records larger than threshold; a single large record remains a nonempty run. At most ceil(N/minRows) initial PMAs, including the last short run.',
 'Every stored key charges B+9 for its full length varint; every initial PMA charges9 header bytes. Native mxKeysize=max(nVal+varint(nVal)), incremental region=max(mxKeysize+9,mxPmaSize/2)<=max(B+18,256MiB). Complete source mxPmaSize<=512MiB under declared default PMA250/cache branch. The 16MiB proof-input record cap keeps nReq/nPMA/rounded memory/preinsert iMemory+nReq/nMin and mxKeysize+9 in signed-int range even when an individual record exceeds mnPmaSize; iMemory remains <=max(mxPmaSize+7,ROUND8(B+16)).',
 'Charge ALL up-to16 task PMA and shared files, every16-way merge depth/node, per-task wrappers/final root, whole shared reservations and BOTH files of every possible threaded merger. No subtracting native thread reservation reuse. Cumulative writes<=(B+9)*N*(D+3)+9*R; aggregate xWrite-END/SIZE_HINT requested extents<=initial+all shared+all thread-pair reservations. Up to64 files. Full aggregate extent/cumulative write/rounding slack >32GiB REFUSES; never clips. This is a planning envelope, not operational quota or physical ceiling.',
 'Independent record-byte source wrapper replays ENTIRE prior profile/schema/logical/descriptor plan and requires its ENTIRE full record upper bound, never32byte clipping. ALL8 page sizes must fit; selecting only fitting sizes is unsupported. Native count/caller field mapping/handle inventory are NOT verified by this wrapper and stay false even if the declaration matches observed row count. No actual capture collector integration, held admission, native preflight, content originals, package controls or budget change.',
 'Request scope is native xWrite END offsets and SIZE_HINT byte arguments ONLY. MMAP_SIZE mapping limit is not another file-end request; CHUNK_SIZE4096/routing/fresh exclusive writable empty creation, readonly fallback, runtime binary/default VFS/PMA/ABI, syscalls/file extension/preallocation/physical blocks need separate evidence. Existing strict32byte PRE209 model is unchanged and still refuses larger records. No promotion of conditional Unix VFS proof.',
 'NEW LOCAL independent adversarial flush/merge partitions and all8 page-size/oversize/refusal tests; SQL-disabled source-bound replay and same-byte inode mutation; actual pinned Windows Node large copied-field CREATE INDEX at512/4096/65536 with NEW owned-reader profile/record/general sorter plan BEFORE writer. Persisted full index payload varints include headers/overflow. Static SorterInsert opcodes/sample compliance are NOT measured dynamic sorter/file calls or complete caller inventory. No Linux/full application owner/installer chain/continuous peak/physical proof.'
 ]}
(k/'general-sorter-source.json').write_bytes(canonical(v)+b'\n')
p=k/'kit_frozen.py';text=p.read_text(encoding='utf8');needle="    'kit_record_payload.py','record-payload-source.json',";assert text.count(needle)==1
text=text.replace(needle,needle+"\n    'kit_general_sorter.py','general-sorter-source.json',");p.write_text(text,encoding='utf8',newline='')
for name in ('build_stop_post.py','build_capture_stop_post.py'):
 r=subprocess.run([sys.executable,'-B',str(k/name),'--write-unreviewed-source'],cwd=w,capture_output=True);assert r.returncode==0,r.stderr.decode('utf8','replace')
p=k/'capture-statement-journal-source.json';value=json.loads(p.read_bytes());value['files']={n:pin(k/n) for n in value['files']};p.write_bytes(canonical(value)+b'\n')
for p in k.iterdir():
 if p.is_file() and p.suffix=='.py':ast.parse(p.read_bytes())
out={'fullSourcePins':len(files),'nativeExcerpts':len(v['nativeExcerpts']),'sourceProofSha256':sha((k/'general-sorter-source.json').read_bytes()),
 'sourceCopyMaximumPathLengthEstimate':len(str(k/'general-sorter-local-retained-fixtures/gen-12345678'))+1+max(map(len,names)),
 'hooksExecuted':False,'operatorsExecuted':0,'existingStrict32ByteModelChanged':False}
(h/'general-sorter484-entry-0930-once/source-preparation-record.json').write_bytes(canonical(out)+b'\n');print(json.dumps(out))
