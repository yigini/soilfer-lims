"""One local, source-frozen kit test run. No host/SSH/Docker/production SQL."""
import sys
sys.dont_write_bytecode=True
from prechecks6210209468_evidence import *
K=W/'WP/batch-release-kit-be837974-20261016'
D=K/'sequence-journal-local-first-once'
assert not D.exists()
sources=sorted(p for p in K.iterdir() if p.suffix in ('.py','.md'))
before={p.name:sha(p.read_bytes()) for p in sources}
D.mkdir();(D/'source-at-test').mkdir()
for p in sources:save(D/'source-at-test',p.name,p.read_bytes())
started=utc()
p=subprocess.run([sys.executable,'-B','-m','unittest','discover','-s',str(K),'-p','verify_kit_*.py','-v'],cwd=W,capture_output=True)
save(D,'stdout-original.txt',p.stdout);save(D,'stderr-original.txt',p.stderr)
after={p.name:sha(p.read_bytes()) for p in sources}
value={'startedUtc':started,'closedUtc':utc(),'testExit':p.returncode,'sourceBefore':before,'sourceAfter':after,
       'hostCalls':0,'productionCalls':0,'linuxDirectoryFsyncTested':False,
       'localPlatform':sys.platform,'localVersion':sys.version,'fixturesRetained':'journal-local-retained-fixtures',
       'earlierDirectToolRun':'12 tests passed; direct exec output only, no original log files recorded for that preliminary run'}
save(D,'verification.json',canonical(value)+b'\n')
assert p.returncode==0 and before==after
print(json.dumps(value))
