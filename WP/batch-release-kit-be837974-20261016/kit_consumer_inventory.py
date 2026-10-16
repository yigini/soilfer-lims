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
EXEC_PROPERTIES=('ExecCondition','ExecStartPre','ExecStart','ExecStartPost','ExecReload','ExecStop','ExecStopPost')
BEHAVIOR_PROPERTIES=EXEC_PROPERTIES+('Id','LoadState','FragmentPath','SourcePath','DropInPaths','Transient',
    'OnFailure','OnSuccess','Triggers','TriggeredBy','WatchdogUSec','Restart','FailureAction','SuccessAction',
    'StartLimitAction','StopWhenUnneeded','RefuseManualStart','RefuseManualStop')


def loaded_catalogue(raw):
    require(isinstance(raw,bytes) and len(raw)<=2*1024**2,'Bounded complete loaded-unit catalogue required')
    names=set()
    for line in raw.decode('utf-8','strict').splitlines():
        fields=line.split(None,4)
        require(len(fields)>=4 and re.fullmatch(UNIT_PATTERN,fields[0]) and fields[1]=='loaded',
            'Malformed, missing or unloaded unit observation')
        require(fields[0] not in names,'Duplicate loaded unit')
        names.add(fields[0])
    require(names and len(names)<=MAX_UNITS,'Empty or excessive loaded-unit catalogue')
    return names


def exec_configuration(raw):
    """Retain commands exactly; exclude only systemd's enumerated run results.

    Unknown show formats refuse. Command text, paths, ordering and all flags
    remain in the configuration pin; timestamps/PIDs/exit observations remain
    in the separately retained original show response.
    """
    if not raw:return []
    pattern=re.compile(r'(\{ path=.+? ; argv\[\]=.+? ; ignore_errors=(?:yes|no))'
        r' ; start_time=\[[^\]\r\n]*\] ; stop_time=\[[^\]\r\n]*\]'
        r' ; pid=[0-9]+ ; code=[A-Za-z0-9_() -]+ ; status=[A-Za-z0-9_()/ +.-]+ \}')
    result=[];position=0
    for match in pattern.finditer(raw):
        require(raw[position:match.start()] in ('',' '),'Unknown systemd command serialization')
        prefix=match.group(1)
        require(prefix.count('{')==1 and '}' not in prefix and prefix.count(' ; argv[]=')==1 and
            prefix.count(' ; ignore_errors=')==1 and not any(token in prefix for token in
                (' ; start_time=',' ; stop_time=',' ; pid=',' ; code=',' ; status=')),
            'Ambiguous executable text cannot be normalized as runtime metadata')
        result.append(prefix+' }');position=match.end()
    require(result and position==len(raw),'Incomplete systemd executable configuration')
    return result


def unit_behavior(raw,unit):
    require(isinstance(raw,bytes) and len(raw)<=1024**2,'Bounded full unit behavior required')
    value={}
    for line in raw.decode('utf-8','strict').splitlines():
        key,separator,content=line.partition('=')
        require(separator and key in BEHAVIOR_PROPERTIES and key not in value,'Unknown or duplicate unit behavior property')
        value[key]=content
    require(set(value)==set(BEHAVIOR_PROPERTIES) and value['Id']==unit and value['LoadState']=='loaded',
        'Complete loaded unit behavior required')
    require(value['Transient'] in ('yes','no'),'Exact transient state required')
    return {key:exec_configuration(content) if key in EXEC_PROPERTIES else content for key,content in value.items()}


def passive_scope(behavior):
    """Only scopes with no executable, trigger or action get a stable class.

    Their actual names/PIDs are still retained. Every process command must be
    independently in the exact kit's reviewed allowed classes at the gate.
    Any executable/action/trigger in a scope refuses this classification.
    """
    require(behavior['Id'].endswith('.scope') and not any(behavior[n] for n in EXEC_PROPERTIES),
        'Scope executable cannot be omitted')
    for name in ('FragmentPath','SourcePath','DropInPaths','OnFailure','OnSuccess','Triggers','TriggeredBy'):
        require(behavior[name]=='','Scope has a definition, trigger or action; review explicitly')
    require(behavior['WatchdogUSec']=='0' and behavior['Restart']=='no' and
        all(behavior[n]=='none' for n in ('FailureAction','SuccessAction','StartLimitAction')) and
        behavior['StopWhenUnneeded']=='no','Scope can act on a lifecycle event')
    return {k:v for k,v in behavior.items() if k!='Id'}


