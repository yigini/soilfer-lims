"""Conditional nonempty header-version transaction, excluding earlier WAL close.

Native request/logical journal bounds only. No caller, SQL, runtime or admission.
"""
import pathlib
from kit_contract import canonical,require,sha
from retained_contract import exact_json
from kit_copy_admission import copy_layout

PROOF='header-normalization-source.json'
LIMIT=32*1024**3
SECTOR_MAX=65536
PAGES=tuple(512*2**i for i in range(8))
CONDITIONS=('positiveIntactFixedPageGeometryAndHeader',
    'stableNAndFullMainBytesNoOtherHandlesWritersSharedCacheOrExternalChanges',
    'initialMainFileFullLengthEqualsNtimesP',
    'entryAfterAnyWalCheckpointCloseCompletedAndExcluded',
    'mainPagerNonWalAndNoWalHandleThroughCommitRollbackClose',
    'oneNativeSetVersionOneAndOneSingleMainTransactionCompletion',
    'onlyMainNoAttachedOrOtherWriteTransactions',
    'noActiveSavepointsOrStatementSubjournalProducer',
    'autovacuumZeroAndNoAllocationMovepageVacuumOrOtherApiWrites',
    'journalInitiallyAbsentOrEmptyNoStaleOrExternallyChangedBytes',
    'onlyIntactNativeJournalHeadersWithOriginalPageCountN',
    'noHooksReentrantSqlCustomVfsPcacheOrConnectionStateMutation',
    'ordinaryFixedNativePageAndBoundedSectorSemantics',
    'stopFirstErrorOneRollbackCloseNoRetryResetOrFurtherSql',
    'earlierPragmaSchemaWalCloseAndSourceCloseOutsideScope')

def declaration(termination):
    require(type(termination) is str and termination in ('commit','rollback','first-error-close'),'Exact header transaction termination required')
    return {'version':1,'scope':'DECLARED_NONEMPTY_NATIVE_HEADER_VERSION_ONE_TRANSACTION','nativeVersion':'3.51.2',
        'termination':termination,**{k:True for k in CONDITIONS}}

def source_proof():
    here=pathlib.Path(__file__).resolve().parent;root=here.parents[1];raw=(here/PROOF).read_bytes();v=exact_json(raw)
    require(type(v.get('version')) is int and v['version']==1 and v.get('scope')=='CONDITIONAL_NONEMPTY_HEADER_NORMALIZATION_REQUESTS' and
        v.get('writerGraphAdmissionImplemented') is False and v.get('runtimeBinaryToSourceBindingVerified') is False,'Exact conditional header normalization source proof required')
    for name,pin in v['files'].items():
        p=pathlib.PurePosixPath(name);require(p.as_posix()==name and not p.is_absolute() and '..' not in p.parts,'Canonical header source path required')
        b=(root/name).read_bytes();require(type(pin) is dict and set(pin)=={'bytes','sha256'} and type(pin['bytes']) is int and
            len(b)==pin['bytes'] and sha(b)==pin['sha256'],'Header normalization source changed: '+name)
    return v,sha(raw)

def header_transaction_plan(n,p,d):
    _,digest=source_proof()
    require(type(d) is dict and type(d.get('termination')) is str and canonical(d)==canonical(declaration(d['termination'])),
        'Complete exact nonempty header transaction entry required')
    require(type(n) is int and 1<=n<=2147483647 and type(p) is int and p in PAGES,'Positive fixed native N/P required')
    # Every direct native mutation targets page1. Sector neighbours stay in
    # its first sector. Bitvec records each old page once; repeated dirtying
    # is not a distinct-old-record count or a complete PagerWrite count.
    old=min(n,max(1,SECTOR_MAX//p))
    headers=old+2  # initial + first CACHEMOD sync + each possible new-record sync
    records=old*(p+8)
    # Each header <=MAX (P divides MAX); each alignment gap <MAX.
    # Extra MAX also covers syncJournal's next-header anti-magic byte.
    journal=(2*old+4)*SECTOR_MAX+records
    main=n*p
    require(main<=LIMIT and journal<=LIMIT,'Complete header MAIN/journal request envelope exceeds32GiB')
    layout=copy_layout([main,journal],0)
    require(layout['roundedContentBytes']<=LIMIT,'Whole rounded header MAIN+journal exceeds32GiB; never clip')
    return {'version':1,'scope':'CONDITIONAL_NONEMPTY_HEADER_NORMALIZATION_REQUESTS','sourceProofSha256':digest,
        'nativeDeclaration':d,'declaredOriginalMainPages':n,'declaredPageSize':p,'maximumOldJournalPageRecords':old,
        'maximumJournalHeadersConservativelyCharged':headers,'maximumJournalRecordBytes':records,
        'maximumLogicalJournalAndWriteEndBytes':journal,'maximumMainLogicalAndWriteEndBytes':main,
        'maximumMainSizeHintArgumentBytes':main,'maximumMainTruncateArgumentBytes':main,'fullMainAndJournalLayout':layout,
        'conditionalNonemptyHeaderMainAndJournalBoundImplemented':True,'fullChargeRetainedAfterRollbackOrError':True,
        'oldRecordCountIsCompleteDirtyWriteOrFrameCount':False,'sectorSizeAssumed4096':False,
        'emptyDestination131072FormulaReused':False,'ramOnlyJournalCreditTaken':False,
        'actualEntryAndPriorCheckpointVerified':False,'actualNativeReturnCodesOrFileCallsMeasured':False,
        'runtimeBinaryToSourceBindingVerified':False,'actualPythonWrapperToNativeBindingVerified':False,
        'runtimeDefaultVfsVerified':False,'mainOrJournalActualFileLengthOrPreallocationBounded':False,
        'earlierWalCheckpointOrSourceCloseBounded':False,'wholePragmaOrBackupCallerBounded':False,
        'completeDirtyOrCumulativeMainWriteCountDerived':False,'heapOrPhysicalMemoryBounded':False,
        'callerReviewVerified':False,'beforeSqlHeldAdmissionImplemented':False,'writerGraphAdmissionImplemented':False,
        'fullLifetimeOriginalsRetained':False,'continuousPeakMeasured':False,'physicalFilesystemClosureClaimed':False}

def replay_header_transaction(plan):
    require(type(plan) is dict and plan.get('scope')=='CONDITIONAL_NONEMPTY_HEADER_NORMALIZATION_REQUESTS','Exact whole header transaction plan required')
    expected=header_transaction_plan(plan['declaredOriginalMainPages'],plan['declaredPageSize'],plan['nativeDeclaration'])
    require(canonical(expected)==canonical(plan),'Header transaction entry/source/old records/headers/whole layout/authority changed')
    return plan
