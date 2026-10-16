"""Compose fresh science, two-pass consumers and original Apache evidence.

Import/construction are inert. This is the capture content collector, not the
separate controller transport, cgroup guard, package preparer or launcher.
The receipt grants no gate, serving, restart, deployment or merge authority.
Declared allowances and observed stage growth are not whole filesystem closure.
"""
from kit_contract import HEAD,IMAGE,IMAGE_BYTES,canonical,require,sha
from retained_contract import ROOT,exact_json,policy_gate
from kit_integrity import EXPECTED
from kit_capture_owned import CAPTURE_ROOT,CAPTURE_UNIT
from kit_capture_budget import CAPTURE_TABLE,CAPTURE_TABLE_SHA,CaptureBudget,CAPTURE_APACHE_BYTES
from kit_capture_copy import capture_source_review,sync_capture_tree,verify_capture_snapshot,verify_capture_clone
from kit_capture_science import CaptureScience,retain_capture_original,LIMIT
from kit_consumer_inventory import collect,cron_projection
from kit_apache_capture import capture_apache,verify_apache_capture,CONF
from kit_authority import standing_authority,review_projection,no_later_release_direction
from kit_disk import ALLOCATION,BOUND,disjoint_growth
from kit_journal import exclusive_record
from controller_output import output_pin,output_read_record

CAPTURE_REVIEW_FILES=frozenset((
    'capture-fresh-authority.json','capture-primary-snapshot.json',
    'capture-snapshot-provenance.json','capture-clone-provenance.json',
    'capture-stage-closures.json','capture-final-physical.json',
    'actual-scientific-impact.json','actual-impact-214.json','actual-impact-209.json',
    'capture-integrity-original.json','capture-canonical-policy-original.json',
    'capture-206-prepare-original.json','capture-206-preservation.json',
    'capture-214-prepare-original.json','capture-214-preservation.json',
    'consumer-inventory.json','apache-capture.json','ingress-original.conf','ingress-held.conf'))
CONTROL_FILES=frozenset(('capture-fresh-authority.json',
    'capture-snapshot-provenance.json','capture-clone-provenance.json'))


def consumer_capture(value):
    require(isinstance(value,dict) and value.get('completeCollection') is True and value.get('readOnly') is True and
        value.get('loadedAndTransientUnitsIncluded') is True and type(value.get('independentCompletePasses')) is int and
        value['independentCompletePasses']==2 and value.get('configurationEqualAcrossBothPasses') is True and
        value.get('cataloguesReenumeratedAfterEachPass') is True and
        value.get('collectionIsNotAnAtomicHostSnapshot') is True and value.get('noConsumerVerdict') is None,
        'Complete consumer observations without an invented absence verdict required')
    require(value.get('configurationSha256')==sha(canonical(value.get('configuration'))),
        'Consumer configuration projection differs')
    passes=value.get('passObservations')
    require(isinstance(passes,list) and len(passes)==2 and
        all(p.get('compiledCaptureControllerObserved') is True for p in passes),
        'The exact running capture controller must be observed in BOTH full passes')
    require(passes[0]['timerNames']==passes[1]['timerNames']==value['activeTimerNames'] and
        sorted(set(passes[0]['commands'])|set(passes[1]['commands']))==value['observedProcessCommandSha256'],
        'Consumer timer or complete process classes differ from both originals')
    return value


def physical_sample(value):
    require(isinstance(value,dict) and set(value.get('allocations',{}))==set(ALLOCATION) and
        set(value.get('devices',{}))==set(value.get('free',{}))==set(BOUND) and
        type(value.get('requiredBytes')) is int and value['requiredBytes']>0,
        'Complete physical releases/Docker/containerd and free-space sample required')
    require(all(type(row.get('bytes')) is int and row['bytes']>=0 and type(row.get('device')) is int
        for row in value['allocations'].values()) and
        all(type(n) is int and n>=value['requiredBytes'] for n in value['free'].values()) and
        all(type(n) is int for n in value['devices'].values()),'Invalid physical allocation/free-space integers')
    require(all(value.get(k) is True for k in ('singleFilesystemDu','hardlinksCountedOnce',
        'allRetainedReleaseRootsIncluded')) and type(value.get('overlayViewsCreditedBytes')) is int and
        value['overlayViewsCreditedBytes']==0 and
        isinstance(value.get('verifiedOverlayViewsBefore'),list) and
        isinstance(value.get('verifiedOverlayViewsAfter'),list),'Physical observation scope differs')
    return value


