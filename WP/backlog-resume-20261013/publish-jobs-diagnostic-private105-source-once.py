"""Publish exact new privacy source plus complete honest closed guard evidence only."""
import datetime,pathlib,subprocess,sys,json
R=pathlib.Path(__file__).resolve().parents[2];S=R/'WP/jobs-row-diagnostic-private-be837974-20261016';D=S/'source105-publication-once';BASE='3228b0b2857b915c5ba1f4945fcdd6d34f6f9bdf'
sys.path.insert(0,str(S));import prepare_diagnostic as prep
from diagnostic_contract import *
def git(*a):return subprocess.check_output(['git','-c','core.longpaths=true',*a],cwd=R)
assert git('rev-parse','HEAD').decode().strip()==BASE and git('branch','--show-current').decode().strip()=='audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip() and not D.exists()
D.mkdir();A=D/'fresh-authority-originals';A.mkdir();commands=[];original=prep.command
def capture(*args):
 if args[:2]!=('gh','api'):return original(*args)
 i=len(commands);r=subprocess.run(args,cwd=R,capture_output=True,timeout=90)
 for n,b in [('stdout.json',r.stdout),('stderr',r.stderr),('command.json',canonical({'argv':args,'exitCode':r.returncode}))]:(A/(str(i).zfill(2)+'-'+n)).write_bytes(b)
 commands.append(args);assert r.returncode==0,'Failed read is not no answer';return r.stdout
prep.command=capture;evidence=prep.current_evidence();(D/'fresh-current-authority.json').write_bytes(canonical(evidence)+b'\n')
last=S/'guards-private-stat-complete-local-host-once';result=strict((last/'exit-original.json').read_bytes());assert result['exitCode']==0 and result['allSourcesUnchanged']
frozen=strict((last/'source-before.json').read_bytes());assert len(frozen)==8
for n,h in frozen.items():assert sha((S/(n+'.py')).read_bytes())==h
for side in ['local','host']:
 raw=(last/(side+'.stderr')).read_bytes();assert b'Ran 105 tests' in raw and raw.rstrip().endswith(b'OK') and strict((last/(side+'-exit.json')).read_bytes())['exitCode']==0
