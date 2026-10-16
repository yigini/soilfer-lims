"""Normal predecessor retention and one qualified default-entrypoint candidate.

Private full specifications preserve the observed ports, environment, network
and named volumes. They never become public receipt payloads. No import I/O.
"""
import copy
import ipaddress
import re
import time
from kit_contract import HEAD,IMAGE,MEMORY_MAX,canonical,require,sha
from retained_contract import ROOT,LIVE_DATA,LIVE_ASSETS,exact_json
from retained_health import assert_healthcheck
from kit_owned import LABEL

PREDECESSOR_ID='8109d78e228573ead8aa243442192e54b8e1dc09101bc3fa23d03e5a29cbb66b'
PREDECESSOR_IMAGE='sha256:7aebc035254a61b0b4b8ecb59492d582af7f3769c147a35a7e92a43fb7a642d2'
PREDECESSOR_HEAD='959d17e11c357266f7c2a41b0c84ab76914c591e'
CANDIDATE_OWNER=str(ROOT)+':candidate'
RETAINED_PREDECESSOR_NAME='soilfer-lims-retained-959d17e1-be837974-20261016t150000z'
VOLUMES={'lims_lims-data':('/app/server/prisma',LIVE_DATA),
         'lims_lims-assets':('/app/server/uploads',LIVE_ASSETS),
         'lims_lims-backups':('/app/server/backups','/var/lib/docker/volumes/lims_lims-backups/_data')}

def full_mounts(value):
    mounts=value.get('Mounts')
    require(isinstance(mounts,list) and all(isinstance(m,dict) and isinstance(m.get('Destination'),str) for m in mounts),
            'Complete full mount objects required')
    require(len({m['Destination'] for m in mounts})==len(mounts),'Duplicate mount destination')
    return sorted(mounts,key=lambda m:m['Destination'])

def environment(config):
    out={};rows=config.get('Env')
    require(isinstance(rows,list),'Observed predecessor environment required')
    for row in rows:
        require(isinstance(row,str) and '=' in row and '\x00' not in row,'Invalid environment record')
        key,value=row.split('=',1)
        require(re.fullmatch('[A-Za-z_][A-Za-z0-9_]*',key) and key not in out,'Duplicate/malformed environment key')
        out[key]=value
    return out

def predecessor_projection(value,name='soilfer-lims'):
    require(value.get('Id')==PREDECESSOR_ID and value.get('Name')=='/'+name and value.get('Image')==PREDECESSOR_IMAGE,
            'Exact normal predecessor identity differs')
    require(isinstance(value.get('Config'),dict) and isinstance(value.get('HostConfig'),dict),'Full predecessor configuration required')
    state=value.get('State',{})
    require(type(state.get('Running')) is bool and isinstance(state.get('StartedAt'),str) and state['StartedAt'],
            'Exact predecessor runtime state required')
    return {'id':value['Id'],'image':value['Image'],'name':value['Name'],'startedAt':state['StartedAt'],
        'configSha256':sha(canonical(value['Config'])),'hostConfigSha256':sha(canonical(value['HostConfig'])),
        'mounts':full_mounts(value)}

