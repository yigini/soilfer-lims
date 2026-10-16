"""Exact new-root CLI container specification and lifecycle. No import I/O.

The complete production coordinator must bind this module to its frozen source,
private command runner, journal and exact predecessor inventory. There is no
operator entry point here. No image build, automatic deletion or retry exists.
"""
import hashlib
import json
import math
import pathlib
import re
import time
from kit_contract import IMAGE,MEMORY_MAX,canonical,require,sha
from retained_contract import ROOT,LIVE_DATA,exact_json
from kit_journal import exclusive_record

LABEL='io.soilfer.release-owned'
DATABASE='/app/server/prisma/dev.db'
INSTALLERS={'206':'install_sample_containers.js','214':'install_control_charts.js','209':'install_order_revisions.js'}
ALLOWED={
    'stopped-integrity':('/release/stopped_integrity.cjs',None),
    'canonical-policy':('/app/server/scripts/install_lab_policy_schema.js','--dry-run'),
    'chart-impact':('/app/server/scripts/control_chart_prebinding_impact.js',None),
    'order-impact':('/app/server/scripts/order_revision_impact.js',None),
    'first-sync-backup':('/release/live_backup.cjs',None),
    'postflight-backup':('/release/live_backup.cjs',None),
}
for _issue,_script in INSTALLERS.items():
    for _phase,_mode in [('dry','--dry-run'),('apply','--apply'),('repeat','--apply')]:
        ALLOWED[_issue+'-'+_phase]=('/app/server/scripts/'+_script,_mode)

def cli_spec(label,data_mount):
    require(label in ALLOWED,'Unreviewed CLI owner refused')
    require(isinstance(data_mount,dict) and data_mount=={
        'Type':'volume','Name':'lims_lims-data','Source':LIVE_DATA,'Destination':'/app/server/prisma'},
        'Exact existing live data volume required')
    owner=str(ROOT)+':'+label
    name='lims-owned-batch-'+hashlib.sha256(owner.encode()).hexdigest()[:24]
    script,mode=ALLOWED[label]
    child=[script,'--db',DATABASE]+([] if mode is None else [mode])
    writable=label.endswith(('-dry','-apply','-repeat'))
    tmp=str(ROOT/(label+'-retained-temp'))
    database_mount=({'Type':'bind','Source':str(ROOT/(label+'-database')),
                     'Destination':data_mount['Destination'],'RW':True} if label.endswith('-dry') else
                    {'Type':'volume','Name':data_mount['Name'],'Source':data_mount['Source'],
                     'Destination':data_mount['Destination'],'RW':writable})
    mounts=[database_mount,
            {'Type':'bind','Source':str(ROOT/'tooling'),'Destination':'/release','RW':False},
            {'Type':'bind','Source':tmp,'Destination':'/tmp','RW':True}]
    environment={'NODE_OPTIONS':'','ALLOW_PRISMA_DB_PUSH':'false','ALLOW_AUTO_SEED':'false',
        'DISABLE_BACKGROUND_JOBS':'true','DATABASE_PATH':DATABASE,'DATABASE_URL':'file:'+DATABASE,
        'TMPDIR':'/tmp','TMP':'/tmp','TEMP':'/tmp'}
    args=['docker','create','--name',name,'--label',LABEL+'='+owner,'--network','none',
          '--memory',str(MEMORY_MAX),'--memory-swap',str(MEMORY_MAX),'--restart','no',
          '--entrypoint','node','--workdir','/app/server','--no-healthcheck']
    for key,value in sorted(environment.items()):args+=['-e',key+'='+value]
    for mount in mounts:
        source=mount.get('Name') if mount['Type']=='volume' else mount['Source']
        args+=['--mount','type='+mount['Type']+',src='+source+',dst='+mount['Destination']+('' if mount['RW'] else ',readonly')]
    args+=[IMAGE,'/release/cli_guard.cjs','/tmp',*child]
    return {'label':label,'owner':owner,'name':name,'image':IMAGE,'child':child,
        'tmp':tmp,'mounts':mounts,'environment':environment,'argv':args,
        'neverRetry':True,'dataWritable':writable}

def validate_spec(spec):
    require(isinstance(spec,dict) and spec==cli_spec(spec.get('label'),{
        'Type':'volume','Name':'lims_lims-data','Source':LIVE_DATA,'Destination':'/app/server/prisma'}),
        'CLI intent differs from compiled exact specification')
    return spec