assert b'HOST_PYTHON=3.9.23;' in (last/'host.stdout').read_bytes()
app=strict((R/'WP/startup-order-readiness-20261015/full-pinned-copy-retention-bound-ordinary-once/source-before.json').read_bytes());assert len(app)==1333 and all(sha((R/n).read_bytes())==h for n,h in app.items())
old=R/'WP/batch-proof-jobs-intake-be837974-20261016';oi=strict((old/'jobs003000-closed-row-refusal-originals-once/remote-originals/tooling-source-index.json').read_bytes());assert len(oi['files'])==26 and all(sha((old/n).read_bytes())==v['sha256'] for n,v in oi['files'].items())
prior=R/'WP/jobs-row-diagnostic-be837974-20261016';oldindex=strict((prior/'exact-source-review80-git-aware-once/source-index.json').read_bytes());assert all(sha((prior/n).read_bytes())==v['sha256'] for n,v in {**oldindex['files'],**oldindex['data']}.items())
prefix='''LATEST NEW PRIVACY DIAGNOSTIC SOURCE / ACTUAL CHANGES-REQUIRED ANSWER - SOURCE ONLY.

ActualCl6206214444/2026-10-16T01:51:11Z uneditedapp1236702slugclaude FULLREAD+retained, semantic58128f5bcee6dd307f6e5a8c1ecafbb5adb386a6667460e6434f8740478ea5eb. ANSWERS6206082628; old02:00:46nativefallback CANCELLED/NOduplicates. Actual findings: individual plain SHA256 leaves expose low-entropy coordinates/names; fresh private32byte HMAC-SHA256 key mandatory (or omit scalars). Suggestions readable static refusals/literal keys, shared memory sink/cap, six-file stat-only BEFORE_ROOT, optional inaccessible paths. All implemented in distinct NEW source, not patched old frozen graph. Reviewer reports of his tests are HIS reported evidence, not an actual diagnostic result.

NEW complete8source+3unchangedMETADATA graph WP/jobs-row-diagnostic-private-be837974-20261016. Proposed NEW sole root /opt/lims/releases/workflow-batch-row-diagnostic-be837974-20261016T023000Z / unit lims-workflow-batch-row-diagnostic-be837974-20261016t023000z UNCREATED byus/no package/diagnosticSQL. Old bb2d337d8source/3data/full184sourcepublication and all26proofsources+1333frozenapp unchanged. Fresh source PASS floor id>6206214444/created>01:51:11Z/uneditedapp1236702slugclaude/firstline Source review: PASS/ALL8SHA+ALLtokens+3data required. Current changes-required is not SourcePASS. Its exact semantic authority is freshly read in prepare/launch and bound in runtime alongside two prior scope pins.

Every public per-value/row/error digest now HMAC-SHA256 under one fresh os.urandom(32) run key. Key exists ONLY exclusive private-value-hmac-key.json0400 in NEW root, withheld; test fixtures use fixed key. No key/plain-leaf fallback or public key material; whole-table streams remain plain SHA256 per review. Actual in-place conflict revision changing lat,lng,collected_at,surveyor,site_id remains UNEXPLAINED; classify_sample and full112-table result contain neither raw values nor their canonical/string plain SHA hashes. Raw rows stay private. Readable RuntimeError text is restricted to frozen AST-derived static require/RuntimeError messages; KeyError only frozen literal source keys. Unknown/dynamic RuntimeError/KeyError/ValueError/SQLite messages stay keyed, preventing accidental payload disclosure. Controller own_events now uses shared run Sink; BOTH memory files appear in public-terminal files[] and count toward256MiB. No production memory sampling.

BEFORE_ROOT uses only lstat/canonical/no-symlink checks for all6 exact selected paths, bytes/allocated/dev/inode/mode0400/mtime/nlink1/uniqueinode/exactsiblings and stablectime+nlink across two snapshots; no hashing/contentopen/SQL. Missing/extrajournal/alias/pin/race refuses before root/unit. Runtime fullSHAstatguard before/after, immutableRO two mains/pageextent563322880/quickcheck/header18/19 beforetables/SHMbytehashonly remain unchanged; afterchangeVOID. Optional InaccessiblePaths prefixed '-' only affects missing sandbox paths. Five ACTUAL remote programs compile before ANY SSH; exact futurepackage allocation charged beforeROOTonly/alreadyoccupied beforeUNIT-runtime. Floor10556150894+4GiBlogs no-copy exception/no64-equivalent/noDBcopies unchanged. Memory805306368Swap0/1800/noRestart/PrivateNetwork/IPdeny/AF_UNIX/ProtectSystemstrict/ReadWriteONLYnewroot.

Final105LOCAL+105ACTUALhostPython3.9.23 CLOSEDPASS02:01:50.347914UTC/all8sourceunchanged. Host sourcesINMEMORY/no remote sourcefiles/real subprocess/network/operators blocked/SQLite only NEW synthetic fixtures. Original101local ran100PASS1fixture accountingFAIL/HOSTNOTSTARTED retained; mock Path.is_symlink internally added lstat calls24vs12, corrected fixture isolates alias interface without runtime guard weakening. First correction generator SyntaxError refused BEFORE sourcewrite/tests/host; immutable helper retained, raw-string successor corrected escaped fixture newlines. Final105 adds HMAC knownvectors/key lifecycle/privacy fullstore/readablevsdynamicerrors/private0400key/shared memory cap/stat-only actual generated branch/negative pins/inode/nlink/race/journal/oldPASSfloor/rendered sixpins. Earlier80 graph/tests remain frozen, no oldhelper replay.

Streaming ALL112tables+schema42receipts, everychangedoriginal/deleted/added row/IDs/columns; source-bound Sample status/scope/rejection/metadata+fieldMetadata structuralpaths/arrays/everyoldvalue/fetchmembership/exact append marker+new paired PROVENANCEholds/HOLD_RAISED+KOBO_CONFLICTING_PROVENANCE audits/action/count/actors remain conservative. CROSS_SUBMISSION_DUPLICATE/PRIMARY_REVISION elseUNEXPLAINED; any protected/deleted/nonEXPECTED/status/scientific/reception/approval/unexplained STOPREPORT/NOREMEDY after enumeratingALLtables. Public IDs/columns/keypaths/counts/classifications/KEYEDvaluehashes only. Rawpayload/coordinates/names/privatekey withheld private-0400. No original003000 jobsONlogs/payload republished.

NEXT ONE NEW exact all8SHA+alltokens source review at this concrete head, findings6206214444ACK bundledONLYthere. New prepare/launch/run UNEXECUTED except import/compile/closed synthetic guards; no operational package/root/unit/actualdiagnosticSQL. Actual NEW SourcePASS/currentauthorities/allpublicationbindings/1333app/freshfloorlogs+unusedrootunit mandatory beforeONEnewattempt. Unknown outcome inspectSAMErootunit NEVERredispatch. Actual diagnostic RESULT requires Clacceptance BEFORE anyStep2 allowance/proof/remedy. NoYYquestion now. MainMERGEHOLD/233000latestpassingKEEPIT/R2COMPLETE/no prune/YY320GiBalreadyvisible/no growrestart/no103/noagentsnewchatworktreecheckout/concurrentwriter/broadstage/resetclean/humanfilesdraftcards. FutureStep2 exactownerstop aftercontrollerkill+ownunitmemoryevents/EVERYcontainer805600/refusals42receipts/secondnaturalidempotence+newfetchidsabovemax/R4+10GB/newrootoneattempt; futurekitgate disclose9-to10minrestartwindow/exactproduction600deadlinefailurebehavior. SAMEheartbeatACTIVE2min/restore10ONLYactualbeDEPLOYED+ClactualpostdeployPASS. All older history preserved verbatim below.

'''
(D/'checkpoint-prefix.txt').write_bytes(prefix.encode());(S/'README.md').write_bytes((prefix+'The source and three metadata files form the complete review graph. This publication has not requested or received a new source PASS.\n').encode())
for n in ['WP/audit-release-eb6de2e8/README.md','WP/runtime-recovery-kobo/README.md']:
 p=R/n;b=p.read_bytes();(D/(p.parent.name+'-README-before.bin')).write_bytes(b);p.write_bytes(prefix.encode()+b)
