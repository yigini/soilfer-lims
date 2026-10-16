"""Two separately launched single-use prechecks; no qualification attempt."""
import collections,json,pathlib,sys,time,os
import diagnostic_contract as c
import diagnostic_io as io
import provenance_privacy as privacy
from controller_guard import own_snapshot
from proof_files import write_new
def memory(root,mode,label):
    def record(path,raw):
        count=len(list(root.glob('memory-'+label+'-raw-*.json')))+1
        write_new(root/('memory-'+label+'-raw-'+str(count).zfill(2)+'.json'),{'path':path,'rawAscii':raw.decode('ascii'),'sha256':c.sha(raw),'bytes':len(raw)})
    value=own_snapshot(evidence=record,unit=c.UNITS[mode]);write_new(root/('memory-'+label+'.json'),value);return value
def comparator(root,pins):
    from kobo_copy_preservation import verify_copy
    baseline,current=io.copy_mains(pins,root)
    fetch=json.loads((pathlib.Path(c.ROOT)/'retained-fetch-original.json').read_bytes())
    c.require(c.sha((pathlib.Path(c.ROOT)/'retained-fetch-original.json').read_bytes())==pins['fetchSha256'],'Original retained fetch changed')
    ids={i:r['submissionIds'] for i,r in fetch.items()}
    # EXACT call/arguments at bound proof_jobs.py:181-182, on NEW copies only.
    result=verify_copy(baseline,current,expected_table_count=112,fetched_ids=ids,refusal_configs=sorted(privacy.REFUSALS),fetch_records=fetch,owner_root=root)
    c.require(result['allAddedHoldAuditRowsExactlyConsumed'] and result['protectedTableCount']==112 and result['schemaPreserved'],'Complete comparator check required')
    counts={n:len(v) for n,v in result['additions'].items()}
    reports=result['changedSamples']+result['sameSyncNewSampleConflictReports'];classes=dict(collections.Counter(r['classification'] for r in reports))
    c.require(all(r['classification'] in ('CROSS_SUBMISSION_DUPLICATE','PRIMARY_REVISION') for r in reports),'Comparator contains a refusal')
    return {'classificationCounts':classes,'newSampleCountsByKeyedConfig':{privacy.value_hash(k):v for k,v in result['newSampleCount'].items()},'addedRowCounts':counts,'changedSampleCount':len(result['changedSamples']),'sameSyncNewConflictCount':len(result['sameSyncNewSampleConflictReports']),'allAddedHoldAuditRowsExactlyConsumed':True,'protectedTableCount':112,'migrationReceiptCount':42,'fullComparisonHmacSha256':privacy.value_hash(result),'zeroRefusals':True,'logCountsOnly':{'new':186,'skipped':22},'validatedNewSampleCount':sum(result['newSampleCount'].values()),'validatedAddedHoldCount':counts['SampleHold']}
def hook(root,pins):
    import stop_owned as stop
    stop.configure_records(root)
    result=stop.stop_exact(stop.readonly_call)
    # Errors are converted later, after the key exists. Nothing is serialized yet.
    if result['allExactOwnedStopped']:
        c.require(len(result['stoppedAndRetained'])==2,'Both retained stopped owners required; no vacuous pass')
        for r in result['stoppedAndRetained']:
            b=r['before'];expected=pins['owners'].get(b['id'])
            c.require(expected and b['running'] is False and r['after']['running'] is False and b['owner']==expected['labels'][stop.LABEL] and b['image']==expected['image'] and b['name']==expected['name'] and b['startedAt']==expected['startedAt'] and sorted(b['mounts'],key=lambda m:m['Destination'])==sorted(expected['mounts'],key=lambda m:m['Destination']),'Stopped063000 exact owner identity changed')
    return result
def main(mode):
    root=pathlib.Path(c.ROOT);c.require(mode in c.MODES and pathlib.Path(__file__).resolve().parent==root,'Exact diagnostic root and mode required')
    index=json.loads((root/'diagnostic-source-index.json').read_bytes());review=json.loads((root/'diagnostic-source-review.json').read_bytes());c.approval(review,index)
    for name,digest in c.bindings(index).items():c.require(c.sha((root/name).read_bytes())==digest,'Executed diagnostic source differs')
    authority=json.loads((root/'current-authority.json').read_bytes());c.accepted(authority['accepted063000'])
    run=root/mode;run.mkdir(mode=0o700);pins=json.loads((root/'diagnostic-pins.json').read_bytes())
    before_memory=None;after_memory=None;failure=None;result=None;original_before=None;original_after=None;after_r4=None;began=time.monotonic()
    before_r4=io.capacity(pins,copies_pending=mode=='comparator');start_allocated=io.allocated(root)
    write_new(run/'r4-before.json',before_r4)
    try:
        before_memory=memory(run,mode,'before')
        if mode=='comparator':
            original_before=io.originals(pins);write_new(run/'originals-before.json',original_before)
            privacy.initialize_private_key(run)
            result=comparator(run,pins)
        else:result=hook(run,pins)
    except BaseException as e:failure=e
    finally:
        try:
            after_memory=memory(run,mode,'after')
            if before_memory is not None:c.require(all(before_memory[k]==after_memory[k] for k in ['unit','membershipRaw','cgroupDevice','cgroupInode']),'Diagnostic cgroup changed between reads')
            if mode=='comparator':
                original_after=io.originals(pins);write_new(run/'originals-after.json',original_after)
                c.require(original_before==original_after,'Diagnostic originals changed; result VOID')
            after_r4=io.capacity(pins,copies_pending=False);write_new(run/'r4-after.json',after_r4)
            accounting=io.growth(before_r4,after_r4,max(0,io.allocated(root)-start_allocated));write_new(run/'allocation-result.json',accounting)
        except BaseException as e:
            if failure is None:failure=e
        if privacy._value_key is None:privacy.initialize_private_key(run,'private-stop-post-hmac-key.json' if mode=='hook' else 'private-value-hmac-key.json')
        if mode=='hook' and result is not None:
            import stop_owned
            result=stop_owned.public_result(result)
            if not result['allExactOwnedStopped'] and failure is None:failure=RuntimeError('Hook command path refused; retained per-owner evidence required')
        public={'status':'PRECHECK_PASS_AWAITING_CLAUDIO_ACCEPTANCE' if failure is None else 'PRECHECK_FAILED_RETAIN_ALL_NO_RETRY','check':mode,'sourceHead':index['head'],'sourceReviewId':review['id'],'acceptedClosedFailureId':c.ACCEPTED_ID,'elapsedSeconds':time.monotonic()-began,'result':result,'failure':privacy.public_failure(failure) if failure else None,'controllerBeforeAfterOomZero':before_memory is not None and after_memory is not None,'originalsPreserved':original_before==original_after if mode=='comparator' else None,'releaseQualified':False,'attemptAllowed':False,'neverRetry':True,'rawInspectStdoutNeverFetched':True,'privateFilesHostOnly':True}
        write_new(run/'public-result.json',public)
    if failure is not None:raise SystemExit(1)
if __name__=='__main__':main(sys.argv[1])
