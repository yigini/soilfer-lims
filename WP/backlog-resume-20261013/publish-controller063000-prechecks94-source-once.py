"""Publish only the new closed precheck source/evidence, never execute operators."""
import pathlib,json,hashlib,subprocess,sys,datetime
W=pathlib.Path(__file__).resolve().parents[2];B=W/'WP/controller063000-prechecks-be837974-20261016';BASE='29177822891e35e98486d5c4ccd4ba4b3b4e6fab';sys.dont_write_bytecode=True;sys.path.insert(0,str(B));import diagnostic_contract as c
D=B/'source94-publication-once';assert not D.exists()
def git(*a,input=None):return subprocess.check_output(['git','-c','core.longpaths=true',*a],cwd=W,input=input)
def oid(raw):return hashlib.sha1(('blob '+str(len(raw))+'\0').encode()+raw).hexdigest()
assert git('rev-parse','HEAD').decode().strip()==BASE and git('branch','--show-current').decode().strip()=='audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip()
final=json.loads((B/'source-local-host-final-once/exit-original.json').read_bytes());assert final['exitCode']==0 and final['allSourcesUnchanged']
frozen=json.loads((B/'source-local-host-final-once/source-before.json').read_bytes());assert set(frozen)==set(c.SOURCE_NAMES+c.DATA_NAMES)
for n,digest in frozen.items():assert c.sha((B/n).read_bytes())==digest
old=W/'WP/batch-proof-controller-forward-step2-be837974-20261016';idx=json.loads((old/'exact-source-review420-once/source-index.json').read_bytes());assert len(idx['files'])==31
for n,pin in idx['files'].items():assert c.sha((old/n).read_bytes())==pin['sha256']
apps=json.loads((W/'WP/startup-order-readiness-20261015/full-pinned-copy-retention-bound-ordinary-once/source-before.json').read_bytes());assert len(apps)==1333
for n,digest in apps.items():assert c.sha((W/n).read_bytes())==digest
assert b'Ran 94 tests' in (B/'source-local-host-final-once/local-stderr.log').read_bytes() and b'Ran 94 tests' in (B/'source-local-host-final-once/host-stderr.log').read_bytes()
D.mkdir()
record={'verifiedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourcePythonFiles':18,'sourceJavascriptFiles':1,'boundMetadataAndAppFiles':7,'totalReviewBindings':26,'localGuards':94,'actualHostPython39Guards':94,'allInputsUnchanged':True,'allOld31SourceAnd1333AppUnchanged':True,'actualWriterProducer':'LOCAL_NODE24_UNPATCHED_BOUND_WHOLE_CONTROLLER','hostWriterProbeUsesActualLocalResponse':True,'realHostNumericReaderUnpatched':True,'realDockerCommands':0,'productionSqliteConnections':0,'newOperationalPackage':False,'newOperationalRootOrUnit':False,'fakeDispatchedStdoutIsNotOperationalLaunch':True,'priorRefusalsRetainedHonestly':True}
(D/'independent-source-publication-validation.json').write_bytes(c.canonical(record)+b'\n')
lead=('LATEST COMPLETE NEW063000 PRECHECK SOURCE /94 LOCAL+94 ACTUALHOST GUARDS - '+final['closedUtc']+'.\nActual failure6208657786 ANSWERED by uneditedCl6208837867/05:33:23Z, full49raw acceptance29177822. Complete NEW18Python+1JS+7data(26bindings) graph at WP/controller063000-prechecks-be837974-20261016/README.md. EXACT16fingerprint/actualunpatchedLOCALNodewriter345bfa7727c61604/97predicatewriter-map/conservativeinplaceOldarrayrefusal explained; allotherstrictpairing/full11242 untouched. Hook perownerphase/staticliteralorHMAC afterkey +EACHcallmetadataBEFOREpredicates/rawstreamsHOST0400inspectENVNEVERfetch/empty-stderr remains/readonlypsinspectwrapper.\nFinal94LOCAL+94actualhost3.9.23 PASS/all26unchanged; hostPythonINMEMORY/realDocker0/productionSQL0/newsyntheticSQLonly; actualhostnumericreaderplainbytes/outsideunitrefusal unpatched. HostPythonusesretainedactualLOCALNodeoutput, no hostNodeexecutionclaim. Rendered actualtemplates closedFAKE exercised; dispatched:true stdoutFAKE/notoperationalrootunit. Earliermissingrenderdependency/VMmodulefixture/bootstrapreplacementfailures retainedhonest; no operatorreplay.\nNEW exactSourcePASS still REQUIRED before TWOone-run/no-retrychecks: C1copies2retained063000mains+ROimmutable/fullverify_copy/original6SHAstatbeforeafter/newprivateHMACHOST/countsclassificationskeyedonly; C2realunpatchedstop_exact+call insideTypeexec805Swap0UMask0077journal/BOTHalreadySTOPPED063000owners/PSINSPECTONLY/no stopstart. Proposed NEW080000diagnosticroot uncreatedbyus/no package/check. R4floor10556150894+4GiBlogs+10GB+2copyallocations/exactfuturepkgROOTonly/500MB mandatory. ActualClacceptance ofBOTHresults THENdistinctattemptgraph bindsacceptance+ownNEWexactSourcePASS/freshR4unusedrootunit/ONEattempt; NOproofattemptnow. NEXT concrete26allhashSourceReview,620883ACKONLYthere; old05:38:06nativefallbackCANCELLEDanswered/no duplicates.\nMainMERGEHOLD/old063000572dPASS620818rootunitoperatorsCONSUMEDimmutable/233000KEEPIT/R2COMPLETE/noprune/nohostgrowrestart/no103/noagentsnewchatworktreecheckoutconcurrentwriter/humansheld. Futurekit186/22LOGONLYuntilvalidated/countsmaydiff/9to10minrestart/exact600failure. SAMEheartbeatACTIVE2min/restore10ONLYactualbeDEPLOYED+ClactualpostdeployPASS. Preserve ALL older history verbatim below.\n\n')
(D/'checkpoint-prefix.txt').write_bytes(lead.encode())
readmes=[W/'WP/audit-release-eb6de2e8/README.md',W/'WP/runtime-recovery-kobo/README.md']
for p in readmes:
 prior=p.read_bytes();p.write_bytes(lead.encode()+prior);assert p.read_bytes()[len(lead.encode()):]==prior