def candidate_spec(predecessor,health):
    before=predecessor_projection(predecessor)
    state=predecessor['State'];host=predecessor['HostConfig'];config=predecessor['Config']
    require(state.get('Running') is True and state.get('Health',{}).get('Status')=='healthy' and
        state.get('OOMKilled') is False and not state.get('Restarting') and not state.get('Dead') and predecessor.get('RestartCount')==0,
        'Normal predecessor must still be running healthy without OOM/restart')
    require(host.get('Memory')==MEMORY_MAX and host.get('MemorySwap')==1610612736,'Observed predecessor limits differ')
    env=environment(config)
    require(env.get('NODE_OPTIONS','')=='' and env.get('ALLOW_PRISMA_DB_PUSH')=='false' and
        env.get('ALLOW_AUTO_SEED')=='false' and env.get('DISABLE_BACKGROUND_JOBS','false')!='true',
        'Observed predecessor heap/initialization/jobs flags differ')
    require(config.get('Labels',{}).get('org.opencontainers.image.revision')==PREDECESSOR_HEAD,
        'Observed predecessor revision differs')
    mounts=before['mounts'];names={m.get('Name') for m in mounts}
    require(names in ({'lims_lims-data','lims_lims-assets'},set(VOLUMES)) and len(mounts)==len(names),
        'Only exact observed data/assets and optional backups named volumes allowed')
    for mount in mounts:
        destination,source=VOLUMES[mount['Name']]
        require(mount.get('Type')=='volume' and mount.get('Source')==source and mount.get('Destination')==destination and
            mount.get('RW') is True,'Observed predecessor volume identity differs')
    network=host.get('NetworkMode')
    require(isinstance(network,str) and re.fullmatch('[A-Za-z0-9][A-Za-z0-9_.-]{0,127}',network) and network not in ('host','none','container'),
        'Exact observed ordinary Docker network required')
    ports=host.get('PortBindings')
    require(isinstance(ports,dict) and set(ports)=={'3000/tcp'} and isinstance(ports['3000/tcp'],list) and
        0<len(ports['3000/tcp'])<=2,'Exact observed application port bindings required')
    port_flags=[];seen=set()
    for binding in ports['3000/tcp']:
        require(isinstance(binding,dict) and set(binding)=={'HostIp','HostPort'} and binding['HostPort']=='3000',
            'Unexpected observed application port')
        address=binding['HostIp'] or '0.0.0.0';ip=ipaddress.ip_address(address)
        require((address,binding['HostPort']) not in seen,'Duplicate observed application port binding');seen.add((address,binding['HostPort']))
        port_flags+=['-p',('['+address+']' if ip.version==6 else address)+':3000:3000']
    nano=host.get('NanoCpus')
    require(type(nano) is int and nano==1500000000,'Observed CPU allocation differs from reviewed 1.5 CPUs')
    log=host.get('LogConfig')
    require(isinstance(log,dict) and log.get('Type')=='json-file' and log.get('Config')=={'max-size':'50m','max-file':'3'},
        'Observed bounded log configuration differs')
    env.update(NODE_OPTIONS='',ALLOW_PRISMA_DB_PUSH='false',ALLOW_AUTO_SEED='false',DISABLE_BACKGROUND_JOBS='false',
        DATABASE_PATH='/app/server/prisma/dev.db',DATABASE_URL='file:/app/server/prisma/dev.db',TMPDIR='/tmp',TMP='/tmp',TEMP='/tmp')
    tmp=str(ROOT/'candidate-retained-temp')
    expected_mounts=[{k:m[k] for k in ('Type','Name','Source','Destination','RW')} for m in mounts]
    expected_mounts.append({'Type':'bind','Source':tmp,'Destination':'/tmp','RW':True})
    args=['docker','create','--name','soilfer-lims','--label',LABEL+'='+CANDIDATE_OWNER,'--network',network,
        '--memory',str(MEMORY_MAX),'--memory-swap',str(MEMORY_MAX),'--restart','no','--cpus','1.5',
        '--log-driver','json-file','--log-opt','max-size=50m','--log-opt','max-file=3',*port_flags]
    for key,value in sorted(env.items()):args+=['-e',key+'='+value]
    for mount in expected_mounts:
        source=mount.get('Name') if mount['Type']=='volume' else mount['Source']
        args+=['--mount','type='+mount['Type']+',src='+source+',dst='+mount['Destination']]
    args+=health['createFlags']+[IMAGE]
    # No entrypoint/Cmd override: this is the ordinary shipped default start.
    return {'owner':CANDIDATE_OWNER,'name':'soilfer-lims','image':IMAGE,'head':HEAD,'argv':args,
        'mounts':expected_mounts,'environment':env,'network':network,'ports':copy.deepcopy(ports),
        'health':copy.deepcopy(health),'predecessorProjection':before,'privateSpecification':True,'neverRetry':True}

