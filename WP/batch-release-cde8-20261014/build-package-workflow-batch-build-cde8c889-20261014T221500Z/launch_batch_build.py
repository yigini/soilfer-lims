"""One source-approved immutable build-package upload and unit launch. No database path."""
import argparse,datetime,hashlib,json,pathlib,subprocess,sys
from batch_build_contract import *
from prepare_batch_build import current_evidence

REPO=pathlib.Path(__file__).resolve().parents[2]
HOST='root@46.19.33.37'
def run(argv,root,label,input=None,timeout=240):
    try:result=subprocess.run(argv,cwd=REPO,input=input,capture_output=True,timeout=timeout)
    except subprocess.TimeoutExpired as error:
        for suffix,data in [('stdout',error.stdout or b''),('stderr',error.stderr or b'')]:
            with (root/(label+'.'+suffix)).open('xb') as f:f.write(data.encode() if isinstance(data,str) else data)
        (root/(label+'-uncertain.json')).write_text(json.dumps({'timeoutSeconds':timeout,'remoteOutcomeUnknown':True,'neverRetry':True})+'\n',encoding='utf-8')
        raise RuntimeError('Transport timed out; inspect the same root/unit, never replay') from error
    for suffix,data in [('stdout',result.stdout),('stderr',result.stderr)]:
        with (root/(label+'.'+suffix)).open('xb') as f:f.write(data)
    require(result.returncode==0,'Transport outcome requires inspection; never retry '+label)
    return result.stdout
