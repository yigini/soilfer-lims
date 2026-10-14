import base64,datetime,hashlib,json,os,pathlib,re,stat,subprocess
root=pathlib.Path('/opt/lims/releases/workflow-batch-build-cde8c889-20261014T221500Z')
unit='lims-workflow-batch-build-cde8c889-20261014t221500z'
expected={'source-review-original.json': '6835772398e2aa8aa4387f3f8347cde3674bd253bf9f04c20207128a24b1ce81', 'pr295-original.json': '5eb26d9a72f609e0abd007d34e9680d672f62b30d38ee9c18d66a9e38d040e64', 'launch_batch_build.py': '7cff0a41ad5cd1d4baefbce9323554f9ea8629fd2391f129f89143a552a2a8c3', 'source-index.json': 'c7520b9feab4c331818d40fc80de62609d8fba7f3d8d6fa79fc68c38cb485c0f', 'main-ci-original.json': 'b76e9a34b6be2aef115860d2280e850d14b16edb41c64ccafd0b474243e4f7e2', 'source.tar.gz': '6c54dbed48f4aab4d36286dd5e2a921587c1adae51fc4856f53cd321cf86144a', 'verify_build_guards.py': 'a0a1b17c8fdb91679ed089e2834e4664c917bd00f7ea305d0058736a83ef3b23', 'pr296-original.json': 'a61e1d86de8facf7faba4b513fbbb7d0c9affc2325f95770e0b38abf5f22342f', 'main-original.json': '8ab38fb8db0993cd672bbb2e6bf3b6ca8d124087fb841ecc97bad4fb1d9bfe89', 'build-input.json': 'b79240cbc3fca012c63d3c6b06a64fb09d8e6218accc0fb771338999648e210a', 'pr295-actual-pass-original.json': '3d504670dbe3035c87ff67d73c50782e005a1893c4665de338de9fb57ce0a25a', 'tooling-source-index.json': '16dc1f6705a67b4c347b6e123d88b84cb3fc18b108fde92d97454f6a82de78c5', 'pr296-actual-pass-original.json': '83293fdf38e293253ec6ae50ff81dc3a9b61cd87fe863d04eaa465f99a8b9f47', 'prepare_batch_build.py': 'e8b862b8a5136290ee1175497d37f765a8ae1b6e1000af6df9c5cac732896fa9', 'pr295-comments-original.json': '3cd8ecfd08235af23aae6a5ae7c7157690c06e85c7574e503562dd566b4b3201', 'pr297-original.json': '05a14316816cc8dcad6d770a765e8e2abbb3ddb71a33e939be6882a4dabfb4df', 'batch_build_contract.py': '43b3e9ca228c07e3ceaa7645b9ae0d87099f3779c327fa336c8fa69184b367a5', 'batch_build.py': '897ff69d61cf61ef58a0e2266c2c23f5038b6ef5efe884226d7d0ec1a22e4191', 'pr296-comments-original.json': 'd6f0751f4ac2bdb75a54211ea8dc43b25edaf9d9440621ac8e6a98e47f4b46c9', 'pr297-comments-original.json': '20f195ef4512a4febe5926cdcbb8baddae3bab99a21fd698ca6b1052d57a0751', 'pr297-actual-pass-original.json': '2272d318b7d824d7341e90cd340b53bfeb81dc5cbec26150f857b4db8251a167'}
state=subprocess.check_output(['systemctl','show',unit,'--property=LoadState,ActiveState,SubState,Result,ExecMainStatus,ExecMainStartTimestamp,ExecMainExitTimestamp,MainPID,InvocationID,RuntimeMaxUSec']).decode()
properties=dict(line.split('=',1) for line in state.splitlines() if '=' in line)
assert properties['InvocationID']=='2da8e4edfe95494c8c60263ae1b1578b' and properties['ActiveState'] in ['inactive','failed'] and properties['MainPID']=='0','Actual same-unit closure required; no active logs captured'
assert root.is_dir() and not root.is_symlink()
def digest(p):
 h=hashlib.sha256()
 with p.open('rb') as f:
  while True:
   chunk=f.read(1048576)
   if not chunk:break
   h.update(chunk)
 return h.hexdigest()
