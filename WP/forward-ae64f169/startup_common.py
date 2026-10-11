"""Shared real-entrypoint readiness and read-only checks; no installer commands."""
import datetime, hashlib, json, pathlib, re, sqlite3, subprocess, time
import release_support as s

ORIGIN = pathlib.Path('/opt/lims/releases/preparation-release-ae64f169-20261011T135600Z')
FAILURE_SHA = '02fcf3ee472c68caff8ebe52edc009f3d3d9e2666210c7ba6eac5a03c9de7305'
ORIGINAL_MANIFEST_SHA = '4f98943cd0a3ac117c235822ad8b27012968d56a518109d3f1b49f76ebd207f6'
IMAGE = 'sha256:bc2557a5dee2a8599d31cf96407088d67ce863c4ad3fc7e6989b8671e10c597a'
DEADLINE_SECONDS = 600
LIMIT = 805306368
MIN_HEADROOM = 10556150894
PROBES = ['postflight-roles.cjs','postflight-auth.cjs','postflight-reference.cjs',
          'postflight-qc-runs.cjs','postflight-policy.cjs','readonly-smoke.cjs']

def digest(value):
    return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()).hexdigest()

class ZeroWriteWatch:
    def __init__(self, database):
        self.db=sqlite3.connect('file:'+str(database)+'?mode=ro',uri=True)
        self.version=self.db.execute('PRAGMA data_version').fetchone()[0]
    def check(self):
        assert self.db.execute('PRAGMA data_version').fetchone()[0]==self.version, 'Database committed a write during startup/checks'
    def close(self):
        self.db.close()

def inspect(name):
    return json.loads(subprocess.check_output(['docker','inspect',name],text=True,timeout=15))[0]

def write_new(path, value):
    with path.open('x') as out: json.dump(value,out,indent=2)
    path.chmod(0o400)

def allocation(root):
    files = list(root.rglob('*'))
    assert not any(f.is_symlink() for f in files)
    return sum(f.stat().st_blocks*512 for f in files if f.is_file())

class DiskGuard:
    def __init__(self, root, reserve=8589934592):
        self.root=root; self.before=s.disk_free(); self.allocated=allocation(root); self.reserve=reserve
    def check(self):
        free=s.disk_free(); assert min(free.values())>=self.reserve
        growth=max(0,allocation(self.root)-self.allocated)
        drop=s.check_drop(self.before,free,{p:growth if pathlib.Path(p).stat().st_dev==self.root.stat().st_dev else 0 for p in free})
        return {'freeBytes':free,'unexplainedDropBytes':drop}

def held_state():
    assert s.sha(ORIGIN/'production-receipt.json')==FAILURE_SHA
    assert s.sha(ORIGIN/'prepared-manifest.json')==ORIGINAL_MANIFEST_SHA
    failed=json.loads((ORIGIN/'production-receipt.json').read_bytes())
    assert failed['status']=='FAILED_FORWARD_HOLD' and failed['head']==s.HEAD
    assert failed['preservation']['originalRowsAndFieldsPreserved'] is True
    assert failed['repeatTotalChanges']==0 and failed['repeatedInstallDatabaseBytesPreserved'] is True
    physical=s.physical(s.LIVE)
    assert physical['']==failed['installedDatabaseFiles']['']
    # The unchanged main DB is pinned. The empty WAL and transient SHM disappeared
    # on failed-startup shutdown; this observed stopped state is explicit and bound.
    assert physical['-wal'] is None and physical['-shm'] is None
    current=s.snapshot(s.LIVE,failed['preApplyState'])
    assert current['tables']==failed['installedTables']
    assert s.preserve(failed['preApplyState'],current)==failed['preservation']
    assert s.verify_retained_acceptance(s.LIVE.parent)==failed['retainedAcceptance']
    return failed,physical

def exact_state(database, expected):
    actual=s.snapshot(database)
    assert actual==expected, 'Startup or read-only probes changed database evidence'
    return actual

