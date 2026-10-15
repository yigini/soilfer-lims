"""Local retained-only timestamp/rounded-size evidence analysis; cannot issue an adoption receipt."""
import datetime,decimal,hashlib,json,pathlib,re,subprocess
REPO=pathlib.Path(__file__).resolve().parents[2]
SOURCE=REPO/'WP/batch-forward-metadata-cde8-20261014'
RAW=SOURCE/'targeted-metadata-000500-closed-originals'
OLD=REPO/'WP/batch-release-cde8-20261014/first-build-221500-closed-terminal'
DEST=SOURCE/'retained-targeted-analysis-no-adoption-once'
assert not DEST.exists();DEST.mkdir()
def sha(v):return hashlib.sha256(v).hexdigest()
def save(n,v):
    with (DEST/n).open('x',encoding='utf-8') as f:json.dump(v,f,indent=2,ensure_ascii=False)
index=json.loads((RAW/'index.json').read_bytes());rootindex=json.loads((RAW/'remote-closed-original-index.json').read_bytes())
inputs={n:sha((RAW/n).read_bytes()) for n in rootindex['files']}
assert all(inputs[n]==row['sha256'] for n,row in rootindex['files'].items())
terminal=json.loads((RAW/'metadata-evidence-terminal.json').read_bytes());commands={v['label']:v for v in terminal['commands']}
assert terminal['status']=='READONLY_METADATA_EVIDENCE_CAPTURED_NOT_ADOPTED' and not terminal['problems'] and len(commands)==133
intent=json.loads((OLD/'build-intent.json').read_bytes());failed=json.loads((OLD/'build-terminal-failure.json').read_bytes())
start=datetime.datetime.fromisoformat(intent['startedUtc']);end=datetime.datetime.fromisoformat(failed['closedUtc'])
def timestamp(v):return datetime.datetime.fromisoformat(v.replace('Z','+00:00'))
def raw(label):return (RAW/commands[label]['stdout']['file']).read_text(encoding='utf-8')
factors={'B':1,'kB':1000,'MB':1000000,'GB':1000000000,'KiB':1024,'MiB':1048576,'GiB':1073741824}
def formatted_point(v):
    m=re.fullmatch(r'([0-9.]+)\s*([A-Za-z]+)',v);assert m and m[2] in factors
    return decimal.Decimal(m[1])*factors[m[2]]
selection=json.loads((RAW/'moby-selected-exact-candidate-chain.json').read_bytes());snapshots=[]
for i,key in enumerate(selection['keys']):
    info=json.loads(raw('moby-snapshot-info-'+str(i)));assert info['Name']==key and info['Kind']=='Committed' and info.get('Parent')==(selection['keys'][i-1] if i else None)
    fields=raw('moby-snapshot-usage-'+str(i)).splitlines()[-1].split();assert fields[0]==key
    created=timestamp(info['Created']);kind='CREATED_DURING_ORIGINAL_FAILED_BUILD_WINDOW' if start<=created<=end else ('OLDER_THAN_ORIGINAL_BUILD' if created<start else 'LATER_THAN_ORIGINAL_BUILD')
    snapshots.append({'ordinal':i,'key':key,'parent':info.get('Parent'),'createdOriginal':info['Created'],'classification':kind,'usageOriginalSizeText':' '.join(fields[1:3]),'usageSizePointBytesRounded':str(formatted_point(' '.join(fields[1:3]))),'inodes':int(fields[3]),'exactAllocationBytesAvailable':False})
cache=[json.loads(v) for v in raw('buildkit-cache-metadata').splitlines() if v]
assert len(cache)==379 and len({v['ID'] for v in cache})==379
for row in cache:
    m=re.fullmatch(r'(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})(\.\d+)? \+0000 UTC',row['CreatedAt']);assert m
    created=timestamp(m[1]+'T'+m[2]+(m[3] or '')+'Z');row['classification']='CREATED_DURING_ORIGINAL_FAILED_BUILD_WINDOW' if start<=created<=end else ('OLDER_THAN_ORIGINAL_BUILD' if created<start else 'LATER_THAN_ORIGINAL_BUILD')
    row['formattedSizePointBytesRounded']=str(formatted_point(row['Size']));row['exactAllocationBytesAvailable']=False
