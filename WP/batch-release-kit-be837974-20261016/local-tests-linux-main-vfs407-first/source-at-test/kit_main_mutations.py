"""Conditional allocation arithmetic for explicitly counted normal mutations.

This separately reviewed path includes normal sqlite3BtreeInsert overwrites and
sqlite3BtreeDelete. It does not turn SQL UPDATE/REPLACE/DELETE counts into native
counts, and does not admit an application writer or a VFS/physical allocation.
"""
from kit_contract import require
from kit_main_growth import BALANCE_ALLOCATION_CALLS,counted_operations,main_growth_bound


def mutation_growth_bound(header,main_bytes,operations):
    require(type(operations) is dict and set(operations)=={
        'version','scope','callerReviewSha256','createdRoots','normalInsertions','deletions'} and
        type(operations['version']) is int and operations['version']==1 and
        operations['scope']=='DECLARED_NATIVE_NORMAL_BTREE_MUTATIONS' and
        type(operations['deletions']) is int and 0<=operations['deletions']<=1000000,
        'Exact normal native mutation inventory required; SQL counts are insufficient')
    inserts={'version':1,'scope':'DECLARED_NATIVE_BTREE_INSERTIONS',
        'callerReviewSha256':operations['callerReviewSha256'],'createdRoots':operations['createdRoots'],
        'insertions':operations['normalInsertions']}
    counted_operations(inserts)
    # A normal overwrite either changes existing bytes without allocating, or
    # calls fillInCell once and the same single balance traversal as a fresh
    # insertion. A native deletion can call balance twice. Both traversals are
    # charged in full, without any freed-page or freelist credit.
    deletes=operations['deletions']
    charged=dict(inserts,createdRoots=inserts['createdRoots']+deletes*2*BALANCE_ALLOCATION_CALLS)
    # The insertion primitive's root-count input cap is deliberately retained;
    # large complete mutation inventories refuse instead of clipping a count.
    bound=main_growth_bound(header,main_bytes,charged)
    bound.update(createdRoots=operations['createdRoots'],nativeDeleteCalls=deletes,
        deleteBalanceAllocationCalls=deletes*2*BALANCE_ALLOCATION_CALLS,
        normalInsertionsIncludeOverwrites=True,callerReviewVerified=False,
        writerGraphAdmissionImplemented=False,mainFileLengthOrVfsPreallocationBounded=False,
        physicalFilesystemClosureClaimed=False)
    return bound
