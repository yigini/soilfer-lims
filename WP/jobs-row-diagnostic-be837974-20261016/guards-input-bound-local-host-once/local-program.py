import sys,os,unittest,subprocess,socket
sys.path.insert(0,sys.argv[1]);os.environ['DIAGNOSTIC_FIXTURE_ROOT']=sys.argv[2]
import verify_diagnostic
def blocked(*a,**kw):raise RuntimeError('Real subprocess/network blocked in new synthetic guards')
subprocess.run=blocked;subprocess.Popen=blocked;subprocess.check_output=blocked;socket.socket=blocked;socket.create_connection=blocked
r=unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromModule(verify_diagnostic))
sys.exit(0 if r.wasSuccessful() else 1)
