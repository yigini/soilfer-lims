"""Run unchanged reviewed C2 once, only after retained actual C1 closure."""
import sys,pathlib,json,subprocess
from prechecks6210209468_boundary_publication import *
sys.dont_write_bytecode=True;sys.path.insert(0,str(B));import diagnostic_contract as c
D=B/'actual-hook-launch6210209468-once';P=B/('package-'+c.NAME);V=B/'comparator080000-closed-publication-once'
assert not D.exists() and not (P/'launch-intent-hook.json').exists() and not git('diff','--cached','--name-only').strip()
head=git('rev-parse','HEAD').decode().strip();assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head
pub=json.loads((V/'publication-index.json').read_bytes());verify_publication(head,(V/'publication-index.json').relative_to(W).as_posix(),len(pub['bindings']))
closed=json.loads((V/'independent-closed-validation.json').read_bytes());assert closed['status']=='ACTUAL_C1_CLOSED_PASS_AWAITING_CLAUDIO_ACCEPTANCE' and closed['closedJournalUtc']=='2026-10-16T07:23:17.708897+00:00' and not closed['C2Launched']
spec=json.loads((P/'package-spec.json').read_bytes());assert spec['sourceReviewId']==6210209468 and spec['sourceHead']=='a6d8c5d5085bbe07cb649f858ec00acf0e3f8ee1'
for n,digest in spec['fileHashes'].items():assert sha((P/n).read_bytes())==digest
before={n:sha((B/n).read_bytes()) for n in c.SOURCE_NAMES+c.DATA_NAMES};assert all(before[n]==spec['fileHashes'][n] for n in before)
D.mkdir();args=[sys.executable,'-B',str(B/'launch_diagnostic.py'),'--check','hook'];save(D,'intent-once.json',canonical({'utc':utc(),'argv':args,'baseAudit':head,'sourceReviewId':6210209468,'C1ClosedJournalUtc':closed['closedJournalUtc'],'C1ResultSha256':closed['publicResultSha256'],'sourceHashes':before,'noReplay':True,'mode':'hook','qualificationAttempt':False})+b'\n')
result=None;error=None
try:
    result=subprocess.run(args,cwd=W,capture_output=True,timeout=420);save(D,'stdout-original.log',result.stdout);save(D,'stderr-original.log',result.stderr)
except subprocess.TimeoutExpired as e:
    save(D,'timeout-stdout-original.log',e.stdout or b'');save(D,'timeout-stderr-original.log',e.stderr or b'');error='Unknown C2 launch outcome; inspect SAME root/unit only, never redispatch'
after={n:sha((B/n).read_bytes()) for n in before};assert after==before
ok=result is not None and result.returncode==0
record={'closedUtc':utc(),'status':'C2_LAUNCH_DISPATCHED_ONCE_RESULT_PENDING' if ok else 'C2_LAUNCH_REFUSED_OR_UNKNOWN_INSPECT_SAME_ROOT_UNIT_NO_REPLAY','exitCode':result.returncode if result else None,'error':error,'sourceHead':spec['sourceHead'],'sourceReviewId':6210209468,'root':str(c.ROOT),'unit':c.UNITS['hook'],'sourceHashesBefore':before,'sourceHashesAfter':after,'qualificationAttempt':False,'releaseQualified':False}
save(D,'closed-launch-record.json',canonical(record)+b'\n')
lead=f'''LATEST ACTUAL C2 HOOK LAUNCH BOUNDARY - {record['closedUtc']}.
ActualC1CLOSEDsuccess07:23:17.708897/independentclosedpublicatione7a0be48/186Sample22Hold230Audit1Notice/full11242/OOM0/originalsunchanged. Exacta6d8c5d5/PASS6210209468 unchanged reviewed C2hooklauncher invokedONCE/exit{record['exitCode']}/status{record['status']}. Same080000ROOT/NEWsuffixhookUNIT now consumed ifdispatchoccurred/unknowninspectSAMErootunit NEVERredispatchretry. FreshauthorityR4closedC1public-result unusedhookunit checked by unchangedlauncher. FullactualC2launcher/capacity/programs at {c.REL}actual-hook-launch6210209468-once/publication-index.json. Source26unchanged. No C2result/PASS inferredfromlauncher; NEXTNEWuniqueREADONLYobserverSAMErootBOTHunits/publicfilesONLY/privatehashstatONLY/noSQL/newmemory/stopstart. ALLrawDockerstreams HOST0400/ENV-JWTNEVERFETCH.
ONErunEACH/noretry; actualClBOTHresultsacceptance THENdistinctattemptgraphbindsacceptance+ownexactSourcePASS/freshR4unusedrootunit/ONEattempt. Noqualification/kit/gate/deploy/MainMERGEHOLD. Old063000source572d/PASS620818/rootunit/operatorsCONSUMEDimmutable/233000KEEPIT/R2COMPLETE/noprune/nohostgrowrestart/no103/noagentsnewchatworktreecheckoutconcurrentwriter/humansheld. Futurekitcountsmaydiff+9to10minrestart/exact600failure. NativefallbackCANCELLEDanswered/no duplicateACK/GH/native. SAMEheartbeat2min/restore10ONLYactualbeDEPLOYED+ClactualpostdeployPASS. Preserve ALLolderhistoryverbatimbelow.

'''
out=boundary_publish(D,[pathlib.Path(__file__),*[p for p in P.rglob('*') if p.is_file()]],'Retain one actual C2 hook launch boundary',lead);print(json.dumps({**out,**{k:record[k] for k in ['status','exitCode','root','unit']}}));raise SystemExit(0 if ok else 1)
