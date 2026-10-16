"""Independent capture-unit original verification before release packaging.

Pure verification replays numeric kernel predicates and all six exact stops
from retained originals. It grants no gate, restart or serving authority.
Physical inode checks belong to export_capture_unit(), before copying bytes.
"""
import pathlib
import re
from kit_contract import MEMORY_MAX,canonical,require,sha
from kit_capture_owned import CAPTURE_ROOT,CAPTURE_UNIT,CAPTURE_COMMANDS,capture_spec,capture_selected,stop_capture_owners
from kit_capture_budget import CAPTURE_TABLE_SHA
from kit_capture_copy import capture_source_review
from kit_capture_controller import capture_controller_snapshot,capture_controller_same_group
from kit_capture_review import verify_capture_receipt
from retained_contract import exact_json
from retained_memory import (RAW_NAMES,READ_LIMITS,STAT_REQUIRED,EVENT_REQUIRED,NON_RECLAIMABLE_FIELDS,
    NON_RECLAIMABLE_MAX,pairs,scalar,gate,cgroup_path)
from controller_output import CONTROLLER_STREAM_LIMIT,CONTROLLER_OUTPUT_BYTES,output_pin
from capture_controller_output import capture_controller_argv,capture_controller_closure

PREFIX='capture-unit/'
UNIT_INDEX='capture-unit-index.json'
LIMIT=16*1024**2
FIXED=frozenset(('capture-controller-complete.json','controller-output-intent.json','controller-output-closed.json',
    'controller-original.stdout','controller-original.stderr','stop-post-controller-1.json','stop-post-result.json'))


def pin(raw):
    require(isinstance(raw,bytes) and len(raw)<=LIMIT,'Bounded original bytes required')
    return {'sha256':sha(raw),'bytes':len(raw)}


def bound_pin(raw,claimed):
    require(isinstance(claimed,dict) and set(claimed)=={'sha256','bytes'} and
        type(claimed.get('bytes')) is int and canonical(pin(raw))==canonical(claimed),'Full original hash/length differs')


def memory_name(name):
    return name.startswith('controller-memory-') or any(name.startswith(label+'-memory-') for label in CAPTURE_COMMANDS)


def physical_original(root,name,links=1):
    require(isinstance(name,str) and pathlib.PurePosixPath(name).name==name and name not in ('.','..'),
        'Exact capture original basename required')
    path=pathlib.Path(root)/name;before=output_pin(path,LIMIT,links)
    if links==2:
        pending=path.with_name(name+'.pending')
        require(output_pin(pending,LIMIT,2)==before and
            (pending.stat().st_dev,pending.stat().st_ino)==(path.stat().st_dev,path.stat().st_ino),
            'Original canonical control pair must share the same immutable inode')
    with path.open('rb') as stream:raw=stream.read(LIMIT+1)
    bound_pin(raw,before);require(output_pin(path,LIMIT,links)==before,'Original changed while reading')
    if links==2:require(raw==canonical(exact_json(raw))+b'\n','Canonical original control bytes required')
    return raw


def capture_memory_inventory(root):
    """Bind EVERY memory entry, refusing partial/refused or foreign names."""
    root=pathlib.Path(root);require(root.as_posix()==CAPTURE_ROOT.as_posix(),'Exact capture memory inventory root required')
    names=sorted(p.name for p in root.iterdir() if memory_name(p.name))
    require(0<len(names)<=60000,'Bounded complete memory inventory required')
    result={}
    for name in names:
        require('refus' not in name,'Any memory refusal prevents positive capture packaging')
        if name.endswith('.pending'):
            require(name[:-8] in names and name.startswith('controller-memory-') and name[:-8].endswith('.json'),
                'Unknown memory pending entry')
            continue
        links=2 if name.startswith('controller-memory-') and name.endswith('.json') else 1
        result[name]=pin(physical_original(root,name,links))
    return result


