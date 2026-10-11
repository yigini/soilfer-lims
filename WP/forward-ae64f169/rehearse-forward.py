"""One fresh owned post-#205 copy; real default entrypoint, no separate installers."""
import fcntl, json, pathlib, shutil, signal, sys, tarfile, time
import release_support as s
import startup_common as c

ROOT=pathlib.Path(__file__).resolve().parent

def main():
    assert sys.argv[1:]==['--owned-post205-copy']
    assert ROOT.parent==pathlib.Path('/opt/lims/releases') and ROOT.name.startswith('forward-ae64f169-proof-')
    assert not (ROOT/'rehearsal-receipt.json').exists(), 'Never replay a proof'
    lock=open('/opt/lims/apply.lock','a');fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
    receipt={'status':'IN_PROGRESS','head':s.HEAD,'image':c.IMAGE,'startedUtc':s.utc(),
        'originalFailureReceiptSha256':c.FAILURE_SHA,'deadlineSeconds':600,'separateInstallerCommands':0,
        'sourceFiles':{p.name:s.sha(p) for p in ROOT.iterdir() if p.suffix in ['.py','.cjs']}}
    names=[];watch=None
    def interrupted(signum,frame):raise RuntimeError('Interrupted '+str(signum))
    for sig in [signal.SIGTERM,signal.SIGINT,signal.SIGHUP]:signal.signal(sig,interrupted)
    try:
        c.writers_stopped();failed,physical=c.held_state();c.image_check()
        assert not c.inspect('soilfer-lims')['State']['Running'] and 'R=503' in s.CONF.read_text()
        baseline=s.snapshot(s.LIVE);c.write_new(ROOT/'protected-state.json',baseline)
        assets=sum(f.stat().st_size for f in s.ASSETS.rglob('*') if f.is_file())
        reserve=max(c.MIN_HEADROOM,s.disk_reserve(s.LIVE.stat().st_size,413546358,assets))
        assert min(s.disk_free().values())>=reserve+2*s.LIVE.stat().st_size+assets+268435456
        guard=c.DiskGuard(ROOT,reserve)
        database_dir=ROOT/'database';database_dir.mkdir();assets_dir=ROOT/'assets';assets_dir.mkdir()
        s.consistent_backup(s.LIVE,database_dir/'dev.db');(database_dir/'dev.db').chmod(0o600)
        shutil.copytree(s.ASSETS,assets_dir,dirs_exist_ok=True)
        c.exact_state(database_dir/'dev.db',baseline)
        owned_before=s.physical(database_dir/'dev.db');assert owned_before['-wal'] is None and owned_before['-shm'] is None
        receipt.update({'productionStoppedPhysical':physical,'logicalStateSha256':c.digest(baseline),
            'protectedStateSha256':s.sha(ROOT/'protected-state.json'),'protectedTableCount':len(baseline['tables']),
            'protectedReceiptCount':baseline['tables']['_schema_migrations']['count'],'ownedBefore':owned_before,
            'diskReserveRequiredBytes':reserve,'originalPreservation':failed['preservation']})
        # Prove both the held start and the jobs-on start with exactly the shared
        # production function, bridge network, published loopback port and env.
        for jobs in [False,True]:
            stage='jobs-on' if jobs else 'jobs-off';name='lims-owned-'+ROOT.name+'-'+stage
            names.append(name);watch=c.ZeroWriteWatch(database_dir/'dev.db')
            receipt[stage+'Readiness']=c.start_and_wait(ROOT,name,database_dir,assets_dir,guard,stage,watch,jobs=jobs)
            receipt[stage+'Checks']=c.startup_checks(ROOT,name,database_dir/'dev.db',baseline,stage)
            watch.check()
            if not jobs:receipt.update(c.probes(ROOT,name,database_dir/'dev.db',baseline));watch.check()
            c.owned_stop(ROOT,name,stage+'-stop');watch.close();watch=None
            c.exact_state(database_dir/'dev.db',baseline)
            assert s.physical(database_dir/'dev.db')['']==owned_before[''], 'Owned main DB bytes changed'
            guard.check()
        c.writers_stopped();assert s.physical(s.LIVE)==physical
        assert s.sha(c.ORIGIN/'production-receipt.json')==c.FAILURE_SHA
        receipt.update({'status':'PASSED_FORWARD_STARTUP','completedUtc':s.utc(),'databaseChanges':0,
            'ownedMainBytesPreserved':True,'productionFilesUntouched':True,'freeBytesAfter':s.disk_free()})
    except BaseException as error:
        receipt.update({'status':'FAILED_FORWARD_PROOF','error':str(error),'completedUtc':s.utc()})
        for name in names:
            try:c.owned_stop(ROOT,name,'failure-stop-'+name[-8:])
            except BaseException as stop_error:receipt.setdefault('stopErrors',[]).append(str(stop_error))
    finally:
        if watch:watch.close()
        c.write_new(ROOT/'rehearsal-receipt.json',receipt)
    print(json.dumps({'status':receipt['status'],'receiptSha256':s.sha(ROOT/'rehearsal-receipt.json')}),flush=True)
    return 0 if receipt['status']=='PASSED_FORWARD_STARTUP' else 1

if __name__=='__main__':sys.exit(main())