def candidate_projection(value,spec,running=None,emergency=False):
    require(spec.get('owner')==CANDIDATE_OWNER and spec.get('image')==IMAGE and spec.get('head')==HEAD and
        spec.get('name')=='soilfer-lims' and spec.get('neverRetry') is True,'Candidate intent target differs')
    require(re.fullmatch('[a-f0-9]{64}',value.get('Id','')) and value.get('Name')=='/soilfer-lims' and value.get('Image')==IMAGE,
        'Exact candidate identity differs')
    config=value.get('Config',{});host=value.get('HostConfig',{});state=value.get('State',{})
    require(config.get('Labels',{}).get(LABEL)==CANDIDATE_OWNER and
        config.get('Labels',{}).get('org.opencontainers.image.revision')==HEAD and
        config.get('Entrypoint')==['/app/docker-entrypoint.sh'] and config.get('Cmd') in (None,[]),
        'Candidate owner/revision/default entrypoint differs')
    mounts=full_mounts(value);actual={m['Destination']:m for m in mounts}
    require(len(actual)==len(spec['mounts']) and all(m['Destination'] in actual and
        all(actual[m['Destination']].get(k)==v for k,v in m.items()) for m in spec['mounts']),
        'Candidate full mount identities differ')
    require(type(state.get('Running')) is bool and isinstance(state.get('StartedAt'),str),'Candidate runtime identity absent')
    if running is not None:require(state['Running'] is running,'Candidate running state differs')
    if not emergency:
        require(all(environment(config).get(k)==v for k,v in spec['environment'].items()),'Candidate runtime environment differs')
        require(host.get('Memory')==host.get('MemorySwap')==MEMORY_MAX and host.get('NetworkMode')==spec['network'] and
            host.get('PortBindings')==spec['ports'] and host.get('RestartPolicy',{}).get('Name')=='no' and
            host.get('AutoRemove') is False and host.get('NanoCpus')==1500000000 and
            host.get('LogConfig')=={'Type':'json-file','Config':{'max-size':'50m','max-file':'3'}},
            'Candidate memory/swap/CPU/network/ports/restart/log retention differs')
        require(state.get('OOMKilled') is False and not state.get('Dead') and not state.get('Restarting') and value.get('RestartCount')==0,
            'Candidate OOM/restart/dead state refused')
        assert_healthcheck(config.get('Healthcheck'),spec['health'])
    return {'id':value['Id'],'owner':CANDIDATE_OWNER,'name':value['Name'],'image':value['Image'],
        'startedAt':state['StartedAt'],'running':state['Running'],'mounts':mounts,
        'configSha256':sha(canonical(config)),'hostConfigSha256':sha(canonical(host))}

class ExactPredecessor:
    def __init__(self,observed,runner,reader,emergency,journal):
        self.observed=copy.deepcopy(observed);self.original=predecessor_projection(observed)
        self.runner=runner;self.reader=reader;self.emergency=emergency;self.journal=journal
        self.name='soilfer-lims';self.restarted=False;self.renamed=False;self.stop_count=0

    def exact(self,value):
        projection=predecessor_projection(value,self.name)
        require(all(projection[k]==self.original[k] for k in ('id','image','configSha256','hostConfigSha256','mounts')),
            'Same retained predecessor configuration changed')
        if not self.restarted:require(projection['startedAt']==self.original['startedAt'],'Predecessor started unexpectedly')
        return projection

    def stop(self,grace=10):
        require(grace==10,'Exact reviewed predecessor stop grace required')
        self.stop_count+=1
        require(self.stop_count<=2 and (self.stop_count==1 or self.restarted),'Predecessor stop replay refused')
        rows=exact_json(self.emergency(['docker','inspect',PREDECESSOR_ID]));require(isinstance(rows,list) and len(rows)==1,'Single predecessor inspection required')
        before=self.exact(rows[0])
        if rows[0]['State']['Running']:
            self.emergency(['docker','stop','-t','10',PREDECESSOR_ID])
        rows=exact_json(self.emergency(['docker','inspect',PREDECESSOR_ID]));require(isinstance(rows,list) and len(rows)==1,'Single stopped predecessor inspection required')
        after=self.exact(rows[0]);state=rows[0]['State']
        require(state['Running'] is False and type(state.get('ExitCode')) is int and after['startedAt']==before['startedAt'],
            'Exact predecessor remains running or changed during stop')
        result={'stoppedAndRetained':True,'exitCode':state['ExitCode'],'before':before,'after':after,'graceSeconds':10}
        self.journal.append('predecessorStopped',result);return result

    def retain_name(self):
        require(not self.renamed and not self.restarted,'Predecessor retention rename already consumed')
        before=self.reader.inspect(PREDECESSOR_ID);self.exact(before)
        require(before['State']['Running'] is False,'Only exact stopped predecessor may be renamed')
        inventory=self.reader.inventory()
        require(all(v.get('Name')!='/'+RETAINED_PREDECESSOR_NAME for v in inventory.values()),'Retained predecessor name already exists')
        self.journal.append('predecessorRenameIntent',{'id':PREDECESSOR_ID,'name':RETAINED_PREDECESSOR_NAME})
        self.renamed=True
        self.runner.run(['docker','rename',PREDECESSOR_ID,RETAINED_PREDECESSOR_NAME],'predecessor-rename',15)
        self.name=RETAINED_PREDECESSOR_NAME;self.exact(self.reader.inspect(PREDECESSOR_ID))

    def restart_preapply_once(self):
        require(not self.restarted and not self.renamed,'Only same unrenamed pre-APPLY predecessor may restart once')
        value=self.reader.inspect(PREDECESSOR_ID);self.exact(value)
        require(value['State']['Running'] is False,'Pre-APPLY predecessor is not stopped')
        self.journal.append('preApplyPredecessorRestartIntent',{'id':PREDECESSOR_ID,'neverRetry':True,'noDatabaseRestore':True})
        self.restarted=True
        self.runner.run(['docker','start',PREDECESSOR_ID],'preapply-predecessor-restart',15)
        return {'id':PREDECESSOR_ID,'sameRetainedPredecessor':True,'noDatabaseRestore':True}

