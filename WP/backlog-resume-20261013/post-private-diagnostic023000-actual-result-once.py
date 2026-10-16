"""Deliver one actual Step1 diagnostic result, bundling the source-PASS acknowledgement."""
import datetime,hashlib,json,pathlib,subprocess,sys
sys.dont_write_bytecode=True
W=pathlib.Path(__file__).resolve().parents[2];REL='WP/jobs-row-diagnostic-private-be837974-20261016/';B=W/REL;D=B/'actual-diagnostic023000-result-request-once';V=B/'closed-diagnostic023000-independent-validation-once';P=B/'package-workflow-batch-row-diagnostic-be837974-20261016T023000Z'
BASE='3365c306d937b0b6cf7ca70960be5dc5fb7ecc35';MARKER='row-diagnostic023000-46338c54-result-0911f2d5'
sys.path.insert(0,str(B));from diagnostic_contract import *
import prepare_diagnostic as prep
def git(*a,input=None):return subprocess.check_output(['git','-c','core.longpaths=true',*a],cwd=W,input=input)
assert git('rev-parse','HEAD').decode().strip()==BASE and git('branch','--show-current').decode().strip()=='audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip() and not D.exists()
pubpath=REL+'closed-diagnostic023000-publication-once/publication-index.json';pubraw=git('show',BASE+':'+pubpath);assert pubraw==(W/pubpath).read_bytes();pub=strict(pubraw);assert len(pub['bindings'])+1==70
for r in pub['bindings']:
 b=git('show',BASE+':'+r['path']);assert len(b)==r['bytes'] and sha(b)==r['sha256'] and b==(W/r['path']).read_bytes()
record=strict((V/'closed-independent-result.json').read_bytes());assert record['status']=='CLOSED_PRIVATE_DIAGNOSTIC_PUBLIC_EVIDENCE_VALIDATED_AWAITING_CLAUDIO_ACCEPTANCE' and record['stopClassifications']==[] and record['sourceReviewId']==6206544265
idx=strict((P/'source-index.json').read_bytes());review=strict((P/'source-review.json').read_bytes());approval(review,idx);prep.published(idx)
captures=[];original=prep.command
def capture(*a):
 b=original(*a)
 if a[:2]==('gh','api'):captures.append((list(a),b))
 return b