def replay_controller(sample,records,read,inline=False):
    require(isinstance(sample,dict) and type(sample.get('pid')) is int and sample['pid']>0 and
        isinstance(records,list) and len(records)==10,'All ten controller originals required')
    number=0
    def reader(path,limit):
        nonlocal number
        row=records[number];number+=1
        require(row.get('path')==str(path),'Numeric controller original read order/path differs')
        raw=row['rawAscii'].encode('ascii') if inline else read(row['original'])
        bound_pin(raw,{k:row[k] for k in ('sha256','bytes')})
        require(0<len(raw)<=limit,'Controller original exceeds its kernel read bound')
        return raw
    rebuilt=capture_controller_snapshot(reader,lambda path:sample['cgroup'],pid_reader=lambda:sample['pid'])
    original={k:v for k,v in sample.items() if k!='originalKernelReads'}
    require(number==10 and canonical(rebuilt)==canonical(original),'Controller sample differs from full numeric originals')
    return rebuilt


def replay_owner_memory(record,label,read,stopped):
    spec=capture_spec(label);identity=record.get('identity',{});group=record.get('cgroup',{})
    require(set(identity)=={'id','pid','startedAt','owner','oomKilled','restarts','memory','memoryAndSwap'} and
        identity['id']==stopped['id'] and identity['owner']==spec['owner'] and
        identity['startedAt']==stopped['startedAt'] and type(identity['pid']) is int and identity['pid']>0 and
        identity['oomKilled'] is False and type(identity['restarts']) is int and identity['restarts']==0 and
        type(identity['memory']) is int and type(identity['memoryAndSwap']) is int and
        identity['memory']==identity['memoryAndSwap']==MEMORY_MAX,'Exact capture-owner memory identity required')
    refs=record.get('originalKernelReads');require(isinstance(refs,list) and len(refs)==8,'Every owner kernel original required')
    raws=[]
    for ref in refs:
        raw=read(ref['path']);bound_pin(raw,{k:ref[k] for k in ('sha256','bytes')});raws.append(raw)
    proc='/proc/'+str(identity['pid'])+'/cgroup'
    require(refs[0]['kernelPath']==refs[-1]['kernelPath']==proc and raws[0]==raws[-1] and
        re.fullmatch('/proc/[1-9][0-9]*/mountinfo',refs[1]['kernelPath']) is not None,
        'Exact numeric owner membership/mount read order required')
    path=cgroup_path(identity['id'],raws[0],raws[1]).as_posix()
    require(set(group)=={'path','device','inode'} and group['path']==path and
        all(type(group[k]) is int and group[k]>=0 for k in ('device','inode')),'Exact numeric owner group identity required')
    values={}
    for name,ref,raw in zip(RAW_NAMES,refs[2:7],raws[2:7]):
        require(ref['kernelPath']==path+'/'+name and 0<len(raw)<=READ_LIMITS[name],
            'Owner kernel file path/bound differs')
        values[name]=raw
    require(len(raws[0])<=4096 and len(raws[1])<=256*1024,'Owner proc originals exceed bounds')
    rebuilt={'memoryStat':pairs(values['memory.stat'],STAT_REQUIRED),'memoryEvents':pairs(values['memory.events'],EVENT_REQUIRED),
        'memoryPeakBytesObservation':scalar(values['memory.peak']),'memoryMaxBytes':scalar(values['memory.max']),
        'memorySwapMaxBytes':scalar(values['memory.swap.max'])}
    gate(rebuilt)
    require(all(canonical(record.get(k))==canonical(v) for k,v in rebuilt.items()) and
        record.get('nonReclaimableFields')==list(NON_RECLAIMABLE_FIELDS) and
        type(record.get('nonReclaimableMaximumBytes')) is int and record['nonReclaimableMaximumBytes']==NON_RECLAIMABLE_MAX and
        record.get('peakMaxHighPgscanPgstealAreObservationsOnly') is True,
        'Owner memory projection differs from its complete originals')
    return {'identity':identity,'cgroup':group}


