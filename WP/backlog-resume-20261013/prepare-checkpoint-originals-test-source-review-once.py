from pathlib import Path
import ast,hashlib,json,subprocess,sys
w=Path(__file__).resolve().parents[2];k=w/'WP/batch-release-kit-be837974-20261016';h=w/'WP/backlog-resume-20261013';e=h/'checkpoint-originals563-entry-1403-once';sys.path.insert(0,str(k));from kit_contract import canonical
sha=lambda b:hashlib.sha256(b).hexdigest();git=lambda *a:subprocess.check_output(['git',*a],cwd=w)
assert git('rev-parse','HEAD').decode().strip()=='0817c479c4ac3b94b41192b8736b2fd4e136e0cd' and not git('diff','--cached','--name-only').strip()
v=json.loads((k/'local-tests-checkpoint-requests563-first/verification.json').read_bytes());assert v['exitCode']==0 and v['sourceBefore']==v['sourceAfter'] and len(v['sourceBefore'])==243
assert all(sha((k/n).read_bytes())==d for n,d in v['sourceBefore'].items() if n not in ('README.md','verify_kit_checkpoint_requests.py'))
p=k/'verify_kit_checkpoint_requests.py';raw=p.read_bytes();lines=raw.splitlines(keepends=True);offset=[0]
for line in lines:offset.append(offset[-1]+len(line))
parts=[];tree=ast.parse(raw)
for node in ast.walk(tree):
 if isinstance(node,ast.FunctionDef) and node.name in ('test_new_retained_complete_original_package_roundtrip_with_sql_disabled','test_actual_new_native_head_originals_plan_precedes_checkpoint_and_full_package_replay'):
  b=raw[offset[node.lineno-1]:offset[node.end_lineno]];parts.append({'name':node.name,'startByte':offset[node.lineno-1],'endByte':offset[node.end_lineno],'bytes':len(b),'sha256':sha(b),'text':b.decode()})
assert len(parts)==2
for p in k.iterdir():
 if p.is_file() and p.suffix=='.py':ast.parse(p.read_bytes())
record={'scope':'NEW_LOCAL_CHECKPOINT_ORIGINAL_RETENTION_AND_NATIVE_FIXTURE_TESTS_ONLY','priorHead':'0817c479c4ac3b94b41192b8736b2fd4e136e0cd','testModule':(k/'verify_kit_checkpoint_requests.py').relative_to(w).as_posix(),'testModulePin':{'bytes':len(raw),'sha256':sha(raw)},'completeNewTestFunctions':parts,'newTestMethods':2,'expectedUniqueTests':565,'expectedSourceFiles':243,'allOther241NonReadmeAndTestSourceBytesUnchanged':True,'operationalModulesProofsAndHooksUnchanged':True,'hooksRebuiltOrExecuted':False,'checkpointRequestSourceProofSha256':sha((k/'checkpoint-requests-source.json').read_bytes()),'captureStatementProofSha256':sha((k/'capture-statement-journal-source.json').read_bytes()),'plannedNewNativeParameterCases':3,'plannedNewNodeCommandsIncludingSetup':6,'plannedNewRetainedSyntheticPackageCases':1,'nativeSetupCandidateConstructorVerificationAndCloseSqlOutsideConditionalApiProfile':True,'actualEntryAndHeadSourceAssociationVerified':False,'actualNativeCheckpointCallsOrReturnCodesMeasured':False,'runtimeBinaryToSourceBindingVerified':False,'beforeSqlHeldAdmissionImplemented':False,'writerGraphAdmissionImplemented':False,'physicalFilesystemClosureClaimed':False}
(e/'test-source-review.json').open('xb').write(canonical(record)+b'\n');print(json.dumps({n:record[n] for n in ('newTestMethods','expectedUniqueTests','expectedSourceFiles','operationalModulesProofsAndHooksUnchanged','checkpointRequestSourceProofSha256','captureStatementProofSha256')}))
