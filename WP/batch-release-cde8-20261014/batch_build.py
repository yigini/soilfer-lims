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
def allocated():
    # Metadata only: no volume/database path is opened or connected.
    paths=[ROOT]+[pathlib.Path('/var/lib/docker')/n for n in ['buildkit','overlay2','image','containerd']]
    rows={};present=[]
    for p in paths:
        require(not p.is_symlink(),'Disk accounting refuses aliases')
        if p.exists():require(p.is_dir(),'Unexpected allocation object');present.append(p)
        rows[str(p)]={'bytes':0,'device':os.stat(p if p.exists() else p.parent).st_dev}
    result=subprocess.check_output(['du','-s','-B1','--',*map(str,present)],timeout=30).decode()
    for line in result.splitlines():
        size,name=line.split('\t',1);require(name in rows and int(size)>=0,'Allocation output differs');rows[name]['bytes']=int(size)
    require(len(result.splitlines())==len(present),'Missing physical allocation measurement')
    return rows
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
    require(set(spec['evidenceSha256'])==evidence_names and all(file_sha(ROOT/n)==d for n,d in spec['evidenceSha256'].items()),'Fresh source/CI evidence bytes changed')
    before={p:shutil.disk_usage(p).free for p in ['/opt/lims','/var/lib/docker']}
    require(subprocess.check_output(['docker','info','--format','{{.DockerRootDir}}'],timeout=15).decode().strip()=='/var/lib/docker','Docker allocation root differs')
    devices={p:os.stat(p).st_dev for p in before};allocation_before=allocated()
    require(min(before.values())>=FLOOR+BUILD_ALLOCATION,'Build allocation and fixed floor reserve refused')
    application_index=json_exact((ROOT/'source-index.json').read_bytes())
    with tarfile.open(ROOT/'source.tar.gz') as bundle:
        members=verify_archive_members(bundle,application_index)
        source=ROOT/'source';source.mkdir(mode=0o700)
        bundle.extractall(source,members=members,filter='data')
    after_unpack={p:shutil.disk_usage(p).free for p in before}
    require(min(after_unpack.values())>=FLOOR+BUILD_ALLOCATION,'Source extraction consumed the build reserve')
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
    allocation_after=allocated()
    try:disk_growth=build_disk_growth(before,after,devices,allocation_before,allocation_after)
    except RuntimeError as refused:
        disk_growth={'policy':GROWTH_POLICY,'beforeAllocations':allocation_before,'afterAllocations':allocation_after,'refusal':str(refused)}
        error=error or str(refused)
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
    receipt={**closed,'status':'BUILT_ONLY_NOT_PROVED_OR_DEPLOYED','image':image,'imageBytes':inspected['Size'],'tag':tag,
        'toolingCommit':spec['toolingCommit'],'sourceReviewId':review['id'],'sourceReviewRawSha256':spec['sourceReviewRawSha256'],
        'toolingSourceIndexSha256':spec['toolingSourceIndexSha256'],'archiveSha256':spec['archiveSha256'],'applicationIndexSha256':spec['applicationIndexSha256'],
        'verifiedApplicationGitBlobCount':len(application_index['entries']),'builderSha256':file_sha(pathlib.Path(__file__)),
        'dockerBuildLogSha256':file_sha(ROOT/'docker-build.log'),'imageInspectSha256':sha(inspect_raw),'individualAudits':AUDITS,'mainCiRun':MAIN_CI,
        'newBuildCount':1,'retainedOwnedSourceAndLogs':True,'rebuildOrRetagAllowed':False}
    write_new('build-receipt.json',receipt);print(json.dumps(receipt),flush=True)
if __name__=='__main__':main()