newcache=[v for v in cache if v['classification']=='CREATED_DURING_ORIGINAL_FAILED_BUILD_WINDOW']
newsnap=[v for v in snapshots if v['classification']=='CREATED_DURING_ORIGINAL_FAILED_BUILD_WINDOW']
objects={commands[k]['argv'][-1]:json.loads(raw(k)) for k in commands if k.startswith('oci-metadata-')}
manifests=[{'digest':d,'layerCount':len(v['layers']),'compressedDescriptorBytesExact':sum(x['size'] for x in v['layers']),'physicalAllocationIsNotDescriptorLength':True} for d,v in objects.items() if 'layers' in v]
save('snapshot-timestamps-and-rounded-usage.json',snapshots);save('cache-timestamps-and-sharing.json',cache);save('oci-manifest-descriptor-lengths.json',manifests)
result={'status':'RETAINED_METADATA_INSUFFICIENT_FOR_IMAGE_ADOPTION','analysedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'scope':'LOCAL_RETAINED_EVIDENCE_ONLY','metadataEvidenceAudit':'2f7594ac4596ae71e2f912533f371c1492165cb6','originalBuildWindow':{'startedUtc':intent['startedUtc'],'closedUtc':failed['closedUtc']},'originalUnexplainedBytes':3609116672,'unexplainedAbortBytes':500000000,'snapshotCount':59,'snapshotCreatedDuringBuild':len(newsnap),'snapshotOlderThanBuild':sum(v['classification']=='OLDER_THAN_ORIGINAL_BUILD' for v in snapshots),'cacheRecords':379,'cacheCreatedDuringBuild':len(newcache),'newCacheShared':sum(v['Shared'] for v in newcache),'newCacheUnshared':sum(not v['Shared'] for v in newcache),'newSnapshotFormattedSizePointBytesRounded':str(sum(decimal.Decimal(v['usageSizePointBytesRounded']) for v in newsnap)),'newCacheSharedFormattedSizePointBytesRounded':str(sum(decimal.Decimal(v['formattedSizePointBytesRounded']) for v in newcache if v['Shared'])),'newCacheUnsharedFormattedSizePointBytesRounded':str(sum(decimal.Decimal(v['formattedSizePointBytesRounded']) for v in newcache if not v['Shared'])),'pointTotalsAreNotCreditedAllocationOrDisjointSums':True,'missingPreBuildContainerdAllocationUnknown':True,'completeDisjointPhysicalGrowthAttributionProved':False,'growthBytesCreditedByThisAnalysis':0,'unexplainedBytesStillNotProvedAttributed':3609116672,'adoptionMustStop':True,'reasons':['Actual snapshot/cache sizes are rounded strings; no exact physical allocation before/after exists.','Shared cache records overlap image storage; summing totals would double-count without a proven physical object mapping.','Older base snapshot is excluded; mutable cache records may predate this build and lack a before-state.','OCI compressed descriptor lengths are exact logical content sizes, not an independently measured physical growth delta.'],'primaryInterfaceReferences':['https://docs.docker.com/reference/cli/docker/buildx/du/','https://github.com/containerd/containerd/blob/v2.2.0/cmd/ctr/commands/snapshots/snapshots.go'],'referencesAreDocumentationNotHostMeasurements':True,'imageEligibility':False,'imageAdoptionReceipts':0,'newBuilds':0,'metadataOperatorsDispatched':0,'productionConnections':0,'productionDeployments':0,'forwardBuildSourceAllowedForSeparateReviewByActualDirection':6180234041,'originalRootsFailuresAndRawEvidenceUnchanged':True,'neverReplay':True,'inputSha256':inputs}
assert result['snapshotCreatedDuringBuild']==58 and result['snapshotOlderThanBuild']==1 and len(newcache)==68
save('analysis-original.json',result)
assert inputs=={n:sha((RAW/n).read_bytes()) for n in rootindex['files']}
print(json.dumps({k:v for k,v in result.items() if k not in ['inputSha256','reasons','primaryInterfaceReferences']}))
