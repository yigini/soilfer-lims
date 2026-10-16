"""Validate retained C1 public closure without SQL, keys or operator replay."""
import json,pathlib,base64,re,datetime
from prechecks6210209468_boundary_publication import *
O=B/'comparator080000-second-readonly-once';F=B/'comparator080000-first-readonly-once';D=B/'comparator080000-closed-publication-once';assert not D.exists() and not git('diff','--cached','--name-only').strip()
obs=json.loads((O/'stdout-original.json').read_bytes());first=json.loads((F/'stdout-original.json').read_bytes());P=O/'public-originals'
def read(n):return json.loads((P/n).read_bytes())
show=dict(s.split('=',1) for s in base64.b64decode(obs['units']['comparator-show']['stdoutBase64']).decode().splitlines() if '=' in s);assert show['ActiveState']=='inactive' and show['SubState']=='dead'
journal=[json.loads(s) for s in base64.b64decode(obs['units']['comparator-journal']['stdoutBase64']).decode().splitlines()];assert len(journal)==4 and all(v.get('INVOCATION_ID')=='49e822ac6a8f47f0bd3bc768212a074f' for v in journal)
assert sum('Deactivated successfully' in v['MESSAGE'] for v in journal)==1 and all(v.get('PRIORITY')=='6' for v in journal)
result=read('comparator/public-result.json');assert result['status']=='PRECHECK_PASS_AWAITING_CLAUDIO_ACCEPTANCE' and result['failure'] is None and result['sourceHead']=='a6d8c5d5085bbe07cb649f858ec00acf0e3f8ee1' and result['sourceReviewId']==6210209468 and result['originalsPreserved'] and result['controllerBeforeAfterOomZero'] and not result['attemptAllowed'] and not result['releaseQualified']
counts=result['result'];assert counts['addedRowCounts']=={'Sample':186,'SampleHold':22,'AuditLog':230,'Notification':1} and counts['validatedNewSampleCount']==186 and counts['validatedAddedHoldCount']==22 and sum(counts['newSampleCountsByKeyedConfig'].values())==186 and counts['classificationCounts']=={'CROSS_SUBMISSION_DUPLICATE':20} and counts['changedSampleCount']==20 and counts['sameSyncNewConflictCount']==0 and counts['zeroRefusals'] and counts['allAddedHoldAuditRowsExactlyConsumed'] and counts['protectedTableCount']==112 and counts['migrationReceiptCount']==42
mem={};raw_count=0
unit='lims-workflow-batch-prechecks-be837974-20261016t080000z-comparator.service';member='0::/system.slice/'+unit+'\n'
for label in ['before','after']:
    value=read('comparator/memory-'+label+'.json');records=[read('comparator/memory-'+label+'-raw-'+str(i).zfill(2)+'.json') for i in range(1,8)];raw_count+=len(records)
    expected_paths=['/proc/608066/cgroup']+['/sys/fs/cgroup/system.slice/'+unit+'/'+n for n in ['memory.events','memory.current','memory.peak','memory.max','memory.swap.max']]+['/proc/608066/cgroup']
    assert [r['path'] for r in records]==expected_paths and records[0]['rawAscii']==records[6]['rawAscii']==member
    for r in records:
        raw=r['rawAscii'].encode('ascii');assert len(raw)==r['bytes'] and sha(raw)==r['sha256']
    for r,n in zip(records[1:6],['memory.events','memory.current','memory.peak','memory.max','memory.swap.max']):assert value['raw'][n]==r['rawAscii'] and value['sha256'][n]==r['sha256']
    events={a:int(b) for a,b in (s.split() for s in records[1]['rawAscii'].splitlines())};assert events==value['events'] and events['oom']==events['oom_kill']==0
    for r,n in zip(records[2:6],['memory.current','memory.peak','memory.max','memory.swap.max']):assert int(r['rawAscii'])==value['scalars'][n]
    assert value['scalars']['memory.max']==805306368 and value['scalars']['memory.swap.max']==0 and value['unit']==unit and value['membershipRaw']==member and value['cgroupDevice']==24 and value['cgroupInode']==38997
    mem[label]=value