(D/'failed-generator-derived.json').write_bytes(canonical({'classification':'LOCAL_SOURCE_GENERATOR_SYNTAX_REFUSAL_BEFORE_WRITE','helper':'correct-jobs-diagnostic-private-stat-fixture-once.py','reason':'Non-raw generator string expanded fixture newline escapes. compile refused before source write. Unique raw-string successor completed.','originalToolOutputRetainedInConversation':True,'notAnOriginalStderrFile':True,'testsStarted':0,'hostCalls':0})+b'\n')
paths=[];omitted=[]
for p in S.rglob('*'):
 if not p.is_file():continue
 if 'local-fixtures' in p.relative_to(S).parts or '__pycache__' in p.relative_to(S).parts:
  omitted.append({'path':p.relative_to(R).as_posix(),'bytes':p.stat().st_size,'sha256':sha(p.read_bytes()),'reason':'Retained synthetic local fixture; not runtime private evidence'});continue
 paths.append(p)
helpers=['prepare-jobs-diagnostic-private6206214444-source-once.py','add-jobs-diagnostic-private-regression-guards-once.py','verify-jobs-diagnostic-private-first-local-host-once.py','correct-jobs-diagnostic-private-stat-fixture-once.py','correct-jobs-diagnostic-private-stat-fixture-complete-once.py','verify-jobs-diagnostic-private-stat-complete-local-host-once.py',pathlib.Path(__file__).name]
paths += [R/'WP/backlog-resume-20261013'/n for n in helpers]+[R/'WP/audit-release-eb6de2e8/README.md',R/'WP/runtime-recovery-kobo/README.md']
(D/'synthetic-fixture-exclusions.json').write_bytes(canonical(omitted)+b'\n');paths.append(D/'synthetic-fixture-exclusions.json')
bindings=[{'path':p.relative_to(R).as_posix(),'bytes':p.stat().st_size,'sha256':sha(p.read_bytes())} for p in sorted(set(paths))]
index=D/'publication-index.json';index.write_bytes(canonical({'status':'COMPLETE_PRIVATE_DIAGNOSTIC_SOURCE105_NOT_EXECUTED_NOT_APPROVED','bindings':bindings,'actualDiagnosticSqlConnections':0,'oldSourceUnchanged':True,'all1333AppUnchanged':True})+b'\n');names=[v['path'] for v in bindings]+[index.relative_to(R).as_posix()]
git('-c','core.autocrlf=false','add','-f','--',*names);assert set(git('diff','--cached','--name-only').decode().splitlines())==set(names)
for n in names:assert git('show',':'+n)==(R/n).read_bytes(),'Staged bytes differ '+n
git('commit','-m','Retain keyed private row diagnostic and 105 closed synthetic guards');head=git('rev-parse','HEAD').decode().strip();git('push','origin','audit/release-eb6de2e8')
for n in names:assert git('show',head+':'+n)==(R/n).read_bytes()
assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head and not git('diff','--cached','--name-only').strip()
print(json.dumps({'status':'PRIVACY_SOURCE105_PUBLISHED_NOT_APPROVED_NOT_EXECUTED','head':head,'rawVerifiedFiles':len(names),'sourceFiles':8,'actualDiagnosticSql':0}))
