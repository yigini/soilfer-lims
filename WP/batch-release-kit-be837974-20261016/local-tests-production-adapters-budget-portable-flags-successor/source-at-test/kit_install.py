"""Stopped-volume installer operations. No CLI entry point or import actions.

Production must bind root/target/CLI, source-hash copy budget, exclusive journal
and no-writer checks in the complete adapter. Tests use NEW synthetic files.
All SQLite opens in the retained helpers are on newly owned readers/backups.
"""
import pathlib
from kit_contract import require
from retained_contract import exact_json,plan,policy_gate,impact_gate,child_path
from retained_files import (seal,clone_backup,triple,dry_identity,repeat_identity,
    delta_from_state,identity_record,file_state)
from kit_owned import cli_spec
from kit_integrity import DATA_MOUNT

CHAIN={
    '206':({'SampleContainer','ContainerSequence'},'206_sample_containers'),
    '214':({'ControlLimitProposal','ControlLimitSet','QcReviewObligation','QcReviewResolution'},'214_control_charts'),
    '209':(set(),'209_order_revision_contract'),
}

class Installations:
    def __init__(self,root,target,cli,journal,check,assert_no_writers,verify_reviewed_impact):
        self.root=pathlib.Path(root);self.target=pathlib.Path(target);self.cli=cli;self.journal=journal
        self.check=check;self.no_writers=assert_no_writers;self.review_impact=verify_reviewed_impact
        self.previous=None;self.previous_state=None;self.original_raw=None;self.index=0
        self.phases={};self.results={};self.pending=None

    def expect(self,issue,phase):
        require(self.previous is not None and self.index<3 and issue==tuple(CHAIN)[self.index],
                'Exact 206/214/209 installation order required')
        require(self.phases.get(issue)==phase,'Installer phase is missing, consumed, or out of order')

    def retain_stopped_backup(self):
        require(self.previous is None,'Stopped backup already consumed')
        self.no_writers()
        self.original_raw=triple(self.target)
        self.journal.append('stoppedBackupIntent',{'originalTriple':self.original_raw,'rawInputsNeverOpenedSqlite':True})
        self.previous,self.previous_state=seal(self.root,'stopped-predecessor',self.target,self.check)
        self.no_writers()
        require(triple(self.target)==self.original_raw,'Stopped original changed while making retained backup')
        raw=self.root/'stopped-predecessor/raw/dev.db'
        require(identity_record(triple(raw))==identity_record(self.original_raw),'Retained raw backup triple differs')
        result={'originalTriple':self.original_raw,'retainedRawTriple':identity_record(triple(raw)),
            'consistentBackup':file_state(self.previous),'logicalState':self.previous_state,
            'rawMasterNeverOpenedSqlite':True}
        self.journal.append('stoppedBackupComplete',result)
        return result

    def canonical_policy(self):
        require(self.previous is not None and not self.phases,'Policy must precede any issue installer')
        self.no_writers();before=triple(self.target)
        raw,runtime=self.cli.run(cli_spec('canonical-policy',DATA_MOUNT));value=exact_json(raw)
        self.no_writers();after=triple(self.target)
        self.journal.append('canonicalPolicyComplete',{'result':value,'runtime':runtime,'before':before,'after':after})
        require(before==after,'Canonical policy check changed original DB/WAL/SHM')
        policy_gate(value);self.phases['206']='impact'
        return value

    def impact(self,issue):
        self.expect(issue,'impact');self.no_writers();before=triple(self.target)
        value={'issue':'206','additiveEmptyTablesOnly':True}
        runtime=None
        if issue in ('214','209'):
            label='chart-impact' if issue=='214' else 'order-impact'
            raw,runtime=self.cli.run(cli_spec(label,DATA_MOUNT));value=exact_json(raw)
            if issue=='214':
                require(value.get('access')=='SQLITE_READONLY_SNAPSHOT' and value.get('productionMutations')==0 and
                    isinstance(value.get('controlChartContexts'),list) and isinstance(value.get('affectedRuns'),list),
                    'Actual complete chart context and unstarted/unbound run lists required')
            else:
                require(value.get('access')=='RETAINED_SNAPSHOT_ONLY' and value.get('originalFilesPreserved') is True and
                    type(value.get('totalChanges')) is int and value['totalChanges']==0 and
                    type(value.get('backfilledCount')) is int and value['backfilledCount']==0,
                    'Read-only order impact boundary incomplete')
                self.verify_impact_allocations(value,self.root/'order-impact-retained-temp')
                impact_gate(value)
        self.no_writers();after=triple(self.target)
        self.journal.append('actualImpact'+issue,{'result':value,'runtime':runtime,'before':before,'after':after})
        require(before==after,'Impact collector changed original DB/WAL/SHM')
        # The complete production gate verifies exact actual lists, not merely
        # counts, against the frozen kit / fresh YY impact acknowledgement.
        require(self.review_impact(issue,value) is True,'Actual scientific impact lacks exact reviewed binding')
        self.phases[issue]='dry';self.results[issue]={'impact':value}
        return value

    @staticmethod
    def verify_impact_allocations(value,retained):
        allocation=value.get('retainedAllocation',{});rows=allocation.get('files')
        require(allocation.get('allocationMeasured') is True and isinstance(rows,list) and 0<len(rows)<=200000,
                'Bounded measured primary/secondary snapshot allocation required')
        primary=value.get('readonlySnapshot',{})
        require(primary.get('originalFilesPreserved') is True,'Primary snapshot original preservation missing')
        def host_path(raw):
            require(isinstance(raw,str) and raw.startswith('/tmp/') and '\\' not in raw and '\x00' not in raw and
                not any(p in ('.','..','') for p in raw[5:].split('/')),'Snapshot path outside exact retained temp refused')
            return child_path(retained,pathlib.Path(retained)/raw[5:])
        primary_path=host_path(primary.get('path'));snapshots=[];paths=set()
        for row in rows:
            require(isinstance(row,dict),'Snapshot allocation record malformed')
            path=host_path(row.get('path'));require(str(path) not in paths,'Duplicate retained snapshot allocation path');paths.add(str(path))
            actual=file_state(path)
            require(actual is not None and all(actual.get(k)==row.get(k) for k in ('bytes','sha256','allocatedBytes')),
                    'Independent snapshot hash/length/physical allocation differs')
            if path.name=='snapshot.db':snapshots.append(path)
        require(primary_path in snapshots and len(snapshots)>=2,'Primary and secondary owned snapshots must both be retained')
        return {'verifiedFiles':len(paths),'primary':str(primary_path),'snapshots':[str(p) for p in snapshots]}

    def dry(self,issue):
        self.expect(issue,'dry');self.phases[issue]='dryConsumed';self.no_writers()
        original=triple(self.target)
        clone=clone_backup(self.root,issue+'-dry-database',self.previous,self.check)
        before=triple(clone/'dev.db')
        raw,runtime=self.cli.run(cli_spec(issue+'-dry',DATA_MOUNT));value=exact_json(raw)
        after=triple(clone/'dev.db')
        # DRY requires an unchanged main and no non-empty WAL. This uses the
        # previously accepted identity predicate; SHM has no semantic role here.
        dry_check=dry_identity(before,after,self.root,'installer-'+issue+'-dry')
        require(all(after[s] is None or after[s]['bytes']==0 for s in ('-wal',)),'DRY produced non-empty WAL')
        plan(value,issue,'DRY_RUN');self.no_writers()
        require(triple(self.target)==original,'DRY clone operation changed live original triple')
        result={'result':value,'runtime':runtime,'byteIdentity':dry_check,'clone':str(clone)}
        self.journal.append('installerDry'+issue,result);self.results[issue]['dry']=result;self.phases[issue]='apply'
        return result

    def apply_once(self,issue):
        self.expect(issue,'apply');self.phases[issue]='applyConsumed';self.no_writers()
        # A process death or unknown return leaves a durable APPLY intent. No
        # subsequent retry/recovery is inferred from absence of a result file.
        self.journal.append('installerApplyIntent'+issue,{'issue':issue,'neverRetry':True,'forwardOnly':True})
        raw,runtime=self.cli.run(cli_spec(issue+'-apply',DATA_MOUNT));value=exact_json(raw)
        plan(value,issue,'APPLIED');self.no_writers()
        result={'result':value,'runtime':runtime}
        self.journal.append('installerApply'+issue,result);self.results[issue]['apply']=result;self.phases[issue]='preserve'
        return result

    def preserve(self,issue):
        self.expect(issue,'preserve');self.phases[issue]='preserveConsumed';self.no_writers()
        installed,state=seal(self.root,'installed-'+issue,self.target,self.check)
        tables,marker=CHAIN[issue]
        preservation=delta_from_state(self.previous_state,state,installed,tables,marker,issue=='209')
        self.no_writers()
        result={'preservation':preservation,'consistentBackup':file_state(installed),'logicalState':state}
        self.journal.append('installerPreserved'+issue,result)
        self.pending=(installed,state);self.results[issue]['preservation']=result;self.phases[issue]='repeat'
        return result

    def repeat(self,issue):
        self.expect(issue,'repeat');self.phases[issue]='repeatConsumed';self.no_writers()
        before=triple(self.target)
        raw,runtime=self.cli.run(cli_spec(issue+'-repeat',DATA_MOUNT));value=exact_json(raw)
        after=triple(self.target)
        identity=repeat_identity(before,after,value,issue,self.root,'installer-'+issue+'-repeat')
        self.no_writers()
        result={'result':value,'runtime':runtime,'byteIdentity':identity}
        self.journal.append('installerRepeat'+issue,result);self.results[issue]['repeat']=result
        self.previous,self.previous_state=self.pending;self.pending=None
        self.index+=1;self.phases[issue]='complete'
        if self.index<3:self.phases[tuple(CHAIN)[self.index]]='impact'
        else:
            require(len(self.previous_state['tables'])==112 and self.previous_state['tables']['_schema_migrations']['count']==42,
                    'Production complete batch schema/receipt inventory differs from 112/42')
        return result
