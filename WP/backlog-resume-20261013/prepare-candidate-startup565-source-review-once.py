from pathlib import Path
import ast,hashlib,json,re,subprocess,sys
from concurrent.futures import ThreadPoolExecutor
w=Path(__file__).resolve().parents[2];h=w/'WP/backlog-resume-20261013';k=w/'WP/batch-release-kit-be837974-20261016';e=h/'candidate-startup565-entry-1440-once'
sys.path.insert(0,str(k));from kit_contract import canonical
sha=lambda b:hashlib.sha256(b).hexdigest()
release='be8379745bdfae52ce46496ff26514dc7d729640';prior='7e6165557582cc04fa52addd73ce64e0c40060dd'
assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=w,text=True).strip()==prior
v=json.loads((k/'local-tests-checkpoint-originals565-first/verification.json').read_bytes());assert v['exitCode']==0 and v['sourceBefore']==v['sourceAfter'] and len(v['sourceBefore'])==243
assert all(sha((k/n).read_bytes())==d for n,d in v['sourceBefore'].items() if n!='README.md')
parent=h/'constructor-providers565-entry-1430-once/constructor-builtin-providers-source-review.json';parent_raw=parent.read_bytes();assert sha(parent_raw)=='18498ba92314aa26b9c42c2d91b979a59b35ede6fe42ca2f88d5b3bbc2d98101';base=json.loads(parent_raw);files=dict(base['files'])
files[parent.relative_to(w).as_posix()]={'bytes':len(parent_raw),'sha256':sha(parent_raw)}
for name in ['kit_runtime.py','kit_owned.py','kit_ops.py','cli_guard.cjs','sqlite_temp_directory.cjs','sqlite-temp-directory-source.json','kit_budget.py','startup-expectations.json','compose-source.yml']:
 p=k/name;b=p.read_bytes();files[p.relative_to(w).as_posix()]={'bytes':len(b),'sha256':sha(b)}
for name,pin in files.items():
 raw=(w/name).read_bytes();assert pin=={'bytes':len(raw),'sha256':sha(raw)}
def excerpt(path,label,first,last):
 raw=path.read_bytes();lines=raw.splitlines(keepends=True);start=sum(map(len,lines[:first-1]));end=sum(map(len,lines[:last]));b=raw[start:end]
 return {'path':path.relative_to(w).as_posix(),'label':label,'firstLine':first,'lastLine':last,'startByte':start,'endByte':end,'bytes':len(b),'sha256':sha(b),'text':b.decode('utf8')}
parts=[]
for filename,names in [('kit_runtime.py',['environment','candidate_spec','candidate_projection','Candidate']),('kit_owned.py',['cli_spec'])]:
 p=k/filename;t=ast.parse(p.read_text(encoding='utf8'))
 for name in names:
  n=next(n for n in t.body if isinstance(n,(ast.FunctionDef,ast.ClassDef)) and n.name==name);parts.append(excerpt(p,'complete_'+name,n.lineno,n.end_lineno))
parts.extend([excerpt(k/'kit_ops.py','complete_start_exact_candidate_jobs_on_once',131,139),excerpt(k/'cli_guard.cjs','complete_cli_run_child',48,81),excerpt(k/'sqlite_temp_directory.cjs','complete_temporary_directory',8,36)])
native=base['nativeSource'];native_part=excerpt(w/native['path'],'complete_unix_temp_candidate_and_selector',45461,45505)
runtime_ast=ast.parse((k/'kit_runtime.py').read_text(encoding='utf8'));candidate=next(n for n in runtime_ast.body if isinstance(n,ast.FunctionDef) and n.name=='candidate_spec')
updates=[n for n in ast.walk(candidate) if isinstance(n,ast.Call) and isinstance(n.func,ast.Attribute) and isinstance(n.func.value,ast.Name) and n.func.value.id=='env' and n.func.attr=='update'];assert len(updates)==1 and not updates[0].args
updated={x.arg:ast.literal_eval(x.value) for x in updates[0].keywords};assert updated['TMPDIR']==updated['TMP']==updated['TEMP']=='/tmp' and 'SQLITE_TMPDIR' not in updated
assert 'SQLITE_TMPDIR' not in ast.get_source_segment((k/'kit_runtime.py').read_text(encoding='utf8'),candidate)
entry_raw=subprocess.check_output(['git','show',release+':docker-entrypoint.sh'],cwd=w);entry_lines=entry_raw.decode('utf8').splitlines();sites=[]
for number,line in enumerate(entry_lines,1):
 match=re.match(r'\s*node\s+(scripts/[^\s]+)(?:\s|$)',line)
 if match:sites.append({'line':number,'script':match.group(1),'sourceLine':line.strip()})
