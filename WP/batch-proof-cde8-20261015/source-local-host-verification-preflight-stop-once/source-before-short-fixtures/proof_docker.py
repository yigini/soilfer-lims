"""Only NEW b5 containers on owned bind mounts. Every completed container is retained."""
import datetime, os, pathlib, secrets, subprocess, time
from proof_contract import *
from proof_files import file_state,write_new

WRAPPER="""const fs=require('node:fs'),cp=require('node:child_process');const c=cp.spawnSync(process.execPath,process.argv.slice(1),{stdio:'inherit'});process.stderr.write(JSON.stringify({releaseCliPeakBytes:Number(fs.readFileSync('/sys/fs/cgroup/memory.peak','utf8').trim()),childStatus:c.status,childSignal:c.signal})+'\\n');process.exit(c.status===null?1:c.status);"""
SCRIPTS={'install_lab_policy_schema.js',*[r[1] for r in CHAIN],'order_revision_impact.js','control_chart_prebinding_impact.js'}
def inspect(name):
    r=subprocess.run(['docker','inspect',name],capture_output=True,timeout=15)
    require(r.returncode==0 and len(r.stdout)<4*1024**2,'Bounded container inspection refused');values=exact_json(r.stdout);require(len(values)==1,'Single exact container required');return values[0]
def all_containers():
    r=subprocess.run(['docker','ps','-aq','--no-trunc'],capture_output=True,timeout=15);require(r.returncode==0,'Container inventory failed')
    ids=r.stdout.decode().splitlines();require(len(ids)==len(set(ids)) and len(ids)<=4096,'Container inventory exceeded bound')
    rows={}
    for id in ids:
        v=inspect(id);rows[id]={'name':v['Name'],'image':v['Image'],'running':v['State']['Running'],'startedAt':v['State']['StartedAt'],'labels':v['Config'].get('Labels') or {},'mounts':v['Mounts']}
    return rows
def preserved_containers(before,after):
    require(set(before)<=set(after),'A pre-existing container was deleted')
    for id,row in before.items():
        v=after[id];require(row['name']==v['name'] and row['image']==v['image'] and row['labels']==v['labels'] and row['mounts']==v['mounts'],'Pre-existing container changed')
        if not row['running']:require(v['running'] is False and row['startedAt']==v['startedAt'],'A historical stopped container was started')
def arguments(root,label,data,tmp,script=None,mode=None,assets=None):
    require(re.fullmatch('[a-z0-9-]+',label),'Safe unique container label required');data=child_path(root,data);tmp=child_path(root,tmp)
    name='lims-owned-batch-'+sha((str(root)+':'+label).encode())[:24];owner=str(root)+':'+label
    args=['docker','create','--name',name,'--label','io.soilfer.release-owned='+owner,'--network','none','--memory',str(MEMORY),'--memory-swap',str(MEMORY),'--restart','no','-e','NODE_OPTIONS=','-e','ALLOW_PRISMA_DB_PUSH=false','-e','ALLOW_AUTO_SEED=false','-e','DISABLE_BACKGROUND_JOBS=true','-e','DATABASE_PATH=/app/server/prisma/dev.db','-e','DATABASE_URL=file:/app/server/prisma/dev.db','-e','TMPDIR=/tmp','-e','TMP=/tmp','-e','TEMP=/tmp','--mount','type=bind,src='+str(data)+',dst=/app/server/prisma','--mount','type=bind,src='+str(tmp)+',dst=/tmp']
    if script:
        require(script in SCRIPTS and mode in [None,'--dry-run','--apply'],'Installer whitelist refused')
        require(mode is None if script.endswith('_impact.js') else mode is not None,'Mode/script mismatch')
        args+=['--entrypoint','node',IMAGE,'-e',WRAPPER,'/app/server/scripts/'+script,'--db','/app/server/prisma/dev.db']+([mode] if mode else [])
    else:
        assets=child_path(root,assets);args+=['-e','JWT_SECRET='+secrets.token_hex(32),'--mount','type=bind,src='+str(assets)+',dst=/app/server/uploads',IMAGE]
    return name,owner,args
