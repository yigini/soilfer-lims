"""Exclusive, durable release records. Importing performs no filesystem I/O.

All records remain private on the host until individually reviewed for public
retention. A journal cannot be resumed or used for a second execution.
"""
import datetime
import os
import pathlib
import re
import stat
from kit_contract import canonical,require,sha
from kit_evidence import admit_evidence,EMERGENCY_CALL_LIMIT,EMERGENCY_METADATA_LIMIT,HOOK_RESULT_NAMES,HOOK_RECORD_LIMIT

def utc():return datetime.datetime.now(datetime.timezone.utc).isoformat()

def real_directory(value):
    path=pathlib.Path(value)
    require(path.is_absolute() and path.is_dir(),'Existing absolute journal directory required')
    for part in (path,*path.parents):
        require(not part.is_symlink(),'Journal directory alias refused')
    return path

def exclusive_record(directory,name,value,require_directory_sync=True,independent_namespace=None,held_admission=None):
    directory=real_directory(directory)
    require(isinstance(name,str) and re.fullmatch('[a-z0-9][a-z0-9.-]{0,150}',name),'Exact record basename required')
    raw=canonical(value)+b'\n'
    require(len(raw)<=16*1024**2,'Record exceeds bounded receipt size')
    path=directory/name;pending=directory/(name+'.pending')
    if path.exists() or path.is_symlink():raise FileExistsError('Published record already consumed')
    # One data allocation and BOTH permanently retained directory entries.
    if held_admission is not None:
        ledger,ticket=held_admission
        require(independent_namespace is None and ticket in ledger.open and
            ledger.open[ticket][2:4]==(8192,2) and len(raw)<=8192 and
            ledger.root in directory.parents and
            ledger.ticket_paths.get(ticket)==tuple(p.relative_to(ledger.root).as_posix() for p in (path,pending)),
            'Exact unconsumed before-mkdir record admission required')
    elif independent_namespace is None:admit_evidence(path,len(raw),pending=True)
    elif independent_namespace=='hook-results':
        require(name in HOOK_RESULT_NAMES and len(raw)<=HOOK_RECORD_LIMIT,
            'Independent hook record outside its fixed three-name envelope')
    else:
        require(independent_namespace in ('controller','stop-post'),'Unknown independent record namespace')
        match=re.fullmatch('emergency-'+independent_namespace+'-([0-9]{6})[.]json',name)
        require(match is not None and 1<=int(match.group(1))<=EMERGENCY_CALL_LIMIT and
            len(raw)<=EMERGENCY_METADATA_LIMIT,'Independent emergency record outside its fixed envelope')
    descriptor=os.open(str(pending),os.O_WRONLY|os.O_CREAT|os.O_EXCL|getattr(os,'O_NOFOLLOW',0),0o600)
    try:
        with os.fdopen(descriptor,'wb',closefd=False) as stream:
            stream.write(raw);stream.flush();os.fsync(stream.fileno())
        os.chmod(pending,0o400)
        require(stat.S_ISREG(pending.stat().st_mode),'Journal record is not regular')
    finally:os.close(descriptor)
    # Atomic visibility without replacing or deleting anything. The pending
    # hardlink is retained as evidence and is counted once by physical du.
    os.link(pending,path)
    directory_synced=False
    if os.name=='posix':
        descriptor=os.open(str(directory),os.O_RDONLY|getattr(os,'O_DIRECTORY',0))
        try:os.fsync(descriptor);directory_synced=True
        finally:os.close(descriptor)
    require(directory_synced or not require_directory_sync,'Directory fsync unavailable; no operational call may follow')
    if held_admission is not None:ledger.settle(ticket,len(raw))
    return {'file':name,'sha256':sha(raw),'bytes':len(raw),'directorySynced':directory_synced}

class Journal:
    def __init__(self,directory,owner,source_manifest_sha,require_directory_sync=True):
        self.directory=real_directory(directory)
        require(isinstance(owner,str) and owner==str(self.directory),'Exact journal owner required')
        require(re.fullmatch('[a-f0-9]{64}',source_manifest_sha or ''),'Source manifest hash required')
        self.sync=require_directory_sync;self.sequence=0;self.previous=None;self.terminal=False
        self.owner=exclusive_record(self.directory,'execution-journal-owner.json',{
            'owner':owner,'sourceManifestSha256':source_manifest_sha,'utc':utc(),
            'neverResume':True,'neverRetry':True,'rawRecordsPrivateUntilReviewed':True},self.sync)

    def append(self,phase,value):
        require(not self.terminal,'Terminal journal cannot continue')
        require(isinstance(phase,str) and re.fullmatch('[A-Za-z][A-Za-z0-9]{0,80}',phase),'Invalid phase name')
        record={'sequence':self.sequence+1,'phase':phase,'utc':utc(),'previous':self.previous,'value':value}
        name='phase-'+str(self.sequence+1).zfill(6)+'-'+phase.lower()+'.json'
        reference=exclusive_record(self.directory,name,record,self.sync)
        self.sequence+=1;self.previous=reference
        return reference

    def phase_intent(self,phase,receipt):
        # Persist the latest safety flags before dispatch, not raw environment,
        # keys, SQL rows, or a fabricated success/COMMIT result.
        return self.append(phase,{'kind':'BEFORE_CALL_INTENT',
            'anyInstallerAttempted':receipt['anyInstallerAttempted'],
            'anyApplyAttempted':receipt['anyApplyAttempted'],
            'anyEntrypointAttempted':receipt['anyEntrypointAttempted'],
            'ingressReopened':receipt['ingressReopened']})

    def seal(self,receipt):
        require(not self.terminal,'Terminal receipt already consumed')
        reference=exclusive_record(self.directory,'production-receipt.json',{
            **receipt,'journalTail':self.previous,'journalRecords':self.sequence,
            'sealedUtc':utc(),'privateUntilReviewed':True},self.sync)
        self.terminal=True
        return reference
