"""Retain actual copy-topology direction and create NEW source files only."""
import ast,datetime,json,pathlib,subprocess,sys
REPO=pathlib.Path(__file__).resolve().parents[2]
OLD=REPO/'WP/batch-proof-budget-cde8-20261015'
NEW=REPO/'WP/batch-proof-noop-identity-cde8-20261015'
BASE='d827812706272b0aa185e447c5dd3374d8d2b217'
SOURCE='932e764ad68d5de2ca136e1172fb72ae7afa7edc'
sys.path.insert(0,str(OLD))
from proof_contract import FILES,canonical,exact_json,require,sha
from prepare_proof import raw_git,current_evidence
def cmd(*a):return subprocess.check_output(a,cwd=REPO)
require(not NEW.exists() and cmd('git','rev-parse','HEAD').decode().strip()==BASE and not cmd('git','diff','--cached','--name-only').strip(),'New source consumed/writer moved')
require(cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==BASE,'Remote moved')
direction=cmd('gh','api','repos/yigini/soilfer-lims/issues/comments/6183663456')
answer=exact_json(direction)
require(answer['id']==6183663456 and answer['created_at']==answer['updated_at']=='2026-10-15T03:23:02Z' and answer['performed_via_github_app']['slug']=='claude','Actual unedited direction differs')
require(all(t in answer['body'] for t in ['no verdict on 932e764a','70 − 18 = 52','= 65','byte-identical','installed','new unused root','new exact request']),'Incomplete direction')
evidence=current_evidence()
raws={n:raw_git(SOURCE,'WP/batch-proof-budget-cde8-20261015/'+n)[0] for n in FILES}
texts={n:r.decode().replace('WP/batch-proof-budget-cde8-20261015/','WP/batch-proof-noop-identity-cde8-20261015/').replace('20261015T040000Z','20261015T050000Z') for n,r in raws.items()}
def replace(name,old,new,count=1):
    require(texts[name].count(old)==count,'Unexpected source form '+name+': '+old[:70]);texts[name]=texts[name].replace(old,new)
