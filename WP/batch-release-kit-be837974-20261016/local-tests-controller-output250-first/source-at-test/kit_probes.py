"""Actual31 API checks and six frozen readonly probes, then full preservation.

No old DB, production host SQLite connection, source mutation, or assumption
that successful HTTP alone proves zero database writes. No import actions.
"""
import pathlib
import re
from kit_contract import require,sha
from retained_contract import exact_json,child_path
from retained_files import logical,file_state
from kit_owned import cli_spec
from kit_integrity import DATA_MOUNT

PROBES=('postflight-roles.cjs','postflight-auth.cjs','postflight-reference.cjs',
        'postflight-qc-runs.cjs','postflight-policy.cjs','readonly-smoke.cjs')

def bound_probes(tooling):
    tooling=pathlib.Path(tooling);mapping=exact_json((tooling/'probe-source-map.json').read_bytes())['probes']
    require(set(mapping)==set(PROBES),'Complete exact six-probe source map required')
    rows={}
    for name in PROBES:
        p=child_path(tooling,tooling/name);raw=p.read_bytes();pin=mapping[name]
        require(pin.get('sourceCommit')=='187636984895aec44044635fb63498b0fcb3102e' and
            pin.get('copiedByteIdentically') is True and len(raw)==pin.get('bytes') and sha(raw)==pin.get('sha256'),
            'Frozen readonly probe bytes changed')
        rows[name]=raw
    return rows

class Probes:
    def __init__(self,root,tooling,runner,cli,monitor,journal):
        self.root=pathlib.Path(root);self.tooling=pathlib.Path(tooling);self.runner=runner;self.cli=cli
        self.monitor=monitor;self.journal=journal;self.consumed=False

    def run(self,identity,first_sync_backup):
        require(not self.consumed,'Broad production postflight consumed');self.consumed=True
        sources=bound_probes(self.tooling)
        baseline=child_path(self.root,first_sync_backup);before=file_state(baseline);state=logical(baseline)
        require(len(state['tables'])==112 and state['tables'].get('_schema_migrations',{}).get('count')==42,
            'Broad postflights require the full installed112-table/42-receipt baseline')
        args=['docker','exec','-i','-w','/app/server','-e','POSTFLIGHT_ADMIN_ID=1770311018064',
            '-e','POSTFLIGHT_MANAGER_ID=user-mgr-gha','-e','POSTFLIGHT_TECH_ID=user-tech-gha',
            '-e','POSTFLIGHT_BASE_URL=http://127.0.0.1:3000',identity,'node']
        raw,err,metadata=self.runner.run(args+['scripts/postflight_issue140.cjs'],'postflight-api31',120,
            observer=self.monitor.observe)
        require(not err and re.findall(rb'POSTFLIGHT SUMMARY: (\d+)/(\d+) checks passed \((\d+) failed\)',raw)==[(b'31',b'31',b'0')],
            'Complete shipped31/31 API postflight required')
        records=[]
        for name,source in sources.items():
            self.monitor.observe('broad-postflight',True)
            self.runner.run(args,'probe-'+name[:-4],120,input_bytes=source,observer=self.monitor.observe)
            records.append({'file':name,'sha256':sha(source),'bytes':len(source),'exitCode':0})
        output,runtime=self.cli.run(cli_spec('postflight-backup',DATA_MOUNT));value=exact_json(output)
        require(value.get('backupPath')=='/tmp/backup.db' and all(value.get(k) is True for k in
            ('sourceReadonly','kernelReadOnlyDataMountRequired','consistentBackup','neverRetry')),
            'Complete post-probe consistent backup required')
        current=child_path(self.root,self.root/'postflight-backup-retained-temp/backup.db');actual=file_state(current)
        require(actual is not None and all(actual[k]==value.get(k) for k in ('sha256','bytes')),
            'Post-probe backup identity differs')
        current_state=logical(current)
        self.journal.append('broadPostflightFullState',{'before':before,'after':actual,'fullStatesEqual':current_state==state,
            'apiCommand':metadata,'probes':records,'backupRuntime':runtime})
        require(file_state(baseline)==before and current_state==state,
            'Broad readonly postflights changed full112-table/42-receipt state or a new natural sync intervened; retain and forward-fix')
        self.monitor.observe('postflight-final',True)
        return {'apiChecks':{'passed':31,'total':31,'failed':0},'readOnlyProbes':records,
            'fullAllColumnStatePreserved':True,'newBackup':actual,'hostSqlConnectionsToLiveOrOldDb':0}
