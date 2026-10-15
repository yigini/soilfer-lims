"""Prepare a NEW prospective source graph; never run a build or host operator."""
import hashlib,json,pathlib,subprocess
R=pathlib.Path(__file__).resolve().parents[2];OLD='2c0cebca0e9e191d2062c2f43756aa1d46e98c85'
REL='WP/batch-build-stable-accounting-be837974-20261015/';D=R/REL;BEFORE=D/'source-preparation-before-bytes-once'
assert not D.exists() and subprocess.check_output(['git','rev-parse','HEAD'],cwd=R).decode().strip()=='23e8dad8d6442321586b7d0bf4920c48a8681054'
assert not subprocess.check_output(['git','diff','--cached','--name-only'],cwd=R).strip()
names=['batch_build_contract.py','batch_build.py','prepare_batch_build.py','launch_batch_build.py','verify_build_guards.py']
old={n:subprocess.check_output(['git','show',OLD+':WP/batch-build-startup-be837974-20261015/'+n],cwd=R) for n in names}
source={n:v.decode() for n,v in old.items()}
failurepath='WP/batch-build-startup-be837974-20261015/first-build-180000-closed-originals-once/build-terminal-failure.json'
failure=subprocess.check_output(['git','show','23e8dad8d6442321586b7d0bf4920c48a8681054:'+failurepath],cwd=R);failure_sha=hashlib.sha256(failure).hexdigest()
def replace(n,a,b):
 assert source[n].count(a)==1,(n,a[:100],source[n].count(a))
 source[n]=source[n].replace(a,b)
