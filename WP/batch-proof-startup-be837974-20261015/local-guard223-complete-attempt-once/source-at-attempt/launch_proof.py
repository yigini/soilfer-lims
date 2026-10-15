"""One new source-approved startup proof. Compile every remote template before SSH."""
import argparse,datetime,pathlib,subprocess,sys,time
from proof_contract import *
from proof_files import file_state,write_new
from prepare_proof import REPO,REL,current_evidence
from proof_budget import capacity_probe_source,capacity_gate,package_allowance
from proof_render import render
HOST='root@46.19.33.37'
PREFLIGHT_TEMPLATE='''import pathlib,subprocess,json
root=pathlib.Path(ROOT_VALUE);phase=PHASE_VALUE
for p in [root,*root.parents]:assert not p.is_symlink(),'Root ancestor alias'
assert root.parent==pathlib.Path('/opt/lims/releases') and root.parent.resolve(strict=True)==root.parent
if phase=='BEFORE_ROOT':assert not root.exists(),'Consumed root: never replay'
else:assert root.is_dir() and root.resolve(strict=True)==root,'Exact uploaded root required'
prior=subprocess.run(['systemctl','show',UNIT_VALUE,'--property=LoadState','--value'],capture_output=True,timeout=15)
assert prior.returncode==0 and prior.stdout.strip()==b'not-found' and not prior.stderr,'Unused unit not proved'
exec(compile(CAPACITY_VALUE,'reviewed-capacity-metadata','exec'))
'''
CREATE_TEMPLATE='''import pathlib
p=pathlib.Path(ROOT_VALUE)
for a in [p,*p.parents]:assert not a.is_symlink(),'Root ancestor alias'
assert p.parent==pathlib.Path('/opt/lims/releases') and p.parent.resolve(strict=True)==p.parent and not p.exists()
p.mkdir(mode=0o700)
'''
UNIT_TEMPLATE='''import pathlib,hashlib,subprocess,json
root=pathlib.Path(ROOT_VALUE);expected=HASHES_VALUE
assert root.resolve(strict=True)==root and not root.is_symlink()
assert {p.name for p in root.iterdir()}==set(expected)
for n,d in expected.items():
 p=root/n;assert p.is_file() and not p.is_symlink() and hashlib.sha256(p.read_bytes()).hexdigest()==d,n
 p.chmod(0o400)
unit=UNIT_VALUE
prior=subprocess.run(['systemctl','show',unit,'--property=LoadState','--value'],capture_output=True,timeout=15)
assert prior.returncode==0 and prior.stdout.strip()==b'not-found' and not prior.stderr,'Never reuse unit'
args=['systemd-run','--unit',unit,'--property=Type=exec','--property=RuntimeMaxSec=5400','--property=MemoryMax=805306368','--property=MemorySwapMax=0','--property=Restart=no','--property=UMask=0077','--property=StandardOutput=journal','--property=StandardError=journal','--working-directory',str(root),'/usr/bin/python3','-B',str(root/'run_stopped_proof.py')]
r=subprocess.run(args,capture_output=True,text=True,timeout=30)
print(json.dumps({'unit':unit,'root':str(root),'launchExitCode':r.returncode,'stdout':r.stdout,'stderr':r.stderr,'proofComplete':False,'neverReplay':True}))
assert r.returncode==0,'Unknown launch; inspect same unit, never replay'
'''
def remote_sources(hashes,package_bytes):
    unit='lims-'+ROOT_NAME.lower()
    caps={phase:capacity_probe_source(PRIOR_RAW_DATA,PRIOR_RAW_ASSETS,PRIOR_BACKUP,phase,package_bytes if phase=='BEFORE_ROOT' else 0) for phase in ['BEFORE_ROOT','BEFORE_UNIT']}
    # Both inner capacity programs are compiled by the renderer, then both actual
    # outer preflights and creation/launch programs are compiled before any SSH.
    return {
        'beforeRoot':render(PREFLIGHT_TEMPLATE,{'ROOT_VALUE':str(ROOT),'PHASE_VALUE':'BEFORE_ROOT','UNIT_VALUE':unit,'CAPACITY_VALUE':caps['BEFORE_ROOT'].decode()},'before-root-preflight'),
        'beforeUnit':render(PREFLIGHT_TEMPLATE,{'ROOT_VALUE':str(ROOT),'PHASE_VALUE':'BEFORE_UNIT','UNIT_VALUE':unit,'CAPACITY_VALUE':caps['BEFORE_UNIT'].decode()},'before-unit-preflight'),
        'create':render(CREATE_TEMPLATE,{'ROOT_VALUE':str(ROOT)},'create-new-root'),
        'unit':render(UNIT_TEMPLATE,{'ROOT_VALUE':str(ROOT),'HASHES_VALUE':hashes,'UNIT_VALUE':unit},'launch-new-unit'),
    }
