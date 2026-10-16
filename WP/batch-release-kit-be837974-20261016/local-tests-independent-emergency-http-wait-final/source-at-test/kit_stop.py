"""Independent CLI stop path, also usable by the future ExecStopPost hook.

No reserve/headroom/memory predicate may suppress an exact owned stop. Raw
calls stay private. Retention errors are collected and reported after all
owners have been attempted; they never authorize a foreign container stop.
Candidate/predecessor stop bindings are still separate, unfinished work.
"""
import os
import io
import re
import subprocess
import time
from kit_contract import canonical,require,sha
from retained_contract import exact_json
from kit_owned import ALLOWED,LABEL,cli_spec,selected,same_retained
from kit_integrity import DATA_MOUNT
from kit_journal import exclusive_record
from kit_io import drain_streams
from kit_evidence import (allocation,EMERGENCY_CALL_LIMIT,EMERGENCY_STREAM_LIMITS,
    EMERGENCY_METADATA_LIMIT,EMERGENCY_NAMESPACE_BYTES)

MAX_OUTPUT=4*1024**2

class EmergencyCommands:
    def __init__(self,record_root,require_directory_sync=True,spawn=subprocess.Popen,namespace='controller'):
        self.root=record_root;self.sync=require_directory_sync;self.spawn=spawn
        require(namespace in ('controller','stop-post'),'Exact independent emergency namespace required')
        self.namespace=namespace
        self.sequence=0;self.retention_errors=[]

    def retain(self,label,raw,metadata):
        # These checks are deliberately AFTER launch/pipe closure. Even an
        # unexpected extra call or failed allocation must still attempt stop.
        require(self.sequence<=EMERGENCY_CALL_LIMIT,'Independent emergency retained-call envelope exhausted')
        require(all(len(content)<=EMERGENCY_STREAM_LIMITS[name]+1 for name,content in zip(('stdout','stderr'),raw)),
            'Independent emergency stream envelope exceeded')
        require(len(canonical(metadata))+1<=EMERGENCY_METADATA_LIMIT,'Independent emergency metadata bound exceeded')
        worst=sum(allocation(n+1) for n in EMERGENCY_STREAM_LIMITS.values())+allocation(EMERGENCY_METADATA_LIMIT,2)
        require(EMERGENCY_CALL_LIMIT*worst<=EMERGENCY_NAMESPACE_BYTES,'Independent emergency namespace declaration insufficient')
        for suffix,content in zip(('stdout','stderr'),raw):
            path=self.root/(label+'.'+suffix)
            fd=os.open(str(path),os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o400)
            with os.fdopen(fd,'wb') as handle:handle.write(content);handle.flush();os.fsync(handle.fileno())
        exclusive_record(self.root,label+'.json',metadata,self.sync,independent_namespace=self.namespace)

    def __call__(self,argv):
        docker=isinstance(argv,list) and len(argv)>=3 and argv[0]=='docker' and argv[1] in ('ps','inspect','stop')
        apache=argv==['apachectl','configtest']
        reload=argv==['systemctl','reload','httpd']
        curl=isinstance(argv,list) and argv[:-1]==['curl','--silent','--show-error','--max-time','15','--proto','=https','--tlsv1.2',
            '--output','/dev/null','--write-out','%{http_code}'] and argv[-1] in (
                'https://lims.yigini.net/api/health','https://lims.yigini.net/login')
        require(isinstance(argv,list) and all(isinstance(x,str) for x in argv) and '--rm' not in argv and
                (docker or apache or reload or curl),'Emergency path permits only exact owner reads/stops and503 rehold')
        self.sequence+=1;label='emergency-'+self.namespace+'-'+str(self.sequence).zfill(6)
        # Keep bounded originals in RAM until the command has completed. A full
        # evidence filesystem cannot stop the actual emergency command launch.
        began=time.monotonic();process=None;error=None;code=None
        outputs={name:io.BytesIO() for name in ('stdout','stderr')};streams={}
        captured=dict.fromkeys(outputs,0);eof=dict.fromkeys(outputs,False);exceeded=dict.fromkeys(outputs,False)
        try:
            process=self.spawn(argv,stdout=subprocess.PIPE,stderr=subprocess.PIPE,stdin=subprocess.DEVNULL,bufsize=0)
            streams={'stdout':process.stdout,'stderr':process.stderr}
            for pipe in streams.values():os.set_blocking(pipe.fileno(),False)
            while process.poll() is None or not all(eof.values()):
                progress=drain_streams(streams,outputs,captured,eof,exceeded,limits=EMERGENCY_STREAM_LIMITS)
                require(not any(exceeded.values()),'Emergency output incomplete/oversized')
                require(time.monotonic()-began<30,'Emergency transport deadline reached')
                if not progress:time.sleep(0.005)
            code=process.returncode
        except BaseException as failure:
            error=type(failure).__name__
            if process is not None and process.poll() is None:
                process.kill()
                try:process.wait(timeout=5)
                except BaseException:pass
        finally:
            try:
                while drain_streams(streams,outputs,captured,eof,exceeded,limits=EMERGENCY_STREAM_LIMITS):pass
            except BaseException as failure:error=error or type(failure).__name__
            finally:
                for pipe in streams.values():pipe.close()
        complete=all(eof.values()) and not any(exceeded.values()) and error is None
        raw=[outputs[name].getvalue() for name in ('stdout','stderr')]
        metadata={'argvSha256':sha(canonical(argv)),'exitCode':code,'errorType':error,
            'elapsedSeconds':time.monotonic()-began,'completeNotTruncated':complete,'neverRetry':True,
            'streamLimitsBytes':dict(EMERGENCY_STREAM_LIMITS),'eofObserved':eof,'outputLimitExceeded':exceeded,
            'stdout':{'sha256':sha(raw[0]),'bytes':len(raw[0])},
            'stderr':{'sha256':sha(raw[1]),'bytes':len(raw[1])},'rawHostOnly':True}
        # Best effort preservation is intentionally AFTER the stop command. A
        # failed write is an explicit hook failure, not permission to skip stop.
        try:
            self.retain(label,raw,metadata)
        except BaseException as failure:
            self.retention_errors.append({'call':label,'errorType':type(failure).__name__,
                'metadata':metadata,'_privateUnretainedOriginals':raw})
        require(complete and code==0 and (apache or not raw[1]),'Emergency bounded interface refused; never retry')
        return raw[0]

