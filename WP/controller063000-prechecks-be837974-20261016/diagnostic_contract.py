"""Authority for two pre-attempt checks. No production or retry authority."""
import pathlib,re
from proof_contract import canonical,sha,require,authority_projection,MEMORY,FLOOR,GROWTH_ABORT
REL='WP/controller063000-prechecks-be837974-20261016/'
NAME='workflow-batch-prechecks-be837974-20261016T080000Z'
ROOT=pathlib.PurePosixPath('/opt/lims/releases')/NAME
MODES=('comparator','hook')
UNITS={m:'lims-'+NAME.lower()+'-'+m+'.service' for m in MODES}
ACCEPTED_ID=6208837867
ACCEPTED_TIME='2026-10-16T05:33:23Z'
ACCEPTED_SHA='f260602d431018eacf632a04fc331515ed53746e9d08b8a2ba938e5d2650927d'
LOG_RESERVE=4*1024**3
HEADROOM=10000000000
SECONDS={'comparator':1800,'hook':300}
SOURCE_NAMES=('proof_contract.py','proof_render.py','proof_app_sources.py','proof_budget.py','proof_files.py','provenance_privacy.py','provenance_rules.py','kobo_copy_preservation.py','controller_guard.py','stop_owned.py','diagnostic_contract.py','diagnostic_io.py','diagnostic_authority.py','run_diagnostic.py','prepare_diagnostic.py','launch_diagnostic.py','verify_diagnostic.py','prior_provenance_guards.py','writer_fingerprint.cjs')
DATA_NAMES=('diagnostic-pins.json','retained-fetch-original.json','writer-map.json','application-source-fixtures/server/controllers/koboController.js','application-source-fixtures/server/services/sampleHoldService.js','application-source-fixtures/server/services/sampleStateService.js','application-source-fixtures/server/prisma/schema.prisma')
def accepted(v):
    require(v.get('id')==ACCEPTED_ID and v.get('created_at')==v.get('updated_at')==ACCEPTED_TIME and (v.get('performed_via_github_app') or {}).get('id')==1236702 and v['performed_via_github_app']['slug']=='claude' and sha(canonical(authority_projection(v)))==ACCEPTED_SHA,'Actual new closed-failure acceptance and two-check scope required')
def bindings(index):
    require(re.fullmatch('[a-f0-9]{40}',index.get('head','')) and set(index.get('files',{}))==set(SOURCE_NAMES+DATA_NAMES),'Exact complete precheck graph required')
    for p,v in index['files'].items():require(v['bytes']>0 and re.fullmatch('[a-f0-9]{64}',v['sha256']) and re.fullmatch('[a-f0-9]{40}',v['blob']),'Precheck source binding malformed')
    return {p:v['sha256'] for p,v in index['files'].items()}
def tokens(index):
    return [index['head'],str(ROOT),*UNITS.values(),str(ACCEPTED_ID),ACCEPTED_SHA,'PRECHECKS_ONLY_NOT_RELEASE_QUALIFIED','EXACT_16_LOWER_HEX','RAW_INSPECT_STDOUT_HOST_ONLY_NEVER_FETCH','PS_INSPECT_ONLY_NO_STOP_START','COPY_ORIGINALS_OPEN_ONLY_NEW_COPIES_RO_IMMUTABLE','ALL112_TABLES_42_RECEIPTS_EVERY_HOLD_AUDIT_CONSUMED','R4_FLOOR_PLUS_10GB_4GIB_LOGS_500MB_ABORT','ONE_RUN_EACH_NO_RETRY','CHECK_RESULTS_REQUIRE_CLAUDIO_ACCEPTANCE_BEFORE_ATTEMPT',*bindings(index).values()]
def approval(v,index):
    require(v.get('id',0)>ACCEPTED_ID and v.get('created_at','')>ACCEPTED_TIME and v.get('created_at')==v.get('updated_at') and (v.get('performed_via_github_app') or {}).get('id')==1236702 and v['performed_via_github_app']['slug']=='claude','New unedited actual precheck source review required')
    require(v['body'].splitlines()[0].strip().strip('*_')=='Source review: PASS' and all(t in v['body'] for t in tokens(index)),'Exact precheck source PASS and every binding required')
