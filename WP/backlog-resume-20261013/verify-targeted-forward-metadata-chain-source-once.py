"""Frozen successor: pure guards and retained full catalogue on local/host Python; no operator or RPC."""
import ast,base64,datetime,hashlib,json,pathlib,subprocess,sys,traceback
REPO=pathlib.Path(__file__).resolve().parents[2]
SOURCE=REPO/'WP/batch-forward-metadata-cde8-20261014'
DEST=SOURCE/'targeted-chain-source-verification-once'
assert not DEST.exists();DEST.mkdir();sys.path.insert(0,str(SOURCE))
from forward_metadata_contract import SOURCE_FILES,selected_snapshot_keys,sha,exact_json
raws={n:(SOURCE/n).read_bytes() for n in sorted(SOURCE_FILES)}
before={n:sha(raw) for n,raw in raws.items()}
def save(n,raw):
    with (DEST/n).open('xb') as f:f.write(raw)
def record(n,v):save(n,(json.dumps(v,indent=2,ensure_ascii=False)+'\n').encode())
catalogue=(SOURCE/'first-metadata-233000-closed-stop/007-moby-snapshots.stdout').read_bytes()
image=(SOURCE/'first-metadata-233000-closed-stop/000-candidate-image-inspect.stdout').read_bytes()
assert len(catalogue)==244320 and sha(catalogue)=='f9ac4687d7fa74206c9a598a42ffd8c05116e3224c8758e17227a01c90464461'
assert len(image)==7229 and sha(image)=='c4b4d2fabe2783adf0eb6f842bb424982fcb6a7d53753b3dde2c79800f821c14'
record('command-original.json',{'startedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceSha256Before':before,'scope':'IN_MEMORY_COMPILATION_PURE_GUARDS_RETAINED_CATALOGUE_ONLY','metadataOperatorsExecuted':0,'remoteSourceFilesWritten':0,'productionConnections':0})
local=None;remote=None
try:
    for n,raw in raws.items():ast.parse(raw,filename=n,feature_version=(3,9))
    rows=[v.split() for v in catalogue.decode().splitlines()[1:] if v.split()]
    assert len(rows)==1526 and len({v[0] for v in rows})==1526
    keys=selected_snapshot_keys(catalogue.decode(),exact_json(image)[0]['RootFS']['Layers'])
    assert len(keys)==59 and len(set(keys))==59
    witness={'catalogueBytes':len(catalogue),'catalogueSha256':sha(catalogue),'completeCatalogueKeys':len(rows),'selectedCandidateKeys':keys,'selectedCount':len(keys),'selectionSha256':sha(('\n'.join(keys)+'\n').encode()),'forensicImageSha256':sha(image),'allSelectedCommittedWithExactParents':True,'catalogueTruncated':False,'selectedBound':80,'metadataCalls':0}
    record('actual-retained-catalogue-selection-original.json',witness)
    local=subprocess.run([sys.executable,'-B','verify_forward_metadata_guards.py'],cwd=SOURCE,capture_output=True)
    save('local-stdout-original.log',local.stdout);save('local-stderr-original.log',local.stderr)
    assert local.returncode==0 and b'Ran 18 tests' in local.stderr
    encoded={n:base64.b64encode(raw).decode() for n,raw in raws.items()}
    probe='''import base64,hashlib,json,sys,types,unittest
encoded=ENCODED
expected=EXPECTED
catalogue=base64.b64decode(CATALOGUE)
image=base64.b64decode(IMAGE)
raws={n:base64.b64decode(v) for n,v in encoded.items()}
assert {n:hashlib.sha256(v).hexdigest() for n,v in raws.items()}==expected
for n,raw in raws.items():compile(raw,n,'exec')
contract=types.ModuleType('forward_metadata_contract');sys.modules[contract.__name__]=contract
exec(compile(raws['forward_metadata_contract.py'],'forward_metadata_contract.py','exec'),contract.__dict__)
keys=contract.selected_snapshot_keys(catalogue.decode(),contract.exact_json(image)[0]['RootFS']['Layers'])
assert len(keys)==59 and keys==EXPECTED_KEYS
guards=types.ModuleType('targeted_metadata_guard_memory');sys.modules[guards.__name__]=guards
exec(compile(raws['verify_forward_metadata_guards.py'],'verify_forward_metadata_guards.py','exec'),guards.__dict__)
suite=unittest.defaultTestLoader.loadTestsFromModule(guards);assert suite.countTestCases()==18
result=unittest.TextTestRunner(verbosity=2).run(suite)
print(json.dumps({'status':'PASS' if result.wasSuccessful() else 'FAILED','pythonVersion':sys.version,'sourceSha256':expected,'compiledSourceCount':len(raws),'guardTestCount':result.testsRun,'actualRetainedCatalogueRows':1526,'exactCandidateKeys':len(keys),'selectionSha256':contract.sha(('\\n'.join(keys)+'\\n').encode()),'catalogueTruncated':False,'remoteSourceFilesWritten':0,'metadataOperatorsExecuted':0,'imageInspectCalls':0,'imageAdoptions':0,'newReceipts':0,'productionConnections':0}))
assert result.wasSuccessful()
'''.replace('ENCODED',repr(encoded)).replace('EXPECTED_KEYS',repr(keys)).replace('EXPECTED',repr(before)).replace('CATALOGUE',repr(base64.b64encode(catalogue).decode())).replace('IMAGE',repr(base64.b64encode(image).decode()))
    save('host-inmemory-verification-source.py',probe.encode())
    remote=subprocess.run(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=15','root@46.19.33.37','python3','-B','-'],cwd=REPO,input=probe.encode(),capture_output=True,timeout=45)
    save('host-stdout-original.json',remote.stdout);save('host-stderr-original.log',remote.stderr)
    assert remote.returncode==0 and b'Ran 18 tests' in remote.stderr
    host=exact_json(remote.stdout);after={n:sha((SOURCE/n).read_bytes()) for n in raws}
    assert before==after and host['sourceSha256']==before and host['selectionSha256']==witness['selectionSha256'] and host['status']=='PASS' and host['metadataOperatorsExecuted']==0
    record('exit-original.json',{'status':'PASS_TARGETED_METADATA_SOURCE_GUARDS_NOT_EXECUTION','closedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'localExitCode':local.returncode,'hostExitCode':remote.returncode,'localGuardTests':18,'actualHostGuardTests':18,'sourceSha256Before':before,'sourceSha256After':after,'sourceUnchanged':True,'catalogueWitness':witness,'host':host,'metadataCollectorsRun':0,'imageAdoptions':0,'newReceipts':0,'productionConnections':0})
    print(json.dumps({'status':'PASS_TARGETED_METADATA_SOURCE_GUARDS_NOT_EXECUTION','localTests':18,'hostTests':18,'completeCatalogue':1526,'exactCandidateKeys':59,'sourceUnchanged':True,'operatorsRun':0}))
except BaseException as e:
    record('failure-original.json',{'status':'FAILED_TARGETED_METADATA_SOURCE_VERIFICATION','closedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'error':type(e).__name__+': '+str(e),'traceback':traceback.format_exc(),'localExitCode':getattr(local,'returncode',None),'hostExitCode':getattr(remote,'returncode',None),'sourceSha256Before':before,'sourceSha256After':{n:sha((SOURCE/n).read_bytes()) for n in raws},'metadataOperatorsExecuted':0,'neverReplay':True})
    raise