def selected(value,spec,running=None,emergency=False):
    """Validate every operational field before trusting an owned identity.

    Full mount objects are sealed and compared separately across lifecycle
    reads. Docker's API mount ARRAY order is never treated as semantic.
    """
    validate_spec(spec)
    require(isinstance(value,dict) and re.fullmatch('[a-f0-9]{64}',value.get('Id','')),'Exact full owned ID required')
    config=value.get('Config',{});host=value.get('HostConfig',{});state=value.get('State',{})
    require(value.get('Name')=='/'+spec['name'] and value.get('Image')==IMAGE and
            config.get('Labels',{}).get(LABEL)==spec['owner'],'Owned name/image/owner differs')
    require(config.get('Entrypoint')==['node'] and config.get('Cmd')==['/release/cli_guard.cjs','/tmp',*spec['child']] and
            config.get('WorkingDir')=='/app/server','Owned CLI entrypoint/command differs')
    env=config.get('Env',[]);pairs={}
    require(isinstance(env,list),'Owned environment absent')
    for item in env:
        require(isinstance(item,str) and '=' in item,'Malformed owned environment')
        key,content=item.split('=',1);require(key not in pairs,'Duplicate owned environment key');pairs[key]=content
    if not emergency:require(all(pairs.get(key)==content for key,content in spec['environment'].items()),'CLI flags or default heap changed')
    if not emergency:require(host.get('Memory')==host.get('MemorySwap')==MEMORY_MAX and host.get('NetworkMode')=='none' and
            host.get('RestartPolicy',{}).get('Name')=='no' and host.get('AutoRemove') is False,
            'CLI resource/network/restart/retention settings differ')
    if not emergency:require(config.get('Healthcheck')=={'Test':['NONE']},'CLI healthcheck must be disabled explicitly')
    mounts=value.get('Mounts',[])
    require(isinstance(mounts,list) and len(mounts)==3 and all(isinstance(m,dict) for m in mounts) and
            len({m.get('Destination') for m in mounts})==3,'Complete unique mount inventory required')
    actual={m['Destination']:m for m in mounts}
    for expected in spec['mounts']:
        require(expected['Destination'] in actual and all(actual[expected['Destination']].get(k)==v for k,v in expected.items()),
                'CLI mount identity or read-only protection differs')
    require(type(state.get('Running')) is bool,'Exact owned running flag required')
    if not emergency:require(state.get('OOMKilled') is False and
            state.get('Restarting') is False and state.get('Dead') is False and value.get('RestartCount')==0,
            'CLI exited/OOM/restarted/dead state refused')
    if running is not None:require(state['Running'] is running,'Owned running state differs')
    require(isinstance(state.get('StartedAt'),str),'Owned start timestamp missing')
    return {'id':value['Id'],'owner':spec['owner'],'name':value['Name'],'image':value['Image'],
            'running':state['Running'],'startedAt':state['StartedAt'],
            'mounts':sorted(mounts,key=lambda x:x['Destination']),
            'configSha256':sha(canonical(config)),'hostConfigSha256':sha(canonical(host))}

def same_retained(before,after):
    require(all(before[k]==after[k] for k in ('id','owner','name','image','startedAt','mounts','configSha256','hostConfigSha256')),
            'Owned retained identity/configuration changed')

def completion(raw,spec):
    require(isinstance(raw,bytes) and 0<len(raw)<=8192,'Bounded child completion required')
    value=exact_json(raw)
    require(set(value)=={'childStatus','childSignal','childErrorType','childSeconds','argvSha256','neverRetry'},
            'Child completion fields differ')
    # Node JSON.stringify arrays use compact UTF-8; this fixed ASCII argv has no
    # serializer ambiguity. It is not the kit authority canonical serializer.
    argv_raw=json.dumps(spec['child'],separators=(',',':'),ensure_ascii=False).encode()
    require(value['argvSha256']==sha(argv_raw) and value['neverRetry'] is True,'Child completed a different command')
    require(type(value['childSeconds']) in (int,float) and math.isfinite(value['childSeconds']) and value['childSeconds']>=0,
            'Child completion clock invalid')
    require(value['childStatus'] is None or type(value['childStatus']) is int and 0<=value['childStatus']<=255,
            'Child status invalid')
    require(value['childSignal'] is None or isinstance(value['childSignal'],str),'Child signal invalid')
    require(value['childErrorType'] is None or isinstance(value['childErrorType'],str),'Child error type invalid')
    return value

