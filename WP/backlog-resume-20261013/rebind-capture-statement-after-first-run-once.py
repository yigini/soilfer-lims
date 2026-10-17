import ast,hashlib,json,pathlib,subprocess,sys
w=pathlib.Path(__file__).resolve().parents[2];k=w/'WP/batch-release-kit-be837974-20261016'
sys.path.insert(0,str(k))
from kit_contract import canonical
import kit_capture_statement as statement
sha=lambda raw:hashlib.sha256(raw).hexdigest()
def pin(p):
 raw=p.read_bytes();return {'bytes':len(raw),'sha256':sha(raw)}
def refresh(name,root):
 p=k/name;v=json.loads(p.read_bytes());v['files']={n:pin(root/n) for n in v['files']};return p,v
p,v=refresh('schema-collection-source.json',k);p.write_bytes(canonical(v)+b'\n')
p,v=refresh('statement-journal-source.json',w);p.write_bytes(canonical(v)+b'\n')
for build in ('build_stop_post.py','build_capture_stop_post.py'):
 result=subprocess.run([sys.executable,'-B',str(k/build),'--write-unreviewed-source'],cwd=w,capture_output=True)
 if result.returncode:raise RuntimeError(result.stderr.decode('utf-8','replace'))
p,v=refresh('capture-native-main-source.json',k)
v['collectorProofSha256']=sha((k/'schema-collection-source.json').read_bytes())
p.write_bytes(canonical(v)+b'\n')
names=('kit_capture_statement.py','kit_statement_journal.py','statement-journal-source.json',
 'kit_capture_main.py','capture-native-main-source.json','kit_capture_journal.py','capture-writer-journal-source.json',
 'kit_capture_journal_package.py','kit_owned.py','kit_capture_owned.py','kit_capture_budget.py',
 'kit_capture_review.py','kit_capture_package.py','kit_capture_outcome.py','kit_copy_admission.py','kit_frozen.py',
 'capture_writer_journal.cjs','schema-collection-source.json','kit_schema_collection.py',
 'kit_capture_launch.py','build_capture_stop_post.py','capture_stop_post.py','stop_post.py')
v={'version':1,'scope':'CAPTURE_STRICT_PRE_STATEMENT_JOURNAL_CONTENT_ADMISSION',
 'files':{name:pin(k/name) for name in names},'restrictedStatementSourceInventoryVerified':True,
 'databaseCosts':statement.STATEMENT_DB_COST,'fixedBytes':statement.STATEMENT_FIXED,
 'statementSourceProofSha256':sha((k/'statement-journal-source.json').read_bytes()),
 'nativeMainAdmissionProofSha256':sha((k/'capture-native-main-source.json').read_bytes()),
 'statementJournalFileLengthOrVfsBounded':False,'physicalFilesystemClosureClaimed':False,
 'completeWriterFilesystemReview':False}
p=k/statement.PROOF_NAME;assert p.exists();p.write_bytes(canonical(v)+b'\n')
for p in k.iterdir():
 if p.is_file() and p.suffix=='.py':ast.parse(p.read_bytes())
import kit_capture_budget as budget
print(json.dumps({'sourceFiles':len(names),'proofSha256':sha(p.read_bytes()) if p.name==statement.PROOF_NAME else sha((k/statement.PROOF_NAME).read_bytes()),
 'statementDbCosts':statement.STATEMENT_DB_COST,'statementFixedBytes':statement.STATEMENT_FIXED,
 'captureDbCopies':budget.CAPTURE_TOTAL_DB_COPIES,'captureDbEquivalents':budget.CAPTURE_DB_EQUIVALENTS,
 'captureFixedBeforeMargin':sum(x['fixedBytes'] for x in budget.CAPTURE_TABLE),
 'captureFixedAfterMargin':sum((x['fixedBytes']*125+99)//100 for x in budget.CAPTURE_TABLE),
 'operatorsExecuted':0,'generatedHooksExecuted':0},sort_keys=True))