assert all(mem['before'][k]==mem['after'][k] for k in ['unit','membershipRaw','cgroupDevice','cgroupInode'])
before=read('comparator/originals-before.json');after=read('comparator/originals-after.json');assert before==after and len(before)==6
pins=read('diagnostic-pins.json')
for name,pin in pins['files'].items():
    value=before[name]
    if pin is None:assert value is None
    else:assert value['sha256']==pin['sha256'] and value['st_size']==pin['bytes'] and value['st_dev']==pin['device'] and value['st_ino']==pin['inode'] and value['st_mtime_ns']==pin['mtimeNs'] and value['mode']==256 and value['st_nlink']==1 and value['allocatedBytes']==pin['allocatedBytes']
for rel,source in [('comparator/baseline.db','startup-1-stopped-seal/backup.db'),('comparator/current.db','first-sync.db')]:
    value=obs['files'][rel];pin=pins['files'][pins['consumedRoot']+'/'+source];assert value['sha256']==pin['sha256'] and value['bytes']==pin['bytes'] and value['mode']==256 and value['hostOnly']
for name,row in first['files'].items():assert obs['files'][name]==row,'Previously retained root original changed '+name
spec=json.loads((B/'package-workflow-batch-prechecks-be837974-20261016T080000Z/package-spec.json').read_bytes())
for name,digest in spec['fileHashes'].items():assert sha((P/name).read_bytes())==digest
cards={n:read(n) for n in ['r4-before-root.json','r4-before-unit-comparator.json','comparator/r4-before.json','comparator/r4-after.json']}
for name,card in cards.items():
    required=10556150894+4*1024**3+10000000000+(1126653952 if card['copiesPending'] else 0)+card['futurePackageBytes'];assert card['requiredBytes']==required and card['sameFilesystemNonadditive'] and card['additionalHeadroomBytes']==10000000000
    assert all(r['device']==64769 and r['blockBytes']==4096 and r['freeBytes']>=required for r in card['paths'].values())
    assert card['futurePackageBytes']==(5992448 if name=='r4-before-root.json' else 0)
