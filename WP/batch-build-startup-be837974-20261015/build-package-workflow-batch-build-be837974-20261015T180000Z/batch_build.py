"""One reviewed build-only process; no production database, proof or deployment path."""
import datetime,hashlib,json,os,pathlib,shutil,subprocess,sys,tarfile,time
from batch_build_contract import *

ROOT=pathlib.Path(__file__).resolve().parent
def file_sha(p):
    h=hashlib.sha256()
    with p.open('rb') as stream:
        while chunk:=stream.read(1024*1024):h.update(chunk)
    return h.hexdigest()
def write_new(name,value):
    p=ROOT/name
    with p.open('x',encoding='utf-8') as f:json.dump(value,f,indent=2,ensure_ascii=False)
    p.chmod(0o400)
def allocated(stage):
    # Metadata only: no volume/database path is opened or connected.
    paths=[pathlib.Path(p) for p in allocation_paths(ROOT)]
    no_descendant_mounts(pathlib.Path('/proc/self/mountinfo').read_text(),map(str,paths))
    rows={};present=[]
    for p in paths:
        require(not p.is_symlink(),'Disk accounting refuses aliases')
        if p.exists():require(p.is_dir(),'Unexpected allocation object');present.append(p)
        rows[str(p)]={'bytes':0,'device':os.stat(p if p.exists() else p.parent).st_dev,'exists':p.exists(),'symlink':False}
    require(pathlib.Path('/var/lib/containerd') in present,'Containerd cannot be silently absent')
    argv=['du','-s','-B1','--',*map(str,present)]
    try:response=subprocess.run(argv,capture_output=True,timeout=MEASUREMENT_TIMEOUT)
    except subprocess.TimeoutExpired as e:
        for suffix,raw in [('stdout',e.stdout or b''),('stderr',e.stderr or b'')]:
            with (ROOT/('allocation-'+stage+'-partial-'+suffix+'.log')).open('xb') as f:f.write(raw)
            (ROOT/('allocation-'+stage+'-partial-'+suffix+'.log')).chmod(0o400)
        raise RuntimeError('Owned physical measurement timed out; no estimate or replay')
    for suffix,raw in [('stdout',response.stdout),('stderr',response.stderr)]:
        require(len(raw)<=65536,'Allocation output exceeded 64KiB bound')
        with (ROOT/('allocation-'+stage+'-'+suffix+'.log')).open('xb') as f:f.write(raw)
        (ROOT/('allocation-'+stage+'-'+suffix+'.log')).chmod(0o400)
    require(response.returncode==0,'Physical measurement failed; no estimate or replay')
    result=response.stdout.decode()
    for line in result.splitlines():
        size,name=line.split('\t',1);require(name in rows and int(size)>=0,'Allocation output differs');rows[name]['bytes']=int(size)
    require(len(result.splitlines())==len(present),'Missing physical allocation measurement')
    validate_allocation_inventory(ROOT,rows)
    write_new('allocation-'+stage+'-original.json',{'argv':argv,'timeoutSeconds':MEASUREMENT_TIMEOUT,'exitCode':response.returncode,'physicalBytesExact':True,'hardlinksCountedOnceInOneDuInvocation':True,'mountInventoryChecked':True,'rows':rows})
    return rows

def topology(stage):
    def read(argv):
        r=subprocess.run(argv,capture_output=True,timeout=15)
        require(r.returncode==0 and len(r.stdout)<=2*1024**2 and len(r.stderr)<=65536,'Bounded topology interface refused')
        return r.stdout.decode()
    result=storage_topology(read(['docker','info','--format','{{.Driver}}']),read(['docker','info','--format','{{json .DriverStatus}}']),read(['docker','info','--format','{{.DockerRootDir}}']),read(['systemctl','show','containerd','--property=LoadState,ActiveState,MainPID,ExecStart']),read(['containerd','config','dump']))
    write_new('storage-topology-'+stage+'-selected-original.json',result);return result
