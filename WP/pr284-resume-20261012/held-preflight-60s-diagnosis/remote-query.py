import datetime,json,pathlib,sys,time
root=pathlib.Path('/opt/lims/releases/instrument-import-release-959d17e1-20261012T202400Z');sys.path.insert(0,str(root/'frozen'))
import deploy_import as d
started=time.monotonic()
def event(kind,label,**fields):
    print(json.dumps(dict(kind=kind,label=label,elapsedSeconds=time.monotonic()-started,
        observedUtc=datetime.datetime.now(datetime.timezone.utc).isoformat(),**fields)),flush=True)
def timed(label,original):
    def call(*args,**kwargs):
        before=time.monotonic();event('START',label)
        try:
            result=original(*args,**kwargs)
        except BaseException as exc:
            event('REFUSED',label,durationSeconds=time.monotonic()-before,errorType=type(exc).__name__)
            raise
        event('PASSED',label,durationSeconds=time.monotonic()-before)
        return result
    return call
for name in ['frozen_files','original_proof_files','observe_entry_state','all_writers_stopped','triple_state']:
    setattr(d,name,timed(name,getattr(d,name)))
event('START','execution_preflight',readOnly=True,productionMutations=0,diagnosticOnly=True)
result=d.execution_preflight(root,'02d67dede9fd160f723ff1949353b7a36991d41a34e6c255884282ed07da8bad',require_unused_gate=True)
event('PASSED','execution_preflight',readiness=result,productionMutations=0,diagnosticOnly=True)