prep.command=capture;evidence=prep.current_evidence(review,idx)
pages=strict(capture('gh','api','--paginate','--slurp','repos/yigini/soilfer-lims/issues/162/comments?per_page=100'));comments=[c for page in pages for c in page];assert not any(MARKER in c.get('body','') for c in comments),'Result already delivered; never repost'
url='https://github.com/yigini/soilfer-lims/blob/'+BASE+'/'+REL
body=f'''@claude Actual Step 1 diagnostic result for acceptance — source `{idx['head']}`, one consumed `023000` attempt.

Thank you for Source review: PASS [6206544265](https://github.com/yigini/soilfer-lims/issues/162#issuecomment-6206544265). This result is the sole acknowledgement of that PASS. Its conditions were kept: one exact graph/root/unit, no retry, only the two retained copied mains opened read-only and immutable, no copies, runtime network, containers or production writes, and private row/key bytes remain withheld **on the host**.

**Actual closed outcome**

- Root `/opt/lims/releases/workflow-batch-row-diagnostic-be837974-20261016T023000Z`; unit `lims-workflow-batch-row-diagnostic-be837974-20261016t023000z`; invocation `9026c0ad2c4849e3ac5f2595aeaeec77`.
- Started **02:31:15.569835 UTC**, successfully deactivated **02:32:56.577631 UTC** on 2026-10-16 (101.007796 seconds). Four original PID1 journal records bind this same invocation. No active diagnostic remains.
- Original 0400 terminal: `DIAGNOSTIC_OBSERVED_CLASSIFIED_AWAITING_CLAUDIO_ACCEPTANCE`, failure `null`, stop classifications `[]`; `inputAfterVerifiedCount=1`, `resultValidCount=1`. `releaseQualified=false`, `step2Authorized=false`, `retryAllowed=false`.
- Terminal SHA256 `{record['terminalSha256']}`; complete public result SHA256 `{record['resultSha256']}`.

**The complete 112-table comparison**

| Table | Existing rows changed | Added | Deleted | Before → after |
|---|---:|---:|---:|---:|
| Sample | 20 | 174 | 0 | 39,280 → 39,454 |
| AuditLog | 0 | 218 | 0 | 13,209 → 13,427 |
| SampleHold | 0 | 22 | 0 | 12 → 34 |
| Notification | 0 | 1 | 0 | 242 → 243 |
| KoboConfig | 7 | 0 | 0 | 11 → 11 |

All **107 other tables** have equal before/after complete row-stream hashes and counts. Schema hashes match; all **42 `_schema_migrations` receipts** and their row stream match. There are **442 total row differences**, with every identity and changed column enumerated in the complete public result.

All **20 changed original Sample rows** classify as **CROSS_SUBMISSION_DUPLICATE**. Their only changed columns are `metadata`, `rejectionReason`, `updatedAt`. Every one remains `EXPECTED`, retains every old metadata value outside the exact writer, has unchanged `fieldMetadata`, and adds only `$.conflictingSubmissions` plus `$.provenanceHold`. Each has one retained-first-fetch/non-refusal config-bound conflicting submission and an exact new PROVENANCE hold, HOLD_RAISED audit, and KOBO_CONFLICTING_PROVENANCE audit. The 20 hold IDs and 40 audit IDs cross-check against the added-row identity lists. The complete 20-row summary includes every Sample ID, config/submission ID, changed columns and paired hold/audit IDs.

The reviewed runtime also checked **all** added samples, holds, audits and the notification, not only the first changed original. The seven config changes contain only `lastSyncAt`, `updatedAt` and, in one config, `lastSubmissionId`; none of the four refusal config IDs changed. No PRIMARY_REVISION or UNEXPLAINED classification occurred. The 174 added samples are now actual comparison counts; this does not retroactively validate the old failed proof or its log-reported skipped count.

**Preservation, privacy and limits**

- All six exact input main/WAL/SHM SHA256/stat records, including ctime/nlink, are equal before and after; six unique identities, nlink 1. Both main extents are 563,322,880 bytes; quick_check is OK and header bytes 18/19 are 2. No retainer SQL replay or DB fetch occurred.
- All **475 root files** were stable hash/stat checked after closure; the 15 uploaded package files match exactly. **442 private row files plus one fresh HMAC key file** remain 0400 on the host; **zero private file contents were fetched**. Only public bytes and private-file hash/stat manifests were retained/published. Every public row and all 20 structural classifiers were checked against a narrow public schema: IDs, column/key paths, counts, classifications and HMACs, plus the approved whole-table/file hashes. No raw coordinates, names, payloads or key material appear in the published result. HMACs and raw row predicates were computed by the unchanged reviewed runtime; I did not retrieve the key or recompute them by replaying SQL.
- Both own-controller memory files occur in `public-terminal.files[]` and the shared sink. Sink bytes including terminal **4,204,211 ≤ 268,435,456**. Own-unit `oom=oom_kill=0` before and after; `memory.max=805306368`, `memory.swap.max=0`. After `memory.peak=805306368` and max events 6859 are observations only. No production memory sampling.
- All five actual remote programs compiled before the first SSH. Fresh BEFORE_ROOT required **14,856,705,134**, free **86,710,022,144**; BEFORE_UNIT required **14,851,118,190**, free **86,707,621,888**, each of the three same-filesystem paths, nonadditive. Exact package **5,586,944 bytes** charged before ROOT only. The full active 805306368/Swap0/1800/noRestart/private-network/IPdeny/AF_UNIX/strict-filesystem sandbox is retained in the opening evidence. Post-GC infinity/sentinel systemctl values are closed defaults, not executed limits or measured peak.
- Current be837974 main, CI38772398721 attempt1 push CLOSED SUCCESS, all four audits, six rules, two post-reboot directions, memory/jobs scopes, R2 acceptance, both diagnostic scopes, privacy findings and #191 CLOSED were freshly checked. All 8 source/3 data/1333 app inputs, 26 old proof sources and old 8-source/3-data graph are unchanged; all source and prior publication raw Git OID/SHA/length bindings were reverified.

**Complete public evidence** — publication `{BASE}` (70 raw files):

- [Publication index]({url}closed-diagnostic023000-publication-once/publication-index.json)
- [Full actual public result — all 112 tables and every changed/added row]({url}second-diagnostic023000-readonly-originals-once/public-originals/public-diagnostic-result.json)
- [Original terminal and complete file manifest]({url}second-diagnostic023000-readonly-originals-once/public-originals/public-terminal.json)
- [All 20 changed-original IDs, columns and exact pair IDs]({url}closed-diagnostic023000-independent-validation-once/changed-original-sample-summary.json)
- [Independent closed public-evidence validation]({url}closed-diagnostic023000-independent-validation-once/closed-independent-result.json)
- [Full same-invocation journal]({url}second-diagnostic023000-readonly-originals-once/journal-stdout-original)

Please review and accept or reject **this actual diagnostic result**, with any conditions. I will not prepare a Step 2 allowance/proof/remedy or a YY question before your actual acceptance. The original `003000` proof remains failed, `233000` remains the latest passing startup-only proof and is kept, and main stays held. No kit, gate or deployment approval is inferred. Future Step 2 still needs the separate reviewed graph and all owner-stop, memory, refusal, idempotence, fetch-ID, preservation and R4+10GB safeguards; future kit/gate still must disclose the 9–10 minute restart window and exact production 600-second failure behavior.

<!-- {MARKER} -->'''
D.mkdir()
def save(n,b):
 with (D/n).open('xb') as f:f.write(b)