def own_controller(behavior):
    """Validate the sole reviewed controller added after capture, never a wildcard."""
    from retained_contract import ROOT,ROOT_NAME
    expected='lims-'+ROOT_NAME.lower()+'.service'
    require(behavior['Id']==expected and behavior['Transient']=='yes' and behavior['DropInPaths']=='',
        'Unexpected release controller definition')
    require(behavior['FragmentPath'] in ('','/run/systemd/transient/'+expected) and behavior['SourcePath']=='' and
        behavior['StopWhenUnneeded']=='no','Unreviewed controller source or automatic stop')
    for name in EXEC_PROPERTIES:
        command=('/usr/bin/python3 -B '+str(ROOT/'tooling/run_release.py')+' --root '+str(ROOT)) if name=='ExecStart' else (
            '/usr/bin/python3 -B '+str(ROOT/'tooling/stop_post.py') if name=='ExecStopPost' else None)
        expected_exec=[] if command is None else ['{ path=/usr/bin/python3 ; argv[]='+command+' ; ignore_errors=no }']
        require(behavior[name]==expected_exec,'Release controller executable/hook differs from compiled source')
    require(all(behavior[n]=='' for n in ('OnFailure','OnSuccess','Triggers','TriggeredBy')) and
        behavior['WatchdogUSec']=='0' and behavior['Restart']=='no' and
        all(behavior[n]=='none' for n in ('FailureAction','SuccessAction','StartLimitAction')),
        'Release controller has an unreviewed lifecycle action')
    return True

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

