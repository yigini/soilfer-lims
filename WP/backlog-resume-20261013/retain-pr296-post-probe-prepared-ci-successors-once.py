"""Retain unused current-head successors and explicit consumed-helper boundary once."""
import datetime,hashlib,json,subprocess
from pathlib import Path
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent
dest=wp/'issue214-policy-post-probe-prepared-ci-successors';assert not dest.exists()
def git(*args):return subprocess.run(['git',*args],cwd=root,capture_output=True,check=True).stdout
assert git('branch','--show-current').strip()==b'audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip()
dest.mkdir();helpers=['prepare-pr296-post-probe-ci-audit-successors-once.py','retain-pr296-post-probe-new-ci-terminal-once.py','request-pr296-post-probe-exact-head-audit-after-green-once.py']
record={'preparedBoundaryUtc':datetime.datetime.now(datetime.UTC).isoformat(),'head':'5e0b32830f961b3236c7cf8f74cf8f676e98fbaa',
 'tree':'f2152e240b355cd141612b783c6ccf04f5c8383a','base':'6d750914d8565acdd496767a7dd935811b5a89b2','run':38524553288,
 'requiredSuites':366,'requiredTests':5566,'sourcePathCount':59,'terminalRetainerUnused':True,'auditRequestHelperUnused':True,
 'oldFailedHeadHelpersMustNeverExecute':True,'finalRequestSent':False,'productionOperations':0,
 'helperSha256':{name:hashlib.sha256((wp/name).read_bytes()).hexdigest() for name in helpers}}
(dest/'prepared-index.json').write_bytes((json.dumps(record,indent=2)+'\n').encode())
lead='''## 2026-10-14 #214 current5e0b CI/request successors PREPARED UNUSED

Actual automatic CI38524553288 attempt1/current5e0b remainsactive; no terminal result yet. NEW preparedunused retain-pr296-post-probe-new-ci-terminal-once.py requiresactualCLOSEDsame385245/exact59paths/3665566/allrealDocker+secondary snapshot proof, excludesPostBuild log fromactualBuild. NEW preparedunused request-pr296-post-probe-exact-head-audit-after-green-once.py requiresindependentlypushedclosedgreen+freshmain/base/head/currentbody/emptyreadyhistory; one label/comment then209. Readeachbeforeuse, never replayuncertainremoteoutcomes. All oldfailed-head request/retainers remainforbidden. No finalrequest/PASS/209work/merge/kit/gate/productionoperation. See precedinglatestactual source/probe evidence andpreserveallguards.

'''
readmes=['WP/audit-release-eb6de2e8/README.md','WP/runtime-recovery-kobo/README.md']
for p in readmes:
 f=root/p;f.write_bytes(lead.encode()+f.read_bytes())
owned=readmes+[(wp/name).relative_to(root).as_posix() for name in helpers]+[Path(__file__).relative_to(root).as_posix(),(dest/'prepared-index.json').relative_to(root).as_posix()]
pins={p:hashlib.sha256((root/p).read_bytes()).hexdigest() for p in owned if p not in readmes}
git('add','--',*owned);assert set(git('diff','--cached','--name-only').decode().splitlines())<=set(owned)
git('commit','-m','audit(214): retain unique current-head CI and audit request successors')
head=git('rev-parse','HEAD').decode().strip()
for p,digest in pins.items():assert hashlib.sha256(git('show',head+':'+p)).hexdigest()==digest,p
git('push','origin','HEAD:refs/heads/audit/release-eb6de2e8')
assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head
print(json.dumps({'auditHead':head,'preparedUnused':helpers[1:],'verifiedBlobs':len(pins)}))