def transport(args,evidence,label,payload=None,timeout=45):
    try:r=subprocess.run(args,cwd=REPO,input=payload,capture_output=True,timeout=timeout)
    except subprocess.TimeoutExpired as e:
        for n,raw in [('stdout',e.stdout or b''),('stderr',e.stderr or b'')]:
            with (evidence/(label+'-partial-'+n+'.log')).open('xb') as f:f.write(raw)
        write_new(evidence/(label+'-uncertain.json'),{'remoteOutcomeUnknown':True,'neverReplay':True});raise RuntimeError('Unknown transport outcome: inspect same root/unit, never retry')
    for n,raw in [('stdout',r.stdout),('stderr',r.stderr)]:
        with (evidence/(label+'-'+n+'.log')).open('xb') as f:f.write(raw)
    require(r.returncode==0,'Transport failed; inspect same root/unit, never replay '+label);return r.stdout
def launch(package):
    given=pathlib.Path(package);require(not given.is_symlink(),'Package alias');package=given.resolve();require(package==REPO/REL/('proof-package-'+ROOT_NAME),'Only the one reviewed package')
    spec=exact_json((package/'proof-input.json').read_bytes());index=exact_json((package/'tooling-source-index.json').read_bytes());review=exact_json((package/'source-review-original.json').read_bytes());approval(review,index)
    require(spec['root']==str(ROOT) and spec['scope']==SCOPE and spec['toolingCommit']==index['head'] and spec['sourceReviewId']==review['id'] and spec.get('retryAllowed') is False,'Package authority differs')
    require(set(spec['packageHashes'])==FILES|set(PRIOR_FILES)|{'tooling-source-index.json','source-review-original.json','build-receipt.json','qualified-image-inspect-original.json','source-index.json','current-evidence.json','compose-source.yml'},'Closed package graph required')
    require({p.name for p in package.iterdir()}==set(spec['packageHashes'])|{'proof-input.json'},'Expanded package')
    for n,digest in spec['packageHashes'].items():require(file_state(package/n)['sha256']==digest,'Package changed '+n)
    for n in FILES:require((REPO/REL/n).read_bytes()==(package/n).read_bytes(),'Executing launcher graph differs')
    hashes={n:file_state(package/n)['sha256'] for n in sorted(spec['packageHashes'])+['proof-input.json']}
    allowance=package_allowance({n:file_state(package/n)['bytes'] for n in hashes})
    # Required sequencing: fully render and compile all actual remote programs
    # before even the first metadata-only SSH call.
    programs=remote_sources(hashes,allowance)
    current_evidence(review,index)
    evidence=REPO/REL/('proof-launch-'+ROOT_NAME);require(not evidence.exists(),'Consumed/uncertain launch');evidence.mkdir(mode=0o700)
    write_new(evidence/'launch-intent.json',{'startedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'root':str(ROOT),'scope':SCOPE,'sourceReviewId':review['id'],'futurePackageAllocationBytes':allowance,'allRemoteTemplatesCompiledBeforeAnySsh':True,'retryAllowed':False,'neverReplay':True})
    for name,raw in programs.items():
        with (evidence/(name+'-rendered.py')).open('xb') as f:f.write(raw)
    ssh=['ssh','-o','BatchMode=yes','-o','ConnectTimeout=15',HOST,'python3','-B','-']
    raw=transport(ssh,evidence,'metadata-capacity-before-root',programs['beforeRoot']);first=exact_json(raw);capacity_gate(first,'BEFORE_ROOT',allowance)
    transport(ssh,evidence,'create-root',programs['create'])
    transport(['scp','-p',*[str(package/n) for n in sorted(hashes)],HOST+':'+str(ROOT)+'/'],evidence,'upload-package',timeout=180)
    # Recheck the complete published/current authority after upload.
    current_evidence(review,index)
    raw=transport(ssh,evidence,'metadata-capacity-immediately-before-unit',programs['beforeUnit']);second=exact_json(raw);capacity_gate(second,'BEFORE_UNIT',0)
    require({p:r['device'] for p,r in first['hardware'].items()}=={p:r['device'] for p,r in second['hardware'].items()},'Hardware topology changed before launch')
    result=transport(ssh,evidence,'launch-once',programs['unit']);write_new(evidence/'launch-record.json',exact_json(result));print(result.decode())
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--package',required=True);a=p.parse_args();launch(a.package)

