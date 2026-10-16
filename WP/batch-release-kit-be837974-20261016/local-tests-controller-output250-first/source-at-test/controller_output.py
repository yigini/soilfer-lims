"""Silent stdlib controller transport, within the existing unit and clock.

Both controller pipes have fixed retained limits. Overflow keeps an explicitly
incomplete prefix and drains the remaining pipe without retaining it. It NEVER
terminates/signals the controller or a scientific installer, adds a deadline,
or changes an installer transaction. Missing complete closure denies serving.
Import is inert; this source has not run on a host.
"""
import hashlib
import json
import os
import pathlib
import stat
import subprocess
import sys
import time

CONTROLLER_OUTPUT_BYTES=16*1024**2
CONTROLLER_STREAM_LIMIT=4*1024**2
CONTROLLER_METADATA_LIMIT=8192
CONTROLLER_NAMES=frozenset((
    'controller-original.stdout','controller-original.stderr',
    'controller-output-intent.json','controller-output-intent.json.pending',
    'controller-output-closed.json','controller-output-closed.json.pending',
    'controller-output-bootstrap-failure.json','controller-output-bootstrap-failure.json.pending'))


def output_require(value,message):
    if not value:raise RuntimeError(message)


def output_canonical(value):return json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=True).encode()+b'\n'


def output_sync(root,sync):
    if not sync:return
    output_require(os.name=='posix','Linux directory fsync required')
    descriptor=os.open(str(root),os.O_RDONLY|os.O_DIRECTORY)
    try:os.fsync(descriptor)
    finally:os.close(descriptor)


def output_root(root):
    root=pathlib.Path(root)
    output_require(root.is_absolute() and root.is_dir(),'Existing absolute output root required')
    for part in (root,*root.parents):output_require(not part.is_symlink(),'Controller output ancestor alias refused')
    return root


def output_pin(path,maximum,links=1,immutable=True):
    path=pathlib.Path(path)
    for part in (path,*path.parents):output_require(not part.is_symlink(),'Controller original alias refused')
    before=path.lstat()
    output_require(stat.S_ISREG(before.st_mode) and before.st_nlink==links and 0<=before.st_size<=maximum,
        'Bounded independent controller original required')
    if immutable:
        output_require(stat.S_IMODE(before.st_mode)==0o400 if os.name=='posix' else not before.st_mode&0o222,
            'Immutable controller original required')
    fields=lambda s:(s.st_dev,s.st_ino,s.st_size,s.st_mode,s.st_nlink,s.st_mtime_ns,s.st_ctime_ns)
    descriptor=os.open(str(path),os.O_RDONLY|getattr(os,'O_NOFOLLOW',0))
    digest=hashlib.sha256();count=0
    try:
        output_require(fields(os.fstat(descriptor))==fields(before),'Controller original changed before read')
        while count<=before.st_size:
            raw=os.read(descriptor,min(65536,before.st_size+1-count))
            if not raw:break
            digest.update(raw);count+=len(raw)
        output_require(count==before.st_size and fields(os.fstat(descriptor))==fields(before) and
            fields(path.lstat())==fields(before),'Controller original changed while hashing')
    finally:os.close(descriptor)
    return {'bytes':count,'sha256':digest.hexdigest()}


def output_record(root,name,value,sync=True):
    output_require(name in CONTROLLER_NAMES and not name.endswith('.pending'),'Exact controller control name required')
    raw=output_canonical(value)
    output_require(len(raw)<=CONTROLLER_METADATA_LIMIT,'Controller control record exceeds admission')
    path=root/name;pending=root/(name+'.pending')
    output_require(not path.exists() and not path.is_symlink() and not pending.exists() and not pending.is_symlink(),
        'Controller control name consumed')
    descriptor=os.open(str(pending),os.O_WRONLY|os.O_CREAT|os.O_EXCL|getattr(os,'O_NOFOLLOW',0),0o600)
    try:
        remaining=memoryview(raw)
        while remaining:
            written=os.write(descriptor,remaining);output_require(written>0,'Controller control write made no progress')
            remaining=remaining[written:]
        os.fsync(descriptor);os.chmod(pending,0o400)
    finally:os.close(descriptor)
    os.link(pending,path);output_sync(root,sync)


