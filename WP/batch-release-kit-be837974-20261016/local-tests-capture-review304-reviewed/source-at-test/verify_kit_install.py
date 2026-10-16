"""Whole installer/preservation chain on NEW synthetic SQLite files only."""
import json
import pathlib
import sqlite3
import tempfile
import unittest
from kit_install import Installations,CHAIN
from kit_journal import Journal
from retained_files import file_state,triple,logical

HERE=pathlib.Path(__file__).resolve().parent
FIXTURES=HERE/'installation-local-retained-fixtures'

def setup():
    FIXTURES.mkdir(exist_ok=True)
    root=pathlib.Path(tempfile.mkdtemp(prefix='owned-',dir=FIXTURES)).resolve();live=root/'synthetic-database'
    live.mkdir();target=live/'dev.db'
    db=sqlite3.connect(target)
    db.executescript('CREATE TABLE "_schema_migrations" (id TEXT PRIMARY KEY,details TEXT);'
        'CREATE TABLE "Original" (id TEXT PRIMARY KEY,value BLOB,number REAL,optional TEXT);'
        'CREATE TABLE "OrderLine" (id TEXT PRIMARY KEY,analysis TEXT);')
    db.execute('INSERT INTO "Original" VALUES (?,?,?,?)',('old-id',b'\x00\xffSYNTHETIC',1.2345,None))
    db.execute('INSERT INTO "OrderLine" VALUES (?,?)',('line-old','pH'))
    db.executemany('INSERT INTO "_schema_migrations" VALUES (?,?)',[('old-'+str(i),'EXACT_OLD_'+str(i)) for i in range(39)])
    for index in range(103):
        name='Old'+str(index);db.execute('CREATE TABLE "'+name+'" (id INTEGER,value TEXT)')
        db.execute('INSERT INTO "'+name+'" VALUES (?,?)',(index,'SYNTHETIC_OLD_'+str(index)))
    db.commit();db.close()
    journal=Journal(root,str(root),'a'*64,require_directory_sync=False)
    return root,target,journal

class SyntheticCli:
    def __init__(self,root,target):self.root=root;self.target=target;self.calls=[];self.tamper=None
    def run(self,spec):
        label=spec['label'];self.calls.append(label)
        if label=='canonical-policy':
            value={'classification':'PRESENT','shape':'CANONICAL','mode':'NO_OP','totalChanges':0,'dataWrites':0,
                'readonlySnapshot':{'originalFilesPreserved':True}}
        elif label=='chart-impact':
            value={'access':'SQLITE_READONLY_SNAPSHOT','productionMutations':0,
                'controlChartContexts':[{'labId':'SYNTHETIC_LAB','analysis':'pH','method':'SYNTHETIC'}],'affectedRuns':[]}
        elif label=='order-impact':
            tmp=self.root/'order-impact-retained-temp';tmp.mkdir();rows=[]
            for name in ('primary','secondary'):
                d=tmp/name;d.mkdir();p=d/'snapshot.db';p.write_bytes(b'SYNTHETIC_ALLOCATION_BYTES_ONLY_'+name.encode())
                actual=file_state(p);rows.append({'path':'/tmp/'+name+'/snapshot.db',**{k:actual[k] for k in ('bytes','sha256','allocatedBytes')}})
            value={'access':'RETAINED_SNAPSHOT_ONLY','originalFilesPreserved':True,'totalChanges':0,'backfilledCount':0,
                'readonlySnapshot':{'path':'/tmp/primary/snapshot.db','originalFilesPreserved':True},
                'retainedAllocation':{'allocationMeasured':True,'files':rows},
                'impact':{'prospectiveApprovedAmendmentSampleCount':0,'invalidStoredAnalysisSampleCount':0,
                    'noActiveRevisionCount':0,'noMatchingLineCount':0,'invalidStoredAnalyses':[],
                    'approvedAmendmentSampleIds':[],'approvedAmendmentKitGate':'NO_APPROVED_AMENDMENT_REFUSALS'}}
        else:
            issue,phase=label.split('-');tables,marker=CHAIN[issue]
            if phase=='apply':
                db=sqlite3.connect(self.target)
                try:
                    for name in tables:db.execute('CREATE TABLE "'+name+'" (id TEXT PRIMARY KEY,value TEXT)')
                    if issue=='209':db.execute('ALTER TABLE "OrderLine" ADD COLUMN "workItemId" TEXT')
                    if self.tamper=='oldValue':db.execute('UPDATE "Original" SET number=999')
                    if self.tamper=='oldReceipt':db.execute('UPDATE "_schema_migrations" SET details=? WHERE id=?',('CHANGED','old-0'))
                    if self.tamper=='newEvidence' and tables:db.execute('INSERT INTO "'+next(iter(tables))+'" VALUES (?,?)',('forbidden','data'))
                    if self.tamper=='backfill' and issue=='209':db.execute('UPDATE "OrderLine" SET workItemId=?',('forbidden',))
                    db.execute('INSERT INTO "_schema_migrations" VALUES (?,?)',(marker,'SYNTHETIC_NEW_RECEIPT'))
                    db.commit()
                finally:db.close()
            value={'classification':('PRE_' if phase=='dry' else 'COMPLETE_')+issue,
                'mode':{'dry':'DRY_RUN','apply':'APPLIED','repeat':'NO_OP'}[phase],
                'totalChanges':1 if phase=='apply' else 0,'backfilledCount':0}
            if phase=='apply':value.update(previousClassification='PRE_'+issue,receipt={'originalRowsPreserved':True})
            if phase=='repeat' and self.tamper=='repeatValue':
                db=sqlite3.connect(self.target);db.execute('UPDATE "Original" SET optional=?',('forbidden',));db.commit();db.close()
        return json.dumps(value).encode(),{'syntheticDockerStandIn':True,'dataWritable':spec['dataWritable']}

