"""Conditional successful pinned native backup core; no caller admission.

Direct page-copy counts exclude metadata/pager writes. Constructors, caller SQL,
finish-on-error, close, recovery and physical allocation remain separate.
"""
import pathlib
from kit_contract import canonical,require,sha
from retained_contract import exact_json

PROOF='backup-core-source.json'
LIMIT=32*1024**3
PAGES=tuple(512*2**i for i in range(8))
PROFILES={'node-live-backup':('rollback',0),'python-owned-seal':('memory',256)}
CONDITIONS=('oneDistinctMainSourceAndDestination','sourceAlreadyInPinnedReadonlyTransaction',
    'sourceSnapshotIntactPageCountAndPageSizeStable','sourceAndDestinationPageSizesActuallyEqual',
    'destinationSuccessfullyOpenedWritableInitiallyEmptyWithoutSidecars',
    'destinationNoSqlOrSavepointsDuringCore','destinationSchemaUnloadedOrEmptyNoVirtualObjects',
    'destinationPagerRemainsDeclaredNonWalMode',
    'noSourceBackupUpdateOrRestartCallbacks','noSharedCacheOrOtherDestinationUsers',
    'noApplicationHooksOrReentrantSqlOrStateMutation','ordinaryVfsAndPcacheNoSqlOrStateMutation',
    'noConstructorOrExtensionEffectsInsideCore','onlyOkThenDoneNoBusyLockedRetryOrErrorContinuation',
    'oneInitOneFinishNoResetReuseOrAdditionalBackupHandles')

def source_proof():
    here=pathlib.Path(__file__).resolve().parent;root=here.parents[1]
    raw=(here/PROOF).read_bytes();v=exact_json(raw)
    require(type(v.get('version')) is int and v['version']==1 and
        v.get('scope')=='CONDITIONAL_PINNED_NATIVE_BACKUP_CORE' and
        v.get('actualPythonWrapperToNativeBindingVerified') is False and
        v.get('beforeSqlHeldAdmissionImplemented') is False,'Exact conditional backup core proof required')
    for name,pin in v['files'].items():
        p=pathlib.PurePosixPath(name);require(p.as_posix()==name and not p.is_absolute() and '..' not in p.parts,'Canonical backup source path required')
        b=(root/name).read_bytes();require(type(pin) is dict and set(pin)=={'bytes','sha256'} and
            type(pin['bytes']) is int and len(b)==pin['bytes'] and sha(b)==pin['sha256'],'Backup core source changed: '+name)
    return v,sha(raw)

def declared_backup_core(profile):
    require(type(profile) is str and profile in PROFILES,'Exact supported backup core profile required')
    journal,first=PROFILES[profile]
    return {'version':1,'profile':profile,'nativeVersion':'3.51.2',
        'nativeSourceId':'2026-01-09 17:27:48 b270f8339eb13b504d0b2ba154ebca966b7dde08e40c3ed7d559749818cb2075',
        'destinationJournal':journal,'firstStepPages':first,'followingStepPages':256,
        **{k:True for k in CONDITIONS}}

def backup_core_inventory(page_count,page_size,declaration):
    """Pure core plan. No pathname, SQL, later profile, or raw header input."""
    _,digest=source_proof()
    require(type(declaration) is dict and type(declaration.get('profile')) is str and
        declaration['profile'] in PROFILES and
        canonical(declaration)==canonical(declared_backup_core(declaration['profile'])),
        'Exact uninterrupted pinned backup core declaration required')
    require(type(page_count) is int and 1<=page_count<=2147483647 and
        type(page_size) is int and page_size in PAGES,'Positive native snapshot page count and exact page size required')
    require(page_count*page_size<=LIMIT,'Complete source snapshot exceeds32GiB proof envelope; never clip')
    zero=declaration['firstStepPages']==0
    plan={'version':1,'scope':'CONDITIONAL_PINNED_NATIVE_BACKUP_CORE_INVENTORY',
        'sourceProofSha256':digest,'nativeDeclaration':declaration,
        'declaredPinnedSourcePageCount':page_count,'declaredEqualPageSize':page_size,
        'declaredSourceSnapshotBytes':page_count*page_size,
        'maximumSuccessfulStepCalls':(page_count+255)//256+int(zero),
        'initialZeroPageStepCalls':int(zero),'maximumForwardCopyLoopIterations':page_count,
        'maximumDirectBackupOnePageCalls':page_count,'maximumDirectCopyPagerWriteCalls':page_count,
        'maximumDestinationWriteTransactionStarts':1,
        'zeroPageStepCanStartDestinationWriteTransaction':True,
        'additionalNewDatabaseAndSchemaCookieAndCommitPagerWritesIncludedInDirectCopyCount':False,
        'coreSqlStatementExecutions':0,'coreSorterInitCalls':0,'coreTemporaryBtreeOpens':0,
        'coreStatementJournalOpenCallsUnderZeroSavepoints':0,
        'sourceWriteTransactionStartsByCore':0,
        'destinationWalFrameRequestsUnderNonWalPagerDeclaration':0,
        'conditionalSuccessfulCoreApiAndCopyInventoryDerived':True,
        'conditionalCoreNoSqlSorterOrTemporaryBtreeDerived':True,
        'directCopyCountIsCompleteDirtyOrFileWriteInventory':False,
        'pendingByteSkipOrCoalescingCreditTaken':False,
        'scopeExcludesConstructorCallerSqlAndClose':True,
        'actualCallerSourceSnapshotAndEqualPageSizesVerified':False,
        'actualNoRestartOrBusyLockedProfileVerified':False,
        'actualPythonWrapperToNativeBindingVerified':False,
        'readerSqliteBinaryToPinnedNativeSourceVerified':False,
        'actualNativePagerOrFileCallsMeasured':False,
        'completeDestinationPagerDirtyInventoryDerived':False,
        'destinationMainWriteEndOrSizeHintBounded':False,
        'destinationJournalOrCheckpointOrShmClosureComplete':False,
        'finishAfterFailureOrRollbackWritesBounded':False,
        'wholeBackupCallerScratchInventoryComplete':False,
        'earlierOrInitialReaderSqlAdmissionImplemented':False,
        'callerReviewVerified':False,'beforeSqlHeldAdmissionImplemented':False,
        'writerGraphAdmissionImplemented':False,'runtimeDefaultVfsVerified':False,
        'temporaryDirectoryRoutingVerified':False,'processHeapOrPhysicalMemoryBounded':False,
        'independentSnapshotToPrivateDbBytesProof':False,
        'fullLifetimeOriginalsRetained':False,'continuousPeakMeasured':False,
        'physicalFilesystemClosureClaimed':False}
    return plan

def replay_backup_core_inventory(plan):
    require(type(plan) is dict and plan.get('scope')=='CONDITIONAL_PINNED_NATIVE_BACKUP_CORE_INVENTORY','Exact backup core inventory required')
    expected=backup_core_inventory(plan['declaredPinnedSourcePageCount'],plan['declaredEqualPageSize'],plan['nativeDeclaration'])
    require(canonical(expected)==canonical(plan),'Backup core source/count/declaration/authority changed')
