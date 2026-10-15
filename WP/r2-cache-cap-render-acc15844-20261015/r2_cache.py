"""Bounded exact-ID R2 controller. Executable only inside its reviewed new package."""
import datetime,http.client,os,pathlib,re,socket,stat,subprocess,time,threading
from r2_contract import *

def utc():return datetime.datetime.now(datetime.timezone.utc).isoformat()
class Sink:
    def __init__(self,root):self.root=root;self.total=0;self.serial=0
    def raw(self,name,raw):
        require(len(raw)<=RAW_LIMIT and self.total+len(raw)<=TOTAL_LOG_LIMIT,'Evidence byte bound; retain all and STOP')
        self.total+=len(raw)
        p=self.root/name
        fd=os.open(str(p),os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o400)
        with os.fdopen(fd,'wb') as f:f.write(raw);f.flush();os.fsync(f.fileno())
        return {'path':str(p),'bytes':len(raw),'sha256':sha(raw)}
    def record(self,name,value):return self.raw(name,canonical(value)+b'\n')
    def event(self,label,value):
        self.serial+=1
        return self.record('%05d-%s.json'%(self.serial,label),{'utc':utc(),**value})
class UnixDocker(http.client.HTTPConnection):
    def connect(self):
        self.sock=socket.socket(socket.AF_UNIX,socket.SOCK_STREAM);self.sock.settimeout(30);self.sock.connect('/var/run/docker.sock')
