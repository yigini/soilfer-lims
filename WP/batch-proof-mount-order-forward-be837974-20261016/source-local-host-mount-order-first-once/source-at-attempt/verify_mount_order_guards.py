"""Actual call/stop_exact with a closed stand-in Docker; never a real daemon.

Mount objects are the full public retained C2 objects, with only owned paths,
generated name and owner label adapted to the genuinely new attempt root.
"""
import ast,copy,itertools,json,os,pathlib,subprocess,unittest
from unittest import mock
import stop_owned as stop
import provenance_privacy as privacy
import controller_guard as controller
from proof_contract import ROOT,sha,canonical,attempt_authorities,ATTEMPT_AUTHORITY_PINS
B=pathlib.Path(__file__).parent
ORDERS=list(itertools.permutations(range(3)))
CASE=0

def public_fixtures():
    data=json.loads((B/'real-mount-fixtures.json').read_bytes());result={}
    for id,pin in data['owners'].items():
        label=pin['labels'][stop.LABEL].rsplit(':',1)[1];owner=str(ROOT)+':'+label
        mounts=copy.deepcopy(pin['mounts'])
        for mount in mounts:
            mount['Source']=str(ROOT)+mount['Source'][len(data['oldRoot']):]
        result[id]={'Id':id,'Name':'/lims-owned-batch-'+sha(owner.encode())[:24],'Image':pin['image'],'Config':{'Labels':{**pin['labels'],stop.LABEL:owner},'Env':['JWT_SECRET=SYNTHETIC_PRIVATE_SENTINEL']},'HostConfig':{'RestartPolicy':{'Name':'no'}},'State':{'Running':False,'StartedAt':pin['startedAt']},'Mounts':mounts}
    assert {v['Config']['Labels'][stop.LABEL] for v in result.values()}==stop.OWNERS
    return result

class ActualCallGuards(unittest.TestCase):
    def exercise(self,target=0,before_order=(0,1,2),after_order=(2,0,1),mutate=None,running=False,stop_failure=False,noise=False,timeout=False):
        global CASE
        CASE+=1;root=pathlib.Path(os.environ['LIMS_PROOF_GUARD_FIXTURE_DIR']).with_name(pathlib.Path(os.environ['LIMS_PROOF_GUARD_FIXTURE_DIR']).name+'-rotate')
        root.mkdir(exist_ok=True);root=root/str(CASE);root.mkdir()
        rows=public_fixtures();ids=sorted(rows,key=lambda id:rows[id]['Config']['Labels'][stop.LABEL]);chosen=ids[target]
        owners={v['Config']['Labels'][stop.LABEL]:id for id,v in rows.items()};running_now={id:running for id in ids};inspects={id:0 for id in ids};seen=[]
        def stand_in(args,stdout,stderr,timeout):
            seen.append(args);self.assertEqual(timeout,30)
            if args[1]=='ps':raw=(owners[args[-1].split('=',2)[2]]+'\n').encode()
            elif args[1]=='stop':
                self.assertEqual(args[2:4],['-t','10'])
                if stop_failure and args[-1]==chosen:return subprocess.CompletedProcess(args,1)
                running_now[args[-1]]=False;raw=(args[-1]+'\n').encode()
            elif args[1]=='inspect':
                id=args[-1];v=copy.deepcopy(rows[id]);inspects[id]+=1;v['State']['Running']=running_now[id]
                order=(before_order if inspects[id]==1 else after_order) if id==chosen else ((0,1,2) if inspects[id]==1 else (1,2,0))
                v['Mounts']=[v['Mounts'][i] for i in order]
                if id==chosen and inspects[id]==2 and mutate is not None:mutate(v)
                raw=canonical([v])
            else:raise AssertionError('Unexpected stand-in command')
            stdout.write(raw)
            if noise:stderr.write(b'SYNTHETIC_PRIVATE_WARNING')
            if timeout:raise subprocess.TimeoutExpired(args,30)
            return subprocess.CompletedProcess(args,0)
        # Neither call nor stop_exact nor selected is patched. Only the external
        # Docker process is replaced. Real exclusive files, fsync, hashes, bounds,
        # parsing, predicates, phase tracking and both-owner loop all execute.
        with mock.patch.object(stop,'_record_root',None),mock.patch.object(stop,'_sequence',0),mock.patch.object(stop.subprocess,'run',stand_in):
            stop.configure_records(root);value=stop.stop_exact();public=stop.public_result(value)
        records=[json.loads(p.read_bytes()) for p in sorted(root.glob('docker-call-*.json'))]
        self.assertEqual(len(records),len(seen))
        for record,args in zip(records,seen):
            self.assertEqual(record['argv'],args)
            for stream,pin in record['streams'].items():
                path=root/pin['path'];raw=path.read_bytes();self.assertEqual((len(raw),sha(raw)),(pin['bytes'],pin['sha256']));self.assertTrue(pin['hostOnly'])
                if os.name!='nt':self.assertEqual(path.stat().st_mode&0o777,0o400)
            self.assertNotIn('SYNTHETIC_PRIVATE',json.dumps(record))
        self.assertNotIn('SYNTHETIC_PRIVATE',json.dumps(public))
        return value,seen,records,root

    def test_running_owners_stop_through_real_call_then_rotating_inspect_passes(self):
        value,seen,records,root=self.exercise(running=True)
        self.assertTrue(value['allExactOwnedStopped']);self.assertEqual(len(value['stoppedAndRetained']),2)
        self.assertEqual([a[1] for a in seen],['ps','inspect','stop','inspect']*2)
        self.assertEqual(len(records),8)

    def test_one_stop_error_does_not_block_other_exact_owner(self):
        value,seen,records,root=self.exercise(running=True,stop_failure=True)
        self.assertFalse(value['allExactOwnedStopped']);self.assertEqual(len(value['stoppedAndRetained']),1)
        self.assertEqual([e['phase'] for e in value['errors']],['stop']);self.assertEqual(sum(a[1]=='stop' for a in seen),2)

    def test_private_stderr_retained_before_refusal_for_both_owners(self):
        value,seen,records,root=self.exercise(noise=True)
        self.assertFalse(value['allExactOwnedStopped']);self.assertEqual([e['phase'] for e in value['errors']],['inventory']*2)
        self.assertTrue(all(r['streams']['stderr']['bytes']>0 for r in records))

    def test_timeout_retains_metadata_before_each_refusal(self):
        # Separate external failure stand-in keeps the actual call() timeout path.
        root=pathlib.Path(os.environ['LIMS_PROOF_GUARD_FIXTURE_DIR']).with_name(pathlib.Path(os.environ['LIMS_PROOF_GUARD_FIXTURE_DIR']).name+'-timeout');root.mkdir()
        def fail(args,stdout,stderr,timeout):stdout.write(b'private');raise subprocess.TimeoutExpired(args,timeout)
        with mock.patch.object(stop,'_record_root',root),mock.patch.object(stop,'_sequence',0),mock.patch.object(stop.subprocess,'run',fail):value=stop.stop_exact()
        self.assertEqual([e['phase'] for e in value['errors']],['inventory']*2)
        self.assertEqual(len(list(root.glob('docker-call-*.json'))),2)

