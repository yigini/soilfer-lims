"""Independently validate retained complete R2 originals; no host or mutation calls."""
import collections,datetime,pathlib,subprocess,sys
R=pathlib.Path(__file__).resolve().parents[2];S=R/'WP/r2-cache-api-identity-acc15844-20261015';D=S/'r2-220000-closed-originals-once';OUT=D/'independent-closed-validation.json'
sys.path.insert(0,str(S));from r2_contract import *
require(not OUT.exists(),'One new validation only')
m=json_exact((D/'remote-closed-original-index.json').read_bytes());require(m['root']==ROOT and m['unit']==UNIT and m['actualInvocationId']=='b9eb871451b04dbfb1cc666fe0b4ce83' and m['originalRootFileCount']==159 and len(m['files'])==168,'Exact complete closed retention required')
for n,r in m['files'].items():
    raw=(D/n).read_bytes();require(len(raw)==r['bytes'] and sha(raw)==r['sha256'] and oid(raw)==r['gitBlobOid'],'Original raw bytes differ '+n)
files={p.name:p.read_bytes() for p in (S/'reviewed-r2-package-once').iterdir() if p.is_file()};require(len(files)==33,'Exact33file package required')
validate_package(json_exact(files['package-input.json']),json_exact(files['source-index.json']),json_exact(files['source-review.json']),files)
for n,raw in files.items():require((D/n).read_bytes()==raw and m['files'][n]['mode']=='0o400','Remote package identity/mode differs '+n)
require(not (D/'terminal-failure.json').exists(),'Actual terminal success receipt required for this validator')
t=json_exact((D/'terminal-receipt.json').read_bytes());require(t['status']=='R2_CAP_NOT_REACHED_ALL_REMAINING_RECORDS_RETAINED_NO_RETRY' and t['retryAllowed'] is False,'Honest cap-not-reached terminal status required')
events=[(n,json_exact((D/n).read_bytes())) for n in sorted(m['files']) if re.fullmatch(r'\d{5}-[^/]+\.json',n)]
require([int(n[:5]) for n,v in events]==list(range(1,125)),'All124 events in exact order required')
plans=[v for n,v in events if n.endswith('-closed-plan.json')];require(len(plans)==1,'One initial plan required')
closedplan=plans[0];wanted={r['ID']:r for r in closedplan['items']};require(len(wanted)==len(closedplan['items'])==32,'32 unique initial planned records required')
initial=None;latest=None;last_api=-1;last_cross=None;last_du=None;pending=None;commands=[];results=[];prunes=[];items=[];dfs=[];preservations=[];current_preservation=None;entire=[];api_inventories=[]
def without_utc(v):return {k:x for k,x in v.items() if k!='utc'}
for pos,(n,v) in enumerate(events):
    if n.endswith('-api-read.json'):
        raw=v['rawUtf8'].encode();require(sha(raw)==v['sha256'] and v['exitCode']==0,'API raw hash/result differs')
        if v['endpoint']=='/v1.52/system/df':
            latest=cache_rows(json_exact(raw)['BuildCache']);last_api=pos;api_inventories.append(latest)
            if initial is None:initial=latest
            if pending is not None and pending.get('result') is not None and 'after' not in pending:pending['after']=latest
    if n.endswith('-safe-selected-preservation.json'):
        require(v['rawContainerConfigAndEnvironmentRetained'] is False,'Raw container secrets retained')
        current_preservation=v['value'];preservations.append(current_preservation)
    if n.endswith('-df.json'):validate_df(v['statvfs']);dfs.append(v['statvfs'])
    if n.endswith('-command-intent.json'):
        require(not commands and v['neverRetry'] is True,'No overlapping or repeat commands')
        commands.append(v)
        if 'prune' in v['argv']:
            require(pending is not None and pending['intent']['argv']==v['argv'] and v['timeoutSeconds']==120,'One exact prune intent required')
    if n.endswith('-command-result.json'):
        require(len(commands)==1 and commands.pop()['argv']==v['argv'],'Full original command pairing differs')
        require(v['exitCode']==0 and v['stderr']=='' and v['error'] is None and v['outputTruncated'] is False,'Noisy/incomplete command result')
        results.append(v)
        if 'prune' in v['argv']:
            require(pending is not None and pending['intent']['argv']==v['argv'],'Prune without original intent')
            pending['result']=v;prunes.append(v)
        elif 'du' in v['argv']:
            match=re.fullmatch(r'id=\^([a-z0-9]{25})\$',v['argv'][-3]);require(match is not None,'Full anchored du ID required')
            ident=match.group(1);require(ident in wanted and v['argv']==['docker','buildx','--builder','default','du','--filter','id=^'+ident+'$','--format','json'],'Exact du command required')
            last_du=(ident,[json_exact(x) for x in v['stdout'].splitlines() if x.strip()])
        elif v['argv']==['docker','image','inspect',IMAGE]:entire.append(json_exact(v['stdout']))
    if n.endswith('-buildx-reference-crosscheck.json'):
        ident=v['ID'];require(last_du is not None and last_du[0]==ident and eligible(wanted[ident],latest) is None,'Exact API initial identity before Buildx required')
        require(without_utc(v)==du_guard(last_du[1],wanted[ident]) and v['displayValuesUsedAsMutationAuthority'] is False,'Exact independent reference/display role evidence differs');last_cross=(ident,pos)
    if n.endswith('-prune-intent.json'):
        ident=v['ID'];require(pending is None and ident in wanted and v['argv']==prune_argv(ident) and last_cross is not None and last_cross[0]==ident and last_api>last_cross[1],'Exact one-ID intent and second API after crosscheck required')
        require(eligible(wanted[ident],latest) is None and v['cacheReferenceCheck']==latest[ident] and not v['childReferences'],'Exact fresh unchanged API/reference identity required')
        require(v['allImagesAndContainersPreserved'] is True and current_preservation==preservations[0] and v['dfBefore']==dfs[-1] and v['maxUsedSpaceBytes']==CAP and v['neverReplay'] is True,'Full preservation/floor/cap guards required')
        pending={'intent':v,'before':latest}
    if n.endswith('-item-receipt.json'):
        ident=v['ID'];require(ident in wanted and ident not in [x['ID'] for x in items] and v['plannedLogicalBytes']==wanted[ident]['Size'],'Only unique initial IDs may have item receipts')
        if v['status']=='SKIPPED':require(pending is None and v['reason']==eligible(wanted[ident],latest) and v['reason'] is not None,'Actual changed/referenced reason must match API; no substitute')
        else:
            require(pending is not None and pending['intent']['ID']==ident and 'after' in pending and pending.get('result') is not None,'Original complete prune before/result/after required')
            q=pending['result'];removed=set(pending['before'])-set(pending['after']);reported=re.findall(r'^ID:\s+(\S+)\s*$',q['stdout'],re.M)
            require(len(reported)==len(set(reported)) and set(reported)==removed and removed<=set([ident]),'Observed/reported removed IDs must agree and be single-ID only')
            for i,row in pending['before'].items():
                if protected(row):require(i in pending['after'] and pending['after'][i]['Size']==row['Size'],'Protected record lost or changed')
            require(v['actualRemovedIds']==sorted(removed) and v['status']==('REMOVED' if removed else 'NOT_REMOVED') and v['referenceChecks']==wanted[ident] and v['stdoutSha256']==sha(q['stdout'].encode()) and v['exitCode']==0,'Actual per-item receipt differs')
            require(v['dfBefore']==pending['intent']['dfBefore'] and v['dfAfter']==dfs[-1] and v['allImagesAndContainersPreserved'] is True and current_preservation==preservations[0] and v['sha256'] is None and v['sha256Reason'],'Per-item df/preservation/hash role differs')
            pending=None
        items.append(without_utc(v))
