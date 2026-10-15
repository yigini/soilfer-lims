import base64,datetime,hashlib,json,pathlib,re,stat,subprocess
root=pathlib.Path('/opt/lims/releases/workflow-batch-build-be837974-20261015T180000Z');unit='lims-workflow-batch-build-be837974-20261015t180000z';inv='8a78764a88a44f1b9c5dc577a2f4b8de';expected={'build-input.json': {'bytes': 7059, 'sha256': '052b8e7077689b1e73a3b3010d2fc67c61a65c78c0fa1f6bb4b92a4bafedbc8e'}, 'authority-6191219093-original.json': {'bytes': 5365, 'sha256': '1c74e5f354e8f2c434d333b1fcf5830d01224866b4c93bc44bfd83975510ab71'}, 'fallback-direction-original.json': {'bytes': 6613, 'sha256': '1a199ef0023c5ba2315d038de4f5797831679f3382933d50e34336b92ffa7ddb'}, 'pr297-comments-original.json': {'bytes': 20259, 'sha256': '20f195ef4512a4febe5926cdcbb8baddae3bab99a21fd698ca6b1052d57a0751'}, 'source-index.json': {'bytes': 413542, 'sha256': 'c7ee2de3e0cbad7aad9be99b8a74f5ddc070f033b70b9595b7f7c754e99156db'}, 'source.tar.gz': {'bytes': 40691311, 'sha256': 'b086b15bf69f69df82f0278128aa6752dd94ebdbde6e21baf68bce29fd4b9e74'}, 'authority-6189669837-original.json': {'bytes': 4262, 'sha256': 'e6ea6a6dc2a0f13769eecd0f60780072b8a2902952d3ca30c7cae76017703dcf'}, 'pr298-actual-pass-original.json': {'bytes': 8010, 'sha256': '184b61b81a83ee40832800c1ade276ccebaf1542e534bb6a12e0cfed19fa024c'}, 'pr296-comments-original.json': {'bytes': 13709, 'sha256': 'd6f0751f4ac2bdb75a54211ea8dc43b25edaf9d9440621ac8e6a98e47f4b46c9'}, 'pr295-original.json': {'bytes': 23239, 'sha256': '39181cc127040536d22cbf1e66778601a25fdffc06c48bed2c3b99215f0f026a'}, 'metadata-analysis-original.json': {'bytes': 48734, 'sha256': 'c2f4fc6d15d064f4e4a08255edbfd450494adb3f3625224ce7267550f66e6d25'}, 'pr297-original.json': {'bytes': 33502, 'sha256': '6f5ae6b6ed7302f16fe2339ebac494d0c852c4722d013a1aa6ad528daccaf287'}, 'original-build-failure.json': {'bytes': 2047, 'sha256': '4474dcd30269c0710e17723e2f702114f09d48129ccc070b499aa65a69ab30c2'}, 'prepare_batch_build.py': {'bytes': 9982, 'sha256': '00caeef399735d3ca9ed6cef6febd63dbfee69a8cee1981fd0bb25ec1d4dcb9f'}, 'batch_build_contract.py': {'bytes': 22451, 'sha256': 'fc7d350be90df8e3e4254d3e0c7cd5749abc91cefda04ec085a8501c235383b9'}, 'batch_build.py': {'bytes': 13688, 'sha256': '17fae7713e60cfe2e3fe4c394ebd2c9715005adc4abf34481f685686e7de26ab'}, 'pr298-original.json': {'bytes': 31968, 'sha256': '05dbb592e8807020f71657cfdb84fe3b5114e6095d133ff5f9f3d2db5d4f495e'}, 'launch_batch_build.py': {'bytes': 10416, 'sha256': '6f355d087facbbd5cd7fa0a0d9623c1379329d23429854862a7eed50dd64896c'}, 'pr295-actual-pass-original.json': {'bytes': 6787, 'sha256': '3d504670dbe3035c87ff67d73c50782e005a1893c4665de338de9fb57ce0a25a'}, 'source-review-original.json': {'bytes': 7457, 'sha256': '7dfa53fe12035afa2ebfa02dc6f560248a015b244f02b7c7c7e4f577675aa216'}, 'authority-6189658753-original.json': {'bytes': 6654, 'sha256': '433dee0b65e0a046bf905aa59f8a2c6821f484026a08674def660fb2a0a55607'}, 'main-original.json': {'bytes': 336, 'sha256': '5dbe45b3d22a65a8a14dc291df3e7fc536f7465cceca1682788cdb46d6448679'}, 'pr296-actual-pass-original.json': {'bytes': 8178, 'sha256': '83293fdf38e293253ec6ae50ff81dc3a9b61cd87fe863d04eaa465f99a8b9f47'}, 'main-ci-original.json': {'bytes': 12122, 'sha256': '2c90f06107206bb4bdb799a458e15a3d80a58f486c6c741ca9841a70daca5388'}, 'verify_build_guards.py': {'bytes': 21544, 'sha256': '58238c64700d78352713ab9b6c3d43f7a82caab9bec061b40914f4c486a0ae4d'}, 'pr296-original.json': {'bytes': 65850, 'sha256': 'f66fa3f41e7ed82bc8f61b89047e9209b1fe4171a085f2ce602e91307b94be90'}, 'tooling-source-index.json': {'bytes': 1592, 'sha256': 'db8f5766c3812c6f1556595b464baca9a83c7315a8f64a158ffe748775e0ed82'}, 'pr295-comments-original.json': {'bytes': 10644, 'sha256': '3cd8ecfd08235af23aae6a5ae7c7157690c06e85c7574e503562dd566b4b3201'}, 'pr297-actual-pass-original.json': {'bytes': 5571, 'sha256': '2272d318b7d824d7341e90cd340b53bfeb81dc5cbec26150f857b4db8251a167'}, 'pr298-comments-original.json': {'bytes': 14628, 'sha256': '17ff6b5df9ce9396f3b9c8ba9231fbc227900b374bce08eeaab9373813f440ae'}, 'authority-6189025975-original.json': {'bytes': 6545, 'sha256': '16e9b64f1e0729e6c8d66a18e5099b2ac88d00ee1199bea528df8c28563a6b34'}}
assert root.is_dir() and not root.is_symlink()
propsraw=subprocess.run(['systemctl','show',unit,'--property=LoadState,ActiveState,SubState,Result,ExecMainStatus,MainPID,InvocationID,ExecMainStartTimestamp,ExecMainExitTimestamp,MemoryCurrent,MemoryPeak,MemoryMax,MemorySwapMax,RuntimeMaxUSec'],capture_output=True,timeout=15)
assert len(propsraw.stdout)<=65536 and len(propsraw.stderr)<=65536
props=dict(v.split('=',1) for v in propsraw.stdout.decode().splitlines() if '=' in v)
assert props.get('MainPID')=='0' and props.get('ActiveState') in ['inactive','failed'],'Build not closed; never retry this helper'
journal=subprocess.check_output(['journalctl','-u',unit,'--no-pager','-o','json'],timeout=15);assert len(journal)<=4*1024**2
jrows=[json.loads(v) for v in journal.splitlines() if v]
identities={v.get('INVOCATION_ID',v.get('_SYSTEMD_INVOCATION_ID')) for v in jrows};assert identities=={inv},identities
assert any(v.get('JOB_RESULT')=='done' and v.get('UNIT')==unit+'.service' for v in jrows),'No actual same-unit start/done journal'
success_deactivation=any(v.get('MESSAGE')==unit+'.service: Deactivated successfully.' and v.get('UNIT')==unit+'.service' for v in jrows)
terminal=[n for n in ['build-receipt.json','build-preflight-refusal.json','build-terminal-failure.json'] if (root/n).is_file()]
assert len(terminal)==1,'Expected one honest terminal record'
receipt=json.loads((root/terminal[0]).read_bytes());success=terminal==['build-receipt.json']
if success:
 assert success_deactivation
 if props['LoadState']=='loaded':assert props['InvocationID']==inv and props['Result']=='success' and props['ExecMainStatus']=='0'
 else:assert props['LoadState']=='not-found' and props['InvocationID']==''
