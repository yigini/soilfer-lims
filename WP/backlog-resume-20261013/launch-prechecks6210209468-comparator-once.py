"""Run the unchanged approved C1 launcher once; retain its actual outcome."""
import sys,pathlib,json,subprocess
from prechecks6210209468_evidence import *
sys.dont_write_bytecode=True;sys.path.insert(0,str(B));import diagnostic_contract as c
D=B/'actual-comparator-launch6210209468-once';P=B/('package-'+c.NAME);V=B/'reviewed-package6210209468-publication-once'
assert not D.exists() and not (P/'launch-intent-comparator.json').exists() and not git('diff','--cached','--name-only').strip()
head=git('rev-parse','HEAD').decode().strip();assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head
pub=json.loads((V/'publication-index.json').read_bytes());verify_publication(head,(V/'publication-index.json').relative_to(W).as_posix(),len(pub['bindings']))
spec=json.loads((P/'package-spec.json').read_bytes());assert spec['sourceReviewId']==6210209468 and spec['sourceHead']=='a6d8c5d5085bbe07cb649f858ec00acf0e3f8ee1'
for n,digest in spec['fileHashes'].items():assert sha((P/n).read_bytes())==digest
before={n:sha((B/n).read_bytes()) for n in c.SOURCE_NAMES+c.DATA_NAMES}
assert all(before[n]==spec['fileHashes'][n] for n in before)
D.mkdir();args=[sys.executable,'-B',str(B/'launch_diagnostic.py'),'--check','comparator']
save(D,'intent-once.json',canonical({'utc':utc(),'argv':args,'baseAudit':head,'sourceReviewId':6210209468,'sourceHashes':before,'noReplay':True,'mode':'comparator','qualificationAttempt':False})+b'\n')
result=None;error=None
try:
    result=subprocess.run(args,cwd=W,capture_output=True,timeout=420);save(D,'stdout-original.log',result.stdout);save(D,'stderr-original.log',result.stderr)
except subprocess.TimeoutExpired as e:
    save(D,'timeout-stdout-original.log',e.stdout or b'');save(D,'timeout-stderr-original.log',e.stderr or b'');error='Unknown C1 launch outcome; inspect SAME root/unit only, never redispatch'
after={n:sha((B/n).read_bytes()) for n in before};assert after==before
ok=result is not None and result.returncode==0
record={'closedUtc':utc(),'status':'C1_LAUNCH_DISPATCHED_ONCE_RESULT_PENDING' if ok else 'C1_LAUNCH_REFUSED_OR_UNKNOWN_INSPECT_SAME_ROOT_UNIT_NO_REPLAY','exitCode':result.returncode if result else None,'error':error,'sourceHead':spec['sourceHead'],'sourceReviewId':6210209468,'root':str(c.ROOT),'unit':c.UNITS['comparator'],'sourceHashesBefore':before,'sourceHashesAfter':after,'qualificationAttempt':False,'C2Launched':False,'releaseQualified':False,'nativeSourceFallbackCancelledAnswered':True}
save(D,'closed-launch-record.json',canonical(record)+b'\n')
lead=f'''LATEST ACTUAL C1 PRECHECK LAUNCH BOUNDARY - {record['closedUtc']}.
Exacta6d8c5d5/PASS6210209468 unchanged reviewed comparator launcher invokedONCE/exit{record['exitCode']}/status{record['status']}. ROOT{c.ROOT}/UNIT{c.UNITS['comparator']} now consumed if dispatch/rootcreation occurred; unknowninspectSAMErootunit NEVERredispatchretry. Full actual launcher/rawcapacity/templateprograms at {c.REL}actual-comparator-launch6210209468-once/publication-index.json. Source26unchanged. NO C1 result/PASS inferredfromlauncher; C2NOTlaunched. C1closure+public-result prerequisite beforeC2ONErun/no retry. Rawinspectstreams/privatekeysDBsHOST0400/NEVERFETCH. ActualClBOTHresultsacceptance THENdistinctattemptgraphbindsacceptance+ownexactSourcePASS/freshR4unusedrootunit/ONEattempt. Noqualification/kit/gate/deploy/MainMERGEHOLD. Old063000operatorsimmutableCONSUMED/233000KEEPIT/R2COMPLETE/noprune/nohostgrowrestart/no103/noagentsnewchatworktreecheckoutconcurrentwriter/humansheld. Futurekit186/22LOGONLYuntilC1/countsmaydiff+9to10minrestart/exact600failure. NativefallbackCANCELLEDanswered/no duplicateACK/GH/native. SAMEheartbeat2min/restore10ONLYactualbeDEPLOYED+ClactualpostdeployPASS. Preserve ALLolderhistoryverbatimbelow.

'''
out=publish(D,[pathlib.Path(__file__),*[p for p in P.rglob('*') if p.is_file()]],'Retain one actual C1 comparator launch boundary',lead)
print(json.dumps({**out,**{k:record[k] for k in ['status','exitCode','root','unit','C2Launched']}}));raise SystemExit(0 if ok else 1)