def main(package):
    require(sys.flags.optimize==0,'Plain Python required')
    given=pathlib.Path(package);require(not given.is_symlink(),'Package aliases refuse')
    package=given.resolve();owner=REPO/'WP/batch-release-cde8-20261014'
    require(package.parent==owner.resolve() and not package.is_symlink(),'Package must be in the owned batch directory')
    require({p.name for p in package.iterdir()}==REQUIRED_ARTIFACTS and all(p.is_file() and not p.is_symlink() for p in package.iterdir()),'Package inventory or aliases differ')
    spec=json_exact((package/'build-input.json').read_bytes());index=json_exact((package/'tooling-source-index.json').read_bytes());review=json_exact((package/'source-review-original.json').read_bytes())
    validate_spec(spec,index,review)
    for name in ['launch_batch_build.py','batch_build_contract.py','prepare_batch_build.py']:
        p=pathlib.Path(sys.modules[{'launch_batch_build.py':'__main__','batch_build_contract.py':'batch_build_contract','prepare_batch_build.py':'prepare_batch_build'}[name]].__file__)
        require(sha(p.read_bytes())==index['files'][name]['sha256'],'Executed launcher authority differs '+name)
    for name,row in index['files'].items():require(sha((package/name).read_bytes())==row['sha256'],'Tooling package changed')
    require(sha((package/'source.tar.gz').read_bytes())==spec['archiveSha256'] and sha((package/'source-index.json').read_bytes())==spec['applicationIndexSha256'],'Source package changed')
    fresh_review=json_exact(subprocess.check_output(['gh','api',f'repos/yigini/soilfer-lims/issues/comments/{review["id"]}'],cwd=REPO))
    require(canonical(fresh_review)==canonical(review),'Source approval changed after preparation')
    fresh=current_evidence()
    for a in AUDITS:
        n=f'pr{a["pr"]}-actual-pass-original.json'
        require(canonical(json_exact(fresh[n]))==canonical(json_exact((package/n).read_bytes())),'Application audit changed after preparation')
    pages=json_exact(subprocess.check_output(['gh','api','--paginate','--slurp','repos/yigini/soilfer-lims/issues/162/comments?per_page=100'],cwd=REPO))
    no_later_source_failure([v for page in pages for v in page],review,index['head'])
    root=str(safe_build_root(spec['rootName']));unit='lims-'+spec['rootName'].lower()
    evidence=owner/(package.name+'-launch')
    require(not evidence.exists() and not evidence.is_symlink(),'Consumed or uncertain launch; never retry')
    evidence.mkdir()
    payload={'startedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'status':'LAUNCH_ATTEMPTED_ONCE','scope':SCOPE,'root':root,'unit':unit,'head':CANDIDATE,
        'sourceReviewId':review['id'],'toolingCommit':index['head'],'neverRetry':True,'productionDatabaseMounts':0,'productionDatabaseConnections':0,'proofLaunches':0,'productionDeployments':0}
    (evidence/'launch-intent.json').write_text(json.dumps(payload,indent=2)+'\n',encoding='utf-8')
    create="import pathlib,json; p=pathlib.Path("+repr(root)+"); assert p.parent==pathlib.Path('/opt/lims/releases') and not p.exists() and not p.is_symlink(), 'Never reuse a build root'; p.mkdir(mode=0o700); print(json.dumps({'created':str(p),'productionDatabaseOperations':0}))"
    run(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=15',HOST,'python3','-B','-'],evidence,'create-new-root',input=create.encode(),timeout=30)
    paths=[str(package/name) for name in sorted(REQUIRED_ARTIFACTS)]
    run(['scp','-p',*paths,HOST+':'+root+'/'],evidence,'upload-new-build-package',timeout=300)
    # Source upload is not a lease on an earlier main or reviewer decision.
    final_evidence=current_evidence()
    final_review=json_exact(subprocess.check_output(['gh','api',f'repos/yigini/soilfer-lims/issues/comments/{review["id"]}'],cwd=REPO))
    require(canonical(final_review)==canonical(review),'Source approval changed during upload')
    final_pages=json_exact(subprocess.check_output(['gh','api','--paginate','--slurp','repos/yigini/soilfer-lims/issues/162/comments?per_page=100'],cwd=REPO))
    no_later_source_failure([v for page in final_pages for v in page],review,index['head'])
    for a in AUDITS:
        n=f'pr{a["pr"]}-actual-pass-original.json'
        require(canonical(json_exact(final_evidence[n]))==canonical(json_exact((package/n).read_bytes())),'Application audit changed during upload')
    (evidence/'current-main-before-launch.json').write_bytes(final_evidence['main-original.json'])
    hashes={n:sha((package/n).read_bytes()) for n in REQUIRED_ARTIFACTS}
    launch='''import pathlib,json,hashlib,subprocess
root=pathlib.Path(ROOT_VALUE)
expected=HASH_VALUE
assert {p.name for p in root.iterdir()}==set(expected)
for name,digest in expected.items():
 p=root/name;assert p.is_file() and not p.is_symlink() and hashlib.sha256(p.read_bytes()).hexdigest()==digest,name
 p.chmod(0o400)
unit=UNIT_VALUE
state=subprocess.run(['systemctl','show',unit,'--property=LoadState','--value'],capture_output=True,text=True)
assert state.stdout.strip()=='not-found','Never reuse a unit'
args=['systemd-run','--unit',unit,'--property=Type=exec','--property=RuntimeMaxSec=2700','--property=Restart=no','--property=UMask=0077',
 '--property=StandardOutput=journal','--property=StandardError=journal','--working-directory',str(root),'/usr/bin/python3','-B',str(root/'batch_build.py')]
result=subprocess.run(args,capture_output=True,text=True)
print(json.dumps({'unit':unit,'root':str(root),'launchExitCode':result.returncode,'stdout':result.stdout,'stderr':result.stderr,'buildComplete':False,'databaseConnections':0}))
assert result.returncode==0,'Uncertain launch outcome; never replay'
'''.replace('ROOT_VALUE',repr(root)).replace('HASH_VALUE',repr(hashes)).replace('UNIT_VALUE',repr(unit))
    result=run(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=15',HOST,'python3','-B','-'],evidence,'verify-and-launch-once',input=launch.encode(),timeout=45)
    reply=json_exact(result);require(reply['launchExitCode']==0 and reply['buildComplete'] is False,'Launch receipt differs')
    payload.update(status='BUILD_UNIT_LAUNCHED_OBSERVE_SAME_UNIT',verifiedUtc=datetime.datetime.now(datetime.UTC).isoformat(),packageFileHashes=hashes,remoteReply=reply)
    (evidence/'launch-record.json').write_text(json.dumps(payload,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(payload));print('Observe this same build only; never replay this launcher, unit or builder.')
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--package',required=True);a=p.parse_args();main(a.package)
