"""Retain the same proof's later active observation and runtime R4, no operator."""
import datetime,pathlib,subprocess,sys
R=pathlib.Path(__file__).resolve().parents[2];REL='WP/batch-proof-startup-be837974-20261015/';S=R/REL;D=S/'second-proof230000-opening-publication-once';O=S/'second-proof230000-readonly-observation-once'
BASE='80b5b9894a3571ea2d476357666de7c0d1d97209'
sys.path.insert(0,str(S))
from proof_contract import *
from proof_budget import capacity_gate
def git(*a):return subprocess.check_output(['git','-c','core.longpaths=true',*a],cwd=R)
def oid(raw):return hashlib.sha1(('blob '+str(len(raw))+'\0').encode()+raw).hexdigest()
require(git('rev-parse','HEAD').decode().strip()==BASE and git('branch','--show-current').decode().strip()=='audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip() and not D.exists(),'Same writer/base/one publication required')
obs=exact_json((O/'stdout-original.json').read_bytes());props=dict(line.split('=',1) for line in obs['systemctl']['stdout'].splitlines() if '=' in line)
require(obs['systemctl']['exitCode']==0 and props['ActiveState']=='active' and props['SubState']=='running' and props['InvocationID']=='b962da09082d4fb49c8b9076181b7f4c' and props['MemoryMax']=='805306368' and props['MemorySwapMax']=='0','Same active invocation required')
require(not any(n in obs['selectedOriginalUtf8'] for n in ['proof-receipt.json','proof-terminal-refusal.json']),'Terminal at this observation; retain in honest successor')
runtime=exact_json(obs['selectedOriginalUtf8']['fresh-r4-before-proof-copies.json']);capacity_gate(runtime,'RUNTIME_BIND',0)
initial=exact_json((S/'first-proof230000-opening-publication-once/opening-record.json').read_bytes())
require({p:v['device'] for p,v in runtime['hardware'].items()}=={p:v['device'] for p,v in initial['beforeRootR4']['hardware'].items()},'Runtime hardware changed')
package=exact_json((S/'reviewed-package6203010192-publication-once/package-publication-validation.json').read_bytes());require({n:r['sha256'] for n,r in obs['packageHashes'].items()}==package['packageFileHashes'],'42 package hashes differ')
index=exact_json((S/'actual-source-pass6203010192-once/tooling-source-index.json').read_bytes())
for n,d in graph(index).items():require(sha((S/n).read_bytes())==d,'Reviewed source changed '+n)
frozen=exact_json((R/'WP/startup-order-readiness-20261015/full-pinned-copy-retention-bound-ordinary-once/source-before.json').read_bytes());require(len(frozen)==1333,'Frozen inventory differs')
for p,d in frozen.items():require(sha((R/p).read_bytes())==d,'Application input changed '+p)
D.mkdir()
def save(n,raw):
    with (D/n).open('xb') as f:f.write(raw)
record={'status':'SAME_STARTUP_PROOF_ACTIVE_AT_SECOND_OBSERVATION_NO_TERMINAL_CLAIM','observedUtc':obs['observedUtc'],'invocationId':props['InvocationID'],'root':str(ROOT),'unit':obs['unit'],'actualUnitProperties':props,'runtimeR4':runtime,'fileCount':len(obs['fileMetadata']),'selectedOriginalNames':sorted(obs['selectedOriginalUtf8']),'startup1Attempt':exact_json(obs['selectedOriginalUtf8']['startup-1-default-entrypoint-attempt.json']),'all42PackageHashesAnd14Plus1333SourcesVerified':True,'newOperatorCalls':0,'proofComplete':False,'retryAllowed':False}
save('later-opening-record.json',canonical(record)+b'\n')
lead=f'''LATEST ACTUAL SECOND PROOF OPENING — {obs['observedUtc']}. SAME230000 invocation{props['InvocationID']} ACTIVE/running/805306368Swap0/90min/current{props['MemoryCurrent']}peak{props['MemoryPeak']} OPENONLY/1100files. ActualruntimeR4{runtime['observedUtc']}required{runtime['requiredBytes']}free{min(runtime['freeBytes'].values())}/10GBincluded/packagealreadyoccupied/3SAMEFSnotadditive PASSED; beforeROOT+UNIT separatelypassed. Firstowneddefaultentrypointattempt id{record['startup1Attempt']['id']} observed, no startupresult/wholeproofterminal atthisboundary. All42packagehashes+14source+1333appinputs unchanged. Fullreadonlyoriginals/runtimeR4 at {REL}second-proof230000-opening-publication-once/publication-index.json. Source29fa/PASS6203010192/package6e7036d0/launch+first33raw80b5b989 remainbound. No localrunnerretainerafterpublication;ONEremoteproofactiveATOBSERVATION. NEXTreasonableintervalNEWuniqueREADONLYobserver SAMErootunit; NEVERredispatch/sourcechange/secondwriter/retry/cleanup. ActualCLOSEDretainalloriginals/fulljournals/healthpolls/packagehashes/accounting/preservation/publish+ONE@claude162result/PASSACKONLYthere. JobsOFFONLY/notreleasequalified/jobsONkitgatedeploylater/mainmergeHOLD/heartbeat2min/sciencehistoryR1-R5/humans held.

'''
readmes=[R/'WP/audit-release-eb6de2e8/README.md',R/'WP/runtime-recovery-kobo/README.md']
for p in readmes:p.write_bytes(lead.encode()+p.read_bytes())
paths=sorted(O.iterdir())+sorted(D.iterdir())+[R/'WP/backlog-resume-20261013/observe-startup-proof230000-second-readonly-once.py',pathlib.Path(__file__),*readmes]
save('publication-index.json',canonical({'baseAudit':BASE,'files':[{'path':p.relative_to(R).as_posix(),'length':len(p.read_bytes()),'sha256':sha(p.read_bytes()),'gitBlobOid':oid(p.read_bytes())} for p in paths]})+b'\n');paths.append(D/'publication-index.json');names=[p.relative_to(R).as_posix() for p in paths]
for i in range(0,len(names),15):git('-c','core.autocrlf=false','add','-f','--',*names[i:i+15])
require(set(git('diff','--cached','--name-only').decode().splitlines())==set(names),'Staged ownership differs');tree=git('write-tree').decode().strip()
for p,n in zip(paths,names):require(git('show',tree+':'+n)==p.read_bytes() and git('rev-parse',tree+':'+n).decode().strip()==oid(p.read_bytes()),'Staged raw identity differs')
git('commit','-m','Retain same startup proof runtime capacity and second opening');head=git('rev-parse','HEAD').decode().strip()
for p,n in zip(paths,names):require(git('show',head+':'+n)==p.read_bytes(),'Committed raw identity differs')
git('push','origin','audit/release-eb6de2e8');require(git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head,'Published writer differs')
print(json.dumps({'audit':head,'rawOidShaVerifiedBlobs':len(paths),'observedUtc':obs['observedUtc'],'runtimeR4RequiredBytes':runtime['requiredBytes'],'runtimeFreeBytes':runtime['freeBytes'],'proofComplete':False}))
