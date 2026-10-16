"""Validate actual C2 failure and safe retained-stream analysis; no replay."""
import sys,json,pathlib,base64,re,datetime,subprocess
from prechecks6210209468_boundary_publication import *
sys.dont_write_bytecode=True;sys.path.insert(0,str(B));import diagnostic_contract as c,diagnostic_authority as authority,prepare_diagnostic as prep
O=B/'hook080000-first-readonly-once';C=B/'comparator080000-second-readonly-once';A=B/'hook080000-retained-host-analysis-complete-once';AF=B/'hook080000-retained-host-analysis-once';D=B/'both-prechecks080000-closed-complete-result-publication-once';assert not D.exists() and not git('diff','--cached','--name-only').strip()
obs=json.loads((O/'stdout-original.json').read_bytes());prior=json.loads((C/'stdout-original.json').read_bytes());P=O/'public-originals'
def read(n):return json.loads((P/n).read_bytes())
show=dict(s.split('=',1) for s in base64.b64decode(obs['units']['hook-show']['stdoutBase64']).decode().splitlines() if '=' in s);assert show['ActiveState']=='inactive' and show['SubState']=='dead'
journal=[json.loads(s) for s in base64.b64decode(obs['units']['hook-journal']['stdoutBase64']).decode().splitlines()];assert len(journal)==4 and all(v.get('INVOCATION_ID')=='d3252723e193488db1d0aba7425f1778' for v in journal)
assert sum(v.get('EXIT_STATUS')=='1' for v in journal)==1 and sum(v.get('UNIT_RESULT')=='exit-code' for v in journal)==1
result=read('hook/public-result.json');assert result['status']=='PRECHECK_FAILED_RETAIN_ALL_NO_RETRY' and result['sourceHead']=='a6d8c5d5085bbe07cb649f858ec00acf0e3f8ee1' and result['sourceReviewId']==6210209468 and result['controllerBeforeAfterOomZero'] and not result['attemptAllowed'] and not result['releaseQualified']
body=result['result'];assert body['allExactOwnedStopped'] is False and len(body['errors'])==1 and len(body['stoppedAndRetained'])==1 and body['productionActions']==body['foreignContainersStopped']==0
error=body['errors'][0];assert error['phase']=='compare' and error['literalRequire']=='Exact owned container remains running or changed' and error['owner'].endswith(':startup-2')
analysis=json.loads((A/'stdout-original.json').read_bytes());assert analysis['privateRawBytesFetched']==analysis['newDockerCalls']==analysis['operatorReplays']==0 and analysis['keyNeverLeavesHost']
assert analysis['runDiagnosticFailureClosedLiteralMatch']==[{'line':69,'literal':'Hook command path refused; retained per-owner evidence required'}]
assert analysis['runDiagnosticSourceSha256']==sha((B/'run_diagnostic.py').read_bytes())
for value in analysis['owners']:
    assert value['fullMountObjectsEqualIgnoringArrayOrder'] and value['bothMatchExactBoundPinsIgnoringMountArrayOrder']
    assert all(v is True for k,v in value['selectedFieldEqual'].items() if k!='mounts')
    assert value['beforeStateSafe']==value['afterStateSafe'] and value['beforeStateSafe']['Running'] is False and value['beforeStateSafe']['OOMKilled'] is False and value['beforeStateSafe']['ExitCode']==137
assert analysis['owners'][0]['selectedFieldEqual']['mounts'] is True and analysis['owners'][1]['selectedFieldEqual']['mounts'] is False
assert analysis['owners'][1]['beforeMountDestinationOrder']==['/app/server/uploads','/app/server/prisma','/tmp'] and analysis['owners'][1]['afterMountDestinationOrder']==['/app/server/prisma','/tmp','/app/server/uploads']
calls=[]
for i in range(1,7):
    n='hook/docker-call-'+str(i).zfill(3)+'.json';value=read(n);assert value['returnCode']==0 and value['transportErrorType'] is None and value['argv'][:2]==['docker','ps' if i in (1,4) else 'inspect'] and value['elapsedSeconds']<30
    assert value['streams']['stderr']['bytes']==0
    for stream,pin in value['streams'].items():
        row=obs['files']['hook/'+pin['path']];assert row['hostOnly'] and row['mode']==pin['mode']==256 and row['bytes']==pin['bytes'] and row['sha256']==pin['sha256']
        assert row['mtimeNs']<=obs['files'][n]['mtimeNs']<=obs['files']['hook/public-result.json']['mtimeNs']
    calls.append(value)
