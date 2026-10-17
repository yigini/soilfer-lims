"""Conditional original-target dirty/frame inventory for strict PRE206/214.

Every normal native mutation is expanded into pager-mark calls, including
allocation/free-list/secure-delete/meta writes. This is source arithmetic,
not runtime attestation or a held writer admission. Other handles remain open.
"""
import json
import os
import pathlib
import stat
from kit_contract import canonical,require,sha
from kit_capture_native_inventory import capture_native_inventory,declared_schema
from kit_main_growth import CURSOR_DEPTH
from kit_wal_content import page_size,declared_frames,wal_content_plan,recheck_wal_content

PROOF_NAME='wal-dirty-inventory-source.json'
LABELS={'206-apply':'capture-206-prepare','214-apply':'capture-214-prepare'}
COEFFICIENTS={
    'allocationPagerWrites':3,'freePagerWritesIncludingSecureDelete':3,
    'balanceLevels':CURSOR_DEPTH+1,'outputsPerLevel':5,
    'parentWritePerLevel':1,'dividerInsertWritesPerLevel':4,
    'freedPagesPerLevelIncludingShallower':4,
    'rootDeeperWrites':4,'quickBalanceWrites':4,
    'normalLocalWrites':2,'overwriteWritesPerPayloadPage':2,
    'deleteLocalWrites':3,'deleteBalanceTraversals':2,
    'cookiesPerCreateStatement':3,'beginPageCountRepairWrites':1,
    'commitFallbackPageOneFrames':1,'maximumSectorBytes':65536}


def source_proof():
    here=pathlib.Path(__file__).resolve().parent;root=here.parents[1]
    raw=(here/PROOF_NAME).read_bytes();proof=json.loads(raw)
    require(type(proof) is dict and type(proof.get('version')) is int and proof['version']==1 and
        proof.get('scope')=='CONDITIONAL_STRICT_PRE_206_214_TARGET_PAGER_DIRTY_INVENTORY' and
        canonical(proof.get('labels'))==canonical(LABELS) and
        canonical(proof.get('coefficients'))==canonical(COEFFICIENTS) and
        proof.get('collectorBindingImplemented') is False and
        proof.get('writerGraphAdmissionImplemented') is False and
        proof.get('runtimeBinaryToSourceBindingVerified') is False,
        'Exact restricted pager-dirty source derivation required')
    for name,pin in proof['files'].items():
        p=pathlib.PurePosixPath(name)
        require(not p.is_absolute() and '..' not in p.parts and p.as_posix()==name,
            'Exact source-relative dirty-inventory path required')
        data=(root/name).read_bytes()
        require(type(pin) is dict and set(pin)=={'bytes','sha256'} and
            type(pin['bytes']) is int and len(data)==pin['bytes'] and sha(data)==pin['sha256'],
            'Pager-dirty source changed: '+name)
    return sha(raw)


