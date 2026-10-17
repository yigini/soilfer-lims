from pathlib import Path
import hashlib,json,re,subprocess,sys
w=Path(__file__).resolve().parents[2];h=w/'WP/backlog-resume-20261013';k=w/'WP/batch-release-kit-be837974-20261016';e=h/'startup-a94-prefix565-entry-1451-once'
sys.path.insert(0,str(k));from kit_contract import canonical
sha=lambda b:hashlib.sha256(b).hexdigest()
assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=w,text=True).strip()=='baff7d042c21cad5c420205d393ce211b6253c52'
v=json.loads((k/'local-tests-checkpoint-originals565-first/verification.json').read_bytes());assert v['exitCode']==0 and v['sourceBefore']==v['sourceAfter'] and len(v['sourceBefore'])==243
assert all(sha((k/n).read_bytes())==d for n,d in v['sourceBefore'].items() if n!='README.md')
parent=h/'candidate-startup565-entry-1440-once/candidate-default-startup-source-review.json';parent_raw=parent.read_bytes();assert sha(parent_raw)=='0ea6ef087f798bfb5aa99945edc7b0e74a17549b9c84db7446271449dfd17ef3';base=json.loads(parent_raw);files=dict(base['files']);files[parent.relative_to(w).as_posix()]={'bytes':len(parent_raw),'sha256':sha(parent_raw)}
originals=[next(x for x in base['releaseSourceOriginals'] if x['sourcePath']==name) for name in ['server/scripts/migrate_lab_operations_v3.js','docker-entrypoint.sh']]
for x in originals:
 b=(w/x['retainedSourceOriginal']).read_bytes();assert len(b)==x['bytes'] and sha(b)==x['sha256'] and b==subprocess.check_output(['git','show',x['releaseHead']+':'+x['sourcePath']],cwd=w)
 files[x['retainedSourceOriginal']]={'bytes':len(b),'sha256':sha(b)}
for name,pin in files.items():
 b=(w/name).read_bytes();assert pin=={'bytes':len(b),'sha256':sha(b)}
original=originals[0];path=w/original['retainedSourceOriginal'];raw=path.read_bytes();text=raw.decode('utf8');lines=raw.splitlines(keepends=True);offset=[0]
for line in lines:offset.append(offset[-1]+len(line))
def excerpt(x,label,first,last):
 b=(w/x['retainedSourceOriginal']).read_bytes();a=b.splitlines(keepends=True);start=sum(map(len,a[:first-1]));end=sum(map(len,a[:last]));value=b[start:end]
 return {'path':x['retainedSourceOriginal'],'releaseSourcePath':x['sourcePath'],'releaseHead':x['releaseHead'],'label':label,'firstLine':first,'lastLine':last,'startByte':start,'endByte':end,'bytes':len(value),'sha256':sha(value),'text':value.decode('utf8')}
