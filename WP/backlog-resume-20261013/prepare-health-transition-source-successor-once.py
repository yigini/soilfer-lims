"""SOURCE ONLY: clone frozen054 graph and implement actual6188190365 direction."""
import ast,hashlib,json,pathlib,shutil
REPO=pathlib.Path(__file__).resolve().parents[2];OLD=REPO/'WP/batch-proof-startup-forward-cde8-20261015';NEW=REPO/'WP/batch-proof-health-transitions-cde8-20261015';assert not NEW.exists();NEW.mkdir()
names=sorted(p.name for p in OLD.glob('*.py'));assert len(names)==12
for n in names:(NEW/n).write_bytes((OLD/n).read_bytes())
for n in ['compose-source.yml','declared-copy-budget-table.json','bound-prior-evidence-index-complete20.json']:(NEW/n).write_bytes((OLD/n).read_bytes())
shutil.copytree(OLD/'bound-input-records',NEW/'bound-input-records')
def edit(n,fn):p=NEW/n;p.write_text(fn(p.read_text(encoding='utf8')),encoding='utf8',newline='\n')
edit('proof_contract.py',lambda s:s.replace('T090000Z','T100000Z').replace('FORWARD_DIRECTION=6187223904','FORWARD_DIRECTION=6188190365').replace("review.get('id',0)>6187223904","review.get('id',0)>6188190365").replace('2026-10-15T07:50:16Z','2026-10-15T08:47:44Z').replace("'unhealthyImmediateStop=true'","'unhealthyIsRetainedObservation=true','healthEveryPollFullLog0400=true','healthTransitionTimingInResult=true','composeStartPeriodUnchanged=true','allHttpProbesWithinTotal600Seconds=true'"))
edit('prepare_proof.py',lambda s:s.replace('WP/batch-proof-startup-forward-cde8-20261015/','WP/batch-proof-health-transitions-cde8-20261015/'))
edit('proof_health.py',lambda s:s.replace("    require(status!='unhealthy','Unhealthy: immediate readiness STOP')\n",''))
with (NEW/'proof_health.py').open('a',encoding='utf8',newline='\n') as f:f.write('''

class HealthHistory:
    """Every poll is immutable evidence; timestamps are not readiness authority."""
    def __init__(self,root,label,began):
        self.root=pathlib.Path(root);self.label=label;self.began=began
        self.last_time=began;self.last_status=None;self.unhealthy_seconds=0.0
        self.first_healthy=None;self.polls=[];self.transitions=[]
    def observe(self,obj,now):
        from proof_files import write_new
        import datetime
        require(now>=self.last_time,'Health monotonic clock moved backwards')
        if self.last_status=='unhealthy':self.unhealthy_seconds+=now-self.last_time
        state=obj.get('State',{});health=state.get('Health');status=health.get('Status') if isinstance(health,dict) else None
        record={'observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'elapsedSeconds':now-self.began,'status':status,'state':state,'healthcheck':obj.get('Config',{}).get('Healthcheck'),'previousStatus':self.last_status,'transition':status!=self.last_status,'unhealthySecondsObservedSoFar':self.unhealthy_seconds}
        path=self.label+'-health-poll-'+str(len(self.polls)+1).zfill(6)+'.json'
        write_new(self.root/path,record);self.polls.append(path)
        if record['transition']:self.transitions.append({'path':path,**record})
        self.last_time=now;self.last_status=status
        if status=='healthy' and self.first_healthy is None:self.first_healthy=now-self.began
        require(state.get('Running') is True and not state.get('Restarting',False) and not state.get('OOMKilled',False) and not state.get('Dead',False),'Health poll container exited/restarting/OOM/dead: immediate STOP')
        return readiness_status(state)
    def summary(self,now):
        require(now>=self.last_time,'Health monotonic clock moved backwards')
        unhealthy=self.unhealthy_seconds+(now-self.last_time if self.last_status=='unhealthy' else 0)
        return {'timeToFirstHealthySeconds':self.first_healthy,'totalUnhealthySeconds':unhealthy,'healthPollCount':len(self.polls),'healthPollEvidence':list(self.polls),'healthTransitions':list(self.transitions),'unhealthyTimeMeasurement':'MONOTONIC_INTERVALS_BETWEEN_OBSERVED_POLLS_NOT_UNOBSERVED_EXACT_DOCKER_TRANSITION_TIME'}
''')
edit('proof_docker.py',lambda s:s.replace('def validate(self,id,owner,data,tmp,running):','def validate(self,id,owner,data,tmp,running,observe=None):').replace("        v=inspect(id);env=","        v=inspect(id)\n        if observe is not None:\n            require(callable(observe),'Health observation callback required');observe(v)\n        env=").replace("and not v['State']['OOMKilled'] and v['State']['Running'] is running","and not v['State']['OOMKilled'] and not v['State'].get('Restarting',False) and not v['State'].get('Dead',False) and v['State']['Running'] is running"))
def startup(s):
 s=s.replace('readiness_status,load_health,assert_healthcheck','readiness_status,load_health,assert_healthcheck,HealthHistory')
 s=s.replace('            health=None','            health=None;history=HealthHistory(root,label,began)')
 a=s.index('                disk.check();v=docker.validate');b=s.index("                if status=='healthy':",a)
 s=s[:a]+"                disk.check();v=docker.validate(id,owner,data,tmp,True,observe=lambda obj:history.observe(obj,time.monotonic()))\n                status=readiness_status(v['State'])\n"+s[b:]
 # Every HTTP response and exact event inventory must fit inside the original total deadline.
 needle="            memory,_=docker.command"
 s=s.replace(needle,"            require(time.monotonic()-began<READY_SECONDS,'600-second readiness STOP during full HTTP probes')\n"+needle)
 s=s.replace("'fullInstalledStatePreserved':True,'jobsOnQualificationStillRequired':True}","'fullInstalledStatePreserved':True,'jobsOnQualificationStillRequired':True,**history.summary(history.last_time)}")
 return s
