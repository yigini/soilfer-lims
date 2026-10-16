import unittest,subprocess,sys,sqlite3,os;from unittest import mock
from urllib.parse import unquote
real_connect=sqlite3.connect
def connect(path,*a,**kw):
 value=unquote(str(path)).replace('file:///','').replace('file:','').split('?')[0]
 base=os.environ['LIMS_PROOF_GUARD_FIXTURE_DIR'].replace('\\','/')
 if str(path)!=':memory:' and not value.replace('\\','/').startswith(base):raise AssertionError('SQLite outside NEW retained synthetic fixtures forbidden: '+value)
 return real_connect(path,*a,**kw)
blocked=lambda *a,**k:(_ for _ in ()).throw(AssertionError('Real process forbidden in LOCAL guard tests'))
import provenance_privacy as privacy
privacy.install_value_key(bytes(range(32)))
suite=unittest.TestSuite([unittest.defaultTestLoader.loadTestsFromName(n) for n in ['verify_proof_guards','verify_jobs_guards','verify_provenance_guards']])
print(__import__('json').dumps({'testsExpected':suite.countTestCases()}))
with mock.patch.object(subprocess,'run',blocked),mock.patch.object(subprocess,'check_output',blocked),mock.patch.object(subprocess,'Popen',blocked),mock.patch.object(sqlite3,'connect',connect):result=unittest.TextTestRunner(verbosity=2).run(suite)
sys.exit(not result.wasSuccessful())
