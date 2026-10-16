"""Fresh-authority/fresh-R4 single launches; never redispatch unknown outcomes."""
import argparse,base64,json,pathlib,subprocess,time,os
import diagnostic_contract as c
import diagnostic_authority as authority
from prepare_diagnostic import source_index,later_comments
W=pathlib.Path(__file__).resolve().parents[2]
def remote_sources(files,mode,future):
    c.require(mode in c.MODES,'Exact diagnostic mode required')
    payload={n:base64.b64encode(raw).decode() for n,raw in files.items()}
    # Whole Python values rendered once. ALL actual programs compile before SSH.
    common="""import base64,json,pathlib,subprocess,sys,types,importlib.abc,importlib.util
PAYLOAD="""+repr(payload)+"""
MODE="""+repr(mode)+"""
class MemorySource(importlib.abc.MetaPathFinder,importlib.abc.Loader):
 def find_spec(self,name,path=None,target=None):
  return importlib.util.spec_from_loader(name,self) if name+'.py' in PAYLOAD else None
 def create_module(self,spec):return None
 def exec_module(self,module):
  module.__file__='<reviewed-memory>/'+module.__name__+'.py'
  exec(compile(base64.b64decode(PAYLOAD[module.__name__+'.py']),module.__file__,'exec'),module.__dict__)
sys.meta_path.insert(0,MemorySource())
import diagnostic_contract as c,diagnostic_io as io
pins=json.loads(base64.b64decode(PAYLOAD['diagnostic-pins.json']))
root=pathlib.Path(c.ROOT)
def unused(unit):
 r=subprocess.run(['systemctl','show','--property=LoadState','--value',unit],capture_output=True,timeout=15)
 c.require(r.returncode in (0,1,4) and r.stdout.strip()==b'not-found','New precheck unit must be unused')
def save(n,v):
 p=root/n
 with p.open('xb') as f:f.write(c.canonical(v)+b'\\n')
 p.chmod(0o400)
"""
    preflight=common+"""
unused(c.UNITS[MODE])
if MODE=='comparator':
 c.require(not root.exists() and not root.is_symlink(),'New diagnostic root already consumed')
 unused(c.UNITS['hook'])
 io.originals(pins,content=False)
else:
 c.require(root.is_dir() and (root/'comparator/public-result.json').is_file() and not (root/'hook').exists(),'Comparator must actually close before hook check')
 r=subprocess.run(['systemctl','is-active',c.UNITS['comparator']],capture_output=True,timeout=15)
 c.require(r.stdout.strip() in (b'inactive',b'failed',b'unknown'),'Comparator must not still run')
card=io.capacity(pins,FUTURE,copies_pending=MODE=='comparator')
print(json.dumps(card))
""".replace('FUTURE',repr(future if mode=='comparator' else 0))
    upload=common+"""
unused(c.UNITS[MODE])
if MODE=='comparator':
 io.originals(pins,content=False);card=io.capacity(pins,FUTURE,copies_pending=True)
 root.mkdir(mode=0o700)
 for n,encoded in PAYLOAD.items():
  p=root/n;p.parent.mkdir(parents=True,exist_ok=True)
  with p.open('xb') as f:f.write(base64.b64decode(encoded))
  p.chmod(0o400)
 save('r4-before-root.json',card)
else:
 c.require(root.is_dir() and not (root/'hook').exists(),'Hook check root consumed')
for n,encoded in PAYLOAD.items():c.require((root/n).read_bytes()==base64.b64decode(encoded),'Uploaded precheck package differs')
card=io.capacity(pins,copies_pending=MODE=='comparator');save('r4-before-unit-'+MODE+'.json',card)
unused(c.UNITS[MODE])
argv=['systemd-run','--unit='+c.UNITS[MODE][:-8],'--no-block','--collect','--property=Type=exec','--property=MemoryMax=805306368','--property=MemorySwapMax=0','--property=UMask=0077','--property=Restart=no','--property=RuntimeMaxSec='+str(c.SECONDS[MODE]),'--property=StandardOutput=journal','--property=StandardError=journal','--property=WorkingDirectory='+str(root),'--property=Environment=PYTHONDONTWRITEBYTECODE=1']
if MODE=='comparator':argv+=['--property=PrivateNetwork=yes','--property=IPAddressDeny=any','--property=RestrictAddressFamilies=AF_UNIX','--property=ProtectSystem=strict','--property=ReadWritePaths='+str(root),'--property=InaccessiblePaths=-/var/run/docker.sock -/run/docker.sock -/var/lib/docker/volumes/lims_lims-data -/opt/lims/backups -/opt/lims/audit-backups']
argv+=['/usr/bin/python3','-B',str(root/'run_diagnostic.py'),MODE]
save('unit-intent-'+MODE+'.json',{'argv':argv,'oneRunNoRetry':True})
r=subprocess.run(argv,capture_output=True,timeout=30)
save('unit-dispatch-'+MODE+'.json',{'argv':argv,'returnCode':r.returncode,'stdout':r.stdout.decode('utf-8','replace'),'stderr':r.stderr.decode('utf-8','replace')})
c.require(r.returncode==0,'Unknown unit outcome: inspect same root/unit never redispatch')
print(json.dumps({'root':str(root),'unit':c.UNITS[MODE],'dispatched':True}))
""".replace('FUTURE',repr(future))
    programs={'preflight':preflight.encode(),'uploadAndUnit':upload.encode()}
    for name,raw in programs.items():compile(raw,'actual-'+name,'exec')
    return programs
def launch(mode):
    package=W/c.REL/('package-'+c.NAME);spec=json.loads((package/'package-spec.json').read_bytes())
    files={n:(package/n).read_bytes() for n in spec['fileHashes']}
    c.require(all(c.sha(raw)==spec['fileHashes'][n] for n,raw in files.items()),'Precheck package changed')
    source,index=source_index(spec['sourceHead']);review=authority.read('repos/yigini/soilfer-lims/issues/comments/'+str(spec['sourceReviewId']));c.approval(review,index)
    c.require(c.canonical(review)+b'\n'==files['diagnostic-source-review.json'] and all(source[n]==files[n] for n in source),'Review or executed launch source changed')
    evidence=authority.current_evidence();later_comments(evidence,review,index)
    # The fresh current authority is retained locally; package authority has the
    # same pinned semantics and remains byte immutable on host.
    programs=remote_sources(files,mode,spec['futurePackageBytes'])
    intent=package/('launch-intent-'+mode+'.json');c.require(not intent.exists(),'Precheck launch consumed or uncertain')
    with intent.open('xb') as f:f.write(c.canonical({'mode':mode,'sourceHead':index['head'],'freshAuthority':evidence,'startedUnix':time.time(),'noRetry':True}));f.flush();os.fsync(f.fileno())
    for name,raw in programs.items():
        (package/('actual-'+mode+'-'+name+'.py')).write_bytes(raw)
        r=subprocess.run(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=15','root@46.19.33.37','python3','-B','-'],input=raw,capture_output=True,timeout=120)
        for suffix,data in [('stdout',r.stdout),('stderr',r.stderr)]:
            with (package/(mode+'-'+name+'-'+suffix+'.log')).open('xb') as f:f.write(data)
        with (package/(mode+'-'+name+'-exit.json')).open('xb') as f:f.write(c.canonical({'returnCode':r.returncode}))
        c.require(r.returncode==0,'Consumed launch refused or uncertain; inspect SAME root/unit only')
    print(json.dumps({'mode':mode,'root':str(c.ROOT),'unit':c.UNITS[mode],'launchedOnce':True}))
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--check',choices=c.MODES,required=True);launch(p.parse_args().check)