helpers=[W/'WP/backlog-resume-20261013'/n for n in ['verify-controller063000-prechecks-first-local-host-once.py','verify-controller063000-prechecks-closed-local-host-once.py','verify-controller063000-prechecks-writer-complete-local-host-once.py','verify-controller063000-prechecks-final-local-host-once.py']]
paths=sorted(p for p in B.rglob('*') if p.is_file())+helpers+[pathlib.Path(__file__),*readmes]
assert not any(p.suffix=='.pyc' or '__pycache__' in p.parts for p in paths)
for p in paths:
 assert p.is_relative_to(B) or p in helpers+[pathlib.Path(__file__),*readmes]
rows=[{'path':p.relative_to(W).as_posix(),'length':len(p.read_bytes()),'sha256':c.sha(p.read_bytes()),'gitBlobOid':oid(p.read_bytes())} for p in paths]
index=D/'publication-index.json';index.write_bytes(c.canonical({'baseAudit':BASE,'status':'COMPLETE_SOURCE_ONLY_PRECHECKS_NOT_YET_APPROVED','bindings':rows})+b'\n');paths.append(index);names=[p.relative_to(W).as_posix() for p in paths]
git('-c','core.autocrlf=false','add','-f','--pathspec-from-file=-','--pathspec-file-nul',input=b'\0'.join(n.encode() for n in names)+b'\0')
assert {n.decode() for n in git('diff','--cached','--name-only','-z').split(b'\0') if n}==set(names)
def verify(prefix):
 raw=git('cat-file','--batch',input=('\n'.join(prefix+n for n in names)+'\n').encode());at=0
 for p in paths:
  end=raw.index(b'\n',at);given,kind,count=raw[at:end].decode().split();count=int(count);at=end+1;data=raw[at:at+count];at+=count
  assert kind=='blob' and data==p.read_bytes() and oid(data)==given and raw[at:at+1]==b'\n';at+=1
 assert at==len(raw)
verify(':');git('commit','-m','Add reviewed-scope063000 precheck graph and94 closed local-host guards');head=git('rev-parse','HEAD').decode().strip();verify(head+':');git('push','origin','HEAD:audit/release-eb6de2e8');assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head and not git('diff','--cached','--name-only').strip()
print(json.dumps({'audit':head,'rawGitOidShaLengthFilesVerified':len(paths),'sourceReviewBindings':26,'localTests':94,'actualHostTests':94,'newOperationalPackage':False,'serverOperatorCalls':0}))
