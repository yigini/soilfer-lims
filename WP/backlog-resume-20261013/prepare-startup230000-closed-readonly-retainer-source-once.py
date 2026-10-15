"""Prepare NEW read-only closed retention sources; never executes proof or old helpers."""
import pathlib
base=pathlib.Path(__file__).resolve().parent
old=(base/'read-100000-closed-health-transition-readonly-once.py').read_text(encoding='utf-8')
new=old.replace('Read closed100000 originals','Read closed230000 originals').replace('import base64,datetime,hashlib,json,pathlib,shutil,stat,subprocess,sys','import base64,datetime,hashlib,json,os,pathlib,shutil,stat,subprocess,sys')
new=new.replace('workflow-batch-startup-forward-cde8c889-20261015T100000Z','workflow-batch-startup-be837974-20261015T230000Z').replace('lims-workflow-batch-startup-forward-cde8c889-20261015t100000z','lims-workflow-batch-startup-be837974-20261015t230000z').replace('e8e4806968d748fc862d465491a691e2','b962da09082d4fb49c8b9076181b7f4c')
new=new.replace('ExecMainExitTimestamp\'],','ExecMainExitTimestamp,MainPID\'],')
new=new.replace("assert original['status']=='FAILED_OR_REFUSED_RETAIN_ALL_FORWARD_FIX_ONLY' and original['ownedStopError'] is None", "assert original['status']=='FAILED_OR_REFUSED_RETAIN_ALL_FORWARD_FIX_ONLY' and original['ownedStopError'] is None\nassert original['error']=='RuntimeError: Startup memory STOP' and original['closedUtc']=='2026-10-15T22:03:39.298754+00:00'\nassert props.get('MainPID')=='0' and props['MemoryMax']=='805306368' and props['MemorySwapMax']=='0'")
new=new.replace("'.stderr','.txt']", "'.stderr','.txt','.yml','.yaml']")
new=new.replace("['journalctl','-u'", "['journalctl','--all','-u'")
new=new.replace("'CLOSED_HEALTH_TRANSITION_FAILURE_ALL_RETAINED_NO_SQL_DU_OR_REPLAY'", "'CLOSED_STARTUP_MEMORY_FAILURE_ALL_RETAINED_NO_SQL_DU_OR_REPLAY'")
needle="selected={n:json.loads((root/n).read_bytes())"
insert="""# Hash/stat-only preservation of all bound old raw/reader/backup files and assets.
from proof_inputs import prior_records,retained_guard
from proof_contract import BUILD_ROOT,BUILD_RECEIPT_SHA,IMAGE,qualified
prior=prior_records(root);preserved_raw,preserved_assets=retained_guard(prior)
receipt_path=pathlib.Path(BUILD_ROOT)/'build-receipt.json'
receipt_raw=receipt_path.read_bytes();receipt_state=file_state(receipt_path)
assert receipt_state['sha256']==BUILD_RECEIPT_SHA and receipt_state['mode']==0o400
image_raw=subprocess.check_output(['docker','image','inspect',IMAGE],timeout=15)
image_rows=json.loads(image_raw);assert len(image_rows)==1
qualified(json.loads(receipt_raw),receipt_raw,image_rows[0])
assert image_rows==json.loads((root/'qualified-image-inspect-original.json').read_bytes())
for label,raw in [('qualified-original-build-receipt.json',receipt_raw),('qualified-fresh-whole-image-inspect.json',image_raw)]:
    extra.append({'path':label,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'data':base64.b64encode(raw).decode()})
hardware={}
for path in ['/opt/lims','/var/lib/docker','/var/lib/containerd']:
    p=pathlib.Path(path);assert p.resolve()==p and not p.is_symlink()
    v=os.statvfs(path);st=p.stat();assert v.f_frsize==4096
    hardware[path]={'canonicalPath':str(p.resolve()),'device':st.st_dev,'fragmentBytes':v.f_frsize,'freeAvailableBytes':v.f_bavail*v.f_frsize,'sameFilesystemValuesAreNotAdditive':True}
# A second full metadata pass verifies stopped-file stability without another copy or SQL.
for row in inventory:
    s=(root/row['path']).stat()
    assert (s.st_size,s.st_dev,s.st_ino,s.st_mtime_ns,stat.S_IMODE(s.st_mode))==(row['bytes'],row['device'],row['inode'],row['mtimeNs'],row['mode'])
assert [p.relative_to(root).as_posix() for p in sorted(root.rglob('*')) if p.is_file()]==[r['path'] for r in inventory]
"""
assert needle in new;new=new.replace(needle,insert+needle)
needle="'rawEnvironmentStored':False}))"
replace="'rawEnvironmentStored':False,'freshFilesystemMetadataOnly':hardware,'qualifiedOriginalReceiptState':receipt_state,'qualifiedEntireImageUnchanged':True,'boundOldInputRawReaderBackupHashesStatsPreserved':True,'boundOldRawMasterTriple':preserved_raw,'boundOldAssetTree':preserved_assets,'healthPollCounts':{str(n):len(list(root.glob('startup-'+str(n)+'-health-poll-*.json'))) for n in [1,2]},'proofInputState':file_state(root/'proof-input.json')}))"
assert needle in new;new=new.replace(needle,replace)
compile(new,'new-closed-reader','exec')
target=base/'read-startup230000-closed-memory-readonly-once.py'
with target.open('x',encoding='utf-8',newline='\n') as f:f.write(new)
wrapper=(base/'retain-100000-closed-health-transition-once.py').read_text(encoding='utf-8')
wrapper=wrapper.replace('Retain closed100000 originals','Retain closed230000 originals').replace('WP/batch-proof-health-transitions-cde8-20261015','WP/batch-proof-startup-be837974-20261015').replace('first-proof-100000-closed-health-transition-stop','proof230000-closed-memory-originals-once').replace('read-100000-closed-health-transition-readonly-once.py','read-startup230000-closed-memory-readonly-once.py')
wrapper=wrapper.replace("script=REPO/", "script=REPO/")
wrapper=wrapper.replace("r=subprocess.run(['ssh'", "with (DEST/'remote-reader-source.py').open('xb') as f:f.write(script.read_bytes())\nwith (DEST/'command-original.json').open('x',encoding='utf-8') as f:json.dump({'argv':['ssh','-o','BatchMode=yes','-o','ConnectTimeout=15','root@46.19.33.37','python3','-B','-'],'startedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat()},f)\nr=subprocess.run(['ssh'")
compile(wrapper,'new-closed-wrapper','exec')
with (base/'retain-startup230000-closed-memory-originals-once.py').open('x',encoding='utf-8',newline='\n') as f:f.write(wrapper)
print('Prepared two NEW read-only sources; no SSH or proof execution.')