class Candidate:
    def __init__(self,spec,runner,reader,journal,prepare_tmp,clock=time.monotonic):
        self.spec=copy.deepcopy(spec);self.runner=runner;self.reader=reader;self.journal=journal;self.prepare_tmp=prepare_tmp
        self.consumed=False;self.id=None;self.created=None;self.started=None;self.clock=clock;self.start_began=None

    def start_once(self):
        require(not self.consumed,'Candidate create/start consumed; never retry');self.consumed=True
        self.journal.append('candidateCreateIntent',{'privateSpecification':self.spec,'specificationSha256':sha(canonical(self.spec))})
        self.prepare_tmp()
        inventory=self.reader.inventory()
        require(all(v.get('Name')!='/soilfer-lims' and v.get('Config',{}).get('Labels',{}).get(LABEL)!=CANDIDATE_OWNER
            for v in inventory.values()),'Candidate name or owner collision')
        raw,_,_=self.runner.run(self.spec['argv'],'candidate-create',30)
        require(re.fullmatch(rb'[a-f0-9]{64}\n?',raw) is not None,'Exact candidate create ID required')
        self.id=raw.decode().strip();self.created=candidate_projection(self.reader.inspect(self.id),self.spec,False)
        self.journal.append('candidateStartIntent',{'id':self.id,'owner':CANDIDATE_OWNER,'anyEntrypointAttempted':True,'neverRetry':True})
        # Exact shared readiness clock begins at Docker start dispatch, after
        # creation. Creation still belongs to the disclosed whole503 outage.
        self.start_began=self.clock()
        self.runner.run(['docker','start',self.id],'candidate-start',15)
        self.started=candidate_projection(self.reader.inspect(self.id),self.spec,True)
        require(all(self.created[k]==self.started[k] for k in ('id','owner','name','image','mounts','configSha256','hostConfigSha256')),
            'Candidate configuration changed while starting')
        return self.id

    def stop_for_intent(self,call):
        raw=call(['docker','ps','-aq','--no-trunc','--filter','label='+LABEL+'='+CANDIDATE_OWNER])
        ids=raw.decode('ascii').splitlines()
        require(len(raw)<=512*1024 and len(ids)<=1 and len(ids)==len(set(ids)) and all(re.fullmatch('[a-f0-9]{64}',i) for i in ids),
            'Exact candidate owner inventory malformed or ambiguous')
        if not ids:return {'observedAbsent':True,'stoppedAndRetained':False,'unknownCreateReturnIsNotAbsenceEvidence':True}
        identity=ids[0]
        if self.id is not None:require(identity==self.id,'Returned candidate identity differs from exact owner')
        rows=exact_json(call(['docker','inspect',identity]));require(isinstance(rows,list) and len(rows)==1 and rows[0].get('Id')==identity,'Exact candidate inspect required')
        before=candidate_projection(rows[0],self.spec,emergency=True)
        if before['running']:call(['docker','stop','-t','10',identity])
        rows=exact_json(call(['docker','inspect',identity]));require(isinstance(rows,list) and len(rows)==1 and rows[0].get('Id')==identity,'Exact stopped candidate inspect required')
        after=candidate_projection(rows[0],self.spec,False,emergency=True)
        require(all(before[k]==after[k] for k in ('id','owner','name','image','startedAt','mounts','configSha256','hostConfigSha256')),
            'Candidate changed during exact stop')
        return {'id':identity,'stoppedAndRetained':True,'exitCode':rows[0]['State'].get('ExitCode'),'before':before,'after':after}
