"""Original-target WAL frame inventory for the three exact DRY CLI paths.

This source review is narrower than a whole-owner inventory. Retained copies,
SQL scratch, SHM/recovery, checkpoint attempts and VFS allocation are separate.
The applying and repeating CLI paths are deliberately not accepted here.
"""
import json
import pathlib
from kit_contract import canonical,require,sha
from kit_wal_content import declared_frames,wal_content_plan

PROOF_NAME='readonly-target-wal-source.json'
LABELS={'206-dry':'install_sample_containers.js',
        '214-dry':'install_control_charts.js','209-dry':'install_order_revisions.js'}


def source_proof():
    here=pathlib.Path(__file__).resolve().parent;root=here.parents[1]
    raw=(here/PROOF_NAME).read_bytes();proof=json.loads(raw)
    require(type(proof) is dict and type(proof.get('version')) is int and proof['version']==1 and
        proof.get('scope')=='SOURCE_REVIEWED_DRY_ORIGINAL_TARGET_ZERO_WAL_FRAMES' and
        proof.get('applicationHead')=='be8379745bdfae52ce46496ff26514dc7d729640' and
        canonical(proof.get('labels'))==canonical(LABELS) and
        proof.get('wholeOwnerFrameInventoryVerified') is False and
        proof.get('writerGraphAdmissionImplemented') is False and
        proof.get('runtimeBinaryToSourceBindingVerified') is False,
        'Exact restricted dry original-target source proof required')
    require(type(proof.get('files')) is dict and len(proof['files'])>=40,
        'Complete pinned prerequisite/native/caller sources required')
    for name,pin in proof['files'].items():
        path=pathlib.PurePosixPath(name)
        require(not path.is_absolute() and '..' not in path.parts and path.as_posix()==name,
            'Exact source-relative dry proof path required')
        if name in proof['applicationGitBlobs']:
            # The reviewed application is the exact raw Git version, not the
            # unrelated CRLF checkout. Its full original text is frozen here.
            # This does not attest any loaded runtime application byte.
            data=proof['applicationSourceText'][name].encode('utf-8')
        else:
            require((root/name).is_file(),'Readonly target source missing: '+name)
            data=(root/name).read_bytes()
        require(type(pin) is dict and set(pin)=={'bytes','sha256'} and
            type(pin['bytes']) is int and len(data)==pin['bytes'] and sha(data)==pin['sha256'],
            'Readonly target source changed: '+name)
    return sha(raw)


def readonly_target_inventory(label):
    require(type(label) is str and label in LABELS,
        'Only exact 206/214/209 DRY paths have this original-target inventory')
    proof_sha=source_proof()
    # These are zero native pList entries, not a SQL-count or page-count
    # estimate: the original target cannot start a write transaction in the
    # reviewed paths. No-op APPLY results and post-hoc zero changes do not
    # qualify. A separate readonly handle may still create SHM or attempt
    # checkpoint/recovery. None of those is claimed closed by this inventory.
    return {'version':1,'scope':'SOURCE_REVIEWED_DRY_ORIGINAL_TARGET_ZERO_WAL_FRAMES',
        'label':label,'script':'/app/server/scripts/'+LABELS[label],
        'mode':'--dry-run','startupContextSupplied':False,
        'originalTargetSqlOpenMode':'NO_SQL_OPEN' if label=='209-dry' else 'READONLY',
        'targetFrameInventory':declared_frames(0,0,0,proof_sha),
        'sourceProofSha256':proof_sha,'originalTargetFrameInventoryDerived':True,
        'zeroFromSqlStatementOrBtreeOrPageCounts':False,
        'wholeOwnerFrameInventoryVerified':False,'retainedCopyWritersInventoried':False,
        'runtimeBinaryToSourceBindingVerified':False,'runtimeDefaultVfsVerified':False,
        'writerGraphAdmissionImplemented':False,'shmGrowthBounded':False,
        'mainCheckpointGrowthBounded':False,'walFileLengthOrVfsPreallocationBounded':False,
        'statementOrSqlScratchBounded':False,'fullLifetimeOriginalsRetained':False,
        'physicalFilesystemClosureClaimed':False}


def readonly_target_plan(label,target):
    inventory=readonly_target_inventory(label)
    # Pure descriptor observation. This deliberately retains the WAL
    # primitive's nonempty-SHM, unsupported source and complete-size refusals.
    plan=wal_content_plan(target,inventory['targetFrameInventory'])
    require(plan['bound']['maximumWalLogicalContentBytes']==plan['walObservation']['bytes'],
        'Zero original-target frame inventory must retain the full initial WAL extent')
    return {'version':1,'scope':'CONDITIONAL_DRY_ORIGINAL_TARGET_WAL_CONTENT',
        'inventory':inventory,'observation':plan,
        'beforeCreateHeldAdmissionImplemented':False,
        'originalTargetBytesIndependentOfCollectorProved':False,
        'wholeOwnerFrameInventoryVerified':False,'writerGraphAdmissionImplemented':False,
        'runtimeBinaryToSourceBindingVerified':False,'runtimeDefaultVfsVerified':False,
        'physicalFilesystemClosureClaimed':False}


def recheck_readonly_target(plan):
    require(type(plan) is dict and plan.get('scope')=='CONDITIONAL_DRY_ORIGINAL_TARGET_WAL_CONTENT',
        'Exact original dry target WAL record required')
    expected=readonly_target_plan(plan['inventory']['label'],plan['observation']['source'])
    require(canonical(expected)==canonical(plan),'Dry target source/profile/authority record changed')
    return plan