def permutation_case(target,before,after):
    def test(self):
        value,seen,records,root=self.exercise(target,before,after)
        self.assertTrue(value['allExactOwnedStopped']);self.assertEqual(len(value['stoppedAndRetained']),2)
        self.assertEqual([a[1] for a in seen],['ps','inspect','inspect']*2)
        for row in value['stoppedAndRetained']:
            self.assertEqual(row['before']['mounts'],row['after']['mounts'])
            self.assertEqual([m['Destination'] for m in row['after']['mounts']],sorted(m['Destination'] for m in row['after']['mounts']))
    return test
for target in range(2):
    for i,before in enumerate(ORDERS):
        for j,after in enumerate(ORDERS):setattr(ActualCallGuards,'test_orders_owner'+str(target+1)+'_'+str(i)+'_'+str(j),permutation_case(target,before,after))

def refusal_case(target,mutate):
    def test(self):
        value,seen,records,root=self.exercise(target=target,mutate=mutate)
        self.assertFalse(value['allExactOwnedStopped']);self.assertEqual(len(value['errors']),1);self.assertEqual(len(value['stoppedAndRetained']),1)
    return test
for target in range(2):
    for index in range(3):
        for field in ['Destination','Mode','Propagation','RW','Source','Type']:
            def change(v,index=index,field=field):
                mount=v['Mounts'][index];mount[field]=not mount[field] if type(mount[field]) is bool else mount[field]+'-CHANGED'
            setattr(ActualCallGuards,'test_refuse_owner'+str(target+1)+'_mount'+str(index)+'_'+field,refusal_case(target,change))
    for name,fn in [
        ('missing',lambda v:v['Mounts'].pop()),
        ('extra',lambda v:v['Mounts'].append({**v['Mounts'][0],'Destination':'/extra'})),
        ('duplicate_destination',lambda v:v['Mounts'].__setitem__(1,copy.deepcopy(v['Mounts'][0]))),
        ('unknown_full_object_key_added',lambda v:v['Mounts'][0].update(NewKey='changed')),
        ('full_object_key_removed',lambda v:v['Mounts'][0].pop('Propagation')),
        ('id',lambda v:v.update(Id='0'*64)),('name',lambda v:v.update(Name='/foreign')),('image',lambda v:v.update(Image='sha256:'+'0'*64)),
        ('owner',lambda v:v['Config']['Labels'].update({stop.LABEL:'foreign'})),('startedAt',lambda v:v['State'].update(StartedAt='changed')),
        ('still_running',lambda v:v['State'].update(Running=True)),('restart_policy',lambda v:v['HostConfig']['RestartPolicy'].update(Name='always'))]:
        setattr(ActualCallGuards,'test_refuse_owner'+str(target+1)+'_'+name,refusal_case(target,fn))