allocation=read('comparator/allocation-result.json');drop=max(0,max(cards['comparator/r4-before.json']['paths'][p]['freeBytes']-cards['comparator/r4-after.json']['paths'][p]['freeBytes'] for p in cards['comparator/r4-before.json']['paths']))
assert allocation['freeDropBytes']==drop and allocation['unexplainedBytes']==max(0,drop-allocation['knownNewRootAllocatedBytes']) and allocation['unexplainedBytes']<500000000 and not allocation['wholeStorePhysicalMeasurementClaimed']
closed_us=int(next(v['__REALTIME_TIMESTAMP'] for v in journal if 'Deactivated successfully' in v['MESSAGE']));closed_utc=datetime.datetime.fromtimestamp(closed_us/1000000,datetime.timezone.utc).isoformat()
D.mkdir();record={'status':'ACTUAL_C1_CLOSED_PASS_AWAITING_CLAUDIO_ACCEPTANCE','independentlyValidatedUtc':utc(),'observedUtc':obs['observedUtc'],'closedJournalUtc':closed_utc,'invocation':'49e822ac6a8f47f0bd3bc768212a074f','publicResultSha256':sha((P/'comparator/public-result.json').read_bytes()),'all14ControllerRawReadsVerified':raw_count==14,'controllerCgroupDevice':24,'controllerCgroupInode':38997,'controllerOomBeforeAfterZero':True,'maxHighPeakObservationOnly':True,'controllerAfterPeak':mem['after']['scalars']['memory.peak'],'original6FullShaStatBeforeAfterEqual':True,'all29PackageFilesUnchanged':True,'allFirstObservationOriginalsUnchanged':True,'rootFileCount':len(obs['files']),'privateBytesFetched':0,'sqlReplay':0,'actualCounts':counts,'allocation':allocation,'C2Launched':False,'releaseQualified':False,'systemctlAfterGcDefaultsNotExecutedLimits':True,'beforeRootCorrection':'77279137792 was preflight; actual retained beforeROOT card free77279129600; no change to original cards'}
save(D,'independent-closed-validation.json',canonical(record)+b'\n')
lead=f'''LATEST ACTUAL C1 COMPARATOR CLOSED PASS - {closed_utc} / independent{record['independentlyValidatedUtc']}.
ONE exacta6d8c5d5/PASS6210209468 C1 inv49e822ac6a8f47f0bd3bc768212a074f CLOSEDsuccess after127.787035208s. Originalpublic-resultSHA{record['publicResultSha256']}/PRECHECK_PASS_AWAITING_CLAUDIO_ACCEPTANCE. Full112schema42receipts/zeroRefusals/alladdedholdauditsconsumed; actualaddedSample186/Hold22/Audit230/Notification1;20changedCROSS_SUBMISSION_DUPLICATE/0same-sync-newconflict.186new/22holds nowC1validated vs186/22LOGONLY; skipped22 remains logdescription.6originalSHAstatbeforeafterincludingctime equal/twoNEWcopymains0400matchingSHA/privatekeyHOST/0privatebytesfetched/noSQLreplay.
ALL14numeric608066controllerraws independentlyrederived/exactunit/dev24inode38997/beforeafterOOM0/805306368Swap0/afterpeak805306368+max16050 observationsONLY. Full4PID1sameinvjournal successfuldeactivation; GCsystemctlnotfound/defaultinfinity/peakUINTMAX NOTexecutedlimits; actualactivepropsretainedopening.58rootfiles/ALL29pkg unchanged/initial46originalsunchanged. R4actualbeforeROOTfree77279129600(req25983764590/future5992448); immediatelyUNITfree77275209728(req25977772142/future0); runtimebeforefree77275185152. Earlier77279137792 was preflight NOTactualbeforeROOT/cardunchanged. SameFS64769/4096/nonadditive10GB/copies+4GiBlogs/floor; freeDrop1126887424-known1126739968=147456<500MB/FILESallocationONLY/no whole-storedu.
Full C1 originals/independentvalidation at WP/controller063000-prechecks-be837974-20261016/comparator080000-closed-publication-once/publication-index.json. NEXT unchanged reviewed C2launcher afterfreshauthorityR4/unusedhookunit/closedC1public-result; ONErun/no retry/psinspectONLY/BOTHalreadySTOPPED063000owners/ALLrawstreamsHOST0400ENV-JWTNEVERFETCH. C2NOTlaunched atthischeckpoint. ActualClBOTHresultacceptance THENdistinctattemptgraphbindsacceptance+ownexactSourcePASS/freshR4unusedrootunit/ONEattempt. Noqualification/kit/gate/deploy/MainMERGEHOLD. Old063000source572d/PASS620818/rootunitoperatorsCONSUMEDimmutable/233000KEEPIT/R2COMPLETE/noprune/nohostgrowrestart/no103/noagentsnewchatworktreecheckoutconcurrentwriter/humansheld. Futurekitcounts maydiff+9to10minrestart/exact600failure. NativefallbackCANCELLEDanswered/no duplicateACK/GH/native. SAMEheartbeat2min/restore10ONLYactualbeDEPLOYED+ClactualpostdeployPASS. Preserve ALLolderhistoryverbatimbelow.

'''
out=boundary_publish(D,[pathlib.Path(__file__),pathlib.Path(__file__).with_name('observe-prechecks-comparator080000-second-readonly-once.py'),*[p for p in O.rglob('*') if p.is_file()]],'Validate actual closed C1 comparator pass and counts',lead);print(json.dumps({**out,**{k:record[k] for k in ['status','closedJournalUtc','publicResultSha256','all14ControllerRawReadsVerified','C2Launched']}}))