def stop_cli_owners(call,owners=None):
    """Look up exact compiled owners even after lost create/start output.

    All 15 possible CLI owners are inspected when called by an independent
    hook. Empty inventories are explicit per-owner absence observations; they
    are never described as a nonvacuous successful container stop.
    """
    owners=sorted(ALLOWED) if owners is None else list(owners)
    require(len(owners)==len(set(owners)) and all(x in ALLOWED for x in owners),'Only exact reviewed CLI owners permitted')
    stopped=[];absent=[];errors=[]
    for label in owners:
        phase='inventory'
        try:
            spec=cli_spec(label,DATA_MOUNT)
            raw=call(['docker','ps','-aq','--no-trunc','--filter','label='+LABEL+'='+spec['owner']])
            require(len(raw)<=512*1024,'Bounded owner inventory required')
            ids=raw.decode('ascii').splitlines()
            require(len(ids)<=1 and len(ids)==len(set(ids)) and all(re.fullmatch('[a-f0-9]{64}',x) for x in ids),
                    'Duplicate/malformed exact-owner inventory')
            if not ids:absent.append({'owner':spec['owner'],'observedAbsent':True});continue
            identity=ids[0];phase='inspectBefore'
            rows=exact_json(call(['docker','inspect',identity]));require(isinstance(rows,list) and len(rows)==1 and rows[0].get('Id')==identity,'Exact inspected owner ID required')
            before=selected(rows[0],spec,emergency=True)
            runtime_violation=False
            try:selected(rows[0],spec)
            except BaseException:runtime_violation=True
            if before['running']:
                phase='stop'
                call(['docker','stop','-t','10',identity])
            phase='inspectAfter'
            rows=exact_json(call(['docker','inspect',identity]));require(isinstance(rows,list) and len(rows)==1 and rows[0].get('Id')==identity,'Exact stopped owner ID required')
            after=selected(rows[0],spec,False,emergency=True);same_retained(before,after)
            stopped.append({'before':before,'after':after,'stoppedAndRetained':True,
                'actualExitCode':rows[0]['State'].get('ExitCode'),'runtimeViolationObservedBeforeStop':runtime_violation})
        except BaseException as failure:
            errors.append({'ownerLabel':label,'phase':phase,'errorType':type(failure).__name__})
    return {'stoppedAndRetained':stopped,'observedAbsentOwners':absent,'errors':errors,
        'allObservedExactCliOwnersStopped':not errors,'nonvacuousStoppedOwnerCount':len(stopped),
        'noForeignStops':True,'noRemovalOrRestore':True}