save('request.json',canonical({'body':body})+b'\n');save('actual-result-request-body.md',body.encode());save('current-authority-evidence.json',canonical(evidence)+b'\n')
for k,(_,b) in enumerate(captures):save('api-original-'+str(k).zfill(2)+'.json',b)
save('api-command-index.json',canonical([{'file':'api-original-'+str(k).zfill(2)+'.json','argv':a,'bytes':len(b),'sha256':sha(b)} for k,(a,b) in enumerate(captures)])+b'\n')
args=['gh','api','--method','POST','repos/yigini/soilfer-lims/issues/162/comments','--input',str(D/'request.json')]
save('intent-before-post.json',canonical({'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'argv':args,'marker':MARKER,'bodySha256':sha(body.encode()),'neverRepeatPost':True,'unknownOutcomeInspectActualComments':True})+b'\n')
try:p=subprocess.run(args,cwd=W,capture_output=True,timeout=90)
except subprocess.TimeoutExpired as e:
 save('post-uncertain-stdout',e.stdout or b'');save('post-uncertain-stderr',e.stderr or b'');raise RuntimeError('Unknown POST outcome; inspect actual comments, NEVER repost') from None
save('actual-post-response-original.json',p.stdout);save('actual-post-stderr-original.log',p.stderr);save('actual-post-exit-original.json',canonical({'exitCode':p.returncode})+b'\n');assert p.returncode==0,'Preserve actual POST outcome; never repeat'
posted=strict(p.stdout);assert posted['body']==body and MARKER in posted['body']
readraw=original('gh','api','repos/yigini/soilfer-lims/issues/comments/'+str(posted['id']));save('fresh-unedited-readback-original.json',readraw);readback=strict(readraw)
assert readback['id']==posted['id'] and readback['body']==body and readback['created_at']==readback['updated_at'] and json.loads((D/'request.json').read_bytes())['body']==readback['body']
record={'status':'ONE_ACTUAL_DIAGNOSTIC_RESULT_DELIVERED_AWAITING_CLAUDIO_ACCEPTANCE','commentId':posted['id'],'url':posted['html_url'],'createdUtc':posted['created_at'],'marker':MARKER,'bodySha256':sha(body.encode()),'requestJsonEqualsActualResponseEqualsFreshUneditedReadback':True,'sourcePassAcknowledgementBundledOnlyHere':6206544265,'diagnosticResultPublication':BASE,'step2Authorized':False,'nativeFallbackNoEarlierUtc':(datetime.datetime.fromisoformat(posted['created_at'].replace('Z','+00:00'))+datetime.timedelta(minutes=20)).isoformat(),'neverRepeatPost':True}
save('delivery-record.json',canonical(record)+b'\n');print(json.dumps(record))
