
import sys,os,pathlib,subprocess,sqlite3,json,unittest
sys.dont_write_bytecode=True
B=pathlib.Path(sys.argv[1]);fixture=pathlib.Path(sys.argv[2]);os.environ['LIMS_PROOF_GUARD_FIXTURE_DIR']=str(fixture);sys.path.insert(0,str(B))
real_run=subprocess.run
record=pathlib.Path(sys.argv[3])
def closed_run(args,*a,**k):
 if args==['node',str(B/'writer_fingerprint.cjs')]:
  result=real_run(args,*a,**k);record.write_bytes(result.stdout);return result
 raise AssertionError('Real subprocess forbidden in synthetic guard suite')
subprocess.run=closed_run;subprocess.check_output=lambda *a,**k:(_ for _ in ()).throw(AssertionError('Real subprocess forbidden'))
connect=sqlite3.connect
def sqlite_only_new(name,*a,**k):
 from urllib.parse import urlparse,unquote
 value=str(name)
 if value!=':memory:':
  path=pathlib.Path(unquote(urlparse(value).path)) if value.startswith('file:') else pathlib.Path(value)
  if os.name=='nt' and str(path).startswith('\\'):path=pathlib.Path(str(path).lstrip('\\'))
  assert fixture.parent.resolve() in path.resolve().parents and ('lp063-' in str(path) or 'step2-sql' in str(path)),'Only NEW retained synthetic SQLite allowed'
 return connect(name,*a,**k)
sqlite3.connect=sqlite_only_new
import verify_diagnostic as v
v.setUpModule();r=unittest.TextTestRunner(verbosity=2).run(v.suite());raise SystemExit(not r.wasSuccessful())
