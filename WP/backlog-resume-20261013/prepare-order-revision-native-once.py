import ast,hashlib,json,pathlib,re,sqlite3,subprocess,sys
w=pathlib.Path(__file__).resolve().parents[2];k=w/'WP/batch-release-kit-be837974-20261016'
assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=w,text=True).strip()=='86675b5f8659e6c6533b2ab7ffae9441749ebae2'
sys.path.insert(0,str(k));from kit_contract import canonical
sha=lambda b:hashlib.sha256(b).hexdigest()
def pin(p):
 b=p.read_bytes();return {'bytes':len(b),'sha256':sha(b)}
a=json.loads((k/'readonly-target-wal-source.json').read_bytes());base=json.loads((k/'wal-source-binding-source.json').read_bytes())
head=a['applicationHead'];ddl_path='server/prisma/migrations/20261014000100_order_revision_contract/migration.sql'
raw=subprocess.check_output(['git','show',head+':'+ddl_path],cwd=w);ddl=raw.decode();assert ddl==a['applicationSourceText'][ddl_path]
assert sha(raw)=='5c51f423689b1c726e16c12cdce7b381574661017cdb622eb3f562957a18304c'
for name in a['applicationGitBlobs']:
 b=subprocess.check_output(['git','show',head+':'+name],cwd=w);assert b==a['applicationSourceText'][name].encode()
objects=[{'name':m[0],'type':'index','sql':m[1]} for m in re.findall(r'^(CREATE INDEX "([^"]+)"[^;]*;)',ddl,re.M)] if False else []
for m in re.finditer(r'^CREATE INDEX "([^"]+)"[^;]*;',ddl,re.M):objects.append({'name':m[1],'type':'index','sql':m[0]})
for m in re.finditer(r'^CREATE TRIGGER "([^"]+)"[\s\S]*?^END;',ddl,re.M):objects.append({'name':m[1],'type':'trigger','sql':m[0]})
assert len(objects)==6 and sum(o['type']=='index' for o in objects)==1
statements=[];buffer=''
for line in ddl.splitlines(keepends=True):
 buffer+=line
 if sqlite3.complete_statement(buffer):statements.append(buffer);buffer=''
assert not buffer.strip() and len(statements)==7
receipt={'sourceSha256':sha(raw),'originalRowsSha256':'0'*64,'originalRowsPreserved':True,'backfilledCount':0}
receipt['receiptSha256']=sha(json.dumps(receipt,separators=(',',':')).encode());receipt_bytes=len(json.dumps(receipt,separators=(',',':')).encode())
names=set(base['files']);names.add((k/'kit_order_revision_native.py').relative_to(w).as_posix())
files={name:pin(w/name) for name in sorted(names)}
p=w/'server/node_modules/better-sqlite3/deps/sqlite3/sqlite3.c';raw=p.read_bytes();assert sha(raw)==base['nativeSource']['sha256']
lines=raw.splitlines(keepends=True);offsets=[0]
for line in lines:offsets.append(offsets[-1]+len(line))
ranges=[('alter_checks_no_backfill',119460,119514),('alter_schema_update',119517,119575),
 ('alter_reload_cookie',119218,119229),('populated_index_setup',128102,128147),
 ('populated_index_refill',128148,128210),('index_key_record',131678,131733),
 ('index_column_load',115768,115785),('missing_column_null',98449,98461),
 ('normal_index_insert',101858,101885),('foreign_keys_flag_only',143717,143759),
 ('schema_cookie',126392,126398),('metadata_write',82870,82892),('index_payload_header',101842,101857)]
excerpts=[]
for label,first,last in ranges:
 part=raw[offsets[first-1]:offsets[last]];excerpts.append({'label':label,'firstLine':first,'lastLine':last,
 'startByte':offsets[first-1],'endByte':offsets[last],'bytes':len(part),'sha256':sha(part),'text':part.decode()})
