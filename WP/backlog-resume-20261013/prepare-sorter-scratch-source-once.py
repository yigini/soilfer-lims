import ast,hashlib,json,pathlib,subprocess,sys
w=pathlib.Path(__file__).resolve().parents[2];k=w/'WP/batch-release-kit-be837974-20261016'
assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=w,text=True).strip()=='ee47909e0347cc867f459d4cb6b531a3c91b0ba3'
sys.path.insert(0,str(k));from kit_contract import canonical
sha=lambda b:hashlib.sha256(b).hexdigest()
def pin(p):
 b=p.read_bytes();return {'bytes':len(b),'sha256':sha(b)}
base=json.loads((k/'order-revision-native-source.json').read_bytes())
names=set(base['files']);names.add((k/'order-revision-native-source.json').relative_to(w).as_posix());names.add((k/'kit_sorter_scratch.py').relative_to(w).as_posix())
files={name:pin(w/name) for name in sorted(names)}
p=w/base['nativeSource']['path'];raw=p.read_bytes();assert sha(raw)==base['nativeSource']['sha256']
lines=raw.splitlines(keepends=True);offsets=[0]
for line in lines:offsets.append(offsets[-1]+len(line))
ranges=[('default_pma_pages',23583,23588),('default_global_pma',23659,23665),('global_pma_override',185616,185620),
 ('sorter_record_memory_header',105599,105617),('worker_task_cap',106106,106121),('pma_minimum_and_maximum',106161,106185),
 ('pma_reader_monotonic',105835,105870),('sorter_extend_requests',106450,106471),('sorter_temp_open_and_mmap',106479,106498),
 ('pma_writer_init',106631,106647),('pma_writer_exact_writes',106653,106675),('pma_writer_finish_and_varint',106688,106713),
 ('initial_pma_records_and_headers',106730,106784),('pma_worker_scheduling',106879,106943),
 ('sorter_record_size_and_flush',106974,107012),('sorter_memory_round_and_copy',107014,107053),
 ('incremental_populate_bounds_and_advance',107056,107095),('incremental_swap',107137,107167),
 ('incremental_merger_reservation',107176,107204),('incremental_file_allocation',107372,107431),
 ('merge_tree_depth',107519,107537),('merge_tree_nodes',107547,107589),('merge_tree_build',107603,107670),
 ('threaded_root_pair_and_task_roots',107709,107748),('single_rewind_final_pma',107764,107806),('next_advances_once',107816,107847)]
excerpts=[]
for label,first,last in ranges:
 part=raw[offsets[first-1]:offsets[last]];excerpts.append({'label':label,'firstLine':first,'lastLine':last,'startByte':offsets[first-1],'endByte':offsets[last],'bytes':len(part),'sha256':sha(part),'text':part.decode()})
