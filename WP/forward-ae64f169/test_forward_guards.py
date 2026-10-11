import ast, copy, json, pathlib, sqlite3, tempfile, unittest
from unittest.mock import patch
import startup_common as c
import gates

def container():
    return {'Name':'/owned-proof','Image':c.IMAGE,'State':{'Running':True,'OOMKilled':False},
        'RestartCount':0,'HostConfig':{'Memory':c.LIMIT},'Config':{'Env':[
            'NODE_OPTIONS=','ALLOW_PRISMA_DB_PUSH=false','ALLOW_AUTO_SEED=false','DISABLE_BACKGROUND_JOBS=true']}}

class ForwardGuards(unittest.TestCase):
    def test_wall_clock_not_poll_count(self):
        c.deadline_guard(100,699.99)
        for now in [99,700,701]:
            with self.assertRaises(AssertionError):c.deadline_guard(100,now)
    def test_exited_aborts(self):
        item=container();item['State']['Running']=False
        with self.assertRaises(AssertionError):c.state_guard(item,False)
    def test_restart_aborts(self):
        item=container();item['RestartCount']=1
        with self.assertRaises(AssertionError):c.state_guard(item,False)
    def test_oom_aborts(self):
        item=container();item['State']['OOMKilled']=True
        with self.assertRaises(AssertionError):c.state_guard(item,False)
    def test_image_memory_heap_and_jobs_pinned(self):
        c.state_guard(container(),False)
        for location,key,value in [(None,'Image','old'),('HostConfig','Memory',c.LIMIT+1)]:
            item=container();(item[location] if location else item)[key]=value
            with self.assertRaises(AssertionError):c.state_guard(item,False)
        for env in ['NODE_OPTIONS=--max-old-space-size=2000','ALLOW_AUTO_SEED=true','DISABLE_BACKGROUND_JOBS=false']:
            item=container();key=env.split('=')[0];item['Config']['Env']=[x for x in item['Config']['Env'] if not x.startswith(key+'=')]+[env]
            with self.assertRaises(AssertionError):c.state_guard(item,False)
    def test_entrypoint_all_22_noops(self):
        rows=[{'mode':'NO_OP','totalChanges':0,'classification':'COMPLETE'} for _ in range(22)]
        log='\n'.join(json.dumps(x) for x in rows)+'\nStarting SoilFER-LIMS...\n'+json.dumps({'totalChanges':9})
        self.assertEqual(len(c.entrypoint_zero(log)),22)
        for changed in [rows[:-1],rows+[rows[0]],[dict(x,totalChanges=1) if i==10 else x for i,x in enumerate(rows)]]:
            with self.assertRaises(AssertionError):c.entrypoint_zero('\n'.join(json.dumps(x) for x in changed)+'\nStarting SoilFER-LIMS...')
    def test_database_write_detected_during_wait(self):
        with tempfile.TemporaryDirectory() as folder:
            file=pathlib.Path(folder)/'data.db'
            with sqlite3.connect(file) as db:db.execute('CREATE TABLE test(value)')
            watch=c.ZeroWriteWatch(file)
            try:
                watch.check()
                with sqlite3.connect(file) as db:db.execute('INSERT INTO test VALUES (1)')
                with self.assertRaises(AssertionError):watch.check()
            finally:watch.close()
    def test_stopped_immutable_backup_does_not_create_sidecars(self):
        with tempfile.TemporaryDirectory() as folder:
            file=pathlib.Path(folder)/'data.db'
            with sqlite3.connect(file) as db:
                db.execute('PRAGMA journal_mode=WAL');db.execute('CREATE TABLE test(value)')
            db.close()
            before=c.s.physical(file)
            self.assertIsNone(before['-wal']);self.assertIsNone(before['-shm'])
            c.s.consistent_backup(file,pathlib.Path(folder)/'backup.db',immutable=True)
            self.assertEqual(c.s.physical(file),before)
    def test_500mb_unexplained_drop(self):
        c.s.check_drop({'x':1000000000},{'x':500000000},{'x':0})
        with self.assertRaises(AssertionError):c.s.check_drop({'x':1000000000},{'x':499999999},{'x':0})
    def test_main_db_and_wal_preservation(self):
        expected={'':{'sha256':'abc','bytes':1}}
        for files in [dict(expected,**{'-wal':None,'-shm':None}),dict(expected,**{'-wal':{'bytes':0},'-shm':{'bytes':32768}})]:
            with patch.object(c.s,'physical',return_value=files):c.main_bytes('unused',expected)
        for files in [{'':{'sha256':'different','bytes':1},'-wal':None},{**expected,'-wal':{'bytes':1}}]:
            with patch.object(c.s,'physical',return_value=files):
                with self.assertRaises(AssertionError):c.main_bytes('unused',expected)
    def test_no_separate_installer_or_restore_calls(self):
        root=pathlib.Path(__file__).parent
        forbidden={'cli','install_series','repeat_series','verify_legacy','start_app'}
        for name in ['startup-forward.py','rehearse-forward.py','startup_common.py','prepare_forward.py']:
            tree=ast.parse((root/name).read_text())
            calls=[n.func.attr for n in ast.walk(tree) if isinstance(n,ast.Call) and isinstance(n.func,ast.Attribute)]
            self.assertFalse(forbidden.intersection(calls),name)
            text=(root/name).read_text()
            for token in ['docker\',\'rm','docker\',\'prune','s.OLD_IMAGE','shutil.copyfile(backup','--entrypoint']:
                self.assertNotIn(token,text)
    def test_real_entrypoint_and_same_readiness_for_both(self):
        root=pathlib.Path(__file__).parent
        for file in ['startup-forward.py','rehearse-forward.py']:
            text=(root/file).read_text();self.assertIn('c.start_and_wait(',text)
        text=(root/'startup_common.py').read_text()
        self.assertIn('deadline_guard(start,time.monotonic())',text)
        self.assertNotIn('range(90)',text);self.assertNotIn('--entrypoint',text)
    def test_changed_full_state_aborts(self):
        with patch.object(c.s,'snapshot',return_value={'tables':'changed'}):
            with self.assertRaises(AssertionError):c.exact_state('unused',{'tables':'original'})
    def test_owned_jobs_allow_only_two_clock_fields(self):
        with tempfile.TemporaryDirectory() as folder:
            file=pathlib.Path(folder)/'data.db'
            with sqlite3.connect(file) as db:
                db.execute('CREATE TABLE KoboConfig(id TEXT PRIMARY KEY,apiToken TEXT,lastSubmissionId TEXT,lastSyncAt INT,updatedAt INT)')
                db.execute('INSERT INTO KoboConfig VALUES (?,?,?,?,?)',('one','fixture-private-token','unchanged',1,1))
            pin=c.kobo_baseline(file);self.assertNotIn('fixture-private-token',json.dumps(pin))
            expected={'tables':{'KoboConfig':{'count':1,'sha256':'before'},'Result':{'count':1,'sha256':'protected'}}}
            with sqlite3.connect(file) as db:db.execute('UPDATE KoboConfig SET lastSyncAt=2,updatedAt=2')
            actual=copy.deepcopy(expected);actual['tables']['KoboConfig']['sha256']='clock-changed'
            with patch.object(c.s,'snapshot',return_value=actual):
                changed=c.jobs_copy_state(file,expected,pin);self.assertEqual(changed['changedClockRows'],[{'id':'one','fields':['lastSyncAt','updatedAt']}])
            with sqlite3.connect(file) as db:db.execute("UPDATE KoboConfig SET lastSubmissionId='new'")
            with patch.object(c.s,'snapshot',return_value=copy.deepcopy(expected)):
                with self.assertRaises(AssertionError):c.jobs_copy_state(file,expected,pin)
    def test_owned_jobs_refuse_other_table_changes(self):
        pin={'count':1,'fields':['id'],'sha256':'same','clocks':{'one':{'lastSyncAt':1,'updatedAt':1}}}
        expected={'tables':{'KoboConfig':{'count':1,'sha256':'same'},'Result':{'count':1,'sha256':'protected'}}}
        actual=copy.deepcopy(expected);actual['tables']['Result']['sha256']='changed'
        with patch.object(c.s,'snapshot',return_value=actual),patch.object(c,'kobo_baseline',return_value=pin):
            with self.assertRaises(AssertionError):c.jobs_copy_state('unused',expected,pin)
    def test_owned_jobs_refuse_added_kobo_row(self):
        pin={'count':1,'fields':['id'],'sha256':'same','clocks':{'one':{'lastSyncAt':1,'updatedAt':1}}}
        changed=dict(pin,count=2)
        with patch.object(c.s,'snapshot',return_value={'tables':{}}),patch.object(c,'kobo_baseline',return_value=changed):
            with self.assertRaises(AssertionError):c.jobs_copy_state('unused',{},pin)

if __name__=='__main__':unittest.main()
