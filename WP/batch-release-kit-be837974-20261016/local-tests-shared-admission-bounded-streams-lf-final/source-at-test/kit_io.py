"""Bounded command transport, with original private streams before predicates.

There is no command-line entry point. The complete reviewed production adapter
must supply exact argv and phase labels. Docker ownership is checked by that
adapter, never inferred from a command's exit code or an error string.
"""
import os
import pathlib
import re
import subprocess
import time
from kit_contract import canonical,require,sha
from kit_journal import exclusive_record,real_directory
from kit_evidence import admit_evidence

OUTPUT_LIMIT=64*1024**2
# One extra original byte proves an over-limit stream. The transport never
# writes more than this amount, even when the child exits between guard polls.
OUTPUT_RETAINED_LIMIT=OUTPUT_LIMIT+1
READ_CHUNK=65536
PROGRAMS=frozenset(('docker','systemctl','httpd','apachectl','curl','containerd','du','df','python3','ps'))

class CommandOutputLimitError(RuntimeError):pass

def drain_streams(streams,outputs,captured,eof,exceeded,rounds=16):
    """Copy bounded original pipe bytes; no reader threads or direct child files.

    Each descriptor is nonblocking. An inherited pipe can therefore neither
    strand a writer after sealing nor hide behind the direct child's exit.
    Only a fully drained, EOF-observed stream can be called complete.
    """
    progress=False
    for _ in range(rounds):
        changed=False
        for name,pipe in streams.items():
            if eof[name] or exceeded[name]:continue
            remaining=OUTPUT_RETAINED_LIMIT-captured[name]
            require(remaining>0,'No unreserved output read permitted')
            try:raw=os.read(pipe.fileno(),min(READ_CHUNK,remaining))
            except BlockingIOError:continue
            if not raw:eof[name]=True;changed=True;continue
            outputs[name].write(raw);captured[name]+=len(raw);changed=True
            if captured[name]>OUTPUT_LIMIT:exceeded[name]=True
        progress=progress or changed
        if not changed:break
    return progress

def stream_identity(path):
    h=__import__('hashlib').sha256();size=0
    with pathlib.Path(path).open('rb') as source:
        while True:
            chunk=source.read(1024**2)
            if not chunk:break
            h.update(chunk);size+=len(chunk)
    return {'sha256':h.hexdigest(),'bytes':size,'rawHostOnly':True}

