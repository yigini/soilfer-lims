"""LOCAL original-byte replay. Provider, kernel, owners and unit are stand-ins."""
import copy
import pathlib
import subprocess
import sys
import types
import unittest
from unittest.mock import patch
import controller_output
import kit_capture_package as package
import kit_capture_controller as memory
import kit_capture_owned as owned
import kit_capture_construction as construction
import verify_kit_capture_controller as controller_fixtures
import verify_kit_capture_owned as owner_fixtures
from kit_capture_budget import CAPTURE_TABLE_SHA
from kit_capture_copy import capture_source_review
from kit_contract import canonical,sha,MEMORY_MAX
from retained_contract import exact_json
from retained_memory import RAW_NAMES,NON_RECLAIMABLE_FIELDS,NON_RECLAIMABLE_MAX


def synthetic_unit_payload(content,index,source):
    """Explicit synthetic future unit, never an actual host/hook receipt."""
    files={};memory_files={};controller_refs=[]
    def put(name,value):files[name]=canonical(value)+b'\n';return {'file':name,**package.pin(files[name])}
    for label in ('before','watch-000001','after'):
        _,_,reader,resolver=controller_fixtures.kernel();refs=[]
        def retain(path,raw):
            name='controller-memory-'+label+'-raw-'+str(len(refs)+1).zfill(2)+'.stdout'
            files[name]=raw;memory_files[name]=package.pin(raw)
            refs.append({'path':path,'original':name,**package.pin(raw)})
        value=memory.capture_controller_snapshot(reader,resolver,retain)
        name='controller-memory-'+label+'.json';controller_refs.append(put(name,{**value,'originalKernelReads':refs}))
        memory_files[name]=package.pin(files[name])
    calls=[];objects={}
    for label in sorted(owned.CAPTURE_COMMANDS):
        spec=owned.capture_spec(label);obj=owner_fixtures.capture_object(spec,False)
        obj['Id']=sha(label.encode());obj['State']['ExitCode']=0;objects[spec['owner']]=obj
        identity={'id':obj['Id'],'pid':41234,'startedAt':obj['State']['StartedAt'],'owner':spec['owner'],
            'oomKilled':False,'restarts':0,'memory':MEMORY_MAX,'memoryAndSwap':MEMORY_MAX}
        group='/sys/fs/cgroup/system.slice/docker-'+obj['Id']+'.scope'
        initial=None
        for ordinal,phase in ((1,'before-command-observation'),(2,'before-stop')):
            prefix=label+'-memory-'+str(ordinal).zfill(6);refs=[]
            membership=('0::/system.slice/docker-'+obj['Id']+'.scope\n').encode()
            _,_,reader,_=controller_fixtures.kernel()
            originals=[('/proc/41234/cgroup',membership),('/proc/77/mountinfo',reader('/mountinfo',256*1024))]
            originals += [(group+'/'+name,reader('/'+name,16384)) for name in RAW_NAMES]
            originals += [('/proc/41234/cgroup',membership)]
            for n,(path,raw) in enumerate(originals):
                name=prefix+'-raw-'+str(n).zfill(2)+'-'+pathlib.PurePosixPath(path).name+'.stdout'
                files[name]=raw;memory_files[name]=package.pin(raw)
                refs.append({'path':name,'kernelPath':path,**package.pin(raw)})
            sample={k:v for k,v in value.items() if k in ('memoryStat','memoryEvents','memoryPeakBytesObservation',
                'memoryMaxBytes','memorySwapMaxBytes')}
            record={**sample,'identity':identity,'cgroup':{'path':group,'device':7,'inode':8},
                'phase':phase,'observedUtc':'2026-10-16T11:00:20Z','originalKernelReads':refs,
                'nonReclaimableFields':list(NON_RECLAIMABLE_FIELDS),'nonReclaimableMaximumBytes':NON_RECLAIMABLE_MAX,
                'peakMaxHighPgscanPgstealAreObservationsOnly':True,'notYetValidated':True}
            name=prefix+'.json';put(name,record);memory_files[name]=package.pin(files[name])
    class Calls:
        retention_errors=[]
        def __call__(self,argv):
            calls.append(argv)
            if argv[1]=='ps':raw=(objects[argv[-1].split('=',2)[-1]]['Id']+'\n').encode()
            elif argv[1]=='inspect':raw=canonical([next(v for v in objects.values() if v['Id']==argv[-1])])+b'\n'
            else:raise AssertionError('Already stopped synthetic owners only')
            prefix='emergency-stop-post-'+str(len(calls)).zfill(6)
            files[prefix+'.stdout']=raw;files[prefix+'.stderr']=b''
            put(prefix+'.json',{'argvSha256':sha(canonical(argv)),'exitCode':0,'errorType':None,'elapsedSeconds':0.01,
                'completeNotTruncated':True,'neverRetry':True,'streamLimitsBytes':{'stdout':4*1024**2,'stderr':64*1024},
                'eofObserved':{'stdout':True,'stderr':True},'outputLimitExceeded':{'stdout':False,'stderr':False},
                'stdout':package.pin(raw),'stderr':package.pin(b''),'rawHostOnly':True})
            return raw
    stops=owned.stop_capture_owners(Calls());assert not stops['errors'],stops
    argv=package.capture_controller_argv(owned.CAPTURE_ROOT)
    put('controller-output-intent.json',{'version':1,'childArgv':argv,'maximumStreamBytes':controller_output.CONTROLLER_STREAM_LIMIT,
        'sentinelBytes':1,'namespaceBytes':controller_output.CONTROLLER_OUTPUT_BYTES,'newControllerDeadline':False,
        'controllerTerminationOnCaptureFailure':False,'neverRetry':True,'filesystemClosureClaimed':False})
    transport={'version':1,'childArgv':argv,'status':0,'errorType':None,'completeOriginals':True,
        'controllerSignalledByCapture':False,'neverRetry':True,'streams':{}}
    for stream in ('stdout','stderr'):
        files['controller-original.'+stream]=b''
        transport['streams'][stream]={**package.pin(b''),'eof':True,'overflow':False,'unretainedBytesObserved':False}
    put('controller-output-closed.json',transport)
    hook_refs=[];_,_,reader,resolver=controller_fixtures.kernel()
    hook=memory.capture_controller_snapshot(reader,resolver,lambda path,raw:hook_refs.append(
        {'path':path,'rawAscii':raw.decode('ascii'),**package.pin(raw)}))
    put('stop-post-controller-1.json',{'raws':hook_refs})
    put('capture-controller-complete.json',{'version':1,'root':owned.CAPTURE_ROOT.as_posix(),
        'sourceBinding':capture_source_review(index,source),'captureTableSha256':CAPTURE_TABLE_SHA,
        'contentReceipt':{'file':'capture-receipt.json',**package.pin(content['capture-receipt.json'])},
        'controllerRecords':controller_refs,'memoryFiles':memory_files,
        'releaseAuthorityGranted':False,'releaseGateConsumed':False,'neverRetry':True})
    put('stop-post-result.json',{'version':1,'root':owned.CAPTURE_ROOT.as_posix(),'unit':owned.CAPTURE_UNIT,
        'captureTableSha256':CAPTURE_TABLE_SHA,'status':'CAPTURE_CONTROLLER_CLOSED_CONTENT_SEALED_PENDING_PACKAGE_REVIEW',
        'stops':stops,'errors':[],'retentionErrors':[],'controller':hook,'transport':transport,
        'contentCommitment':{'receipt':{'file':'capture-receipt.json',**package.pin(content['capture-receipt.json'])},
            'originalFileCount':len(package.CAPTURE_REVIEW_FILES),'allOriginalContentPinsVerified':True,'fullContentSemanticsRechecked':False,
            'independentFullSemanticPackageReviewStillRequired':True},
        'allChecksComplete':True,'fullContentSemanticsRechecked':False,'releaseAuthorityGranted':False,
        'controllerRunCommitment':{'completion':{'file':'capture-controller-complete.json',**package.pin(files['capture-controller-complete.json'])},
            'originalMemoryFileCount':len(memory_files),'allOriginalMemoryPinsVerified':True,'fullMemorySemanticsRechecked':False,
            'independentFullSemanticPackageReviewStillRequired':True},
        'releaseGateConsumed':False,'productionRestartPermitted':False,'servingPermitGranted':False,'neverRetry':True})
    return repack(files)


