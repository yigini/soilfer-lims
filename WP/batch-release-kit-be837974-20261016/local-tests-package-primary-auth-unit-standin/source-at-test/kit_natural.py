"""First full natural-intake preservation before reopen, later receipt only.

All SQL uses NEW owned immutable/consistent backups. No sync endpoint, cursor,
interval, clock, config, manual fetch-to-import or scientific data write exists.
The later receipt does not attribute intervening human writes to Kobo.
"""
import contextlib
import datetime
import pathlib
import sqlite3
import time
from kit_contract import FIVE_COUNTS,require,validate_postflight_counts
from retained_contract import exact_json,child_path
from retained_files import file_state,logical
from retained_fetch import capture
from retained_intake import verify_copy
from retained_runtime_policy import (TARGET_CONFIG,TARGET_LAB,TARGET_PROJECT,expected_refusals,
    scheduler_refusals,completed_syncs,intake_summary,observation_end,require_final_observation,utc_seconds)
from kit_owned import cli_spec
from kit_integrity import DATA_MOUNT

def utc():return datetime.datetime.now(datetime.timezone.utc).isoformat()

def configs(root,backup):
    backup=child_path(root,backup);require(backup.is_file(),'Only newly retained baseline may supply scheduler configs')
    with contextlib.closing(sqlite3.connect(backup.as_uri()+'?mode=ro&immutable=1',uri=True)) as db:
        db.row_factory=sqlite3.Row
        rows=[dict(r) for r in db.execute('SELECT * FROM KoboConfig')]
        labs=[dict(r) for r in db.execute('SELECT id,code,name,isActive FROM Lab')]
        projects=[dict(r) for r in db.execute('SELECT code FROM Project')]
    active={r['id']:{k:r[k] for k in ('id','labId','projectCode','syncIntervalMins','lastSubmissionId')}
        for r in rows if r['isActive'] and r['projectCode']}
    refusals=expected_refusals(rows,labs,projects)
    require(len(refusals)==4,'All four original refused configurations must remain exact')
    require(TARGET_CONFIG in active and active[TARGET_CONFIG]['labId']==TARGET_LAB and
        active[TARGET_CONFIG]['projectCode']==TARGET_PROJECT,'Original crash-path configuration required')
    require(sum(r['labId']==TARGET_LAB for r in active.values())==1,'Ambiguous target completion attribution')
    interval=active[TARGET_CONFIG]['syncIntervalMins'] or 15
    require(type(interval) is int and 0<interval<=30,'Unchanged natural interval outside bounded controller observation')
    return active,refusals,interval

def counts(state):
    require(set(FIVE_COUNTS)<=set(state.get('tables',{})),'Five protected counts missing from full state')
    result={name:state['tables'][name]['count'] for name in FIVE_COUNTS}
    require(all(type(v) is int and v>=0 for v in result.values()),'Exact five-count integers required')
    return result

