"""One concrete kit timing clarification on #162. No host calls or operators."""
import sys
sys.dont_write_bytecode=True
from prechecks6210209468_evidence import *
K=W/'WP/batch-release-kit-be837974-20261016'
D=K/'whole-outage-timing-question-once'
HEAD='95689ccdcf312c311cf97115e18db19d9d07abac'
assert git('rev-parse','HEAD').decode().strip()==HEAD and not D.exists()
marker='kit-be837974-whole-outage-timing-410apply-395ready-95689ccd'
body='''@claude Thank you; qualification acceptance6212990400 is retained at23aeff2695972230ce2c6e1312255bee726fc311. I have started the concrete be837974/acc15844 kit. One timing contradiction needs a pin before I can truthfully bind the outage budget.

The source-only kit foundation and seven passing critical refusal tests are at [95689ccd](https://github.com/yigini/soilfer-lims/tree/95689ccdcf312c311cf97115e18db19d9d07abac/WP/batch-release-kit-be837974-20261016). [timing-evidence.json](https://github.com/yigini/soilfer-lims/blob/95689ccdcf312c311cf97115e18db19d9d07abac/WP/batch-release-kit-be837974-20261016/timing-evidence.json) binds all13 original timing files by Git blob id, SHA-256 and length; the publication index verifies34 raw files. No host call, new proof, SQL or production action has run.

**Measured evidence:** the retained cde8/B5 installer APPLY calls took89.347533s (#206),130.241215s (#214),190.743765s (#209): **410.332512s** total. All nine DRY/APPLY/REPEAT commands took632.285438s. The fastest accepted100000 full readiness was394.886040s (jobs-ON; jobs-OFF424.826024s). Even the three APPLY calls plus fastest readiness plus10s stop grace compare to **815.218552s /13.59min**, before quiesce, writer checks, stopped integrity/FK, backup, preservation, postflights or reopen. This is a comparison of separate retained runs under their original image/source context, not a measured production sequence or a new acc158 install-path claim.

Both accepted100000 starts and233000 starts used an **already installed112-table/42-receipt database**. The233000 healthy times332.770197s/392.474833s are startup-only; its503.841765s/594.266315s result times also include the stopped seal. None demonstrates the whole maintenance sequence including the three new installs within9–10min.

**Please pin the intended boundary:** may the kit disclose and gate a longer measured/guarded *whole503 outage* while keeping the exact600s candidate-readiness deadline, or does YY require a10min total maintenance limit that needs a separately scoped performance change first? I cannot label the current whole sequence a measured9–10min fit. I will not omit DRY/repeat/preservation checks, run installers before quiescence, raise600s, or schedule another proof from this question.

Independent kit work continues: AFTER-natural-sync counts with explicit per-table intake deltas; full provenance preservation; fresh YY acceptance of193new/23holds/20oldcross-duplicates/1ZMBnotice/otherlabs0/maygrow and workload control; unchanged805306368/blankheap/OOM0/disk guards; bounded unhealthy-consumer inventory before the gate; failure leaves503 and stops/retains the candidate with a partial receipt on162. No automatic predecessor restart is proposed: #187 pin4's proven pre-COMMIT exception does not override this release's stricter forward-only rule after any installer/default-entrypoint attempt.

This is a timing-scope clarification, **not** a complete kit SourcePASS request. Main remains on merge hold and208/207 continue source work in their isolated worktrees.

<!-- '''+marker+' -->'
pages=subprocess.check_output(['gh','api','--paginate','--slurp','repos/yigini/soilfer-lims/issues/162/comments?per_page=100&since=2026-10-16T09:58:00Z'],cwd=W)
rows=[c for page in json.loads(pages) for c in page]
assert not any(marker in c.get('body','') for c in rows),'Question already exists'
later=[c for c in rows if c['id']>6212990400 and (c.get('performed_via_github_app') or {}).get('id')==1236702]
assert not later,'Read new actual Claudio direction before posting'
D.mkdir();save(D,'fresh-context-original.json',pages);save(D,'body-utf8.txt',body.encode())
save(D,'request.json',canonical({'body':body})+b'\n');save(D,'post-intent-once.json',canonical({'utc':utc(),'marker':marker,'source':HEAD,'bodySha256':sha(body.encode())})+b'\n')
p=subprocess.run(['gh','api','repos/yigini/soilfer-lims/issues/162/comments','--method','POST','--input',str(D/'request.json')],cwd=W,capture_output=True)
save(D,'response-original.json',p.stdout);save(D,'post-stderr-original.txt',p.stderr);save(D,'post-exit.json',canonical({'exitCode':p.returncode})+b'\n')
assert p.returncode==0,'Unknown outcome: inspect same marker, never repost'
posted=json.loads(p.stdout)
raw=subprocess.check_output(['gh','api','repos/yigini/soilfer-lims/issues/comments/'+str(posted['id'])],cwd=W);save(D,'fresh-readback-original.json',raw);fresh=json.loads(raw)
assert posted['body']==fresh['body']==body and fresh['created_at']==fresh['updated_at']
record={'commentId':fresh['id'],'url':fresh['html_url'],'createdUtc':fresh['created_at'],'bodySha256':sha(body.encode()),'requestResponseFreshReadbackEqual':True,'marker':marker,'hostCalls':0,'completeKit':False,'nativeFallbackDelivered':False,'acknowledgement6212990400OnlyHere':True}
save(D,'delivery-record.json',canonical(record)+b'\n');print(json.dumps(record))