def repack(files):
    result={package.PREFIX+n:raw for n,raw in files.items()}
    result[package.UNIT_INDEX]=canonical({'version':1,'root':owned.CAPTURE_ROOT.as_posix(),
        'captureTableSha256':CAPTURE_TABLE_SHA,'files':{n:package.pin(r) for n,r in files.items()}})+b'\n'
    return result


class CapturePackage(unittest.TestCase):
    def fixture(self):
        import verify_kit_package
        files,index,source,*_=verify_kit_package.package_fixture()
        originals={n[len(package.PREFIX):]:r for n,r in files.items() if n.startswith(package.PREFIX)}
        return files,index,source,originals

    def test_complete_package_requires_every_controller_owner_memory_and_independent_stop_original(self):
        files,index,source,originals=self.fixture()
        result=package.verify_capture_unit(originals,files,index,source)
        self.assertTrue(result['fullContentSemanticsRechecked']);self.assertFalse(result['releaseAuthorityGranted'])
        for name in originals:
            changed=dict(originals);del changed[name]
            with self.subTest(name=name),self.assertRaises((RuntimeError,KeyError)):
                package.verify_capture_unit(changed,files,index,source)

    def test_recomputed_hashes_do_not_hide_kernel_owner_transport_or_hook_failures(self):
        files,index,source,originals=self.fixture()
        for mutation in ('controller-oom','owner-oom','owner-group-bool','owner-mount','owner-absent',
                         'transport-bool','hook-incomplete','hook-boolean-eof','extra-memory'):
            changed=copy.deepcopy(originals)
            if mutation=='controller-oom':
                name='controller-memory-watch-000001-raw-03.stdout';changed[name]=changed[name].replace(b'oom 0',b'oom 1')
            elif mutation=='owner-oom':
                name=next(n for n in changed if n.endswith('-raw-03-memory.events.stdout'));changed[name]=changed[name].replace(b'oom 0',b'oom 1')
            elif mutation=='owner-group-bool':
                name=next(n for n in changed if n.startswith('capture-integrity-memory-') and n.endswith('.json'))
                value=exact_json(changed[name]);value['cgroup']['inode']=True;changed[name]=canonical(value)+b'\n'
            elif mutation in ('owner-mount','owner-absent'):
                name='emergency-stop-post-000002.stdout'
                value=exact_json(changed[name]);value[0]['Mounts'][0]['Source']='/FOREIGN'
                changed[name]=canonical(value)+b'\n' if mutation=='owner-mount' else b'[]\n'
                meta=exact_json(changed[name[:-7]+'.json']);meta['stdout']=package.pin(changed[name]);changed[name[:-7]+'.json']=canonical(meta)+b'\n'
            elif mutation=='transport-bool':
                name='controller-output-closed.json';value=exact_json(changed[name]);value['status']=False;changed[name]=canonical(value)+b'\n'
            elif mutation=='hook-incomplete':
                name='stop-post-result.json';value=exact_json(changed[name]);value['allChecksComplete']=False;changed[name]=canonical(value)+b'\n'
            elif mutation=='hook-boolean-eof':
                name='emergency-stop-post-000001.json';value=exact_json(changed[name]);value['eofObserved']['stdout']=1;changed[name]=canonical(value)+b'\n'
            else:changed['controller-memory-foreign.stdout']=b'UNBOUND'
            complete=exact_json(changed['capture-controller-complete.json'])
            for name in complete['memoryFiles']:complete['memoryFiles'][name]=package.pin(changed[name])
            for ref in complete['controllerRecords']:ref.update(package.pin(changed[ref['file']]))
            changed['capture-controller-complete.json']=canonical(complete)+b'\n'
            all_files={**files,**repack(changed)}
            with self.subTest(mutation=mutation),self.assertRaises((RuntimeError,KeyError)):
                package.capture_unit_payload(all_files,index,source)

    def test_real_local_empty_and_binary_child_streams_survive_independent_pure_package_check(self):
        files,index,source,originals=self.fixture();root=controller_fixtures.directory()
        argv=package.capture_controller_argv(owned.CAPTURE_ROOT)
        closed=controller_output.capture_controller(root,argv,False,spawn=lambda argv,**kw:
            subprocess.Popen([sys.executable,'-B','-c','import os;os.write(1,b"LOCAL\\x00\\xff")'],**kw))
        for name in ('controller-output-intent.json','controller-output-closed.json','controller-original.stdout','controller-original.stderr'):
            originals[name]=(root/name).read_bytes()
        outcome=exact_json(originals['stop-post-result.json']);outcome['transport']=closed
        originals['stop-post-result.json']=canonical(outcome)+b'\n'
        package.verify_capture_unit(originals,files,index,source)
        self.assertEqual(originals['controller-original.stdout'],b'LOCAL\x00\xff')
        self.assertEqual(originals['controller-original.stderr'],b'')

    def test_capture_construction_cannot_observe_host_when_stored_source_refuses(self):
        with patch.object(construction,'os',types.SimpleNamespace(name='posix')),\
             patch.object(construction,'capture_controller_inputs',side_effect=RuntimeError('LOCAL refused source')),\
             patch.object(construction,'bind_runtime') as bind,patch.object(construction,'measure_inputs') as measure,\
             patch.object(construction,'CaptureControllerGuard') as guard,patch.object(construction,'ContainerReader') as reader:
            with self.assertRaises(RuntimeError):construction.construct_capture()
            self.assertFalse(any(x.called for x in (bind,measure,guard,reader)))

    def test_fresh_provider_failure_precedes_all_kernel_production_and_docker_observations(self):
        with patch.object(construction,'os',types.SimpleNamespace(name='posix')),\
             patch.object(construction,'capture_controller_inputs',return_value=({},{})),\
             patch.object(construction,'capture_source_review',return_value={'LOCAL':True}),\
             patch.object(construction,'bind_runtime'),patch.object(construction,'CaptureSourceRunner'),\
             patch.object(construction,'CaptureAuthority') as authority,patch.object(construction,'measure_inputs') as measure,\
             patch.object(construction,'CaptureControllerGuard') as guard,patch.object(construction,'ContainerReader') as reader:
            authority.return_value.authorize.side_effect=RuntimeError('LOCAL primary unavailable')
            with self.assertRaises(RuntimeError):construction.construct_capture()
            self.assertFalse(any(x.called for x in (measure,guard,reader)))


if __name__=='__main__':unittest.main()
