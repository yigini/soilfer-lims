"""Closed, no-copy Step 1 diagnostic authority. No operational import effects."""
import json,hashlib,pathlib,re
from diagnostic_authority import require,canonical,sha,first_line
ROOT=pathlib.PurePosixPath('/opt/lims/releases/workflow-batch-row-diagnostic-be837974-20261016T020000Z')
UNIT='lims-workflow-batch-row-diagnostic-be837974-20261016t020000z'
OLD_ROOT=pathlib.PurePosixPath('/opt/lims/releases/workflow-batch-jobs-intake-be837974-20261016T003000Z')
MAINS=('startup-1-stopped-seal/backup.db','first-sync.db')
FILES=frozenset({'diagnostic_authority.py','diagnostic_contract.py','diagnostic_io.py','diagnostic_compare.py','run_diagnostic.py','prepare_diagnostic.py','launch_diagnostic.py','verify_diagnostic.py'})
DATA=frozenset({'diagnostic-pins.json','first-fetch-original.json','baseline-logical-original.json'})
FLOOR=10556150894
LOG_RESERVE=4*1024**3
MEMORY=805306368
SECONDS=1800
MAX_OUTPUT=256*1024**2
MAX_DIFF_ROWS=10000
MAX_JSON=8*1024**2
REFUSALS=frozenset({'ec5a5a67-3f5a-4682-88df-edb0e07e6485','f24b4f7a-1da7-4320-831e-b9105647f106','a9fc2329-cdfc-408e-aeb2-fa1a9020e66d','edfc27ed-adfe-44f8-8ef6-f159f3ba2fc0'})
APPEND=frozenset({'Sample','SampleHold','AuditLog','Notification'})
SAMPLE_FIELDS=frozenset({'metadata','fieldMetadata','rejectionReason','updatedAt'})
REJECTION='PROVENANCE_HOLD: Conflicting field submissions claimed this barcode'
CROSS_REASON='CONFLICTING_FIELD_SUBMISSIONS: Multiple field submissions claimed this barcode with conflicting survey evidence'
PRIMARY_REASON='REVISED_FIELD_EVIDENCE: Primary occurrence re-submitted with conflicting survey coordinates or attachments'
def strict(raw):
    def pairs(items):
        d={}
        for k,v in items:require(k not in d,'Duplicate JSON key');d[k]=v
        return d
    require(len(raw)<=MAX_JSON,'JSON size bound')
    return json.loads(raw,object_pairs_hook=pairs,parse_constant=lambda x:(_ for _ in ()).throw(RuntimeError('Nonfinite JSON')))
def projection(v):
    if isinstance(v,bytes):return {'blobHex':v.hex()}
    if isinstance(v,(tuple,list)):return [projection(x) for x in v]
    if isinstance(v,dict):return {k:projection(x) for k,x in v.items()}
    return v
def value_hash(v):return sha(canonical(projection(v)))
def tokens(index):
    return [index['head'],*sorted(x['sha256'] for x in index['files'].values()),
        'diagnosticScope=STEP1_ONLY_NOT_RELEASE_QUALIFIED','scopeAnswerId=6205842415','resultScopeId=6205724552',
        'diagnosticRoot='+str(ROOT),'diagnosticUnit='+UNIT,'exactSixPinnedFilesOnly=true',
        'sqliteMode=ro&immutable=1','pageCountTimesPageSize=563322880','quickCheck=ok',
        'allTables=112','schemaReceipts=42','noCopies=true','noRuntimeNetwork=true',
        'noContainers=true','noWritingPragma=true','beforeAfterCtimeNlink=true','allOldValuesReported=true',
        'stopOnUnexplained=true','privateRawPublicHashes=true','oneAttemptNoRetry=true',
        'floorBytes='+str(FLOOR),'logReserveBytes='+str(LOG_RESERVE),'memoryMaxBytes='+str(MEMORY),
        'no64EquivalentReserveForNoCopyDiagnostic=true','noRemedyBeforeDiagnosticAccepted=true',
        *[p['sha256'] for p in index['data'].values()]]
def approval(v,index):
    require(set(index['files'])==FILES and set(index['data'])==DATA,'Incomplete diagnostic graph')
    require(re.fullmatch('[0-9a-f]{40}',index['head']) is not None,'Source commit required')
    require(v.get('id',0)>6205842415 and v.get('created_at')==v.get('updated_at') and v['created_at']>'2026-10-16T01:20:31Z','Fresh unedited diagnostic PASS required')
    require(v.get('performed_via_github_app',{}).get('id')==1236702 and v.get('performed_via_github_app',{}).get('slug')=='claude','Actual Claude app required')
    require(first_line(v.get('body',''))=='Source review: PASS' and all(t in v['body'] for t in tokens(index)),'Exact diagnostic source PASS required')
def capacity(free,package_future=0):
    require(type(free) is int and type(package_future) is int and package_future>=0 and free>=FLOOR+LOG_RESERVE+package_future,'No-copy floor and log reserve shortfall')
def package_allowance(lengths):return sum((n+4095)//4096*4096 for n in lengths)+2*1024**2
