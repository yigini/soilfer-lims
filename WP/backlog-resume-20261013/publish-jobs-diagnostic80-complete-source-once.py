"""Publish ONLY this new diagnostic source and honest retained synthetic evidence."""
import datetime,hashlib,json,pathlib,re,subprocess,sys
R=pathlib.Path(__file__).resolve().parents[2];S=R/'WP/jobs-row-diagnostic-be837974-20261016';D=S/'source80-publication-once';BASE='00ada89acb5faf4909d8907a066bef2f38be569f'
sys.path.insert(0,str(S));import prepare_diagnostic as prep
from diagnostic_contract import *
def git(*a,payload=None):return subprocess.check_output(['git','-c','core.longpaths=true',*a],cwd=R,input=payload)
assert git('rev-parse','HEAD').decode().strip()==BASE and git('branch','--show-current').decode().strip()=='audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip() and not D.exists()
D.mkdir();A=D/'fresh-authority-originals';A.mkdir();commands=[];original=prep.command
def capture(*args):
 if args[:2]!=('gh','api'):return original(*args)
 i=len(commands);r=subprocess.run(args,cwd=R,capture_output=True,timeout=90)
 for n,b in [('stdout.json',r.stdout),('stderr',r.stderr),('command.json',canonical({'argv':args,'exitCode':r.returncode}))]:(A/(str(i).zfill(2)+'-'+n)).write_bytes(b)
 commands.append(list(args));assert r.returncode==0,'Fresh read failed, not no answer';return r.stdout
prep.command=capture;evidence=prep.current_evidence();(D/'fresh-current-authority.json').write_bytes(canonical(evidence)+b'\n')
last=S/'guards-code-bound-local-host-once';result=strict((last/'exit-original.json').read_bytes());assert result['exitCode']==0 and result['allSourcesUnchanged']
frozen=strict((last/'source-before.json').read_bytes());assert len(frozen)==8
for n,h in frozen.items():assert sha((S/(n+'.py')).read_bytes())==h
for side in ['local','host']:
 raw=(last/(side+'.stderr')).read_bytes();assert b'Ran 80 tests' in raw and raw.rstrip().endswith(b'OK') and strict((last/(side+'-exit.json')).read_bytes())['exitCode']==0
assert b'HOST_PYTHON=3.9.23;' in (last/'host.stdout').read_bytes()
app=strict((R/'WP/startup-order-readiness-20261015/full-pinned-copy-retention-bound-ordinary-once/source-before.json').read_bytes());assert len(app)==1333 and all(sha((R/n).read_bytes())==h for n,h in app.items())
old=R/'WP/batch-proof-jobs-intake-be837974-20261016';O=old/'jobs003000-closed-row-refusal-originals-once/remote-originals';old_index=strict((O/'tooling-source-index.json').read_bytes());assert len(old_index['files'])==26 and all(sha((old/n).read_bytes())==x['sha256'] for n,x in old_index['files'].items())
prefix='''LATEST COMPLETE NEW DIAGNOSTIC SOURCE / EMPTY-WAL SCOPE ANSWER - SOURCE ONLY.

ActualCl6205842415/2026-10-16T01:20:31Z uneditedapp1236702slugclaude FULLREAD retained; exact six-file empty-WAL exception ACCEPTED SCOPEONLY, not SourcePASS. Actual semantic pin0456da7dd3347cd5081d949a13b4d8a6b14d0bdb895620d8642cf6d38670a03e. No native fallback/ACK needed for answered6205771455; ACK belongs ONLY next concrete source review request.

NEW COMPLETE eight-file diagnostic source WP/jobs-row-diagnostic-be837974-20261016: diagnostic_authority,contract,io,compare,run_diagnostic,prepare_diagnostic,launch_diagnostic,verify_diagnostic. NEW proposed sole root /opt/lims/releases/workflow-batch-row-diagnostic-be837974-20261016T020000Z / unit lims-workflow-batch-row-diagnostic-be837974-20261016t020000z UNCREATED byus/no operational package. Actual exact NEW Source review: PASS mandatory before ONE attempt. No Step2/remedy/kit/gate/deploy authority.

Final80LOCAL+80ACTUALhostPython3.9.23 closedPASS/all8sourceunchanged. Synthetic fixtures ONLY; HOST sourceINMEMORY/no sourcefiles/no real subprocess/Docker/cache/network/productionSQL/operator. Earlier61bothPASS and77bothPASS originals/source-at-attempt retained; static actual-code audit corrected draft ACTIVE literal to exact AMBIGUOUS_PROVENANCE_HOLD and added real source-literal/mirror/prefix guards before formal source request. No earlier suite pretended to validate final bytes. All26oldproofsources+1333frozenapp unchanged.

Runtime opens ONLY003000 startup-1-stopped-seal/backup.db and first-sync.db via file:mode=ro&immutable=1. All6 exact path/bytes/allocated/dev/inode/mode0400/mtime/SHA pins; fresh ctime+nlink before/after, no atime; nonemptyWAL/-journal/missing/extra selected sidecar/symlink/alias/mismatch refuses BEFORE SQL; any after change VOID. Both mains page_count*page_size563322880+quick_checkok+header18/19 observations recorded before tables. SHM bytehashonly/no interpretation. No ATTACH/writingpragma/checkpoint/copy/production/oldinputSQL/runtime network/containers/003000writes. Fresh floor10556150894+4GiBlogs only(no64equivalent/newcopyR4), exactfuturepackage beforeROOTonly/alreadyoccupied beforeUNIT-runtime. Five actual remote programs compile beforefirstSSH. RuntimeMemory805306368Swap0/1800s/PrivateNetwork/IPdenyAF_UNIX/ProtectSystemstrict/ReadWriteONLYnewroot/no newreadonlyDBcopies; controller own memory.events evidence and zeroOOM guards.

Streaming ALL112tables+schema42receipts; everychangedoriginal id+columns/deleted+addedrows/rawprivate/fullrowhashpublic; protected/deleted/nonEXPECTED/status/scientific/reception/approval/unexplained STOPREPORT/NOREMEDY. OriginalSample metadata+fieldMetadata structural paths/arrays/oldvalue retention; exact rejection empty-to-text, active nonrefusal source/config+retained first-fetch id membership; code-bound CROSS_SUBMISSION_DUPLICATE/PRIMARY_REVISION or UNEXPLAINED, exact paired PROVENANCEholds/HOLD_RAISED+KOBO_CONFLICTING_PROVENANCE audits/actors/markers/counts. Raw payload/coords/names confined private-rows0400/newroot; public IDs,columnnames,keypaths,counts,classifications,valuehashes ONLY. Source-bound first-fetch and recorded baseline JSON copied AS METADATA into new source; no database copied/opened. Any result still needs ACTUALClacceptance before Step2.

No diagnostic operation/hostDBprobe/newproduction memorysampling/package/root/unit/container/SQL. Only NEW synthetic source guards ran on host and local; fixture trees retained without cleanup. MainMERGEHOLD/233000latestpassingKEEPIT/R2COMPLETE/no prune/YY320GiBalreadyvisible/no growrestart/no103/noagentsnewchatworktreecheckout/concurrentwriter/humanfilesdraftcards held. FutureStep2 must keep ownedjobsONstop exactrootowner afterkilledcontroller + ownunitmemoryevents; futurekit/gate disclose9-to10minrestartwindow/exactproduction600sdeadlinefailurebehavior. SAMEheartbeatACTIVE2min/restore10ONLYactualbeDEPLOYED+ClactualpostdeployPASS.

Current source publication DOES NOT itself request SourcePASS. NEXT concrete exact all8SHA+alltokens request bundles actual6205842415ACK ONCE, then awaitactualNEWexactPASS; no nonexistentgraph waiting/oldhelper replay. Full older history preserved verbatim below.

'''
(D/'checkpoint-prefix.txt').write_bytes(prefix.encode())
(S/'README.md').write_bytes((prefix+'\nThe eight source files and three metadata inputs form the runtime review graph. Source/test snapshots and scope/raw API evidence are retained here. The prepare and launch entry points remain unexecuted.\n').encode())
for n in ['WP/audit-release-eb6de2e8/README.md','WP/runtime-recovery-kobo/README.md']:
 p=R/n;b=p.read_bytes();(D/(p.parent.name+'-README-before.bin')).write_bytes(b);p.write_bytes(prefix.encode()+b)