def state_guard(container, jobs=None):
    state=container['State']
    assert state['Running'], 'Candidate exited; hold remains'
    assert not state['OOMKilled'] and container['RestartCount']==0, 'Candidate OOM/restart; hold remains'
    assert container['Image']==IMAGE
    assert container['HostConfig']['Memory']==LIMIT
    env=dict(row.split('=',1) for row in container['Config']['Env'] if '=' in row)
    assert env.get('NODE_OPTIONS') in [None,'']
    assert env['ALLOW_PRISMA_DB_PUSH']==env['ALLOW_AUTO_SEED']=='false'
    if jobs is not None: assert env['DISABLE_BACKGROUND_JOBS']==('false' if jobs else 'true')
    if container['Name']=='/soilfer-lims':
        mounts={m['Destination']:m for m in container['Mounts']}
        assert mounts['/app/server/prisma']['Name']=='lims_lims-data'
        assert mounts['/app/server/uploads']['Name']=='lims_lims-assets'
    return state

def deadline_guard(start, now):
    assert 0<=now-start<DEADLINE_SECONDS, '600-second wall-clock startup deadline exceeded'

def start_and_wait(root,name,database_dir,assets_dir,guard,stage,watch,jobs=False,production=False):
    """Identical readiness code in bridge/published-port proof and production."""
    start=time.monotonic(); started_utc=s.utc()
    mounts=['-v','lims_lims-data:/app/server/prisma','-v','lims_lims-assets:/app/server/uploads'] if production else [
        '--mount','type=bind,src='+str(database_dir)+',dst=/app/server/prisma',
        '--mount','type=bind,src='+str(assets_dir)+',dst=/app/server/uploads']
    assert production== (name=='soilfer-lims')
    args=['docker','run','-d','--name',name,'--label','io.soilfer.forward-owned='+str(root),
        '--memory','768m','--restart','unless-stopped' if production else 'no',
        '-p','127.0.0.1:3000:3000' if production else '127.0.0.1::3000',
        '--env-file','/opt/lims/.env','-e','DATABASE_PATH=/app/server/prisma/dev.db',
        '-e','DATABASE_URL=file:/app/server/prisma/dev.db','-e','NODE_OPTIONS=',
        '-e','ALLOW_PRISMA_DB_PUSH=false','-e','ALLOW_AUTO_SEED=false',
        '-e','DISABLE_BACKGROUND_JOBS='+('false' if jobs else 'true'),
        '--health-cmd','wget -q --spider http://127.0.0.1:3000/api/health',
        '--health-interval','10s','--health-timeout','5s','--health-retries','3',
        '--health-start-period','30s']+mounts+[IMAGE]
    s.command(root,args,stage+'-run',timeout=30)
    c=inspect(name); state_guard(c,jobs)
    ports=c['NetworkSettings']['Ports']['3000/tcp']
    assert len(ports)==1 and ports[0]['HostIp']=='127.0.0.1'
    base='http://127.0.0.1:'+ports[0]['HostPort']
    attempts=0
    while True:
        deadline_guard(start,time.monotonic())
        c=inspect(name);state_guard(c,jobs); guard.check(); watch.check(); attempts+=1
        response=subprocess.run(['curl','-fsS','--max-time','2',base+'/api/health'],capture_output=True,text=True,timeout=4)
        if response.returncode==0 and c['State']['Health']['Status']=='healthy':
            deadline_guard(start,time.monotonic());watch.check();state_guard(inspect(name),jobs)
            health=json.loads(response.stdout);assert health['status']=='ok'
            result={'startedUtc':started_utc,'containerStartedUtc':c['State']['StartedAt'],
                'readyUtc':s.utc(),'elapsedSeconds':time.monotonic()-start,
                'deadlineSeconds':DEADLINE_SECONDS,'attempts':attempts,'health':health,
                'restartCount':c['RestartCount'],'oomKilled':False,'memoryLimitBytes':LIMIT,
                'networkMode':c['HostConfig']['NetworkMode'],'publishedHostIp':'127.0.0.1',
                'jobsEnabled':jobs,'baseUrl':base,'sharedReadinessCode':s.sha(pathlib.Path(__file__))}
            write_new(root/(stage+'-readiness.json'),result);return result
        if attempts%30==0: print(json.dumps({'stage':stage,'elapsedSeconds':time.monotonic()-start,'pending':True}),flush=True)
        time.sleep(1)

