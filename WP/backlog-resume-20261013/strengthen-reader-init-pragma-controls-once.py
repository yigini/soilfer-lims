from pathlib import Path
import ast,json,hashlib,subprocess,sys
w=Path(__file__).resolve().parents[2];k=w/'WP/batch-release-kit-be837974-20261016';h=w/'WP/backlog-resume-20261013';sys.path.insert(0,str(k));from kit_contract import canonical
sha=lambda b:hashlib.sha256(b).hexdigest();first=json.loads((k/'local-tests-reader-init512-first/verification.json').read_bytes());assert first['exitCode']==0 and first['sourceBefore']==first['sourceAfter']
p=k/'kit_reader_initialization.py';s=p.read_text(encoding='utf8');needle="    value['pragmaFileControlsReturnNotFoundWithoutSql']=True\n";assert s.count(needle)==1;s=s.replace(needle,needle+"    value['pragmaFileControlsDoNotAccessSchemaOrChangeConnectionState']=True\n");p.write_text(s,encoding='utf8',newline='')
p=k/'verify_kit_reader_initialization.py';s=p.read_text(encoding='utf8');needle="('pragmaFileControlsReturnNotFoundWithoutSql',False),";assert s.count(needle)==1;s=s.replace(needle,needle+"('pragmaFileControlsDoNotAccessSchemaOrChangeConnectionState',False),");p.write_text(s,encoding='utf8',newline='')
p=k/'reader-initialization-source.json';v=json.loads(p.read_bytes());before=sha(p.read_bytes())
for n in v['files']:
 b=(w/n).read_bytes();v['files'][n]={'bytes':len(b),'sha256':sha(b)}
v['derivation'].append('Source review during first frozen512 PASS found that NOTFOUND-without-SQL alone must not imply no schema-using API calls or connection-state changes. A custom file control can use APIs or mutate configuration without ordinary statement execution. After actual first closure, strengthened declaration with pragmaFileControlsDoNotAccessSchemaOrChangeConnectionState=true and a false-value refusal test. Original first PASS remains honest/ALL222 unchanged. Both side-effect-free schema/state behavior and NOTFOUND/no-SQL now necessary; runtime remains unverified. No owner/guard/default setting changed.')
p.write_bytes(canonical(v)+b'\n')
for name in ('build_stop_post.py','build_capture_stop_post.py'):
 r=subprocess.run([sys.executable,'-B',str(k/name),'--write-unreviewed-source'],cwd=w,capture_output=True);assert r.returncode==0,r.stderr
p2=k/'capture-statement-journal-source.json';v2=json.loads(p2.read_bytes())
for n in v2['files']:
 b=(k/n).read_bytes();v2['files'][n]={'bytes':len(b),'sha256':sha(b)}
p2.write_bytes(canonical(v2)+b'\n')
for p2 in k.iterdir():
 if p2.is_file() and p2.suffix=='.py':ast.parse(p2.read_bytes())
r={'firstRunExitCode':0,'firstRunStartedUtc':first['startedUtc'],'firstRunClosedUtc':first['closedUtc'],'all222FirstSourcesUnchanged':True,'sourceEditOnlyAfterActualClosure':True,'beforeProofSha256':before,'afterProofSha256':sha(p.read_bytes()),'review':'Return NOTFOUND/no SQL does not alone exclude schema-using APIs or connection state mutation. Explicit side-effect-free schema/state declaration now required; false condition refuses.','runtimeAuthorityPromoted':False,'hooksExecuted':False}
(h/'reader-init505-entry-1038-once/pragma-state-side-effect-source-review.json').write_bytes(canonical(r)+b'\n');print(json.dumps(r))
