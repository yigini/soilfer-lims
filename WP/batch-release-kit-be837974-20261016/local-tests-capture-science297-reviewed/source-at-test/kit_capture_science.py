"""Single-use detached-clone preparation and full scientific capture sequence.

Only the compiled six capture owners are available. The two APPLY calls are
206/214 preparation of the new clone, followed immediately by full old-row,
receipt and schema preservation. No209 APPLY/default startup/live SQL exists.
This component still needs the complete reviewed capture launcher, consumer,
Apache, controller transport and whole-filesystem producer closure.
"""
import datetime
import pathlib
from kit_contract import HEAD,IMAGE,canonical,require,sha
from retained_contract import ROOT,exact_json,plan,policy_gate
from retained_files import triple,seal,delta_from_state,file_state
from kit_capture_owned import (CAPTURE_ROOT,CaptureOwnedCli,capture_spec,validate_capture_spec)
from kit_capture_budget import CaptureDisk,CAPTURE_TABLE_SHA,CAPTURE_TABLE
from kit_capture_copy import (capture_snapshot,capture_clone,capture_source_review,verify_capture_clone,
    verify_capture_snapshot,capture_reference,sync_capture_tree)
from kit_capture_authority import CaptureAuthority
from kit_integrity import EXPECTED
from kit_install import CHAIN,Installations
from kit_journal import exclusive_record
from kit_evidence import admit_evidence
from kit_package import write_new_file
from kit_science import scientific_projection,verify_scientific_originals
from kit_no_writers import assert_no_volume_writers

LIMIT=16*1024**2


def capture_no_writers(root,reader):
    root=pathlib.Path(root);verify_capture_clone(root)
    result=assert_no_volume_writers(reader,paths=(root/'scientific-database',))
    verify_capture_clone(root)
    return result


def retain_capture_original(root,name,raw,sync=True):
    require(isinstance(raw,bytes) and 0<len(raw)<=LIMIT,'Full bounded capture original required')
    require('/' not in name and name.endswith('.json'),'Direct capture original basename required')
    admit_evidence(pathlib.Path(root)/name,len(raw))
    pin=write_new_file(root,name,raw,sync)
    return {'file':name,**pin}


class CaptureBudgetedCli:
    def __init__(self,cli,disk):
        require(isinstance(cli,CaptureOwnedCli) and type(disk) is CaptureDisk,'Typed capture CLI and disk required')
        self.cli=cli;self.disk=disk
    def run(self,label):
        spec=capture_spec(label);validate_capture_spec(spec)
        self.disk.check(600);self.disk.budget.cli(label)
        return self.cli.run(spec)