class ForwardBindingGuards(unittest.TestCase):
    def test_actual_both_prechecks_acceptance_and_063000_scope_bound(self):
        values=json.loads((B/'new-authority-fixtures/attempt-directions.json').read_bytes());attempt_authorities(values)
        self.assertEqual(values['6210719791']['body'],json.loads((B/'accepted-prechecks-original.json').read_bytes())['body'])
    def test_changed_acceptance_refuses(self):
        values=json.loads((B/'new-authority-fixtures/attempt-directions.json').read_bytes());values['6210719791']['body']+='changed'
        with self.assertRaises(RuntimeError):attempt_authorities(values)
    def test_missing_acceptance_refuses(self):
        with self.assertRaises(RuntimeError):attempt_authorities({})
    def test_actual_bound_writer_output_is_exact16_through_full_pairing(self):
        import verify_provenance_guards as prior
        result=json.loads(os.environ['LIMS_ACTUAL_WRITER_PROBE_JSON'])
        self.assertEqual(result['producer'],'ACTUAL_LOCAL_NODE_UNPATCHED_BOUND_CONTROLLER');self.assertTrue(result['sourceUnpatched'])
        self.assertEqual(result['sourceSha256'],sha((B/'writer-controller-original.js').read_bytes()))
        f=prior.fixture();prior.edit_metadata(f,lambda m:m['conflictingSubmissions'][0].update(evidenceFingerprint=result['fingerprint']))
        self.assertEqual(prior.verify(f)['changedSamples'][0]['classification'],'CROSS_SUBMISSION_DUPLICATE')
    def test_memory_stat_anon_file_are_retained_and_observation_only(self):
        import verify_provenance_guards as prior
        reads=[];value=controller.own_snapshot(prior.OwnUnitGuards().raw(),evidence=lambda p,b:reads.append((p,b)))
        self.assertEqual(value['memoryStat'],{'anon':123,'file':456});self.assertEqual(len(reads),8)
        self.assertTrue(value['peakMaxHighObservationOnly'])
    def test_memory_stat_missing_or_duplicate_is_refused_after_raw_retention(self):
        import verify_provenance_guards as prior
        for raw in [b'anon 1\n',b'anon 1\nfile 2\nfile 3\n',b'anon -1\nfile 2\n']:
            original=prior.OwnUnitGuards().raw();reads=[]
            def read(path):return raw if path.endswith('/memory.stat') else original(path)
            with self.assertRaises(RuntimeError):controller.own_snapshot(read,evidence=lambda p,b:reads.append((p,b)))
            self.assertEqual(len(reads),8)
    def test_whole_runtime_equality_inventory_is_complete(self):
        sweep=json.loads((B/'map-array-sweep.json').read_bytes());actual=[]
        from proof_contract import FILES
        for name in sorted(FILES):
            if not name.endswith('.py') or name.startswith('verify') or name=='provenance_privacy.py':continue
            for node in ast.walk(ast.parse((B/name).read_bytes())):
                if isinstance(node,ast.Compare) and any(isinstance(op,(ast.Eq,ast.NotEq)) for op in node.ops):actual.append({'file':name,'line':node.lineno,'expression':ast.unparse(node)})
        self.assertEqual(sweep['allRuntimeEqualityComparisons'],actual)

def bad_fingerprint(value):
    def test(self):
        import verify_provenance_guards as prior
        f=prior.fixture();prior.edit_metadata(f,lambda m:m['conflictingSubmissions'][0].update(evidenceFingerprint=value))
        with self.assertRaisesRegex(RuntimeError,'Conflict evidence identity/time malformed'):prior.verify(f)
    return test
for name,value in [('64hex','f'*64),('uppercase','F'*16),('15chars','f'*15),('17chars','f'*17),('nonstring',123)]:setattr(ForwardBindingGuards,'test_refuse_fingerprint_'+name,bad_fingerprint(value))
