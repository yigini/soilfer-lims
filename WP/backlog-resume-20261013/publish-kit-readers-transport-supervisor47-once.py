"""Publish source/tests and synthetic stream evidence; no production calls."""
import sys
sys.dont_write_bytecode=True
from prechecks6210209468_boundary_publication import *
K=W/'WP/batch-release-kit-be837974-20261016';D=K/'readers-transport-supervisor47-publication-once'
assert not D.exists() and git('rev-parse','HEAD').decode().strip()=='ffafc338398ff64f2b403ae62e8709d4f0a33939'
assert not git('diff','--cached','--name-only').strip()
v=json.loads((K/'local-tests-shared-import-privacy-final/verification.json').read_bytes())
assert v['exitCode']==0 and v['sourceBefore']==v['sourceAfter'] and b'Ran 47 tests' in (K/'local-tests-shared-import-privacy-final/stderr-original.txt').read_bytes()
for name,digest in v['sourceBefore'].items():assert sha((K/name).read_bytes())==digest
captures=[]
for endpoint in ['repos/yigini/soilfer-lims/git/ref/heads/main','repos/yigini/soilfer-lims/actions/runs/38772398721','repos/yigini/soilfer-lims/issues/191','repos/yigini/soilfer-lims/issues/162/comments?since=2026-10-16T10%3A15%3A48Z&per_page=100']:
    captures.append((endpoint,subprocess.check_output(['gh','api',endpoint],cwd=W)))
main,ci,issue,comments=[json.loads(raw) for _,raw in captures]
assert main['object']['sha']==ci['head_sha']=='be8379745bdfae52ce46496ff26514dc7d729640' and ci['run_attempt']==1 and ci['status']=='completed' and ci['conclusion']=='success' and issue['state']=='closed'
later=[c for c in comments if c['id']>6213266959 and (c.get('performed_via_github_app') or {}).get('id')==1236702]
assert not later,'Read actual new direction before source publication'
D.mkdir()
for i,(endpoint,raw) in enumerate(captures):save(D,'api-original-'+str(i)+'.json',raw)
fixtures=[]
for name in ['journal-local-retained-fixtures','transport-local-retained-fixtures','reader-local-retained-fixtures','cli-local-retained-fixtures']:
    for p in sorted((K/name).rglob('*')):
        if p.is_file():
            raw=p.read_bytes();s=p.stat();fixtures.append({'path':p.relative_to(K).as_posix(),'bytes':len(raw),'sha256':sha(raw),'gitBlobOidIfPublished':oid(raw),'localModeObserved':s.st_mode&0o777,'localLinksObserved':s.st_nlink})
save(D,'all-new-local-synthetic-fixtures-hash-inventory.json',canonical({'fixtures':fixtures,'productionBytes':0,'localSyntheticSqliteFixturesRetainedNotPublished':True,'privateHostBytesFetched':0})+b'\n')
save(D,'boundary-record.json',canonical({'closedUtc':v['closedUtc'],'localTests':47,'sourceFilesHashedBeforeAndAfter':len(v['sourceBefore']),
    'readersCopied':9,'readersOnlyImportNamesChanged':True,'localNodeVersion':'v24.13.0','localPythonPlatform':v['platform'],
    'hostCalls':0,'productionCalls':0,'newQualificationRuns':0,'linuxFsyncOrDockerTested':False,
    'completeProductionAdapter':False,'kitSourcePassRequested':False,'kitGate':False,'deployment':False,
    'failedFirst44':{'errors':1,'cause':'actual local partial completion file visibility race','cjsSnapshotOnlyAfterFailure':True},
    'failedAtomicSuccessor44':{'errors':3,'cause':'FileExistsError compatibility changed to RuntimeError; source restored standard collision exception'},
    'intermediate45Passed':True,'final47Passed':True})+b'\n')
extras={p for p in K.iterdir() if p.is_file()}
for name in ['local-tests-readers-transport-consumers-first','local-tests-cli-supervisor-first','local-tests-cli-atomic-publication-successor','local-tests-cli-atomic-exclusive-contract-successor','local-tests-shared-import-privacy-final']:
    extras|={p for p in (K/name).rglob('*') if p.is_file()}
# All of these are fixed synthetic child/stream/journal values, no host keys,
# private production DBs, environment, payloads, or withheld jobs-ON logs.
for name in ['journal-local-retained-fixtures','transport-local-retained-fixtures','cli-local-retained-fixtures']:
    extras|={p for p in (K/name).rglob('*') if p.is_file()}
