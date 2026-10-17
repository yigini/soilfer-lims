"""Before-create CLI pipe admission and independent full-original verification.

Docker daemon logging is disabled only for these fifteen owned CLI containers.
This does not close candidate/daemon lifecycle/overlay or filesystem metadata.
"""
import json
import os
import pathlib
from kit_contract import canonical,require,sha
from kit_evidence import admit_evidence
from controller_output import output_pin,output_read_record

STREAM_LIMIT=32*1024**2

def verify_completion_record(directory,raw):
    directory=pathlib.Path(directory);path=directory/'cli-child-complete.json'
    pin=output_pin(path,8192,2);output_pin(directory/'cli-child-complete.json.pending',8192,2)
    require(os.path.samefile(path,directory/'cli-child-complete.json.pending') and
        pin=={'bytes':len(raw),'sha256':sha(raw)},'Exact immutable CLI completion pair/raw bytes required')
    return pin

def admission(child):
    return {'childArgvSha256':sha(json.dumps(child,separators=(',',':')).encode()),
        'childSignalledOnCaptureFailure':False,'filesystemClosureClaimed':False,
        'maximumStderrBytes':STREAM_LIMIT,'maximumStdoutBytes':STREAM_LIMIT,
        'metadataMaximumBytes':8192,'newChildDeadline':False,'sentinelBytes':1,'version':1}

def reserve_cli_output(directory):
    directory=pathlib.Path(directory);held={}
    for name in ('stdout','stderr'):
        claim=admit_evidence(directory/('cli-original.'+name),STREAM_LIMIT+1,
            reservation=True,future_directory=directory)
        require(claim is not None,'CLI original output requires its shared evidence ledger before mkdir')
        held[name]=claim
    claim=admit_evidence(directory/'cli-output-admission.json',8192,pending=True,
        reservation=True,future_directory=directory)
    require(claim is not None,'CLI control admission requires its bound ledger before mkdir')
    held['admission']=claim
    return held

def publish_cli_admission(directory,child,held,sync=True):
    directory=pathlib.Path(directory);ledger,ticket=held['admission']
    path=directory/'cli-output-admission.json';pending=directory/'cli-output-admission.json.pending'
    require(ticket in ledger.open and ledger.open[ticket][2:4]==(8192,2) and
        ledger.root in directory.parents and all(p.relative_to(ledger.root).as_posix() in ledger.paths for p in (path,pending)),
        'Missing exact before-mkdir CLI control admission')
    raw=canonical(admission(child))+b'\n';require(len(raw)<=8192,'CLI admission exceeds held bound')
    fd=os.open(str(pending),os.O_CREAT|os.O_EXCL|os.O_WRONLY|getattr(os,'O_NOFOLLOW',0)|getattr(os,'O_BINARY',0),0o600)
    try:
        with os.fdopen(fd,'wb',closefd=False) as stream:stream.write(raw);stream.flush();os.fsync(fd)
        os.chmod(pending,0o400);os.fsync(fd)
    finally:os.close(fd)
    os.link(pending,path)
    from kit_package import sync_directory
    sync_directory(directory,sync)
    ledger.settle(ticket,len(raw))

def verify_cli_output(directory,child,value,held=None,read_bytes=False):
    directory=pathlib.Path(directory)
    require(output_read_record(directory,'cli-output-admission.json')==admission(child),
        'CLI output admission differs from exact child argv')
    require(isinstance(value,dict) and set(value)=={'version','streams','completeOriginals','childSignalledByCapture'} and
        type(value['version']) is int and value['version']==1 and value['completeOriginals'] is True and
        value['childSignalledByCapture'] is False and isinstance(value['streams'],dict) and
        set(value['streams'])=={'stdout','stderr'},'Incomplete original CLI streams; retain, never retry')
    pins={}
    for name in ('stdout','stderr'):
        expected=value['streams'][name]
        require(isinstance(expected,dict) and set(expected)=={'bytes','sha256','eof','overflow','unretainedBytesObserved'} and
            type(expected['bytes']) is int and expected['eof'] is True and expected['overflow'] is False and
            expected['unretainedBytesObserved'] is False,'CLI original EOF/overflow/completeness differs')
        pins[name]=output_pin(directory/('cli-original.'+name),STREAM_LIMIT)
        require(pins[name]=={k:expected[k] for k in ('bytes','sha256')},'Original CLI raw hash/length differs')
    if held is not None:
        require(set(held)=={'stdout','stderr','admission'},'Both before-create CLI stream/control claims required')
        for name in ('stdout','stderr'):
            claim=held[name];claim[0].settle(claim[1],pins[name]['bytes'])
    raw=b''
    if read_bytes:
        require(pins['stderr']['bytes']==0,'Nonempty original CLI stderr refused')
        with (directory/'cli-original.stdout').open('rb') as stream:raw=stream.read(STREAM_LIMIT+1)
        require(len(raw)==pins['stdout']['bytes'] and sha(raw)==pins['stdout']['sha256'] and
            output_pin(directory/'cli-original.stdout',STREAM_LIMIT)==pins['stdout'],
            'CLI original changed during final result read')
    return raw,b'',{'streams':pins,'completeOriginals':True,'dockerDaemonLoggingDisabled':True,
        'childSignalledByCapture':False,'filesystemClosureClaimed':False}