def main():
    require(os.geteuid()==0 and sys.flags.optimize==0,'Root and non-optimized Python required')
    require(ROOT.parent==pathlib.Path('/opt/lims/releases') and not ROOT.is_symlink(),'Wrong new build location')
    require({p.name for p in ROOT.iterdir()}==REQUIRED_ARTIFACTS,'Unexpected package files or consumed build root')
    require(all(p.is_file() and not p.is_symlink() and p.stat().st_mode&0o777==0o400 for p in ROOT.iterdir()),'Build package must be immutable regular files')
    spec=json_exact((ROOT/'build-input.json').read_bytes());index=json_exact((ROOT/'tooling-source-index.json').read_bytes());review=json_exact((ROOT/'source-review-original.json').read_bytes())
    validate_spec(spec,index,review);require(str(ROOT)==str(safe_build_root(spec['rootName'])),'Root identity differs')
    for name,row in index['files'].items():require(file_sha(ROOT/name)==row['sha256'],'Executed source changed '+name)
    require(file_sha(ROOT/'source.tar.gz')==spec['archiveSha256'] and file_sha(ROOT/'source-index.json')==spec['applicationIndexSha256'],'Application archive/index changed')
    prs={str(a['pr']):json_exact((ROOT/f'pr{a["pr"]}-original.json').read_bytes()) for a in AUDITS}
    verdicts={str(a['pr']):json_exact((ROOT/f'pr{a["pr"]}-actual-pass-original.json').read_bytes()) for a in AUDITS}
    comments={str(a['pr']):json_exact((ROOT/f'pr{a["pr"]}-comments-original.json').read_bytes()) for a in AUDITS}
    validate_current(json_exact((ROOT/'main-original.json').read_bytes()),json_exact((ROOT/'main-ci-original.json').read_bytes()),prs,verdicts,comments)
    evidence_names={'main-original.json','main-ci-original.json'}|{f'pr{a["pr"]}-{k}.json' for a in AUDITS for k in ['original','actual-pass-original','comments-original']}
    evidence_names|={'authority-'+i+'-original.json' for i in RULE_AUTHORITY_PINS}
    validate_rule_authorities({n:(ROOT/n).read_bytes() for n in evidence_names if n.startswith('authority-')})
    require(set(spec['evidenceSha256'])==evidence_names and all(file_sha(ROOT/n)==d for n,d in spec['evidenceSha256'].items()),'Fresh source/CI evidence bytes changed')
    require(os.environ.get('NODE_OPTIONS','')=='','Blank outer NODE_OPTIONS required')
    for n,row in REFERENCE_FILES.items():require(file_sha(ROOT/n)==row['sha256'],'Immutable failure/analysis reference changed')
    direction=json_exact((ROOT/'fallback-direction-original.json').read_bytes())
    fallback_evidence(direction,json_exact((ROOT/'original-build-failure.json').read_bytes()),json_exact((ROOT/'metadata-analysis-original.json').read_bytes()))
    require(file_sha(ROOT/'fallback-direction-original.json')==spec['fallbackDirectionRawSha256'],'Actual fallback direction changed')
    write_new('accounting-preflight-intent.json',{'status':'NEW_STARTUP_APP_BUILD_PREFLIGHT_ATTEMPTED_ONCE','startedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'newBuildCount':0,'originalFailedRoot':ORIGINAL_FAILED_ROOT,'neverReplay':True})
    application_index=json_exact((ROOT/'source-index.json').read_bytes())
    require((ROOT/'build-input.json').stat().st_size<=CAPACITY_SPEC_LIMIT,'Capacity spec oversized')
    plan=validate_capacity_files(spec,application_index,{n:(ROOT/n).stat().st_size for n in REQUIRED_ARTIFACTS if n!='build-input.json'})
    before=None;allocation_before=None
    try:
        bound=['/opt/lims','/var/lib/docker','/var/lib/containerd']
        require(all(pathlib.Path(p).is_dir() and not pathlib.Path(p).is_symlink() for p in bound),'Bound storage aliases/missing roots refused')
        before={p:shutil.disk_usage(p).free for p in bound};devices={p:os.stat(p).st_dev for p in before}
        require(min(before.values())>=capacity_requirement(plan,'before-unit'),'R4 before-controller computed requirement PLUS10GB refused')
        before_topology=topology('before');allocation_before=allocated('before')
        require(min(shutil.disk_usage(p).free for p in bound)>=capacity_requirement(plan,'before-unit'),'R4 accounting preflight consumed computed requirement PLUS10GB')
        application_index=json_exact((ROOT/'source-index.json').read_bytes())
        with tarfile.open(ROOT/'source.tar.gz') as bundle:
            members=verify_archive_members(bundle,application_index)
            source=ROOT/'source';source.mkdir(mode=0o700)
            bundle.extractall(source,members=members,filter='data')
        after_unpack={p:shutil.disk_usage(p).free for p in before}
        require(min(after_unpack.values())>=capacity_requirement(plan,'before-build'),'R4 before-build computed requirement PLUS10GB refused')
        write_new('capacity-before-build-original.json',{'observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'phase':'before-build','requiredFreeBytes':capacity_requirement(plan,'before-build'),'freeBytes':after_unpack,'capacityPlan':plan})
    except BaseException as refused:
        write_new('build-preflight-refusal.json',{'status':'BUILD_PREFLIGHT_REFUSED_NOT_BUILT_RETAIN_ALL','closedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'error':type(refused).__name__+': '+str(refused),'freeBytesBefore':before,'beforeAllocations':allocation_before,'newBuildCount':0,'productionDatabaseConnections':0,'proofLaunches':0,'productionDeployments':0,'neverReplay':True})
        raise
    tag='soilfer-lims:audit-'+ROOT.name
    require(not (ROOT/'build-intent.json').exists() and not (ROOT/'docker-build.log').exists(),'Consumed build boundary')
    write_new('build-intent.json',{'status':'BUILD_ATTEMPTED_ONCE','startedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'head':CANDIDATE,'tag':tag,'scope':SCOPE,'neverRetry':True})
    started=time.monotonic();result=None;error=None
    try:
        with (ROOT/'docker-build.log').open('x',encoding='utf-8') as log:
            result=subprocess.run(['docker','build','--progress=plain','--label','org.opencontainers.image.revision='+CANDIDATE,
                '--label','org.opencontainers.image.source=https://github.com/yigini/soilfer-lims','--iidfile',str(ROOT/'candidate-image.id'),'-t',tag,str(source)],stdout=log,stderr=subprocess.STDOUT,timeout=BUILD_TIMEOUT)
    except BaseException as e:error=type(e).__name__+': '+str(e)
    elapsed=time.monotonic()-started
    if (ROOT/'docker-build.log').exists():(ROOT/'docker-build.log').chmod(0o400)
    after={p:shutil.disk_usage(p).free for p in before}
    allocation_after=None
    try:
        after_topology=topology('after');require(after_topology==before_topology,'Storage topology changed during build')
        require({p:os.stat(p).st_dev for p in before}==devices,'Bound filesystems changed during build')
        allocation_after=allocated('after');validate_allocation_inventory(ROOT,allocation_before);validate_allocation_inventory(ROOT,allocation_after)
        after={p:shutil.disk_usage(p).free for p in before}
        disk_growth=build_disk_growth(before,after,devices,allocation_before,allocation_after)
    except BaseException as refused:
        disk_growth={'policy':GROWTH_POLICY,'beforeAllocations':allocation_before,'afterAllocations':allocation_after,'refusal':type(refused).__name__+': '+str(refused)}
        error=error or str(refused)
        after={p:shutil.disk_usage(p).free for p in before}
    closed={'closedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'head':CANDIDATE,'tree':TREE,'scope':SCOPE,
        'exitCode':result.returncode if result else None,'error':error,'elapsedSeconds':elapsed,'freeBytesBefore':before,'freeBytesAfter':after,
        'reserveFloorBytes':FLOOR,'buildAllocationReserveBytes':BUILD_ALLOCATION,'diskGrowth':disk_growth,'productionDatabaseMounts':0,'productionDatabaseConnections':0,'proofLaunches':0,'productionDeployments':0,'neverRetry':True}
    if error or result.returncode!=0 or min(after.values())<FLOOR:
        closed['status']='FAILED_OR_RESERVE_REFUSED_BUILD_ONLY_RETAIN_ALL';write_new('build-terminal-failure.json',closed)
        raise RuntimeError('Build failed or reserve refused; retain all artifacts, never replay/cleanup')
    image=(ROOT/'candidate-image.id').read_text().strip();require(re.fullmatch('sha256:[a-f0-9]{64}',image) is not None,'Built image ID missing')
    inspect_raw=subprocess.check_output(['docker','image','inspect',image],timeout=15)
    with (ROOT/'image-inspect-original.json').open('xb') as f:f.write(inspect_raw)
    (ROOT/'image-inspect-original.json').chmod(0o400)
    inspected=json_exact(inspect_raw)[0]
    require(inspected['Id']==image and inspected['Config']['Labels']['org.opencontainers.image.revision']==CANDIDATE,'Built revision differs')
    require(image!=PREDECESSOR_IMAGE,'Candidate image cannot be the historical predecessor')
    (ROOT/'candidate-image.id').chmod(0o400)
    receipt={**closed,'status':'NEW_STARTUP_APP_IMAGE_BUILT_NOT_PROVED_OR_DEPLOYED','image':image,'imageBytes':inspected['Size'],'tag':tag,
        'toolingCommit':spec['toolingCommit'],'sourceReviewId':review['id'],'sourceReviewRawSha256':spec['sourceReviewRawSha256'],
        'toolingSourceIndexSha256':spec['toolingSourceIndexSha256'],'archiveSha256':spec['archiveSha256'],'applicationIndexSha256':spec['applicationIndexSha256'],
        'verifiedApplicationGitBlobCount':len(application_index['entries']),'builderSha256':file_sha(pathlib.Path(__file__)),
        'dockerBuildLogSha256':file_sha(ROOT/'docker-build.log'),'imageInspectSha256':sha(inspect_raw),'individualAudits':AUDITS,'mainCiRun':MAIN_CI,
        'capacityPlan':plan,'r4AdditionalHeadroomBytes':R4_HEADROOM,'cachePruningPerformed':False,'proofDatabaseRemovalPerformed':False,
        'newBuildCount':1,'retainedOwnedSourceAndLogs':True,'rebuildOrRetagAllowed':False,'originalFailedRoot':ORIGINAL_FAILED_ROOT,'originalFailedRecordSha256':REFERENCE_FILES['original-build-failure.json']['sha256'],'metadataAnalysisAudit':ANALYSIS_AUDIT,'metadataAnalysisSha256':REFERENCE_FILES['metadata-analysis-original.json']['sha256'],'originalFailureRemainsFailed':True,'oldUnexplainedGrowthNotRetroactivelyAttributed':True,'cacheMayYieldSameImageId':True,'currentQualificationRequiresThisSeparateBuildReceiptAndLaterProof':True}
    write_new('build-receipt.json',receipt);print(json.dumps(receipt),flush=True)
if __name__=='__main__':main()
