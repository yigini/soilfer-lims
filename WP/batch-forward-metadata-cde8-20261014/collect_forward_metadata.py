"""One source-approved bounded read-only metadata capture; produces no adoption receipt."""
import datetime,hashlib,json,os,pathlib,re,shutil,stat,subprocess,sys,time
from forward_metadata_contract import *
ROOT=pathlib.Path(__file__).resolve().parent
def new_file(name,raw):
    with (ROOT/name).open('xb') as f:f.write(raw)
    (ROOT/name).chmod(0o400)
def save(name,value):new_file(name,(json.dumps(value,indent=2,ensure_ascii=False)+'\n').encode())
def main():
    require(os.geteuid()==0 and sys.flags.optimize==0 and ROOT.parent==pathlib.Path('/opt/lims/releases') and not ROOT.is_symlink(),'Exact root/plain Python required')
    initial_inventory({p.name:{'regular':p.is_file(),'symlink':p.is_symlink(),'bytes':p.stat().st_size,'mode':stat.S_IMODE(p.stat().st_mode)} for p in ROOT.iterdir()})
    load=lambda n:exact_json((ROOT/n).read_bytes())
    spec,index,review,scope,reference=[load(n) for n in ['metadata-input.json','tooling-source-index.json','source-review-original.json','scope-direction-original.json','reference-direction-original.json']]
    validate_spec(spec,index,review,scope,reference);require(str(ROOT)==str(safe_root(spec['rootName'])),'Wrong evidence root')
    for n,v in index['files'].items():require(sha((ROOT/n).read_bytes())==v['sha256'],'Executed metadata source changed')
    original=pathlib.Path(OLD_ROOT)
    require(original.is_dir() and not original.is_symlink() and not (original/'image-inspect-original.json').exists(),'Original failed root/inspect absence changed')
    for n in ['candidate-image.id','docker-build.log']:
        p=original/n;require(p.is_file() and not p.is_symlink() and p.stat().st_size==REFS[n]['bytes'] and stat.S_IMODE(p.stat().st_mode)==REFS[n]['mode'] and sha(p.read_bytes())==REFS[n]['sha256'],'Original failed reference changed '+n)
    for n,row in REFS.items():require((ROOT/n).stat().st_size==row['bytes'] and sha((ROOT/n).read_bytes())==row['sha256'],'Retained reference byte mismatch '+n)
    require((ROOT/'candidate-image.id').read_text().strip()==IMAGE,'Original image ID differs');exported_image((ROOT/'docker-build.log').read_text())
    failure=load('original-failure.json');require(failure['status']=='FAILED_OR_RESERVE_REFUSED_BUILD_ONLY_RETAIN_ALL' and failure['exitCode']==0 and failure['error']=='Unexplained disk growth reached the 500MB abort boundary','Original failed gate differs')
    require(sha((original/'build-terminal-failure.json').read_bytes())==sha((ROOT/'original-failure.json').read_bytes()),'Failed record changed')
    filesystems=['/opt/lims','/var/lib/docker','/var/lib/containerd']
    require(all(pathlib.Path(p).is_dir() and not pathlib.Path(p).is_symlink() for p in filesystems),'Bound filesystem aliases refuse')
    before={p:{'device':os.stat(p).st_dev,'freeBytes':shutil.disk_usage(p).free} for p in filesystems}
    require(min(v['freeBytes'] for v in before.values())>=FLOOR,'Current filesystem reserve refused')
    save('metadata-intent.json',{'status':'FIRST_METADATA_CAPTURE_ATTEMPTED_ONCE','startedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'scope':SCOPE,'sourceReviewId':review['id'],'neverReplay':True,'imageEligibility':False})
    for n in ['docker-client','buildx-client','cache','tmp']:(ROOT/n).mkdir(mode=0o700)
    env=dict(os.environ);env.update(DOCKER_CONFIG=str(ROOT/'docker-client'),DOCKER_HOST='unix:///var/run/docker.sock',DOCKER_CONTEXT='',BUILDX_CONFIG=str(ROOT/'buildx-client'),XDG_CACHE_HOME=str(ROOT/'cache'),TMPDIR=str(ROOT/'tmp'),TMP=str(ROOT/'tmp'),TEMP=str(ROOT/'tmp'))
    started=time.monotonic();calls=[];problems=[];manifests={}
    def call(argv,label,required=True):
        allowed_command(argv);require(len(calls)<MAX_COMMANDS,'Metadata call count reached bound')
        left=COLLECTION_TIMEOUT-(time.monotonic()-started);require(left>0,'Metadata collection deadline reached')
        name='%03d-%s'%(len(calls),label);out=ROOT/(name+'.stdout');err=ROOT/(name+'.stderr')
        begin=time.monotonic();process=None;timed=False
        with out.open('xb') as stdout,err.open('xb') as stderr:
            process=subprocess.Popen(argv,stdout=stdout,stderr=stderr,env=env)
            while process.poll() is None:
                if time.monotonic()-begin>=min(CALL_TIMEOUT,left) or out.stat().st_size>MAX_OUTPUT or err.stat().st_size>MAX_OUTPUT:
                    process.kill();process.wait(timeout=5);timed=True;break
                time.sleep(0.02)
        out.chmod(0o400);err.chmod(0o400)
        row={'argv':argv,'label':label,'exitCode':process.returncode,'timeoutOrOutputRefused':timed,'elapsedSeconds':time.monotonic()-begin,'stdout':{'file':out.name,'bytes':out.stat().st_size,'sha256':sha(out.read_bytes())},'stderr':{'file':err.name,'bytes':err.stat().st_size,'sha256':sha(err.read_bytes())}}
        calls.append(row);save(name+'.call.json',row)
        if out.stat().st_size>MAX_OUTPUT or err.stat().st_size>MAX_OUTPUT:timed=True
        if timed or process.returncode!=0:
            problems.append({'label':label,'exitCode':process.returncode,'timeoutOrOutputRefused':timed,'required':required});return None
        return out.read_bytes()
    try:
        fresh=call(['docker','image','inspect',IMAGE],'candidate-image-inspect')
        require(fresh is not None,'Read-only candidate inspect failed');candidate=exact_json(fresh)[0];compare_image(load('candidate-image-fresh-inspect-original.json')[0],candidate)
        for fmt,wanted in [('{{.DockerRootDir}}','/var/lib/docker'),('{{.Driver}}','overlayfs')]:
            raw=call(['docker','info','--format',fmt],'docker-'+('root' if 'Root' in fmt else 'driver'))
            require(raw is not None and raw.decode().strip()==wanted,'Actual Docker topology changed')
        driver=call(['docker','info','--format','{{json .DriverStatus}}'],'docker-driver-status')
        require(driver is not None and ['driver-type','io.containerd.snapshotter.v1'] in exact_json(driver),'Snapshotter topology changed')
        namespaces=call(['ctr','--address',SOCKET,'namespaces','list'],'containerd-namespaces')
        require(namespaces is not None,'Read-only namespace catalogue missing')
        names={line.split()[0] for line in namespaces.decode().splitlines()[1:] if line.split()}
        for ns in NAMESPACES:
            if ns not in names:continue
            prefix=['ctr','--address',SOCKET,'--namespace',ns]
            call(prefix+['images','list'],ns+'-images')
            call(prefix+['content','list'],ns+'-content')
            snapshots=call(prefix+['snapshots','--snapshotter','overlayfs','list'],ns+'-snapshots')
            if snapshots is None:continue
            if ns!='moby':continue
            keys=selected_snapshot_keys(snapshots.decode(),candidate['RootFS']['Layers'])
            save(ns+'-selected-exact-candidate-chain.json',{'selection':'EXACT_CANDIDATE_ROOTFS_CHAIN_AND_PARENTS','keys':keys,'selectedCount':len(keys),'completeCatalogueBytes':len(snapshots),'completeCatalogueSha256':sha(snapshots),'catalogueTruncated':False})
            for number,key in enumerate(keys):
                safe_key(key);raw=call(prefix+['snapshots','--snapshotter','overlayfs','info',key],ns+'-snapshot-info-'+str(number))
                if raw is None:continue
                info=exact_json(raw);kind=info.get('Kind',info.get('kind'))
                require(kind in ['Committed','COMMITTED',3],'Selected candidate snapshot is not committed')
                call(prefix+['snapshots','--snapshotter','overlayfs','usage',key],ns+'-snapshot-usage-'+str(number))
        # BuildKit DiskUsage is a bounded read-only API through buildx. Client
        # state stays in this new root. No filesystem du executable is invoked.
        call(['docker','buildx','du','--format','json'],'buildkit-cache-metadata')
        base=set(re.findall(r'FROM \S+@(sha256:[a-f0-9]{64})',(ROOT/'docker-build.log').read_text()))
        queue=[IMAGE]+sorted(base);seen=set()
        while queue:
            value=queue.pop(0);digest(value)
            if value in seen:continue
            require(len(seen)<32,'OCI metadata graph exceeds bound');seen.add(value)
            prefix=['ctr','--address',SOCKET,'--namespace','moby'];raw=call(prefix+['content','get',value],'oci-metadata-'+str(len(seen)))
            if raw is None:continue
            obj=exact_json(raw);queue.extend(oci_children(obj));manifests[value]=obj
        save('oci-metadata-graph.json',manifests)
    except BaseException as e:problems.append({'stage':'metadata-capture','error':type(e).__name__+': '+str(e),'required':True})
    after={p:{'device':os.stat(p).st_dev,'freeBytes':shutil.disk_usage(p).free} for p in filesystems}
    if min(v['freeBytes'] for v in after.values())<FLOOR:problems.append({'stage':'post-capture-reserve','required':True})
    for n in ['candidate-image.id','docker-build.log']:
        require(sha((original/n).read_bytes())==REFS[n]['sha256'],'Original failed reference changed during capture')
    require(not (original/'image-inspect-original.json').exists(),'Original absent inspect was fabricated')
    record=evidence_only({'status':'READONLY_METADATA_EVIDENCE_CAPTURED_NOT_ADOPTED' if not any(v.get('required') for v in problems) else 'STOP_METADATA_INCOMPLETE_IMAGE_EXCLUDED',
        'closedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'scope':SCOPE,'candidate':CANDIDATE,'image':IMAGE,'toolingCommit':index['head'],'sourceReviewId':review['id'],
        'elapsedSeconds':time.monotonic()-started,'filesystemsBefore':before,'filesystemsAfter':after,'reserveFloorBytes':FLOOR,'originalResidualBytes':RESIDUAL,'unexplainedAbortBytes':ABORT,
        'commands':calls,'problems':problems,'originalInspectAbsent':True,'forensicReferenceRole':'DISTINCT_FIRST_POST_CLOSURE_READONLY_API_RESPONSE','originalRootWrites':0,
        'productionDatabaseConnections':0,'volumeMounts':0,'newBuilds':0,'retags':0,'containerStarts':0,'filesystemDuCalls':0,'imageEligibility':False,'imageAdoptionReceipts':0,'proofLaunches':0,'productionDeployments':0,
        'fullGrowthAttributionCompleted':False,'newSourceReviewRequiredForAnyAdoption':True,'neverReplay':True})
    save('metadata-evidence-terminal.json',record);print(json.dumps({k:v for k,v in record.items() if k not in ['commands','problems']}),flush=True)
    require(record['status']=='READONLY_METADATA_EVIDENCE_CAPTURED_NOT_ADOPTED','Incomplete metadata; keep image excluded and all evidence, never replay')
if __name__=='__main__':main()
