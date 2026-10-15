"""Derive honest partial startup findings from closed retained bytes only."""
import collections,datetime,json,pathlib,sys
REPO=pathlib.Path(__file__).resolve().parents[2];S=REPO/'WP/batch-proof-health-transitions-cde8-20261015';D=S/'first-proof-100000-closed-health-transition-stop'
sys.path.insert(0,str(S));from proof_contract import canonical,require
out=D/'retained-only-health-failure-analysis.json';require(not out.exists(),'Consumed analysis')
r=json.loads((D/'closed-retention-record.json').read_bytes());root=D/'remote-originals'
spec=json.loads((root/'proof-input.json').read_bytes())
stdout=(D/'fresh-closed-diagnostics/fresh-closed-startup-1-docker-logs-stdout.log').read_text(encoding='utf-8')
stderr=(D/'fresh-closed-diagnostics/fresh-closed-startup-1-docker-logs-stderr.log').read_text(encoding='utf-8')
def objects(text):
    d=json.JSONDecoder();rows=[];offset=0
    while offset<len(text):
        at=text.find('{',offset)
        if at<0:break
        try:v,end=d.raw_decode(text[at:]);offset=at+end
        except ValueError:offset=at+1;continue
        if isinstance(v,dict):rows.append(v)
    return rows
entry=[v for v in objects(stdout.split('Starting SoilFER-LIMS...')[0]) if 'totalChanges' in v]
ready=[v for v in objects(stdout) if str(v.get('event','')).endswith('_STARTUP_READY')]
require(len(entry)==27 and all(v.get('mode')=='NO_OP' and type(v.get('totalChanges')) is int and v['totalChanges']==0 for v in entry),'Partial entrypoint parse differs')
require(len(ready)==25 and all(type(v.get('totalChanges')) is int and v['totalChanges']==0 for v in ready),'Partial READY parse differs')
missing=sorted(set(spec['expectedReadyEvents'])-{v['event'] for v in ready});require(missing==['ORDER_REVISION_STARTUP_READY'],'Missing READY differs')
polls=[{'path':p.name,**json.loads(p.read_bytes())} for p in sorted(root.glob('startup-1-health-poll-*.json'))]
require(len(polls)==561 and not any(v['status']=='healthy' for v in polls),'Health poll count/status differs')
expected=json.loads((root/'derived-healthcheck.json').read_bytes())['expectedDockerHealthcheck']
require(all(all(v['healthcheck'][k]==x for k,x in expected.items()) for v in polls),'Health config differs')
transitions=[{k:v[k] for k in ['path','observedUtc','elapsedSeconds','status','previousStatus']} for v in polls if v['transition']]
require([v['status'] for v in transitions]==['starting','unhealthy'],'Transitions differ')
physical=collections.Counter()
for v in r['rootFileInventoryWithStableHashes']:physical[v['path'].split('/')[0]]+=v['allocatedBytes']
owned=list(r['newOwnedContainerClosedStates'].values());require(len(owned)==1 and owned[0]['OOMKilled'] is False and owned[0]['Running'] is False,'Owned stopped state differs')
def iso(s):return datetime.datetime.fromisoformat(s.replace('Z','+00:00')[:26]+'+00:00')
v={'status':'RETAINED_ONLY_PARTIAL_STARTUP_ANALYSIS_WHOLE_PROOF_FAILED_NOT_RELEASE_QUALIFIED','originalTerminal':r['originalRefusal'],'freshClosedDockerLogsAreDistinctFromControllerCapture':True,'entrypointExpected':27,'entrypointVerifierCountObserved':len(entry),'entrypointAllNoOpExactIntegerZero':True,'readyExpected':26,'startupReadyCountObserved':len(ready),'readyEventsObserved':[v['event'] for v in ready],'missingReadyEvents':missing,'readyAllExactIntegerZero':True,'serverStartMarkerObserved':'Starting SoilFER-LIMS...' in stdout,'lastReadyEvent':ready[-1]['event'],'httpReadinessResponseObserved':False,'stoppedFullLogicalStateSealObserved':False,'startupResultObserved':False,'secondStartupAttempted':False,'terminalWholeStoreAccountingCompleted':False,'healthPollCount':len(polls),'allFullHealthPollsRetained':True,'healthTransitionsObserved':transitions,'timeToFirstHealthySeconds':None,'lastHealthPollPath':polls[-1]['path'],'lastPollElapsedSeconds':polls[-1]['elapsedSeconds'],'unhealthySecondsThroughLastObservedPoll':polls[-1]['unhealthySecondsObservedSoFar'],'unhealthyTimeMeaning':'MONOTONIC_INTERVALS_BETWEEN_OBSERVED_POLLS_NOT_UNOBSERVED_EXACT_DOCKER_TRANSITION_TIME_NO_FINAL_UNOBSERVED_INTERVAL_ADDED','lastFailingStreak':polls[-1]['state']['Health']['FailingStreak'],'lastHealthLog':polls[-1]['state']['Health']['Log'],'allRetainedHealthConfigsMatchDerived':True,'ownedRuntimeSecondsFromDockerState':(iso(owned[0]['FinishedAt'])-iso(owned[0]['StartedAt'])).total_seconds(),'allNewOwnedStoppedNotOom':True,'largestRootAllocationGroups':dict(physical.most_common(12)),'closedFreeBytesObservationOnly':r['currentFreeBytes'],'previousGraphRequiredFreeBytesReferenceOnly':31768290414,'deficitAgainstPreviousRequirementReferenceOnly':31768290414-min(r['currentFreeBytes'].values()),'capacityIsNotFreshInputMetadataOrLaunchAuthority':True,'lastStdoutLine':stdout.strip().splitlines()[-1],'stderrHasHistoricalManualReviewPendingWarning':'A94_MANUAL_REVIEW_PENDING' in stderr,'warningIsNotNewScientificAuthorityOrDiagnosis':True,'causeBeyondDeadlineNotEstablished':True,'wouldFinishOrPassWithMoreTimeNotEstablished':True,'newSourceGraphImplemented':False,'sqlConnections':0,'remoteCommands':0,'proofReplays':0}
with out.open('xb') as f:f.write(canonical(v)+b'\n')
print(json.dumps({k:v[k] for k in ['status','entrypointVerifierCountObserved','startupReadyCountObserved','missingReadyEvents','healthPollCount','unhealthySecondsThroughLastObservedPoll','ownedRuntimeSecondsFromDockerState','deficitAgainstPreviousRequirementReferenceOnly']}))
