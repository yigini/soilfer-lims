"""Create NEW complete source only after the closed050000 refusal; no operator."""
import ast,json,pathlib,subprocess,sys
REPO=pathlib.Path(__file__).resolve().parents[2];OLD=REPO/'WP/batch-proof-noop-identity-cde8-20261015';NEW=REPO/'WP/batch-proof-name-inventory-cde8-20261015'
BASE='e2d83f589a1487f5a959f52301da6665361c09a1';PREVIOUS='09d7e537d90bc8ed17e9d162fd6868a7c34a8e15'
sys.path.insert(0,str(OLD))
from proof_contract import FILES,canonical,exact_json,require,sha
from prepare_proof import raw_git
def cmd(*a):return subprocess.check_output(a,cwd=REPO)
require(not NEW.exists() and cmd('git','rev-parse','HEAD').decode().strip()==BASE and not cmd('git','diff','--cached','--name-only').strip(),'Source consumed/writer moved')
require(cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==BASE,'Remote moved')
closed=exact_json((OLD/'first-proof-050000-closed-name-refusal/closed-retention-record.json').read_bytes())
require(closed['originalRefusal']['error']=='RuntimeError: Container name not proven unused' and closed['installerOrEntrypointAttempts']==0 and not closed['newOwnedContainers'],'Actual closed boundary differs')
raws={n:raw_git(PREVIOUS,'WP/batch-proof-noop-identity-cde8-20261015/'+n)[0] for n in FILES}
texts={n:r.decode().replace('WP/batch-proof-noop-identity-cde8-20261015/','WP/batch-proof-name-inventory-cde8-20261015/').replace('20261015T050000Z','20261015T060000Z') for n,r in raws.items()}
def replace(name,old,new):
    require(texts[name].count(old)==1,'Unexpected source form '+name+': '+old[:70]);texts[name]=texts[name].replace(old,new)
replace('proof_contract.py',"'allLocalExecutedSourceFilesBound=true',","'allLocalExecutedSourceFilesBound=true','containerNameAbsenceProof=BOUNDED_COMPLETE_ID_AND_EXACT_NAME_INVENTORY','containerNameProbeRawIdsRetained=true','mandatoryKnownPredecessorInInventory=true','noErrorTextAbsenceInference=true',")
replace('proof_docker.py',"def all_containers():\n    r=subprocess.run(['docker','ps','-aq','--no-trunc'],capture_output=True,timeout=15);require(r.returncode==0,'Container inventory failed')\n    ids=r.stdout.decode().splitlines();require(len(ids)==len(set(ids)) and len(ids)<=4096,'Container inventory exceeded bound')",'''def container_ids(code,out,err):
    require(code==0 and isinstance(out,bytes) and isinstance(err,bytes) and len(out)<=512*1024 and not err,'Complete bounded successful container-ID inventory required')
    ids=out.decode('ascii').splitlines()
    require(len(ids)==len(set(ids)) and len(ids)<=4096 and all(re.fullmatch('[a-f0-9]{64}',id) for id in ids),'Malformed/duplicate/truncated container-ID inventory')
    return ids

def unused_name(name,inventory):
    require(re.fullmatch('lims-owned-batch-[a-f0-9]{24}',name) and isinstance(inventory,dict) and PREDECESSOR_ID in inventory,'Exact generated name and known predecessor required')
    names=[]
    for id,row in inventory.items():
        require(isinstance(id,str) and re.fullmatch('[a-f0-9]{64}',id) and isinstance(row,dict) and isinstance(row.get('name'),str) and re.fullmatch('/[a-zA-Z0-9][a-zA-Z0-9_.-]*',row['name']),'Complete canonical inspected container names required')
        names.append(row['name'])
    require(len(names)==len(set(names)),'Duplicate inspected container names refused')
    require('/'+name not in names,'Container name already exists: retain it and STOP')
    return {'requestedName':name,'exactNameAbsent':True,'completeInspectedContainers':len(inventory),'knownPredecessorPresent':True,'errorTextUsedAsAbsenceEvidence':False}

def all_containers(read_ids=None):
    if read_ids is None:
        r=subprocess.run(['docker','ps','-aq','--no-trunc'],capture_output=True,timeout=15);ids=container_ids(r.returncode,r.stdout,r.stderr)
    else:
        out,err=read_ids();ids=container_ids(0,out,err)
    require(PREDECESSOR_ID in ids,'Complete inventory omitted the known normal predecessor')''')
