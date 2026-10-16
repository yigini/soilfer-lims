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

OUTPUT_LIMIT=64*1024**2
PROGRAMS=frozenset(('docker','systemctl','httpd','du','df','python3','ps'))

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
        began=time.monotonic();code=None;error=None;process=None
        with out.open('xb') as stdout,err.open('xb') as stderr:
            try:
                process=subprocess.Popen(argv,stdout=stdout,stderr=stderr,
                    stdin=subprocess.PIPE if input_bytes is not None else subprocess.DEVNULL)
                written=0
                if input_bytes is not None:os.set_blocking(process.stdin.fileno(),False)
                while process.poll() is None:
                    if input_bytes is not None and written<len(input_bytes):
                        try:written+=os.write(process.stdin.fileno(),input_bytes[written:written+4096])
                        except BlockingIOError:pass
                        if written==len(input_bytes):process.stdin.close()
                    self.check(0)
                    if observer is not None:observer()
                    require(time.monotonic()-began<timeout,'Command deadline reached')
                    require(max(out.stat().st_size,err.stat().st_size)<=OUTPUT_LIMIT,'Command output bound reached')
                    time.sleep(0.05)
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
                stdout.flush();stderr.flush();os.fsync(stdout.fileno());os.fsync(stderr.fileno())
        out.chmod(0o400);err.chmod(0o400)
        metadata={'exitCode':code,'errorType':error,'elapsedSeconds':time.monotonic()-began,
                  'stdout':stream_identity(out),'stderr':stream_identity(err),'neverRetry':True}
        exclusive_record(self.root,label+'-command-result.json',metadata,self.sync)
        require(error is None and code==0 and max(metadata['stdout']['bytes'],metadata['stderr']['bytes'])<=OUTPUT_LIMIT,'Command failed; inspect the retained private streams and do not retry')
        require(allow_stderr or metadata['stderr']['bytes']==0,'Command stderr refused after original stream retention')
        return out.read_bytes(),err.read_bytes(),metadata
