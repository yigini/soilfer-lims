from pathlib import Path
import ast,json
w=Path(__file__).resolve().parents[2];h=w/'WP/backlog-resume-20261013';target=h/'publish-kit-reader-checks519-arity-successor-once.py';assert not target.exists()
s=(h/'publish-kit-reader-checks519-once.py').read_text(encoding='utf8')
def once(a,b):
 global s
 assert s.count(a)==1,(a,s.count(a));s=s.replace(a,b)
once("with_name('reader-checks519-publication-notes-once.txt')","with_name('reader-checks519-arity-successor-publication-notes-once.txt')")
once("D=K/'reader-checks519-publication-once'","D=K/'reader-checks519-arity-successor-publication-once'")
once("runs=['reader-checks519-first']","runs=['reader-checks519-first','reader-checks519-second']")
once("zip(runs,[0],[519],[225],['OK'])","zip(runs,[1,0],[519,519],[225,225],['FAILED (failures=1)','OK'])")
a="""    if path.parent.name in ('setup','checks','hazard') and path.name in ('stdout-original.json','exit-original.json'):
     case=reader_checks_cases.setdefault(path.parent.parent.relative_to(K).as_posix(),{})
     case[path.parent.name+'/'+path.name]={'path':relative,'bytes':len(raw),'sha256':sha(raw),'value':json.loads(raw)}"""
b="""    if path.parent.name in ('setup','checks','hazard') and path.name in ('stdout-original.json','exit-original.json','stderr-original.txt'):
     case=reader_checks_cases.setdefault(path.parent.parent.relative_to(K).as_posix(),{})
     case[path.parent.name+'/'+path.name]={'path':relative,'bytes':len(raw),'sha256':sha(raw),'value':json.loads(raw) if path.name.endswith('.json') and raw.strip() else None}"""
once(a,b)
once("plain_check_rows=[];check_hazard_rows=[]","plain_check_rows=[];check_hazard_rows=[];failed_check_setups=[]")
once("for folder,case in sorted(reader_checks_cases.items()):","""for folder,case in sorted(reader_checks_cases.items()):
 if 'setup/exit-original.json' in case and case['setup/exit-original.json']['value']['exitCode']!=0:
  assert case['setup/exit-original.json']['value']['exitCode']==1 and case['setup/stdout-original.json']['value'] is None
  assert 'checks/stdout-original.json' not in case and 'hazard/stdout-original.json' not in case
  failed_check_setups.append({'folder':folder,'stdoutOriginal':original_pin(case['setup/stdout-original.json']),'stderrOriginal':original_pin(case['setup/stderr-original.txt']),'exitOriginal':original_pin(case['setup/exit-original.json']),'exitCode':1,'completedPragmaCase':False,'failure':'Test-only CHECK UDF callback declared arity0, SQL calls arity1.','guardRelaxed':False})""")
once("len(check_hazard_rows)==3*len(runs)","len(check_hazard_rows)==3 and len(failed_check_setups)==1")
once("'nativeLocalCommandExecutions':18*len(runs)","'nativeLocalCommandExecutions':2*(len(plain_check_rows)+len(check_hazard_rows))+len(failed_check_setups)")
once("'readonlyExpressionHazardCases':check_hazard_rows,","'readonlyExpressionHazardCases':check_hazard_rows,'failedNewFixtureSetups':failed_check_setups,")
once("'readonlyExpressionHazardNativeCases':len(check_hazard_rows),","'readonlyExpressionHazardNativeCases':len(check_hazard_rows),'failedNewCheckFixtureSetups':len(failed_check_setups),")
once("for name in ['prepare-reader-pragma-checks-source-once.py','prepare-reader-checks-publication-once.py','prepare-reader-checks-publication-count-successor-once.py','reader-checks519-publication-notes-once.txt']:","for name in ['prepare-reader-pragma-checks-source-once.py','prepare-reader-checks-publication-once.py','prepare-reader-checks-publication-count-successor-once.py','reader-checks519-publication-notes-once.txt','repair-reader-check-fixture-udf-arity-once.py','prepare-reader-checks-arity-successor-publication-once.py','reader-checks519-arity-successor-publication-notes-once.txt','publish-kit-reader-checks519-once.py']:")
ast.parse(s);target.write_text(s,encoding='utf8',newline='')
p=h/'reader-checks519-publication-notes-once.txt';notes=p.read_text(encoding='utf8')
notes=notes.replace('reader-checks519-publication-once','reader-checks519-arity-successor-publication-once')
a='SOLE frozen {summary}; start {started}; closed {closed}; ALL225 sources unchanged, README only after actual closure. Full original stdout/stderr/verification/ALL225 source-at-test retained in local-tests-reader-checks519-first. No failed/focused/other run.'
b='FINAL frozen {summary}; start {started}; closed {closed}; ALL225 sources unchanged, README only after actual closure. First full519 ONEFAILURE270.571s/start2026-10-17T11:11:00.911599+00:00/closed11:15:32.087631+00:00/ALL225 unchanged: NEW test-only CHECK UDF callback declared zero arguments but schema calls one; native binding correctly refused setup. Changed ONLY both test callbacks to explicit one-argument functions after closure, rebound proof/hooks, launched genuinely NEW full successor. No guard relaxed. BOTH complete original stdout/stderr/verification/ALL225 source-at-test retained in local-tests-reader-checks519-first and-second, including failed setup originals. No focused/other run.'
assert notes.count(a)==1;notes=notes.replace(a,b)
a='Six plain native parameter cases including3 valid and3 intentionally bad FK diagnostic cases, plus3 expression/callback hazard cases:9 case executions/18 Node commands including9 setup/3 unchanged Python logical invocations/39 direct native PRAGMAs, not9 unique tests.'
b='Six plain native parameter cases PER full run:12 plain executions across BOTH runs including6 valid/6 intentional FK-diagnostic cases; plus3 completed expression/callback hazards in final run and1 refused NEW setup in first.15 completed case executions/31 Node commands including16 setup/6 unchanged Python logical invocations/75 direct native PRAGMAs, not15 unique tests. Failed setup is explicitly retained and is NOT a completed hazard case.'
assert notes.count(a)==1;notes=notes.replace(a,b)
a='H/prepare-reader-pragma-checks-source-once.py,prepare-reader-checks-publication-once.py,prepare-reader-checks-publication-count-successor-once.py,publish-kit-reader-checks519-once.py CONSUMED NEVER REPLAY.'
b='H/prepare-reader-pragma-checks-source-once.py,prepare-reader-checks-publication-once.py,prepare-reader-checks-publication-count-successor-once.py,repair-reader-check-fixture-udf-arity-once.py,prepare-reader-checks-arity-successor-publication-once.py,publish-kit-reader-checks519-arity-successor-once.py CONSUMED NEVER REPLAY. Prepared publish-kit-reader-checks519-once.py NEVER EXECUTED/superseded/NEVER EXECUTE.'
assert notes.count(a)==1;notes=notes.replace(a,b)
(h/'reader-checks519-arity-successor-publication-notes-once.txt').write_text(notes,encoding='utf8',newline='')
print(json.dumps({'publisherPrepared':str(target),'executed':False,'first519FailureOriginalsPreserved':True,'sourceChangedDuringFrozenRun':False}))
