"""Capture-container memory reader with its own exact owner identity.

The numeric PID/cgroup reader, raw-byte retention and memory predicates are
the same as release. A release owner can never satisfy this identity check.
Import performs no reads or writes; no capture container has been launched.
"""
from kit_contract import require
from kit_capture_owned import CAPTURE_COMMANDS,capture_spec,capture_selected
from retained_memory import (bounded_read,inspect,cgroup_path,canonical_cgroup,RAW_NAMES,READ_LIMITS,
    pairs,STAT_REQUIRED,EVENT_REQUIRED,scalar,MemoryHistory)
import os

def capture_container_identity(obj,container_id,owner):
    matches=[capture_spec(label) for label in CAPTURE_COMMANDS if capture_spec(label)['owner']==owner]
    require(len(matches)==1,'Exact compiled fresh-capture memory owner required')
    selected=capture_selected(obj,matches[0],True)
    require(selected['id']==container_id,'Capture memory full container ID differs')
    state=obj['State'];host=obj['HostConfig']
    require(type(state.get('Pid')) is int and state['Pid']>0 and state['StartedAt'],
        'Live exact fresh-capture host PID required')
    return {'id':container_id,'pid':state['Pid'],'startedAt':state['StartedAt'],'owner':owner,
        'oomKilled':False,'restarts':0,'memory':host['Memory'],'memoryAndSwap':host['MemorySwap']}

def capture_host_sample(container_id,owner,reader=bounded_read,inspector=inspect,resolver=canonical_cgroup):
    identity=capture_container_identity(inspector(container_id),container_id,owner);pid=identity['pid']
    member=reader('/proc/'+str(pid)+'/cgroup',4096)
    mount=reader('/proc/'+str(os.getpid())+'/mountinfo',256*1024)
    path=cgroup_path(container_id,member,mount);directory=resolver(path)
    raw={n:reader(path/n,READ_LIMITS[n]) for n in RAW_NAMES}
    require(reader('/proc/'+str(pid)+'/cgroup',4096)==member and resolver(path)==directory and
        capture_container_identity(inspector(container_id),container_id,owner)==identity,
        'Fresh-capture container/PID/cgroup changed during read; STOP without retry')
    return {'identity':identity,'cgroup':directory,'memoryStat':pairs(raw['memory.stat'],STAT_REQUIRED),
        'memoryEvents':pairs(raw['memory.events'],EVENT_REQUIRED),
        'memoryPeakBytesObservation':scalar(raw['memory.peak']),'memoryMaxBytes':scalar(raw['memory.max']),
        'memorySwapMaxBytes':scalar(raw['memory.swap.max'])}

def capture_memory_history(root,label,container_id,owner):
    from kit_capture_owned import CAPTURE_ROOT,validate_capture_spec
    import pathlib
    spec=validate_capture_spec(capture_spec(label))
    require(pathlib.Path(root).as_posix()==CAPTURE_ROOT.as_posix() and owner==spec['owner'],
        'Capture memory history requires its exact root and owner')
    return MemoryHistory(root,label,container_id,owner,sampler=capture_host_sample)
