"""Launch the reviewed R2 package once at its one new root/unit; unknown means observe."""
import argparse,base64,datetime,os,pathlib,subprocess,sys
from r2_contract import *
from prepare_r2 import REPO,REL,current_evidence,gh,raw_git

def launch(package):
    require(sys.flags.optimize==0,'Plain Python required')
    package=pathlib.Path(package).resolve();require(package==REPO/REL/'reviewed-r2-package-once' and not package.is_symlink(),'Exact package path required')
    spec=json_exact((package/'package-input.json').read_bytes());index=json_exact((package/'source-index.json').read_bytes());review=json_exact((package/'source-review.json').read_bytes())
    validate_package(spec,index,review,{p.name:p.read_bytes() for p in package.iterdir() if p.is_file()})
    for n in SOURCE_FILES:
        raw=raw_git(index['head'],REL+n)[0];require(raw==(package/n).read_bytes(),'Packaged source changed')
    require(pathlib.Path(__file__).read_bytes()==(package/'launch_r2.py').read_bytes() and pathlib.Path(sys.modules['r2_contract'].__file__).read_bytes()==(package/'r2_contract.py').read_bytes(),'Actually executing launcher/contract differs')
    evidence,history=current_evidence();fresh=json_exact(gh('repos/yigini/soilfer-lims/issues/comments/'+str(review['id'])))
    validate_source_review(fresh,index['head'],index);require(canonical(fresh)==canonical(review),'Review changed since preparation');no_later_source_failure(history,review,index['head'])
    dest=REPO/REL/'launch-reviewed-r2-once';require(not dest.exists(),'Launcher consumed; inspect same unit, never replay');dest.mkdir()
    def save(n,v):
        with (dest/n).open('xb') as f:f.write(v)
    for n,v in evidence.items():save('before-'+n,v)
    save('intent-once.json',canonical({'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'root':ROOT,'unit':UNIT,'sourceHead':index['head'],'neverReplay':True}))
    def ssh(name,code):
        save(name+'-source.py',code.encode())
        try:r=subprocess.run(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=15','root@46.19.33.37','python3','-B','-'],cwd=REPO,input=code.encode(),capture_output=True,timeout=60)
        except subprocess.TimeoutExpired as e:
            save(name+'-timeout-stdout.log',e.stdout or b'');save(name+'-timeout-stderr.log',e.stderr or b'');raise RuntimeError('SSH outcome unknown; never replay')
        save(name+'-stdout.json',r.stdout);save(name+'-stderr.log',r.stderr);require(r.returncode==0,'Remote boundary failed/unknown; inspect, never replay');return json_exact(r.stdout)
    encoded={p.name:base64.b64encode(p.read_bytes()).decode() for p in package.iterdir() if p.is_file()}
    # The entire remote source below is part of this exact reviewed launcher.
    create='''import base64,hashlib,json,os,pathlib,stat,subprocess
root=pathlib.Path(ROOT_VALUE);unit=UNIT_VALUE;encoded=ENCODED_VALUE
assert not root.exists() and not root.is_symlink(),'One new root only'
for p in [root.parent,*root.parent.parents]:assert p.is_dir() and not p.is_symlink()
r=subprocess.run(['systemctl','show',unit,'--property=LoadState','--value'],capture_output=True,text=True)
assert r.returncode==0 and r.stdout.strip()=='not-found' and not r.stderr,'Unit must be unused'
for p in ['/opt/lims','/var/lib/docker','/var/lib/containerd']:
 q=pathlib.Path(p);assert str(q.resolve())==p and not q.is_symlink()
 v=os.statvfs(p);assert v.f_frsize==4096 and v.f_bavail*v.f_frsize>=FLOOR_VALUE+RESERVE_VALUE
original=pathlib.Path(BUILD_ROOT_VALUE)/'build-receipt.json'
assert original.is_file() and not original.is_symlink() and stat.S_IMODE(original.stat().st_mode)==0o400 and hashlib.sha256(original.read_bytes()).hexdigest()==RECEIPT_VALUE
root.mkdir(mode=0o700)
for n,b64 in encoded.items():
 assert pathlib.PurePosixPath(n).name==n
 fd=os.open(str(root/n),os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o400)
 with os.fdopen(fd,'wb') as f:f.write(base64.b64decode(b64));f.flush();os.fsync(f.fileno())
print(json.dumps({'root':str(root),'status':'CREATED_NOT_LAUNCHED','fileSha256':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in root.iterdir()}}))
'''
    replacements={'ROOT_VALUE':repr(ROOT),'UNIT_VALUE':repr(UNIT),'ENCODED_VALUE':repr(encoded),'FLOOR_VALUE':str(FLOOR),'RESERVE_VALUE':str(LOG_RESERVE),'BUILD_ROOT_VALUE':repr(BUILD_ROOT),'RECEIPT_VALUE':repr(BUILD_RECEIPT_SHA)}
    create=render_remote_source(create,replacements)
    created=ssh('exclusive-root-upload',create);hashes={n:sha(base64.b64decode(v)) for n,v in encoded.items()};require(created['fileSha256']==hashes,'Uploaded package differs')
    final_evidence,history=current_evidence();final_review=json_exact(gh('repos/yigini/soilfer-lims/issues/comments/'+str(review['id'])))
    validate_source_review(final_review,index['head'],index);require(canonical(final_review)==canonical(review),'Review changed during upload');no_later_source_failure(history,review,index['head'])
    for n,v in final_evidence.items():save('before-unit-'+n,v)
    unit_code='''import hashlib,json,os,pathlib,subprocess
root=pathlib.Path(ROOT_VALUE);expected=HASHES_VALUE;unit=UNIT_VALUE
assert {p.name for p in root.iterdir()}==set(expected)
for n,h in expected.items():
 p=root/n;assert p.is_file() and not p.is_symlink() and hashlib.sha256(p.read_bytes()).hexdigest()==h
for p in ['/opt/lims','/var/lib/docker','/var/lib/containerd']:
 q=pathlib.Path(p);assert str(q.resolve())==p and not q.is_symlink()
 v=os.statvfs(p);assert v.f_frsize==4096 and v.f_bavail*v.f_frsize>=FLOOR_VALUE+RESERVE_VALUE
r=subprocess.run(['systemctl','show',unit,'--property=LoadState','--value'],capture_output=True,text=True)
assert r.returncode==0 and r.stdout.strip()=='not-found' and not r.stderr
args=['systemd-run','--unit',unit,'--property=Type=exec','--property=RuntimeMaxSec=2400','--property=MemoryMax=805306368','--property=MemorySwapMax=0','--property=Restart=no','--property=UMask=0077','--property=StandardOutput=journal','--property=StandardError=journal','--working-directory',str(root),'/usr/bin/python3','-B',str(root/'r2_cache.py')]
r=subprocess.run(args,capture_output=True,text=True)
print(json.dumps({'root':str(root),'unit':unit,'argv':args,'exitCode':r.returncode,'stdout':r.stdout,'stderr':r.stderr,'complete':False}))
assert r.returncode==0,'Unknown launch outcome; never replay'
'''
    unit_code=render_remote_source(unit_code,{**{k:replacements[k] for k in ['ROOT_VALUE','UNIT_VALUE','FLOOR_VALUE','RESERVE_VALUE']},'HASHES_VALUE':repr(hashes)})
    reply=ssh('unit-launch-once',unit_code);require(reply['exitCode']==0,'Launch unconfirmed; never replay')
    save('launch-record.json',canonical({'status':'ONE_R2_UNIT_LAUNCHED_OBSERVE_SAME_UNIT','root':ROOT,'unit':UNIT,'complete':False,'retryAllowed':False}))
    print(json.dumps(reply))
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--package',required=True);a=p.parse_args();launch(a.package)
