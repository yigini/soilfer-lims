"""One immutable new evidence-package upload and bounded metadata unit; no adoption or Docker build."""
import argparse,datetime,json,pathlib,subprocess,sys
from forward_metadata_contract import *
from prepare_forward_metadata import fresh_authority
REPO=pathlib.Path(__file__).resolve().parents[2]
OWNER=REPO/'WP/batch-forward-metadata-cde8-20261014'
HOST='root@46.19.33.37'
def run(argv,evidence,label,raw=None,timeout=60):
    try:r=subprocess.run(argv,cwd=REPO,input=raw,capture_output=True,timeout=timeout)
    except subprocess.TimeoutExpired as e:
        for suffix,data in [('stdout',e.stdout or b''),('stderr',e.stderr or b'')]:
            with (evidence/(label+'.partial-'+suffix)).open('xb') as f:f.write(data)
        with (evidence/(label+'.uncertain.json')).open('x',encoding='utf-8') as f:json.dump({'status':'UNKNOWN_TRANSPORT_OUTCOME','neverReplay':True},f)
        raise RuntimeError('Transport uncertain; inspect the same root/unit, never replay')
    for suffix,data in [('stdout',r.stdout),('stderr',r.stderr)]:
        with (evidence/(label+'.'+suffix)).open('xb') as f:f.write(data)
    require(r.returncode==0,'Transport failed or uncertain; inspect same root/unit, never replay');return r.stdout
def main(given):
    require(sys.flags.optimize==0,'Plain Python required')
    package=pathlib.Path(given);require(not package.is_symlink(),'Package alias refused');package=package.resolve()
    require(package.parent==OWNER.resolve() and {p.name for p in package.iterdir()}==REQUIRED and all(p.is_file() and not p.is_symlink() for p in package.iterdir()),'Owned immutable package required')
    load=lambda n:exact_json((package/n).read_bytes())
    spec,index,review,scope,reference=[load(n) for n in ['metadata-input.json','tooling-source-index.json','source-review-original.json','scope-direction-original.json','reference-direction-original.json']]
    validate_spec(spec,index,review,scope,reference)
    for n in SOURCE_FILES:require(sha((package/n).read_bytes())==index['files'][n]['sha256'],'Source package changed')
    for name,module in [('launch_forward_metadata.py','__main__'),('forward_metadata_contract.py','forward_metadata_contract'),('prepare_forward_metadata.py','prepare_forward_metadata')]:require(sha(pathlib.Path(sys.modules[module].__file__).read_bytes())==index['files'][name]['sha256'],'Executed launcher graph differs')
    authority=fresh_authority(review,index)
    require(canonical(exact_json(authority['scope-direction-original.json']))==canonical(scope) and canonical(exact_json(authority['reference-direction-original.json']))==canonical(reference),'Directions changed')
    root=str(safe_root(ROOT_NAME));unit='lims-'+ROOT_NAME.lower();evidence=OWNER/(package.name+'-launch')
    require(not evidence.exists(),'Consumed launch boundary');evidence.mkdir()
    intent={'status':'FIRST_METADATA_LAUNCH_ATTEMPTED_ONCE','startedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'root':root,'unit':unit,'toolingCommit':index['head'],'sourceReviewId':review['id'],'scope':SCOPE,'imageEligibility':False,'neverReplay':True}
    with (evidence/'launch-intent.json').open('x',encoding='utf-8') as f:json.dump(intent,f,indent=2)
    create="import pathlib; p=pathlib.Path("+repr(root)+"); assert p.parent==pathlib.Path('/opt/lims/releases') and not p.exists() and not p.is_symlink(); p.mkdir(mode=0o700); print(str(p))"
    run(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=15',HOST,'python3','-B','-'],evidence,'create-new-metadata-root',create.encode(),30)
    run(['scp','-p',*[str(package/n) for n in sorted(REQUIRED)],HOST+':'+root+'/'],evidence,'upload-metadata-package',timeout=120)
    final=fresh_authority(review,index)
    require(canonical(exact_json(final['scope-direction-original.json']))==canonical(scope) and canonical(exact_json(final['reference-direction-original.json']))==canonical(reference),'Directions changed during upload')
    hashes={n:sha((package/n).read_bytes()) for n in REQUIRED}
    launch='''import hashlib,json,pathlib,subprocess
root=pathlib.Path(ROOT_VALUE);expected=HASH_VALUE;unit=UNIT_VALUE
assert {p.name for p in root.iterdir()}==set(expected)
for n,h in expected.items():
 p=root/n;assert p.is_file() and not p.is_symlink() and hashlib.sha256(p.read_bytes()).hexdigest()==h;n
 p.chmod(0o400)
state=subprocess.check_output(['systemctl','show',unit,'--property=LoadState','--value']).decode().strip()
assert state=='not-found','Never reuse a unit'
args=['systemd-run','--unit',unit,'--property=Type=exec','--property=RuntimeMaxSec=900','--property=MemoryMax=805306368','--property=MemorySwapMax=0','--property=Restart=no','--property=UMask=0077',
 '--property=StandardOutput=append:'+str(root/'unit-stdout-original.log'),'--property=StandardError=append:'+str(root/'unit-stderr-original.log'),'--working-directory',str(root),'/usr/bin/python3','-B',str(root/'collect_forward_metadata.py')]
result=subprocess.run(args,capture_output=True,text=True)
print(json.dumps({'unit':unit,'root':str(root),'launchExitCode':result.returncode,'stdout':result.stdout,'stderr':result.stderr,'imageEligibility':False,'captureComplete':False}))
assert result.returncode==0,'Uncertain launch; never replay'
'''.replace('ROOT_VALUE',repr(root)).replace('HASH_VALUE',repr(hashes)).replace('UNIT_VALUE',repr(unit))
    result=exact_json(run(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=15',HOST,'python3','-B','-'],evidence,'verify-and-launch-new-metadata-unit',launch.encode(),45))
    require(result['launchExitCode']==0 and result['imageEligibility'] is False,'Actual launch response differs')
    record={**intent,'status':'READONLY_METADATA_UNIT_LAUNCHED_OBSERVE_SAME','verifiedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'packageHashes':hashes,'remoteReply':result}
    with (evidence/'launch-record.json').open('x',encoding='utf-8') as f:json.dump(record,f,indent=2)
    print(json.dumps(record))
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--package',required=True);a=p.parse_args();main(a.package)