class Backend:
    def __init__(self,sink):
        self.sink=sink;self.start=time.monotonic();self.calls=0;self.commands=0
        self.env={k:v for k,v in os.environ.items() if k not in ['DOCKER_HOST','DOCKER_CONTEXT','BUILDX_BUILDER','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH','NODE_OPTIONS']}
        self.env.update(DOCKER_CONFIG=str(sink.root/'docker-client'),BUILDX_CONFIG=str(sink.root/'buildx-client'),TMPDIR=str(sink.root/'tmp'))
        for n in ['docker-client','buildx-client','tmp']:(sink.root/n).mkdir(mode=0o700)
    def check(self,seconds=0):require(time.monotonic()-self.start+seconds<RUN_SECONDS,'Controller deadline; never retry')
    def api(self,path,retain=True):
        require(path in ['/version','/v1.52/system/df','/v1.52/images/json?all=1&manifests=true','/v1.52/containers/json?all=1'] or re.fullmatch('/v1.52/containers/[a-f0-9]{64}/json',path),'Docker GET endpoint outside whitelist')
        self.check(30);self.calls+=1;require(self.calls<=API_CALL_LIMIT,'API call bound')
        c=UnixDocker('localhost',timeout=30)
        try:c.request('GET',path);r=c.getresponse();raw=r.read(RAW_LIMIT+1);require(len(raw)<=RAW_LIMIT and r.status==200,'Incomplete/error Docker GET')
        finally:c.close()
        value=json_exact(raw)
        if retain:self.sink.event('api-read',{'endpoint':path,'rawUtf8':raw.decode(),'sha256':sha(raw),'exitCode':0})
        return value
    def command(self,args,timeout=30):
        self.check(timeout);self.commands+=1
        self.sink.event('command-intent',{'argv':args,'timeoutSeconds':timeout,'neverRetry':True})
        p=subprocess.Popen(args,stdout=subprocess.PIPE,stderr=subprocess.PIPE,env=self.env)
        streams=[bytearray(),bytearray()];overflow=threading.Event();lock=threading.Lock()
        def reader(pipe,slot):
            while True:
                chunk=pipe.read(65536)
                if not chunk:break
                with lock:
                    room=2*1024**2-sum(map(len,streams));streams[slot].extend(chunk[:max(0,room)])
                    if len(chunk)>room:overflow.set();p.kill();break
        workers=[threading.Thread(target=reader,args=(pipe,i),daemon=True) for i,pipe in enumerate([p.stdout,p.stderr])]
        for t in workers:t.start()
        failed=None
        try:p.wait(timeout=timeout)
        except subprocess.TimeoutExpired:failed='TIMEOUT_UNKNOWN_NEVER_REPLAY';p.kill();p.wait(timeout=5)
        for t in workers:t.join(timeout=5)
        require(not any(t.is_alive() for t in workers),'Output reader incomplete; unknown outcome')
        value={'argv':args,'exitCode':p.returncode,'stdout':bytes(streams[0]).decode('utf-8','replace'),'stderr':bytes(streams[1]).decode('utf-8','replace'),'error':failed,'outputTruncated':overflow.is_set()}
        self.sink.event('command-result',value)
        require(failed is None and not overflow.is_set(),'Command timeout/output bound; partial raw retained and unknown mutation outcome; never retry')
        return value
    def successful(self,args):
        r=self.command(args);require(r['exitCode']==0 and r['stderr']=='','Command failed/noisy; STOP');return r['stdout']
    def interfaces(self):
        version=self.successful(['docker','buildx','version'])
        require(version=='github.com/docker/buildx v0.30.1 9e66234aa13328a5e75b75aa5574e1ca6d6d9c01\n','Installed Buildx bytes/version changed')
        info=self.successful(['docker','buildx','inspect','default'])
        require(re.findall(r'^Name:\s+(\S+)\s*$',info,re.M)==['default','default'] and re.findall(r'^Driver:\s+(\S+)\s*$',info,re.M)==['docker'] and re.findall(r'^Endpoint:\s+(\S+)\s*$',info,re.M)==['default'] and re.findall(r'^Status:\s+(\S+)\s*$',info,re.M)==['running'],'Single default Docker builder required')
        context=json_exact(self.successful(['docker','context','inspect','default']))
        require(len(context)==1 and context[0]['Name']=='default' and context[0]['Endpoints']['docker']=={'Host':'unix:///var/run/docker.sock','SkipTLSVerify':False},'Default Unix Docker endpoint required')
        v=self.api('/version');require(v.get('ApiVersion')=='1.52','Reviewed API version changed')
    def inventory(self):return cache_rows(self.api('/v1.52/system/df').get('BuildCache'))
    def preservation(self):
        containers=self.api('/v1.52/containers/json?all=1',False)
        require(type(containers) is list and len(containers)<=MAX_CONTAINERS,'Container inventory bound')
        result={}
        for row in containers:
            ident=row.get('Id');require(type(ident) is str and re.fullmatch('[a-f0-9]{64}',ident) and ident not in result,'Invalid/duplicate container ID')
            v=self.api('/v1.52/containers/'+ident+'/json',False)
            require(v.get('Id')==ident and type(v.get('Mounts')) is list,'Full inspected container identity required')
            mounts=sorted(canonical(m).decode() for m in v['Mounts']);require(len(mounts)==len(set(mounts)),'Duplicate mount')
            state=v['State'];result[ident]={'Id':ident,'Name':v['Name'],'Image':v['Image'],'Labels':v['Config'].get('Labels'),
                'Mounts':mounts,'Status':state['Status'],'StartedAt':state['StartedAt'],'OOMKilled':state['OOMKilled'],'RestartCount':v['RestartCount']}
        images=self.api('/v1.52/images/json?all=1&manifests=true')
        require(type(images) is list and len(images)<=MAX_IMAGES,'Image inventory bound')
        byid={}
        for row in images:
            ident=row.get('Id');require(type(ident) is str and re.fullmatch('sha256:[a-f0-9]{64}',ident) and ident not in byid,'Invalid/duplicate image ID')
            # Exclude only derived usage counts; preserve every image, tag, digest and manifest record.
            byid[ident]={k:v for k,v in row.items() if k not in ['Containers','SharedSize','VirtualSize']}
            for key in ['RepoTags','RepoDigests']:
                if byid[ident].get(key) is not None:byid[ident][key]=sorted(byid[ident][key])
        value={'containers':result,'images':byid}
        require('8109d78e228573ead8aa243442192e54b8e1dc09101bc3fa23d03e5a29cbb66b' in result and IMAGE in byid,'Known normal predecessor and qualified candidate must be present in complete inventories')
        self.sink.event('safe-selected-preservation',{'value':value,'rawContainerConfigAndEnvironmentRetained':False})
        return value
    def df(self):
        self.check();rows={}
        for p in ['/opt/lims','/var/lib/docker','/var/lib/containerd']:
            q=pathlib.Path(p)
            for ancestor in [q,*q.parents]:require(not ancestor.is_symlink(),'Filesystem ancestor alias')
            s=q.stat();v=os.statvfs(p)
            rows[p]={'realpath':str(q.resolve()),'device':s.st_dev,'block':v.f_frsize,'available':v.f_bavail*v.f_frsize}
        self.sink.event('df',{'statvfs':rows,'dfOriginal':self.successful(['df','-B1','--output=source,fstype,size,used,avail,target','/opt/lims','/var/lib/docker','/var/lib/containerd'])})
        return validate_df(rows)
    def du(self,wanted):
        raw=self.successful(['docker','buildx','--builder','default','du','--filter','id=^'+cache_id(wanted['ID'])+'$','--format','json'])
        return [json_exact(line) for line in raw.splitlines() if line.strip()]
    def prune(self,ident):return self.command(prune_argv(ident),120)