def adapter(root,target,journal,cli,review=lambda issue,value:True):
    return Installations(root,target,cli,journal,lambda:None,lambda:None,review)

class InstallerGuards(unittest.TestCase):
    def test_complete_real_synthetic_106_39_to_112_42_chain_preserves_every_old_column(self):
        root,target,journal=setup();cli=SyntheticCli(root,target);ops=adapter(root,target,journal,cli)
        raw_original=triple(target);ops.retain_stopped_backup();ops.canonical_policy()
        for issue in CHAIN:
            ops.impact(issue);ops.dry(issue);ops.apply_once(issue);ops.preserve(issue);ops.repeat(issue)
        self.assertEqual(ops.index,3)
        state=logical(ops.previous);self.assertEqual(len(state['tables']),112)
        self.assertEqual(state['tables']['_schema_migrations']['count'],42)
        self.assertEqual(ops.previous_state,state)
        self.assertEqual(ops.original_raw,raw_original)
        expected=['canonical-policy','206-dry','206-apply','206-repeat','chart-impact','214-dry','214-apply',
            '214-repeat','order-impact','209-dry','209-apply','209-repeat']
        self.assertEqual(cli.calls,expected)
        for issue in CHAIN:
            self.assertTrue(ops.results[issue]['preservation']['preservation']['allOriginalRowsAndReceiptsPreserved'])
            self.assertTrue(ops.results[issue]['repeat']['byteIdentity']['shmExcluded'])
            self.assertTrue((root/(issue+'-dry-database')/'dev.db').exists())

    def test_mutated_old_value_receipt_or_new_evidence_refuses_before_repeat(self):
        for tamper in ('oldValue','oldReceipt','newEvidence'):
            root,target,journal=setup();cli=SyntheticCli(root,target);ops=adapter(root,target,journal,cli)
            ops.retain_stopped_backup();ops.canonical_policy();ops.impact('206');ops.dry('206')
            cli.tamper=tamper;ops.apply_once('206')
            with self.assertRaises(RuntimeError):ops.preserve('206')
            with self.assertRaises(RuntimeError):ops.repeat('206')
            self.assertNotIn('206-repeat',cli.calls)

    def test_repeat_changed_byte_or_orderline_backfill_refuses(self):
        for tamper in ('repeatValue','backfill'):
            root,target,journal=setup();cli=SyntheticCli(root,target);ops=adapter(root,target,journal,cli)
            ops.retain_stopped_backup();ops.canonical_policy()
            for issue in CHAIN:
                ops.impact(issue);ops.dry(issue)
                if issue=='209':cli.tamper=tamper
                ops.apply_once(issue)
                if issue=='209' and tamper=='backfill':
                    with self.assertRaises(RuntimeError):ops.preserve(issue)
                    break
                ops.preserve(issue)
                if issue=='209':
                    with self.assertRaises(RuntimeError):ops.repeat(issue)
                else:ops.repeat(issue)

    def test_phase_replay_and_unreviewed_actual_impact_cannot_dispatch_apply(self):
        root,target,journal=setup();cli=SyntheticCli(root,target)
        ops=adapter(root,target,journal,cli,lambda issue,value:False)
        ops.retain_stopped_backup();ops.canonical_policy()
        with self.assertRaises(RuntimeError):ops.impact('206')
        with self.assertRaises(RuntimeError):ops.apply_once('206')
        self.assertEqual(cli.calls,['canonical-policy'])

    def test_snapshot_path_escape_duplicate_or_missing_secondary_refuses(self):
        root,target,journal=setup();cli=SyntheticCli(root,target)
        raw,_=cli.run({'label':'order-impact','dataWritable':False});original=json.loads(raw)
        import copy
        for mode in ('escape','duplicate','secondary'):
            value=copy.deepcopy(original);rows=value['retainedAllocation']['files']
            if mode=='escape':rows[0]['path']='/tmp/../foreign/snapshot.db'
            if mode=='duplicate':rows[1]=rows[0]
            if mode=='secondary':rows.pop()
            with self.assertRaises(RuntimeError):Installations.verify_impact_allocations(value,root/'order-impact-retained-temp')

if __name__=='__main__':unittest.main()
