"""Ask one narrow science-preservation question while source work can proceed."""
import hashlib,json,pathlib,subprocess
REPO=pathlib.Path(__file__).resolve().parents[2];D=REPO/'WP/startup-order-readiness-20261015/impact-refusal-scope-question-once';assert not D.exists();D.mkdir(parents=True)
def cmd(*a):return subprocess.check_output(a,cwd=REPO)
raw=cmd('gh','api','--paginate','--slurp','repos/yigini/soilfer-lims/issues/162/comments?per_page=100');(D/'comments-before-original.json').write_bytes(raw)
history=[r for page in json.loads(raw) for r in page];marker='startup impact refusal semantics after direction6188917117'
assert not any(marker in r['body'] for r in history),'Already asked; never duplicate'
pins=[]
for name in ['server/scripts/install_order_revisions.js','server/tests/contracts/issue_209_order_revision_integration.test.js','docs/audit/209-order-revisions.md']:
    raw=cmd('git','show','cde8c8896f5f9d5f1ab07b0ae16b1a765e0a6367:'+name);oid=cmd('git','rev-parse','cde8c8896f5f9d5f1ab07b0ae16b1a765e0a6367:'+name).decode().strip()
    assert hashlib.sha1(('blob '+str(len(raw))+'\0').encode()+raw).hexdigest()==oid
    target=D/'source-pins'/name;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(raw);pins.append({'path':name,'blob':oid,'sha256':hashlib.sha256(raw).hexdigest(),'bytes':len(raw)})
(D/'source-pins.json').write_text(json.dumps(pins,indent=2),encoding='utf-8')
body='''Claudio: startup impact refusal semantics after direction6188917117 — one narrow clarification to preserve the four actual #209 scientific directions. I have read and retained your full09:29:01UTC app-correction direction plus completed native reply (8 raw-verified blobs f852206c77a3fbd4f46b6f25cae0b6e6c0f46f42). I will implement the app fix, retain install/dry-run CLI behavior, reuse same-start prerequisites, remove startup copies/full-file checks, optimize readonly queries and add all26 READY timings/RSS. No new cde8/B5 proof or limit change.

Your new direction says startup proves “impact counts are zero” and a nonzero-impact startup “still refuses, exactly as before.” The exact cde8 source and accepted tests show a different existing boundary:

- [`assertOrderRevisionStartupReady`](https://github.com/yigini/soilfer-lims/blob/cde8c8896f5f9d5f1ab07b0ae16b1a765e0a6367/server/scripts/install_order_revisions.js#L224) currently refuses only classification other than COMPLETE_209. It returns the installer result with impact counts/lists; it does not require all those counts to be zero.
- The retained test [“malformed stored fraction analyses ... are listed read-only and cannot refuse schema-ready startup”](https://github.com/yigini/soilfer-lims/blob/cde8c8896f5f9d5f1ab07b0ae16b1a765e0a6367/server/tests/contracts/issue_209_order_revision_integration.test.js#L419) explicitly calls that startup function, expects COMPLETE_209 and a reported invalidStoredAnalysisSampleCount rather than a throw.
- [The accepted operational contract](https://github.com/yigini/soilfer-lims/blob/cde8c8896f5f9d5f1ab07b0ae16b1a765e0a6367/docs/audit/209-order-revisions.md#L44) keeps impact counts/lists for Claudio/YY before the gate, including continuing OPEN reservations (legitimate retained identities), and explicitly says malformed stored analysis reporting does not refuse schema-ready startup. Approved-amendment nonzero has its separate pre-apply/release STOP and reviewed forward-remedy requirement. New execution/amendment order-line refusals remain runtime zero-write refusals.

**Please choose the intended boundary before I implement the impact gate:** preserve these existing startup/reporting/runtime/release-gate semantics and treat zero impact as the proof/kit acceptance condition; or intentionally introduce new startup refusals, in which case specify the exact count fields and stable refusal code while retaining the invalid-stored-analysis and continuing-reservation exceptions. I recommend preserving the accepted #209 behavior for this performance-only fix. A blanket zero across every reported count would newly prevent a normal lab restart for retained OPEN reservations or legacy malformed analysis lists. I will not silently change that scientific/operational behavior.

I can progress source-only prerequisite reuse, startup-only schema classification, query optimization, READY telemetry and their independent tests while this narrow point is answered. No production/failed-copy connection, new runtime proof, source PR, build, installer, cleanup or gate is being attempted by this question.

One arithmetic correction to the native capacity phrasing: the measured reference deficit is4,351,022,190B **before** removing anything. Subtracting group(a)3,979,431,936B leaves371,582,254B against the previous graph, not4.4GB after those five removals. Neither number is a fresh fit/cleanup authority; all files remain and the next proof is blocked until its actual fresh requirement fits.'''
(D/'posted-body.txt').write_text(body,encoding='utf-8');(D/'post-input.json').write_text(json.dumps({'body':body}),encoding='utf-8')
raw=cmd('gh','api','--method','POST','repos/yigini/soilfer-lims/issues/162/comments','--input',str(D/'post-input.json'));(D/'post-response-original.json').write_bytes(raw);v=json.loads(raw);assert v['body']==body
(D/'delivery-record.json').write_text(json.dumps({'status':'ONE_NARROW_STARTUP_IMPACT_SEMANTICS_QUESTION_POSTED_NATIVE_PENDING','id':v['id'],'url':v['html_url'],'createdAt':v['created_at'],'neverRepeat':True},indent=2),encoding='utf-8')
print(json.dumps({'id':v['id'],'url':v['html_url'],'createdAt':v['created_at']}))
