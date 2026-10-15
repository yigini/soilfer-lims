"""Fresh post-resize stat-only R4 reference; no package/root/unit/proof creation."""
import datetime,hashlib,json,pathlib,subprocess,sys
repo=pathlib.Path(__file__).resolve().parents[2];source=repo/'WP/batch-proof-startup-be837974-20261015';dest=source/'post-reboot-r4-stat-reference-once';assert not dest.exists();dest.mkdir();sys.path.insert(0,str(source))
from proof_contract import *
from proof_budget import capacity_probe_source,capacity_gate
from proof_render import render
tests=exact_json((source/'source-local-host229-complete-once/exit-original.json').read_bytes());assert tests['status']=='PASS' and tests['sourceSha256After']=={n:sha((source/n).read_bytes()) for n in FILES}
cap=capacity_probe_source(PRIOR_RAW_DATA,PRIOR_RAW_ASSETS,PRIOR_BACKUP,'RUNTIME_BIND')
template=r'''import contextlib,io,json,pathlib,subprocess,datetime
root=pathlib.Path(ROOT_VALUE);unit=UNIT_VALUE
prior=subprocess.run(['systemctl','show',unit,'--property=LoadState','--value'],capture_output=True,timeout=15)
out=io.StringIO()
with contextlib.redirect_stdout(out):exec(compile(CAPACITY_VALUE,'reviewed-stat-reference','exec'))
capacity=json.loads(out.getvalue())
print(json.dumps({'status':'POST_REBOOT_STAT_ONLY_REFERENCE_NOT_PACKAGE_OR_LAUNCH_AUTHORITY','capacity':capacity,'newRootExists':root.exists(),'newRootSymlink':root.is_symlink(),'newUnitLoadExitCode':prior.returncode,'newUnitLoadStdout':prior.stdout.decode(),'newUnitLoadStderr':prior.stderr.decode(),'rootOrUnitCreated':False,'actualRuntimeGatePerformed':False,'futurePackageNotYetPreparedOrCharged':True,'operations':0}))
'''
program=render(template,{'ROOT_VALUE':str(ROOT),'UNIT_VALUE':'lims-'+ROOT_NAME.lower(),'CAPACITY_VALUE':cap.decode()},'post-reboot-stat-reference')
(dest/'remote-stat-source.py').write_bytes(program)
r=subprocess.run(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=15','root@46.19.33.37','python3','-B','-'],cwd=repo,input=program,capture_output=True,timeout=90)
(dest/'stdout-original.json').write_bytes(r.stdout);(dest/'stderr-original.log').write_bytes(r.stderr)
assert r.returncode==0 and not r.stderr
v=exact_json(r.stdout);required=capacity_gate(v['capacity'],'RUNTIME_BIND',0);assert v['newRootExists'] is False and v['newRootSymlink'] is False and v['newUnitLoadExitCode']==0 and v['newUnitLoadStdout'].strip()=='not-found' and not v['newUnitLoadStderr']
derived={'status':'FRESH_POST_REBOOT_REFERENCE_FITS_EXCLUDING_FUTURE_EXACT_PACKAGE_NOT_LAUNCH_AUTHORITY','closedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'actualSourceHashes':tests['sourceSha256After'],'sourceSha256':sha(program),'rawSha256':sha(r.stdout),'requiredExcludingFuturePackageBytes':required,'freeBytes':v['capacity']['freeBytes'],'slackExcludingFuturePackageBytes':{p:x-required for p,x in v['capacity']['freeBytes'].items()},'newRootAbsent':True,'newUnitUnused':True,'beforeRootAndBeforeUnitFreshExactPackageGatesStillRequired':True,'productionContentOpens':0,'sqlConnections':0,'operations':0}
(dest/'independent-derived-validation.json').write_bytes(canonical(derived)+b'\n')
print(json.dumps(derived))

