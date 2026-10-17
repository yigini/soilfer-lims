"""ONCE make the native fixture require pre-statement page versions."""
from pathlib import Path
import json,ast,hashlib
W=Path(__file__).resolve().parents[2];K=W/'WP/batch-release-kit-be837974-20261016'
p=K/'verify_kit_statement_journal.py';raw=p.read_bytes()
old=b"'createdRoots':0,'normalInsertions':[{'calls':96,'maximumPayloadBytes':16384}], 'deletions':96}";assert raw.count(old)==1;raw=raw.replace(old,b"'createdRoots':0,'normalInsertions':[{'calls':192,'maximumPayloadBytes':16384}], 'deletions':192}")
old=b"const sql='UPDATE payload SET value=sample(value)',program=db.prepare('EXPLAIN '+sql).all();let rolled=false;";assert raw.count(old)==1
new=b"const priorSql='UPDATE payload SET value=?',priorValue=Buffer.alloc(8192,10);\n        const priorProgram=db.prepare('EXPLAIN '+priorSql).all(priorValue);\n        const sql='UPDATE payload SET value=sample(value)',program=db.prepare('EXPLAIN '+sql).all();let rolled=false;"
raw=raw.replace(old,new)
old=b"db.transaction(()=>{db.prepare(sql).run();if(mode==='rollback')throw Error('LOCAL_ROLLBACK');}).immediate();";assert raw.count(old)==1
raw=raw.replace(old,b"db.transaction(()=>{db.prepare(priorSql).run(priorValue);db.prepare(sql).run();if(mode==='rollback')throw Error('LOCAL_ROLLBACK');}).immediate();")
old=b"const result={program,samples,rolled,rows:";assert raw.count(old)==1;raw=raw.replace(old,b"const result={program,priorProgram,samples,rolled,priorWriteStatementExecuted:true,rows:")
old=b"operations(),statement.declared_statements(1))";assert raw.count(old)==1;raw=raw.replace(old,b"operations(),statement.declared_statements(2))")
old=b"for op in row['program']))";assert raw.count(old)==1;raw=raw.replace(old,b"for op in row['program']+row['priorProgram']))")
p.write_bytes(raw);ast.parse(raw)
p=K/'statement-journal-source.json';value=json.loads(p.read_bytes());assert not any(x['label']=='main_journal_also_sets_savepoint_bits' for x in value['nativeExcerpts'])
native=(W/value['nativeSource']['path']).read_bytes();lines=native.splitlines(keepends=True);a,b=64950,64957;start=sum(map(len,lines[:a-1]));end=start+sum(map(len,lines[a-1:b]));assert b'addToSavepointBitvecs' in native[start:end]
value['nativeExcerpts'].append({'label':'main_journal_also_sets_savepoint_bits','startLine':a,'endLine':b,'startByte':start,'endByte':end,'text':native[start:end].decode()})
value['derivation'].append('The first rollback-journal write also sets open savepoint bits. A first update can therefore need no subjournal. The native positive-spill fixture first performs a successful write statement, then modifies the same pages again inside the SAME transaction, so pre-second-statement versions differ from the original main-journal versions. BOTH statements/all attempted native writes are counted; positive observed-file assertions remain mandatory.')
p.write_text(json.dumps(value,sort_keys=True,indent=2)+'\n',encoding='utf8',newline='\n')
print(json.dumps({'nativeStatementStartsInSpillFixture':2,'declaredNativeInsertMaximum':192,'declaredNativeDeleteMaximum':192,'nativeExcerpts':len(value['nativeExcerpts']),'positiveSpillAndFullRecordAssertionsPreserved':True,'proofSha256':hashlib.sha256(p.read_bytes()).hexdigest(),'operatorsExecuted':0}))