replace('proof_docker.py',"        v=inspect(id);rows[id]={'name':v['Name']", "        v=inspect(id);require(v.get('Id')==id and isinstance(v.get('Name'),str) and re.fullmatch('/[a-zA-Z0-9][a-zA-Z0-9_.-]*',v['Name']),'Inspected container identity/name differs');rows[id]={'name':v['Name']")
replace('proof_docker.py',"        absent=subprocess.run(['docker','inspect',name],capture_output=True,timeout=15)\n        require(absent.returncode!=0 and b'No such object' in absent.stderr,'Container name not proven unused')", "        inventory=all_containers(lambda:self.command(['docker','ps','-aq','--no-trunc'],label+'-name-list',15))\n        write_new(self.root/(label+'-name-inventory.json'),{'requestedName':name,'safeSelectedCompleteInventory':inventory,'rawIdResponseLabel':label+'-name-list','fullRawEnvironmentStored':False,'notYetCreateAuthority':True})\n        absence=unused_name(name,inventory)\n        write_new(self.root/(label+'-name-absence.json'),absence)")
replace('verify_proof_guards.py','Docker,mount_objects','Docker,mount_objects,container_ids,unused_name,all_containers')
replace('verify_proof_guards.py',"if __name__=='__main__':unittest.main(verbosity=2)",'''class StructuralNameTests(unittest.TestCase):
    def target(self):return 'lims-owned-batch-'+'a'*24
    def inventory(self):return {PREDECESSOR_ID:{'name':'/soilfer-lims'}}
    def test_exact_absent_name_proved_from_complete_inventory(self):
        self.assertTrue(unused_name(self.target(),self.inventory())['exactNameAbsent'])
    def test_present_exact_name_refused(self):
        rows=self.inventory();rows['b'*64]={'name':'/'+self.target()}
        with self.assertRaises(RuntimeError):unused_name(self.target(),rows)
    def test_similar_name_is_not_an_exact_collision(self):
        rows=self.inventory();rows['b'*64]={'name':'/'+self.target()+'-suffix'};unused_name(self.target(),rows)
    def test_missing_known_predecessor_refused(self):
        with self.assertRaises(RuntimeError):unused_name(self.target(),{})
    def test_missing_inspected_name_refused(self):
        rows=self.inventory();rows['b'*64]={}
        with self.assertRaises(RuntimeError):unused_name(self.target(),rows)
    def test_duplicate_inspected_name_refused(self):
        rows=self.inventory();rows['b'*64]={'name':'/soilfer-lims'}
        with self.assertRaises(RuntimeError):unused_name(self.target(),rows)
    def test_alias_or_noncanonical_name_refused(self):
        for name in ['soilfer-lims','/one/two','/','/bad name']:
            with self.assertRaises(RuntimeError):unused_name(self.target(),{PREDECESSOR_ID:{'name':name}})
    def test_arbitrary_requested_name_refused(self):
        with self.assertRaises(RuntimeError):unused_name('unowned',self.inventory())
    def test_complete_raw_id_inventory(self):self.assertEqual(container_ids(0,(PREDECESSOR_ID+'\\n').encode(),b''),[PREDECESSOR_ID])
    def test_inventory_transport_failure_never_means_absence(self):
        for code,err in [(1,b'error: no such object: target'),(1,b'Cannot connect to the Docker daemon'),(0,b'warning: incomplete')]:
            with self.assertRaises(RuntimeError):container_ids(code,b'',err)
    def test_malformed_truncated_duplicate_ids_refused(self):
        for raw in [b'short\\n',b'g'*64+b'\\n',(PREDECESSOR_ID+'\\n'+PREDECESSOR_ID+'\\n').encode(),b'\\n']:
            with self.assertRaises(RuntimeError):container_ids(0,raw,b'')
    def test_oversized_inventory_refused(self):
        with self.assertRaises(RuntimeError):container_ids(0,b'a'*(512*1024+1),b'')
    def test_known_predecessor_omitted_from_listing_refused_before_inspect(self):
        with mock.patch('proof_docker.inspect') as probe:
            with self.assertRaises(RuntimeError):all_containers(lambda:(b'',b''))
            probe.assert_not_called()
    def test_inspect_id_mismatch_refused(self):
        with mock.patch('proof_docker.inspect',return_value={'Id':'b'*64,'Name':'/soilfer-lims'}):
            with self.assertRaises(RuntimeError):all_containers(lambda:((PREDECESSOR_ID+'\\n').encode(),b''))
if __name__=='__main__':unittest.main(verbosity=2)''')
for n,text in texts.items():ast.parse(text,filename=n,feature_version=(3,9))
NEW.mkdir()
for n,text in texts.items():
    with (NEW/n).open('xb') as f:f.write(text.encode())
with (NEW/'source-only-preparation.json').open('xb') as f:f.write(canonical({'status':'NEW_SOURCE_ONLY_NOT_APPROVED_OR_EXECUTED','predecessorSource':PREVIOUS,'failedRootConsumed':'/opt/lims/releases/workflow-batch-stopped-copy-cde8c889-20261015T050000Z','closedEvidenceCommit':BASE,'root':'/opt/lims/releases/workflow-batch-stopped-copy-cde8c889-20261015T060000Z','sourceFiles':{n:sha((NEW/n).read_bytes()) for n in sorted(FILES)},'newRootCreated':False,'newOperations':0})+b'\n')
print(json.dumps({'status':'NEW_STRUCTURAL_NAME_SOURCE_PREPARED_ONLY','sourceFiles':len(FILES),'newRootCreated':False,'newOperations':0}))
