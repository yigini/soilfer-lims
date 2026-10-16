"""Bounded read-only host inventory for the temporary unhealthy period.

Collection is not a no-monitor verdict. A complete exact kit review must bind
the configuration hashes and affirm no consumer acts on unhealthy status.
Unknown/missing/changed consumers refuse the later fresh gate. There is no CLI
entry point, automatic disabling, service restart, or container mutation.
"""
import os
import pathlib
import re
import time
from kit_contract import canonical,require,sha

CRON_ROOTS=('/etc/crontab','/etc/anacrontab','/etc/cron.d','/etc/cron.hourly',
            '/etc/cron.daily','/etc/cron.weekly','/etc/cron.monthly','/var/spool/cron')
MAX_UNITS=1024
MAX_CRON_FILES=4096
MAX_CONFIG_BYTES=16*1024**2
UNIT_PATTERN=r'(?:[a-zA-Z0-9_.@:-]|\\x[0-9a-fA-F]{2})+\.(?:service|timer|path|socket|target|mount|automount|slice|scope|swap)'

def unit_catalogue(raw):
    require(isinstance(raw,bytes) and len(raw)<=2*1024**2,'Bounded complete unit catalogue required')
    result={}
    for line in raw.decode('utf-8','strict').splitlines():
        fields=line.split()
        require(2<=len(fields)<=3 and re.fullmatch(UNIT_PATTERN,fields[0]),'Malformed or truncated unit catalogue')
        require(fields[0] not in result,'Duplicate unit name')
        result[fields[0]]=fields[1:]
    require(result and len(result)<=MAX_UNITS,'Missing or excessive unit catalogue')
    return result

def cron_projection(roots=CRON_ROOTS,retain=None,progress=lambda:None):
    """Content remains private; metadata is bound before any public verdict."""
    result={};total=0;nodes=0
    for name in roots:
        root=pathlib.Path(name)
        require(root.is_absolute() and not root.is_symlink(),'Cron root alias refused')
        if not root.exists():result[name]={'exists':False};continue
        require(root.is_file() or root.is_dir(),'Unknown cron node type')
        files=[root] if root.is_file() else root.rglob('*')
        rows={}
        for path in files:
            nodes+=1;progress();require(nodes<=MAX_CRON_FILES,'Cron node inventory bound reached')
            require(not path.is_symlink(),'Cron entry alias refused; inspect separately')
            if path.is_dir():continue
            require(path.is_file(),'Unknown cron entry type')
            before=path.stat();require(before.st_size<=1024**2,'Cron file exceeds bound')
            raw=path.read_bytes()
            if retain is not None:retain(str(path),raw)
            after=path.stat()
            require((before.st_dev,before.st_ino,before.st_size,before.st_mtime_ns)==(after.st_dev,after.st_ino,after.st_size,after.st_mtime_ns),'Cron changed during inventory')
            total+=len(raw);require(total<=MAX_CONFIG_BYTES and sum(len(r.get('files',{})) for r in result.values())+len(rows)<MAX_CRON_FILES,'Cron inventory bound reached')
            rows[str(path)]={'sha256':sha(raw),'bytes':len(raw)}
        result[name]={'exists':True,'files':rows}
    return result

def process_commands(raw,self_pid):
    require(isinstance(raw,bytes) and len(raw)<=2*1024**2,'Bounded complete process observation required')
    commands=set();seen=set()
    for line in raw.decode('utf-8','strict').splitlines():
        parts=line.split(None,3)
        require(len(parts)==4 and parts[0].isdigit() and parts[1].isdigit(),'Malformed process observation')
        pid,parent=int(parts[0]),int(parts[1]);require(pid>0 and pid not in seen,'Duplicate/invalid process PID');seen.add(pid)
        require(len(seen)<=8192,'Process inventory bound reached')
        if pid==self_pid:continue
        if parent==self_pid and parts[2]=='ps' and parts[3]=='ps -eo pid,ppid,comm,args --no-headers':continue
        # Preserve the complete ordered command string; PID/time noise does
        # not become an impossible-to-repeat configuration pin.
        commands.add(sha(canonical({'comm':parts[2],'command':parts[3]})))
    require(seen,'Empty process observation is not absence evidence')
    return sorted(commands)

def active_timer_names(raw,catalogue):
    names={token for token in raw.decode('utf-8','strict').split() if token.endswith('.timer')}
    require(all(re.fullmatch(UNIT_PATTERN,n) and n in catalogue for n in names),'Unknown or malformed active timer')
    return sorted(names)