class CaptureScience:
    def __init__(self,root,index,source,authority,disk,reader,cli,journal,no_writers):
        require(pathlib.Path(root).as_posix()==CAPTURE_ROOT.as_posix() and type(authority) is CaptureAuthority,
            'Separate capture root and fresh provider authority required')
        require(type(disk) is CaptureDisk and callable(no_writers),'Separate capture disk and writer inventory required')
        require(authority.root==pathlib.Path(root) and authority.index==index and authority.source==source,
            'Capture controller authority inputs differ')
        self.root=pathlib.Path(root);self.index=index;self.source=source;self.authority=authority
        self.disk=disk;self.reader=reader;self.cli=CaptureBudgetedCli(cli,disk);self.journal=journal
        self.no_writers=no_writers;self.started=False;self.stage=0;self.preparation={};self.originals={}
        self.target=self.root/'scientific-database/dev.db';self.previous_state=None

    def readonly(self,label):
        self.no_writers();verify_capture_clone(self.root);before=triple(self.target)
        raw,runtime=self.cli.run(label)
        # Keep exact original bytes even if JSON, science or preservation
        # predicates refuse. The underlying owner already closed both pipes.
        name={'capture-chart-impact':'actual-impact-214.json','capture-order-impact':'actual-impact-209.json'}.get(
            label,label+'-original.json')
        reference=retain_capture_original(self.root,name,raw,self.disk.sync)
        self.no_writers();verify_capture_clone(self.root);after=triple(self.target)
        self.journal.append('captureReadonly',{'label':label,'original':reference,'runtime':runtime,
            'before':before,'after':after,'fullOriginalTripleEqual':before==after})
        require(before==after,'Read-only capture CLI changed clone DB/WAL/SHM')
        return exact_json(raw),reference

    def prepare(self,issue):
        require(issue in ('206','214') and len(self.preparation)==('206','214').index(issue),
            'Exact206 then214 preparation required')
        self.no_writers();verify_capture_clone(self.root)
        label='capture-'+issue+'-prepare'
        exclusive_record(self.root,label+'-intent.json',{'issue':issue,'target':str(self.target),
            'onlyNewRetainedClone':True,'neverRetry':True,'issue209ApplyPermitted':False},self.disk.sync)
        raw,runtime=self.cli.run(label)
        original=retain_capture_original(self.root,label+'-original.json',raw,self.disk.sync)
        self.no_writers();verify_capture_clone(self.root)
        result=exact_json(raw);plan(result,issue,'APPLIED')
        installed,state=seal(self.root,'capture-prepared-'+issue,self.target,self.disk.check)
        tables,marker=CHAIN[issue]
        preservation=delta_from_state(self.previous_state,state,installed,tables,marker)
        expected=(108,40) if issue=='206' else (112,41)
        require((preservation['totalTables'],preservation['schemaReceiptCount'])==expected,
            'Prepared capture schema or receipt inventory differs')
        self.no_writers();verify_capture_clone(self.root)
        record=retain_capture_original(self.root,'capture-'+issue+'-preservation.json',
            canonical(preservation)+b'\n',self.disk.sync)
        self.journal.append('capturePrepared'+issue,{'original':original,'preservation':preservation,
            'preservationOriginal':record,'consistentBackup':file_state(installed),'runtime':runtime})
        self.preparation[issue]={'original':original,'preservation':record};self.previous_state=state
        return preservation

    def run_stage(self,label,action):
        require(self.started and self.authority.result is not None and
            self.stage<len(CAPTURE_TABLE) and CAPTURE_TABLE[self.stage]['stage']==label,
            'Capture controller stage order/replay refused')
        self.disk.begin(label);value=action()
        self.journal.append('captureStageComplete',{'stage':label,'result':value})
        closure=self.disk.finish(label);self.stage+=1
        return value,closure

    def execute(self):
        require(not self.started,'Capture sequence cannot resume or retry')
        self.started=True
        binding=capture_source_review(self.index,self.source)
        fresh=self.authority.authorize()
        require(fresh['sourceBinding']==binding,'Capture fresh provider authority differs')
        exclusive_record(self.root,'capture-science-intent.json',{'sourceBinding':binding,
            'captureTableSha256':CAPTURE_TABLE_SHA,'neverRetry':True,'productionSqliteConnections':0},self.disk.sync)
        snapshot,_=self.run_stage('capture-filesystem-snapshot',lambda:capture_snapshot(
            self.root,self.index,self.source,self.reader,self.disk))
        self.run_stage('capture-clone',lambda:capture_clone(self.root,self.index,self.source,self.disk))
        self.previous_state=exact_json((self.root/'fresh-production-snapshot/logical-state.json').read_bytes())
        require(capture_reference(self.root/'fresh-production-snapshot/logical-state.json')==snapshot['logicalState'],
            'Snapshot logical state changed before preparation')
        def integrity():
            value,ref=self.readonly('capture-integrity');require(value==EXPECTED,'Complete capture integrity/FK result required')
            return ref
        self.run_stage('capture-integrity',integrity)
        def policy():
            value,ref=self.readonly('capture-canonical-policy');policy_gate(value);return ref
        self.run_stage('capture-canonical-policy',policy)
        for issue in ('206','214'):
            self.run_stage('capture-'+issue+'-prepare',lambda issue=issue:self.prepare(issue))
        values={}
        for issue,label in (('214','capture-chart-impact'),('209','capture-order-impact')):
            def collect(issue=issue,label=label):
                value,ref=self.readonly(label)
                if issue=='209':Installations.verify_impact_allocations(value,self.root/(label+'-retained-temp'))
                values[issue]=scientific_projection(issue,value);self.originals[issue]=ref
                return ref
            self.run_stage(label,collect)
        self.no_writers();verify_capture_clone(self.root);verify_capture_snapshot(self.root,binding)
        require(self.stage==len(CAPTURE_TABLE) and self.disk.budget.active is None and
            self.disk.budget.completed==len(CAPTURE_TABLE),'All capture physical stage closures required')
        result={'version':2,'root':self.root.as_posix(),'releaseRoot':str(ROOT),'head':HEAD,'image':IMAGE,
            'captureTableSha256':CAPTURE_TABLE_SHA,'context':'FRESH_REVIEWED_PRODUCTION_COPY_BEFORE_RELEASE_GATE',
            'productionSqliteConnections':0,'captureSourceReviewId':self.source['id'],
            'capturedAt':datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
            'issues':{'206':{'issue':'206','additiveEmptyTablesOnly':True},**values},
            'originalReferences':self.originals,'preparationReferences':self.preparation}
        def read(name):
            reference=next((ref for ref in [*self.originals.values(),
                *[r for records in self.preparation.values() for r in records.values()]] if ref['file']==name),None)
            require(reference is not None,'Unbound scientific original requested')
            from controller_output import output_pin
            require(output_pin(self.root/name,LIMIT)=={k:reference[k] for k in ('bytes','sha256')},
                'Capture original inode, mode or bytes changed')
            return (self.root/name).read_bytes()
        verify_scientific_originals(result,read)
        retain_capture_original(self.root,'actual-scientific-impact.json',canonical(result)+b'\n',self.disk.sync)
        sync_capture_tree(self.root)
        return result
