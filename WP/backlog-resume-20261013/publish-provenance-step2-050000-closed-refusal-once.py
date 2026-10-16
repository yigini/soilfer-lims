"""Independently validate and publish the consumed early refusal; never replay it."""
import datetime, hashlib, json, os, pathlib, subprocess, sys, tempfile
W=pathlib.Path(__file__).resolve().parents[2];REL='WP/batch-proof-provenance-step2-be837974-20261016/';B=W/REL
D=B/'step2-050000-closed-refusal-originals-once';P=B/'step2-050000-closed-refusal-publication-once'
L=B/'proof-launch-workflow-batch-provenance-step2-be837974-20261016T050000Z';E=B/'execute-reviewed-launch6207628146-once';O=B/'first-step2-050000-readonly-observation-once'
BASE='2a4e51adbe34397bac0d56467146b5affd82fc8b';SOURCE='937901c7514437fc3937639454e621d1bfd68dc4'
sys.dont_write_bytecode=True;sys.path.insert(0,str(B))
from proof_contract import *
from proof_budget import capacity_gate
import prepare_proof as prep
def git(*a,input=None):return subprocess.check_output(['git','-c','core.longpaths=true',*a],cwd=W,input=input)
def oid(raw):return hashlib.sha1(('blob '+str(len(raw))+'\0').encode()+raw).hexdigest()
require(not P.exists() and git('rev-parse','HEAD').decode().strip()==BASE and git('branch','--show-current').decode().strip()=='audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip(),'Same writer/base and unused publication required')
r=exact_json((D/'closed-retention-record.json').read_bytes());require(r['invocationId']=='0d1bb46846ba427196e14434fcc3c3a2' and len(r['files'])==64 and r['packageFilesVerified']==59,'Exact original closed inventory required')
public=D/'public-originals';require({p.name for p in public.iterdir()}==set(r['files'])-{'private-value-hmac-key.json'},'Only public original files required')
for n in r['files']:
 if n=='private-value-hmac-key.json':continue
 raw=(public/n).read_bytes();require(sha(raw)==r['files'][n]['sha256'] and len(raw)==r['files'][n]['stat']['bytes'],'Original differs '+n)
spec=exact_json((public/'proof-input.json').read_bytes());index=exact_json((public/'tooling-source-index.json').read_bytes());review=exact_json((public/'source-review-original.json').read_bytes());approval(review,index)
require(index['head']==SOURCE and review['id']==6207628146 and len(graph(index))==31 and len(tokens(index))==170,'Exact consumed approval required')
package=B/('proof-package-'+ROOT_NAME);expected=set(spec['packageHashes'])|{'proof-input.json'}
require(len(expected)==59 and set(r['files'])-expected=={'private-value-hmac-key.json','proof-intent.json','proof-terminal-refusal.json','live-evolution-terminal.json','stop-post-result.json'},'Only exact pre-copy artifacts required')
for n in expected:require((public/n).read_bytes()==(package/n).read_bytes(),'Remote package differs '+n)
for n,h in graph(index).items():require(sha((B/n).read_bytes())==h,'Current reviewed source changed '+n)
terminal=exact_json((public/'proof-terminal-refusal.json').read_bytes());stop=exact_json((public/'stop-post-result.json').read_bytes())
require(terminal['status']=='FAILED_OR_REFUSED_RETAIN_ALL_FORWARD_FIX_ONLY' and terminal['neverRetry'] is True and terminal['ownedStopError'] is None,'Consumed actual refusal required')
require(terminal['closedUtc']=='2026-10-16T03:53:19.244372+00:00' and terminal['productionMutations']==terminal['productionSqliteConnections']==terminal['newProductionSnapshots']==0,'Actual terminal scope differs')
require(set(terminal['error'])=={'errorType','errorHmacSha256'} and terminal['error']['errorType']=='RuntimeError','Only keyed public original exception required')
require(stop['stoppedAndRetained']==stop['errors']==[] and stop['allExactOwnedStopped'] is True and stop['controllerMemory'] is None and stop['controllerMemoryErrorType']=='RuntimeError','Exact stop-post memory refusal required')
require(r['exactRootOwnedContainers']==[] and r['privateBytesFetched']==r['sqlConnections']==r['operatorReplays']==r['newDuCalls']==0,'No operation/private read replay allowed')
props=dict(line.split('=',1) for line in r['systemctl']['stdout'].splitlines() if '=' in line)
require(props['ActiveState']==props['SubState']=='failed' and props['Result']=='exit-code' and props['MainPID']=='0' and props['ExecMainStatus']=='1' and props['InvocationID']==r['invocationId'],'Actual closed unit differs')
require(props['MemoryMax']=='805306368' and props['MemorySwapMax']=='0' and props['RuntimeMaxUSec']=='1h 30min' and props['TimeoutStopUSec']=='5min' and 'status=1' in props['ExecStopPost'],'Actual retained unit limits/hook differ')
journal=[exact_json(line.encode()) for line in (D/'full-journal-original.jsonl').read_text(encoding='utf-8').splitlines() if line]
require(all(j.get('_SYSTEMD_INVOCATION_ID',j.get('INVOCATION_ID'))==r['invocationId'] for j in journal),'Same invocation full journal required')
require(any(j.get('COMMAND')=='ExecStart' and j.get('EXIT_STATUS')=='1' for j in journal) and any(j.get('COMMAND')=='ExecStopPost' and j.get('EXIT_STATUS')=='1' for j in journal),'Both real process exits required')
require(r['procSelfFreshMetadata']['isSymlink'] is True,'Fresh diagnostic proc-self metadata differs')
guard=(B/'controller_guard.py').read_text(encoding='utf-8')
require("member=read('/proc/self/cgroup')" in guard and "for a in [p,*p.parents]:require(not a.is_symlink(),'Controller cgroup alias')" in guard,'Source-derived refusal path differs')
before=exact_json((L/'metadata-capacity-before-root-stdout.log').read_bytes());after=exact_json((L/'metadata-capacity-immediately-before-unit-stdout.log').read_bytes());capacity_gate(before,'BEFORE_ROOT',10653696);capacity_gate(after,'BEFORE_UNIT',0)
frozen=exact_json((W/'WP/startup-order-readiness-20261015/full-pinned-copy-retention-bound-ordinary-once/source-before.json').read_bytes());require(len(frozen)==1333,'App inventory differs')
for n,h in frozen.items():require(sha((W/n).read_bytes())==h,'App changed '+n)
source_pub=exact_json(prep.raw_git(SOURCE,REL+'source398-complete-publication-once/publication-index.json')[0]);require(len(source_pub['bindings'])==736,'Full source publication required')
raws=prep.raw_git_many(SOURCE,[x['path'] for x in source_pub['bindings']])
for row in source_pub['bindings']:
 raw=raws[row['path']];require(len(raw)==row['bytes'] and sha(raw)==row['sha256'] and oid(raw)==row['gitBlobOid'],'Published source raw differs')
captures=[];original=prep.command
def capture(*a):
 raw=original(*a)
 if a[:2]==('gh','api'):captures.append((list(a),raw))
 return raw
prep.command=capture;evidence=prep.current_evidence(review,index)
require(exact_json(capture('gh','api','repos/yigini/soilfer-lims/issues/191'))['state']=='closed','Issue191 changed')
P.mkdir()
def save(n,raw):
 with (P/n).open('xb') as f:f.write(raw)
save('fresh-current-authority-evidence.json',canonical(evidence)+b'\n')
for i,(_,raw) in enumerate(captures):save('api-original-'+str(i).zfill(2)+'.json',raw)
save('api-command-index.json',canonical([{'file':'api-original-'+str(i).zfill(2)+'.json','argv':a,'bytes':len(raw),'sha256':sha(raw),'gitBlobOid':oid(raw)} for i,(a,raw) in enumerate(captures)])+b'\n')
record={'status':'CLOSED_EARLY_CONTROLLER_MEMORY_REFUSAL_NOT_RELEASE_QUALIFIED','verifiedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'root':str(ROOT),'unit':r['unit'],'invocationId':r['invocationId'],'sourceHead':SOURCE,'sourcePassId':6207628146,'terminalOriginalSha256':sha((public/'proof-terminal-refusal.json').read_bytes()),'stopPostOriginalSha256':sha((public/'stop-post-result.json').read_bytes()),'terminal':terminal,'stopPost':stop,'all64RootFileHashStatVerified':True,'publicOriginalCount':63,'privateKeyWithheldHost0400':True,'privateBytesFetched':0,'packageFilesVerified':59,'current31And1333Unchanged':True,'all737SourcePublicationBindingsVerified':True,'noControllerMemoryRawWasProduced':True,'noRuntimeR4OrCopyOrContainerOrStartupOrNaturalSyncResultProduced':True,'noProofReceiptProduced':True,'exactRootOwnedContainers':[],'normalHealthyAtReadonlyCapture':True,'noOriginalBeforeAfterContainerInventoryClaim':True,'sourceDerivedFailureMechanism':{'safeLiteralRequire':'Controller cgroup alias','firstRead':'/proc/self/cgroup','rejectedAncestor':'/proc/self','freshReadonlyHostMetadata':r['procSelfFreshMetadata'],'basis':'Reviewed source calls actual() on /proc/self/cgroup first; it refuses every symlink ancestor, including trusted /proc/self. Fresh metadata proves this ancestor is a symlink. This is source-derived analysis, not recovered original exception text; original remains HMAC only. No key comparison or source/operator replay.'},'controllerOomOutcome':'UNAVAILABLE_NO_MEMORY_RAW_NOT_INFERRED_FROM_SENTINEL','controllerPeak':'UNAVAILABLE_SENTINEL_NOT_MEASURED','beforeRootR4':before,'immediatelyBeforeUnitR4':after,'runtimeR4Reached':False,'fileAllocatedSumOnly':r['fileAllocatedSumOnly'],'wholeStoreAccountingNotReached':True,'allContainersStoppedClaimIsVacuousNoProofContainersCreated':True,'retryAllowed':False,'newOperatorCalls':0,'noNewProductionSnapshot':True,'noKitGateDeployAuthority':True}
save('independent-closed-result.json',canonical(record)+b'\n')
lead=f'''LATEST ACTUAL CLOSED050000 STEP2 EARLY CONTROLLER REFUSAL - {terminal['closedUtc']}.
ONE exact937901c7514437fc3937639454e621d1bfd68dc4/PASS6207628146/new050000rootunit/invocation{r['invocationId']} ACTUALLY FAILED before copies/containers/startup/natural sync. Main process exit1 AND ExecStopPost exit1; original0400 terminalSHA{record['terminalOriginalSha256']}/stop-postSHA{record['stopPostOriginalSha256']}. Runtime/closed qualification NOTPASS. SourcePASS/package/root/unit/operators CONSUMED NEVERretryreplaycleanup. No active proof/localrunnerretainer.
Actualpublicterminal RuntimeError is HMAC-only; ownedStopErrornull/productionMutations0/productionSQLite0/newProductionSnapshots0. Stop-post allExactOwnedStoppedtrue/errors[]/stoppedAndRetained[] is VACUOUS: no owned proof containers created. It failed controllerMemoryRuntimeError/null, no before/after memory raws; OOM/peak NOTinferred. ActualfailedunitMemoryMax805306368Swap0Runtime90min/TimeoutStop300/ExecStopPost exactrootstop_owned.py/journalbothexit1 retained. Fileinventory64/all59package unchanged/63publicoriginals retained/privatekeyHOST0400/hashstatONLY/0privatebytesfetched. Freshreadonly03:55:16 normal8109/959d/7ahealthy0restartnoOOM, no exactrootowners. No currentoriginalbeforeaftercontainerinventoryclaim. No runtimeR4/fullstoreaccounting/SQL/copies/du/newproductionmemorysampling by retainer; rootfileallocated8667136B is FILESUM ONLY.
SOURCE-DERIVED mechanism: controller_guard.actual() checks EVERY ancestor of first /proc/self/cgroup read and rejects /proc/self because it is a symlink. Safe literal require is Controller cgroup alias. Freshreadonlyretainer lstat/readlink confirms symlink; this is NOT the original failed sample/exception-text recovery. No key comparison/guard/operator replay. Exact frozen source must stay unchanged; any remedy needs genuinelyNEWgraph/meaningful actual-path guards/new exactClPASS/newrootunit, never redispatch050000. Nextgraph should also incorporate review's stop-first-before-hash-verification note and readable static refusal evidence.
All31+1333 unchanged/all737sourcebindings reverified/current4audits6rules2postreboot memory/jobs/diagnosticsprivacyacceptance/R2/mainbeCI38772398721attempt1pushCLOSEDSUCCESS/#191CLOSED/nolaterfailure fresh. BeforeROOT{before['observedUtc']} req{before['requiredBytes']}/free{min(before['freeBytes'].values())}; immediatelyUNIT{after['observedUtc']} req{after['requiredBytes']}/free{min(after['freeBytes'].values())}; each3sameFS/nonadditive/10GB/futurepackage10653696ONLYbeforeROOT; runtimegateNOTreached. SourcePASS1983dfff46raw/package2a4e51ad71raw/nativefollowupd2a046f020raw all immutable. Fullclosedraws/independentresult/currentauthority at {REL}step2-050000-closed-refusal-publication-once/publication-index.json.
NEXT ONE@claude162 actualfailedresult bundles620762PASS ACK ONLYthere; request separately audited NEWforward remedy/scope. No duplicate native/GH/ACK/oldhelper. MainMERGEHOLD/233000latestpassingKEEPIT/R2COMPLETE/noprune/YY320GiBvisible/no growrestart/no103/noagentsnewchatworktreecheckoutconcurrentwriter/humansheld. Futurekitgate174newEXPECTED22holds20existingZMB-LAB1/managerimpact/countsmaydiff PLUS9to10minrestart/exact600failure remain. SAMEheartbeatACTIVE2min/restore10ONLYactualbeDEPLOYED+ClactualpostdeployPASS. Preserve ALL older history verbatim below.

'''
save('checkpoint-prefix.txt',lead.encode());readmes=[W/'WP/audit-release-eb6de2e8/README.md',W/'WP/runtime-recovery-kobo/README.md']
for p in readmes:
 old=p.read_bytes();p.write_bytes(lead.encode()+old);require(p.read_bytes()[len(lead.encode()):]==old,'Prior history changed')
paths=sorted(p for directory in [D,public,L,E,O,P] for p in directory.iterdir() if p.is_file())+[pathlib.Path(__file__),W/'WP/backlog-resume-20261013/retain-provenance-step2-050000-closed-refusal-once.py',W/'WP/backlog-resume-20261013/execute-provenance-step2-reviewed-launch6207628146-once.py',W/'WP/backlog-resume-20261013/observe-provenance-step2-050000-first-readonly-once.py',*readmes]
require(len(paths)==len(set(paths)),'No duplicate owned path');save('publication-index.json',canonical({'baseAudit':BASE,'files':[{'path':p.relative_to(W).as_posix(),'length':len(p.read_bytes()),'sha256':sha(p.read_bytes()),'gitBlobOid':oid(p.read_bytes())} for p in paths]})+b'\n');paths.append(P/'publication-index.json');names=[p.relative_to(W).as_posix() for p in paths]
fd,pf=tempfile.mkstemp(prefix='lims-step2-050000-closed-',suffix='.paths');os.close(fd);pathlib.Path(pf).write_bytes(b'\0'.join(n.encode() for n in names)+b'\0')
git('-c','core.autocrlf=false','--literal-pathspecs','add','-f','--pathspec-from-file='+pf,'--pathspec-file-nul');require({x.decode() for x in git('diff','--cached','--name-only','-z').split(b'\0') if x}==set(names),'Staged ownership differs')
def verify(ref):
 raw=git('cat-file','--batch',input=('\n'.join(ref+n for n in names)+'\n').encode());at=0
 for p in paths:
  end=raw.index(b'\n',at);given,kind,length=raw[at:end].decode().split();length=int(length);at=end+1;data=raw[at:at+length];at+=length
  require(kind=='blob' and data==p.read_bytes() and oid(data)==given and raw[at:at+1]==b'\n','Raw publication differs');at+=1
 require(at==len(raw),'Expanded raw response')
verify(':');git('commit','-m','Retain closed Step 2 controller and stop-post refusal');head=git('rev-parse','HEAD').decode().strip();verify(head+':');git('push','origin','HEAD:audit/release-eb6de2e8');require(git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head and not git('diff','--cached','--name-only').strip(),'Remote publication differs')
print(json.dumps({'audit':head,'rawGitFilesVerified':len(paths),'status':record['status'],'terminalSha256':record['terminalOriginalSha256'],'stopPostSha256':record['stopPostOriginalSha256'],'sourceDerivedLiteral':'Controller cgroup alias','noOperatorReplays':True}))