def collect(reader,runner,clock=time.monotonic,cron_reader=cron_projection,namespace='consumer'):
    require(re.fullmatch('[a-z][a-z0-9-]{0,35}',namespace),'Exclusive consumer inventory namespace required')
    began=clock();deadline=began+120;raw_bytes=0
    def bounded(argv,label):
        nonlocal raw_bytes
        require(clock()<deadline,'Consumer inventory deadline reached')
        raw,err,_=runner.run(argv,namespace+'-'+label,15)
        raw_bytes+=len(raw)+len(err)
        require(not err and raw_bytes<=MAX_CONFIG_BYTES and clock()<deadline,'Consumer inventory incomplete or excessive')
        return raw
    def progress():require(clock()<deadline,'Consumer filesystem inventory deadline reached')
    file_args=['systemctl','list-unit-files','--all','--no-pager','--no-legend','--plain']
    loaded_args=['systemctl','list-units','--all','--no-pager','--no-legend','--plain']
    timer_args=['systemctl','list-timers','--all','--no-pager','--no-legend','--plain']
    from retained_contract import ROOT_NAME
    own_unit='lims-'+ROOT_NAME.lower()+'.service'
    def observation(number):
        prefix='pass-'+str(number)+'-'
        catalogue=unit_catalogue(bounded(file_args,prefix+'unit-catalogue'))
        loaded=loaded_catalogue(bounded(loaded_args,prefix+'loaded-catalogue'))
        require(len(set(catalogue)|loaded)<=MAX_UNITS,'Combined persistent/loaded unit bound reached')
        unit_rows={};scope_classes=set();scope_originals=[];own_seen=False
        for ordinal,unit in enumerate(sorted(set(catalogue)|loaded)):
            label=prefix+'unit-'+str(ordinal+1).zfill(4)
            behavior=None
            if unit in loaded:
                behavior=unit_behavior(bounded(['systemctl','show',unit,
                    '--property='+','.join(BEHAVIOR_PROPERTIES)],label+'-behavior'),unit)
                if unit==own_unit:
                    own_controller(behavior);own_seen=True;continue
                if unit.endswith('.scope') and unit not in catalogue:
                    scope_classes.add(sha(canonical(passive_scope(behavior))));scope_originals.append(unit);continue
            raw=bounded(['systemctl','cat','--no-pager',unit],label+'-definition')
            require(raw,'Empty persistent/transient definition is not absence evidence')
            unit_rows[unit]={'catalogueState':catalogue.get(unit),'loadedBehavior':behavior,
                'definitionSha256':sha(raw),'definitionBytes':len(raw)}
        timers=bounded(timer_args,prefix+'active-timers')
        timer_names=active_timer_names(timers,set(catalogue)|loaded)
        processes=bounded(['ps','-eo','pid,ppid,comm,args','--no-headers'],prefix+'processes')
        commands=process_commands(processes,os.getpid())
        containers=docker_projection(reader.inventory())
        def retain_cron(path,raw):
            nonlocal raw_bytes
            raw_bytes+=len(raw);require(raw_bytes<=MAX_CONFIG_BYTES,'Complete consumer originals exceed bound')
            # Both complete originals are independent, retained before predicates.
            destination=runner.root/(namespace+'-'+prefix+'cron-'+sha(path.encode())[:32]+'.private')
            with destination.open('xb') as stream:stream.write(raw);stream.flush();os.fsync(stream.fileno())
            destination.chmod(0o400)
        cron=cron_reader(retain=retain_cron,progress=progress)
        # Re-enumeration refuses additions/removals during each complete pass.
        require(unit_catalogue(bounded(file_args,prefix+'end-unit-catalogue'))==catalogue and
            loaded_catalogue(bounded(loaded_args,prefix+'end-loaded-catalogue'))==loaded,
            'Unit catalogue changed during consumer collection')
        require(active_timer_names(bounded(timer_args,prefix+'end-active-timers'),set(catalogue)|loaded)==timer_names,
            'Active timer names changed during consumer collection')
        return {'configuration':{'units':unit_rows,'passiveScopeClasses':sorted(scope_classes),
            'cron':cron,'containers':containers},'timerNames':timer_names,'commands':commands,
            'timerRawSha256':sha(timers),'processRawSha256':sha(processes),
            'passiveScopeOriginalNames':sorted(scope_originals),'compiledControllerObserved':own_seen}
    first=observation(1);second=observation(2)
    require(first['configuration']==second['configuration'] and first['timerNames']==second['timerNames'],
        'Consumer configuration changed between full independent collection passes')
    require(clock()<deadline,'Consumer inventory deadline reached')
    projection=second['configuration']
    return {'configuration':projection,'configurationSha256':sha(canonical(projection)),
            'elapsedSeconds':clock()-began,'completeCollection':True,'readOnly':True,
            'loadedAndTransientUnitsIncluded':True,'independentCompletePasses':2,
            'configurationEqualAcrossBothPasses':True,'cataloguesReenumeratedAfterEachPass':True,
            'collectionIsNotAnAtomicHostSnapshot':True,
            'activeTimersSha256':second['timerRawSha256'],'processListSha256':second['processRawSha256'],
            'passObservations':[{k:v for k,v in record.items() if k!='configuration'} for record in (first,second)],
            'activeTimerNames':second['timerNames'],
            'observedProcessCommandSha256':sorted(set(first['commands'])|set(second['commands'])),
            'noConsumerVerdict':None,'privateUnitProcessCronAndEnvironmentBytesNotPublished':True}

def require_reviewed_inventory(current,review):
    require(current.get('completeCollection') is True and current.get('readOnly') is True,'Incomplete unhealthy-consumer inventory')
    require(current.get('loadedAndTransientUnitsIncluded') is True and current.get('independentCompletePasses')==2 and
        current.get('configurationEqualAcrossBothPasses') is True and current.get('cataloguesReenumeratedAfterEachPass') is True,
        'Persistent-only or single-pass consumer collection cannot authorize a gate')
    require(current.get('configurationSha256')==sha(canonical(current.get('configuration'))),'Consumer projection hash differs')
    require(review.get('exactKitReviewPassed') is True and review.get('reviewedConsumerConfigurationSha256')==current['configurationSha256'],'Current consumer configuration has not had exact kit review')
    require(review.get('noHostConsumerActsOnUnhealthyWindow') is True,'No reviewed unhealthy-consumer verdict')
    approved=review.get('reviewedAllowedProcessCommandSha256')
    require(isinstance(approved,list) and all(isinstance(x,str) and re.fullmatch('[a-f0-9]{64}',x) for x in approved),'Complete reviewed process command classes required')
    require(set(current.get('observedProcessCommandSha256',[]))<=set(approved),'Unknown process command; no unreviewed gate')
    require(set(current.get('activeTimerNames',[]))<=set(review.get('reviewedAllowedActiveTimerNames',[])),'Unreviewed active timer; no gate')
    return {'reviewedConfigurationSha256':current['configurationSha256'],'noHostConsumerActsOnUnhealthyWindow':True}
