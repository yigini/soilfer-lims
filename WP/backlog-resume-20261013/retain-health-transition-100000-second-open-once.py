"""Retain the second actual OPEN observation, without any remote operation."""
import json,pathlib,subprocess,sys
REPO=pathlib.Path(__file__).resolve().parents[2]
S=REPO/'WP/batch-proof-health-transitions-cde8-20261015'
BASE='3b13130e10db0f6ee642cf371988f6b272dc548a'
sys.path.insert(0,str(S))
from proof_contract import require,exact_json,canonical,sha,ROOT
from prepare_proof import raw_git
def cmd(*a):return subprocess.check_output(a,cwd=REPO)
require(cmd('git','rev-parse','HEAD').decode().strip()==BASE and not cmd('git','diff','--cached','--name-only').strip(),'Writer/staging moved')
require(cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==BASE,'Remote moved')
D=S/'first-proof-100000-second-observation-once'
o=exact_json((D/'stdout-original.json').read_bytes())
require(exact_json((D/'exit-original.json').read_bytes())['exitCode']==0,'Observer did not complete')
p=dict(l.split('=',1) for l in o['systemctlOriginal'].splitlines() if '=' in l)
require(o['root']==str(ROOT) and p['InvocationID']=='e8e4806968d748fc862d465491a691e2','Wrong root/invocation')
require(p['ActiveState']=='active' and p['SubState']=='running' and p['MemoryMax']=='805306368' and p['MemorySwapMax']=='0' and p['RuntimeMaxUSec']=='1h 30min','Not expected OPEN state')
require(not any(n in o['closedImmutableSelectedJson'] for n in ['proof-receipt.json','proof-terminal-refusal.json','startup-1-result.json','startup-2-result.json']),'Terminal/startup result unexpectedly present')
poll=o['latestSealedHealthPolls']['1'];v=poll['value']
require(poll['sealedPollCount']==402 and v['status']=='unhealthy' and 430<v['elapsedSeconds']<431 and 338<v['unhealthySecondsObservedSoFar']<340,'Observation differs')
out=S/'first-proof-100000-second-open-health-index.json';require(not out.exists(),'Consumed retainer')
lead='## 2026-10-15 actual100000 second OPEN health observation09:17:56.942364UTC\n\nSAME ONE a748b9dc/SourcePASS6188457144 proof remains active/running/invocatione8e4806968d748fc862d465491a691e2. Read-only second observer retained1894file metadata inventory/Current346431488/Peak805306368 OPENONLY/MemoryMax805306368Swap0/Runtime90min. First startup latest sealed0400 poll000402: unhealthy at430.2230033960077s elapsed,338.9104433900211s cumulative observed unhealthy intervals. Unhealthy is allowed within the approved HARD600 readiness window; no terminal refusal, receipt or startup result observed. This is NOT proof PASS/completion/release qualification; active Resultsuccess/ExecMainStatus0 carries no terminal authority. Full latest State/FailingStreak/Health.Log/config retained in observer JSON; all original polls/logs remain host and must be retained at closure. Second startup unobserved. No proof replay, source edit, stop, SQL, newdu, cleanup or concurrent writer. Root/unit/PASS/package/launch/first+second observers CONSUMED neverretryreplay. NEXT reasonable boundary NEWunique observer SAME root/unit; closed evidence retain honestly using NEWunique closed reader/retainer.\n\nBoth fresh launch capacity gates passed09:08:14.980763 and09:08:39.972392/required31768290414/N24/30equiv25percentmin0/3assets/floor10556150894/logs4GiB/500MBdu-x. Scope TWOnew independent ordinaryjobsOFFstarts from080000installed209backup+recorded11242/070000assets; no installer/policy/science replay/oldSQL/newproductioncopy. Exactproductionhealth30s10s3start30s/allpolls0400/HARD600afterALLHTTP/27NOOP0+26READY0/HTTP200200401/fullstoppedequality/inputrechecks/stagecaps/allretention/memory805blankheapSwap0/readiness600unit5400headroom60+600/YYpins/science/forwardonly/no103/humanhistory guards hold. After ANY defaultentrypoint failure only separately audited forwardfix/no retry. JobsONnaturalintake+broadpostflights/exactkitfreshsingleusegate later. YYgroupa5reviewed list remains separate/no actual cleanup approval observed/0deletedmovedpruned/carduntouched. No nativeACK/progress repeat required. Same writer/branch/noagents/newchat/worktree/checkout/broadstage/resetclean/unrelateddirt.\n\n'
readme=REPO/'WP/audit-release-eb6de2e8/README.md';readme.write_bytes(lead.encode()+readme.read_bytes())
paths=sorted(x for x in D.rglob('*') if x.is_file())
paths+=sorted(x for x in (S/'routine-authority-0914-once').rglob('*') if x.is_file())
paths += [REPO/'WP/backlog-resume-20261013/observe-health-transition-100000-second-boundary-readonly-once.py',pathlib.Path(__file__),readme]
record={'status':'ACTUAL_SECOND_OPEN_FIRST_STARTUP_UNHEALTHY_WITHIN_APPROVED_WINDOW_NOT_COMPLETE','sourceCommit':'a748b9dc5d3e5309fe3ef2b5cf4a6c5e7d796ef2','actualSourcePass':6188457144,'observedUtc':o['observedUtc'],'root':o['root'],'unit':o['unit'],'invocation':p['InvocationID'],'fileCount':len(o['fileInventory']),'memoryCurrentAtOpen':p['MemoryCurrent'],'memoryPeakAtOpenNotFinal':p['MemoryPeak'],'latestHealthPoll':{'path':poll['path'],'sealedPollCount':poll['sealedPollCount'],'status':v['status'],'elapsedSeconds':v['elapsedSeconds'],'unhealthySecondsObservedSoFar':v['unhealthySecondsObservedSoFar'],'timingMeaning':'OBSERVED_POLL_INTERVALS_NOT_UNOBSERVED_EXACT_DOCKER_TRANSITION_TIME'},'startupResultsObserved':[],'terminalProofStatus':None,'jobsOnQualificationStillRequired':True,'neverReplay':True,'files':[{'path':x.relative_to(REPO).as_posix(),'bytes':x.stat().st_size,'sha256':sha(x.read_bytes())} for x in paths]}
with out.open('xb') as f:f.write(canonical(record)+b'\n')
paths.append(out);rels=[x.relative_to(REPO).as_posix() for x in paths];require(len(set(rels))==len(rels),'Duplicate paths')
for start in range(0,len(rels),15):cmd('git','-c','core.autocrlf=false','-c','core.longpaths=true','add','-f','--',*rels[start:start+15])
require(set(cmd('git','diff','--cached','--name-only').decode().splitlines())==set(rels),'Unowned staging');tree=cmd('git','write-tree').decode().strip()
for x,r in zip(paths,rels):require(raw_git(tree,r)[0]==x.read_bytes(),'Staged raw differs')
cmd('git','commit','-m','Retain second100000 open health observation within readiness window');head=cmd('git','rev-parse','HEAD').decode().strip()
for x,r in zip(paths,rels):require(raw_git(head,r)[0]==x.read_bytes(),'Committed raw differs')
cmd('git','push','origin','audit/release-eb6de2e8');require(cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head,'Remote differs')
print(json.dumps({'head':head,'verifiedOwnedBlobs':len(paths),'status':record['status'],'observedUtc':o['observedUtc']}))
