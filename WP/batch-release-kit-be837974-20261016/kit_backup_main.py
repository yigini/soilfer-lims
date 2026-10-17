"""Conditional backup MAIN logical/request extent, never VFS allocation.

This enumerates request producers and proves their maximum end. It does not
turn direct copy counts into complete dirty-page or cumulative write counts.
"""
import pathlib
from kit_contract import canonical,require,sha
from retained_contract import exact_json
from kit_backup_core import declared_backup_core,PAGES,LIMIT
from kit_copy_admission import copy_layout

PROOF='backup-main-source.json'
TERMINATIONS=('commit','finish-after-prefix','finish-after-first-error')
CONDITIONS=('initialDestinationPagerDbSizeAndDbOrigSizeZero',
    'noDestinationWalHandleThroughoutFinishAndClose',
    'onlyNativeGeneratedIntactJournalHeadersWithOriginalPageCountZero',
    'noSavepointMovepageVacuumSqlOrOtherDestinationApiWrites',
    'noExternalFileChangesOrArbitraryIoContentCorruption',
    'stopAtFirstErrorOrAbandonmentOneFinishThenCloseNoFurtherCopyOrRetry',
    'sourceCloseAndCallerPostBackupSqlOutsideScope')

def source_proof():
    here=pathlib.Path(__file__).resolve().parent;root=here.parents[1]
    raw=(here/PROOF).read_bytes();v=exact_json(raw)
    require(type(v.get('version')) is int and v['version']==1 and
        v.get('scope')=='CONDITIONAL_BACKUP_MAIN_LOGICAL_REQUEST_EXTENTS' and
        v.get('runtimeBinaryToSourceBindingVerified') is False and
        v.get('writerGraphAdmissionImplemented') is False,'Exact conditional backup MAIN source proof required')
    for name,pin in v['files'].items():
        p=pathlib.PurePosixPath(name);require(p.as_posix()==name and not p.is_absolute() and '..' not in p.parts,'Canonical backup MAIN source path required')
        b=(root/name).read_bytes();require(type(pin) is dict and set(pin)=={'bytes','sha256'} and
            type(pin['bytes']) is int and len(b)==pin['bytes'] and sha(b)==pin['sha256'],'Backup MAIN source changed: '+name)
    return v,sha(raw)

def declared_backup_main(profile,termination):
    require(type(termination) is str and termination in TERMINATIONS,'Exact one-attempt backup termination required')
    d=declared_backup_core(profile)
    # The earlier successful core count model is unchanged. This distinct
    # declaration also permits a stopped prefix and its one cleanup path.
    d.pop('onlyOkThenDoneNoBusyLockedRetryOrErrorContinuation')
    d.update({'scope':'DECLARED_BACKUP_MAIN_REQUEST_SOURCE','termination':termination,
        **{k:True for k in CONDITIONS}})
    return d

def large_sector_interval(page_size,sector_size,current_pages,target_page):
    """Exact native loop interval arithmetic, not hardware correctness proof."""
    require(type(page_size) is int and page_size in PAGES and type(sector_size) is int and
        32<=sector_size<=65536 and type(current_pages) is int and current_pages>=0 and
        type(target_page) is int and target_page>=1 and
        max(current_pages,target_page)*page_size<=LIMIT,'Exact bounded native sector/page integers required')
    if sector_size<=page_size:return (target_page,target_page)
    k=sector_size//page_size;first=((target_page-1)&~(k-1))+1
    if target_page>current_pages:count=target_page-first+1
    elif first+k-1>current_pages:count=current_pages+1-first
    else:count=k
    require(count>0 and first+count-1<=max(current_pages,target_page),'Native sector interval exceeds page high water')
    return first,first+count-1

