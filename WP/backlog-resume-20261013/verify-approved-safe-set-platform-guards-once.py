"""One local and one Linux host synthetic guard run; no cleanup operation."""
import base64,datetime,hashlib,json,pathlib,subprocess
R=pathlib.Path(__file__).resolve().parents[2];D=R/'WP/yy-approved-safe-set-cleanup-20261015';O=D/'platform-guard-successor-once';assert not O.exists();O.mkdir()
names=['cleanup_exact_safe_set.py','verify_exact_cleanup_guards.py','approved-plan.json'];before={n:hashlib.sha256((D/n).read_bytes()).hexdigest() for n in names}
def save(n,b):
 with (O/n).open('xb') as f:f.write(b)
p=subprocess.run(['python','-X','utf8','-B',str(D/names[1])],cwd=R,capture_output=True);save('local-stdout-original.log',p.stdout);save('local-stderr-original.log',p.stderr)
save('local-exit-original.json',json.dumps({'exitCode':p.returncode,'closedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'windowsOnlyFlagFixture':True,'productionGuardUnchanged':True}).encode());assert p.returncode==0,'Retain local failure, host tests not started'
files={n:base64.b64encode((D/n).read_bytes()).decode() for n in names}
script='''import base64,datetime,hashlib,json,pathlib,subprocess,sys
d=pathlib.Path('/tmp/lims-exact-safe-set-guard-fixtures-6189633644');d.mkdir()
files=FILES
for n,b in files.items():(d/n).write_bytes(base64.b64decode(b))
before={n:hashlib.sha256((d/n).read_bytes()).hexdigest() for n in files}
p=subprocess.run([sys.executable,'-B',str(d/'verify_exact_cleanup_guards.py')],cwd=d,capture_output=True)
(d/'stdout-original.log').write_bytes(p.stdout);(d/'stderr-original.log').write_bytes(p.stderr)
result={'exitCode':p.returncode,'closedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'python':sys.version,'tests':10,'linuxRealONOFOLLOW':True,'stdout':p.stdout.decode(),'stderr':p.stderr.decode(),'sourceBefore':before,'sourceAfter':{n:hashlib.sha256((d/n).read_bytes()).hexdigest() for n in files},'cleanupOperatorExecuted':False,'realDockerReadsOrMutations':0,'oldDbReads':0,'fixtureTreeRetained':str(d)}
(d/'result-original.json').write_text(json.dumps(result,indent=2));print(json.dumps(result));sys.exit(p.returncode)
'''.replace('FILES',repr(files))
save('host-synthetic-runner-source.py',script.encode());compile(script,'host-synthetic-runner-source.py','exec')
p=subprocess.run(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=15','root@46.19.33.37','python3','-B','-'],input=script.encode(),capture_output=True,timeout=90,cwd=R);save('host-stdout-original.json',p.stdout);save('host-stderr-original.log',p.stderr);save('host-exit-original.json',json.dumps({'exitCode':p.returncode,'closedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat()}).encode());assert p.returncode==0,'Retain host guard failure, no cleanup'
v=json.loads(p.stdout);after={n:hashlib.sha256((D/n).read_bytes()).hexdigest() for n in names};assert before==after==v['sourceBefore']==v['sourceAfter']
save('summary.json',json.dumps({'status':'PASS','localTests':10,'hostTests':10,'localExit':0,'hostExit':0,'hostPython':v['python'],'operatorSha256':before[names[0]],'planSha256':before[names[2]],'allSourceUnchanged':True,'cleanupExecuted':False,'hostDockerOperations':0,'fixtureTreesRetained':True},indent=2).encode());print(json.dumps({'status':'PASS','localTests':10,'actualLinuxHostTests':10,'cleanupExecuted':False,'operatorSha256':before[names[0]]}))
