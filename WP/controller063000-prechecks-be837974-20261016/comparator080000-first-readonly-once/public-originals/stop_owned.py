"""ExecStopPost: stop and retain only this reviewed root's exact two owners.

Runs on normal exit, failure, timeout and SIGKILL. No reserve guard or memory
read is allowed to prevent the actual bounded stop of an owned writer.
"""
import hashlib,json,pathlib,re,subprocess,time,os
from proof_contract import ROOT,IMAGE,require,canonical,graph,approval
from controller_guard import own_snapshot
OWNERS={str(ROOT)+':'+label for label in ['startup-1','startup-2']}
LABEL='io.soilfer.release-owned'
def selected(v,owner):
    require(owner in OWNERS and v.get('Id') and re.fullmatch('[a-f0-9]{64}',v['Id']),'Exact root owner and full ID required')
    label=owner.rsplit(':',1)[1];name='/lims-owned-batch-'+hashlib.sha256(owner.encode()).hexdigest()[:24]
    require(v.get('Name')==name and v.get('Image')==IMAGE and v.get('Config',{}).get('Labels',{}).get(LABEL)==owner,'Stop identity differs')
    require(v['HostConfig']['RestartPolicy']['Name']=='no','Stop restart policy differs')
    require(v['Mounts'] and all(m.get('Type')=='bind' and m.get('RW') is True and pathlib.PurePosixPath(str(ROOT)) in pathlib.PurePosixPath(m.get('Source','')).parents for m in v['Mounts']),'Stop mount ownership differs')
    expected={'/app/server/prisma':str(ROOT/(label+'-database')),'/app/server/uploads':str(ROOT/(label+'-assets')),'/tmp':str(ROOT/(label+'-retained-temp'))}
    require(len(v['Mounts'])==3 and {m['Destination']:m['Source'] for m in v['Mounts']}==expected,'Stop exact mount inventory differs')
    return {'id':v['Id'],'owner':owner,'name':v['Name'],'image':v['Image'],'running':v['State']['Running'],'startedAt':v['State']['StartedAt'],'mounts':v['Mounts']}

_record_root=None
_sequence=0
def configure_records(root):
    global _record_root
    require(_record_root is None,'Docker record sink consumed')
    root=pathlib.Path(root)
    require(root.is_dir() and not root.is_symlink(),'Docker record directory required')
    _record_root=root

def call(args):
    """Retain both complete streams on host BEFORE checking any response predicate.

    Inspect contains secrets. Only the per-call metadata may be published.
    All argument values are fixed Docker verbs, exact ids or exact owner labels.
    """
    global _sequence
    require(_record_root is not None,'Docker records must precede commands')
    require(isinstance(args,list) and args[:1]==['docker'] and len(args)>=2,'Exact Docker argument vector required')
    _sequence+=1;label='docker-call-'+str(_sequence).zfill(3)
    paths={s:_record_root/('private-'+label+'-'+s+'.bin') for s in ['stdout','stderr']}
    begin=time.monotonic();error=None;code=None
    # Files are created 0400. The already-open exclusive descriptors remain
    # writable by this child; there is never a public raw-inspect copy.
    handles={}
    try:
        for name,p in paths.items():
            fd=os.open(str(p),os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o400)
            handles[name]=os.fdopen(fd,'wb')
        try:
            result=subprocess.run(args,stdout=handles['stdout'],stderr=handles['stderr'],timeout=30)
            code=result.returncode
        except BaseException as e:error=e
    finally:
        for f in handles.values():f.flush();os.fsync(f.fileno());f.close()
        records={}
        for name,p in paths.items():
            if p.exists():
                digest=hashlib.sha256()
                with p.open('rb') as f:
                    for chunk in iter(lambda:f.read(1024**2),b''):digest.update(chunk)
                records[name]={'path':p.name,'sha256':digest.hexdigest(),'bytes':p.stat().st_size,'hostOnly':True,'mode':p.stat().st_mode&0o777}
            else:records[name]=None
        metadata={'argv':args,'returnCode':code,'elapsedSeconds':time.monotonic()-begin,'streams':records,'transportErrorType':type(error).__name__ if error else None,'rawInspectStdoutNeverFetched':True}
        with (_record_root/(label+'.json')).open('xb') as f:f.write(canonical(metadata)+b'\n')
        (_record_root/(label+'.json')).chmod(0o400)
    if error is not None:raise error
    require(code==0 and records['stdout']['bytes']<=4*1024**2 and records['stderr']['bytes']<=65536 and records['stderr']['bytes']==0,'Bounded exact-owner stop interface failed')
    return paths['stdout'].read_bytes()

def stop_exact(call_interface=call):
    out=[];errors=[]
    for owner in sorted(OWNERS):
        phase='inventory'
        try:
            raw=call_interface(['docker','ps','-aq','--no-trunc','--filter','label='+LABEL+'='+owner]);ids=raw.decode('ascii').splitlines()
            require(len(ids)<=1 and len(ids)==len(set(ids)) and all(re.fullmatch('[a-f0-9]{64}',x) for x in ids),'Exact-owner inventory malformed or duplicated')
            for id in ids:
                phase='inspect-before';rows=json.loads(call_interface(['docker','inspect',id]));require(len(rows)==1,'Single owned inspect required');before=selected(rows[0],owner)
                if before['running']:
                    phase='stop';call_interface(['docker','stop','-t','10',id])
                phase='inspect-after';rows=json.loads(call_interface(['docker','inspect',id]));require(len(rows)==1,'Single stopped inspect required');after=selected(rows[0],owner)
                phase='compare';require(after['running'] is False and all(after[k]==before[k] for k in ['id','owner','name','image','startedAt','mounts']),'Exact owned container remains running or changed')
                out.append({'before':before,'after':after,'retained':True})
        except BaseException as e:errors.append({'owner':owner,'phase':phase,'errorType':type(e).__name__,'_privateException':e})
    return {'stoppedAndRetained':out,'errors':errors,'allExactOwnedStopped':not errors,'productionActions':0,'foreignContainersStopped':0}

def public_result(result):
    # Must be called only AFTER the private key exists, like postStopErrors.
    from provenance_privacy import public_failure
    return {**result,'errors':[{k:v for k,v in e.items() if k not in ['_privateException','errorType']}|public_failure(e['_privateException']) for e in result['errors']]}

def readonly_call(args):
    require(len(args)>1 and args[:1]==['docker'] and args[1] in ('ps','inspect'),'Read-only hook check permits only ps and inspect')
    return call(args)

if __name__=='__main__':
    raise RuntimeError('Only the separately reviewed diagnostic runtime may invoke this hook check')