def dirty_frame_inventory(label,size,schema):
    require(type(label) is str and label in LABELS,'Only strict PRE206/214 APPLY inventories are derived')
    page_size(size);proof_sha=source_proof()
    native=capture_native_inventory(LABELS[label],schema)
    profiles=json.loads(pathlib.Path(__file__).with_name('capture-native-inventory-source.json').read_bytes())['profiles']
    profile=profiles[LABELS[label]];ops=native['operations'];c=COEFFICIENTS
    # All actual replacements/deletes here address this transaction's own
    # sqlite_schema placeholder/final records. Receipt keys must be absent or
    # the actual classifier/ordinary ABORT constraint refuses; no old receipt
    # is replaced. Existing sibling overflow chains are moved by pointer only.
    old_payload=profile['maximumSchemaPayloadBytes']
    old_overflow=(old_payload+size-5)//(size-4)
    per_level=(c['parentWritePerLevel']+c['outputsPerLevel']*c['allocationPagerWrites']+
        c['outputsPerLevel']+c['dividerInsertWritesPerLevel']+
        c['freedPagesPerLevelIncludingShallower']*c['freePagerWritesIncludingSecureDelete'])
    balance=c['balanceLevels']*per_level+c['rootDeeperWrites']+c['quickBalanceWrites']
    groups=[];normal=0
    for row in ops['normalInsertions']:
        overflow=(row['maximumPayloadBytes']+size-5)//(size-4)
        writes=(c['normalLocalWrites']+overflow*c['allocationPagerWrites']+
            old_overflow*c['freePagerWritesIncludingSecureDelete']+
            c['overwriteWritesPerPayloadPage']*(1+overflow)+balance)
        groups.append({'calls':row['calls'],'maximumNewPayloadBytes':row['maximumPayloadBytes'],
            'maximumReplacedPayloadBytes':old_payload,'maximumNewOverflowPages':overflow,
            'maximumOldOverflowPages':old_overflow,'pagerWritesPerCall':writes})
        normal+=row['calls']*writes
    delete_each=(c['deleteLocalWrites']+old_overflow*c['freePagerWritesIncludingSecureDelete']+
        c['deleteBalanceTraversals']*balance)
    ddl=sum(not obj['implicit'] for obj in profile['objects'])
    categories={'normalMutations':normal,'nativeDeletes':ops['deletions']*delete_each,
        'rootAllocations':ops['createdRoots']*c['allocationPagerWrites'],
        'schemaMetadataCookies':ddl*c['cookiesPerCreateStatement'],
        # New indexes do not need OP_Clear. Charge even one empty-root clear
        # for EVERY new root; never assume this also covers a populated tree.
        'emptyNewRootClears':ops['createdRoots'],
        'beginPageCountRepair':c['beginPageCountRepairWrites']}
    writes=sum(categories.values());sector_pages=max(1,c['maximumSectorBytes']//size)
    entries=writes*sector_pages+c['commitFallbackPageOneFrames']
    return {'version':1,'scope':'CONDITIONAL_STRICT_PRE_TARGET_PAGER_DIRTY_FRAME_INVENTORY',
        'label':label,'pageSize':size,'sourceProofSha256':proof_sha,
        'declaredFullSchemaSha256':native['declaredFullSchemaSha256'],
        'nativeMutationInventory':native,'normalMutationExpansion':groups,
        'maximumPayloadBytesForOwnedSchemaReplacements':old_payload,
        'maximumCreateStatements':ddl,'maximumCookieWrites':ddl*c['cookiesPerCreateStatement'],
        'pagerWritesPerBalanceLevel':per_level,'pagerWritesPerBalanceTraversal':balance,
        'pagerWritesPerNativeDelete':delete_each,'pagerWriteCategories':categories,
        'maximumPagerWriteCalls':writes,'maximumDirtyMarksPerPagerWrite':sector_pages,
        'maximumDirectForwardDirtyMarksOutsidePagerWrite':0,
        'balanceRekeysOnlyAlreadyDirtyReferencedPages':True,
        'maximumSyntheticCommitPageOneFrames':1,
        'targetFrameInventory':declared_frames(entries,entries,1,proof_sha),
        'completeConditionalTargetDirtyInventoryDerived':True,
        'requiresFreshCleanWriterCacheAndIntactNativeInput':True,
        'requiresZeroReservedBytesNoAutovacuumAndOrdinaryPayloadFractions':True,
        'requiresNoPageRelocationBackupAttachVacuumOrCustomPcache':True,
        'requiresNoForwardWritesAfterRollbackOrSqlError':True,
        'schemaDeclarationIsCollectorEvidence':False,'collectorBindingImplemented':False,
        'actualNativeFrameRequestsMeasured':False,'wholeOwnerFrameInventoryVerified':False,
        'writerGraphAdmissionImplemented':False,'runtimeBinaryToSourceBindingVerified':False,
        'runtimeDefaultVfsVerified':False,'walFileLengthOrVfsPreallocationBounded':False,
        'mainCheckpointGrowthBounded':False,'shmWriterGrowthBounded':False,
        'statementOrSqlScratchBounded':False,'fullLifetimeOriginalsRetained':False,
        'continuousPeakMeasured':False,'physicalFilesystemClosureClaimed':False}


def effective_header(plan):
    """Observe last WAL page-one header, never borrow a stale checkpoint header."""
    header=bytes.fromhex(plan['headerHex']);last=None
    row=plan['originalFiles']['-wal'];size=plan['bound']['pageSize']
    if row is not None and row['bytes']:
        flags=os.O_RDONLY|getattr(os,'O_NOFOLLOW',0)|getattr(os,'O_BINARY',0)
        fd=os.open(plan['source']+'-wal',flags)
        with os.fdopen(fd,'rb') as stream:
            info=os.fstat(stream.fileno())
            require(stat.S_ISREG(info.st_mode) and info.st_nlink==1 and
                (info.st_dev,info.st_ino,info.st_size)==(row['device'],row['inode'],row['bytes']),
                'Effective WAL page-one descriptor changed')
            stream.seek(32)
            for ordinal in range(1,plan['walObservation']['physicalFrames']+1):
                frame=stream.read(24);require(len(frame)==24,'Truncated effective-header frame')
                if int.from_bytes(frame[:4],'big')==1:
                    header=stream.read(100);last=ordinal;stream.seek(size-100,1)
                else:stream.seek(size,1)
    page=65536 if int.from_bytes(header[16:18],'big')==1 else int.from_bytes(header[16:18],'big')
    require(len(header)==100 and header[:16]==b'SQLite format 3\0' and header[18:20]==b'\2\2' and
        page==size and header[20]==0 and header[21:24]==bytes([64,32,32]) and
        int.from_bytes(header[56:60],'big')==1 and
        int.from_bytes(header[52:56],'big')==int.from_bytes(header[64:68],'big')==0,
        'Exact current UTF8/zero-reserved/non-autovacuum WAL page-one geometry required')
    pages=int.from_bytes(header[28:32],'big')
    committed=plan['walObservation']['lastCommittedDatabasePages']
    require(pages>=1 and (committed is None or pages==committed),
        'Effective page-one size differs from the last committed WAL database')
    recheck_wal_content(plan)
    return {'headerHex':header.hex(),'lastPageOneFrame':last,'logicalPages':pages,
        'sourceByteObservationOnly':True,'independentPrivateDbSemanticAssociationProved':False}


def dirty_wal_plan(label,target,schema):
    require(type(label) is str and label in LABELS,'Only strict PRE206/214 APPLY inventories are derived')
    declared_schema(schema)
    # First obtain the page size from a SQL-free source observation. A zero
    # declaration is used only for this observation, never as the writer bound.
    initial=wal_content_plan(target,declared_frames(0,0,0,source_proof()))
    current=effective_header(initial)
    inventory=dirty_frame_inventory(label,initial['bound']['pageSize'],schema)
    require(all(row[3]<=current['logicalPages'] for row in schema['rows']),
        'Declared schema root exceeds current logical WAL database size')
    plan=wal_content_plan(target,inventory['targetFrameInventory'])
    require(canonical(plan['originalFiles'])==canonical(initial['originalFiles']) and
        plan['directoryIdentity']==initial['directoryIdentity'],'WAL source changed while deriving its inventory')
    return {'version':1,'scope':'CONDITIONAL_STRICT_PRE_TARGET_DIRTY_WAL_CONTENT_PLAN',
        'inventory':inventory,'observation':plan,'effectivePageOne':current,
        'declaredFullSchema':json.loads(canonical(schema)),
        'schemaToSourceCollectorBindingVerified':False,'nativeRecoveredWalIndexObserved':False,
        'mainDatabaseIntegrityVerified':False,'wholeOwnerFrameInventoryVerified':False,
        'writerGraphAdmissionImplemented':False,'beforeCreateHeldAdmissionImplemented':False,
        'runtimeBinaryToSourceBindingVerified':False,'runtimeDefaultVfsVerified':False,
        'physicalFilesystemClosureClaimed':False}


def recheck_dirty_wal(plan):
    require(type(plan) is dict and plan.get('scope')=='CONDITIONAL_STRICT_PRE_TARGET_DIRTY_WAL_CONTENT_PLAN',
        'Exact original dirty WAL record required')
    expected=dirty_wal_plan(plan['inventory']['label'],plan['observation']['source'],plan['declaredFullSchema'])
    require(canonical(expected)==canonical(plan),'Dirty WAL source/schema/native/authority record changed')
    return plan
