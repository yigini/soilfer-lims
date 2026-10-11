"""Separately reviewed forward startup from the installed FAILED_FORWARD_HOLD."""
import fcntl, json, os, pathlib, signal, subprocess, sys, tarfile, time
import release_support as s
import startup_common as c
import gates

ROOT=pathlib.Path(__file__).resolve().parent

def main():
    assert sys.argv[1:]==['--execute-new-forward-gate']
    assert ROOT.parent==pathlib.Path('/opt/lims/releases') and ROOT.name.startswith('forward-ae64f169-release-')
    assert not (ROOT/'production-receipt.json').exists() and not (ROOT/'production-receipt.in-progress').exists(), 'Never replay a forward execution'
    lock=open('/opt/lims/apply.lock','a');fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
    receipt={'status':'FORWARD_IN_PROGRESS','head':s.HEAD,'image':c.IMAGE,'timesUtc':{},'separateInstallerCommands':0,
        'originalFailureReceiptSha256':c.FAILURE_SHA,'originalExecutionRoot':str(c.ORIGIN)}
    owned=False;watch=None
    def save():
        temporary=ROOT/'production-receipt.in-progress';temporary.write_text(json.dumps(receipt,indent=2))
        os.replace(temporary,ROOT/'production-receipt.json')
    def mark(event):
        receipt['timesUtc'][event]=s.utc();save();print(event+' '+receipt['timesUtc'][event],flush=True)
    def http(path,code,label,method='GET'):
        r=s.command(ROOT,['curl','-sS','--max-time','15','-o',str(ROOT/(label+'.body')),
            '-w','%{http_code}','-X',method,'https://lims.yigini.net'+path],label)
        assert r.stdout==str(code), label+' returned '+r.stdout
    def hold():
        s.CONF.write_bytes((ROOT/'apache-held.conf').read_bytes())
        stamp=str(time.time_ns());s.command(ROOT,['apachectl','configtest'],'hold-test-'+stamp)
        s.command(ROOT,['systemctl','reload','httpd'],'hold-reload-'+stamp)
    def interrupted(sig,frame):raise RuntimeError('Forward run interrupted '+str(sig))
    for sig in [signal.SIGTERM,signal.SIGINT,signal.SIGHUP]:signal.signal(sig,interrupted)
    try:
        manifest=json.loads((ROOT/'prepared-manifest.json').read_bytes());gate=json.loads((ROOT/'production-gate.json').read_bytes())
        gates.verify(ROOT,manifest,gate);c.image_check();c.writers_stopped()
        prior=c.inspect('soilfer-lims');assert not prior['State']['Running'] and prior['Image']==c.IMAGE
        assert s.sha(s.CONF)==manifest['files']['apache-held.conf'] and 'R=503' in s.CONF.read_text()
        failed,physical=c.held_state();assert physical==manifest['productionStoppedPhysical']
        expected=json.loads((ROOT/'protected-state.json').read_bytes())
        assert c.digest(expected)==manifest['logicalStateSha256'] and len(expected['tables'])==104
        c.exact_state(s.LIVE,expected,immutable=True)
        assets=sum(f.stat().st_size for f in s.ASSETS.rglob('*') if f.is_file())
        reserve=max(c.MIN_HEADROOM,s.disk_reserve(s.LIVE.stat().st_size,413546358,assets))
        assert min(s.disk_free().values())>=reserve+s.LIVE.stat().st_size+assets+268435456
        guard=c.DiskGuard(ROOT,reserve)
        receipt.update({'manifestSha256':s.sha(ROOT/'prepared-manifest.json'),'coordinatorSha256':s.sha(__file__),
            'sharedReadinessSha256':s.sha(ROOT/'startup_common.py'),'rehearsalReceiptSha256':manifest['files']['rehearsal-receipt.json'],
            'githubGate':gate,'diskReserveRequiredBytes':reserve,'freeBytesBefore':s.disk_free(),
            'protectedStateSha256':manifest['files']['protected-state.json'],'logicalStateSha256':c.digest(expected),
            'protectedTableCount':104,'protectedReceiptCount':expected['tables']['_schema_migrations']['count'],
            'startDatabaseFiles':physical,'originalPreservation':failed['preservation']})
        for path,method in [('/api/health','GET'),('/ws','GET'),('/api/v2/data-exchange/receipts','POST')]:
            http(path,503,'preflight-held-'+method+'-'+path.strip('/').replace('/','-'),method)
        mark('reviewedForwardPreflightPassed')
        backup=ROOT/'dev-installed-stopped-backup.db';s.consistent_backup(s.LIVE,backup,immutable=True)
        c.exact_state(backup,expected,immutable=True);assert s.physical(s.LIVE)==physical
        with tarfile.open(ROOT/'assets-installed-backup.tar.gz','x:gz') as archive:archive.add(s.ASSETS,arcname='uploads')
        (ROOT/'assets-installed-backup.tar.gz').chmod(0o400)
        receipt['backupSha256']=s.sha(backup);receipt['assetsBackupSha256']=s.sha(ROOT/'assets-installed-backup.tar.gz')
        guard.check();c.writers_stopped();mark('installedStoppedBackupVerified')
        gates.verify(ROOT,manifest,gate)
        retained='soilfer-lims-failed-'+ROOT.name
        s.command(ROOT,['docker','rename','soilfer-lims',retained],'retain-original-failed-container')
        receipt['originalFailedContainerRetainedAs']=retained
        watch=c.ZeroWriteWatch(s.LIVE);owned=True
        receipt['jobsOffReadiness']=c.start_and_wait(ROOT,'soilfer-lims',s.LIVE.parent,s.ASSETS,guard,'jobs-off',watch,production=True)
        receipt['jobsOffChecks']=c.startup_checks(ROOT,'soilfer-lims',s.LIVE,expected,'jobs-off');watch.check();guard.check()
        c.main_bytes(s.LIVE,physical);mark('candidateHealthyJobsOff')
        receipt.update(c.probes(ROOT,'soilfer-lims',s.LIVE,expected));watch.check();guard.check();c.main_bytes(s.LIVE,physical)
        mark('readOnlyChecksPassed')
        # Ingress reopens while jobs are OFF. The subsequent same-image jobs-on
        # recreation was rehearsed with exactly the same readiness function.
        s.CONF.write_bytes((ROOT/'apache-before.conf').read_bytes())
        s.command(ROOT,['apachectl','configtest'],'reopen-configtest');s.command(ROOT,['systemctl','reload','httpd'],'reopen-reload')
        http('/api/health',200,'reopen-health');http('/api/v2/data-exchange/receipts',401,'reopen-denied-post','POST')
        mark('ingressReopenedJobsOff')
        c.owned_stop(ROOT,'soilfer-lims','jobs-off-stop');watch.close();watch=None
        c.exact_state(s.LIVE,expected);c.main_bytes(s.LIVE,physical);c.writers_stopped()
        held_name='soilfer-lims-jobs-off-'+ROOT.name
        s.command(ROOT,['docker','rename','soilfer-lims',held_name],'retain-jobs-off-container')
        receipt['jobsOffContainerRetainedAs']=held_name
        watch=c.ZeroWriteWatch(s.LIVE)
        receipt['jobsOnReadiness']=c.start_and_wait(ROOT,'soilfer-lims',s.LIVE.parent,s.ASSETS,guard,'jobs-on',watch,jobs=True,production=True)
        receipt['jobsOnChecks']=c.startup_checks(ROOT,'soilfer-lims',s.LIVE,expected,'jobs-on');watch.check();guard.check()
        c.main_bytes(s.LIVE,physical);mark('jobsReopened')
        http('/api/health',200,'production-health');http('/api/v2/data-exchange/receipts',401,'production-denied-post','POST')
        http('/login',200,'production-login');watch.check();c.state_guard(c.inspect('soilfer-lims'),True)
        receipt['retainedAcceptance']=s.verify_retained_acceptance(s.LIVE.parent)
        assert s.sha(c.ORIGIN/'production-receipt.json')==c.FAILURE_SHA
        receipt.update({'status':'DEPLOYED_FORWARD','databaseChanges':0,'mainDatabaseBytesPreserved':True,
            'finalDatabaseFiles':c.main_bytes(s.LIVE,physical),'freeBytesAfter':s.disk_free()})
        mark('completed');(ROOT/'production-receipt.json').chmod(0o400)
        print(json.dumps({'status':receipt['status'],'head':s.HEAD,'image':c.IMAGE,
            'receiptSha256':s.sha(ROOT/'production-receipt.json')}),flush=True);return 0
    except BaseException as error:
        receipt.update({'status':'FAILED_FORWARD_HOLD','error':str(error)})
        if owned:
            for action in [hold,lambda:c.owned_stop(ROOT,'soilfer-lims','failed-forward-stop')]:
                try:action()
                except BaseException as failure:receipt.setdefault('holdErrors',[]).append(str(failure))
        receipt['timesUtc']['failed']=s.utc();save();(ROOT/'production-receipt.json').chmod(0o400)
        print(json.dumps({'status':receipt['status'],'error':str(error),'receiptSha256':s.sha(ROOT/'production-receipt.json')}),flush=True)
        return 1
    finally:
        if watch:watch.close()

if __name__=='__main__':sys.exit(main())
