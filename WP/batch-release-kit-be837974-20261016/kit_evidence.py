"""Shared physical admissions for the runtime's bounded evidence writers.

This is an inert, single-process ledger, not a filesystem measurement. Every
admission precedes creation; unused command-stream reservations settle only
after all pipe descriptors close and the original files are sealed. Failed
admissions never authorize deletion, replacement, truncation, or a retry.

The four producer groups share3200MiB. Independent emergency streams use
800MiB, fixed hook records64MiB and Apache transitions32MiB: all existing
4GiB is assigned. Admissions remain a source allowance, NOT a filesystem
measurement or whole-graph copy/producer closure. Emergency actions precede
retention and never depend on a new quota check.
"""
import pathlib
from kit_contract import require

BLOCK=4096
SHARES={'commands':1536*1024**2,'memory':512*1024**2,
    'controller':512*1024**2,'journal':640*1024**2}
MAIN_POOL_BYTES=3200*1024**2
HOOK_RECORD_LIMIT=16*1024**2
HOOK_RESULT_NAMES=frozenset(('stop-post-controller-1.json','stop-post-controller-2.json','stop-post-result.json'))
HOOK_NAMESPACE_BYTES=64*1024**2
APACHE_TRANSITION_LIMIT=6
APACHE_NAMESPACE_BYTES=32*1024**2
EMERGENCY_CALL_LIMIT=96
EMERGENCY_STREAM_LIMITS={'stdout':4*1024**2,'stderr':64*1024}
EMERGENCY_METADATA_LIMIT=8192
EMERGENCY_NAMESPACE_BYTES=400*1024**2
INDEPENDENT_EMERGENCY_BYTES=2*EMERGENCY_NAMESPACE_BYTES
_runtime=None

