"""Read-only startup/API supplement on a retained owned copy, never live."""
import json, pathlib, re, subprocess, sys, time
import release_support as s

ROOT = pathlib.Path(__file__).resolve().parent
PROBES = ['postflight-roles.cjs','postflight-auth.cjs','postflight-reference.cjs',
          'postflight-qc-runs.cjs','postflight-policy.cjs','readonly-smoke.cjs']

if __name__ == '__main__':
    assert ROOT.parent == pathlib.Path('/opt/lims/releases') and ROOT.name.startswith('combined-eb6de2e8-')
    assert len(sys.argv) == 2 and not (ROOT/'supplement-receipt.json').exists()
    origin = pathlib.Path(sys.argv[1]).resolve()
    assert origin.parent == ROOT.parent and origin.name.startswith('combined-eb6de2e8-') and origin != ROOT
    previous = json.loads((origin/'rehearsal-receipt.json').read_text())
    assert previous['status'] == 'REFUSED_OR_FAILED_OWNED_COPY' and previous['productionExecution'] is False
    assert previous['head'] == s.HEAD and previous['repeatTotalChanges'] == 0
    assert previous['repeatedInstallDatabaseBytesPreserved'] is True
    database = origin/'owned-copy/prisma/dev.db'
    assert not database.is_symlink() and origin in database.resolve().parents and database.resolve() != s.LIVE.resolve()
    projected = s.snapshot(database, {'tables':previous['originalTables']})
    assert projected['tables'] == previous['installedTables'], 'Earlier startup changed installed evidence'
    before = s.snapshot(database)
    before_bytes = s.sha(database)
    image = previous['candidateImage']
    name = 'lims-owned-' + ROOT.name
    owner = str(ROOT.resolve())+':startup'
    result = {'status':'PREPARING_STARTUP_API_SUPPLEMENT','head':s.HEAD,'candidateImage':image,
        'productionExecution':False,'completeCoordinatorRehearsal':False,
        'origin':str(origin),'priorFailedReceiptSha256':s.sha(origin/'rehearsal-receipt.json'),
        'startedUtc':s.utc(),'scriptSha256':{file.name:s.sha(file) for file in ROOT.iterdir() if file.name.endswith(('.py','.cjs'))}}
    started = False
    try:
        s.command(ROOT,['docker','run','-d','--name',name,'--label','io.soilfer.release-owned='+owner,
            '--network','none','--memory','768m','--env-file','/opt/lims/.env',
            '-e','DATABASE_PATH=/app/server/prisma/dev.db','-e','DATABASE_URL=file:/app/server/prisma/dev.db',
            '-e','DISABLE_BACKGROUND_JOBS=true','-e','NODE_OPTIONS=',
            '-e','ALLOW_PRISMA_DB_PUSH=false','-e','ALLOW_AUTO_SEED=false',
            '--mount','type=bind,src='+str(database.parent)+',dst=/app/server/prisma',
            '--mount','type=bind,src='+str(origin/'owned-copy/uploads')+',dst=/app/server/uploads',image],'supplement-start')
        started = True
        for _ in range(90):
            health = subprocess.run(['docker','exec',name,'node','-e',
                "fetch('http://127.0.0.1:3000/api/health').then(async r=>{if(r.status!==200)process.exit(1);console.log(JSON.stringify(await r.json()))}).catch(()=>process.exit(1))"],
                capture_output=True,text=True,timeout=10)
            if health.returncode == 0:
                result['health'] = json.loads(health.stdout)
                assert result['health']['status'] == 'ok'
                break
            time.sleep(1)
        else:
            raise RuntimeError('Owned supplemental startup failed')
        logs = s.command(ROOT,['docker','logs',name],'supplement-ready')
        result['readyEvents'] = s.ready_logs(logs.stdout+'\n'+logs.stderr)
        assert s.snapshot(database) == before, 'Supplemental startup changed rows/schema'
        args = ['docker','exec','-w','/app/server','-e','POSTFLIGHT_ADMIN_ID=1770311018064',
            '-e','POSTFLIGHT_MANAGER_ID=user-mgr-gha','-e','POSTFLIGHT_TECH_ID=user-tech-gha',
            '-e','POSTFLIGHT_BASE_URL=http://127.0.0.1:3000']
        api = s.command(ROOT,args+[name,'node','scripts/postflight_issue140.cjs'],'supplement-api')
        counts = re.search(r'POSTFLIGHT SUMMARY: (\d+)/(\d+) checks passed \((\d+) failed\)',api.stdout)
        assert counts and tuple(map(int,counts.groups())) == (31,31,0)
        result['apiChecks'] = {'passed':31,'total':31,'failed':0}
        result['probes'] = []
        for file in PROBES:
            s.command(ROOT,args+['-i',name,'node'],file[:-4],stdin=(ROOT/file).read_text())
            result['probes'].append({'file':file,'sha256':s.sha(ROOT/file),'exitCode':0})
        assert s.snapshot(database) == before, 'Supplemental API reads changed rows/schema'
        memory = s.command(ROOT,['docker','exec',name,'node','-e',
            "console.log(Number(require('node:fs').readFileSync('/sys/fs/cgroup/memory.peak','utf8')))"],'supplement-memory')
        result['memory'] = {'limitBytes':805306368,'nodeOptions':None,'peakBytes':int(memory.stdout.strip().splitlines()[-1])}
        assert 0 < result['memory']['peakBytes'] <= 805306368
        s.stop_owned_cli(name,owner)
        started = False
        assert s.snapshot(database) == before and s.sha(database) == before_bytes
        result.update({'status':'PASSED_STARTUP_API_SUPPLEMENT','startupAndProbeChanges':0,
            'databaseBytesPreserved':True,'databaseSha256':before_bytes,'completedUtc':s.utc()})
    except BaseException as error:
        result.update({'status':'FAILED_STARTUP_API_SUPPLEMENT','error':str(error)})
        if started:
            s.stop_owned_cli(name,owner)
        raise
    finally:
        with (ROOT/'supplement-receipt.json').open('x') as output:
            json.dump(result,output,indent=2)
        (ROOT/'supplement-receipt.json').chmod(0o400)
        print(json.dumps({'status':result['status'],'receiptSha256':s.sha(ROOT/'supplement-receipt.json'),
            'memory':result.get('memory'),'error':result.get('error')}),flush=True)
