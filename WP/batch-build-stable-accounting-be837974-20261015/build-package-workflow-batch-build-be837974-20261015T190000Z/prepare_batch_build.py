"""Prepare an immutable application/build package from approved raw Git; no SSH or build."""
import argparse,datetime,gzip,hashlib,io,json,pathlib,re,subprocess,sys,tarfile
from batch_build_contract import *

REPO=pathlib.Path(__file__).resolve().parents[2]
REL='WP/batch-build-stable-accounting-be837974-20261015/'
def command(*args):return subprocess.check_output(args,cwd=REPO)
def gh(path):return command('gh','api',path)
def raw_git(head,path):
    data=command('git','ls-tree','-z',head,'--',path);metadata,returned=data.rstrip(b'\0').split(b'\t',1)
    mode,kind,oid=metadata.decode().split();require(kind=='blob' and returned.decode()==path and mode in ['100644','100755'],'Unexpected tooling object')
    raw=command('git','cat-file','blob',oid)
    require(hashlib.sha1(('blob '+str(len(raw))+'\0').encode()+raw).hexdigest()==oid,'Raw tooling Git identity differs')
    return raw,{'path':path,'mode':mode,'blob':oid,'bytes':len(raw),'sha256':sha(raw)}
def application_index():
    listing=command('git','ls-tree','-r','-z',CANDIDATE);rows=[]
    for item in listing.split(b'\0'):
        if not item:continue
        meta,path=item.split(b'\t',1);mode,kind,oid=meta.decode().split();path=path.decode()
        if path.startswith('WP/'):continue
        member_path(path);require(kind=='blob' and mode in ['100644','100755','120000'],'Unknown application Git object')
        rows.append({'path':path,'mode':mode,'blob':oid})
    pipe=subprocess.Popen(['git','cat-file','--batch'],cwd=REPO,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    try:
        for row in rows:
            pipe.stdin.write((row['blob']+'\n').encode());pipe.stdin.flush()
            fields=pipe.stdout.readline().decode().strip().split();require(len(fields)==3 and fields[:2]==[row['blob'],'blob'],'Batch object missing')
            size=int(fields[2]);h=hashlib.sha256();s=hashlib.sha1(('blob '+str(size)+'\0').encode());remaining=size
            while remaining:
                data=pipe.stdout.read(min(1024*1024,remaining));require(data,'Truncated Git blob');h.update(data);s.update(data);remaining-=len(data)
            require(pipe.stdout.read(1)==b'\n' and s.hexdigest()==row['blob'],'Raw application Git object mismatch')
            row.update(bytes=size,sha256=h.hexdigest())
    finally:
        pipe.stdin.close();pipe.stdout.close();error=pipe.stderr.read();code=pipe.wait(timeout=15)
    require(code==0,error.decode('utf-8','replace'))
    return {'status':'COMMITTED_APPLICATION_GIT_BLOB_INDEX','head':CANDIDATE,'tree':TREE,'excludedPrefixes':['WP/'],'entries':rows}
def application_archive(index):
    # Git archive can apply eol/export filters. Construct this archive from the
    # verified raw objects, preserving the exact Git bytes and executable modes.
    output=io.BytesIO()
    pipe=subprocess.Popen(['git','cat-file','--batch'],cwd=REPO,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    try:
        with gzip.GzipFile(fileobj=output,mode='wb',mtime=0,filename='') as compressed,tarfile.open(fileobj=compressed,mode='w',format=tarfile.PAX_FORMAT) as bundle:
            for row in index['entries']:
                member_path(row['path']);pipe.stdin.write((row['blob']+'\n').encode());pipe.stdin.flush()
                fields=pipe.stdout.readline().decode().strip().split();require(fields==[row['blob'],'blob',str(row['bytes'])],'Raw archive source identity differs')
                data=pipe.stdout.read(row['bytes']);require(pipe.stdout.read(1)==b'\n' and len(data)==row['bytes'] and sha(data)==row['sha256'],'Raw archive source bytes differ')
                require(hashlib.sha1(('blob '+str(len(data))+'\0').encode()+data).hexdigest()==row['blob'],'Archive Git object differs')
                info=tarfile.TarInfo(row['path']);info.mtime=0;info.uid=info.gid=0
                if row['mode']=='120000':info.type=tarfile.SYMTYPE;info.linkname=data.decode();bundle.addfile(info)
                else:info.mode=0o755 if row['mode']=='100755' else 0o644;info.size=len(data);bundle.addfile(info,io.BytesIO(data))
    finally:
        pipe.stdin.close();pipe.stdout.close();error=pipe.stderr.read();code=pipe.wait(timeout=15)
    require(code==0,error.decode('utf-8','replace'));return output.getvalue()
def current_evidence():
    raw={'main-original.json':gh('repos/yigini/soilfer-lims/git/ref/heads/main'),'main-ci-original.json':gh(f'repos/yigini/soilfer-lims/actions/runs/{MAIN_CI}')}
    prs={};verdicts={};comments={}
    for a in AUDITS:
        n=str(a['pr']);raw[f'pr{n}-original.json']=gh(f'repos/yigini/soilfer-lims/pulls/{n}');prs[n]=json_exact(raw[f'pr{n}-original.json'])
        raw[f'pr{n}-actual-pass-original.json']=gh(f'repos/yigini/soilfer-lims/issues/comments/{a["comment"]}');verdicts[n]=json_exact(raw[f'pr{n}-actual-pass-original.json'])
        pages=json_exact(command('gh','api','--paginate','--slurp',f'repos/yigini/soilfer-lims/issues/{n}/comments?per_page=100'))
        comments[n]=[v for page in pages for v in page];raw[f'pr{n}-comments-original.json']=(json.dumps(comments[n],ensure_ascii=False)+'\n').encode()
    validate_current(json_exact(raw['main-original.json']),json_exact(raw['main-ci-original.json']),prs,verdicts,comments)
    for i in RULE_AUTHORITY_PINS:raw['authority-'+i+'-original.json']=gh('repos/yigini/soilfer-lims/issues/comments/'+i)
    validate_rule_authorities(raw)
    return raw
def prepare(tooling,review_id,root_name):
    require(sys.flags.optimize==0,'Plain Python required');safe_build_root(root_name)
    files={};index={'head':tooling,'files':{}}
    for name in sorted(SOURCE_FILES):files[name],index['files'][name]=raw_git(tooling,REL+name)
    graph(index)
    # The actually executing preparer and imported contract must equal reviewed raw blobs.
    for p in [pathlib.Path(__file__),pathlib.Path(sys.modules['batch_build_contract'].__file__)]:require(p.read_bytes()==files[p.name],'Executed preparer authority differs')
    review_raw=gh(f'repos/yigini/soilfer-lims/issues/comments/{review_id}');review=json_exact(review_raw)
    validate_source_review(review,tooling,index)
    evidence=current_evidence()
    for n,row in REFERENCE_FILES.items():
        files[n]=raw_git(row['audit'],row['path'])[0];require(sha(files[n])==row['sha256'],'Original failure/analysis raw reference differs')
    files['fallback-direction-original.json']=gh('repos/yigini/soilfer-lims/issues/comments/'+str(FALLBACK_DIRECTION_ID))
    fallback_evidence(json_exact(files['fallback-direction-original.json']),json_exact(files['original-build-failure.json']),json_exact(files['metadata-analysis-original.json']))
    validate_prior_startup_failure(json_exact(files['startup-180000-build-failure.json']))
    dest=REPO/REL/('build-package-'+root_name)
    require(not dest.exists() and not dest.is_symlink(),'Prepared package consumed; inspect, never replay')
    source_commit=json_exact(gh('repos/yigini/soilfer-lims/git/commits/'+CANDIDATE));require(source_commit['tree']['sha']==TREE,'Candidate tree differs')
    source_index=application_index()
    archive=application_archive(source_index)
    dest.mkdir(mode=0o700)
    def save(name,data):
        with (dest/name).open('xb') as f:f.write(data)
        (dest/name).chmod(0o400)
    save('source.tar.gz',archive)
    with tarfile.open(dest/'source.tar.gz') as bundle:verify_archive_members(bundle,source_index)
    application_raw=(json.dumps(source_index,indent=2)+'\n').encode();save('source-index.json',application_raw)
    save('tooling-source-index.json',(json.dumps(index,indent=2)+'\n').encode());save('source-review-original.json',review_raw)
    for n,d in {**files,**evidence}.items():save(n,d)
    spec={'status':'PREPARED_BATCH_BUILD_ONLY_NOT_LAUNCHED','head':CANDIDATE,'tree':TREE,'scope':SCOPE,'rootName':root_name,
        'audits':AUDITS,'mainCiRun':MAIN_CI,'labAndHubBuildsOwnedByYY':True,'releaseWindowControl':'RELEASE_DAY_DISK_ABORTS_ACCEPTED',
        'productionDatabaseMounts':0,'productionDatabaseConnections':0,'proofLaunches':0,'productionDeployments':0,
        'toolingCommit':tooling,'toolingSourceIndexSha256':sha(canonical(index)),'sourceReviewId':review_id,'sourceReviewRawSha256':sha(canonical(review)),
        'archiveSha256':sha(archive),'applicationIndexSha256':sha(application_raw),'reserveFloorBytes':FLOOR,'buildAllocationReserveBytes':BUILD_ALLOCATION,
        'buildTimeoutSeconds':BUILD_TIMEOUT,'buildUnitTimeoutSeconds':UNIT_TIMEOUT,'unexplainedGrowthAbortBytes':UNEXPLAINED_GROWTH_ABORT,'diskGrowthPolicy':GROWTH_POLICY,
        'allocationMeasurementTimeoutSeconds':MEASUREMENT_TIMEOUT,'batchBuildMemoryLimitBytes':MEMORY,'originalFailedRoot':ORIGINAL_FAILED_ROOT,'metadataAnalysisAudit':ANALYSIS_AUDIT,'referenceFiles':REFERENCE_FILES,'fallbackDirectionId':FALLBACK_DIRECTION_ID,'fallbackDirectionRawSha256':sha(files['fallback-direction-original.json']),
        'preparedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'evidenceSha256':{n:sha(d) for n,d in evidence.items()}}
    lengths={p.name:p.stat().st_size for p in dest.iterdir()}
    spec['capacityPlan']=capacity_plan(source_index,lengths);spec['capacityPlanSha256']=sha(canonical(spec['capacityPlan']))
    validate_spec(spec,index,review);validate_capacity_files(spec,source_index,lengths);save('build-input.json',(json.dumps(spec,indent=2)+'\n').encode())
    require((dest/'build-input.json').stat().st_size<=CAPACITY_SPEC_LIMIT,'Capacity spec length exceeded')
    require({p.name for p in dest.iterdir()}==REQUIRED_ARTIFACTS,'Prepared package inventory differs')
    print(json.dumps({'status':spec['status'],'package':str(dest),'root':str(safe_build_root(root_name)),'applicationGitBlobs':len(source_index['entries']),'sourceReviewId':review_id,'productionOperations':0,'buildsLaunched':0}))
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--tooling-commit',required=True);p.add_argument('--source-review-id',required=True,type=int);p.add_argument('--root-name',required=True)
    a=p.parse_args();prepare(a.tooling_commit,a.source_review_id,a.root_name)