class CommandRunner:
    def __init__(self,root,check,require_directory_sync=True,programs=PROGRAMS):
        self.root=real_directory(root);self.check=check;self.sync=require_directory_sync;self.programs=programs

    def run(self,argv,label,timeout=30,input_bytes=None,allow_stderr=False,observer=None):
        require(isinstance(argv,list) and len(argv)>1 and all(isinstance(x,str) and '\x00' not in x for x in argv),'Explicit argv required')
        require(argv[0] in self.programs and '--rm' not in argv,'Unreviewed program or automatic container deletion refused')
        require(isinstance(label,str) and re.fullmatch('[a-z0-9][a-z0-9-]{0,110}',label),'Unique command label required')
        require(type(timeout) is int and 0<timeout<=600,'Existing bounded operation timeout required')
        require(input_bytes is None or isinstance(input_bytes,bytes) and 0<len(input_bytes)<=1024**2,'Bounded reviewed stdin required')
        self.check(timeout)
        out=self.root/(label+'.stdout');err=self.root/(label+'.stderr')
        # The intent contains only argv hash/length. Secrets, if any, never
        # become public metadata or exception messages.
        exclusive_record(self.root,label+'-command-intent.json',{
            'argvSha256':sha(canonical(argv)),'argvEntries':len(argv),'timeoutSeconds':timeout,
            'stdinSha256':None if input_bytes is None else sha(input_bytes),
            'rawStreamsPrivateUntilReviewed':True,'neverRetry':True},self.sync)
        # Both complete streams, including an over-limit sentinel, have space
        # admitted before launch. Other runtime producers cannot spend it.
        reservations=[admit_evidence(p,OUTPUT_RETAINED_LIMIT,reservation=True) for p in (out,err)]
        began=time.monotonic();code=None;error=None;process=None;streams={}
        captured={'stdout':0,'stderr':0};eof={'stdout':False,'stderr':False};exceeded={'stdout':False,'stderr':False}
        with out.open('xb') as stdout,err.open('xb') as stderr:
            outputs={'stdout':stdout,'stderr':stderr}
            try:
                process=subprocess.Popen(argv,stdout=subprocess.PIPE,stderr=subprocess.PIPE,bufsize=0,
                    stdin=subprocess.PIPE if input_bytes is not None else subprocess.DEVNULL)
                streams={'stdout':process.stdout,'stderr':process.stderr}
                for pipe in streams.values():os.set_blocking(pipe.fileno(),False)
                written=0
                if input_bytes is not None:os.set_blocking(process.stdin.fileno(),False)
                next_guard=began
                while process.poll() is None or not all(eof.values()):
                    progress=drain_streams(streams,outputs,captured,eof,exceeded)
                    if any(exceeded.values()):raise CommandOutputLimitError('Command output bound reached')
                    if input_bytes is not None and written<len(input_bytes):
                        try:written+=os.write(process.stdin.fileno(),input_bytes[written:written+4096])
                        except BlockingIOError:pass
                        if written==len(input_bytes):process.stdin.close()
                    now=time.monotonic()
                    require(now-began<timeout,'Command deadline reached')
                    if now>=next_guard:
                        self.check(0)
                        if observer is not None:observer()
                        next_guard=now+0.05
                    if not progress:time.sleep(0.005)
                code=process.returncode
                require(input_bytes is None or written==len(input_bytes),'Reviewed stdin delivery incomplete')
            except BaseException as failure:
                error=type(failure).__name__
                # Only this transport is terminated. Exact owned containers
                # still require independent stop/retention by the caller.
                if process is not None and process.poll() is None:
                    process.terminate()
                    try:process.wait(timeout=5)
                    except subprocess.TimeoutExpired:process.kill();process.wait(timeout=5)
            finally:
                if process is not None and process.stdin is not None and not process.stdin.closed:process.stdin.close()
                # Retain only the still-readable prefix after a failure. Never
                # wait for descendants holding pipes, or label this as complete.
                try:
                    while drain_streams(streams,outputs,captured,eof,exceeded):pass
                finally:
                    for pipe in streams.values():pipe.close()
                stdout.flush();stderr.flush();os.fsync(stdout.fileno());os.fsync(stderr.fileno())
        out.chmod(0o400);err.chmod(0o400)
        for reservation,path in zip(reservations,(out,err)):
            if reservation is not None:reservation[0].settle(reservation[1],path.stat().st_size)
        metadata={'exitCode':code,'errorType':error,'elapsedSeconds':time.monotonic()-began,
                  'stdout':stream_identity(out),'stderr':stream_identity(err),'neverRetry':True,
                  'streamCapture':{'perStreamLimitBytes':OUTPUT_LIMIT,
                      'retainedMaximumBytesPerStream':OUTPUT_RETAINED_LIMIT,
                      'eofObserved':eof,'outputLimitExceeded':exceeded,
                      'allOriginalBytesRetained':error is None and all(eof.values()) and not any(exceeded.values())}}
        exclusive_record(self.root,label+'-command-result.json',metadata,self.sync)
        require(error is None and code==0 and metadata['streamCapture']['allOriginalBytesRetained'] and max(metadata['stdout']['bytes'],metadata['stderr']['bytes'])<=OUTPUT_LIMIT,'Command failed; inspect the retained private streams and do not retry')
        require(allow_stderr or metadata['stderr']['bytes']==0,'Command stderr refused after original stream retention')
        return out.read_bytes(),err.read_bytes(),metadata