replace('proof_budget.py',"'triple':6,'backup':3","'triple':2,'backup':1",3)
replace('proof_budget.py',"('install','seal'):3","('install','seal'):1")
replace('proof_contract.py',"'capacityDirection=6183215126',","'capacityDirection=6183215126','noopSealDirection=6183663456','dryRunMainIdentityAndEmptyWal=true','repeatMainWalIdentityNoOpZero=true','installedSealBecomesPrevious=true',")
replace('proof_files.py','def copy_file(src,dst,expected,check):', '''def dry_identity(before,after):
    require(byte_identity(before)['']==byte_identity(after)[''],'Dry-run changed main SHA-256 or length')
    wal=after['-wal']
    require(wal is None or wal['bytes']==0,'Dry-run left a non-empty WAL')
    return {'mainBefore':before[''],'mainAfter':after[''],'walAfter':wal,'mainSha256AndLengthEqual':True,'walAbsentOrEmpty':True,'shmExcluded':True,'sqlConnections':0,'copiesCreated':0}

def repeat_identity(before,after,result,issue):
    plan(result,issue,'NO_OP')
    require(type(result.get('totalChanges')) is int and result['totalChanges']==0,'Repeat must return exact NO_OP/0')
    a,b=byte_identity(before),byte_identity(after)
    require(all(a[s]==b[s] for s in ['', '-wal']),'Repeat changed main or WAL SHA-256 or length')
    return {'mainBefore':before[''],'mainAfter':after[''],'walBefore':before['-wal'],'walAfter':after['-wal'],'mainAndWalByteIdentity':True,'mode':'NO_OP','totalChanges':0,'shmExcluded':True,'sqlConnections':0,'copiesCreated':0}

def copy_file(src,dst,expected,check):''')
replace('proof_install.py',"        dry_backup,_=seal(root,'dry-'+issue+'-seal',dry/'dev.db',disk.check)\n        require(logical(dry_backup)==logical(previous) and byte_identity(triple(dry/'dev.db'))['']==byte_identity(dry_before)[''],'Dry-run changed copied state/main bytes')", "        dry_check=dry_identity(dry_before,triple(dry/'dev.db'))\n        write_new(root/('dry-'+issue+'-byte-identity.json'),dry_check)")
replace('proof_install.py',"        repeated,repeated_state=seal(root,'repeat-'+issue+'-seal',target/'dev.db',disk.check)\n        require(state==repeated_state and byte_identity(repeat_before)['']==byte_identity(triple(target/'dev.db'))[''],'Immediate NO_OP changed full state or main bytes')", "        repeat_check=repeat_identity(repeat_before,triple(target/'dev.db'),repeat,issue)\n        write_new(root/('repeat-'+issue+'-byte-identity.json'),repeat_check)")
replace('proof_install.py',"'backup':str(repeated)","'backup':str(installed),'dryByteIdentity':dry_check,'repeatByteIdentity':repeat_check")
replace('proof_install.py','previous=repeated;','previous=installed;')
replace('verify_proof_guards.py','byte_identity,file_state','byte_identity,file_state,dry_identity,repeat_identity')
replace('verify_proof_guards.py','64813597806','51759760494',4)
replace('verify_proof_guards.py',"record['declaredDbCopies'],70","record['declaredDbCopies'],52")
replace('verify_proof_guards.py',"'dbEquivalents':88","'dbEquivalents':65")
replace('verify_proof_guards.py','(70,3,88)','(52,3,65)')
replace('verify_proof_guards.py','test_current_capacity_refuses_before_root','test_insufficient_capacity_refuses_before_root')
replace('verify_proof_guards.py',"v['freeBytes']['/opt/lims']=58601160704","v['freeBytes']['/opt/lims']=51759760493")
replace('verify_proof_guards.py',"    def test_reference_capacity_honestly_refuses(self):\n        b=self.model();self.assertEqual(b.required(),51759760494)\n        with self.assertRaises(RuntimeError):b.begin('fresh-snapshot',58602573824)\n        self.assertIsNone(b.active)","    def test_reference_capacity_honestly_fits(self):\n        b=self.model();self.assertEqual(b.required(),51759760494)\n        b.begin('fresh-snapshot',58601160704);self.assertEqual(b.active,'fresh-snapshot')")
replace('verify_proof_guards.py','dbBudgetEquivalents=88','dbBudgetEquivalents=65')
replace('verify_proof_guards.py',"if __name__=='__main__':unittest.main(verbosity=2)",'''class NoOpIdentityTests(unittest.TestCase):
    def rows(self,main=b'original',wal=None,shm=b'shm'):
        def row(raw):return None if raw is None else {'sha256':sha(raw),'bytes':len(raw)}
        return {'':row(main),'-wal':row(wal),'-shm':row(shm)}
    def result(self):return {'classification':'COMPLETE_209','mode':'NO_OP','totalChanges':0,'backfilledCount':0}
    def test_dry_unchanged_main_absent_wal_passes(self):dry_identity(self.rows(),self.rows(shm=b'changed'))
    def test_dry_zero_length_wal_passes(self):dry_identity(self.rows(),self.rows(wal=b''))
    def test_dry_changed_main_same_length_refused(self):
        with self.assertRaises(RuntimeError):dry_identity(self.rows(),self.rows(main=b'changed!'))
    def test_dry_changed_main_length_refused(self):
        with self.assertRaises(RuntimeError):dry_identity(self.rows(),self.rows(main=b'longer original'))
    def test_dry_nonempty_wal_refused(self):
        with self.assertRaises(RuntimeError):dry_identity(self.rows(),self.rows(wal=b'pending changes'))
    def test_repeat_main_and_wal_equal_shm_excluded(self):repeat_identity(self.rows(wal=b'wal'),self.rows(wal=b'wal',shm=b'new'),self.result(),'209')
    def test_repeat_changed_main_refused(self):
        with self.assertRaises(RuntimeError):repeat_identity(self.rows(),self.rows(main=b'changed!'),self.result(),'209')
    def test_repeat_changed_wal_refused(self):
        with self.assertRaises(RuntimeError):repeat_identity(self.rows(wal=b'wal'),self.rows(wal=b'bad'),self.result(),'209')
    def test_repeat_wal_absent_to_empty_refused(self):
        with self.assertRaises(RuntimeError):repeat_identity(self.rows(),self.rows(wal=b''),self.result(),'209')
    def test_repeat_other_than_noop_zero_refused(self):
        for key,value in [('mode','APPLIED'),('totalChanges',1),('totalChanges',False),('classification','PRE_209'),('backfilledCount',1)]:
            result=self.result();result[key]=value
            with self.assertRaises(RuntimeError):repeat_identity(self.rows(),self.rows(),result,'209')
if __name__=='__main__':unittest.main(verbosity=2)''')
for n,text in texts.items():ast.parse(text,filename=n,feature_version=(3,9))
NEW.mkdir()
for n,text in texts.items():
    with (NEW/n).open('xb') as f:f.write(text.encode())
dest=NEW/'actual-noop-seal-direction-6183663456';dest.mkdir()
for n,data in {'actual-direction-original.json':direction,'actual-direction-readable.txt':answer['body'].encode(),'current-app-boundaries.json':canonical(evidence)+b'\n','native-direction-read.json':canonical({'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'windowId':7867734,'project':'LIMS Audit','thread':'Lab workflow audit and plan','rightComposerEmpty':True,'centreHumanDraftPreserved':'can you go and ask Pip','actualNativeDirectionRead':True,'noMessageSent':True,'noHumanCardAnswered':True})+b'\n'}.items():
    with (dest/n).open('xb') as f:f.write(data)
with (NEW/'source-only-preparation.json').open('xb') as f:f.write(canonical({'status':'NEW_SOURCE_ONLY_UNAPPROVED_UNEXECUTED','predecessorSource':SOURCE,'directionId':6183663456,'root':'/opt/lims/releases/workflow-batch-stopped-copy-cde8c889-20261015T050000Z','newRootCreated':False,'sourceFiles':{n:sha((NEW/n).read_bytes()) for n in sorted(FILES)},'productionCopies':0,'productionSqliteConnections':0,'proofOperatorsExecuted':0})+b'\n')
print(json.dumps({'status':'NEW_NOOP_IDENTITY_GRAPH_PREPARED_SOURCE_ONLY','sourceFiles':len(FILES),'directionId':6183663456,'rootCreated':False,'operatorsExecuted':0}))