def backup_main_plan(page_count,page_size,declaration):
    proof,digest=source_proof()
    require(type(declaration) is dict and type(declaration.get('termination')) is str and
        canonical(declaration)==canonical(declared_backup_main(declaration.get('profile'),declaration['termination'])),
        'Exact complete backup MAIN source/termination declaration required')
    require(type(page_count) is int and 1<=page_count<=2147483647 and
        type(page_size) is int and page_size in PAGES,'Positive native source snapshot pages/equal page size required')
    maximum=page_count*page_size
    require(maximum<=LIMIT,'Complete backup MAIN request envelope exceeds32GiB; never clip')
    layout=copy_layout([maximum],0)
    require(layout['roundedContentBytes']<=LIMIT,'Complete rounded backup MAIN exceeds32GiB; never clip')
    producers=[
        {'producer':'newDatabase-header-and-begin-header-repair','maximumTargetPage':1},
        {'producer':'backupOnePage-equal-actual-page-size','maximumTargetPage':page_count},
        {'producer':'schema-cookie-UpdateMeta','maximumTargetPage':1},
        {'producer':'change-counter-indirect-or-direct-atomic-page1','maximumWriteEndBytes':page_size},
        {'producer':'large-sector-neighbours','maximumTargetPage':page_count},
        {'producer':'stress-and-commit-dirty-pagelist','maximumWriteEndBytes':maximum,'maximumSizeHintArgumentBytes':maximum},
        {'producer':'atomic-commit-tail-padding','maximumWriteEndBytes':maximum},
        {'producer':'pager-truncate-extend-or-commit-shrink','maximumWriteEndBytes':maximum,'maximumTruncateArgumentBytes':maximum,'maximumSizeHintArgumentBytes':maximum},
        {'producer':'finish-rollback-and-memory-error-close-playback','maximumRestoredPage':0,'maximumTruncateArgumentBytes':0}]
    return {'version':1,'scope':'CONDITIONAL_BACKUP_MAIN_LOGICAL_REQUEST_EXTENTS',
        'sourceProofSha256':digest,'nativeDeclaration':declaration,
        'declaredPinnedSourcePageCount':page_count,'declaredEqualPageSize':page_size,
        'initialDestinationLogicalPages':0,'initialDestinationTransactionOriginalPages':0,
        'maximumLogicalMainPages':page_count,'maximumLogicalMainContentBytes':maximum,
        'conditionalMaximumMainWriteEndBytes':maximum,
        'conditionalMaximumMainSizeHintArgumentBytes':maximum,
        'conditionalMaximumMainTruncateArgumentBytes':maximum,
        'producerInventory':producers,'fullMaximumMainLayout':layout,
        'conditionalCompleteBackupMainRequestProducerInventoryDerived':True,
        'conditionalBackupMainPageHighWaterDerived':True,
        'sameFullMaximumChargedAfterAbandonmentOrRollback':True,
        'sectorSizeAssumed4096':False,'sourceSnapshotPagesAreDirtyWriteOrFrameCounts':False,
        'completeDestinationPagerDirtyCallCountDerived':False,'cumulativeMainWriteBytesBounded':False,
        'actualCallerSourceSnapshotAndEqualPageSizesVerified':False,
        'actualNativePagerOrFileRequestsMeasured':False,'actualNativeIoFailureInjected':False,
        'actualPythonWrapperToNativeBindingVerified':False,'runtimeBinaryToSourceBindingVerified':False,
        'runtimeDefaultVfsVerified':False,'ordinarySyscallSemanticsObserved':False,
        'mainFileLengthOrVfsPreallocationBounded':False,'physicalPreallocationVerified':False,
        'sourceWalShmRecoveryOrCheckpointBounded':False,'destinationJournalAndMetadataPhysicalClosureComplete':False,
        'callerPostBackupSqlAndSourceCloseBounded':False,'wholeBackupCallerScratchInventoryComplete':False,
        'independentSnapshotToPrivateDbBytesProof':False,'processHeapOrPhysicalMemoryBounded':False,
        'beforeSqlHeldAdmissionImplemented':False,'writerGraphAdmissionImplemented':False,'callerReviewVerified':False,
        'fullLifetimeOriginalsRetained':False,'continuousPeakMeasured':False,'physicalFilesystemClosureClaimed':False}

def replay_backup_main_plan(plan):
    require(type(plan) is dict and plan.get('scope')=='CONDITIONAL_BACKUP_MAIN_LOGICAL_REQUEST_EXTENTS','Exact backup MAIN plan required')
    expected=backup_main_plan(plan['declaredPinnedSourcePageCount'],plan['declaredEqualPageSize'],plan['nativeDeclaration'])
    require(canonical(expected)==canonical(plan),'Backup MAIN source/producer/extent/declaration/authority changed')