def replay_transport(files):
    intent=exact_json(files['controller-output-intent.json']);argv=capture_controller_argv(CAPTURE_ROOT)
    expected={'version':1,'childArgv':argv,'maximumStreamBytes':CONTROLLER_STREAM_LIMIT,'sentinelBytes':1,
        'namespaceBytes':CONTROLLER_OUTPUT_BYTES,'newControllerDeadline':False,
        'controllerTerminationOnCaptureFailure':False,'neverRetry':True,'filesystemClosureClaimed':False}
    require(canonical(intent)==canonical(expected),'Capture transport admission differs')
    value=exact_json(files['controller-output-closed.json'])
    require(set(value)=={'version','childArgv','status','errorType','streams','completeOriginals',
        'controllerSignalledByCapture','neverRetry'} and type(value['version']) is int and value['version']==1 and
        value['childArgv']==argv and type(value['status']) is int and value['status']==0 and value['errorType'] is None and
        value['completeOriginals'] is True and value['controllerSignalledByCapture'] is False and value['neverRetry'] is True and
        set(value['streams'])=={'stdout','stderr'},'Full successful capture transport required')
    for stream,ref in value['streams'].items():
        raw=files['controller-original.'+stream]
        require(set(ref)=={'bytes','sha256','eof','overflow','unretainedBytesObserved'} and
            len(raw)<=CONTROLLER_STREAM_LIMIT and ref['eof'] is True and ref['overflow'] is False and
            ref['unretainedBytesObserved'] is False,'Incomplete controller original')
        bound_pin(raw,{k:ref[k] for k in ('sha256','bytes')})
    return value


