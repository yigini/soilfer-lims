from pathlib import Path
import ast,hashlib,json,subprocess,sys
w=Path(__file__).resolve().parents[2];k=w/'WP/batch-release-kit-be837974-20261016';h=w/'WP/backlog-resume-20261013';e=h/'checkpoint-requests556-entry-1348-once';sys.path.insert(0,str(k));from kit_contract import canonical
sha=lambda b:hashlib.sha256(b).hexdigest()
assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=w,text=True).strip()=='f11766da5436b0bfe31008cffede07f9313986b3'
review_path=h/'wal-close556-entry-1341-once/wal-checkpoint-close-source-review.json';review_raw=review_path.read_bytes();v=json.loads(review_raw)
files=dict(v['files']);files.update(json.loads((k/'wal-source-binding-source.json').read_bytes())['files'])
for p in (review_path,k/'wal-source-binding-source.json',k/'kit_wal_source_binding.py',k/'kit_checkpoint_requests.py'):
 b=p.read_bytes();files[p.relative_to(w).as_posix()]={'bytes':len(b),'sha256':sha(b)}
for name,pin in files.items():
 b=(w/name).read_bytes();assert pin=={'bytes':len(b),'sha256':sha(b)}
native=(w/v['nativeSource']['path']).read_bytes();assert sha(native)==v['nativeSource']['sha256'];lines=native.splitlines(keepends=True);offset=[0]
for line in lines:offset.append(offset[-1]+len(line))
parts=list(v['nativeExcerpts'])
for label,first,last in [('wal_index_layout_constants',67201,67233),('wal_index_region_constants',67365,67386),('wal_frame_region',67954,67964)]:
 b=native[offset[first-1]:offset[last]];parts.append({'label':label,'firstLine':first,'lastLine':last,'startByte':offset[first-1],'endByte':offset[last],'bytes':len(b),'sha256':sha(b),'text':b.decode()})