def docker_projection(rows):
    require(isinstance(rows,dict) and rows,'Complete Docker consumer inventory required')
    result={}
    for identity,row in rows.items():
        require(row.get('Id')==identity,'Docker consumer ID differs')
        config=row.get('Config',{});labels=config.get('Labels') or {};host=row.get('HostConfig',{})
        # The reviewer must consider every image/config, including custom
        # monitors. This explicit guard also catches common autoheal labels.
        require(not any('autoheal' in str(k).lower() and str(v).lower() not in ('false','0','no','') for k,v in labels.items()),'Potential Docker autoheal consumer requires separate reviewed handling')
        result[identity]={'id':identity,'name':row.get('Name'),'image':row.get('Image'),
            'restartPolicy':host.get('RestartPolicy'),'labels':labels,
            'configSha256':sha(canonical(config)),
            'healthcheck':config.get('Healthcheck'),'fullEnvironmentPrivateOnly':True}
    return result

def collect(reader,runner,clock=time.monotonic,cron_reader=cron_projection):
    began=clock();deadline=began+120;raw_bytes=0;unit_rows={}
    def bounded(argv,label):
        nonlocal raw_bytes
        require(clock()<deadline,'Consumer inventory deadline reached')
        raw,err,_=runner.run(argv,label,15)
        raw_bytes+=len(raw)+len(err)
        require(not err and raw_bytes<=MAX_CONFIG_BYTES and clock()<deadline,'Consumer inventory incomplete or excessive')
        return raw
    catalogue=unit_catalogue(bounded(['systemctl','list-unit-files','--all','--no-pager','--no-legend','--plain'],'consumer-unit-catalogue'))
    for number,unit in enumerate(sorted(catalogue)):
        raw=bounded(['systemctl','cat','--no-pager',unit],'consumer-unit-'+str(number+1).zfill(4))
        require(raw,'Empty systemd unit definition is not absence evidence')
        unit_rows[unit]={'catalogueState':catalogue[unit],'definitionSha256':sha(raw),'definitionBytes':len(raw)}
    timers=bounded(['systemctl','list-timers','--all','--no-pager','--no-legend','--plain'],'consumer-active-timers')
    processes=bounded(['ps','-eo','pid,ppid,comm,args','--no-headers'],'consumer-processes')
    containers=docker_projection(reader.inventory())
    def progress():require(clock()<deadline,'Consumer filesystem inventory deadline reached')
    def retain_cron(path,raw):
        # Write originals privately before their predicates. Nothing here
        # authorizes fetching or publishing cron command/credential bytes.
        name='consumer-cron-'+sha(path.encode())[:32]+'.private'
        destination=runner.root/name
        with destination.open('xb') as stream:stream.write(raw);stream.flush();os.fsync(stream.fileno())
        destination.chmod(0o400)
    cron=cron_reader(retain=retain_cron,progress=progress)
    require(clock()<deadline,'Consumer inventory deadline reached')
    projection={'units':unit_rows,'cron':cron,'containers':containers}
    return {'configuration':projection,'configurationSha256':sha(canonical(projection)),
            'elapsedSeconds':clock()-began,'completeCollection':True,'readOnly':True,
            'activeTimersSha256':sha(timers),'processListSha256':sha(processes),
            'activeTimerNames':active_timer_names(timers,catalogue),
            'observedProcessCommandSha256':process_commands(processes,os.getpid()),
            'noConsumerVerdict':None,'privateUnitProcessCronAndEnvironmentBytesNotPublished':True}

def require_reviewed_inventory(current,review):
    require(current.get('completeCollection') is True and current.get('readOnly') is True,'Incomplete unhealthy-consumer inventory')
    require(current.get('configurationSha256')==sha(canonical(current.get('configuration'))),'Consumer projection hash differs')
    require(review.get('exactKitReviewPassed') is True and review.get('reviewedConsumerConfigurationSha256')==current['configurationSha256'],'Current consumer configuration has not had exact kit review')
    require(review.get('noHostConsumerActsOnUnhealthyWindow') is True,'No reviewed unhealthy-consumer verdict')
    approved=review.get('reviewedAllowedProcessCommandSha256')
    require(isinstance(approved,list) and all(isinstance(x,str) and re.fullmatch('[a-f0-9]{64}',x) for x in approved),'Complete reviewed process command classes required')
    require(set(current.get('observedProcessCommandSha256',[]))<=set(approved),'Unknown process command; no unreviewed gate')
    require(set(current.get('activeTimerNames',[]))<=set(review.get('reviewedAllowedActiveTimerNames',[])),'Unreviewed active timer; no gate')
    return {'reviewedConfigurationSha256':current['configurationSha256'],'noHostConsumerActsOnUnhealthyWindow':True}