def entrypoint_zero(log):
    entry=log.split('Starting SoilFER-LIMS...')[0];decoder=json.JSONDecoder();values=[];i=0
    while i<len(entry):
        j=entry.find('{',i)
        if j<0:break
        try:
            value,end=decoder.raw_decode(entry[j:]);i=j+end
        except ValueError:i=j+1;continue
        if isinstance(value,dict) and 'totalChanges' in value:values.append(value)
    assert len(values)==22 and all(x['mode']=='NO_OP' and x['totalChanges']==0 for x in values)
    return [{'classification':x['classification'],'mode':x['mode'],'totalChanges':x['totalChanges']} for x in values]

def startup_checks(root,name,database,expected,stage):
    result=s.command(root,['docker','logs',name],stage+'-startup')
    log=result.stdout+'\n'+result.stderr
    ready=s.ready_logs(log);entry=entrypoint_zero(log)
    memory=s.command(root,['docker','exec',name,'node','-e',
        "console.log(Number(require('node:fs').readFileSync('/sys/fs/cgroup/memory.peak','utf8')))"],stage+'-memory')
    peak=int(memory.stdout.strip());assert 0<peak<=LIMIT
    exact_state(database,expected)
    return {'startupReady':ready,'entrypointInstallers':entry,'startupChanges':0,
        'startupMemory':{'peakBytes':peak,'limitBytes':LIMIT,'nodeOptions':None}}

def probes(root,name,database,expected):
    args=['docker','exec','-w','/app/server','-e','POSTFLIGHT_ADMIN_ID=1770311018064',
        '-e','POSTFLIGHT_MANAGER_ID=user-mgr-gha','-e','POSTFLIGHT_TECH_ID=user-tech-gha',
        '-e','POSTFLIGHT_BASE_URL=http://127.0.0.1:3000']
    old=s.command(root,args+[name,'node','scripts/postflight_issue140.cjs'],'api-postflight')
    match=re.search(r'POSTFLIGHT SUMMARY: (\d+)/(\d+) checks passed \((\d+) failed\)',old.stdout)
    assert match and tuple(map(int,match.groups()))==(31,31,0)
    records=[]
    for file in PROBES:
        s.command(root,args+['-i',name,'node'],file[:-4],stdin=(root/file).read_text())
        records.append({'file':file,'sha256':s.sha(root/file),'exitCode':0})
    exact_state(database,expected)
    return {'apiChecks':{'passed':31,'total':31,'failed':0},'probes':records,'readOnlyProbeChanges':0}

def writers_stopped():
    ids=subprocess.check_output(['docker','ps','-q'],text=True,timeout=15).split()
    if not ids:return
    data=s.LIVE.parent.resolve()
    for c in json.loads(subprocess.check_output(['docker','inspect',*ids],text=True,timeout=15)):
        for mount in c.get('Mounts',[]):
            source=pathlib.Path(mount['Source']).resolve()
            assert not (mount.get('RW') and (source==data or source in data.parents or data in source.parents)), 'An unreviewed DB writer remains'

def owned_stop(root,name,label):
    c=inspect(name)
    assert c['Config']['Labels'].get('io.soilfer.forward-owned')==str(root)
    if c['State']['Running']:s.command(root,['docker','stop','-t','30',name],label,timeout=45)
    assert not inspect(name)['State']['Running']

def image_check():
    c=json.loads(subprocess.check_output(['docker','image','inspect',IMAGE],text=True,timeout=15))[0]
    assert c['Id']==IMAGE and c['Size']==413546358
    assert c['Config']['Labels']['org.opencontainers.image.revision']==s.HEAD
    return {'id':c['Id'],'size':c['Size'],'revision':s.HEAD}

def main_bytes(database, expected):
    files=s.physical(database)
    assert files['']==expected[''], 'Protected main DB bytes changed'
    assert files['-wal'] is None or files['-wal']['bytes']==0, 'Nonempty WAL means a committed write'
    return files