files={};captured={};total=0
def read_file(p):
 before=p.stat();assert stat.S_ISREG(before.st_mode) and not p.is_symlink()
 h=hashlib.sha256();o=hashlib.sha1(('blob '+str(before.st_size)+'\0').encode())
 with p.open('rb') as f:
  while True:
   v=f.read(1048576)
   if not v:break
   h.update(v);o.update(v)
 after=p.stat();assert (before.st_dev,before.st_ino,before.st_size,before.st_mtime_ns)==(after.st_dev,after.st_ino,after.st_size,after.st_mtime_ns)
 return {'bytes':before.st_size,'sha256':h.hexdigest(),'gitBlobOid':o.hexdigest(),'mode':oct(stat.S_IMODE(before.st_mode))}
names=sorted(p.name for p in root.iterdir());assert len(names)<=128
for p in sorted(root.iterdir()):
 assert not p.is_symlink()
 if p.name=='source':assert p.is_dir();continue
 row=read_file(p);files[p.name]=row
 if p.name in expected:assert row['bytes']==expected[p.name]['bytes'] and row['sha256']==expected[p.name]['sha256'] and row['mode']=='0o400',p.name
 else:
  assert row['bytes']<=16*1024**2,p.name
  raw=p.read_bytes();assert hashlib.sha256(raw).hexdigest()==row['sha256'];total+=len(raw);assert total<=64*1024**2
  captured[p.name]=base64.b64encode(raw).decode()
