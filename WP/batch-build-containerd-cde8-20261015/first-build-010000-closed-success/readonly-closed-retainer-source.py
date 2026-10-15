import base64,datetime,hashlib,json,pathlib,stat,subprocess
root=pathlib.Path('/opt/lims/releases/workflow-batch-build-cde8c889-20261015T010000Z');unit='lims-workflow-batch-build-cde8c889-20261015t010000z';invocation='a856dfdc5dcf401698724f7ef9459933';expected={'pr296-original.json': {'bytes': 65850, 'sha256': '63dd79e416841f9651fab6fb8bb76d227d3ae6601f82f6f326c244fa894b787c'}, 'main-ci-original.json': {'bytes': 12111, 'sha256': 'b76e9a34b6be2aef115860d2280e850d14b16edb41c64ccafd0b474243e4f7e2'}, 'batch_build.py': {'bytes': 12839, 'sha256': '574fdaf4f5c43fc10b64b4379de4a6e4f6fc92704b2a48efd33977645b2f0a99'}, 'launch_batch_build.py': {'bytes': 8579, 'sha256': 'd872474949d42f0294d0f40860b903aacbd548bfb3effdb1700b7cd5176dcb1c'}, 'build-input.json': {'bytes': 4111, 'sha256': '01f62a7eeca84e31e5b0bf90195aeabb3aba7dff2b8b0319ce61b87e35b4266d'}, 'metadata-analysis-original.json': {'bytes': 48734, 'sha256': 'c2f4fc6d15d064f4e4a08255edbfd450494adb3f3625224ce7267550f66e6d25'}, 'pr297-comments-original.json': {'bytes': 20259, 'sha256': '20f195ef4512a4febe5926cdcbb8baddae3bab99a21fd698ca6b1052d57a0751'}, 'pr295-original.json': {'bytes': 23239, 'sha256': 'b298e3b26bf7717064058d3370ed3d20c1698fe605dc7061de627ed5a3d48cd5'}, 'verify_build_guards.py': {'bytes': 16795, 'sha256': '4d2e505b088c7c2d3b4fb701d81b31fe1f1280e9009cd2474bf50c6d45d8ee9a'}, 'pr297-original.json': {'bytes': 33502, 'sha256': '94bf0cc84ad26b4eec437ec5d9c393904c075c39747d40406c404777c775e9d1'}, 'pr296-actual-pass-original.json': {'bytes': 8178, 'sha256': '83293fdf38e293253ec6ae50ff81dc3a9b61cd87fe863d04eaa465f99a8b9f47'}, 'source.tar.gz': {'bytes': 40676098, 'sha256': '6c54dbed48f4aab4d36286dd5e2a921587c1adae51fc4856f53cd321cf86144a'}, 'fallback-direction-original.json': {'bytes': 6613, 'sha256': '1a199ef0023c5ba2315d038de4f5797831679f3382933d50e34336b92ffa7ddb'}, 'pr297-actual-pass-original.json': {'bytes': 5571, 'sha256': '2272d318b7d824d7341e90cd340b53bfeb81dc5cbec26150f857b4db8251a167'}, 'pr295-comments-original.json': {'bytes': 10644, 'sha256': '3cd8ecfd08235af23aae6a5ae7c7157690c06e85c7574e503562dd566b4b3201'}, 'pr295-actual-pass-original.json': {'bytes': 6787, 'sha256': '3d504670dbe3035c87ff67d73c50782e005a1893c4665de338de9fb57ce0a25a'}, 'pr296-comments-original.json': {'bytes': 13709, 'sha256': 'd6f0751f4ac2bdb75a54211ea8dc43b25edaf9d9440621ac8e6a98e47f4b46c9'}, 'prepare_batch_build.py': {'bytes': 9586, 'sha256': '6a6d1688983d425c8e550c28d04b7e76a19829c054e1d5798f7b0a1b28275719'}, 'tooling-source-index.json': {'bytes': 1586, 'sha256': '6cdd35dcc3bf3e240c2a2072cd1d6f7151799bcb5c6787814ded04962cc119fc'}, 'source-index.json': {'bytes': 411659, 'sha256': 'c7520b9feab4c331818d40fc80de62609d8fba7f3d8d6fa79fc68c38cb485c0f'}, 'source-review-original.json': {'bytes': 9081, 'sha256': '390fe64d14f0a58fff04f7e1ba37dba0927673c0fe8aa3a7e891bbfe460ac66c'}, 'batch_build_contract.py': {'bytes': 16980, 'sha256': '41a2d3853f566df8b0c329ea3a71d42caad8269150f4b9928caf3348e1afa36e'}, 'original-build-failure.json': {'bytes': 2047, 'sha256': '4474dcd30269c0710e17723e2f702114f09d48129ccc070b499aa65a69ab30c2'}, 'main-original.json': {'bytes': 336, 'sha256': '8ab38fb8db0993cd672bbb2e6bf3b6ca8d124087fb841ecc97bad4fb1d9bfe89'}};image='sha256:b5ab0a0a57aeec4fe24dd8095126f3502cbc0c8629a7f4c1ef9e55034893c6fb'
props=dict(v.split('=',1) for v in subprocess.check_output(['systemctl','show',unit,'--property=LoadState,ActiveState,SubState,Result,ExecMainStatus,MainPID,InvocationID,ExecMainStartTimestamp,ExecMainExitTimestamp,MemoryMax,MemorySwapMax,RuntimeMaxUSec']).decode().splitlines() if '=' in v)
assert props['MainPID']=='0' and props['ActiveState'] in ['inactive','failed'],'Actual closure required'
journal_json=subprocess.check_output(['journalctl','-u',unit,'--no-pager','-o','json']);assert len(journal_json)<=2097152
rows=[json.loads(v) for v in journal_json.splitlines() if v]
identities={v.get('INVOCATION_ID',v.get('_SYSTEMD_INVOCATION_ID')) for v in rows};assert identities=={invocation},identities
assert any(v.get('JOB_RESULT')=='done' and v.get('UNIT')==unit+'.service' for v in rows)
assert any(v.get('MESSAGE')==unit+'.service: Deactivated successfully.' and v.get('UNIT')==unit+'.service' for v in rows)
if props['LoadState']=='not-found':assert props['InvocationID']=='','Unloaded defaults are not executed unit properties'
else:assert props['LoadState']=='loaded' and props['InvocationID']==invocation and props['Result']=='success' and props['ExecMainStatus']=='0'
assert root.is_dir() and not root.is_symlink() and (root/'build-receipt.json').is_file() and not (root/'build-preflight-refusal.json').exists() and not (root/'build-terminal-failure.json').exists()
files={}
for p in sorted(root.iterdir()):
 assert not p.is_symlink()
 if p.name=='source':assert p.is_dir();continue
 assert p.is_file()
 limit=expected[p.name]['bytes'] if p.name in expected else 2097152
 assert p.stat().st_size<=limit,p.name
 data=p.read_bytes();files[p.name]={'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'mode':oct(stat.S_IMODE(p.stat().st_mode)),'base64':base64.b64encode(data).decode()}
for n,v in expected.items():assert files[n]['bytes']==v['bytes'] and files[n]['sha256']==v['sha256'] and files[n]['mode']=='0o400',n
application=json.loads((root/'source-index.json').read_bytes());wanted={v['path']:v for v in application['entries'] if 'node_modules' not in pathlib.PurePosixPath(v['path']).parts}
actual={p.relative_to(root/'source').as_posix():p for p in (root/'source').rglob('*') if p.is_file() or p.is_symlink()};assert set(actual)==set(wanted)
for n,p in actual.items():
 assert not p.is_symlink() and stat.S_IMODE(p.stat().st_mode)==(0o755 if wanted[n]['mode']=='100755' else 0o644)
 h=hashlib.sha256();s=hashlib.sha1(('blob '+str(p.stat().st_size)+'\0').encode())
 with p.open('rb') as f:
  while True:
   chunk=f.read(1048576)
   if not chunk:break
   h.update(chunk);s.update(chunk)
 assert p.stat().st_size==wanted[n]['bytes'] and h.hexdigest()==wanted[n]['sha256'] and s.hexdigest()==wanted[n]['blob'],n
fresh=subprocess.check_output(['docker','image','inspect',image],timeout=15);assert len(fresh)<=2097152
original=json.loads((root/'image-inspect-original.json').read_bytes())[0];current=json.loads(fresh)[0];assert current==original and current['Id']==image
for n,data in [('journal-original.jsonl',journal_json),('journal-original.log',subprocess.check_output(['journalctl','-u',unit,'--no-pager','-o','short-iso-precise'])),('candidate-image-fresh-closed-inspect-original.json',fresh)]:
 assert len(data)<=2097152
 files[n]={'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'mode':None,'base64':base64.b64encode(data).decode()}
print(json.dumps({'status':'ACTUAL_CLOSED_CORRECTED_BUILD_ORIGINALS','observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'root':str(root),'unit':unit,'actualInvocationIdFromJournal':invocation,'properties':props,'transientUnitUnloadedAfterSuccess':props['LoadState']=='not-found','unloadedDefaultPropertiesAreNotExecutedLimits':props['LoadState']=='not-found','files':files,'extractedSourceFilesVerified':len(actual),'sourceAllRawGitHashesAndModesUnchanged':True,'freshImageMatchesEntireOriginalInspect':True,'freshInspectRole':'DISTINCT_POST_CLOSURE_READONLY_API_RESPONSE_NOT_ORIGINAL_ROOT_FILE','newBuildsLaunched':0,'databaseConnections':0,'proofLaunches':0,'productionDeployments':0}))