marker='209_order_revision_contract'
v={'version':1,'scope':'CONDITIONAL_STRICT_PRE209_ALTER_AND_EXISTING_ROW_INDEX_NATIVE_WRITES',
 'applicationHead':head,'applicationGitBlobs':a['applicationGitBlobs'],'applicationSourceContainer':'readonly-target-wal-source.json',
 'ddlPath':ddl_path,'ddlSql':ddl,'ddlSha256':sha(ddl.encode()),'statements':statements,'releaseObjects':objects,
 'appendedColumnSql':'"workItemId" TEXT','receiptFixture':receipt,'receiptJsonBytes':receipt_bytes,
 'maximumReceiptTablePayloadBytes':len(marker)+19+receipt_bytes+128,'maximumReceiptIndexPayloadBytes':len(marker)+128,
 'files':files,'nativeSource':{'path':p.relative_to(w).as_posix(),**pin(p)},'nativeExcerpts':excerpts,
 'collectorBindingImplemented':False,'writerGraphAdmissionImplemented':False,'runtimeBinaryToSourceBindingVerified':False,
 'derivation':[
 'Exact209 --apply/no startupContext first classifies on policy retained readonly copy; prerequisites and all original-target hashes precede fresh writable target handle. Whole alternate-copy handles/scratch remain separate. Existing COMPLETE and FRESH_PRISMA paths are NOT this strict PRE profile.',
 'Exact foreign_keys=ON changes handle flags/statement expiration, not database pages. Single immediate transaction reclassifies; all original rows snapshotted before exact7-DDL exec. Every source error exits transaction/binding rollback then closes; no continued forward SQL after rollback/error/retry.',
 'ALTER adds ONLY nullable TEXT workItemId with no default/FK/generated/unique/PK constraint. Native nested UPDATE matches exactly the existing OrderLine TABLE schema row; one normal schema overwrite plus one conservative native Delete is counted. No application data row backfill or root rebuild. Reload increments cookie; file-format cookie also conservatively charged. Validation queries are reads; no all-schema quote-fix rename path called by ADD COLUMN.',
 'One new ordinary nonunique nonpartial index root plus six new schema records (one index/five triggers). Every EXISTING OrderLine row contributes ONE key through native sorter/refill loop/OP_IdxInsert -> normal sqlite3BtreeInsert; never preformatted or transfer path. Do not substitute SQL count or assume new-table emptiness.',
 'Strict original OrderLine is a rowid table with no workItemId or SQL comments; WITHOUT ROWID/new-column/FRESH/partial/colliding profiles refuse. Added column is absent from every pre-existing row record and has NULL default, so every key is NULL plus builtin signed64 rowid.32 bytes conservatively cover FULL serialized key including record header and8-byte integer. Long ordinary old row payloads are not copied into the new index.',
 'Complete unfiltered schema bounds old OrderLine SQL UTF8 bytes+512 and new schema record by max(old SQL+comma/column bytes, WHOLE migration DDL bytes)+512. Six new schema records and own existing schema overwrite use normal insertion; one receipt table row+sole PK index insertion separately counted. Exact ordinary receipt table/default/sole implicit PK index only; extra triggers/indexes/FK/generated/default profiles refuse.',
 'Total normal native calls=OrderLineRows+9, roots1, conservative deletes1. Exact seven DDL plus receipt=8 SQL write statements bound statement starts ONLY. Charge3 metadata writes perDDL and one empty-root clear extra; copied native dirty arithmetic expands every separate mutation with old controlled schema overflow, allnew overflow/local/balance/re-dirty marks and possible synthetic commit page1.',
 'Complete source-bound collector wrapper binds preceding capture-prepared-214 full schema/logical-state original and target full DB/WAL/SHM hash/descriptor observations. Row count declaration alone does not verify collector or scientific readiness; actual classifier must prove receipt marker absence and all prerequisites. NonemptySHM/index/intactsource/kernel locks/quiescence/runtime/VFS/writer/MAINcheckpoint/sorter-scratch/physical remain unclosed.',
 'Default scientific argv/heap/journal/temp settings/transactions600clocks/deadlines/signals/quotas unchanged. Native SQL samples/unmodified module with explicit prerequisite/source projections are LOCAL tests, not full scientific owner/full installer/Linux execution. No capacity hold, native preflight, package controls, budget or operator admission added; oversized complete frame/WAL plans REFUSE/neverclip.'
 ]}
p=k/'order-revision-native-source.json';assert not p.exists();p.write_bytes(canonical(v)+b'\n')
p=k/'kit_frozen.py';s=p.read_text();needle="    'kit_wal_source_binding.py','wal-source-binding-source.json',";assert s.count(needle)==1
p.write_text(s.replace(needle,needle+"\n    'kit_order_revision_native.py','order-revision-native-source.json',"),encoding='utf8',newline='')
for name in ['build_stop_post.py','build_capture_stop_post.py']:
 r=subprocess.run([sys.executable,'-B',str(k/name),'--write-unreviewed-source'],cwd=w,capture_output=True);assert r.returncode==0,r.stderr.decode('utf8','replace')
p=k/'capture-statement-journal-source.json';v=json.loads(p.read_bytes());v['files']={n:pin(k/n) for n in v['files']};p.write_bytes(canonical(v)+b'\n')
for p in k.iterdir():
 if p.is_file() and p.suffix=='.py':ast.parse(p.read_bytes())
print(json.dumps({'fullSourcePins':len(files),'rawApplicationBlobs':len(a['applicationGitBlobs']),'nativeExcerpts':len(excerpts),
 'receiptJsonBytes':receipt_bytes,'proofSha256':sha((k/'order-revision-native-source.json').read_bytes()),'hooksExecuted':False,'operatorsExecuted':0}))