v={'version':1,'scope':'CONDITIONAL_SINGLE_NORMAL_SORTER_NATIVE_REQUESTS','files':files,'nativeSource':base['nativeSource'],
 'nativeExcerpts':excerpts,'applicationCallerProofSha256':sha((k/'order-revision-native-source.json').read_bytes()),
 'defaultPmaPages':250,'maximumMemoryRecordBytes':48,'maximumPmaThresholdBytes':1<<29,'maximumWorkerThreads':15,
 'runtimeSorterConfigurationVerified':False,'writerGraphAdmissionImplemented':False,'sorterFileLengthOrVfsPreallocationBounded':False,
 'officialReferences':['https://www.sqlite.org/tempfiles.html'],
 'derivation':[
 'Scope is one ordinary VdbeSorter Init, exactly N Write inputs, one Rewind and monotonic Next, no Reset/repeated-Rewind/error continuation/custom sort/foreign modifications. STRICT PRE209 only supplies one NULL+builtin signed64-rowid key per old OrderLine row; existing source-bound fullschema and logical state determine N. Other owner sorters/materializations/TEMP Btrees remain separate.',
 'FULL serialized key <=32; one-byte key-length varint gives <=33 stored bytes per record. SorterRecord header <=16 under ordinary pointer<=8-byte ABI; nReq<=48 and ROUND8(nReq)<=48. This ABI/default build/global configuration is DECLARATION, not observation. No runtime/native-binary/VFS attestation follows.',
 'Declared default SQLITE_SORTER_PMASZ=250 and no SQLITE_CONFIG_PMASZ override imply mnPmaSize=250*P. In aMemory mode, a flush requires iMemory+nReq>mxPmaSize>=mnPmaSize; iMemory<=48*rows. In individual-allocation mode flush needs szPMA>mxPmaSize or szPMA>mnPmaSize && heapNearlyFull, and szPMA<=33*rows. Therefore every nonfinal PMA has at least floor(250*P/48) records in EITHER mode; only final list may be smaller. R<=ceil(N/minRows), never an assumption that all input stays in memory.',
 'Native mxPmaSize=max(mnPmaSize,min(cacheBytes,512MiB)); mn<=16MiB for supported P so mxPmaSize<=512MiB. Every incremental region mxSz=max(mxKeysize+9,mxPmaSize/2)<=256MiB. Cache size may be any supported integer; no default cache-size or memory-only credit.',
 'At most15 workers plus foreground; T<=min(16,R) nonempty tasks. TreeDepth D is source loop while16^(D+1)<R. In each task tree, level l creates at most ceil(r_i/16^l) incremental nodes. Sum across T<=ceil(R/16^l)+T-1. Charge all levels1..D, every nonempty-task root wrapper and one final threaded root even if actual single-thread build avoids wrappers.',
 'At most16 threaded IncrMergers: final root plus at most15 worker-task roots. Every threaded merger opens TWO files of mxSz. Every nonthreaded merger reserves its own mxSz region in shared pTask->file2; aggregate <=all-node-count*256MiB without subtracting threaded-node reservations. At mostT initial files/T shared files/2*threaded files; no close/deletion/truncate/reuse credit. Empty inputs need no file.',
 'Initial PMAs append each record once and one length header<=9 bytes per PMA:33*N+9*R. IncrPopulate writes only key-varint+key, checks next record fits reserved region, then advances one winning reader; each record passes each merge level once. Charge D internal layers+one task wrapper+one final root, PLUS initial PMA: cumulative write bytes <=33*N*(D+3)+9*R.',
 'PmaWriter emits exact occupied buffer ranges, not full zero-padded buffers; Finish records exact end. Initial ExtendFile requests <=oldEOF+runBytes+9, covered by initial aggregate. Shared file opens may request WHOLE sum of reserved regions before any content, and threaded pairs each request mxSz. Aggregate native requested extents includes all those gaps/reservations, independently of cumulative writes.',
 'Sorter ExtendFile explicitly sends CHUNK_SIZE4096 then SIZE_HINT and fetch when eligible; OpenTempFile sets MMAP_SIZE to compile maximum. Never borrow MAIN chunk0/mmap0 assumptions. Logical native request bound is NOT VFS rounding/file-length/preallocation/physical-block bound, runtime routing proof, continuous peak or full transient-file-original retention. Per-file rounding/entry/inode figures remain declared allowances only.',
 'Whole complete extent plus conservative per-file rounding slack uses existing32GiB planning envelope; oversized complete plans REFUSE/neverclip. No held admission/native preflight/package controls/budget integration. Scientific argv/defaultheap/journal-temp settings/installer transactions600 clocks/deadlines/signals/quotas unchanged. Windows native SQL fixtures do not execute Linux/fullscientific owners/full installer chain.'
 ]}
p=k/'sorter-scratch-source.json';assert not p.exists();p.write_bytes(canonical(v)+b'\n')
p=k/'verify_kit_sorter_scratch.py';s=p.read_text(encoding='utf8');assert '[4097]' in s;s=s.replace('[4097]','[1024]');p.write_text(s,encoding='utf8',newline='')
p=k/'kit_frozen.py';s=p.read_text(encoding='utf8');needle="    'kit_order_revision_native.py','order-revision-native-source.json',";assert s.count(needle)==1
p.write_text(s.replace(needle,needle+"\n    'kit_sorter_scratch.py','sorter-scratch-source.json',"),encoding='utf8',newline='')
for name in ['build_stop_post.py','build_capture_stop_post.py']:
 r=subprocess.run([sys.executable,'-B',str(k/name),'--write-unreviewed-source'],cwd=w,capture_output=True);assert r.returncode==0,r.stderr.decode('utf8','replace')
p=k/'capture-statement-journal-source.json';v=json.loads(p.read_bytes());v['files']={n:pin(k/n) for n in v['files']};p.write_bytes(canonical(v)+b'\n')
for p in k.iterdir():
 if p.is_file() and p.suffix=='.py':ast.parse(p.read_bytes())
print(json.dumps({'fullSourcePins':len(files),'nativeExcerpts':len(excerpts),'sourceProofSha256':sha((k/'sorter-scratch-source.json').read_bytes()),'hooksExecuted':False,'operatorsExecuted':0}))