class NaturalIntake:
    def __init__(self,root,baseline,baseline_state,cli,runner,candidate,monitor,journal,
                 capture_fetch=capture,compare=verify_copy,clock=time.monotonic,sleep=time.sleep,wall=time.time):
        self.root=pathlib.Path(root);self.baseline=pathlib.Path(baseline);self.baseline_state=baseline_state
        self.cli=cli;self.runner=runner;self.candidate=candidate;self.monitor=monitor;self.journal=journal
        self.capture=capture_fetch;self.compare=compare;self.clock=clock;self.sleep=sleep;self.wall=wall
        self.configs,self.refusals,self.interval=configs(root,baseline)
        refused={r['configId'] for r in self.refusals}
        self.valid={key:row for key,row in self.configs.items() if key not in refused}
        require(len({r['labId'] for r in self.valid.values()})==len(self.valid),
            'Ambiguous per-lab completion cannot be attributed to multiple valid configurations')
        self.before_start=None;self.first=None;self.first_fetch=None;self.first_state=None
        self.first_backup=None;self.observations=[];self.readiness=None

    def capture_before_start(self):
        require(self.before_start is None,'Upstream-before-start capture consumed')
        self.before_start=self.capture(self.baseline,list(self.configs))
        self.journal.append('upstreamBeforeStart',{'fetches':self.before_start,'originalIntervalsAndCursorsUntouched':True,
            'activeConfigsWithoutSecrets':self.configs,'expectedRefusals':self.refusals})

    def observation(self):
        self.runner.check(180);self.monitor.observe('natural-intake',True)
        value=self.candidate()
        require(value['State'].get('Health',{}).get('Status')=='healthy' and value.get('RestartCount')==0,
                'Candidate lost natural-intake health/restarted')
        label='natural-logs-'+str(len(self.observations)+1).zfill(6)
        raw,err,metadata=self.runner.run(['docker','logs','--timestamps',value['Id']],label,30,
            allow_stderr=True,observer=self.monitor.observe)
        stdout=raw.decode('utf-8','strict');stderr=err.decode('utf-8','strict')
        require('[KOBO_SCHEDULER] Initial sync error' not in stdout+stderr,'Initial natural scheduler error')
        refusals=scheduler_refusals(stdout,stderr,self.refusals)
        completions=completed_syncs(stdout)
        require(len(self.observations)<256,'Bounded natural observation inventory exceeded')
        per_lab={lab:completed_syncs(stdout,lab) for lab in sorted({r['labId'] for r in self.configs.values()})}
        observation={'utc':utc(),'completedTargetSyncs':completions,'exactPairedRefusals':refusals,
            'perLabCompletions':per_lab,
            'perConfigCompletions':{key:per_lab[row['labId']] for key,row in self.valid.items()},
            'healthy':True,'metadata':metadata}
        self.journal.append('naturalObservation',observation);self.observations.append(observation)
        return observation

    def first_full_preservation(self,readiness):
        require(self.before_start is not None and self.first is None,'First natural phase requires original pre-start capture once')
        self.readiness=readiness;began=self.clock()
        while self.clock()-began<600:
            observation=self.observation();completed=observation['completedTargetSyncs']
            if not completed:self.sleep(10);continue
            require(len(completed)==1,'Multiple first natural completions before first seal; STOP without retry')
            if not all(observation['perConfigCompletions'][key] for key in self.valid):self.sleep(10);continue
            require(all(len(observation['perConfigCompletions'][key])==1 for key in self.valid),
                'A valid configuration completed twice before first full consistent seal')
            self.first=completed[0]
            self.first_fetch=self.capture(self.baseline,list(self.configs),progress=self.monitor.observe)
            self.journal.append('firstNaturalUpstream',{'completion':self.first,'fetch':self.first_fetch})
            raw,runtime=self.cli.run(cli_spec('first-sync-backup',DATA_MOUNT));backup_result=exact_json(raw)
            expected={'backupPath','bytes','sha256','sourceReadonly','kernelReadOnlyDataMountRequired','consistentBackup','neverRetry'}
            require(isinstance(backup_result,dict) and set(backup_result)==expected and backup_result['backupPath']=='/tmp/backup.db' and
                all(backup_result[k] is True for k in ('sourceReadonly','kernelReadOnlyDataMountRequired','consistentBackup','neverRetry')),
                'Complete read-only consistent backup result required')
            path=child_path(self.root,self.root/'first-sync-backup-retained-temp/backup.db')
            identity=file_state(path)
            require(identity is not None and all(identity[k]==backup_result[k] for k in ('bytes','sha256')),
                'First consistent backup hash/length differs')
            ids={key:r['submissionIds'] for key,r in self.first_fetch.items()}
            preserved=self.compare(self.baseline,path,expected_table_count=112,fetched_ids=ids,
                refusal_configs=[r['configId'] for r in self.refusals],fetch_records=self.first_fetch,owner_root=self.root)
            summary=intake_summary(preserved,self.first)
            current=logical(path);before=counts(self.baseline_state);after=counts(current)
            delta={name:len(preserved['additions'].get(name,[])) for name in FIVE_COUNTS}
            five=validate_postflight_counts(before,after,delta)
            result={'completion':self.first,'perConfigFetch':self.first_fetch,'intake':summary,
                'fullPreservation':preserved,'consistentBackup':identity,'runtime':runtime,
                'fiveCounts':{'before':before,'after':after,'intakeDelta':delta},'fiveCountCheck':five,
                'sealedBeforeIngressReopens':True}
            self.journal.append('firstNaturalFullPreservation',result)
            self.first_backup=path;self.first_state=preserved
            return result
        raise RuntimeError('First natural sync did not complete within existing600 second observation bound')

    def second_receipt_after_reopen(self):
        require(self.first_state is not None and self.first_backup is not None,'First full preservation must already be sealed')
        end=observation_end(self.first['utc'],self.readiness['readyUtc'],self.interval)
        while True:
            observation=self.observation();completed=observation['completedTargetSyncs']
            if self.wall()>=end and len(completed)>=2 and all(len(observation['perConfigCompletions'][key])>=2 for key in self.valid):
                second=completed[1];now=observation['utc'];candidate=self.candidate()
                require_final_observation(self.first,second,self.readiness['readyUtc'],now,self.interval,
                    candidate['RestartCount'],None,utc_seconds(now)-utc_seconds(self.readiness['readyUtc']))
                require(all(sum(row['configId']==bound['configId'] for row in observation['exactPairedRefusals'])>=2
                    for bound in self.refusals),'Each original refusal configuration needs two exact natural pairs')
                self.monitor.observe('second-natural-final',True)
                for key,row in self.valid.items():
                    first,second_for_config=observation['perConfigCompletions'][key][:2]
                    configured=row['syncIntervalMins'] or 15
                    require(second_for_config['epochSeconds']>=first['epochSeconds']+configured*60,
                        'Per-configuration second completion was not at its original natural interval')
                result={'first':self.first,'second':second,'perLabCompletions':observation['perLabCompletions'],
                    'perConfigCompletions':observation['perConfigCompletions'],
                    'exactPairedRefusals':observation['exactPairedRefusals'],'configuredIntervalMinutes':self.interval,
                    'observationEndUtc':now,'originalCursorIntervalConfigAndClockUntouched':True,
                    'firstFullPreservationSealedBeforeReopen':True,'secondReceiptOnlyAfterReopen':True,
                    'interveningHumanWritesNotAttributedToKobo':True,
                    'newFullDatabaseIdempotenceProofClaimed':False,
                    'acceptedIsolatedQualificationAlreadyProvedSecondSyncIdempotence':True}
                self.journal.append('secondNaturalReceipt',result);return result
            require(self.wall()<=end+180,'Second natural completion deadline exceeded; never force sync')
            self.sleep(10)
