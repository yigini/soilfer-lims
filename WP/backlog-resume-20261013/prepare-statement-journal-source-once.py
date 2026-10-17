"""ONCE build conditional statement-journal source proof; no operator."""
from pathlib import Path
import json,hashlib,subprocess,sqlite3,ast
W=Path(__file__).resolve().parents[2];K=W/'WP/batch-release-kit-be837974-20261016';out=K/'statement-journal-source.json';assert not out.exists()
assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=W).decode().strip()=='66b04f97814c700a57903c1b93b75f17cb9ebd89'
sha=lambda raw:hashlib.sha256(raw).hexdigest()
caller_raw=(K/'capture-writer-journal-source.json').read_bytes();caller=json.loads(caller_raw)
inventory=json.loads((K/'capture-native-inventory-source.json').read_bytes());profiles={}
for label,expected in [('capture-206-prepare',10),('capture-214-prepare',24)]:
 p=inventory['profiles'][label];raw=subprocess.check_output(['git','show','be837974:'+p['ddlPath']],cwd=W);assert sha(raw)==p['ddlSha256'];parts=[];pending=''
 for char in raw.decode():
  pending+=char
  if char==';' and sqlite3.complete_statement(pending):parts.append(pending);pending=''
 assert not pending.strip() and len(parts)+1==expected
 profiles[label]={'ddlPath':p['ddlPath'],'ddlSha256':sha(raw),'ddlGitBlobOid':hashlib.sha1(('blob '+str(len(raw))+'\0').encode()+raw).hexdigest(),'ddlStatements':parts,'receiptStatement':'INSERT INTO _schema_migrations(id,details) VALUES(?,?)','receiptMarker':p['receiptMarker'],'maximumStatementStarts':expected,'implicitStatementSavepointsSimultaneous':1,'explicitSavepoints':False}
files={W/name for name in caller['files'] if name.startswith('server/node_modules/')}
for name in ('kit_statement_journal.py','kit_main_mutations.py','kit_main_growth.py','kit_rollback_journal.py','kit_contract.py','kit_copy_admission.py','retained_contract.py','retained_files.py','kit_schema_collection.py','schema-collection-source.json','kit_capture_native_inventory.py','capture-native-inventory-source.json','capture-writer-journal-source.json'):
 files.add(K/name)
bindings={p.relative_to(W).as_posix():{'bytes':len(p.read_bytes()),'sha256':sha(p.read_bytes())} for p in sorted(files)}
p='server/node_modules/better-sqlite3/deps/sqlite3/sqlite3.c';native=(W/p).read_bytes();assert sha(native)=='2bbdd0eff3f46852e954d7881b7945990bf78c1421f806cf7978bc22e187100a';lines=native.splitlines(keepends=True)
ranges=[('stmt_spill_default',23594,23601),('stmt_spill_global',23645,23651),('subj_requires_page',59988,60003),('savepoint_bitvec_update',60727,60743),('release_all',60707,60724),('open_subjournal',63432,63453),('record_format_and_bitvec',63455,63507),('savepoint_old_pages',65862,65879),('release_truncation',65937,65964),('btree_begin_stmt',76997,77012),('statement_use_flag',89499,89508),('close_statement',90035,90055),('transaction_statement_gate',99360,99383),('transaction_savepoint_open',99428,99449),('transaction_p5_cookie_not_journal',124554,124565),('spill_copy_prefix',108545,108567),('mem_journal_write',108587,108620),('mem_journal_open',108745,108785),('unix_temp_unlink',45915,45937)]
excerpts=[]
for label,a,b in ranges:
 start=sum(map(len,lines[:a-1]));end=start+sum(map(len,lines[a-1:b]));excerpts.append({'label':label,'startLine':a,'endLine':b,'startByte':start,'endByte':end,'text':native[start:end].decode()})