class OwnedCli:
    def __init__(self,runner,reader,journal,memory_factory,prepare_tmp,read_completion,publish_permit,stopper,
                 clock=time.monotonic,sleep=time.sleep):
        self.runner=runner;self.reader=reader;self.journal=journal;self.memory_factory=memory_factory
        self.prepare_tmp=prepare_tmp;self.read_completion=read_completion;self.publish_permit=publish_permit
        self.clock=clock;self.sleep=sleep;self.consumed=set();self.stopper=stopper;self.failure_stop=None

    def run(self,spec):
        validate_spec(spec);label=spec['label']
        require(label not in self.consumed,'CLI owner consumed; never retry')
        self.consumed.add(label)
        try:return self._run(spec)
        except BaseException:
            # This must precede journal/error writes, which can themselves fail
            # when the original error is reserve exhaustion or failed storage.
            try:self.failure_stop=self.stopper([label])
            except BaseException as failure:self.failure_stop={'stopErrorType':type(failure).__name__}
            raise

    def _run(self,spec):
        label=spec['label']
        # Journal intent exists even if create/start transport loses its return.
        self.journal.append('ownedCliIntent',{'specification':spec,'specificationSha256':sha(canonical(spec))})
        self.prepare_tmp(spec)
        inventory=self.reader.inventory()
        require(all(row.get('Name')!='/'+spec['name'] and row.get('Config',{}).get('Labels',{}).get(LABEL)!=spec['owner']
                    for row in inventory.values()),'CLI name or owner already exists')
        raw,_,_=self.runner.run(spec['argv'],label+'-create',30)
        require(re.fullmatch(rb'[a-f0-9]{64}\n?',raw) is not None,'Exact create ID output required')
        identity=raw.decode().strip();created=selected(self.reader.inspect(identity),spec,False)
        self.journal.append('ownedCliCreated',{'owner':spec['owner'],'id':identity,'selected':created})
        began=self.clock()
        self.runner.run(['docker','start',identity],label+'-start',15)
        started=selected(self.reader.inspect(identity),spec,True)
        require(all(created[k]==started[k] for k in ('id','owner','name','image','mounts','configSha256','hostConfigSha256')),
                'Created CLI configuration changed at start')
        history=self.memory_factory(label,identity,spec['owner'])
        history.observe('before-command-observation')
        child=None;completion_raw=None;last=self.clock()
        while self.clock()-began<600:
            raw=self.read_completion(spec)
            if raw is not None:
                child=completion(raw,spec);completion_raw=raw;break
            if self.clock()-last>=2:
                history.observe('running-command');last=self.clock()
            self.runner.check(0);self.sleep(0.05)
        require(child is not None,'Existing CLI 600 second deadline reached; never retry')
        final_before=selected(self.reader.inspect(identity),spec,True)
        same_retained(started,final_before)
        history.observe('before-stop')
        memory=history.summary(0)
        require(self.clock()-began<600,'CLI original deadline reached before final memory permission')
        self.publish_permit(spec,{'childCompletionSha256':sha(completion_raw),'finalHostMemoryEventsCaptured':True})
        after=final_before;obj=None
        while self.clock()-began<600:
            obj=self.reader.inspect(identity);after=selected(obj,spec)
            same_retained(started,after)
            if not after['running']:break
            self.runner.check(0);self.sleep(0.1)
        require(after['running'] is False,'CLI wrapper failed to exit within original 600 second deadline')
        # The logs include the original child's unmodified stdout/stderr. They
        # stay private pending the same content review as other CLI streams.
        stdout,stderr,metadata=self.runner.run(['docker','logs',identity],label+'-logs',15,allow_stderr=True)
        result={'containerId':identity,'owner':spec['owner'],'child':child,'memory':memory,
                'elapsedSeconds':self.clock()-began,'stoppedAndRetained':True,
                'exitCode':obj['State'].get('ExitCode'),'logs':metadata,'dataWritable':spec['dataWritable']}
        self.journal.append('ownedCliComplete',result)
        require(child['childStatus']==0 and child['childSignal'] is None and child['childErrorType'] is None and
                result['exitCode']==0 and not stderr,'CLI failed; retained child and wrapper outcome must both succeed')
        return stdout,result

def filesystem_controls(root,require_directory_sync=True):
    """Production control-file callbacks. Exact root, fresh directories only."""
    root=pathlib.Path(root)
    require(root.as_posix()==str(ROOT) and root.resolve()==root and root.is_dir() and not root.is_symlink(),
            'Exact real production control root required')
    def directory(spec):
        validate_spec(spec);p=root/(spec['label']+'-retained-temp')
        require(p.as_posix()==spec['tmp'] and p.parent==root and not p.is_symlink(),'Exact private control directory required')
        return p
    def prepare(spec):
        p=directory(spec);p.mkdir(mode=0o700)
        require(not list(p.iterdir()),'Fresh empty CLI control directory required')
    def read(spec):
        p=directory(spec)/'cli-child-complete.json'
        if not p.exists():return None
        require(not p.is_symlink() and p.is_file() and p.stat().st_size<=8192,'Bounded real completion file required')
        raw=p.read_bytes();require(len(raw)<=8192,'Completion grew beyond bound');return raw
    def permit(spec,value):exclusive_record(directory(spec),'cli-exit-permit.json',value,require_directory_sync)
    return prepare,read,permit
