"""Shared physical admissions for the runtime's bounded evidence writers.

This is an inert, single-process ledger, not a filesystem measurement. Every
admission precedes creation; unused command-stream reservations settle only
after all pipe descriptors close and the original files are sealed. Failed
admissions never authorize deletion, replacement, truncation, or a retry.

These four producer groups share 3 GiB. The remaining 1 GiB is deliberately
unassigned pending closure of fetch/HTTP/control-file/emergency/hook writers.
Consequently this module does NOT claim complete global 4 GiB closure.
"""
import pathlib
from kit_contract import require

BLOCK=4096
SHARES={'commands':1536*1024**2,'memory':512*1024**2,
    'controller':512*1024**2,'journal':512*1024**2}
_runtime=None

def allocation(byte_count,entries=1):
    require(type(byte_count) is int and byte_count>=0 and type(entries) is int and entries>0,
        'Exact evidence bytes and directory entries required')
    return ((byte_count+BLOCK-1)//BLOCK)*BLOCK+entries*BLOCK

class EvidenceLedger:
    def __init__(self,root,shares=None):
        self.root=pathlib.Path(root)
        require(self.root.is_absolute() and self.root.is_dir() and not self.root.is_symlink(),
            'Real absolute evidence root required')
        self.shares=dict(SHARES if shares is None else shares)
        require(set(self.shares)==set(SHARES) and all(type(n) is int and n>0 for n in self.shares.values()) and
            sum(self.shares.values())<=3*1024**3,'Shared runtime evidence shares exceed their reviewed3GiB subset')
        for part in (self.root,*self.root.parents):require(not part.is_symlink(),'Evidence root ancestor alias refused')
        self.used=dict.fromkeys(self.shares,0);self.paths=set();self.directories=set();self.open={};self.number=0

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
        require(self.used[category]+amount<=self.shares[category],
            'Shared '+category+' evidence share exhausted before allocation')
        self.used[category]+=amount;self.paths.update(relative);self.directories.update(new_directories);self.number+=1
        ticket=self.number;self.open[ticket]=(category,amount,maximum_bytes,len(names),directory_charge)
        return ticket

    def settle(self,ticket,actual_bytes):
        require(type(ticket) is int and ticket in self.open,'Evidence reservation already settled or absent')
        category,amount,maximum_bytes,entries,directory_charge=self.open[ticket]
        require(type(actual_bytes) is int and 0<=actual_bytes<=maximum_bytes,
            'Actual evidence exceeds its pre-allocation reservation')
        self.used[category]-=amount-allocation(actual_bytes,entries)-directory_charge;del self.open[ticket]

    def summary(self):
        return {'sharesBytes':dict(self.shares),'chargedOrReservedBytes':dict(self.used),
            'openReservations':len(self.open),'directoryEntriesCounted':len(self.paths),
            'nestedDirectoriesCounted':len(self.directories),
            'coveredProducerMaximumBytes':sum(self.shares.values()),
            'unassignedWithinExisting4GiBBytes':4*1024**3-sum(self.shares.values()),
            'fullGlobalEvidenceClosure':False,'allOriginalsPrivate':True}

def bind_runtime(root):
    global _runtime
    require(_runtime is None,'Shared runtime evidence ledger cannot resume or rebind')
    _runtime=EvidenceLedger(root);return _runtime

def admit_evidence(path,byte_count,pending=False,reservation=False):
    """Inert outside the explicitly bound runtime; local reader fixtures stay local.

    The standalone emergency hook intentionally has no bound runtime ledger:
    quota/retention failure must never suppress an exact owned stop. Its full
    separate envelope remains part of the missing global closure.
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
