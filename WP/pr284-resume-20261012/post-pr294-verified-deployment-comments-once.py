"""Post one completed, verified deployment handoff on each authorized target."""
import datetime
import hashlib
import json
from pathlib import Path
import subprocess

d=Path(__file__).resolve().parent
record=json.loads((d/'pr294-completed-deployment-213000-checkpoint.json').read_bytes())
verified=json.loads((d/'completed-production-213000-independent-verification.json').read_bytes())
receipt=json.loads((d/'completed-production-213000/production-receipt.json').read_bytes())
assert record['status']=='DEPLOYED_AND_INDEPENDENTLY_VERIFIED_AWAITING_ACTUAL_CLAUDIO_POSTCHECK'
assert verified['status']=='INDEPENDENT_READ_ONLY_IMPORT_POST_DEPLOY_PASS'
assert record['receiptSha256']==verified['receiptSha256']==hashlib.sha256((d/'completed-production-213000/production-receipt.json').read_bytes()).hexdigest()
assert record['head']==verified['head']==receipt['head']=='959d17e11c357266f7c2a41b0c84ab76914c591e'
assert record['productionGateSha256']=='fac9e2418ba7376b99e2e57b2e66ad4e66edf3d417bc2b8f083adfb1da56212a'
head=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()
remote=subprocess.check_output(['git','ls-remote','origin','refs/heads/audit/release-eb6de2e8'],text=True).split()[0]
assert head==remote,'Evidence checkpoint must be pushed before the handoff.'
notice='Deployed '+record['head']+' to production'
body=f'''{notice}

Completed UTC: {record['completedUtc']}. Independent read-only verification passed at {record['independentVerificationUtc']}.

- Exact image: `{record['image']}`; same `lims_lims-data` and `lims_lims-assets` volumes; Docker healthy, zero restarts/OOM, jobs enabled, 768 MiB, blank NODE_OPTIONS, auto-push/auto-seed disabled.
- HTTPS health and login returned 200 with verified TLS; health status ok/version 1.9.0; unauthorized receipts POST returned 401.
- All 104 original tables, 38 receipts, original rows/schema and scientific audit data preserved. Installed state: 106 tables/39 receipts, empty additive import tables and one schema receipt; no analytical backfill or historical draft links. DRY 0 / APPLY 1 / immediate NO_OP 0; full detached repeat preservation passed.
- Both default startups: 23 NO_OP installers/22 READY events, all zero changes. All 31 checks and six probes passed. Stopped logical backups/raw DB-WAL-SHM triples and modes independently reverified; original acceptance/event, NULL ReviewDecision link and PUBLISHED report retained. All 67 frozen files unchanged.
- Ingress reopened before jobs. {record['healthyObservationSeconds']:.6f} seconds/{record['healthSamples']} healthy samples, zero restarts; peak {record['peakBytes']:,} B <=805,306,368 B. Free {min(record['freeBytes'].values()):,} B versus {record['requiredIncludingAllocationBytes']:,} B required including 16 retained allocations/assets/logs.

Original root: `{record['root']}`; ONE213000 unit inactive/exit0. Immutable mode0400 production receipt SHA256 `{record['receiptSha256']}`; manifest `{record['manifestSha256']}`; coordinator `{record['coordinatorSha256']}`. Exact-kit PASS6132886810/source PASS6132712806/single consumed gate `{record['productionGateSha256']}`; original144000 PASSED proof and135400 build retained unchanged. Both workload pins held: `labAndHubBuildsOwnedByYY=true` / `RELEASE_DAY_DISK_ABORTS_ACCEPTED`.

[Original receipt and unit journal](https://github.com/yigini/soilfer-lims/tree/{head}/WP/pr284-resume-20261012/completed-production-213000); [independent verification](https://github.com/yigini/soilfer-lims/blob/{head}/WP/pr284-resume-20261012/completed-production-213000-independent-verification.json).

@claude: ready for your actual post-deploy check, #200 closure and #162 tick/handoff. Other application merges remain held until that check. No Claudio postcheck is claimed here. No replay/restart/recollect/retry/restore/older image/cleanup; any failure requires a separately audited forward fix. Failed161000 and superseded202400 remain untouched and excluded.
'''
with (d/'pr294-deployed-959d17e1-comment.md').open('x',encoding='utf-8',newline='\n') as out:out.write(body)
comments=[]
for issue in [162,294,200]:
 with (d/f'pr294-deployment-comment-{issue}-intent.json').open('x',encoding='utf-8',newline='\n') as out:
  json.dump({'startedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'issue':issue,'head':record['head'],'receiptSha256':record['receiptSha256'],'bodySha256':hashlib.sha256(body.encode()).hexdigest(),'status':'ONE_COMMENT_INTENT_NEVER_REPLAY'},out,indent=2)
 result=subprocess.run(['gh','api',f'repos/yigini/soilfer-lims/issues/{issue}/comments','--method','POST','--input','-'],input=json.dumps({'body':body}).encode(),capture_output=True,timeout=60)
 for label,raw in [('response',result.stdout),('stderr',result.stderr)]:
  with (d/f'pr294-deployment-comment-{issue}-{label}.json').open('xb') as out:out.write(raw)
 assert result.returncode==0,result.stderr.decode(errors='replace')
 value=json.loads(result.stdout);assert value['body']==body
 comments.append({'issue':issue,'id':value['id'],'url':value['html_url'],'createdUtc':value['created_at'],'rawSha256':hashlib.sha256(result.stdout).hexdigest()})
 with (d/f'pr294-deployment-comment-{issue}-posted.json').open('x',encoding='utf-8',newline='\n') as out:json.dump(comments[-1],out,indent=2)
 print(json.dumps(comments[-1]),flush=True)
with (d/'post-deploy-comments-959d17e1.json').open('x',encoding='utf-8',newline='\n') as out:json.dump(comments,out,indent=2)
