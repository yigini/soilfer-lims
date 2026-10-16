"""Closed, no-copy Step 1 diagnostic authority. No operational import effects."""
import json,hashlib,hmac,pathlib,re
from diagnostic_authority import require,canonical,sha,first_line
ROOT=pathlib.PurePosixPath('/opt/lims/releases/workflow-batch-row-diagnostic-be837974-20261016T023000Z')
UNIT='lims-workflow-batch-row-diagnostic-be837974-20261016t023000z'
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
HOLD_ACTIVE='AMBIGUOUS_PROVENANCE_HOLD'
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
_value_key=None
def install_value_key(key):
    global _value_key
    require(_value_key is None and type(key) is bytes and len(key)==32,'Fresh 32-byte public hash key required')
    _value_key=key

def _run_key_hex():
    require(type(_value_key) is bytes and len(_value_key)==32,'Public value hash key not initialized');return _value_key.hex()

def value_hash(v):
    require(type(_value_key) is bytes and len(_value_key)==32,'Public value hash key not initialized')
    return hmac.new(_value_key,canonical(projection(v)),hashlib.sha256).hexdigest()

def public_failure(error):
    # Only audited static messages and literal key names may be public text.
    # Dynamic parse/SQLite/OS exception text always remains keyed evidence.
    if type(error) is RuntimeError and str(error) in STATIC_REASONS:
        return {'errorType':'RuntimeError','reason':str(error)}
    if type(error) is KeyError and len(error.args)==1 and type(error.args[0]) is str and error.args[0] in LITERAL_KEYS:
        return {'errorType':'KeyError','reason':'Missing literal key: '+error.args[0]}
    return {'errorType':type(error).__name__,'errorHmacSha256':value_hash(str(error))}

def tokens(index):
    return [index['head'],*sorted(x['sha256'] for x in index['files'].values()),
        'diagnosticScope=STEP1_ONLY_NOT_RELEASE_QUALIFIED','scopeAnswerId=6205842415','privacyFindingsId=6206214444','resultScopeId=6205724552',
        'diagnosticRoot='+str(ROOT),'diagnosticUnit='+UNIT,'exactSixPinnedFilesOnly=true',
        'sqliteMode=ro&immutable=1','pageCountTimesPageSize=563322880','quickCheck=ok',
        'allTables=112','schemaReceipts=42','noCopies=true','noRuntimeNetwork=true',
        'noContainers=true','noWritingPragma=true','beforeAfterCtimeNlink=true','allOldValuesReported=true',
        'stopOnUnexplained=true','privateRawPublicHashes=true','publicValueHash=HMAC-SHA256','freshPrivateKeyBytes=32','keyRetainedOnlyPrivate0400=true','staticRefusalReasonsPublic=true','sharedSinkControllerMemory=true','beforeRootSixStatOnly=true','oneAttemptNoRetry=true',
        'floorBytes='+str(FLOOR),'logReserveBytes='+str(LOG_RESERVE),'memoryMaxBytes='+str(MEMORY),
        'no64EquivalentReserveForNoCopyDiagnostic=true','noRemedyBeforeDiagnosticAccepted=true',
        *[p['sha256'] for p in index['data'].values()]]
def approval(v,index):
    require(set(index['files'])==FILES and set(index['data'])==DATA,'Incomplete diagnostic graph')
    require(re.fullmatch('[0-9a-f]{40}',index['head']) is not None,'Source commit required')
    require(v.get('id',0)>6206214444 and v.get('created_at')==v.get('updated_at') and v['created_at']>'2026-10-16T01:51:11Z','Fresh unedited diagnostic PASS required')
    require(v.get('performed_via_github_app',{}).get('id')==1236702 and v.get('performed_via_github_app',{}).get('slug')=='claude','Actual Claude app required')
    require(first_line(v.get('body',''))=='Source review: PASS' and all(t in v['body'] for t in tokens(index)),'Exact diagnostic source PASS required')
def capacity(free,package_future=0):
    require(type(free) is int and type(package_future) is int and package_future>=0 and free>=FLOOR+LOG_RESERVE+package_future,'No-copy floor and log reserve shortfall')