parts=[excerpt(original,*s) for s in [('complete_argument_parser',319,349),('complete_a94_inventory_helper',353,383),('exact_successful_already_applied_prefix',385,441),('exact_run_migration_finally',1247,1251),('complete_actual_cli_main',1253,1264)]]+[excerpt(originals[1],'exact_default_startup_invocation',118,118)]
helper=parts[1]['text'];prefix=parts[2]['text']
table_sql=re.search(r'db\.prepare\("([^"\n]+)"\)\.get\(name\)',helper).group(1)
work_template=re.search(r'const rows = db\.prepare\(`([\s\S]*?)`\)\.all\(\);',helper).group(1)
draft_clause=re.search(r"const draftClause = .*?\? '([^']*)' : '';",helper).group(1)
join_sql=re.search(r'db\.prepare\(`(SELECT 1 FROM OrderLine[\s\S]*?)`\)\.get\(sampleId\)',helper).group(1)
assert work_template.count('${draftClause}')==1
catalog=[
 {'id':'foreign_keys_on','sql':'PRAGMA foreign_keys = ON','multiplicity':'1','kind':'actual pragma method call'},
 {'id':'workitemdraft_exists','sql':table_sql,'parameters':['WorkItemDraft'],'multiplicity':'1'},
 {'id':'workitem_inventory','sqlVariants':{'withWorkItemDraft':work_template.replace('${draftClause}',draft_clause),'withoutWorkItemDraft':work_template.replace('${draftClause}','')},'multiplicity':'1','outputCardinalityAndPayloadBeforeSqlKnown':False},
 {'id':'orderline_exists','sql':table_sql,'parameters':['OrderLine'],'multiplicity':'1'},
 {'id':'revision_exists','sql':table_sql,'parameters':['SampleOrderRevision'],'multiplicity':'e','shortCircuit':'only if OrderLine exists'},
 {'id':'sample_columns','sql':'PRAGMA table_info(Sample)','multiplicity':'1'},
 {'id':'grouped_order_lookup','sql':join_sql,'parameters':['sampleId'],'multiplicity':'U*r'},
 {'id':'required_analyses_lookup','sql':'SELECT requiredAnalyses FROM Sample WHERE id=?','parameters':['sampleId'],'multiplicity':'U*c'},
 {'id':'migration_table_exists','sql':"SELECT 1 FROM sqlite_master WHERE type='table' AND name='_schema_migrations'",'multiplicity':'1 on successful alreadyApplied path'},
 {'id':'prior_migration','sql':'SELECT id, appliedAt FROM "_schema_migrations" WHERE id = ?','parameters':['v3_lab_operations_20260906'],'multiplicity':'1 on successful alreadyApplied path'}
]
for sql in [table_sql,'PRAGMA table_info(Sample)','SELECT requiredAnalyses FROM Sample WHERE id=?',catalog[8]['sql'],catalog[9]['sql']]:assert sql in text
assert "db.pragma('foreign_keys = ON')" in prefix and 'const source = new Database' in prefix
assert prefix.index('collectA94Candidates(db)')<prefix.index('const MIGRATION_KEY')<prefix.index('if (priorMigration && apply)')
assert '.transaction(' not in prefix and "db.exec('BEGIN" not in prefix and 'temp_store' not in prefix
families=[
 {'family':'exact_default_apply_and_scope','finding':'Pinned entrypoint invokes migrate_lab_operations_v3.js --apply. Exact parser gives apply true/dryRun false for that one option, so source constructor requests readonly false/fileMustExist true/timeout10000 and db aliases source; no serialize or in-memory clone branch is taken in this scope. The catalogue starts only after constructor/imports and covers successful alreadyApplied return plus finally source close, not missing marker/apply branch, constructor/require initialization or native/Python runtime binding.'},
 {'family':'inventory_precedes_completion_marker','finding':'Actual caller sets foreign_keys ON, runs entire collectA94Candidates and logs its candidates BEFORE checking _schema_migrations and the prior migration row. A successful alreadyApplied result skips later migration transaction/DDL/data reconciliation, but does not skip these earlier SQL scans or final source close. Returned alreadyApplied/empty DDL audit/no-op wording is not zero native scratch/recovery/checkpoint/log/file-effect proof. Existing A94 manual-review deferrals and scientific settings remain unchanged.'},
 {'family':'exact_explicit_query_catalogue_and_symbolic_counts','finding':'Ten catalogue entries, with two exact work inventory SQL variants. Let e=OrderLine existence0/1; r=canReadOrders=OrderLine&&SampleOrderRevision existence0/1; c=Sample has requiredAnalyses0/1; U=distinct sampleId Map keys returned by the whole work inventory query. On successful exact alreadyApplied path explicit logical JS statement-method calls=7+e+U*(r+c). Revision existence query is short-circuited by e; order lookup and requiredAnalyses lookup execute independently once per sample group when enabled. Native prepare/step/reprepare/internal load/cursor/row/frame/file counts and complete handle lifetime are NOT this formula. U/full output payloads are unknown before that SQL; no later profile can authorize its earlier scans.'},
 {'family':'query_scratch_and_heap_remain_unclosed','finding':'The work inventory has ORDER BY sampleId,id plus correlated NOT EXISTS against Result and optionally WorkItemDraft; enabled order lookup has a join and LIMIT1. Sorter/automatic-index/materialization/virtual-expression-callback producers require actual native planning/full-source and caller schema review, not the earlier simple single-source schema SELECT profile. Work rows/tasks, per-sample Map/Sets/candidate arrays and JSON console serialization add unknown heap/output payloads. No native sorter input counts/FULL serialized records/all handles or physical memory/log bound is derived from the statement count or JavaScript grouping.'},
 {'family':'snapshot_and_lifetime_not_established_by_later_marker','finding':'The shown prefix has no explicit BEGIN/read transaction spanning inventory and marker queries. Foreign_keys assignment is not accepted temp_store=MEMORY; no such setting appears in the prefix. Do not borrow a later BEGIN/write transaction or later marker/header/record profile as a stable snapshot or pre-SQL admission for this earlier prefix. Actual constructor callbacks/native auto-transactions/other-writer exclusion/geometry/source originals/statement finalization-GC/close effects remain separately unverified. This source fact does not claim an observed race or request any transaction/signal/heap-setting change.'},
 {'family':'before_initial_sql_admission_refused','finding':'REFUSE whole default-startup/initial-reader admission from alreadyApplied or the explicit source-only count. Require source-bound schema/profile/native counts/full payloads/all handles plus constructor/loader/binary/defaultVFS/global callbacks/source association/locks/originals/independent replay and held logical/physical capacity before initial SQL. This review changes no operational/test code, owner, scientific transaction or settings; no target SQL, shell, installer, default-entrypoint attempt, host/image/runtime observation, test or deployment occurred.'}
]
record={'version':1,'scope':'EXPLICIT_SUCCESSFUL_ALREADY_APPLIED_A94_STARTUP_PREFIX_SOURCE_CATALOGUE_ONLY','priorHead':'baff7d042c21cad5c420205d393ce211b6253c52','parentDefaultStartupReview':{'path':parent.relative_to(w).as_posix(),'sha256':sha(parent_raw)},'files':files,'fullReleaseSourceOriginalBindings':originals,'exactReleaseSourceExcerpts':parts,'explicitQueryCatalogue':catalog,'symbolicCallCount':{'formula':'7+e+U*(r+c)','e':'OrderLine existence0or1','r':'OrderLine AND SampleOrderRevision existence0or1','c':'table_info(Sample) reports requiredAnalyses0or1','U':'Map cardinality of sampleId keys returned by work inventory; unknown before its SQL','countIsNativeApiOrHandleOrRowOrFrameInventory':False},'sourceFamilies':families,'conditionalExactExplicitNoopPrefixCatalogueRetained':True,'actualRuntimeAlreadyAppliedEntryOrSqlExecutionsObserved':False,'actualPrefixSourceSnapshotAndWriterExclusionVerified':False,'nativeSorterMaterializationCountAndFullPayloadInventoryDerived':False,'processHeapOrJsonOutputBounded':False,'runtimeBinaryToSourceBuildBindingVerified':False,'actualDefaultVfsAndCallbacksVerified':False,'completeInitialSqlOrSourceCloseLifetimeBounded':False,'beforeInitialReaderSqlAdmissionImplemented':False,'writerGraphAdmissionImplemented':False,'physicalFilesystemClosureClaimed':False,'actualOwnerOrTestCodeChanged':False,'all242NonReadmeSourcesUnchangedSince565':True,'earlier565SuiteNotRerunOrRelabeled':True,'newSqlExecutions':0,'newFixtureFiles':0,'newTestRuns':0,'oldPrivatePayloadsRead':False}
assert len(files)==119 and len(parts)==6 and len(catalog)==10 and len(families)==6
for x in parts:
 b=(w/x['path']).read_bytes()[x['startByte']:x['endByte']];assert len(b)==x['bytes'] and sha(b)==x['sha256'] and b.decode('utf8')==x['text']
out=e/'startup-a94-already-applied-prefix-source-review.json';out.open('xb').write(canonical(record)+b'\n')
(e/'source-read-diagnostic-transcription.json').open('xb').write(canonical({'scope':'TOOL_OUTPUT_TRANSCRIPTION_ONLY_NOT_INDEPENDENT_ORIGINAL_DIAGNOSTIC_STDERR','publicSourceAggregateTruncated':True,'compactExactParserHelperPrefixFinallyReadsSuppliedEveryUsedFact':True,'oldPrivatePayloadsRead':False,'omittedOutputUsedForInference':False})+b'\n')
print(json.dumps({'review':out.relative_to(w).as_posix(),'sha256':sha(out.read_bytes()),'fullPublicPins':len(files),'exactSourceExcerpts':len(parts),'catalogueEntries':len(catalog),'families':len(families),'explicitSourceOnlyCallCountFormula':'7+e+U*(r+c)','newSql':0,'newFixtures':0,'newTestRuns':0,'all242NonReadmeSourcesUnchanged':True}))
