"""Retain only observed dead/incomplete original; never fabricate a report, summary or exit."""
import datetime,hashlib,json,subprocess,sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf8')
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent;dest=wp/'issue209-historical-shape-corrected-context-focused';review=wp/'issue209-historical-shape-corrected-context-review'
assert not (dest/'index.json').exists()
assert all(not (dest/name).exists() for name in ['summary.json','report-original.json','exit-original.txt','source-after.json'])
stderr=(dest/'stderr-original.log').read_text(encoding='utf8',errors='replace')
assert 'Fatal process out of memory' in stderr and 'Jest worker ran out of memory and crashed' in stderr
processCommand="Get-CimInstance Win32_Process | Where-Object { ($_.Name -in @('node.exe','python.exe','cmd.exe')) -and $_.CommandLine -and ($_.CommandLine.Contains('verify-issue209-historical-shape-corrected-context-once.py') -or $_.CommandLine.Contains('issue209-historical-shape-corrected-context-focused')) } | Select-Object ProcessId,ParentProcessId,Name,CommandLine | ConvertTo-Json -Compress"
processRaw=subprocess.run(['powershell','-NoProfile','-Command',processCommand],capture_output=True,check=True).stdout
assert not processRaw.strip(),processRaw.decode(errors='replace')
(dest/'task-processes-observed-terminal.json').write_bytes(processRaw or b'[]\n')
before=json.loads((dest/'source-before.json').read_bytes());observed={n:hashlib.sha256((root/n).read_bytes()).hexdigest() for n in before};assert observed==before
(dest/'source-observed-terminal.json').write_bytes((json.dumps(observed,indent=2)+'\n').encode())
held=[]
for line in (dest/'physical-retention-original.jsonl').read_text(encoding='utf8').splitlines():
 row=json.loads(line);f=Path(row['path']);assert f.exists(),f
 if f.is_file():held.append({'path':str(f),'bytes':f.stat().st_size,'sha256':hashlib.sha256(f.read_bytes()).hexdigest()})
(dest/'physical-retained-observed-terminal-index.json').write_bytes((json.dumps({'allRecordedTeardownTargetsRetained':True,'files':held},indent=2)+'\n').encode())
observation={'observedTerminalUtc':datetime.datetime.now(datetime.UTC).isoformat(),'status':'INCOMPLETE_NO_ORIGINAL_REPORT_OR_EXIT_NATIVE_WORKER_OOM','originalReportPresent':False,'originalExitKnown':False,'originalFinalSummaryPresent':False,'suitesPlanned':6,'testsPlanned':381,'completeCountsKnown':False,'observedPassHeaders':['audit_1_2_spectral_state.test.js','audit_0_3_publication.test.js'],'observedFailHeaders':['issue_209_order_revision_integration.test.js','audit_1_2_state_writes.test.js'],'sourceUnchangedAtObservation':True,'taskProcessesRemaining':0,'nodeOptions':'','workerIdleMemoryLimit':512000000,'productionOperations':0}
(dest/'observed-terminal.json').write_bytes((json.dumps(observation,indent=2)+'\n').encode())
def git(*args):return subprocess.run(['git',*args],cwd=root,capture_output=True,check=True).stdout
assert git('branch','--show-current').strip()==b'audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip()
source=json.loads((wp/'issue209-historical-column-spectral-publication-context-focused/index.json').read_bytes())['sourceDraftPaths'];assert len(source)==68
raw={f.relative_to(root).as_posix():{'bytes':f.stat().st_size,'sha256':hashlib.sha256(f.read_bytes()).hexdigest()} for directory in [dest,review] for f in directory.iterdir() if f.is_file()}
record={'retainedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'observation':observation,'sourceDraftPaths':source,'applicationFullyVerified':False,'productionOperations':0,'rawFiles':raw,'next':'New sequential ordinary single-suite successor, same source/stock assertions/setups/oneworker512MB/blankNODE_OPTIONS; never replay original. No heap/GC changes.'}
(dest/'index.json').write_bytes((json.dumps(record,indent=2)+'\n').encode())
lead='## 2026-10-14 #209 corrected historical context run INCOMPLETE: native Jest worker OOM, no finalreport/exit\n\nOriginal27857 runner no longer exists; disk originals have spectral/publication PASSheaders but native worker OOM/core FAILheaders. NO originalreport/exit/summary/source-after generated; never invent final totals orcallPASS. Observed-terminal/source-observed-terminal/process inventory/heldteardownhashes retained issue209-historical-shape-corrected-context-focused/index.json. Allfrozeninputs unchanged atobservation/allrecordedownedteardowntargetsheld. Earlier8duplicate-columnfailure6/381 honestab6 preserved; removedONLYnewredundantshape blocks/imports fromcurrentclosurefixtures, oldsource/asserts exactlyrecovered, PRE201pinnedshape stays. No runtime/scanner/schemaowner/heap/GC/productionchanges. NEXT newunique sequential ordinarysingle-suite successor for SAME6inventory/381planned, oneworker512MB/blankNODE_OPTIONS/bothsetups/stockassertions; retaineachactualclosedresult, no replayoriginal.193batch notfullyverified; prior85originalcasesresolved11/357+6/256,372stilluninspected. Samewriter/Cl6167740581 zero-writeorphans/approvedkitSTOP/humancontent/103noapply/214+206sourcegreenundeployed/historyguards hold. No full209PASS/PR/ready/audit/merge/kit/gate/productionoperation.\n\n'
readmes=['WP/audit-release-eb6de2e8/README.md','WP/runtime-recovery-kobo/README.md']
for name in readmes:
 f=root/name;f.write_bytes(lead.encode()+f.read_bytes())
owned=list(raw)+source+readmes+[Path(__file__).relative_to(root).as_posix(),(wp/'verify-issue209-historical-shape-corrected-context-once.py').relative_to(root).as_posix(),(dest/'index.json').relative_to(root).as_posix()]
git('add','-f','--',*owned);assert set(git('diff','--cached','--name-only').decode().splitlines())<=set(owned)
for name,pin in raw.items():assert hashlib.sha256(git('show',':'+name)).hexdigest()==pin['sha256'],name
for name in source:assert git('show',':'+name)==(root/name).read_bytes().replace(b'\r\n',b'\n'),name
git('commit','-m','audit(209): retain incomplete corrected context worker OOM honestly');head=git('rev-parse','HEAD').decode().strip()
for name,pin in raw.items():assert hashlib.sha256(git('show',head+':'+name)).hexdigest()==pin['sha256'],name
git('push','origin','HEAD:refs/heads/audit/release-eb6de2e8');assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head
print(json.dumps({'auditHead':head,'status':observation['status'],'rawGitBlobsVerified':len(raw),'sourceDraftPaths':68,'remainingRunner':0,'productionOperations':0}))