pins=read('diagnostic-pins.json')
for j,v in enumerate(analysis['owners']):
    cid=v['beforeSelected']['id'];owner=v['beforeSelected']['owner'];base=0 if j==0 else 3
    assert calls[base]['argv']==['docker','ps','-aq','--no-trunc','--filter','label=io.soilfer.release-owned='+owner]
    assert calls[base+1]['argv']==calls[base+2]['argv']==['docker','inspect',cid]
mem={};raw_count=0;unit=c.UNITS['hook'];member='0::/system.slice/'+unit+'\n'
for label in ['before','after']:
    value=read('hook/memory-'+label+'.json');records=[read('hook/memory-'+label+'-raw-'+str(i).zfill(2)+'.json') for i in range(1,8)];raw_count+=7
    pid=re.fullmatch('/proc/([0-9]+)/cgroup',records[0]['path']).group(1);assert pid==re.fullmatch('/proc/([0-9]+)/cgroup',records[6]['path']).group(1)
    assert records[0]['rawAscii']==records[6]['rawAscii']==member
    assert [r['path'] for r in records[1:6]]==['/sys/fs/cgroup/system.slice/'+unit+'/'+n for n in ['memory.events','memory.current','memory.peak','memory.max','memory.swap.max']]
    for r in records:assert sha(r['rawAscii'].encode('ascii'))==r['sha256'] and len(r['rawAscii'].encode('ascii'))==r['bytes']
    for r,n in zip(records[1:6],['memory.events','memory.current','memory.peak','memory.max','memory.swap.max']):assert value['raw'][n]==r['rawAscii'] and value['sha256'][n]==r['sha256']
    events={a:int(b) for a,b in (s.split() for s in records[1]['rawAscii'].splitlines())};assert events==value['events'] and events['oom']==events['oom_kill']==0
    for r,n in zip(records[2:6],['memory.current','memory.peak','memory.max','memory.swap.max']):assert int(r['rawAscii'])==value['scalars'][n]
    assert value['scalars']['memory.max']==805306368 and value['scalars']['memory.swap.max']==0 and value['unit']==unit and value['membershipRaw']==member and value['cgroupDevice']==24 and value['cgroupInode']==40304
    mem[label]=value
assert all(mem['before'][k]==mem['after'][k] for k in ['unit','membershipRaw','cgroupDevice','cgroupInode'])
for name,row in prior['files'].items():assert obs['files'][name]==row,'Retained C1 original changed '+name
spec=json.loads((B/('package-'+c.NAME)/'package-spec.json').read_bytes())
for name,digest in spec['fileHashes'].items():assert sha((P/name).read_bytes())==digest
files,index=prep.source_index(spec['sourceHead']);frozen=json.loads((W/'WP/startup-order-readiness-20261015/full-pinned-copy-retention-bound-ordinary-once/source-before.json').read_bytes());assert len(frozen)==1333
for name,digest in frozen.items():assert sha((W/name).read_bytes())==digest
captures=[];original=subprocess.check_output
def capture(args,*a,**kw):
    raw=original(args,*a,**kw)
    if args[:2]==['gh','api']:captures.append((args,raw))
    return raw
