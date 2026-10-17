from pathlib import Path
import ast
h=Path(__file__).resolve().parent;p=h/'publish-kit-reader-schema505-constant-successor-once.py';assert not p.exists()
s=(h/'publish-kit-reader-schema505-once.py').read_text(encoding='utf8')
changes=[
('reader-schema505-publication-notes-once.txt','reader-schema505-constant-successor-publication-notes-once.txt'),
("D=K/'reader-schema505-publication-once'","D=K/'reader-schema505-constant-successor-publication-once'"),
("runs=['reader-schema505-first']","runs=['reader-schema505-first','reader-schema505-second']"),
("zip(runs,[0],[505],[219],['OK'])","zip(runs,[1,0],[505,505],[219,219],['FAILED (failures=1)','OK'])"),
("assert len(rows)==8 and sum(r['mode']=='rollback' for r in rows)==3","assert len(rows)==8*len(runs) and sum(r['mode']=='rollback' for r in rows)==3*len(runs)"),
("'completedFullRunExactAlterIndexCases':6,'completedFullRunExpressionUdfSorterCases':2","'completedFullRunExactAlterIndexCases':6*len(runs),'completedFullRunExpressionUdfSorterCases':2*len(runs)"),
('assert len(unix_rows)==len(unix_analogs)==1','assert len(unix_rows)==len(unix_analogs)==len(runs)'),
("assert len(ephemeral_rows)==7 and sum(r['kind']=='RAW_ORDER_STATUS_RHS' for r in ephemeral_rows)==1","assert len(ephemeral_rows)==7*len(runs) and sum(r['kind']=='RAW_ORDER_STATUS_RHS' for r in ephemeral_rows)==len(runs)"),
("'materializationCaseExecutions':6,'rawOrderStatusQueryCaseExecutions':1","'materializationCaseExecutions':6*len(runs),'rawOrderStatusQueryCaseExecutions':len(runs)"),
('assert len(record_rows)==3 and','assert len(record_rows)==3*len(runs) and'),
('assert len(general_rows)==3 and','assert len(general_rows)==3*len(runs) and'),
("{'parameterCases':3,'nativeLocalCommandExecutions':6,","{'parameterCasesPerRun':3,'parameterCaseExecutions':3*len(runs),'nativeLocalCommandExecutions':6*len(runs),"),
('assert len(fingerprint_rows)==6 and','assert len(fingerprint_rows)==6*len(runs) and'),
("sum(r['partialOrder'] for r in fingerprint_rows)==3","sum(r['partialOrder'] for r in fingerprint_rows)==3*len(runs)"),
("{'parameterCases':6,'nativeLocalCommandExecutions':12,'pythonFutureFingerprintInvocations':6,","{'parameterCasesPerRun':6,'parameterCaseExecutions':6*len(runs),'nativeLocalCommandExecutions':12*len(runs),'pythonFutureFingerprintInvocations':6*len(runs),"),
("assert len(reader_schema_rows)==6 and sum(r['fullSchemaRequested'] for r in reader_schema_rows)==3","assert len(reader_schema_rows)==6*len(runs) and sum(r['fullSchemaRequested'] for r in reader_schema_rows)==3*len(runs)"),
('assert len(memory_probes)==1','assert len(memory_probes)==len(runs)'),
("'nativeLocalCommandExecutions':9,","'nativeLocalCommandExecutions':9*len(runs),"),
("'rawPythonLogicalInvocations':6,","'rawPythonLogicalInvocations':6*len(runs),"),
("'readerSchemaCallerFunctions':3,","'readerSchemaCallerFunctions':3,'readerSchemaGlobalConstants':1,"),
("'prepare-reader-schema-publication-count-successor-once.py','reader-schema505-constant-successor-publication-notes-once.txt'","'prepare-reader-schema-publication-count-successor-once.py','repair-reader-schema-global-constant-once.py','prepare-reader-schema-constant-successor-publication-once.py','reader-schema505-constant-successor-publication-notes-once.txt'")]
for a,b in changes:
 assert a in s,a;s=s.replace(a,b)
ast.parse(s);p.write_text(s,encoding='utf8',newline='')
notes=(h/'reader-schema505-publication-notes-once.txt').read_text(encoding='utf8')
notes=notes.replace('reader-schema505-publication-once','reader-schema505-constant-successor-publication-once')
notes=notes.replace('SOLE frozen {summary};','FINAL frozen {summary};')
notes=notes.replace('in local-tests-reader-schema505-first. No failed/focused/other test run.','in local-tests-reader-schema505-second. First full505 run ONEFAILURE257.795s/start2026-10-17T10:25:45.447596Z/closed10:30:03.768787Z/ALL219 unchanged: NEW test incorrectly searched for the full schema SQL literal inside function excerpts; actual function uses module-global FULL_SCHEMA_SQL. Entire collector source was already hash-pinned. Added exact AST global-constant byte excerpt and corrected only this test assertion before final full successor. BOTH complete original streams/verification/ALL219 source-at-test retained in local-tests-reader-schema505-first and-second. No focused/other test run; no production guard or caller setting changed.')
notes=notes.replace('3 complete actual Python caller functions/full3.51.2b270','3 complete actual Python caller functions+1 exact module-global SQL constant/full3.51.2b270')
notes=notes.replace('Six NEW local parameter executions,9 Node commands including3 setup commands,6 raw Python logical invocations,15 exact native schema SELECT executions.','Six parameter cases PER full run,12 NEW local case executions/18 Node commands including6 setup commands/12 raw Python logical invocations/30 exact native schema SELECT executions across BOTH runs. These are case executions, not12 unique tests.')
notes=notes.replace('publish-kit-reader-schema505-once.py CONSUMED NEVER REPLAY.','repair-reader-schema-global-constant-once.py,prepare-reader-schema-constant-successor-publication-once.py,publish-kit-reader-schema505-constant-successor-once.py CONSUMED NEVER REPLAY. Prepared publish-kit-reader-schema505-once.py NEVER EXECUTED/superseded/NEVER EXECUTE. Its public source was used as template only.')
notes=notes.replace('NEXT ACTUALLY close implicit initial schema initialization','NEXT ACTUALLY close implicit initial schema initialization (pinned sqlite3InitOne SELECT*FROM quoted schema table ORDER BY rowid and subsequent sqlite3AnalysisLoad are retained in entry next-source worklist; exact ordering relative to compile_options/temp_store remains UNPROVED)')
pnotes=h/'reader-schema505-constant-successor-publication-notes-once.txt';assert not pnotes.exists();pnotes.write_text(notes,encoding='utf8',newline='')
print('Prepared distinct two-run constant-successor publisher and notes; no publisher executed')