proof={'version':1,'scope':'CONDITIONAL_ONE_NATIVE_CHECKPOINT_REQUESTS','files':dict(sorted(files.items())),'nativeSource':v['nativeSource'],'nativeExcerpts':parts,'priorCheckpointReviewPath':review_path.relative_to(w).as_posix(),'priorCheckpointReviewSha256':sha(review_raw),'runtimeBinaryToSourceBindingVerified':False,'writerGraphAdmissionImplemented':False,'derivation':[
 'ONE native sqlite3WalCheckpoint API (PASSIVE/FULL/RESTART/TRUNCATE) OR ONE sqlite3WalClose including at most one PASSIVE checkpoint. Excludes other caller SQL/checkpoints/normalization/source-close calls. Stable intact associated main-WAL-index/full extents/head geometry/native ABI/ordinary locks and shared index/no heap fallback/no external writers, competing checkpoint, state/callback/VFS/log/busy/provider side effects; stop first error/no retry. Own native head reset to0 allowed only inside this one invocation. These are declarations NOT actual runtime/native association evidence.',
 'Wrapper/read-header recovery may map index0 twice: first probe without writer lock can return NULL, second with writer lock can allocate. Therefore do NOT claim region count equals xShmMap invocation count. Bound only maximum distinct region ordinal/requested mapping END. Fresh complete WAL physicalF with no invalid/uncommitted tail bounds recovery/iterator region numbers. Native ABI header136/u32four/ht_slottwo gives first4062/later4096 frames in32768B regions. R=1+ceil(max(0,F-4062)/4096). Every native requested region index<R, mapping END<=R*32768. Existing full initial index length retained even if larger. Actual VFS ftruncate/map/preallocation semantics NOT bounded.',
 'Checkpoint body uses current HEAD D=nPage and F=mxFrame, not older read snapshot page_countN. SafeFrame<=F/readmarks can cause partial/no backfill with OK. Heap iterator merges/deduplicates and returns strictly increasing pgno. Filter requires frame>nBackfill/frame<=safe/pgno<=D; one direct MAIN sqlite3OsWrite P bytes at(pgno-1)*P ends<=D*P. At mostmin(F,D) direct native MAIN page-write invocations and min(F,D)*P argument bytes for this ONE body. CKPT_START-DONE do dispatch VFS callbacks/ignore returns and are not success evidence; effects beyond exact ordinary profile REFUSE. MAIN SIZE_HINT/truncate argumentsD*P. Actual kernel/syscall/write amounts NOT measured.',
 'Recovery constructs mapped index/hash/header/readmark/backfill state from complete WAL, may log; not native MAIN page-copy. RESTART/TRUNCATE reset index state; TRUNCATE and WalClose limit may request WAL truncate0/delete namespaces/unmapSHM/close. No append-WAL-frame producer in these exact selected checkpoint/close functions. Full initial WAL/index extents retained after reset/truncate/delete/close/error/no credits. Full logical layout [max(initialMainBytes,D*P),initialWalBytes,max(initialIndexBytes,R*32768)] including entries and whole rounding must fit32GiB, otherwiseREFUSE/neverclip. Namespace physical metadata/journald/heap/whole filesystem/full lifetime remain unbounded.',
 'Pure original wrapper checks ENTIRE full fresh WAL/index bytes using existing strict fresh449 checker (CRC WAL/headers/maps/hash/unused bytes/native order DECLARED). Derives F/D from complete committed HEAD, not MAIN header or earlier logical/profile count. Full canonical WAL/index hex retained/replayed, full MAIN bytes NOTpackaged.4MiB combined original envelope refuses/no clipping, not operational quota/preSQL capacity. This fresh-byte support is not recovery execution, private MAIN association, locks/quiescence, actual original-at-use observation, runtime binding or held admission. Existing WAL writer planner continues refusing EVERY nonempty SHM/no bypass.',
 'Seven NEW methods:full pins/28exactC ranges;ALL8P/five modes/4062-4063-8158-8159 boundaries/full initial extents;independent duplicate/growing-shrinkinghead/readmark-backfill windows;every phase/native ABI/type/size/complete aggregate refusal;whole layout/request/count/ALLfalse-authority replay;complete synthetic WAL/index CRC+native orders/F4063/sourceheadD20000 vs earlierdeclaredMAIN2/noSQL/wholeoriginal mutation;NEWfullsource same-length C/module/priorledger/checker mutation with extended SAMEfixture Windows paths. NEW feature has NO native SQL fixture cases; synthetic byte/arithmetic tests only. Existing fullsuite native fixtures remain distinct. Scientific SQL/settings/clocks/transactions/quotas unchanged.'
 ]}
assert len(parts)==28
(k/'checkpoint-requests-source.json').open('xb').write(canonical(proof)+b'\n')
p=k/'kit_frozen.py';s=p.read_text(encoding='utf8');a="    'kit_header_normalization.py','header-normalization-source.json',";assert s.count(a)==1;s=s.replace(a,a+"\n    'kit_checkpoint_requests.py','checkpoint-requests-source.json',");p.write_text(s,encoding='utf8',newline='')
for name in ('build_stop_post.py','build_capture_stop_post.py'):
 r=subprocess.run([sys.executable,'-B',str(k/name),'--write-unreviewed-source'],cwd=w,capture_output=True);assert r.returncode==0,r.stderr
p=k/'capture-statement-journal-source.json';q=json.loads(p.read_bytes())
for name in q['files']:
 b=(k/name).read_bytes();q['files'][name]={'bytes':len(b),'sha256':sha(b)}
p.write_bytes(canonical(q)+b'\n')
for p in k.iterdir():
 if p.is_file() and p.suffix=='.py':ast.parse(p.read_bytes())
record={'sourceProofSha256':sha((k/'checkpoint-requests-source.json').read_bytes()),'fullSourcePins':len(files),'exactNativeExcerpts':28,'newTestMethods':7,'expectedUniqueTests':563,'expectedSourceFiles':243,'distinctRegionCountIsMapInvocationCount':False,'newNativeFeatureCases':0,'hooksRebuiltSourceOnly':True,'hooksExecuted':False,'operators':0}
(e/'source-preparation-record.json').open('xb').write(canonical(record)+b'\n');print(json.dumps(record))