subprocess.check_output=capture
review=authority.read('repos/yigini/soilfer-lims/issues/comments/6210209468');c.approval(review,index);assert c.canonical(review)+b'\n'==(P/'diagnostic-source-review.json').read_bytes()
evidence=authority.current_evidence();prep.later_comments(evidence,review,index)
cards={n:read(n) for n in ['r4-before-unit-hook.json','hook/r4-before.json','hook/r4-after.json']}
for card in cards.values():assert card['requiredBytes']==24851118190 and not card['copiesPending'] and card['futurePackageBytes']==0 and all(r['freeBytes']>=24851118190 and r['device']==64769 and r['blockBytes']==4096 for r in card['paths'].values())
allocation=read('hook/allocation-result.json');drop=max(0,max(cards['hook/r4-before.json']['paths'][p]['freeBytes']-cards['hook/r4-after.json']['paths'][p]['freeBytes'] for p in cards['hook/r4-before.json']['paths']));assert drop==allocation['freeDropBytes'] and allocation['unexplainedBytes']==max(0,drop-allocation['knownNewRootAllocatedBytes']) and allocation['unexplainedBytes']<500000000
closed_us=int(next(v['__REALTIME_TIMESTAMP'] for v in journal if v.get('UNIT_RESULT')=='exit-code'));closed_utc=datetime.datetime.fromtimestamp(closed_us/1000000,datetime.timezone.utc).isoformat()
D.mkdir();save(D,'current-authority-evidence.json',canonical(evidence)+b'\n')
for i,(_,raw) in enumerate(captures):save(D,'api-original-'+str(i).zfill(2)+'.json',raw)
save(D,'api-command-index.json',canonical([{'file':'api-original-'+str(i).zfill(2)+'.json','argv':args,'length':len(raw),'sha256':sha(raw)} for i,(args,raw) in enumerate(captures)])+b'\n')
private={n:v for n,v in obs['files'].items() if v['hostOnly']};assert len(private)==16 and all(n not in obs['publicFiles'] for n in private)
save(D,'private-content-exclusions.json',canonical({'hostOnlyFiles':private,'rawStreamsNeverFetched':True,'bothPrivateKeysAndDatabaseCopiesNeverFetched':True,'retainedHostAnalysisOnlySafeExplicitSelectionsPublished':True})+b'\n')
save(D,'first-host-analysis-refusal-derived.json',canonical({'kind':'TOOL_OUTPUT_TRANSCRIPTION','error':"KeyError: 'id' at selected-pin comparison; diagnostic-pins owners are already keyed by full ID and do not repeat an id field",'readOnlyHostFiles':True,'beforeAnyStdoutDisclosure':True,'hostWrites':0,'DockerCalls':0,'operatorReplays':0,'successor':'New complete read-only analysis binds both IDs to owner dictionary keys and emits explicit safe selections only; old helper/logs untouched'})+b'\n')
record={'status':'ACTUAL_TWO_PRECHECK_RESULTS_C1_PASS_C2_FAILED_AWAITING_CLAUDIO_ACCEPTANCE','independentlyValidatedUtc':utc(),'sourceHead':index['head'],'sourceReviewId':6210209468,'C1ResultSha256':sha((P/'comparator/public-result.json').read_bytes()),'C2ResultSha256':sha((P/'hook/public-result.json').read_bytes()),'C2ClosedJournalUtc':closed_utc,'C2Invocation':'d3252723e193488db1d0aba7425f1778','C2ElapsedSeconds':result['elapsedSeconds'],'C2ActualFailure':error,'C2OwnFailureClosedLiteral':analysis['runDiagnosticFailureClosedLiteralMatch'],'sixRealDockerCommandsExit0EmptyStderr':True,'commandsOnlyPsInspect':True,'actualStopStartCalls':0,'bothActualOwnersStoppedAndExactPinnedIdentityUnorderedMountObjectsUnchanged':True,'failedComparisonOnlyMountArrayOrderChanged':True,'old063000HookCauseRemainsUnknown':True,'all14C2ControllerRawReadsVerified':raw_count==14,'C2ControllerOomBeforeAfterZero':True,'C2ControllerAfterPeakObservationOnly':mem['after']['scalars']['memory.peak'],'all100RootFiles':len(obs['files']),'all58PriorC1FilesStable':True,'all29PackageFilesUnchanged':True,'all26SourcesAnd1333AppInputsUnchanged':True,'privateHostOnlyFiles':len(private),'privateBytesFetched':0,'noSqlOrOperatorReplay':True,'allocation':allocation,'systemctlGcDefaultsDoNotOverrideFailedJournal':True,'releaseQualified':False,'attemptAllowed':False,'C1ActualResult':read('comparator/public-result.json'),'C2ActualResult':result}
save(D,'independent-both-closed-validation.json',canonical(record)+b'\n')
lead=f'''LATEST ACTUAL TWO PRECHECK RESULTS - C1PASS/C2FAILED {closed_utc} / independent{record['independentlyValidatedUtc']}.
Exacta6d8c5d5085bbe07cb649f858ec00acf0e3f8ee1/PASS6210209468/ONEC1THENONEC2/noretry. C1CLOSED07:23:17.708897/127.787s/full11242/zeroRefusals/allholdauditsconsumed/186Sample22Hold230Audit1Notice/20oldCROSS_SUBMISSION_DUPLICATE/original6SHAstatbeforeafterequal/14controllerrawsdev24inode38997OOM0. C1resultSHA{record['C1ResultSha256']}.
C2actualCLOSEDFAILED07:26:35.630105/invd3252723e193488db1d0aba7425f1778/0.485915s/ExecStart1/journalexit-code/resultSHA{record['C2ResultSha256']}. Six REALdockercommandsONLYpsinspect/allreturn0/ALLstderrEMPTY/12rawstreamsHOST0400ENV-JWTNEVERFETCH; percallmetadataSHA-length-modeargvtimeBEFOREpredicates. Owner1retained; owner2FAILphasecompare/literal Exact owned container remains running or changed. HOST-only retainedstreamanalysis proves ONLY fullMounts ARRAYORDER changed forowner2: uploads,prisma,tmp -> prisma,tmp,uploads; fullobjectsunorderedEQUAL/allotherselectedfieldsEQUAL/BOTHownersstillSTOPPED Exit137OOMfalse/exactpinsunchanged. This explains THISC2refusal, notold063000hookcauseUNKNOWN. C2remainsFAILED/allExactOwnedStoppedfalse; no retroPASS/retry. Ownrun_diagnosticHMAC matched closedsourceRuntimeError line69 Hook command path refused; retained per-owner evidence required HOSTkeyONLY/no keyfetch.
ALL14C2numericcontrollerraws independentlyverified/exactunit/dev24inode40304/805306368Swap0/OOM0/afterpeak29425664observationONLY; fourPID1journal records includeMainEXIT1+FAILexit-code. GCsystemctl defaultsResultsuccess/ExecStatus0/infinity/sentinel NOTexecutedlimits/NOfailureoverride.100rootfiles/84publicoriginals/16privateHOSTONLY(includes2DB2keys12streams)/ALL58C1filesunchanged/29pkg/26sources+1333appunchanged/currentauthoritiesfresh. C2freshR4req24851118190/future0/sameFS64769/10GB4GiBlogs/500MB/allocationFILESonly. FirstHOSTreadonlyanalysisKeyErrorid beforestdout/nohostwrite/newuniquecompleteanalysis succeeded/nooperatorreplay. Fullrawpublicresults+safeanalysis+privatehashstat+currentauthority at {c.REL}both-prechecks080000-closed-complete-result-publication-once/publication-index.json.
NEXT ONE@claude162 bothactualRESULTS bundles6210209468SourcePASSACKONLYthere; requestactualBOTHresultsacceptance and separatelyauditedforwarddirection for mount-order comparison. NOnewremedygraph/sourcePASS/package/attempt exists; don'twaitfornonexistentapproval/replayconsumed080000. All080000rootBOTHunits/PASS/package/launchers/operators/helpersCONSUMEDimmutable NEVERpatchretryredispatchreplaycleanup. ActualClacceptance THENdistinctattemptgraphbindsacceptance+ownexactSourcePASS/freshR4unusedrootunit/ONEattempt. Noqualification/kit/gate/deploy/MainMERGEHOLD.233000KEEPIT/R2COMPLETE/noprune/nohostgrowrestart/no103/noagentsnewchatworktreecheckoutconcurrentwriter/humansheld. C1validates186new22holds; skipped22logonly/futurecounts maydiff+9to10minrestart/exact600failure. NativefallbackCANCELLEDanswered/no duplicateACK/GH/native. SAMEheartbeat2min/restore10ONLYactualbeDEPLOYED+ClactualpostdeployPASS. Preserve ALLolderhistoryverbatimbelow.

'''
save(D,'first-local-validation-refusal-derived.json',canonical({'kind':'TOOL_OUTPUT_TRANSCRIPTION','error':'Local wrapper compared ensure_ascii=True serialization against approved ensure_ascii=False package bytes; fresh JSON/body/unedited timestamps were independently equal','boundary':'Before D creation/current-authority capture/SSH/staging','operatorReplay':False,'sourceChange':False,'correction':'New unique evidence validator uses the bound c.canonical for exact package byte comparison'})+b'\n')
extras=[pathlib.Path(__file__).with_name('validate-publish-prechecks080000-both-closed-results-once.py')]+[p for folder in [O,A,AF] for p in folder.rglob('*') if p.is_file()]+[pathlib.Path(__file__),pathlib.Path(__file__).with_name('observe-prechecks-hook080000-first-readonly-once.py'),pathlib.Path(__file__).with_name('analyse-prechecks080000-hook-retained-streams-host-only-once.py'),pathlib.Path(__file__).with_name('analyse-prechecks080000-hook-retained-streams-complete-host-only-once.py')]
out=boundary_publish(D,extras,'Retain actual C1 pass and C2 mount-order refusal with safe evidence',lead);print(json.dumps({**out,**{k:record[k] for k in ['status','C1ResultSha256','C2ResultSha256','C2ClosedJournalUtc','sixRealDockerCommandsExit0EmptyStderr','failedComparisonOnlyMountArrayOrderChanged','privateBytesFetched']}}))
