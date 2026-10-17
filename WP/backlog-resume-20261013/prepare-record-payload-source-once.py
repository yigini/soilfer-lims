import ast,hashlib,json,pathlib,subprocess,sys
w=pathlib.Path(__file__).resolve().parents[2];k=w/'WP/batch-release-kit-be837974-20261016';h=w/'WP/backlog-resume-20261013'
assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=w,text=True).strip()=='63b18e005676f40df4e7d82346cace1f33f65f2e'
sys.path.insert(0,str(k));from kit_contract import canonical
sha=lambda b:hashlib.sha256(b).hexdigest()
def pin(p):
 b=p.read_bytes();return {'bytes':len(b),'sha256':sha(b)}
base=json.loads((k/'linux-main-vfs-source.json').read_bytes());collector=json.loads((k/'schema-collection-source.json').read_bytes())
names=set(base['files'])|{(k/name).relative_to(w).as_posix() for name in collector['files']}
for name in ['kit_record_payload.py','schema-collection-source.json','linux-main-vfs-source.json']:names.add((k/name).relative_to(w).as_posix())
files={name:pin(w/name) for name in sorted(names)}
p=w/'server/node_modules/better-sqlite3/deps/sqlite3/sqlite3.c';raw=p.read_bytes();assert sha(raw)=='2bbdd0eff3f46852e954d7881b7945990bf78c1421f806cf7978bc22e187100a'
lines=raw.splitlines(keepends=True);offsets=[0]
for line in lines:offsets.append(offsets[-1]+len(line))
ranges=[('native_storage_types',90680,90699),('serial_type_lengths',90775,90809),('affinity_is_separate',98773,98819),('scalar_and_zero_blob_data',98861,98954),('full_record_final_header_and_zero_bytes',98956,99021),('maximum_varint_length',37055,37097),('native_typeof_storage_class',131826,131845),('length_blob_bytes_vs_text_nul',131863,131897),('cast_utf8_text_to_blob',85568,85580),('index_uses_expanded_full_key',101858,101883)]
excerpts=[]
for label,first,last in ranges:
 b=raw[offsets[first-1]:offsets[last]];excerpts.append({'label':label,'firstLine':first,'lastLine':last,'startByte':offsets[first-1],'endByte':offsets[last],'bytes':len(b),'sha256':sha(b),'text':b.decode()})