def verify_stage_closures(record,final):
    require(record.get('root')==CAPTURE_ROOT.as_posix() and record.get('unit')==CAPTURE_UNIT and
        record.get('captureTableSha256')==CAPTURE_TABLE_SHA,'Foreign capture stage closures')
    inputs=record.get('budgetInputs',{})
    require(set(inputs)=={'databaseAllocatedBytes','assetsAllocatedBytes','imageBytes'} and
        inputs['imageBytes']==IMAGE_BYTES,'Exact capture budget inputs required')
    budget=CaptureBudget(inputs['databaseAllocatedBytes'],inputs['assetsAllocatedBytes'],inputs['imageBytes'])
    rows=record.get('stages');require(isinstance(rows,list) and len(rows)==len(CAPTURE_TABLE),'All eight stages required')
    previous=None
    for row,declared in zip(rows,CAPTURE_TABLE):
        before=physical_sample(row['before']);after=physical_sample(row['after'])
        require(previous is None or before==previous,'Physical stage observation chain changed')
        require(before['requiredBytes']==budget.required(),'Before-stage remaining reserve differs')
        budget.begin(declared['stage'],min(before['free'].values()))
        for site,count in declared['sites'].items():
            for _ in range(count):budget.claim(site);budget.copy_ceiling(site)
        disjoint_growth(before,after)
        require(after['requiredBytes']==budget.required(),'Active-stage remaining reserve differs')
        measured=max(0,sum(after['allocations'][p]['bytes']-before['allocations'][p]['bytes'] for p in ALLOCATION))
        require(canonical(row['closure'])==canonical(budget.finish(declared['stage'],measured)),
            'Stage claims, measurements, JSON types or bounds differ')
        previous=after
    physical_sample(final);disjoint_growth(rows[-1]['before'],final)
    require(final['requiredBytes']==budget.required(),'Final capture reserve differs')
    require(final.get('label')=='capture-review-complete','Final capture physical observation missing')
    measured=max(0,sum(final['allocations'][p]['bytes']-rows[-1]['before']['allocations'][p]['bytes'] for p in ALLOCATION))
    require(measured<=rows[-1]['closure']['allowedPhysicalGrowthBytes'],
        'Final science/consumer/receipt-content growth exceeds last-stage allowance')
    return True