value={'version':1,'scope':'CONDITIONAL_FORWARD_STATEMENT_JOURNAL_CONTENT','captureStatementStarts':{'capture-206-prepare':10,'capture-214-prepare':24},'completeRestrictedCaptureStatementInventory':True,'nativeSource':{'path':p,'bytes':len(native),'sha256':sha(native)},'files':bindings,'nativeExcerpts':excerpts,'profiles':profiles,'mainJournalCallerProofSha256':sha(caller_raw),'applicationSourcePins':{name:pin for name,pin in caller['files'].items() if not name.startswith('server/node_modules/')},'statementJournalLogicalContentBounded':True,'runtimeBinaryToSourceBindingVerified':False,'runtimeDefaultVfsVerified':False,'writerGraphAdmissionImplemented':False,'sqlScratchSizeBounded':False,'physicalFilesystemClosureClaimed':False,
 'derivation':[
  'Complete counted native mutations bound every live logical page count. Separate fixed SQL statement counts bound statement starts only, not B-tree operations. Strict PRE206 has9 explicit DDL statements+1 receipt INSERT; strict PRE214 has23+1. Implicit indexes are not extra SQL statements.',
  'Pinned fresh handle has one top-level immediate transaction, sequential synchronous SQL and no explicit/nested/overlapping savepoints or UDF/extension callbacks. Statement rollback or SQL errors leave the owner; no continued writing/retry is supported. Receipt triggers/index hazards and non-PRE profiles refuse via the separate complete native inventory.',
  'OP_Transaction opens an implicit statement transaction only when usesStmtJournal && writing && nonautocommit/other reader conditions. usesStmtJournal is derived from isMultiWrite&&mayAbort. Transaction P5 is schema-cookie checking, NOT a journal-enabled flag; missing EXPLAIN comments never imply zero journal.',
  'Each implicit savepoint records nOrig=Pager.dbSize and a per-page bitvec. subjRequiresPage requires pgno<=nOrig and an unset bit; successful record writing sets that bit. Without rollback/continued writes, each such page is recorded at most once for the statement.',
  'Subjournal content uses nSubRec*(P+4): four-byte page number followed by exactly P bytes, with no rollback-journal headers/sector padding. Nmax*(P+4) per possible forward SQL statement is a conservative content-write charge.',
  'All possible statement content writes are summed without taking truncation, offset reuse, file close/delete, previous-page, rollback or memory buffering credit. A retained/reused single physical file is bounded by the full cumulative sum, not one-statement content. At most one journal file creation per statement is charged; aggregate rounded charges cover any grouping of consecutive statements.',
  'Default nStmtSpill is64KiB in the pinned source, but no memory-only claim or threshold credit is used. sqlite3JournalCreate can force a file independently of the automatic positive-threshold spill. MemJournal prefix copying and subsequent appends stay within written logical offsets.',
  'This is LOGICAL CONTENT only. VFS/chunk/mmap/preallocation/default compiled-runtime binding/physical blocks remain separate and unproved. Source-bound collector wrapper still does not independently prove private DB content. No writer admission or held capacity integration exists for this new primitive.',
  'All SQL sorters/materialized-query temp files, WAL/SHM, full transient originals and continuous peaks remain outside the subjournal content formula; the broader scratch flag remains false.'
 ],'conditions':['Complete native mutation inventory AND separate complete forward write-statement inventory','Intact supported rollback input, no external journal corruption or page moves','At most one implicit statement savepoint; no explicit/overlapping savepoints, callbacks, retries or continued writing after rollback/SQLite error'],
 'officialReferences':['https://www.sqlite.org/tempfiles.html','https://www.sqlite.org/c3ref/c_config_covering_index_scan.html']}
out.write_text(json.dumps(value,sort_keys=True,indent=2)+'\n',encoding='utf8',newline='\n')
f=K/'kit_frozen.py';raw=f.read_bytes();needle=b"    'kit_linux_main_vfs.py','linux-main-vfs-source.json',";assert raw.count(needle)==1;f.write_bytes(raw.replace(needle,needle+b"\n    'kit_statement_journal.py','statement-journal-source.json',"))
for name in ('kit_statement_journal.py','verify_kit_statement_journal.py'):ast.parse((K/name).read_bytes())
print(json.dumps({'sourcesPinned':len(bindings),'nativeExcerpts':len(excerpts),'statementCounts':value['captureStatementStarts'],'proofSha256':sha(out.read_bytes()),'operatorsExecuted':0}))