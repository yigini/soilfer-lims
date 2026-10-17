from pathlib import Path
import ast,json,hashlib,subprocess,sys
w=Path(__file__).resolve().parents[2];k=w/'WP/batch-release-kit-be837974-20261016';h=w/'WP/backlog-resume-20261013';sys.path.insert(0,str(k));from kit_contract import canonical
sha=lambda b:hashlib.sha256(b).hexdigest();first=json.loads((k/'local-tests-reader-checks519-first/verification.json').read_bytes());assert first['exitCode']==1 and first['sourceBefore']==first['sourceAfter'] and len(first['sourceBefore'])==225
p=k/'verify_kit_reader_pragma_checks.py';s=p.read_text(encoding='utf8')
for a,b in [("{deterministic:true},()=>1)","{deterministic:true},(x)=>1)"),("{deterministic:true},()=>{callbacks++;return 1}","{deterministic:true},(x)=>{callbacks++;return 1}")]:
 assert s.count(a)==1,(a,s.count(a));s=s.replace(a,b)
p.write_text(s,encoding='utf8',newline='')
p=k/'reader-pragma-checks-source.json';v=json.loads(p.read_bytes());before=sha(p.read_bytes());v['derivation'].append('First frozen519 full run ONEFAILURE270.571s: NEW test-only CHECK UDF registered zero-argument JavaScript callback but schema calls it with one argument. Native binding correctly refused setup. Changed ONLY test callbacks to explicit one-argument functions after actual closure; no production/source guard relaxed. All225 first source-at-test/full stdout/stderr/verification and failed native setup originals retained. Genuinely NEW full successor required; no focused run.')
p.write_bytes(canonical(v)+b'\n')
for name in ('build_stop_post.py','build_capture_stop_post.py'):
 r=subprocess.run([sys.executable,'-B',str(k/name),'--write-unreviewed-source'],cwd=w,capture_output=True);assert r.returncode==0,r.stderr
p2=k/'capture-statement-journal-source.json';v2=json.loads(p2.read_bytes())
for name in v2['files']:
 raw=(k/name).read_bytes();v2['files'][name]={'bytes':len(raw),'sha256':sha(raw)}
p2.write_bytes(canonical(v2)+b'\n')
for path in k.iterdir():
 if path.is_file() and path.suffix=='.py':ast.parse(path.read_bytes())
r={'firstRunStartedUtc':first['startedUtc'],'firstRunClosedUtc':first['closedUtc'],'firstRunExitCode':1,'firstRunAll225SourcesUnchanged':True,'failure':'NEW test-only CHECK UDF callback arity0 vs SQL call1; native binding correctly refused setup.','repair':'Both test callbacks explicitly accept one argument.','sourceEditAfterClosureOnly':True,'beforeProofSha256':before,'afterProofSha256':sha(p.read_bytes()),'productionGuardRelaxed':False,'hooksExecuted':False}
(h/'reader-checks512-entry-1100-once/fixture-udf-arity-repair-record.json').write_bytes(canonical(r)+b'\n');print(json.dumps(r))
