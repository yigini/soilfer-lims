"""One source-reviewed isolated operation. No networking, containers or DB writes."""
import os,pathlib,sys,time,datetime,socket,subprocess
from diagnostic_contract import *
from diagnostic_authority import diagnostic_scopes
from diagnostic_io import check_inputs,open_main,Sink
from diagnostic_compare import compare_all
def package_check(root):
    index=strict((root/'source-index.json').read_bytes());review=strict((root/'source-review.json').read_bytes());approval(review,index)
    evidence=strict((root/'current-evidence.json').read_bytes());diagnostic_scopes(evidence['diagnosticScopes'])
    require(evidence['review']['id']==review['id'] and evidence['review']['body']==review['body'],'Runtime exact review binding missing')
    for name,pin in {**index['files'],**index['data']}.items():
        p=root/name;require(p.is_file() and not p.is_symlink() and sha(p.read_bytes())==pin['sha256'] and p.stat().st_size==pin['bytes'],'Runtime package changed')
    spec=strict((root/'diagnostic-spec.json').read_bytes())
    require(spec['root']==str(ROOT) and spec['unit']==UNIT and spec['retryAllowed'] is False and spec['sourceReviewId']==review['id'],'Runtime spec differs')
    return index
def own_events(root,label):
    # Controller evidence only; no production/app memory counters are read.
    membership=pathlib.Path('/proc/self/cgroup').read_text();lines=membership.splitlines()
    require(len(lines)==1 and lines[0].startswith('0::/'),'Unified controller cgroup required')
    part=lines[0][3:];cg=pathlib.Path('/sys/fs/cgroup')/part.lstrip('/')
    require(cg.name==UNIT+'.service' and not cg.is_symlink(),'Exact diagnostic unit cgroup required')
    raws={n:(cg/n).read_bytes() for n in ['memory.events','memory.max','memory.swap.max','memory.peak']}
    sink=Sink(root);sink.write('controller-memory-'+label+'.json',{'membership':membership,'path':str(cg),'raw':{k:v.decode() for k,v in raws.items()}})
    fields={}
    for line in raws['memory.events'].decode().splitlines():
        k,v=line.split();require(k not in fields and v.isdigit(),'Controller memory events malformed');fields[k]=int(v)
    require(fields.get('oom')==fields.get('oom_kill')==0 and raws['memory.max'].strip()==str(MEMORY).encode() and raws['memory.swap.max'].strip()==b'0','Controller memory guard refused')
def run():
    root=pathlib.Path(__file__).resolve().parent;require(str(root)==str(ROOT),'Only exact fresh diagnostic root')
    package_check(root);sink=Sink(root);sink.write('diagnostic-intent.json',{'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'oneAttempt':True,'neverRetry':True,'releaseQualified':False})
    before=None;dbs=[];result=None;failure=None;after=None
    # A Python-level backstop complements systemd PrivateNetwork and an AF_UNIX
    # only sandbox. No child process is necessary for the diagnostic.
    def blocked(*a,**kw):raise RuntimeError('Diagnostic runtime network/subprocess forbidden')
    socket.socket=blocked;socket.create_connection=blocked;subprocess.Popen=blocked;os.system=blocked
    try:
        own_events(root,'before');capacity(os.statvfs(root).f_bavail*os.statvfs(root).f_frsize)
        pins=strict((root/'diagnostic-pins.json').read_bytes())['inputPins']
        before=check_inputs(pins);sink.write('input-before.json',before)
        deadline=time.monotonic()+SECONDS-60
        infos=[]
        for main in MAINS:
            db,info=open_main(pathlib.Path(OLD_ROOT)/main);db.set_progress_handler(lambda:1 if time.monotonic()>deadline else 0,10000);dbs.append(db);infos.append(info)
        sink.write('main-integrity-before-tables.json',infos)
        result=compare_all(dbs[0],dbs[1],strict((root/'first-fetch-original.json').read_bytes()),strict((root/'baseline-logical-original.json').read_bytes()),sink)
    except BaseException as e:failure={'errorType':type(e).__name__,'errorSha256':value_hash(str(e))}
    finally:
        for db in dbs:db.close()
        try:
            if before is not None:
                after=check_inputs(pins,previous=before);sink.write('input-after.json',after)
            own_events(root,'after');capacity(os.statvfs(root).f_bavail*os.statvfs(root).f_frsize)
        except BaseException as e:failure={'errorType':type(e).__name__,'errorSha256':value_hash(str(e)),'resultVoided':True}
    valid=before is not None and after==before and failure is None
    if result is not None:
        result['inputAfterVerifiedCount']=int(valid);result['resultValidCount']=int(valid)
        if not valid:result['status']='DIAGNOSTIC_RESULT_VOID_RETAIN_ALL_NO_RETRY'
        sink.write('public-diagnostic-result.json',result)
    terminal={'status':result['status'] if valid and result else 'DIAGNOSTIC_REFUSED_OR_VOID_RETAIN_ALL_NO_RETRY','failure':failure,'releaseQualified':False,'retryAllowed':False,'rawValuesWithheld':True,'privateFiles':[x for x in sink.files if x['withheld']],'files':sink.files.copy()}
    sink.write('public-terminal.json',terminal)
    # No raw row/metadata/SQL exception text is emitted to stdout or the journal.
    print(canonical({'status':terminal['status'],'releaseQualified':False,'privateFileCount':len(terminal['privateFiles'])}).decode())
    return 0 if valid and result and not result['stopClassifications'] else 1
if __name__=='__main__':sys.exit(run())
