import base64,datetime,hashlib,json,pathlib,stat,subprocess
root=pathlib.Path('/opt/lims/releases/workflow-batch-forward-metadata-cde8c889-20261015T000500Z');unit='lims-workflow-batch-forward-metadata-cde8c889-20261015t000500z';expected={'original-failure.json': '4474dcd30269c0710e17723e2f702114f09d48129ccc070b499aa65a69ab30c2', 'docker-build.log': '5a7736d9d36aaccafa9d98d84c3d1a537af4ee29b5255022d2565d78792db0f4', 'forward_metadata_contract.py': 'b49bfb98d721a9e7e5034b8af98068121686ccdb8eb1eaf6aa0746eec1fe403c', 'verify_forward_metadata_guards.py': '3f07f8f38655c7e26d6d2000f11f060887e4db11eb85a922b0972e6b100470c3', 'prepare_forward_metadata.py': '7ebaa9b53e8cdca1824008cd773b631d1f5c1cf08c6639fe718aa39da2cd2505', 'tooling-source-index.json': 'af586d39ffe78963316eb1cc88e564f0a8e173f4663838699c98040a18e3476b', 'original-closed-index.json': '7eaa2de365a1c948cd6440dfa18ab9439994c1cbd5c1d2ca6bb3ead62b657aa0', 'scope-direction-original.json': '1a199ef0023c5ba2315d038de4f5797831679f3382933d50e34336b92ffa7ddb', 'candidate-image.id': '6bb4227f82debcf97845874330ae261d044b749819d2f2193a0fc0c3935967e3', 'metadata-input.json': '30e454aa4963fdbe2e54c7949735b6166df347cb668ad2ecaf0f196a5c1a78f2', 'original-build-intent.json': '984df248ea0bbad53b1561cda8f08ab1fc500717de0e3aaed4b7452845f47b6f', 'reference-direction-original.json': '3e5ff7910985af8de6c8294efd76612e68c2956669e8fca7b1d3ea80d353340a', 'candidate-image-fresh-inspect-original.json': 'c4b4d2fabe2783adf0eb6f842bb424982fcb6a7d53753b3dde2c79800f821c14', 'launch_forward_metadata.py': '52f83d09f2816a80f9f0ed8f2faea580a37156c5a13b33c4dd4d852561a85f0a', 'main-ci-original.json': 'b76e9a34b6be2aef115860d2280e850d14b16edb41c64ccafd0b474243e4f7e2', 'source-review-original.json': 'dedecdb4d5eb90cc9bb60bf97be839264b47ee683baf05fa1dd94c71c5b7e7d4', 'collect_forward_metadata.py': '9d2b6e1dc8fbb2050b92275034133fcf2659cc1c5e22da6e63e077ebcaf9b8b0', 'current-main-original.json': '8ab38fb8db0993cd672bbb2e6bf3b6ca8d124087fb841ecc97bad4fb1d9bfe89'};invocation='1fdffe01c57e4b9f8a26cdc9a1b579fc'
raw=subprocess.check_output(['systemctl','show',unit,'--property=LoadState,ActiveState,SubState,Result,ExecMainStatus,MainPID,InvocationID,ExecMainStartTimestamp,ExecMainExitTimestamp,MemoryMax,MemorySwapMax,RuntimeMaxUSec']).decode()
props=dict(line.split('=',1) for line in raw.splitlines() if '=' in line)
assert props['MainPID']=='0' and props['ActiveState'] in ['failed','inactive'],'No active unit may be retained as closed'
journal_json=subprocess.check_output(['journalctl','-u',unit,'--no-pager','-o','json']);assert len(journal_json)<=2097152
rows=[json.loads(v) for v in journal_json.splitlines() if v]
assert rows and all(v.get('UNIT')==unit+'.service' and v.get('INVOCATION_ID')==invocation for v in rows),'Actual one unit/invocation journal required'
assert any(v.get('JOB_RESULT')=='done' and v.get('MESSAGE','').startswith('Started /usr/bin/python3 -B '+str(root)) for v in rows),'Actual launch journal required'
assert any(v.get('MESSAGE')==unit+'.service: Deactivated successfully.' for v in rows),'Actual successful closure required'
if props['LoadState']=='not-found':
 assert props['InvocationID']=='','Unloaded transient unit cannot supply actual executed properties'
elif props['LoadState']=='loaded':
 assert props['InvocationID']==invocation and props['ExecMainStatus']=='0' and props['Result']=='success','Actual closed properties differ'
else:raise RuntimeError('Unknown unit state')
assert root.is_dir() and not root.is_symlink()
files={};directories=[]
for p in sorted(root.iterdir()):
 assert not p.is_symlink()
 if p.is_dir():
  directories.append({'name':p.name,'children':sorted(q.name for q in p.iterdir())});continue
 assert p.is_file() and p.stat().st_size<=2097152,p.name
 data=p.read_bytes();files[p.name]={'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'mode':oct(stat.S_IMODE(p.stat().st_mode)),'base64':base64.b64encode(data).decode()}
for n,h in expected.items():assert files[n]['sha256']==h and files[n]['mode']=='0o400','Original package input changed'
for name,data in [('journal-original.jsonl',journal_json),('journal-original.log',subprocess.check_output(['journalctl','-u',unit,'--no-pager','-o','short-iso-precise']))]:
 assert len(data)<=2097152
 files[name]={'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'mode':None,'base64':base64.b64encode(data).decode()}
print(json.dumps({'status':'ACTUAL_CLOSED_TARGETED_METADATA_ORIGINALS','observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'root':str(root),'unit':unit,'actualInvocationIdFromJournal':invocation,'properties':props,'transientUnitUnloadedAfterSuccess':props['LoadState']=='not-found','unloadedDefaultPropertiesAreNotExecutedLimits':props['LoadState']=='not-found','files':files,'directories':directories,'imageEligibility':False,'newImageInspects':0,'metadataOperatorsDispatched':0,'databaseConnections':0,'imageAdoptions':0}))
