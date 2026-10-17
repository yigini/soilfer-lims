import ast,hashlib,json,pathlib,subprocess,sys
w=pathlib.Path(__file__).resolve().parents[2];k=w/'WP/batch-release-kit-be837974-20261016'
assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=w,text=True).strip()=='05d6e2f7c43cbe81be588b9606518f3560595020'
sys.path.insert(0,str(k));from kit_contract import canonical
sha=lambda b:hashlib.sha256(b).hexdigest()
def pin(p):
 b=p.read_bytes();return {'bytes':len(b),'sha256':sha(b)}
dirty=json.loads((k/'wal-dirty-inventory-source.json').read_bytes());collector=json.loads((k/'schema-collection-source.json').read_bytes())
names=set(dirty['files']);names.update((k/name).relative_to(w).as_posix() for name in collector['files'])
for name in ('kit_wal_source_binding.py','wal-dirty-inventory-source.json','schema-collection-source.json'):
 names.add((k/name).relative_to(w).as_posix())
files={name:pin(w/name) for name in sorted(names)}
p=w/'server/node_modules/better-sqlite3/deps/sqlite3/sqlite3.c';raw=p.read_bytes();assert sha(raw)==dirty['nativeSource']['sha256']
lines=raw.splitlines(keepends=True);offsets=[0]
for line in lines:offsets.append(offsets[-1]+len(line))
ranges=[('version_and_locks',67027,67056),('headers',67078,67090),('checkpoint_fields',67151,67158),
 ('header_size',67227,67233),('hash_slot_type',67325,67334),('hash_constants',67365,67386),
 ('two_header_checksums',67693,67711),('hash_function',67884,67896),('region_layout',67924,67961),
 ('append_and_zero_unused',68048,68095),('recovery_zero_header',68141,68168),
 ('recovery_wal_header',68191,68225),('recovery_frames',68239,68290),('recovery_checkpoint',68317,68346),
 ('format_size_assertions',68418,68434)]
excerpts=[]
for label,first,last in ranges:
 part=raw[offsets[first-1]:offsets[last]];excerpts.append({'label':label,'firstLine':first,'lastLine':last,'startByte':offsets[first-1],
  'endByte':offsets[last],'bytes':len(part),'sha256':sha(part),'text':part.decode('utf8')})
proof={'version':1,'scope':'SOURCE_BOUND_SCHEMA_AND_STRICT_FRESH_WAL_INDEX_BYTES','files':files,
 'nativeSource':{'path':p.relative_to(w).as_posix(),**pin(p)},'nativeExcerpts':excerpts,
 'fullSchemaCollectorProofSha256':sha((k/'schema-collection-source.json').read_bytes()),
 'conditionalDirtyInventoryProofSha256':sha((k/'wal-dirty-inventory-source.json').read_bytes()),
 'maxCompleteWalOriginalBytes':64*1024**2,'maxCompleteIndexOriginalBytes':16*1024**2,
 'nativeRecoveryExecutionVerified':False,'writerGraphAdmissionImplemented':False,'runtimeBinaryToSourceBindingVerified':False,
 'derivation':[
 'Existing source-pinned full schema collector runs on a NEW owned readonly reader with integrity/FK/logical fingerprint checks in the SAME transaction and verifies a detached backup. Bind exact canonical logical-state original and every full source DB/WAL/SHM byte identity to the restricted target dirty plan; raw/live masters never opened with SQL by collector or plan.',
 'This binds SOURCE-BOUND COLLECTOR OBSERVATIONS, not independent private DB contents, integrity or semantic WAL association. Matching JSON/hashes grant no writer/release authority. Target nonemptySHM still refuses via unchanged WAL planner.',
 'Separate pure fresh-index checker validates entire bounded WAL CRC/committed extent then BOTH48-byte native-order index header copies/version3007000/init1/change0/page encoding/final frame checksum/raw8salt/headerchecksum. Native index byte order is a required DECLARATION, never inferred Linux/runtime evidence.',
 'Fresh recovery sets backfill0, backfillAttempted=mxFrame, readMark0=0/readMark1=mxFrame/othersFFFFFFFF under its own locks. Require exact fresh checkpoint byte profile/reserved bytes0, and no prior/new writer/change or checkpoint. Byte consistency cannot prove that recovery or kernel locks actually occurred.',
 'Reconstruct EVERY page-number mapping and EVERY open-addressed hash slot using page*383 modulo8192 and linear probes, including repeated/colliding page IDs and zeros in all unused bytes. First32KiB region has136header+4062u32 page entries+8192u16hash slots; later regions4096u32+8192u16. Exact complete region count required, surplus/partial/stale/tail mappings refuse.',
 'Descriptor-pair observer checks canonical exact sibling WAL/SHM names/independent one-link regular files/same device/full byte hashes/descriptors/file+directory metadata before and after. Same-byte inode substitution refuses replay. It does not open/observe MAIN or establish WAL-to-main semantic association.',
 '64MiB complete WAL and16MiB complete index proof envelopes are STRICT input limits; larger proofs refuse without omitted bytes. No file producer, SQL/pragma, held capacity, routing, native preflight, package admission or physical/VFS bound is added. Native byte observations and synthetic endianness vectors do not attest Linux binary/VFS or kernel locks.'
 ]}
out=k/'wal-source-binding-source.json';assert not out.exists();out.write_bytes(canonical(proof)+b'\n')
p=k/'kit_frozen.py';s=p.read_text();needle="    'kit_wal_dirty_inventory.py','wal-dirty-inventory-source.json',";assert s.count(needle)==1
p.write_text(s.replace(needle,needle+"\n    'kit_wal_source_binding.py','wal-source-binding-source.json',"),encoding='utf8',newline='')
for build in ['build_stop_post.py','build_capture_stop_post.py']:
 r=subprocess.run([sys.executable,'-B',str(k/build),'--write-unreviewed-source'],cwd=w,capture_output=True)
 assert r.returncode==0,r.stderr.decode('utf8','replace')
p=k/'capture-statement-journal-source.json';v=json.loads(p.read_bytes());v['files']={n:pin(k/n) for n in v['files']};p.write_bytes(canonical(v)+b'\n')
for p in k.iterdir():
 if p.is_file() and p.suffix=='.py':ast.parse(p.read_bytes())
print(json.dumps({'sourcePins':len(files),'nativeExcerpts':len(excerpts),'proofSha256':sha(out.read_bytes()),'hooksExecuted':False,'operatorsExecuted':0}))
