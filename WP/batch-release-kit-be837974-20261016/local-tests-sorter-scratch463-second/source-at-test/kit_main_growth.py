"""Conditional logical-page growth for counted native B-tree operations.

This is an arithmetic planning primitive, not an application writer admission.
Every row AND index insertion attempt and root creation must first be counted
by a separate complete caller review. SQL statement counts are not that count.
No database is opened through SQL, and no quota or SQLite setting is changed.
"""
import json
import pathlib
import re
from kit_contract import canonical,require,sha
from kit_rollback_journal import rollback_header_bound,rollback_journal_plan
from kit_copy_admission import MAX_CONTENT_BYTES,copy_layout

CURSOR_DEPTH=20
BALANCE_SIBLINGS=5
# Charge all five output pages at every possible level, even though existing
# siblings are reused. Add a level for root deepening, the new child itself,
# and a separate quick-balance allocation. These are deliberately overcounts.
BALANCE_ALLOCATION_CALLS=(CURSOR_DEPTH+1)*BALANCE_SIBLINGS+2
PROOF_NAME='main-growth-source.json'


def counted_operations(value):
    require(type(value) is dict and set(value)=={'version','scope','callerReviewSha256','createdRoots','insertions'} and
        type(value['version']) is int and value['version']==1 and
        value['scope']=='DECLARED_NATIVE_BTREE_INSERTIONS' and
        isinstance(value['callerReviewSha256'],str) and re.fullmatch('[a-f0-9]{64}',value['callerReviewSha256']),
        'Exact declared native operation envelope required; this is not caller-review authority')
    require(type(value['createdRoots']) is int and 0<=value['createdRoots']<=100000 and
        type(value['insertions']) is list and len(value['insertions'])<=100000,
        'Bounded exact root and insertion inventory required')
    for row in value['insertions']:
        require(type(row) is dict and set(row)=={'calls','maximumPayloadBytes'} and
            type(row['calls']) is int and 1<=row['calls']<=1000000 and
            type(row['maximumPayloadBytes']) is int and 0<=row['maximumPayloadBytes']<=2147483647,
            'Count every attempted native row/index insertion with its full serialized payload bound')
    return value


def main_growth_bound(header,main_bytes,operations):
    """Pure bound, conditional on a COMPLETE native-operation inventory.

    Payload means BtreePayload nData+nZero (table) or nKey (index), including
    the SQLite record header. UTF-8/JSON/source text lengths are not substitutes.
    Only fresh-key insertions and roots are covered; replacement, deletion,
    autovacuum, rollback/retry and uncounted trigger/index writes are excluded.
    """
    geometry=rollback_header_bound(header,main_bytes);counted_operations(operations)
    require(header[20]==0 and header[21:24]==bytes([64,32,32]),
        'Zero reserved bytes and standard SQLite payload fractions required')
    page_size=geometry['pageSize'];calls=0;overflow=0
    for row in operations['insertions']:
        count=row['calls'];payload=row['maximumPayloadBytes'];calls+=count
        # Ignore local payload altogether. Every overflow page holds P-4
        # payload bytes; charging ceil(total payload/(P-4)) cannot undercount.
        overflow+=count*((payload+page_size-5)//(page_size-4))
    allocations=operations['createdRoots']+calls*BALANCE_ALLOCATION_CALLS+overflow
    # With autovacuum disabled, an end-of-file allocation increments nPage
    # once, plus one possible pending-byte gap. Charge that gap EVERY time.
    growth_pages=2*allocations
    pages=geometry['originalPages']+growth_pages
    require(pages<=4294967294 and pages*page_size<=MAX_CONTENT_BYTES,
        'Complete logical main growth exceeds the supported planning envelope; never clip')
    maximum=pages*page_size
    return {'originalPages':geometry['originalPages'],'pageSize':page_size,
        'nativeInsertCalls':calls,'createdRoots':operations['createdRoots'],
        'balanceAllocationCallsPerInsert':BALANCE_ALLOCATION_CALLS,
        'maximumOverflowAllocationCalls':overflow,'maximumAllocationCalls':allocations,
        'maximumAdditionalPages':growth_pages,'maximumLogicalMainPages':pages,
        'maximumLogicalMainBytes':maximum,'maximumLogicalGrowthBytes':maximum-main_bytes}


def main_growth_plan(target,operations):
    profile=rollback_journal_plan(target)
    raw=pathlib.Path(__file__).with_name(PROOF_NAME).read_bytes();proof=json.loads(raw)
    require(proof.get('scope')=='CONDITIONAL_COUNTED_NATIVE_BTREE_INSERTIONS' and
        type(proof.get('cursorDepth')) is int and proof['cursorDepth']==CURSOR_DEPTH and
        type(proof.get('balanceOutputPages')) is int and proof['balanceOutputPages']==BALANCE_SIBLINGS and
        proof.get('completeApplicationOperationInventory') is False and
        proof.get('physicalFilesystemClosureClaimed') is False,
        'Exact conditional native insertion proof required')
    bound=main_growth_bound(bytes.fromhex(profile['headerHex']),profile['originalFiles']['']['bytes'],operations)
    return {'version':1,'scope':'CONDITIONAL_LOGICAL_MAIN_PAGE_GROWTH',
        'source':profile['source'],'sourceDbWalShm':profile['sourceDbWalShm'],
        'headerHex':profile['headerHex'],'nativeProofSha256':sha(raw),
        'declaredOperations':json.loads(canonical(operations)),'bound':bound,
        # Full final logical content plus entry allowance, not growth-only
        # credit or an assertion about physical blocks or VFS preallocation.
        'layout':copy_layout([bound['maximumLogicalMainBytes']],0),
        'requiresCompleteNativeOperationInventory':True,'requiresFreshKeysAndInsertOnly':True,
        'requiresIntactInputDatabase':True,'requiresNoPreformattedOrTransferredCells':True,
        'requiresEveryTriggerAndIndexWriteCounted':True,
        'requiresNoContinuedWritesAfterRollbackOrSqliteError':True,
        'callerReviewVerified':False,'writerGraphAdmissionImplemented':False,
        'mainFileLengthOrVfsPreallocationBounded':False,'walGrowthBounded':False,
        'statementOrSqlScratchBounded':False,'physicalFilesystemClosureClaimed':False}