edit('proof_startup.py',startup)
def tests(s):
 s=s.replace('2026-10-15T08:00:00Z','2026-10-15T08:50:00Z').replace('2026-10-15T08:01:00Z','2026-10-15T08:51:00Z').replace('2026-10-15T08:02:00Z','2026-10-15T08:52:00Z')
 s=s.replace("    def test_unhealthy_is_an_immediate_stop(self):\n        with self.assertRaisesRegex(RuntimeError,'immediate'):readiness_status({'Health':{'Status':'unhealthy'}})","    def test_unhealthy_is_an_allowed_observation(self):\n        self.assertEqual(readiness_status({'Health':{'Status':'unhealthy'}}),'unhealthy')")
 s=s.replace("def exercise(self,status='healthy',health_mismatch=False,changed_state=False,probe_failure=False):","def exercise(self,status='healthy',health_mismatch=False,changed_state=False,probe_failure=False,statuses=None,exited=False,probe_seconds=0):")
 s=s.replace(";calls=[]\n        log=",";calls=[];clock=[0.0];observed=[0]\n        log=")
 s=s.replace("            def validate(self,*a):return {'State':{'Health':{'Status':status}},'Config':{'Healthcheck':derived['expectedDockerHealthcheck']}}", "            def validate(self,*a,**kw):\n                seq=statuses or [status];current=seq[min(observed[0],len(seq)-1)];observed[0]+=1\n                v={'State':{'Running':not exited,'OOMKilled':False,'Health':{'Status':current,'FailingStreak':3 if current=='unhealthy' else 0,'Log':[{'ExitCode':1 if current=='unhealthy' else 0,'Output':current}]}},'Config':{'Healthcheck':derived['expectedDockerHealthcheck']}}\n                if kw.get('observe'):kw['observe'](v)\n                return v")
 s=s.replace("if 'const checks=[]' in program:return", "if 'const checks=[]' in program:\n                        clock[0]+=probe_seconds\n                        return")
 s=s.replace("mock.patch('proof_startup.time.sleep',side_effect=AssertionError('Unexpected wait'))", "mock.patch('proof_startup.time.monotonic',side_effect=lambda:clock[0]),mock.patch('proof_startup.time.sleep',side_effect=lambda seconds:clock.__setitem__(0,clock[0]+seconds))")
 a=s.index('    def test_unhealthy_immediate_stop_with_retained_evidence(self):');b=s.index('    def test_healthy_but_http_failure',a)
 s=s[:a]+'''    def test_unhealthy_recovers_with_http_and_transitions_retained(self):
        r,calls=self.exercise(statuses=['starting','unhealthy','unhealthy','healthy']);self.assertIsInstance(r,list);self.assertEqual(r[0]['timeToFirstHealthySeconds'],3);self.assertEqual(r[0]['totalUnhealthySeconds'],2);self.assertEqual([x['status'] for x in r[0]['healthTransitions']],['starting','unhealthy','healthy']);self.assertEqual(r[0]['healthPollCount'],4)
        for rel in r[0]['healthPollEvidence']:
            p=self.owner/rel;v=json.loads(p.read_bytes());self.assertIn('Log',v['state']['Health']);self.assertIn('FailingStreak',v['state']['Health']);self.assertIn('observedUtc',v)
            if os.name!='nt':self.assertEqual(stat.S_IMODE(p.stat().st_mode),0o400)
    def test_unhealthy_until_deadline_stops_and_retains_all_polls(self):
        r,calls=self.exercise(status='unhealthy');self.assertIsInstance(r,RuntimeError);self.assertIn('600-second',str(r));self.assertIn(('stop','startup-1'),calls);self.assertFalse((self.owner/'startup-1-result.json').exists());self.assertEqual(len(list(self.owner.glob('startup-1-health-poll-*.json'))),600)
    def test_exited_while_unhealthy_stops_immediately_with_poll_evidence(self):
        r,calls=self.exercise(status='unhealthy',exited=True);self.assertIsInstance(r,RuntimeError);self.assertIn('immediate STOP',str(r));self.assertIn(('stop','startup-1'),calls);self.assertEqual(len(list(self.owner.glob('startup-1-health-poll-*.json'))),1)
    def test_missing_health_status_stops_immediately_and_is_retained(self):
        r,calls=self.exercise(status=None);self.assertIsInstance(r,RuntimeError);self.assertIn('Unknown health',str(r));self.assertEqual(len(list(self.owner.glob('startup-1-health-poll-*.json'))),1)
    def test_full_http_probes_cannot_overrun_total_deadline(self):
        r,calls=self.exercise(probe_seconds=600);self.assertIsInstance(r,RuntimeError);self.assertIn('600-second',str(r));self.assertFalse((self.owner/'startup-1-result.json').exists())
'''+s[b:]
 return s
edit('verify_proof_guards.py',tests)
for p in NEW.glob('*.py'):ast.parse(p.read_bytes(),filename=p.name,feature_version=(3,9))
(NEW/'source-preparation-only.json').write_text(json.dumps({'status':'COMPLETE_HEALTH_TRANSITION_SOURCE_PREPARED_NOT_YET_TESTED_OR_APPROVED','direction':6188190365,'predecessorSource':'0541865b67af0fbf3232d7cb077ab505896a2ced','newRoot':'/opt/lims/releases/workflow-batch-startup-forward-cde8c889-20261015T100000Z','productionMutations':0,'operators':0,'oldSourceUnchanged':True,'files':{n:hashlib.sha256((NEW/n).read_bytes()).hexdigest() for n in names}},indent=2)+'\n',encoding='utf8')
print(json.dumps({'newSource':str(NEW),'pythonFiles':12,'operators':0,'next':'Verify local and actualhost with unique retained synthetic fixtures, then publish and exact allhash review.'}))