def maintain(backend,sink):
    """Actual controller core; fake backend tests exercise this same path."""
    backend.interfaces();initial=backend.inventory();preserved=backend.preservation();first_df=backend.df()
    chosen=plan(initial)
    sink.event('closed-plan',{'items':chosen,'initialLogicalCacheBytes':logical_bytes(initial),'protectedLogicalBytes':sum(r['Size'] for r in initial.values() if protected(r)),
        'capBytes':CAP,'limit':MAX_ITEMS,'allInUseAndImageSharedProtected':True,'bytesAreLogicalNotPhysicalReclaim':True})
    items=[];invocations=0
    for wanted in chosen:
        backend.check(180);before=backend.inventory()
        if logical_bytes(before)<=CAP:break
        reason=eligible(wanted,before)
        if reason:
            item={'ID':wanted['ID'],'status':'SKIPPED','reason':reason,'plannedLogicalBytes':wanted['Size'],'sha256':None,'sha256Reason':'Cache record is not a standalone file'}
            sink.event('item-receipt',item);items.append(item);continue
        require(backend.preservation()==preserved,'Container/image references changed; no cache operation')
        du_guard(backend.du(wanted),wanted)
        before=backend.inventory();reason=eligible(wanted,before)
        if reason:
            item={'ID':wanted['ID'],'status':'SKIPPED','reason':reason,'plannedLogicalBytes':wanted['Size']};sink.event('item-receipt',item);items.append(item);continue
        df_before=backend.df()
        sink.event('prune-intent',{'ID':wanted['ID'],'argv':prune_argv(wanted['ID']),'dfBefore':df_before,'cacheReferenceCheck':before[wanted['ID']],
            'allImagesAndContainersPreserved':True,'childReferences':[],'maxUsedSpaceBytes':CAP,'neverReplay':True})
        invocations+=1;outcome=None;df_after=None
        try:
            outcome=backend.prune(wanted['ID'])
            # Even an error is a consumed invocation. No second prune of any ID.
            after=backend.inventory();df_after=backend.df();current_preservation=backend.preservation()
            removed=removal_guard(before,after,wanted['ID'],outcome['stdout'])
        except Exception as e:
            sink.event('item-receipt',{'ID':wanted['ID'],'status':'UNKNOWN_OR_OUTSIDE_CHANGE_STOP_NEVER_RETRY','plannedLogicalBytes':wanted['Size'],
                'sha256':None,'sha256Reason':'Cache record has no standalone file digest','referenceChecks':before[wanted['ID']],
                'dfBefore':df_before,'dfAfter':df_after,'error':type(e).__name__+': '+str(e),'capturedOutcome':outcome,'retryAllowed':False})
            raise
        item={'ID':wanted['ID'],'status':'REMOVED' if removed else 'NOT_REMOVED','plannedLogicalBytes':wanted['Size'],'sha256':None,
            'sha256Reason':'Cache record has no standalone file digest','referenceChecks':before[wanted['ID']],
            'dfBefore':df_before,'dfAfter':df_after,'actualRemovedIds':removed,'exitCode':outcome['exitCode'],'stdoutSha256':sha(outcome['stdout'].encode()),
            'allImagesAndContainersPreserved':current_preservation==preserved,'maxUsedSpaceBytes':CAP,'neverReplay':True}
        sink.event('item-receipt',item);items.append(item)
        require(current_preservation==preserved,'Container/image preservation changed; STOP after retained receipt')
        require(outcome['exitCode']==0 and outcome['stderr']=='','Prune failed/noisy: consumed, no retry')
    final=backend.inventory();last_df=backend.df();require(backend.preservation()==preserved,'Final image/container preservation differs')
    # Original protected records must remain even if the cap cannot be met.
    for ident,row in initial.items():
        if protected(row):require(ident in final and final[ident]['Size']==row['Size'],'Original protected cache missing/changed')
    size=logical_bytes(final)
    return {'status':'R2_CAP_MET' if size<=CAP else 'R2_CAP_NOT_REACHED_ALL_REMAINING_RECORDS_RETAINED_NO_RETRY',
        'capBytes':CAP,'remainingLogicalCacheBytes':size,'protectedLogicalBytes':sum(r['Size'] for r in final.values() if protected(r)),
        'actualPruneInvocations':invocations,'items':items,'dfBefore':first_df,'dfAfter':last_df,'bytesAreLogicalNotPhysicalReclaim':True,
        'buildImage':IMAGE,'qualifiedBuildReceiptSha256':BUILD_RECEIPT_SHA,'cleanedImagesContainersVolumesFilesBackups':0,'retryAllowed':False}