assert len(sites)==32 and len({x['script'] for x in sites})==31
source_names=['Dockerfile','docker-entrypoint.sh','server/index.js']+['server/'+n for n in sorted({x['script'] for x in sites})]
def read_release(name):
 raw=subprocess.check_output(['git','show',release+':'+name],cwd=w);git_oid=subprocess.check_output(['git','rev-parse',release+':'+name],cwd=w,text=True).strip()
 return name,raw,git_oid
with ThreadPoolExecutor(max_workers=4) as pool:source_results=list(pool.map(read_release,source_names))
originals=[]
for index,(name,b,git_oid) in enumerate(source_results,1):
 assert hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()==git_oid
 out=e/('release-source-'+str(index).zfill(2)+'-original.txt');out.open('xb').write(b)
 originals.append({'releaseHead':release,'sourcePath':name,'gitBlobOid':git_oid,'bytes':len(b),'sha256':sha(b),'retainedSourceOriginal':out.relative_to(w).as_posix()})
assert len(originals)==34
expect=json.loads((k/'startup-expectations.json').read_bytes());index_original=next(x for x in originals if x['sourcePath']=='server/index.js');assert index_original['gitBlobOid']==expect['sourceGitBlob'] and index_original['sha256']==expect['sourceSha256'] and expect['head']==release
families=[
 {'family':'candidate_inherits_sqlite_tmpdir_without_new_policy','finding':'Actual environment(config) accepts arbitrary unique well-formed environment keys. candidate_spec copies predecessor environment then updates TMPDIR/TMP/TEMP to /tmp, but NEVER sets or rejects SQLITE_TMPDIR. A predecessor SQLITE_TMPDIR value is preserved symbolically; candidate_projection checks the expected inherited value rather than requiring /tmp for that key. No actual predecessor environment was read and no wrong routing is observed. This source does not guarantee the first native environment candidate is the retained /tmp bind.'},
 {'family':'default_entrypoint_is_not_owned_cli_guard','finding':'Candidate argv ends in the image without entrypoint/Cmd override; projection requires shipped /app/docker-entrypoint.sh and empty Cmd. Candidate.start_once prepares the future tmp bind and creates/starts once, but does not invoke cli_guard/temporaryDirectory. Owned CLI uses entrypoint node, explicit /release/cli_guard.cjs and all four temporary environment keys=/tmp; runChild takes the directory lease before scientific spawn and rechecks after child closes. That scoped CLI guard is not a source proof for the separate candidate default startup. No owner spec or settings changed.'},
 {'family':'native_unix_precedence_and_process_lifetime','finding':'Pinned unixTempFileInit obtains SQLITE_TMPDIR then TMPDIR into its environment candidate table; unixTempFileDir tries global sqlite3_temp_directory first, then candidates/fallbacks, accepting after directory stat and access03. Under ordinary matching native engine/VFS, a preserved non-/tmp SQLITE_TMPDIR that passes those predicates can outrank TMPDIR=/tmp. Absent or rejected value may fall through, not guarantee /tmp. Global overrides, initialization timing, actual access/permissions/namespace/VFS/syscalls and routing lifetime are not observed. TMP/TEMP are not these two native environment entries. No actual directory or SQLite connection was inspected.'},
 {'family':'default_startup_before_installer_sql','finding':'Pinned release entrypoint has a command-argument bypass; the compiled candidate requires empty Cmd. Its ordinary path can load/generate JWT secret, copy missing schema and touch seed marker. Existing database inspection uses new Database(path) without readonly options/MEMORY setup before sqlite_master/User queries and close. Default addon open is readwrite/create by pinned source, but the actual image/binary/file state remains unbound. Early inspection/implicit schema/WAL recovery/close and shell filesystem/log producers need their own source/original/capacity closure before installer paths. No secret values or private database bytes were read.'},
 {'family':'initialization_flags_are_not_missing_db_branch_exclusion','finding':'ALLOW_PRISMA_DB_PUSH=false and ALLOW_AUTO_SEED=false exclude only their explicitly guarded existing-user repeat branches. Separate missing/empty/not-schema-ready branch runs npx prisma db push; missing seed flag plus userCount0 can run seed.js. Actual complete intact original database/user/schema/flag predicates must exclude or separately bound those branches. Do not infer they execute in current production, or relax flags/transactions to avoid them.'},
 {'family':'literal_script_source_inventory_and_originals','finding':'Exact be837974 release Git originals retained for Dockerfile, entrypoint, server/index and all31 distinct literal node scripts/ paths. Entry shell has32 literal script invocation sites because QC-run alternatives have two source sites; these are static source sites, NOT native calls/SQL/rows/frames/file counts or actual process observations. Script bodies are retained full public source, but transitive helper/provider/native graphs and effects are not closed by this inventory. Startup expectations27 verifiers/26 events remain their disclosed meanings, not31 processes or a quantitative scratch bound.'},
 {'family':'normal_startup_logs_and_overlay_are_separate','finding':'CLI source log-driver none differs from candidate json-file max-size50m/max-file3 and ordinary shipped shell stdout/stderr. Candidate source inspection checks configuration, not actual daemon rotation/metadata/overlay/filesystem allocation or total write peaks. Dockerfile ENTRYPOINT and source hashes establish source intent only; cached npm rebuild/prebuild fallback and image-loaded binding remain unresolved. Preserve whole log/daemon/overlay/systemd/journald/lifecycle evidence obligations; no absence or configured rotation implies physical closure.'},
 {'family':'admission_refusal_and_forward_only','finding':'REFUSE candidate native-temp/default-startup closure from CLI routing or TMPDIR alone. Need complete reviewed source association and before-start original environment/global/native routing/all initial SQL-installers-sourceclose-defaultstartup/metadata/log/physical held-capacity chain. No actual host/image/runtime/operator observations, shell/installer/default-entrypoint attempt, source policy change, deployment, retry or rollback occurred. Later observation and any forward fix need their separate review; existing no retry/restore/older image rules remain.'}
]
record={'version':1,'scope':'CANDIDATE_DEFAULT_STARTUP_TEMP_ENVIRONMENT_AND_RELEASE_SOURCE_INVENTORY_ONLY','priorHead':prior,'parentConstructorProviderReview':{'path':parent.relative_to(w).as_posix(),'sha256':sha(parent_raw)},'files':files,'nativeSource':native,'nativeExcerpts':[native_part],'completeActualKitExcerpts':parts,'candidateEnvironmentUpdateKeywordsFromActualAst':updated,'candidateUpdateSetsSqliteTmpdir':False,'literalStartupScriptSourceSites':sites,'literalStartupScriptSourceSiteCount':32,'distinctLiteralStartupScriptPaths':31,'releaseSourceOriginals':originals,'sourceFamilies':families,'actualPredecessorEnvironmentObserved':False,'actualWrongTemporaryDirectoryRoutingObserved':False,'actualCandidateSqliteTmpdirGuaranteedByCurrentSource':False,'candidateDefaultStartupUsesCliDirectoryLease':False,'allStartupInitializerAndInstallerNativeScratchBounded':False,'actualMissingDatabaseOrSeedBranchesExcluded':False,'actualImageEntrypointToReleaseSourceBindingVerified':False,'runtimeBinaryToSourceBuildBindingVerified':False,'actualNativeTempDirectoryOrVfsRoutingVerified':False,'physicalDockerLogsOverlayOrJournaldLifetimeBounded':False,'beforeInitialReaderSqlAdmissionImplemented':False,'writerGraphAdmissionImplemented':False,'physicalFilesystemClosureClaimed':False,'actualOwnerOrTestCodeChanged':False,'all242NonReadmeSourcesUnchangedSince565':True,'earlier565SuiteNotRerunOrRelabeled':True,'newSqlExecutions':0,'newFixtureFiles':0,'newTestRuns':0,'oldPrivatePayloadsRead':False}
assert len(parts)==8 and len(families)==8
for x in parts+[native_part]:
 b=(w/x['path']).read_bytes()[x['startByte']:x['endByte']];assert b.decode('utf8')==x['text'] and sha(b)==x['sha256']
out=e/'candidate-default-startup-source-review.json';out.open('xb').write(canonical(record)+b'\n')
diagnostics={'scope':'TOOL_OUTPUT_TRANSCRIPTIONS_ONLY_NOT_INDEPENDENT_ORIGINAL_STDERR','publicDockerfilePrint':'first cp1252 output refused Unicode; UTF8 successor supplied full source facts','publicKitAggregate':'oversized source aggregate truncated; compact exact runtime/CLI/entrypoint/native reads supplied all used facts','oldPrivatePayloadsRead':False,'sourceInferenceFromOmittedOutput':False}
(e/'source-read-diagnostic-transcriptions.json').open('xb').write(canonical(diagnostics)+b'\n')
print(json.dumps({'review':out.relative_to(w).as_posix(),'sha256':sha(out.read_bytes()),'fullCurrentPublicPins':len(files),'completeKitExcerpts':len(parts),'exactNativeExcerpts':1,'literalScriptSites':32,'distinctScriptPaths':31,'fullReleaseSourceOriginals':34,'families':8,'newSql':0,'newFixtures':0,'newTestRuns':0,'actualPredecessorOrHostRead':False}))