all_paths=[];omitted=[]
for p in S.rglob('*'):
 if not p.is_file():continue
 rel=p.relative_to(S)
 if 'local-fixtures' in rel.parts or '__pycache__' in rel.parts:
  omitted.append({'path':p.relative_to(R).as_posix(),'bytes':p.stat().st_size,'sha256':sha(p.read_bytes()),'reason':'Retained local synthetic fixture files; never real database inputs'});continue
 all_paths.append(p)
helpers=[R/'WP/backlog-resume-20261013'/n for n in ['prepare-jobs-diagnostic-scope6205842415-source-once.py','verify-jobs-diagnostic-first-local-host-once.py','verify-jobs-diagnostic-input-bound-local-host-once.py','verify-jobs-diagnostic-code-bound-local-host-once.py',pathlib.Path(__file__).name]]
(D/'synthetic-fixture-exclusions.json').write_bytes(canonical(omitted)+b'\n');all_paths.append(D/'synthetic-fixture-exclusions.json')
bindings=[{'path':p.relative_to(R).as_posix(),'bytes':p.stat().st_size,'sha256':sha(p.read_bytes())} for p in sorted(set(all_paths+helpers+[R/'WP/audit-release-eb6de2e8/README.md',R/'WP/runtime-recovery-kobo/README.md']))]
index=D/'publication-index.json';index.write_bytes(canonical({'status':'COMPLETE_DIAGNOSTIC_SOURCE80_NOT_EXECUTED_NOT_APPROVED','bindings':bindings,'privateSyntheticFixtureExclusions':len(omitted),'actualDiagnosticSqlConnections':0})+b'\n');paths=[x['path'] for x in bindings]+[index.relative_to(R).as_posix()]
git('-c','core.autocrlf=false','add','-f','--',*paths)
staged=set(git('diff','--cached','--name-only').decode().splitlines());assert staged==set(paths)
for n in paths:
 b=(R/n).read_bytes();assert git('show',':'+n)==b,'Staged bytes differ '+n
git('commit','-m','Retain scoped immutable diagnostic source and 80 synthetic guards')
head=git('rev-parse','HEAD').decode().strip();git('push','origin','audit/release-eb6de2e8')
for n in paths:assert git('show',head+':'+n)==(R/n).read_bytes()
assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head and not git('diff','--cached','--name-only').strip()
print(json.dumps({'status':'DIAGNOSTIC_SOURCE80_PUBLISHED_NOT_REVIEWED_NOT_EXECUTED','head':head,'rawVerifiedFiles':len(paths),'sourceFiles':8,'syntheticFixturesRetainedLocalAndHost':True,'noDiagnosticSql':True}))
