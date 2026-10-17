"""ONCE source-evidence and meaningful native spill-fixture correction."""
from pathlib import Path
import json,hashlib,ast
W=Path(__file__).resolve().parents[2];K=W/'WP/batch-release-kit-be837974-20261016'
p=K/'statement-journal-source.json';value=json.loads(p.read_bytes());row=next(x for x in value['nativeExcerpts'] if x['label']=='unix_temp_unlink')
native=(W/value['nativeSource']['path']).read_bytes();lines=native.splitlines(keepends=True);a,b=45941,45956;start=sum(map(len,lines[:a-1]));end=start+sum(map(len,lines[a-1:b]));assert b'osUnlink(zName)' in native[start:end]
row.update(label='unix_delete_on_close',startLine=a,endLine=b,startByte=start,endByte=end,text=native[start:end].decode())
p.write_text(json.dumps(value,sort_keys=True,indent=2)+'\n',encoding='utf8',newline='\n')
p=K/'verify_kit_statement_journal.py';raw=p.read_bytes()
old=b"CREATE TABLE payload(id INTEGER PRIMARY KEY,value BLOB)";assert raw.count(old)==1
raw=raw.replace(old,b"CREATE TABLE payload(id INTEGER PRIMARY KEY,value BLOB NOT NULL CHECK(length(value)>0))")
old=b"self.assertGreaterEqual(len(proof['nativeExcerpts']),16)";assert raw.count(old)==1
raw=raw.replace(old,old+b"\n        self.assertIn('osUnlink(zName)',next(x['text'] for x in proof['nativeExcerpts'] if x['label']=='unix_delete_on_close'))")
old=b'// TEST-ONLY small cache and sampling UDF; not the real scientific owner.';assert raw.count(old)==1
raw=raw.replace(old,b'// TEST-ONLY CHECK-constrained table, small cache and sampling UDF; no real scientific owner.')
old=b"self.assertGreater(max(x['bytes'] for x in row['samples']),65536)";assert raw.count(old)==1
raw=raw.replace(old,old+b"\n                self.assertTrue(all(x['bytes']%(size+4)==0 for x in row['samples']))")
p.write_bytes(raw);ast.parse(raw)
print(json.dumps({'nativeExcerptCorrected':True,'positiveNativeSpillAssertionPreserved':True,'fixtureAddsExplicitCheckConstraint':True,'proofSha256':hashlib.sha256((K/'statement-journal-source.json').read_bytes()).hexdigest(),'operatorsExecuted':0}))