def allocation(byte_count,entries=1):
    require(type(byte_count) is int and byte_count>=0 and type(entries) is int and entries>0,
        'Exact evidence bytes and directory entries required')
    return ((byte_count+BLOCK-1)//BLOCK)*BLOCK+entries*BLOCK


def fixed_envelope_bounds():
    hook=len(HOOK_RESULT_NAMES)*allocation(HOOK_RECORD_LIMIT,2)
    # At most six static transition call sites: three normal/recovery sites,
    # two controller emergency sites and one standalone-hook site. Every call
    # creates at most one same-directory pending file. Body<=1MiB; complete
    # xattr names+values<=1MiB/256 names. Reserve a block per attribute plus
    # additional inode/entry blocks. These are declared source allowances;
    # host filesystem allocation facts still need the reviewed capture.
    apache=APACHE_TRANSITION_LIMIT*(allocation(1024**2)+allocation(1024**2,256)+4*BLOCK)
    require(hook<=HOOK_NAMESPACE_BYTES and apache<=APACHE_NAMESPACE_BYTES,
        'Fixed independent record/Apache allowances do not cover source maxima')
    require(sum(SHARES.values())+INDEPENDENT_EMERGENCY_BYTES+HOOK_NAMESPACE_BYTES+APACHE_NAMESPACE_BYTES==4*1024**3,
        'Declared evidence allowances must partition the unchanged4GiB')
    return {'hookRecordAllocationBytes':hook,'apacheDeclaredAllocationBytes':apache,
        'physicalFilesystemClosureClaimed':False}


class EvidenceLedger:
    def __init__(self,root,shares=None):
        fixed_envelope_bounds()
        self.root=pathlib.Path(root)
        require(self.root.is_absolute() and self.root.is_dir() and not self.root.is_symlink(),
            'Real absolute evidence root required')
        self.shares=dict(SHARES if shares is None else shares)
        require(set(self.shares)==set(SHARES) and all(type(n) is int and n>0 for n in self.shares.values()) and
            sum(self.shares.values())<=MAIN_POOL_BYTES,'Shared runtime evidence shares exceed their declared3200MiB subset')
        for part in (self.root,*self.root.parents):require(not part.is_symlink(),'Evidence root ancestor alias refused')
        self.used=dict.fromkeys(self.shares,0);self.paths=set();self.directories=set();self.open={};self.number=0
        self.active_window=None;self.window_number=0

    def reserve(self,paths,maximum_bytes,category):
        require(category in self.shares and isinstance(paths,tuple) and len(paths) in (1,2),
            'Declared evidence category and one/two entry paths required')
        names=tuple(pathlib.Path(p) for p in paths)
        relative=[];parents=set()
        for p in names:
            require(p.is_absolute() and self.root in p.parents,'Evidence file outside exact root')
            parts=p.relative_to(self.root).parts
            require(0<len(parts)<=8 and all(x not in ('','.','..') for x in parts),'Bounded canonical evidence path required')
            for parent in (p.parent,*p.parent.parents):
                if parent==self.root:break
                require(not parent.is_symlink() and parent.is_dir(),'Evidence parent alias/missing directory refused')
                parents.add(parent.relative_to(self.root).as_posix())
            relative.append(p.relative_to(self.root).as_posix())
        require(len(set(names))==len(names) and all(n not in self.paths for n in relative) and
            all(not p.exists() and not p.is_symlink() for p in names),'Evidence path is aliased or consumed')
        new_directories=parents-self.directories
        # Two directory blocks plus its parent entry, once per nested directory;
        # every retained file/hardlink name receives another full entry block.
        directory_charge=len(new_directories)*3*BLOCK
        amount=allocation(maximum_bytes,len(names))+directory_charge
        window=self.active_window
        if window is None:
            require(self.used[category]+amount<=self.shares[category] and
                sum(self.used.values())+amount<=sum(self.shares.values()),
                'Shared '+category+' evidence share exhausted before allocation')
            self.used[category]+=amount
        else:
            require(window.used[category]+amount<=window.maximum[category],
                'Allocation exceeds the complete pre-start '+category+' envelope')
            window.used[category]+=amount
        self.paths.update(relative);self.directories.update(new_directories);self.number+=1
        ticket=self.number;self.open[ticket]=(category,amount,maximum_bytes,len(names),directory_charge,window)
        return ticket

    def settle(self,ticket,actual_bytes):
        require(type(ticket) is int and ticket in self.open,'Evidence reservation already settled or absent')
        category,amount,maximum_bytes,entries,directory_charge,window=self.open[ticket]
        require(window is None or not window.closed,'Closed evidence window cannot resume')
        require(type(actual_bytes) is int and 0<=actual_bytes<=maximum_bytes,
            'Actual evidence exceeds its pre-allocation reservation')
        refund=amount-allocation(actual_bytes,entries)-directory_charge
        if window is None:self.used[category]-=refund
        else:window.used[category]-=refund
        del self.open[ticket]

    def begin_window(self,label,maximum):
        require(self.active_window is None,'Concurrent/nested evidence windows refused')
        require(isinstance(label,str) and 0<len(label)<=80 and
            all(x in 'abcdefghijklmnopqrstuvwxyz0123456789-' for x in label),
            'Exact bounded evidence window label required')
        require(isinstance(maximum,dict) and set(maximum)==set(self.shares) and
            all(type(n) is int and n>0 for n in maximum.values()),'Complete evidence envelope required')
        # A lifecycle may borrow unused category shares, but the single existing
        # shared pool is held BEFORE create. Nothing outside this window can spend it.
        require(sum(self.used.values())+sum(maximum.values())<=sum(self.shares.values()),
            'Complete CLI evidence envelope does not fit before container creation')
        self.window_number+=1
        window=EvidenceWindow(self,label,maximum,self.window_number)
        for category,amount in maximum.items():self.used[category]+=amount
        self.active_window=window;return window

    def summary(self):
        return {'sharesBytes':dict(self.shares),'chargedOrReservedBytes':dict(self.used),
            'openReservations':len(self.open),'activePreStartWindow':None if self.active_window is None else self.active_window.receipt(),
            'directoryEntriesCounted':len(self.paths),
            'nestedDirectoriesCounted':len(self.directories),
            'coveredProducerMaximumBytes':sum(self.shares.values()),
            'independentEmergencyEnvelopesBytes':INDEPENDENT_EMERGENCY_BYTES,
            'independentHookRecordsBytes':HOOK_NAMESPACE_BYTES,'apacheTransitionAllowanceBytes':APACHE_NAMESPACE_BYTES,
            'unassignedWithinExisting4GiBBytes':4*1024**3-sum(self.shares.values())-INDEPENDENT_EMERGENCY_BYTES-HOOK_NAMESPACE_BYTES-APACHE_NAMESPACE_BYTES,
            'fullGlobalEvidenceClosure':False,'allOriginalsPrivate':True}


class EvidenceWindow:
    def __init__(self,ledger,label,maximum,number):
        self.ledger=ledger;self.label=label;self.maximum=dict(maximum);self.number=number
        self.used=dict.fromkeys(maximum,0);self.closed=False
    def receipt(self):
        return {'label':self.label,'number':self.number,'maximumBytes':dict(self.maximum),
            'chargedOrReservedBytes':dict(self.used),'heldBeforeContainerCreate':True,
            'sharedPoolBytes':sum(self.ledger.shares.values()),'filesystemPreallocationClaimed':False}
    def close(self):
        require(not self.closed and self.ledger.active_window is self,'Evidence window consumed or foreign')
        # Open tickets from a failed pre-write admission stay fully charged. No
        # background producer can resume one after this synchronous scope closes.
        for category,maximum in self.maximum.items():
            self.ledger.used[category]-=maximum-self.used[category]
        self.closed=True;self.ledger.active_window=None


def bind_runtime(root):
    global _runtime
    require(_runtime is None,'Shared runtime evidence ledger cannot resume or rebind')
    _runtime=EvidenceLedger(root);return _runtime

def admit_evidence(path,byte_count,pending=False,reservation=False):
    """Inert outside the explicitly bound runtime; local reader fixtures stay local.

    The standalone emergency hook intentionally has no bound runtime ledger:
    quota/retention failure must never suppress an exact owned stop. Its fixed
    namespace envelopes are independent; full filesystem/copy closure is pending.
    """
    if _runtime is None:return None
    p=pathlib.Path(path)
    name=p.name
    category=('controller' if name.startswith('controller-memory-') else
        'memory' if '-memory-' in name else
        'commands' if name.endswith(('.stdout','.stderr')) else 'journal')
    paths=(p,p.with_name(p.name+'.pending')) if pending else (p,)
    ticket=_runtime.reserve(paths,byte_count,category)
    if not reservation:_runtime.settle(ticket,byte_count)
    return _runtime,ticket