def verify_capture_receipt(receipt,read,index,source):
    """Independent semantic verification, even if every outer hash is recomputed."""
    binding=capture_source_review(index,source)
    require(type(receipt.get('version')) is int and receipt['version']==2 and
        receipt.get('status')=='REVIEW_CAPTURE_CONTENT_COMPLETE' and receipt.get('root')==CAPTURE_ROOT.as_posix() and
        receipt.get('releaseRoot')==str(ROOT) and receipt.get('unit')==CAPTURE_UNIT and
        receipt.get('head')==HEAD and receipt.get('image')==IMAGE and
        receipt.get('captureTableSha256')==CAPTURE_TABLE_SHA and receipt.get('sourceBinding')==binding and
        receipt.get('sourceReviewId')==source['id'],'Complete exact capture receipt required')
    require(type(receipt.get('productionSqliteConnections')) is int and receipt['productionSqliteConnections']==0 and
        receipt.get('releaseGateConsumed') is False and receipt.get('releaseAuthorityGranted') is False and
        receipt.get('physicalFilesystemClosureClaimed') is False and receipt.get('neverRetry') is True,
        'Capture receipt cannot invent release or whole-filesystem authority')
    pins=receipt.get('files');require(isinstance(pins,dict) and set(pins)==CAPTURE_REVIEW_FILES,
        'Complete capture original/reference map required')
    files={}
    for name,pin in pins.items():
        raw=read(name)
        require(isinstance(raw,bytes) and 0<len(raw)<=LIMIT and
            pin=={'sha256':sha(raw),'bytes':len(raw)},'Capture original changed, missing or oversized')
        files[name]=raw
    values={name:exact_json(raw) for name,raw in files.items() if name.endswith('.json')}
    fresh=values['capture-primary-snapshot.json'];standing_authority(fresh)
    require(review_projection(fresh['source'])==review_projection(source),'Fresh primary source was edited or replaced')
    no_later_release_direction(fresh['releaseComments'],fresh['source'],fresh['source'])
    authority=values['capture-fresh-authority.json']
    require(authority.get('root')==CAPTURE_ROOT.as_posix() and authority.get('unit')==CAPTURE_UNIT and
        authority.get('sourceBinding')==binding and authority.get('captureTableSha256')==CAPTURE_TABLE_SHA and
        authority.get('freshProviderSnapshotSha256')==sha(canonical(fresh)) and
        authority.get('primarySnapshotOriginal')=={'file':'capture-primary-snapshot.json',**pins['capture-primary-snapshot.json']} and
        authority.get('readOnlyFreshAuthority') is True and authority.get('releaseGateConsumed') is False and
        authority.get('neverRetry') is True,'Fresh complete primary authority original differs')
    from kit_science import verify_scientific_originals
    science=values['actual-scientific-impact.json'];verify_scientific_originals(science,lambda name:files[name])
    require(canonical(values['capture-integrity-original.json'])==canonical(EXPECTED),
        'Complete original integrity/FK result or JSON types differ')
    policy_gate(values['capture-canonical-policy-original.json'])
    require(science['captureSourceReviewId']==source['id'],'Scientific source review differs')
    verify_apache_capture(values['apache-capture.json'],files['ingress-original.conf'],files['ingress-held.conf'],index,source)
    consumer_capture(values['consumer-inventory.json'])
    verify_stage_closures(values['capture-stage-closures.json'],values['capture-final-physical.json'])
    snapshot=values['capture-snapshot-provenance.json'];clone=values['capture-clone-provenance.json']
    for record in (snapshot,clone):
        require(record.get('root')==CAPTURE_ROOT.as_posix() and record.get('sourceBinding')==binding and
            record.get('captureTableSha256')==CAPTURE_TABLE_SHA and
            record.get('neverRetry') is True,'Snapshot/clone source provenance differs')
    require(type(snapshot.get('tableCount')) is int and snapshot['tableCount']==106 and
        type(snapshot.get('schemaReceiptCount')) is int and snapshot['schemaReceiptCount']==39 and
        snapshot.get('rawMasterNeverOpenedSqlite') is True and clone.get('rawMastersNeverOpenedSqlite') is True and
        type(snapshot.get('productionSqliteConnections')) is int and snapshot['productionSqliteConnections']==0 and
        clone.get('createdFromDetachedBackup') is True and
        clone.get('snapshotProvenance')==pins['capture-snapshot-provenance.json'] and
        clone.get('initialCloneByteIdentity')=={'':snapshot['backup'],'-wal':None,'-shm':None},
        'Fresh snapshot or detached clone provenance differs')
    require(snapshot.get('releaseRoot')==str(ROOT) and snapshot.get('unit')==CAPTURE_UNIT and
        snapshot.get('head')==HEAD and snapshot.get('image')==IMAGE and
        snapshot.get('databaseAssetsCrossFileAtomicityClaimed') is False and
        snapshot.get('physicalFilesystemClosureClaimed') is False,
        'Fresh snapshot target or cross-file/physical claim differs')
    require(receipt.get('scienceSha256')==sha(canonical(science)) and
        receipt.get('apacheCaptureSha256')==pins['apache-capture.json']['sha256'] and
        receipt.get('consumerConfigurationSha256')==values['consumer-inventory.json']['configurationSha256'],
        'Capture scientific, Apache or consumer projection differs')
    return receipt