require(not commands and pending is None and len(prunes)==t['actualPruneInvocations']==2 and len(items)==32 and t['items']==items,'Closed invocation/item accounting differs')
require([r['ID'] for r in closedplan['items']]==[r['ID'] for r in plan(initial)] and closedplan['initialLogicalCacheBytes']==logical_bytes(initial),'Initial bounded leaf-first plan differs')
require(logical_bytes(initial)==t['remainingLogicalCacheBytes']==logical_bytes(latest)==8072154134 and logical_bytes(latest)>CAP,'Honest full cache byte inventory/cap result differs')
protected_initial={i:r for i,r in initial.items() if protected(r)}
for i,row in protected_initial.items():require(i in latest and latest[i]['Size']==row['Size'],'Original protected cache missing/changed at closure')
require(sum(r['Size'] for r in protected_initial.values())==closedplan['protectedLogicalBytes']==t['protectedLogicalBytes']==5577243796,'All original protected bytes must remain above cap')
require(initial==latest and all(not v.get('actualRemovedIds') for v in items) and len({str(v['argv']) for v in prunes})==2 and all(v['stdout']=='Total:\t0B\n' for v in prunes),'Actual no-removal original result differs')
require(all(v==preservations[0] for v in preservations),'Every original full preservation snapshot must agree')
fresh=json_exact((D/'fresh-closed/safe-selected-preservation-derived.json').read_bytes());require(fresh['value']==preservations[0] and fresh['rawContainerConfigAndEnvironmentRetained'] is False,'Fresh complete preservation differs')
validate_build((D/'fresh-closed/qualified-build-receipt-original.json').read_bytes(),files['qualified-image-inspect.json']);require(len(entire)==2 and all(v==json_exact(files['qualified-image-inspect.json']) for v in entire) and json_exact((D/'fresh-closed/qualified-image-entire-inspect-original.json').read_bytes())==entire[0],'Entire qualified image changed')
require(m['files']['fresh-closed/qualified-build-receipt-original.json']['mode']=='0o400','Original qualified receipt mode differs')
require(t['dfBefore']==dfs[0] and t['dfAfter']==dfs[-1] and t['buildImage']==IMAGE and t['qualifiedBuildReceiptSha256']==BUILD_RECEIPT_SHA and t['cleanedImagesContainersVolumesFilesBackups']==0 and t['bytesAreLogicalNotPhysicalReclaim'] is True,'Original terminal boundary differs')
freshdf=validate_df(json_exact((D/'fresh-closed/statvfs-original.json').read_bytes()))
j=[json_exact(x) for x in (D/'fresh-journal-all-once/journal-all-original.jsonl').read_bytes().splitlines() if x];require(j and {x.get('INVOCATION_ID',x.get('_SYSTEMD_INVOCATION_ID')) for x in j}==set([m['actualInvocationId']]),'Same entire invocation journal required')
require(all(isinstance(x.get('MESSAGE'),str) for x in j) and any('Deactivated successfully' in x['MESSAGE'] for x in j),'Full unabridged successful closure journal required')
controller_messages=[json_exact(x['MESSAGE']) for x in j if x['MESSAGE'].startswith('{')]
require(controller_messages==[{k:v for k,v in t.items() if k!='closedUtc'}],'Full original controller stdout journal must match terminal receipt')
opening=json_exact((S/'first-r2-220000-readonly-observation-once/stdout-original.json').read_bytes());limits=dict(x.split('=',1) for x in opening['systemctl']['stdout'].splitlines());require(limits['InvocationID']==m['actualInvocationId'] and limits['MemoryMax']==str(MEMORY) and limits['MemorySwapMax']=='0' and limits['RuntimeMaxUSec']=='40min','Actual active executed limits required')
record={'status':'ACTUAL_R2_CLOSED_CAP_NOT_REACHED_ZERO_REMOVED_NO_RETRY','validatedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'closedUtc':t['closedUtc'],'sourceHead':'edfe56e7e77431689a58c4a641c86d538a6f795b','sourceReviewId':6201838855,'root':ROOT,'unit':UNIT,'actualInvocationId':m['actualInvocationId'],'originalRootFileCount':159,'retainedRemoteArtifactCount':168,'all33PackageHashesAnd0400ModesVerified':True,'all124OriginalEventsVerified':True,'fullUnabridgedSameInvocationJournalAndControllerStdoutVerified':True,'fullJournalAdditionalArtifactCount':2,'priorLocalValidatorRefusal':'TypeError on journalctl default MESSAGE null; original null-bearing output preserved, full --all journal fetched readonly; no R2 failure or operator replay','actualPruneInvocations':2,'itemReceiptCount':32,'removedIdCount':0,'notRemovedItemCount':2,'skippedItemCount':30,'skipReasons':dict(collections.Counter(v.get('reason') for v in items if v['status']=='SKIPPED')),'prunedCommandResults':[{'argv':v['argv'],'exitCode':v['exitCode'],'stdout':v['stdout'],'stderr':v['stderr'],'error':v['error']} for v in prunes],'initialLogicalCacheBytes':logical_bytes(initial),'remainingLogicalCacheBytes':logical_bytes(latest),'protectedLogicalBytes':t['protectedLogicalBytes'],'allInitialCacheRecordsExactlyUnchanged':True,'allOriginalAndFreshContainerImagePreservationEqual':True,'qualifiedBuildReceiptSha256':BUILD_RECEIPT_SHA,'entireQualifiedImageUnchanged':True,'dfBefore':dfs[0],'dfAfter':dfs[-1],'freshClosedDf':freshdf,'noCacheReclaimCreditBecauseZeroRemoved':True,'sameFilesystemFiguresNotAdditive':True,'activeOpeningExecutedLimits':limits,'closedGcPropertiesNotExecutedLimitsOrMeasuredPeak':m['properties'],'retryAllowed':False,'noAdditionalPruneAllowed':True,'cacheOperationsByValidator':0,'productionDatabaseConnections':0}
with OUT.open('xb') as f:f.write(canonical(record)+b'\n')
print(json.dumps({k:v for k,v in record.items() if k not in ['prunedCommandResults','activeOpeningExecutedLimits','closedGcPropertiesNotExecutedLimitsOrMeasuredPeak']}))