def package_allowance(lengths):return sum((n+4095)//4096*4096 for n in lengths)+2*1024**2

STATIC_REASONS=frozenset(['191 reopened', 'Actual Claude app required', 'Actual accepted R2 boundary changed; no further R2 authority', 'Actual accepted startup result and jobs scope changed', 'Actual memory direction changed', 'Actual privacy source findings changed', 'Added Sample creation audit mismatch', 'Added Sample invented lifecycle authority', 'Added hold audit payload mismatch', 'Added hold audit scope/time mismatch', 'Added notification outside exact Kobo intake', 'After-read input changed; result void', 'Application approval changed', 'Application merge identity changed', 'Application provenance writer source changed', 'Both actual diagnostic directions required', 'Changed original is not EXPECTED', 'Changed-row bound', 'Complete six current rule authorities required', 'Complete source graph required', 'Conflict audit actor/scope differs from code', 'Conflict depth identity missing', 'Conflict entry shape differs', 'Conflict hold/audit count mismatch', 'Conflict id absent from retained first fetch', 'Conflict occurrence key mismatch', 'Conflict scope not uniquely active and non-refusal', 'Controller memory events malformed', 'Controller memory guard refused', 'Current actual post-reboot authorities required', 'Diagnostic runtime network/subprocess forbidden', 'Diagnostic scope changed', 'Duplicate JSON key', 'Duplicate added submission/depth', 'Duplicate hold audit', 'Exact completed main CI required', 'Exact diagnostic source PASS required', 'Exact diagnostic unit cgroup required', 'Exact prepared package required', 'Exact six input pins required', 'Expanded package refused', 'Field hold mirror malformed', 'Field metadata changed outside exact mirror writer', 'Final hold reason not paired', 'Fresh 32-byte public hash key required', 'Fresh unedited diagnostic PASS required', 'Frozen application input changed', 'Hold audit authority differs', 'Hold audit does not bind complete hold', 'Hold audit not uniquely paired', 'Hold marker differs from exact current code', 'Hold type/actor/marker/resolution differs', 'Incomplete diagnostic graph', 'Input changed before hashing', 'Input changed during hashing', 'Input mode or alias refused', 'Invalid hold marker', 'JSON depth bound', 'JSON size bound', 'Later application failure', 'Later source rejection', 'Launch consumed/uncertain', 'Launch transport refused; inspect same root/unit, never retry', 'Main changed', 'Main page extent mismatch', 'Main quick_check refused', 'Marker time malformed', 'Metadata must be an object', 'Missing or extra selected database file', 'No append-only conflict evidence', 'No-copy floor and log reserve shortfall', 'Noncanonical input path', 'Nonfinite JSON', 'Old metadata array changed', 'Old metadata value changed outside exact writer', 'Only exact empty WAL allowed', 'Only exact fresh diagnostic root', 'Output basename required', 'Output cap exceeded', 'Package preparation consumed', 'Prepared source changed', 'Primary revision evidence mismatch', 'Protected Sample column changed', 'Public value hash key not initialized', 'Reappended occurrence evidence', 'Regular single-link file required', 'Rejection reason overwritten', 'Retained fetch source identity mismatch', 'Retained first-fetch scope mismatch', 'Retained input pin mismatch', 'Review changed', 'Runtime exact review binding missing', 'Runtime package changed', 'Runtime spec differs', 'SQLite header required', 'Sample updatedAt regressed', 'Schema inventory bound', 'Source commit required', 'Source publication mismatch', 'Structural diff bound', 'Symlink input refused', 'Timestamp required', 'Timestamp zone required', 'Unclassified primary occurrence', 'Unified controller cgroup required', 'Unknown outcome; inspect same root/unit, never redispatch', 'Unpaired added hold', 'Unsupported SQLite key type'])
LITERAL_KEYS=frozenset(['AuditLog', 'DIAGNOSTIC_FIXTURE_ROOT', 'Notification', 'Sample', 'SampleHold', 'ZProtected104', 'after', 'allocatedBytes', 'app', 'applicationPins', 'arrays', 'beforeRoot', 'beforeUnit', 'blob', 'body', 'bytes', 'candidateGitBlobOid', 'changedCount', 'changedSamples', 'changes', 'ci', 'classification', 'columns', 'comments', 'config', 'conflictingCount', 'conflictingSubmissions', 'count', 'create', 'created_at', 'ctimeNs', 'data', 'depth', 'device', 'diagnosticScopes', 'everyOldValueRetained', 'evidenceFingerprint', 'fieldMetadata', 'fieldMetadataDiff', 'files', 'formId', 'head', 'holdCount', 'id', 'inode', 'inputAfterVerifiedCount', 'inputPins', 'isActive', 'issue191', 'jobsScope', 'koboServerUrl', 'kobo_id', 'labId', 'main', 'memory.events', 'memory.max', 'memory.swap.max', 'memoryDirection', 'metadata', 'metadataDiff', 'mode', 'nlink', 'observedUtc', 'occurrenceKey', 'pageBytes', 'pairing', 'path', 'postRebootAuthorities', 'privacyFindings', 'privateFiles', 'projectCode', 'provenanceHold', 'prs', 'r2Accepted', 'raisedAt', 'reason', 'refusal', 'rejectionReason', 'resultValidCount', 'retryAllowed', 'review', 'revisionCount', 'revisions', 'root', 'rules', 'seal', 'sha256', 'sourceComments', 'sourceReviewId', 'state', 'status', 'stopClassifications', 'submissionIds', 'tableCount', 'tables', 'unit', 'updatedAt', 'updated_at', 'verdicts', 'withheld'])