def verify_capture_unit(files,content,index,source):
    """Pure verification; outer hash recomputation cannot replace semantics."""
    binding=capture_source_review(index,source)
    require(isinstance(files,dict) and FIXED<=set(files),'Complete independent capture-unit originals required')
    receipt=exact_json(content['capture-receipt.json'])
    verify_capture_receipt(receipt,lambda name:content[name],index,source)
    complete=exact_json(files['capture-controller-complete.json'])
    require(type(complete.get('version')) is int and complete['version']==1 and complete.get('root')==CAPTURE_ROOT.as_posix() and
        complete.get('sourceBinding')==binding and complete.get('captureTableSha256')==CAPTURE_TABLE_SHA and
        complete.get('releaseAuthorityGranted') is False and complete.get('releaseGateConsumed') is False and
        complete.get('neverRetry') is True and canonical(complete.get('contentReceipt'))==
            canonical({'file':'capture-receipt.json',**pin(content['capture-receipt.json'])}),'Exact controller completion required')
    memory=complete.get('memoryFiles');require(isinstance(memory,dict) and memory,'Every controller/owner memory original required')
    for name,ref in memory.items():require(memory_name(name),'Foreign memory file');bound_pin(files[name],ref)
    wanted=set(FIXED)|set(memory);used=set();controller=[]
    refs=complete.get('controllerRecords');require(isinstance(refs,list) and 2<=len(refs)<=60000,'Initial and final controller checks required')
    for ordinal,ref in enumerate(refs):
        label='before' if ordinal==0 else 'after' if ordinal==len(refs)-1 else 'watch-'+str(ordinal).zfill(6)
        name='controller-memory-'+label+'.json'
        require(ref.get('file')==name,'Controller sample omitted, reordered or duplicated')
        bound_pin(files[name],{k:ref[k] for k in ('sha256','bytes')});used.add(name)
        value=exact_json(files[name]);kernel=value.get('originalKernelReads')
        rebuilt=replay_controller(value,kernel,lambda n:files[n]);controller.append(rebuilt)
        for n,row in enumerate(kernel,1):
            require(row['original']=='controller-memory-'+label+'-raw-'+str(n).zfill(2)+'.stdout','Controller raw namespace differs')
            used.add(row['original'])
        capture_controller_same_group(controller[0],rebuilt)
    transport=replay_transport(files)
    outcome=exact_json(files['stop-post-result.json']);hook=exact_json(files['stop-post-controller-1.json'])
    final=replay_controller(outcome.get('controller'),hook.get('raws'),None,True)
    capture_controller_same_group(controller[0],final)
    call_number=0;strict_after={}
    class Calls:
        retention_errors=[]
        def __call__(self,argv):
            nonlocal call_number
            call_number+=1;name='emergency-stop-post-'+str(call_number).zfill(6)
            require(call_number<=96,'Independent stop call bound exceeded')
            metadata=exact_json(files[name+'.json']);out=files[name+'.stdout'];err=files[name+'.stderr']
            wanted.update((name+'.json',name+'.stdout',name+'.stderr'))
            require(metadata.get('argvSha256')==sha(canonical(argv)) and type(metadata.get('exitCode')) is int and
                metadata['exitCode']==0 and metadata.get('errorType') is None and metadata.get('completeNotTruncated') is True and
                metadata.get('neverRetry') is True and metadata.get('streamLimitsBytes')=={'stdout':4*1024**2,'stderr':64*1024} and
                canonical(metadata.get('eofObserved'))==canonical({'stdout':True,'stderr':True}) and
                canonical(metadata.get('outputLimitExceeded'))==canonical({'stdout':False,'stderr':False}) and not err,
                'Independent stop command was incomplete, changed or failed')
            for suffix,raw,limit in (('stdout',out,4*1024**2),('stderr',err,64*1024)):
                require(len(raw)<=limit,'Independent stop original exceeds bound');bound_pin(raw,metadata[suffix])
            if argv[1]=='inspect':
                rows=exact_json(out);require(isinstance(rows,list) and len(rows)==1,'One full original owner required')
                obj=rows[0];matches=[capture_spec(label) for label in CAPTURE_COMMANDS if obj.get('Name')=='/'+capture_spec(label)['name']]
                require(len(matches)==1,'Foreign owner inspection');selected=capture_selected(obj,matches[0])
                if selected['running'] is False:
                    require(type(obj['State'].get('ExitCode')) is int and obj['State']['ExitCode']==0,'Capture wrapper exit failed')
                    strict_after[matches[0]['label']]=selected
            return out
    stops=stop_capture_owners(Calls())
    require(not stops['errors'] and not stops['observedAbsentOwners'] and len(stops['stoppedAndRetained'])==6 and
        len(strict_after)==6 and len({r['id'] for r in strict_after.values()})==6 and
        canonical(stops)==canonical(outcome.get('stops')),'Every full retained owner stop must replay')
    for label in sorted(CAPTURE_COMMANDS):
        prefix=label+'-memory-';names=sorted(n for n in memory if re.fullmatch(re.escape(prefix)+'[0-9]{6}[.]json',n))
        require(2<=len(names)<=4096,'Every capture owner requires initial and before-stop memory originals')
        descriptor=None
        for ordinal,name in enumerate(names,1):
            require(name==prefix+str(ordinal).zfill(6)+'.json','Owner memory sample gap or replay')
            record=exact_json(files[name]);used.add(name)
            expected='before-command-observation' if ordinal==1 else 'before-stop' if ordinal==len(names) else 'running-command'
            require(record.get('phase')==expected,'Owner memory stage order differs')
            current=replay_owner_memory(record,label,lambda n:files[n],strict_after[label])
            require(descriptor is None or canonical(descriptor)==canonical(current),'Owner cgroup/PID changed between samples')
            descriptor=current
            for raw_number,row in enumerate(record['originalKernelReads']):
                require(row['path']==name[:-5]+'-raw-'+str(raw_number).zfill(2)+'-'+
                    pathlib.PurePosixPath(row['kernelPath']).name+'.stdout','Owner raw original namespace differs')
                used.add(row['path'])
    require(used==set(memory),'Missing, extra or unbound controller/owner memory original')
    commitment={'receipt':{'file':'capture-receipt.json',**pin(content['capture-receipt.json'])},
        'originalFileCount':19,'allOriginalContentPinsVerified':True,'fullContentSemanticsRechecked':False,
        'independentFullSemanticPackageReviewStillRequired':True}
    run_commitment={'completion':{'file':'capture-controller-complete.json',**pin(files['capture-controller-complete.json'])},
        'originalMemoryFileCount':len(memory),'allOriginalMemoryPinsVerified':True,'fullMemorySemanticsRechecked':False,
        'independentFullSemanticPackageReviewStillRequired':True}
    require(type(outcome.get('version')) is int and outcome['version']==1 and outcome.get('root')==CAPTURE_ROOT.as_posix() and
        outcome.get('unit')==CAPTURE_UNIT and outcome.get('captureTableSha256')==CAPTURE_TABLE_SHA and
        outcome.get('status')=='CAPTURE_CONTROLLER_CLOSED_CONTENT_SEALED_PENDING_PACKAGE_REVIEW' and
        outcome.get('errors')==[] and outcome.get('retentionErrors')==[] and outcome.get('allChecksComplete') is True and
        canonical(outcome.get('transport'))==canonical(transport) and canonical(outcome.get('contentCommitment'))==canonical(commitment) and
        canonical(outcome.get('controllerRunCommitment'))==canonical(run_commitment) and
        all(outcome.get(k) is False for k in ('fullContentSemanticsRechecked','releaseAuthorityGranted','releaseGateConsumed',
            'productionRestartPermitted','servingPermitGranted')) and outcome.get('neverRetry') is True,
        'Independent positive capture stop outcome differs')
    require(set(files)==wanted,'Incomplete or expanded capture-unit original inventory')
    return {'independentUnitAndEveryMemoryOriginalVerified':True,'fullContentSemanticsRechecked':True,
        'sourceBinding':binding,'releaseAuthorityGranted':False}


