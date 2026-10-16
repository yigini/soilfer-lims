"""Invoke the exact approved local preparer once, retain and publish its package."""
import sys,pathlib,json,subprocess
from prechecks6210209468_evidence import *
sys.dont_write_bytecode=True;sys.path.insert(0,str(B));import diagnostic_contract as c
D=B/'reviewed-package6210209468-publication-once';P=B/('package-'+c.NAME);V=B/'actual-source-pass6210209468-once'
assert not D.exists() and not P.exists() and not git('diff','--cached','--name-only').strip()
head=git('rev-parse','HEAD').decode().strip();assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head
pub=json.loads((V/'publication-index.json').read_bytes());verify_publication(head,(V/'publication-index.json').relative_to(W).as_posix(),len(pub['bindings']))
validation=json.loads((V/'independent-pass-validation.json').read_bytes());assert validation['sourceReviewId']==6210209468 and validation['sourceHead']=='a6d8c5d5085bbe07cb649f858ec00acf0e3f8ee1' and validation['literalBindings']==41
before={n:sha((B/n).read_bytes()) for n in c.SOURCE_NAMES+c.DATA_NAMES};assert before==validation['all26SourceHashes']
D.mkdir();args=[sys.executable,'-B',str(B/'prepare_diagnostic.py'),'--source-head',validation['sourceHead'],'--review-id','6210209468']
save(D,'intent-once.json',canonical({'utc':utc(),'argv':args,'baseAudit':head,'noReplay':True,'hostConnections':0,'sourceHashes':before})+b'\n')
result=subprocess.run(args,cwd=W,capture_output=True,timeout=300);save(D,'stdout-original.log',result.stdout);save(D,'stderr-original.log',result.stderr)
after={n:sha((B/n).read_bytes()) for n in before};assert after==before
ok=result.returncode==0;spec=json.loads((P/'package-spec.json').read_bytes()) if ok else None
if ok:
    assert spec['sourceReviewId']==6210209468 and spec['sourceHead']==validation['sourceHead'] and set(spec['fileHashes'])==set(c.SOURCE_NAMES+c.DATA_NAMES)|{'diagnostic-source-index.json','diagnostic-source-review.json','current-authority.json'}
    for n,digest in spec['fileHashes'].items():assert sha((P/n).read_bytes())==digest
    for n in before:assert (P/n).read_bytes()==(B/n).read_bytes()
record={'status':'APPROVED_PRECHECK_LOCAL_PACKAGE_PREPARED_NOT_LAUNCHED' if ok else 'PACKAGE_REFUSED_RETAIN_ALL_NO_REPLAY','closedUtc':utc(),'exitCode':result.returncode,'packageFiles':len(list(P.rglob('*'))) if P.exists() else 0,'futurePackageBytes':spec['futurePackageBytes'] if spec else None,'sourceReviewId':6210209468,'sourceHashesBefore':before,'sourceHashesAfter':after,'hostOperations':0,'qualificationAttempts':0}
save(D,'independent-package-validation.json',canonical(record)+b'\n')
lead=f'''LATEST APPROVED PRECHECK PACKAGE6210209468 PREPARED - {record['closedUtc']}.
Exact unchanged reviewed prepare_diagnostic invokedONCE/exit{result.returncode}; all26sourcebindings remain frozena6d8c5d5/PASS6210209468. Package {P.name}; futurePackageBytes={record['futurePackageBytes']} charged beforeROOTONLY/alreadyoccupied beforeUNIT/runtime. Every file independentlySHA-verified; full package+closed originals at {c.REL}reviewed-package6210209468-publication-once/publication-index.json. No SSH/root/unit/C1/C2 yet. NEXTunchanged reviewed launcher C1ONLY afterfreshauthorityR4+10GB/unusedrootBOTHunits; actualC1closure beforeC2 ONErunEACH/noretry. Rawinspectstreams/privatekeysDBsHOST0400/NEVERFETCH. ActualClBOTHresultsacceptance THENdistinctreviewedattemptgraph; noqualification/kit/gate/deploy/MainMERGEHOLD.07:12nativefallbackCANCELLEDanswered/no duplicateACK/native/GH.233000KEEPIT/R2COMPLETE/noprune/nohostgrowrestart/no103/noagentsnewchatworktreecheckoutconcurrentwriter/humansheld. Futurekit186/22LOGONLYuntilC1/countsmaydiff+9to10minrestart/exact600failure. SAMEheartbeat2min/restore10ONLYactualbeDEPLOYED+ClactualpostdeployPASS. Preserve ALLolderhistoryverbatimbelow.

'''
extras=[pathlib.Path(__file__)]+[p for p in P.rglob('*') if p.is_file()] if P.exists() else [pathlib.Path(__file__)]
out=publish(D,extras,'Prepare and publish exact approved C1 C2 precheck package',lead);print(json.dumps({**out,**{k:record[k] for k in ['status','exitCode','futurePackageBytes','hostOperations']}}));raise SystemExit(0 if ok else 1)