assert set(expected)<=set(files)
application=json.loads((root/'source-index.json').read_bytes());wanted={v['path']:v for v in application['entries'] if 'node_modules' not in pathlib.PurePosixPath(v['path']).parts}
source_rows={}
if (root/'source').is_dir():
 for p in sorted((root/'source').rglob('*')):
  assert not p.is_symlink()
  if p.is_dir():continue
  n=p.relative_to(root/'source').as_posix();assert n in wanted
  row=read_file(p);v=wanted[n]
  assert row['bytes']==v['bytes'] and row['sha256']==v['sha256'] and row['gitBlobOid']==v['blob'] and row['mode']==('0o755' if v['mode']=='100755' else '0o644'),n
  source_rows[n]=row
assert len(source_rows)<=10000
if success:assert set(source_rows)==set(wanted),'Incomplete extracted source'
assert sorted(p.name for p in root.iterdir())==names,'Closed top-level inventory changed'
extra={'journal-original.jsonl':journal,'journal-original.log':subprocess.check_output(['journalctl','-u',unit,'--no-pager','-o','short-iso-precise'],timeout=15),'systemctl-original.stdout':propsraw.stdout,'systemctl-original.stderr':propsraw.stderr}
fresh_equal=False
if success:
 image=receipt['image'];assert re.fullmatch('sha256:[a-f0-9]{64}',image)
 fresh=subprocess.check_output(['docker','image','inspect',image],timeout=15);assert len(fresh)<=2097152
 assert json.loads(fresh)==json.loads((root/'image-inspect-original.json').read_bytes()),'Fresh whole image differs'
 extra['candidate-image-fresh-closed-inspect-original.json']=fresh;fresh_equal=True
for n,raw in extra.items():
 assert len(raw)<=4*1024**2
 files[n]={'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'gitBlobOid':hashlib.sha1(('blob '+str(len(raw))+'\0').encode()+raw).hexdigest(),'mode':None};captured[n]=base64.b64encode(raw).decode()
print(json.dumps({'status':'ACTUAL_CLOSED_STARTUP_BUILD_ORIGINALS','observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'root':str(root),'unit':unit,'actualInvocationId':inv,'properties':props,'successfulDeactivationFromJournal':success_deactivation,'transientUnitUnloaded':props['LoadState']=='not-found','unloadedDefaultsAreNotExecutedLimits':props['LoadState']=='not-found','terminalName':terminal[0],'files':files,'capturedBase64':captured,'publishedPackageFilesVerifiedWithoutDuplicateFetch':len(expected),'sourceAllRawGitHashesAndModesVerified':True,'sourceComplete':set(source_rows)==set(wanted),'extractedSourceFiles':source_rows,'freshImageEntireOriginalEqual':fresh_equal,'retainerBuildsProofsCleanupProductionOperations':0}))