v={'version':1,'scope':'NEW_OWNED_READER_NATIVE_RECORD_PAYLOAD_OBSERVATIONS','files':files,'nativeSource':{'path':p.relative_to(w).as_posix(),**pin(p)},'nativeExcerpts':excerpts,
 'captureCollectorIntegrationImplemented':False,'runtimeBinaryToSourceBindingVerified':False,'writerGraphAdmissionImplemented':False,
 'officialReferences':['https://www.sqlite.org/fileformat2.html#record_format'],
 'derivation':[
 'Collector requires already-open query-only UTF8/memory-temp transaction on canonical reader/dev.db, no attached schemas/aliases/hardlinks. Establishes snapshot before FD hashes, recollects full unfiltered schema in SAME transaction, observes COUNT/MAX/MIN native storage-byte expressions for EVERY ordinary nonhidden user column. No raw/live/master SQL open/no SQL connection created by module. Existing capture owner does NOT call this collector; no pre-SQL held capacity/new-reader-caller binding or builtin-function runtime attestation.',
 'Native CASE typeof NULL=>0, INTEGER/REAL=>8 maximum native payload, TEXT=>length(CAST(value AS BLOB)) in required UTF8, BLOB=>length(value) includingzeroBlob. Does NOT use text character length (stopsatNUL), JSONlen, Pythonstr representation, decimalnumber length or native record headers guessedfromJSON. Queries return only counts/maxima, not scientific values. Every scan rowcount MUST match ENTIRE canonical logical original table count/columns. Hidden/generated/virtual/missing/changed table/columns refuse.',
 'Profile sums independent PER-COLUMN maxima, WITHOUT assuming maximaoccurinone row. Header charges9 bytes for hdr-size plus9 for EVERY serial-type field, then all native data bytes. Covers NULL/int0/1 optimization withoutcredit, fullsigned64/double8, UTF8/embeddedNUL, BLOBnData+nZero. FULLindex key proof includes expandedBLOB and signedrowid onlywhen separatelydeclared extraData8. Maximum2GiB complete record and2000fields/16MiB completeprofile envelopes REFUSE/neverclip; these are proofinputs, NOT runtime settings or scientific quotas.',
 'Projection permits copied columns INCLUDING deliberate duplicates plus separately declared extra-native-data maxima. Requires NO affinity/encoding conversion/expressions; MakeRecord applies requested affinity, so sourcecolumn lengths cannot automatically bound CAST/functions/encoding expansion. Fullserializedpayload upperbound ONLY, never record callcounts/native handle inventory/sorter complete size or admission. Emptytable takes full header allowance, never assumes zero-byte record. Complete NativeRecordMappingVerified/caller/writerflagsFALSE.',
 'Profile fullreader DB-WAL-SHM FD hashes/identities/directory before-after mustmatch. Source wrapper binds fullschema/ENTIRElogicaloriginal/currenttargetFDbyte+inode record. MAIN/WAL tieprofile to schema reader; SHM maychange between readonly observations and is NOT equality proof of scientific content. Target fulltriple mustmatch exact copiedsource or initial detachedbackup. Replaying changedbyte or same-byte inode replacement refuses. No target SQL during wrapper/replay.',
 'These remain source-bound COLLECTOR OBSERVATIONS. Neither report maxima/schema/header-to-privateDB contents nor WAL-main semantic association is independently proved without packagedprivateDB bytes. NewReaderCreationAndCallerBinding/preSqlCapacity/builtins/kernelquiescence/runtimebinary/VFS/wholeSQLscratch/fulltransient/physical remain UNVERIFIED. No newcapture CONTENToriginal/package wiring/budget/sourceReview/operator.',
 'Actual NEW LOCAL Python owned-reader observations and pinned Node3.51.2b270 native index-record FULLpayload varint tests run at512/4096/65536 pages. Collector engineversion/sourceID recorded separately, not treated as pinnedNode/Linuxbinary proof. Parent collectsprofile and descriptorbound BEFORE native indexwriter on NEWsynthetic DB, retains full originals. Native counts96 perparametercase not scientific-owner/fullinstaller/callcounter/continuouspeak/VFS/physical proof. Scientific argv/defaultheap/journal-temp settings/transactions/original600clocks/deadlines/signals/quotas unchanged.'
 ]}
assert len(excerpts)==10 and len(files)>=60
p=k/'record-payload-source.json';assert not p.exists();p.write_bytes(canonical(v)+b'\n')
p=k/'kit_frozen.py';s=p.read_text(encoding='utf8');needle="    'kit_ephemeral_btree.py','ephemeral-btree-source.json',";assert s.count(needle)==1;p.write_text(s.replace(needle,needle+"\n    'kit_record_payload.py','record-payload-source.json',"),encoding='utf8',newline='')
for name in ['build_stop_post.py','build_capture_stop_post.py']:
 r=subprocess.run([sys.executable,'-B',str(k/name),'--write-unreviewed-source'],cwd=w,capture_output=True);assert r.returncode==0,r.stderr.decode('utf8','replace')
p=k/'capture-statement-journal-source.json';v=json.loads(p.read_bytes());v['files']={name:pin(k/name) for name in v['files']};p.write_bytes(canonical(v)+b'\n')
for p in k.iterdir():
 if p.is_file() and p.suffix=='.py':ast.parse(p.read_bytes())
record={'fullSourcePins':len(files),'nativeExcerpts':len(excerpts),'proofSha256':sha((k/'record-payload-source.json').read_bytes()),'sourceCopyMaximumPathLengthEstimate':len(str(k/'record-payload-local-retained-fixtures/rec-12345678'))+1+max(map(len,names)),'hooksExecuted':False,'operatorsExecuted':0,'captureCollectorIntegrationImplemented':False}
(h/'sql-record477-entry-0906-once/source-preparation-record.json').write_bytes(canonical(record)+b'\n');print(json.dumps(record))