extras.add(W/'WP/backlog-resume-20261013/prepare-kit-retained-readers-once.py')
extras.add(__import__('pathlib').Path(__file__))
lead='''LATEST CONCRETE KIT READERS / PRIVATE TRANSPORT / CLI SUPERVISOR47 LOCAL PASS - 2026-10-16T10:44Z.
SAME be837974/acc15844 kit source WP/batch-release-kit-be837974-20261016 now has47LOCAL tests PASS, all Python/JS/JSON/YAML/README source hashes unchanged during final run. Nine read-only filesystem/provenance/intake/health/memory/controller helpers copied from accepted18763698 with import renames ONLY; AST predicate bodies identical and oldUnicodecanonical(false) retained. New Docker read-only adapter/full identity+complete bounded inventory; private command transport records original stdoutstderr/hash/length/exit BEFORE predicates; bounded unhealthy-consumer collector covers unit definitions/timers/cron/process/Docker and gives NOabsenceverdict until exact kit review pins currentconfiguration+allowedclasses. No actual host inventory/read was run.
NEW cli_guard.cjs leaves real child command/defaultheap/existing timeout unchanged, waits AFTERchildcompletion for controller final host memory.events before wrapper exit. Only6bound script names/exactDBpath/modes; policyAPPLY/historicalinstaller/restore/refused. Not yet wired to real Docker or production. ActualLOCALNode24.13.0 child tests caught partial-completion-file visibility race (first44tests1error); complete/permit/journal records now fsync then atomically hardlink final name, pending names retained/no delete/replace. Next44tests3errors were FileExistsError-vs-RuntimeError compatibility only; standard collision type restored,45then47PASS. All failed rawlogs/source snapshots preserved honestly; first44JS source snapshot was captured AFTERfailure, not claimed original-before hash set. Linux directoryfsync/Docker/cgroup behavior NOTtestedhere. New synthetic SQLiteWAL/raw-reader-backup/all-column preservation tests only; no production/oldDB SQL. All local synthetic fixtures retained; SQLitefixture originals hash-inventory public, DBbytes not published.
Proposed ONLY newkitroot /opt/lims/releases/workflow-batch-release-be837974-20261016T150000Z remains UNCREATED/unreserved; no package/unit/gate/attempt/deployment. Complete production Ops adapter/copy-site physical budgets/stoppedROvolume integrity+FK/installers+actualscientificimpact/fullpreservation/defaultstart/naturalintake/HTTP/freeze/exactgate/launcher/independentstop-post NOTYETcomplete. Continue ACTUALLYimplementing them next; do NOTwait for nonexistent SourcePASS. Need complete graph+meaningful guards then ONE exact source review/frozen-kit review/fresh actualYY workload+intake+wholeoutage gate. New CLI supervisor/controlfiles/source copies need their own review; do not useoldsourcePASS operationally. Copied runtime_policy historical authority exports are NOTkit authority; only natural parsers intended. Oldfilename staticfailure-map entries do not authorize newplaintext: unmatched renamed sites use freshprivateHMAC, tested no payload leakage; no oldprivatekeys fetched.
Actualqualacceptance6212990400 and actualtimingdirection6213266959 remain governing: result6212737130 andquestion6213148920 BOTHANSWERED; ALL10:04:23/10:28:25nativefallbacks CANCELLEDforever/no duplicateACKGHnative. 9to10min shorthand/233000 install-path description withdrawn; wholeoutage disclosed honestly+YYgated/600candidate readiness unchanged/allDRYAPPLYREPEATpreservation/no performance detour/no new transaction killpoints. Retained3APPLY410.332512/all9commands632.285438/fastestREADY394.886040+10stop comparison815.218552 BEFOREotherphases, oldcde8/B5context/notmeasuredacc158productionsequence. PreAPPLY exactfullrawDBWALSHMbackup-equality/nootherwriters permits SAMEretainedpredecessor restartONCE+readiness/reopen only; missingbackup/changedSHM/anyAPPLYintent/unknownAPPLY/entrypoint=>503forwardhold/stopretain/partial162/noDBrestore. First-sync193Sample23Hold20oldcross1ZMBnotice/otherlabs0/maygrow freshYYvisible; AFTERfirstsyncBEFOREreopen fivecounts exactintakedeltas/fullprovenance, later second normalreceipt must not misattribute human scientific writes.
Parallel208/207 original agents/worktrees only. BOTH earlier mixed-source full runs were stopped and retained/excluded from final PASS after parent caught source edits during active runs.208 now frozen stagedtreefe50eed9a70383f6266edcdfadde6a091e9b7927/43ownedpaths/375stockfiles;207 focused final37PASS and frozen374stockfiles freshfull running. No PR/CI reported yet; parent ONEready/exacthead audit ONLYactualfullgreenCI; allmergesheld actualbeDEPLOYED+Clpostcheck. Do not create duplicate agents/worktrees or replace with laterbacklog. Source-only staging excludes deps/localfixtures/logs. Samehostsinglewriter/noactualhostcalls/no newqualification/SQL/du/memorysampling/stop/retry/cleanup/R2complete/233000KEEPIT/no103/humansheld. SameheartbeatACTIVE2min; restore10 ONLY actualbeDEPLOYED+actualClpostdeployPASS. Preserve ALL prior history verbatim below.

'''
print(json.dumps(boundary_publish(D,extras,'feat(release): add retained readers and bounded kit transport',lead)))
