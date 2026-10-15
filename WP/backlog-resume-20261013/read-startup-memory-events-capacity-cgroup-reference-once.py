"""Fresh STAT-only R4/new namespace and host cgroup-layout reference; no proof or host writes."""
import datetime,json,pathlib,subprocess,sys
R=pathlib.Path(__file__).resolve().parents[2];S=R/'WP/batch-proof-memory-events-be837974-20261015';D=S/'fresh-capacity-cgroup-reference-once';assert not D.exists();D.mkdir();sys.path.insert(0,str(S))
from proof_contract import ROOT,PRIOR_RAW_DATA,PRIOR_RAW_ASSETS,PRIOR_BACKUP,PREDECESSOR_ID,canonical
from proof_budget import capacity_probe_source,capacity_gate
from proof_memory import cgroup_path
from proof_render import render
capacity=capacity_probe_source(PRIOR_RAW_DATA,PRIOR_RAW_ASSETS,PRIOR_BACKUP,'BEFORE_UNIT',0)
template='''import contextlib,datetime,io,json,pathlib,subprocess
buf=io.StringIO()
with contextlib.redirect_stdout(buf):exec(compile(CAPACITY_VALUE,'actual-capacity-reference','exec'),{})
capacity=json.loads(buf.getvalue())
root=pathlib.Path(ROOT_VALUE);unit=UNIT_VALUE
assert not root.exists() and not root.is_symlink()
state=subprocess.run(['systemctl','show',unit,'--property=LoadState,ActiveState,MainPID,InvocationID'],capture_output=True,timeout=15)
assert len(state.stdout)<65536 and len(state.stderr)<65536
props=dict(l.split('=',1) for l in state.stdout.decode().splitlines() if '=' in l);assert props.get('LoadState')=='not-found' and props.get('MainPID')=='0' and not props.get('InvocationID')
normal=subprocess.run(['docker','inspect','--format','{{json .State}}',PREDECESSOR_VALUE],capture_output=True,timeout=15)
assert normal.returncode==0 and len(normal.stdout)<65536 and not normal.stderr
v=json.loads(normal.stdout);assert v['Running'] and v['Health']['Status']=='healthy' and not v['OOMKilled'] and type(v['Pid']) is int and v['Pid']>0
member=pathlib.Path('/proc/'+str(v['Pid'])+'/cgroup').read_bytes();mount=pathlib.Path('/proc/'+str(__import__('os').getpid())+'/mountinfo').read_bytes()
assert len(member)<4096 and len(mount)<1024**2
print(json.dumps({'observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'capacityReference':capacity,'referenceNotLaunchAuthority':True,'futureExactPackageNotPreparedOrCharged':True,'newRootAbsent':True,'newUnitUnused':True,'unitStdoutOriginal':state.stdout.decode(),'unitStderrOriginal':state.stderr.decode(),'unitQueryExitCode':state.returncode,'normalContainerId':PREDECESSOR_VALUE,'normalStateOriginal':normal.stdout.decode(),'hostMembershipOriginal':member.decode(),'hostMountinfoOriginal':mount.decode(),'productionContentOpens':0,'sqlConnections':0,'serverWrites':0,'operatorCalls':0,'cgroupCountersSampledForProduction':False}))
'''
unit='lims-'+str(ROOT).split('/')[-1].lower();source=render(template,{'CAPACITY_VALUE':capacity,'ROOT_VALUE':str(ROOT),'UNIT_VALUE':unit,'PREDECESSOR_VALUE':PREDECESSOR_ID},'read-only-capacity-cgroup-reference')
(D/'remote-source.py').write_bytes(source)
r=subprocess.run(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=15','root@46.19.33.37','python3','-B','-'],cwd=R,input=source,capture_output=True,timeout=90)
(D/'stdout-original.json').write_bytes(r.stdout);(D/'stderr-original.log').write_bytes(r.stderr);(D/'exit-original.json').write_bytes(canonical({'exitCode':r.returncode,'closedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'readOnlyReference':True}))
assert r.returncode==0,'Retain failure; never replay'
v=json.loads(r.stdout);requirement=capacity_gate(v['capacityReference'],'BEFORE_UNIT',0)
resolved=cgroup_path(PREDECESSOR_ID,v['hostMembershipOriginal'].encode(),v['hostMountinfoOriginal'].encode())
result={'observedUtc':v['observedUtc'],'referenceOnlyNotLaunchAuthority':True,'requiredExcludingFutureExactPackageBytes':requirement,'freeBytes':v['capacityReference']['freeBytes'],'sourceRoot':str(ROOT),'unit':unit,'newRootAbsent':True,'newUnitUnused':True,'actualHostExactIdCgroupPathValidated':resolved.as_posix(),'operatorsExecuted':0,'serverWrites':0}
(D/'independent-reference-validation.json').write_bytes(canonical(result)+b'\n');print(json.dumps(result,ensure_ascii=True))