input_facts={}
for n,d in expected.items():
 p=root/n
 assert p.is_file() and not p.is_symlink(),n
 input_facts[n]={'bytes':p.stat().st_size,'sha256':digest(p),'mode':oct(stat.S_IMODE(p.stat().st_mode)),'expectedSha256':d,'matchesOriginal':digest(p)==d}
originals={}
def original(n,raw,mode=None):
 assert len(raw)<=67108864,'Closed artifact exceeds retention bound; preserve remotely and use a new measured retainer'
 originals[n]={'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'mode':mode,'base64':base64.b64encode(raw).decode()}
for n in ['build-intent.json','docker-build.log','candidate-image.id','image-inspect-original.json','build-receipt.json','build-terminal-failure.json']:
 p=root/n
 if p.exists():
  assert p.is_file() and not p.is_symlink(),n
  original(n,p.read_bytes(),oct(stat.S_IMODE(p.stat().st_mode)))
journal=subprocess.check_output(['journalctl','-u',unit,'--no-pager','-o','short-iso-precise'])
original('journal-original.log',journal)
source=root/'source';application={'status':'SOURCE_DIRECTORY_ABSENT','files':[],'differences':[]}
if source.is_dir() and not source.is_symlink():
 idx=json.loads((root/'source-index.json').read_bytes())
 rows=[v for v in idx['entries'] if 'node_modules' not in pathlib.PurePosixPath(v['path']).parts]
 inventory=set();difference=[];facts=[]
 for parent,dirs,files in os.walk(source,followlinks=False):
  for n in dirs:
   assert not (pathlib.Path(parent)/n).is_symlink(),'Unreviewed extracted directory alias'
  for n in files:
   p=pathlib.Path(parent)/n;assert p.is_file() and not p.is_symlink(),'Unreviewed extracted source alias'
   inventory.add(p.relative_to(source).as_posix())
 for row in rows:
  p=source/row['path'];actual=None
  if p.is_file() and not p.is_symlink():
   raw=p.read_bytes();actual={'path':row['path'],'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'gitBlob':hashlib.sha1(('blob '+str(len(raw))+'\0').encode()+raw).hexdigest(),'mode':oct(stat.S_IMODE(p.stat().st_mode))}
  wanted='0o755' if row['mode']=='100755' else '0o644'
  if actual is None or actual['bytes']!=row['bytes'] or actual['sha256']!=row['sha256'] or actual['gitBlob']!=row['blob'] or actual['mode']!=wanted:difference.append(row['path'])
  if actual:facts.append(actual)
 expected_inventory={v['path'] for v in rows}
 application={'status':'EXTRACTED_RAW_SOURCE_VERIFIED' if not difference and inventory==expected_inventory else 'EXTRACTED_SOURCE_DIFFERS','files':facts,'differences':difference,'expectedCount':len(rows),'actualInventoryCount':len(inventory),'extraPaths':sorted(inventory-expected_inventory),'missingPaths':sorted(expected_inventory-inventory)}
if (root/'candidate-image.id').is_file():
 image=(root/'candidate-image.id').read_text().strip()
 if re.fullmatch('sha256:[a-f0-9]{64}',image):
  inspect=subprocess.run(['docker','image','inspect',image],capture_output=True)
  original('candidate-image-fresh-inspect-original.json',inspect.stdout);original('candidate-image-fresh-inspect-stderr-original.txt',inspect.stderr)
  inspect_exit=inspect.returncode
 else:inspect_exit=None
else:inspect_exit=None
print(json.dumps({'status':'ACTUAL_CLOSED_SAME_BUILD_UNIT_ORIGINALS','observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'root':str(root),'unit':unit,'properties':properties,'ownedInventory':sorted(p.name for p in root.iterdir()),'inputFileFacts':input_facts,'extractedApplication':application,'originals':originals,'candidateImageInspectExitCode':inspect_exit,'activeBuildLogsRead':False,'databasePathsOpened':0,'databaseConnections':0,'newBuildsDispatched':0}))