class Docker:
    def __init__(self,root,disk):self.root=pathlib.Path(root);self.disk=disk;self.created=[]
    def command(self,args,label,timeout=30):
        self.disk.time_guard(timeout);self.disk.check();out=self.root/(label+'.stdout');err=self.root/(label+'.stderr');started=time.monotonic();code=None;failure=None
        with out.open('xb') as o,err.open('xb') as e:
            process=subprocess.Popen(args,stdout=o,stderr=e)
            try:
                while process.poll() is None:
                    self.disk.check();require(time.monotonic()-started<timeout,'Command deadline reached')
                    require(out.stat().st_size<=OUTPUT_LIMIT and err.stat().st_size<=OUTPUT_LIMIT,'Command output bound reached')
                    time.sleep(0.25)
                code=process.returncode
            except BaseException as x:
                failure=type(x).__name__+': '+str(x)
                # Stop only this owned transport process. The caller stops and retains
                # its exact labelled container; no Docker/containerd daemon is touched.
                process.terminate()
                try:process.wait(timeout=5)
                except subprocess.TimeoutExpired:process.kill();process.wait(timeout=5)
        out.chmod(0o400);err.chmod(0o400);write_new(self.root/(label+'-exit.json'),{'exitCode':code,'error':failure,'elapsedSeconds':time.monotonic()-started,'neverRetry':True})
        require(out.stat().st_size<=OUTPUT_LIMIT and err.stat().st_size<=OUTPUT_LIMIT and failure is None and code==0,'Bounded command failed; retain same container and forward-fix only '+label)
        return out.read_bytes(),err.read_bytes()
    def create(self,label,data,tmp,script=None,mode=None,assets=None):
        require(not pathlib.Path(tmp).exists(),'Temporary retention directory consumed');pathlib.Path(tmp).mkdir(mode=0o700)
        name,owner,args=arguments(self.root,label,data,tmp,script,mode,assets)
        absent=subprocess.run(['docker','inspect',name],capture_output=True,timeout=15)
        require(absent.returncode!=0 and b'No such object' in absent.stderr,'Container name not proven unused')
        write_new(self.root/(label+'-intent.json'),{'name':name,'owner':owner,'image':IMAGE,'script':script,'mode':mode,'data':str(data),'retainedContainer':True,'forwardOnly':True,'productionDatabaseMounts':0})
        raw,_=self.command(args,label+'-create',30);id=raw.decode().strip();require(re.fullmatch('[a-f0-9]{64}',id),'Created container ID missing');self.created.append((id,owner));self.validate(id,owner,data,tmp,running=False)
        return id,owner
    def validate(self,id,owner,data,tmp,running):
        v=inspect(id);env=dict(s.split('=',1) for s in v['Config']['Env'] if '=' in s);m={r['Destination']:r for r in v['Mounts']}
        require(v['Id']==id and v['Image']==IMAGE and v['Config']['Labels']['io.soilfer.release-owned']==owner and v['RestartCount']==0 and not v['State']['OOMKilled'] and v['State']['Running'] is running,'Owned candidate identity/state changed')
        require(v['HostConfig']['Memory']==MEMORY and v['HostConfig']['MemorySwap']==MEMORY and v['HostConfig']['NetworkMode']=='none' and v['HostConfig']['RestartPolicy']['Name']=='no','Runtime bounds changed')
        require(all(env.get(k)==value for k,value in {'NODE_OPTIONS':'','ALLOW_PRISMA_DB_PUSH':'false','ALLOW_AUTO_SEED':'false','DISABLE_BACKGROUND_JOBS':'true'}.items()),'Runtime flags changed')
        for dst,path in [('/app/server/prisma',data),('/tmp',tmp)]:require(m[dst]['Type']=='bind' and pathlib.Path(m[dst]['Source']).resolve()==pathlib.Path(path).resolve() and m[dst]['RW'] is True,'Owned mount differs')
        require(all(r['Type']=='bind' and pathlib.Path(self.root).resolve() in pathlib.Path(r['Source']).resolve().parents for r in v['Mounts']),'Production or unrelated mount refused')
        return v
    def stop(self,id,owner,label):
        require((id,owner) in self.created,'Only a container created by THIS controller can stop')
        v=inspect(id);require(v['Image']==IMAGE and v['Config']['Labels'].get('io.soilfer.release-owned')==owner,'Only exact NEW candidate may stop')
        if v['State']['Running']:
            # Emergency stop is independent of a failed reserve/headroom guard.
            # Perform the strictly-owned bounded stop BEFORE trying to retain output;
            # even a full filesystem must not prevent stopping this owned writer.
            result=subprocess.run(['docker','stop','-t','10',id],capture_output=True,timeout=30)
            require(result.returncode==0 and len(result.stdout)<=65536 and len(result.stderr)<=65536,'Owned stop failed; inspect same retained container')
            require(inspect(id)['State']['Running'] is False,'Owned writer remains; STOP')
            for suffix,raw in [('stdout',result.stdout),('stderr',result.stderr)]:
                p=self.root/(label+'-emergency-stop-'+suffix+'.log')
                with p.open('xb') as f:f.write(raw)
                p.chmod(0o400)
        require(inspect(id)['State']['Running'] is False,'Owned writer remains; STOP')
    def cli(self,label,data,script,mode=None):
        tmp=self.root/(label+'-retained-temp');id,owner=self.create(label,data,tmp,script,mode)
        try:
            raw,err=self.command(['docker','start','-a',id],label+'-run',CLI_SECONDS);v=self.validate(id,owner,data,tmp,False)
            measures=[exact_json(l) for l in err.splitlines() if l.startswith(b'{"releaseCliPeakBytes":')]
            require(v['State']['ExitCode']==0 and len(measures)==1 and measures[0]['childStatus']==0 and measures[0]['childSignal'] is None and 0<measures[0]['releaseCliPeakBytes']<=MEMORY,'CLI exit/memory evidence refused')
            write_new(self.root/(label+'-measurement.json'),{'name':v['Name'],'id':id,'retainedStopped':True,'measurement':measures[0]})
            return exact_json(raw)
        finally:self.stop(id,owner,label)
    def stop_all(self):
        errors=[]
        for number,(id,owner) in enumerate(self.created):
            try:self.stop(id,owner,'terminal-'+str(number))
            except BaseException as e:errors.append({'id':id,'error':str(e)})
        require(not errors,'Owned writers need attention '+str(errors))