class CaptureReview(CaptureScience):
    def __init__(self,*args,consumer_runner,cron_reader=cron_projection,apache_production=True,apache_source=CONF,**kwargs):
        super().__init__(*args,**kwargs)
        self.consumer_runner=consumer_runner;self.cron_reader=cron_reader
        self.apache_production=apache_production;self.apache_source=apache_source

    def filesystem_snapshot(self):
        # All originals and their declared entries fit inside the already-held
        # first-stage8MiB Apache allowance, before its physical stage closure.
        require(self.disk.budget.active=='capture-filesystem-snapshot','Apache capture requires first active stage')
        exclusive_record(self.root,'capture-apache-admission.json',{'maximumBytes':CAPTURE_APACHE_BYTES,
            'stageTableSha256':CAPTURE_TABLE_SHA,'beforeSourceRead':True,'physicalPreallocationClaimed':False},self.disk.sync)
        capture_apache(self.root,self.index,self.source,self.apache_production,self.apache_source)
        return super().filesystem_snapshot()

    def review_observations(self):
        require(self.disk.budget.active=='capture-order-impact','Consumer capture requires final active stage')
        self.no_writers()
        current=collect(self.reader,self.consumer_runner,cron_reader=self.cron_reader,namespace='capture-consumer')
        consumer_capture(current)
        retain_capture_original(self.root,'consumer-inventory.json',canonical(current)+b'\n',self.disk.sync)
        self.no_writers()

    def execute(self):
        science=super().execute()
        record={'root':self.root.as_posix(),'unit':CAPTURE_UNIT,'captureTableSha256':CAPTURE_TABLE_SHA,
            'budgetInputs':{'databaseAllocatedBytes':self.disk.budget.db,'assetsAllocatedBytes':self.disk.budget.assets,
                'imageBytes':self.disk.budget.image},'stages':self.closures}
        retain_capture_original(self.root,'capture-stage-closures.json',canonical(record)+b'\n',self.disk.sync)
        self.no_writers();verify_capture_snapshot(self.root,capture_source_review(self.index,self.source));verify_capture_clone(self.root)
        final=self.disk.sample('capture-review-complete');verify_stage_closures(record,final)
        retain_capture_original(self.root,'capture-final-physical.json',canonical(final)+b'\n',self.disk.sync)
        def read(name):
            require(name in CAPTURE_REVIEW_FILES,'Unbound capture receipt read')
            pin=output_pin(self.root/name,LIMIT,links=2 if name in CONTROL_FILES else 1)
            if name in CONTROL_FILES:output_read_record(self.root,name)
            raw=(self.root/name).read_bytes()
            require(pin=={'sha256':sha(raw),'bytes':len(raw)},'Capture original changed after inode verification')
            return raw
        pins={name:{'sha256':sha(raw),'bytes':len(raw)} for name in sorted(CAPTURE_REVIEW_FILES) for raw in (read(name),)}
        receipt={'version':2,'status':'REVIEW_CAPTURE_CONTENT_COMPLETE','root':self.root.as_posix(),'releaseRoot':str(ROOT),
            'unit':CAPTURE_UNIT,'head':HEAD,'image':IMAGE,'captureTableSha256':CAPTURE_TABLE_SHA,
            'sourceBinding':capture_source_review(self.index,self.source),'sourceReviewId':self.source['id'],
            'productionSqliteConnections':0,'releaseGateConsumed':False,'releaseAuthorityGranted':False,
            'physicalFilesystemClosureClaimed':False,'neverRetry':True,'files':pins,
            'scienceSha256':sha(canonical(science)),'apacheCaptureSha256':pins['apache-capture.json']['sha256'],
            'consumerConfigurationSha256':exact_json(read('consumer-inventory.json'))['configurationSha256']}
        verify_capture_receipt(receipt,read,self.index,self.source)
        retain_capture_original(self.root,'capture-receipt.json',canonical(receipt)+b'\n',self.disk.sync)
        sync_capture_tree(self.root);self.disk.check()
        return receipt