def output_read_record(root,name):
    path=root/name;pending=root/(name+'.pending')
    pin=output_pin(path,CONTROLLER_METADATA_LIMIT,2)
    output_pin(pending,CONTROLLER_METADATA_LIMIT,2)
    output_require(os.path.samefile(path,pending),'Exact same-inode controller control pair required')
    with path.open('rb') as stream:raw=stream.read(CONTROLLER_METADATA_LIMIT+1)
    output_require(len(raw)==pin['bytes'] and hashlib.sha256(raw).hexdigest()==pin['sha256'] and
        output_pin(path,CONTROLLER_METADATA_LIMIT,2)==pin,'Controller control changed while reading')
    def pairs(values):
        result={}
        for key,value in values:
            output_require(key not in result,'Duplicate controller control key');result[key]=value
        return result
    value=json.loads(raw,object_pairs_hook=pairs)
    output_require(raw==output_canonical(value),'Canonical controller control required')
    return value


def controller_argv(root):return ['/usr/bin/python3','-B',str(root/'tooling/run_release.py'),'--root',str(root)]


def capture_controller(root,argv,sync=True,limit=CONTROLLER_STREAM_LIMIT,spawn=subprocess.Popen):
    root=output_root(root)
    output_require(type(limit) is int and 0<limit<=CONTROLLER_STREAM_LIMIT,'Bounded controller stream allowance required')
    # Data, both immutable metadata names, and every file/inode/entry allowance
    # fit the one fixed16MiB carved out of journal640MiB BEFORE any file/child.
    declared=2*((limit+1+4095)//4096*4096)+3*8192+len(CONTROLLER_NAMES)*2*4096
    output_require(declared<=CONTROLLER_OUTPUT_BYTES,'Controller output namespace does not fit')
    output_require(all(not (root/name).exists() and not (root/name).is_symlink() for name in CONTROLLER_NAMES),
        'Controller output namespace consumed')
    intent={'version':1,'childArgv':argv,'maximumStreamBytes':limit,'sentinelBytes':1,
        'namespaceBytes':CONTROLLER_OUTPUT_BYTES,'newControllerDeadline':False,
        'controllerTerminationOnCaptureFailure':False,'neverRetry':True,'filesystemClosureClaimed':False}
    output_record(root,'controller-output-intent.json',intent,sync)
    outputs={};identities={};pipes={};captured=dict.fromkeys(('stdout','stderr'),0)
    eof=dict.fromkeys(captured,False);overflow=dict.fromkeys(captured,False)
    discarded=dict.fromkeys(captured,False);error=None;process=None;status=None
    try:
        for name in captured:
            path=root/('controller-original.'+name)
            descriptor=os.open(str(path),os.O_WRONLY|os.O_CREAT|os.O_EXCL|getattr(os,'O_NOFOLLOW',0),0o600)
            outputs[name]=descriptor
            before=os.fstat(descriptor);identities[name]=(before.st_dev,before.st_ino)
        try:
            process=spawn(argv,stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.PIPE,bufsize=0)
            pipes={'stdout':process.stdout,'stderr':process.stderr}
            for pipe in pipes.values():os.set_blocking(pipe.fileno(),False)
            while process.poll() is None or not all(eof.values()):
                progress=False
                for name,pipe in pipes.items():
                    if eof[name]:continue
                    allowance=limit+1-captured[name]
                    retain=not overflow[name] and error is None and allowance>0
                    try:raw=os.read(pipe.fileno(),min(65536,allowance) if retain else 65536)
                    except BlockingIOError:continue
                    if not raw:eof[name]=True;progress=True;continue
                    progress=True
                    if not retain:discarded[name]=True;continue
                    try:
                        pending=memoryview(raw)
                        while pending:
                            written=os.write(outputs[name],pending)
                            output_require(written>0,'Controller output write made no progress')
                            captured[name]+=written;pending=pending[written:]
                        if captured[name]>limit:overflow[name]=True
                    except BaseException as failure:
                        error=type(failure).__name__;discarded[name]=True
                    # No terminate/kill/signal, even after overflow or ENOSPC.
                    # All scientific child clocks/transactions stay unchanged.
                if not progress:time.sleep(0.005)
            status=process.returncode
        except BaseException as failure:
            error=type(failure).__name__
            # The unit's existing lifecycle owns any still-running processes.
            # No new transaction-interrupting capture timeout or kill exists.
        finally:
            for pipe in pipes.values():pipe.close()
    finally:
        for name,descriptor in outputs.items():
            try:
                os.fsync(descriptor);current=os.fstat(descriptor)
                path=root/('controller-original.'+name);at_path=path.lstat()
                output_require(not path.is_symlink() and stat.S_ISREG(current.st_mode) and current.st_nlink==1 and
                    (current.st_dev,current.st_ino)==identities[name]==(at_path.st_dev,at_path.st_ino) and
                    current.st_size==at_path.st_size==captured[name],'Controller output descriptor/path identity changed')
                os.chmod(path,0o400)
            except BaseException as failure:error=type(failure).__name__
            finally:os.close(descriptor)
    streams={name:{**output_pin(root/('controller-original.'+name),limit+1),
        'eof':eof[name],'overflow':overflow[name],'unretainedBytesObserved':discarded[name]} for name in captured}
    output_sync(root,sync)
    complete=error is None and all(eof.values()) and not any(overflow.values()) and not any(discarded.values())
    closed={'version':1,'childArgv':argv,'status':status,'errorType':error,'streams':streams,
        'completeOriginals':complete,'controllerSignalledByCapture':False,'neverRetry':True}
    output_record(root,'controller-output-closed.json',closed,sync)
    return closed


def controller_output_closure(root,expected_status):
    root=output_root(root);intent=output_read_record(root,'controller-output-intent.json')
    expected={'version':1,'childArgv':controller_argv(root),'maximumStreamBytes':CONTROLLER_STREAM_LIMIT,
        'sentinelBytes':1,'namespaceBytes':CONTROLLER_OUTPUT_BYTES,'newControllerDeadline':False,
        'controllerTerminationOnCaptureFailure':False,'neverRetry':True,'filesystemClosureClaimed':False}
    output_require(intent==expected and type(intent['version']) is int,'Exact before-child controller output admission required')
    closed=output_read_record(root,'controller-output-closed.json')
    output_require(set(closed)=={'version','childArgv','status','errorType','streams','completeOriginals',
        'controllerSignalledByCapture','neverRetry'} and type(closed['version']) is int and closed['version']==1 and
        closed['childArgv']==expected['childArgv'] and type(closed['status']) is int and closed['status']==expected_status and
        closed['errorType'] is None and closed['completeOriginals'] is True and
        closed['controllerSignalledByCapture'] is False and closed['neverRetry'] is True and
        isinstance(closed['streams'],dict) and set(closed['streams'])=={'stdout','stderr'},
        'Complete successful controller output closure required')
    output_require(not (root/'controller-output-bootstrap-failure.json').exists() and
        not (root/'controller-output-bootstrap-failure.json.pending').exists(),'Controller transport failure retained')
    for name,record in closed['streams'].items():
        pin=output_pin(root/('controller-original.'+name),CONTROLLER_STREAM_LIMIT)
        output_require(isinstance(record,dict) and set(record)=={'bytes','sha256','eof','overflow','unretainedBytesObserved'} and
            type(record['bytes']) is int and {'bytes':record['bytes'],'sha256':record['sha256']}==pin and
            record['eof'] is True and record['overflow'] is False and record['unretainedBytesObserved'] is False,
            'Full unchanged EOF-observed controller originals required')
    return closed


def main():
    # Bootstrap stays silent: only the child produces stdout/stderr and both
    # are captured above. Hook/result records carry outcome, never a journal
    # copy or a discarded controller traceback. Early bootstrap failure cannot
    # manufacture complete closure or a serving permit.
    root=None
    try:
        from retained_contract import ROOT
        output_require(os.name=='posix' and sys.argv[1:]==['--root',str(ROOT)],'Exact Linux controller capture required')
        root=output_root(ROOT)
        closed=capture_controller(root,controller_argv(root))
        return closed['status'] if closed['completeOriginals'] and type(closed['status']) is int and closed['status'] in (0,1) else 1
    except BaseException as failure:
        if root is not None:
            try:output_record(root,'controller-output-bootstrap-failure.json',{'version':1,'errorType':type(failure).__name__,
                'completeOriginals':False,'neverRetry':True})
            except BaseException:pass
        return 1


if __name__=='__main__':sys.exit(main())