def run():
    require(sys_flags_plain(),'Plain unoptimized Python required')
    root=pathlib.Path(ROOT);require(pathlib.Path.cwd()==root and root.resolve()==root and not root.is_symlink(),'Exact new reviewed root required')
    sink=Sink(root);backend=None
    try:
        index=json_exact((root/'source-index.json').read_bytes());review=json_exact((root/'source-review.json').read_bytes())
        spec=json_exact((root/'package-input.json').read_bytes())
        validate_package(spec,index,review,{p.name:p.read_bytes() for p in root.iterdir() if p.is_file()})
        for n,r in index['files'].items():require(sha((root/n).read_bytes())==r['sha256'] and oid((root/n).read_bytes())==r['blob'],'Reviewed executable source differs')
        expected=validate_build((root/'qualified-build-receipt.json').read_bytes(),(root/'qualified-image-inspect.json').read_bytes())
        backend=Backend(sink)
        current=json_exact(backend.successful(['docker','image','inspect',IMAGE]));require(current==[expected],'Entire qualified image differs before maintenance')
        original=pathlib.Path(BUILD_ROOT)/'build-receipt.json'
        require(original.is_file() and not original.is_symlink() and stat.S_IMODE(original.stat().st_mode)==0o400 and sha(original.read_bytes())==BUILD_RECEIPT_SHA,'Original successful receipt missing/changed')
        result=maintain(backend,sink)
        require(json_exact(backend.successful(['docker','image','inspect',IMAGE]))==[expected],'Entire qualified image differs after maintenance')
        sink.record('terminal-receipt.json',{'closedUtc':utc(),**result});print(json.dumps(result));return 0
    except Exception as e:
        sink.record('terminal-failure.json',{'closedUtc':utc(),'status':'R2_FAILED_RETAIN_ALL_UNKNOWN_MUTATIONS_NEVER_RETRY','error':type(e).__name__+': '+str(e),'image':IMAGE,'retryAllowed':False})
        raise
def sys_flags_plain():
    import sys
    return sys.flags.optimize==0
if __name__=='__main__':raise SystemExit(run())
