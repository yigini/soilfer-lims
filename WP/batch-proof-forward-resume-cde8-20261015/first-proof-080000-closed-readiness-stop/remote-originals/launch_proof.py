"""Upload/launch one NEW source-approved proof root. Unknown outcomes are never replayed."""
import argparse,datetime,pathlib,subprocess,sys
from proof_contract import *
from proof_files import file_state,write_new
from prepare_proof import REPO,REL,current_evidence
from proof_budget import capacity_probe_source,capacity_gate

HOST='root@46.19.33.37'
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
    require(spec['root']==str(ROOT) and spec['scope']==SCOPE and spec['toolingCommit']==index['head'] and spec['sourceReviewId']==review['id'],'Package authority differs')
    require(set(spec['packageHashes'])==FILES|set(PRIOR_FILES)|{'tooling-source-index.json','source-review-original.json','build-receipt.json','qualified-image-inspect-original.json','source-index.json','current-evidence.json'},'Closed package graph required')
    require({p.name for p in package.iterdir()}==set(spec['packageHashes'])|{'proof-input.json'},'Expanded package')
    for n,digest in spec['packageHashes'].items():require(file_state(package/n)['sha256']==digest,'Package changed '+n)
    for n in FILES:require((REPO/REL/n).read_bytes()==(package/n).read_bytes(),'Executing launcher graph differs')
    current_evidence(review,index)
    evidence=REPO/REL/('proof-launch-'+ROOT_NAME);require(not evidence.exists(),'Consumed/uncertain launch');evidence.mkdir(mode=0o700)
    write_new(evidence/'launch-intent.json',{'startedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'root':str(ROOT),'scope':SCOPE,'sourceReviewId':review['id'],'neverReplay':True})
    def capacity(label):
        raw=transport(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=15',HOST,'python3','-B','-'],evidence,label,capacity_probe_source(PRIOR_RAW_DATA,PRIOR_RAW_ASSETS))
        capacity_gate(exact_json(raw))
    # Known insufficient capacity stops BEFORE any new remote root/package/unit.
    capacity('metadata-capacity-before-root')
    create="import pathlib; p=pathlib.Path("+repr(str(ROOT))+"); assert p.parent==pathlib.Path('/opt/lims/releases') and not p.exists() and not p.is_symlink(); p.mkdir(mode=0o700)"
    transport(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=15',HOST,'python3','-B','-'],evidence,'create-root',create.encode())
    transport(['scp','-p',*[str(package/n) for n in sorted(spec['packageHashes'])+['proof-input.json']],HOST+':'+str(ROOT)+'/'],evidence,'upload-package',timeout=180)
    # Refresh exact source/app authorities again after upload, immediately before launch.
    current_evidence(review,index);capacity('metadata-capacity-immediately-before-unit');hashes={n:file_state(package/n)['sha256'] for n in sorted(spec['packageHashes'])+['proof-input.json']}
    unit='lims-'+ROOT_NAME.lower()
    remote='''import pathlib,hashlib,subprocess,json
root=pathlib.Path(ROOT_VALUE);expected=HASHES_VALUE
assert {p.name for p in root.iterdir()}==set(expected)
for n,d in expected.items():
 p=root/n;assert p.is_file() and not p.is_symlink() and hashlib.sha256(p.read_bytes()).hexdigest()==d,n
 p.chmod(0o400)
unit=UNIT_VALUE
prior=subprocess.run(['systemctl','show',unit,'--property=LoadState','--value'],capture_output=True,text=True)
assert prior.stdout.strip()=='not-found','Never reuse unit'
args=['systemd-run','--unit',unit,'--property=Type=exec','--property=RuntimeMaxSec=5400','--property=MemoryMax=805306368','--property=MemorySwapMax=0','--property=Restart=no','--property=UMask=0077','--property=StandardOutput=journal','--property=StandardError=journal','--working-directory',str(root),'/usr/bin/python3','-B',str(root/'run_stopped_proof.py')]
r=subprocess.run(args,capture_output=True,text=True)
print(json.dumps({'unit':unit,'root':str(root),'launchExitCode':r.returncode,'stdout':r.stdout,'stderr':r.stderr,'proofComplete':False,'neverReplay':True}))
assert r.returncode==0,'Unknown launch; inspect same unit, never replay'
'''.replace('ROOT_VALUE',repr(str(ROOT))).replace('HASHES_VALUE',repr(hashes)).replace('UNIT_VALUE',repr(unit))
    result=transport(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=15',HOST,'python3','-B','-'],evidence,'launch-once',remote.encode());write_new(evidence/'launch-record.json',exact_json(result));print(result.decode())
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--package',required=True);a=p.parse_args();launch(a.package)