for n in names:source[n]=source[n].replace('WP/batch-build-startup-be837974-20261015','WP/batch-build-stable-accounting-be837974-20261015')
replace('batch_build_contract.py',"FIRST_BUILD_ROOT_NAME='workflow-batch-build-be837974-20261015T180000Z'","FIRST_BUILD_ROOT_NAME='workflow-batch-build-be837974-20261015T190000Z'")
replace('batch_build_contract.py',"def require(value,reason):", "REFERENCE_FILES['startup-180000-build-failure.json']={'audit':'23e8dad8d6442321586b7d0bf4920c48a8681054','path':"+repr(failurepath)+",'sha256':"+repr(failure_sha)+"}\nREQUIRED_ARTIFACTS=REQUIRED_ARTIFACTS|{'startup-180000-build-failure.json'}\n\ndef require(value,reason):")
replace('batch_build_contract.py',"'cleanupRuleReviewId=6191219093','noProofDatabaseRemovalPendingYY=true','cachePruningByThisBuilder=false']", "'cleanupRuleReviewId=6191219093','noProofDatabaseRemovalPendingYY=true','cachePruningByThisBuilder=false',\n        'priorFailedStartupBuildRoot=/opt/lims/releases/workflow-batch-build-be837974-20261015T180000Z',\n        'priorFailedStartupBuildRecordSha256='+REFERENCE_FILES['startup-180000-build-failure.json']['sha256'],\n        'postBuildWholeMeasurementMaxAttempts=2','postBuildMeasurementAttemptTimeoutSeconds=120',\n        'additionalMeasurementOnlyForExactMissingNumericContainerdSnapshotDirectory=true',\n        'allPartialMeasurementOutputsRetainedNeverCredited=true','noMeasurementOfFailed180000Root=true']")
source['batch_build_contract.py']+='''

def validate_prior_startup_failure(value):
    require(value.get('status')=='FAILED_OR_RESERVE_REFUSED_BUILD_ONLY_RETAIN_ALL' and value.get('head')==CANDIDATE and value.get('exitCode')==0 and value.get('error')=='Physical measurement failed; no estimate or replay' and value.get('diskGrowth',{}).get('afterAllocations') is None and value.get('neverRetry') is True,'Prior 180000 failure must remain failed and unqualified')

def missing_snapshot_measurement_paths(stage,attempt,exit_code,stderr):
    require(stage=='after' and type(attempt) is int and attempt==1 and type(exit_code) is int and exit_code==1,'Only one prospective additional post-build measurement is allowed')
    require(isinstance(stderr,str) and 0<len(stderr.encode())<=65536,'Complete bounded measurement error required')
    lines=stderr.splitlines();require(1<=len(lines)<=32,'Missing snapshot diagnostics incomplete or excessive')
    paths=[]
    for line in lines:
        match=re.fullmatch(r"du: cannot access '(/var/lib/containerd/io\\.containerd\\.snapshotter\\.v1\\.overlayfs/snapshots/[1-9][0-9]{0,15})': No such file or directory",line)
        require(match is not None,'Foreign or ambiguous measurement failure remains fatal')
        paths.append(match[1])
    require(len(paths)==len(set(paths)),'Duplicate missing snapshot diagnostic refuses')
    return paths

def parse_complete_allocation_rows(text,present,rows):
    require(isinstance(text,str) and len(text.encode())<=65536 and text.endswith('\\n'),'Complete bounded allocation output required')
    seen=set();result={p:dict(v) for p,v in rows.items()}
    for line in text.splitlines():
        fields=line.split('\\t');require(len(fields)==2 and re.fullmatch(r'0|[1-9][0-9]*',fields[0]) is not None,'Exact integer allocation row required')
        count,path=fields;require(path in present and path not in seen,'Unknown or duplicate allocation row')
        seen.add(path);result[path]['bytes']=int(count)
    require(seen==set(present),'Missing physical allocation row')
    return result
'''
start=source['batch_build.py'].index('def allocated(stage):');end=source['batch_build.py'].index('\ndef topology(stage):')
source['batch_build.py']=source['batch_build.py'][:start]+'''def allocated(stage):
    # NEW graph only: at most two complete post-build measurements; no old-root access.
    paths=[pathlib.Path(p) for p in allocation_paths(ROOT)]
    prior_topology=None;attempts=[]
    for attempt in range(1,3 if stage=='after' else 2):
        no_descendant_mounts(pathlib.Path('/proc/self/mountinfo').read_text(),map(str,paths))
        rows={};present=[]
        for p in paths:
            require(not p.is_symlink(),'Disk accounting refuses aliases')
            if p.exists():require(p.is_dir() and str(p.resolve())==str(p),'Unexpected allocation object or ancestor alias');present.append(p)
            rows[str(p)]={'bytes':0,'device':os.stat(p if p.exists() else p.parent).st_dev,'exists':p.exists(),'symlink':False}
        require(pathlib.Path('/var/lib/containerd') in present,'Containerd cannot be silently absent')
        actual_topology=topology(stage+'-attempt-'+str(attempt)+'-before')
        if prior_topology is not None:require(actual_topology==prior_topology,'Topology changed across whole measurement attempts')
        prior_topology=actual_topology
        label='allocation-'+stage+'-attempt-'+str(attempt)
        argv=['du','-s','-B1','--',*map(str,present)]
        write_new(label+'-intent.json',{'argv':argv,'startedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'timeoutSeconds':MEASUREMENT_TIMEOUT,'attempt':attempt,'stage':stage,'maximumPostBuildAttempts':2,'partialTotalsAccepted':False})
        try:response=subprocess.run(argv,capture_output=True,timeout=MEASUREMENT_TIMEOUT)
        except subprocess.TimeoutExpired as e:
            for suffix,raw in [('stdout',e.stdout or b''),('stderr',e.stderr or b'')]:
                with (ROOT/(label+'-partial-'+suffix+'.log')).open('xb') as f:f.write(raw)
                (ROOT/(label+'-partial-'+suffix+'.log')).chmod(0o400)
            raise RuntimeError('Physical measurement timed out; no additional attempt')
        for suffix,raw in [('stdout',response.stdout),('stderr',response.stderr)]:
            require(len(raw)<=65536,'Allocation output exceeded 64KiB bound')
            with (ROOT/(label+'-'+suffix+'.log')).open('xb') as f:f.write(raw)
            (ROOT/(label+'-'+suffix+'.log')).chmod(0o400)
        attempts.append({'attempt':attempt,'exitCode':response.returncode,'stdoutSha256':sha(response.stdout),'stderrSha256':sha(response.stderr),'accepted':response.returncode==0 and response.stderr==b''})
        write_new(label+'-result.json',attempts[-1])
        no_descendant_mounts(pathlib.Path('/proc/self/mountinfo').read_text(),map(str,paths))
        require(topology(stage+'-attempt-'+str(attempt)+'-after')==actual_topology,'Topology changed during physical measurement')
        if response.returncode==0:
            require(response.stderr==b'','Successful allocation with diagnostics refuses')
            rows=parse_complete_allocation_rows(response.stdout.decode(),set(map(str,present)),rows)
            validate_allocation_inventory(ROOT,rows)
            write_new('allocation-'+stage+'-original.json',{'argv':argv,'timeoutSeconds':MEASUREMENT_TIMEOUT,'exitCode':0,'acceptedCompleteAttempt':attempt,'allAttempts':attempts,'physicalBytesExact':True,'hardlinksCountedOnceInOneDuInvocation':True,'mountInventoryChecked':True,'rows':rows,'partialTotalsNeverCredited':True})
            return rows
        missing=missing_snapshot_measurement_paths(stage,attempt,response.returncode,response.stderr.decode())
        parent=pathlib.Path('/var/lib/containerd/io.containerd.snapshotter.v1.overlayfs/snapshots')
        require(parent.is_dir() and not parent.is_symlink() and str(parent.resolve())==str(parent) and os.stat(parent).st_dev==os.stat('/var/lib/containerd').st_dev,'Missing snapshot parent topology refuses')
        require(all(not pathlib.Path(p).exists() and not pathlib.Path(p).is_symlink() for p in missing),'Missing snapshot was replaced or aliased; refuse')
        write_new(label+'-narrow-missing-directory-observation.json',{'missingPaths':missing,'parent':str(parent),'parentRealNonaliasSameDevice':True,'allMissingPathsStillAbsent':True,'removingProcessKnown':False,'partialTotalsCredited':False,'permitsOnlyNextCompleteWholeMeasurementInThisNewRoot':True})
        time.sleep(2)
    raise RuntimeError('No complete accepted whole physical measurement; retain all')
''' + source['batch_build.py'][end:]
replace('prepare_batch_build.py',"fallback_evidence(json_exact(files['fallback-direction-original.json']),json_exact(files['original-build-failure.json']),json_exact(files['metadata-analysis-original.json']))", "fallback_evidence(json_exact(files['fallback-direction-original.json']),json_exact(files['original-build-failure.json']),json_exact(files['metadata-analysis-original.json']))\n    validate_prior_startup_failure(json_exact(files['startup-180000-build-failure.json']))")
replace('batch_build.py',"direction=json_exact((ROOT/'fallback-direction-original.json').read_bytes())", "validate_prior_startup_failure(json_exact((ROOT/'startup-180000-build-failure.json').read_bytes()))\n    direction=json_exact((ROOT/'fallback-direction-original.json').read_bytes())")
source['verify_build_guards.py']=source['verify_build_guards.py'].replace("FIRST_BUILD_ROOT_NAME.replace('180000','181000')","FIRST_BUILD_ROOT_NAME.replace('190000','191000')")
extra=r'''
class WholeMeasurementGuards(unittest.TestCase):
    def test_only_exact_first_postbuild_numeric_snapshot_missing_directory_allows_another_complete_measurement(self):
        error="du: cannot access '/var/lib/containerd/io.containerd.snapshotter.v1.overlayfs/snapshots/12671': No such file or directory\n"
        self.assertEqual(missing_snapshot_measurement_paths('after',1,1,error),['/var/lib/containerd/io.containerd.snapshotter.v1.overlayfs/snapshots/12671'])
        for stage,attempt,code in [('before',1,1),('after',2,1),('after',1,0),('after',1,2),('after',True,1),('after',1,True)]:
            with self.subTest(stage=stage,attempt=attempt,code=code),self.assertRaises(RuntimeError):missing_snapshot_measurement_paths(stage,attempt,code,error)
    def test_foreign_nested_alias_malformed_permission_and_empty_errors_refuse(self):
        good="du: cannot access '/var/lib/containerd/io.containerd.snapshotter.v1.overlayfs/snapshots/12671': No such file or directory"
        for text in ['',good.replace('/12671','/12671/fs/file'),good.replace('/12671','/../12671'),good.replace('/12671','/name'),good.replace('/12671','/0'),good.replace('/var/lib/containerd/','/other/'),good.replace('No such file or directory','Permission denied'),good+'\n'+good,good+'\nunknown',good+'\n'*65536]:
            with self.subTest(error=text[:120]),self.assertRaises(RuntimeError):missing_snapshot_measurement_paths('after',1,1,text)
    def test_successful_measurement_requires_each_exact_nonduplicate_integer_row(self):
        rows={'/a':{'bytes':0},'/b':{'bytes':0}}
        value=parse_complete_allocation_rows('1\t/a\n2\t/b\n',{'/a','/b'},rows)
        self.assertEqual(value,{'/a':{'bytes':1},'/b':{'bytes':2}});self.assertEqual(rows['/a']['bytes'],0)
        for text in ['1\t/a\n','1\t/a\n2\t/a\n','1\t/a\n2\t/foreign\n','-1\t/a\n2\t/b\n','1.5\t/a\n2\t/b\n','01\t/a\n2\t/b\n','1\t/a\n2\t/b','1\t/a\textra\n2\t/b\n']:
            with self.subTest(text=text),self.assertRaises(RuntimeError):parse_complete_allocation_rows(text,{'/a','/b'},rows)
    def test_prior_failed_run_cannot_be_adopted_or_given_partial_totals(self):
        v={'status':'FAILED_OR_RESERVE_REFUSED_BUILD_ONLY_RETAIN_ALL','head':CANDIDATE,'exitCode':0,'error':'Physical measurement failed; no estimate or replay','diskGrowth':{'afterAllocations':None},'neverRetry':True}
        validate_prior_startup_failure(v)
        for key,value in [('status','PASS'),('head',PREDECESSOR),('error','ignored'),('diskGrowth',{'afterAllocations':{}}),('neverRetry',False)]:
            x=copy.deepcopy(v);x[key]=value
            with self.subTest(key=key),self.assertRaises(RuntimeError):validate_prior_startup_failure(x)

'''
replace('verify_build_guards.py',"if __name__=='__main__':unittest.main(verbosity=2)",extra+"if __name__=='__main__':unittest.main(verbosity=2)")
for n,text in source.items():compile(text,n,'exec')
D.mkdir();BEFORE.mkdir()
for n,v in old.items():
 with (BEFORE/n).open('xb') as f:f.write(v)
for n,text in source.items():
 with (D/n).open('x',encoding='utf-8',newline='') as f:f.write(text)
record={'status':'NEW_PROSPECTIVE_SOURCE_ONLY_NOT_APPROVED_OR_EXECUTED','predecessorSourceCommit':OLD,'priorFailedBuildEvidenceAudit':'23e8dad8d6442321586b7d0bf4920c48a8681054','priorFailureSha256':failure_sha,'proposedRoot':'/opt/lims/releases/workflow-batch-build-be837974-20261015T190000Z','sourceFiles':{n:{'bytes':(D/n).stat().st_size,'sha256':hashlib.sha256((D/n).read_bytes()).hexdigest()} for n in names},'newBuildProofCleanupHostOperations':0,'notARetryOrAdoptionOf180000':True}
with (D/'source-preparation-record.json').open('x',encoding='utf-8') as f:json.dump(record,f,indent=2)
print(json.dumps(record))