def capture_unit_payload(files,index,source):
    declared=exact_json(files[UNIT_INDEX]);pins=declared.get('files')
    require(type(declared.get('version')) is int and declared['version']==1 and
        declared.get('root')==CAPTURE_ROOT.as_posix() and declared.get('captureTableSha256')==CAPTURE_TABLE_SHA and
        isinstance(pins,dict) and 0<len(pins)<=1024,'Complete bounded unit original index required')
    originals={}
    for name,ref in pins.items():
        require(isinstance(name,str) and pathlib.PurePosixPath(name).name==name,'Canonical flat unit original name required')
        originals[name]=files[PREFIX+name];bound_pin(originals[name],ref)
    verify_capture_unit(originals,files,index,source)
    return {UNIT_INDEX,*[PREFIX+name for name in pins]}


def export_capture_unit(root,index,source,content):
    """Read-only export after exact unit closure; never runs a hook or owner."""
    capture_source_review(index,source)
    root=pathlib.Path(root);require(root.as_posix()==CAPTURE_ROOT.as_posix(),'Exact closed capture root required')
    capture_controller_closure(root)
    complete=exact_json(physical_original(root,'capture-controller-complete.json',2))
    memory=capture_memory_inventory(root)
    require(canonical(memory)==canonical(complete['memoryFiles']),'Complete memory inventory changed after controller return')
    names=set(FIXED)|set(memory)
    entries=[p.name for p in root.iterdir() if p.name.startswith('emergency-stop-post-') and not p.name.endswith('.pending')]
    names.update(entries);originals={}
    for name in sorted(names):
        links=2 if name in FIXED and name.endswith('.json') or name.startswith('emergency-stop-post-') and name.endswith('.json') or name.startswith('controller-memory-') and name.endswith('.json') else 1
        originals[name]=physical_original(root,name,links)
    verify_capture_unit(originals,content,index,source)
    result={PREFIX+n:r for n,r in originals.items()}
    result[UNIT_INDEX]=canonical({'version':1,'root':CAPTURE_ROOT.as_posix(),'captureTableSha256':CAPTURE_TABLE_SHA,
        'files':{n:pin(r) for n,r in originals.items()}})+b'\n'
    return result
