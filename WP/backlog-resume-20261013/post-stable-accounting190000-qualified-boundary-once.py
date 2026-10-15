"""One qualified-build notice and bundled approval/nudge acknowledgement."""
import datetime,hashlib,json,pathlib,subprocess
R=pathlib.Path(__file__).resolve().parents[2]
S=R/'WP/batch-build-stable-accounting-be837974-20261015'
D=S/'qualified-build190000-handoff-once'
BASE='5f86a1966af536f83a345ebdb02983bbe2a166ad'
def run(*a):return subprocess.check_output(a,cwd=R)
def git(*a):return run('git','-c','core.longpaths=true',*a)
def sha(b):return hashlib.sha256(b).hexdigest()
assert not D.exists() and git('rev-parse','HEAD').decode().strip()==BASE
assert not git('diff','--cached','--name-only').strip()
V=S/'first-build-190000-closed-originals-once'
v=json.loads((V/'independent-closed-validation.json').read_bytes())
t=json.loads((V/'build-receipt.json').read_bytes())
assert v['qualified'] is True and v['image']==t['image']=='sha256:acc158447f5571068bf150fc0e8fa6f0889aeb38f9aec8be08978d903bd5be6a'
assert v['receiptSha256']==sha((V/'build-receipt.json').read_bytes())=='cd3a2757d8ecb0bf933f49231031eb7fb61eb5abaac17d05f3585c1baaf89f0a'
assert t['sourceReviewId']==6200145007 and t['newBuildCount']==1 and t['exitCode']==0 and t['error'] is None
assert t['cachePruningPerformed'] is False and t['proofDatabaseRemovalPerformed'] is False
assert all(json.loads((V/('allocation-'+p+'-original.json')).read_bytes())['acceptedCompleteAttempt']==1 for p in ['before','after'])
history=run('gh','api','--paginate','--slurp','repos/yigini/soilfer-lims/issues/162/comments?per_page=100')
marker='stable-accounting-qualified-build190000-cd3a2757'
assert not any(marker in c.get('body','') for page in json.loads(history) for c in page),'Never duplicate the qualified-build notice'
body=f'''Claudio: the ONE new build-only qualification has completed successfully. Reference `{marker}`.

I read and validated your NEW Source review: PASS6200145007 at19:08:01UTC for exact4de3e334, all five SHA256s and all47literal bindings, plus your YY-requested note6200229685 at19:12:37UTC. This is the single acknowledgement of that PASS and nudge. The old619912PASS was consumed by failed180000; it did not authorize this build.

ONE32file raw-Git package and ONE190000 root/unit were used. Actual invocation54ec282a37d34dd3997c3274c5587abf started19:18:30UTC. The ordinary cached Docker build exited0 in{t['elapsedSeconds']}s; original receipt closed{t['closedUtc']}, status `NEW_STARTUP_APP_IMAGE_BUILT_NOT_PROVED_OR_DEPLOYED`, SHA256`{v['receiptSha256']}`. NEW image `{t['image']}`, {t['imageBytes']}B, exactmainbe837974/tree676b/mainCI38772398721/allFOUR app audits.

All three fresh R4 gates passed: before-root19:17:47.933704UTC required24,979,499,118/free28,618,244,096B; immediately before-unit19:18:29.244715UTC required24,935,798,894/free28,576,563,200B; the original before-build gate is included in the closed evidence. Each requirement includes the fixed floor +4GiB build reserve +ADDITIONAL10,000,000,000B and only future package/extraction allocations. All three real nonalias4096-block paths are the same device64769, not additive.

Both complete120s-bounded physical measurements succeeded at their FIRST attempt, exit0/empty stderr/exact integer complete inventories. No additional measurement was needed. Every raw stdout/stderr/intent/result is retained0400. Owned-root allocated growth66,215,936B plus containerd606,208B =66,822,144B; Docker buildkit unchanged/legacy paths absent0. Free drop66,260,992B; independently recomputed unexplained growth0; closed free28,510,281,728B. This is an observation, not a future proof fit.

All32remote package files match the published originals; ALL1567extracted source files match raw Git OID/SHA256/length/executable mode, and all1333frozen application inputs/all5tooling sources remain unchanged. Sealed ID/log/receipt/originalimageinspect0400; distinct fresh closed read-only image inspection equals the ENTIRE original object. Before/after topology/PID/config hash match. Same-invocation journal proves start/done/successful deactivation. Transient unit was GC/unloaded afterward: not-found/infinity/empty properties and the sentinel peak are not executed limits or measured peak. Actual active opening805306368/Swap0/45min is separately retained.

[ALL64verified closed artifacts and independent qualification](https://github.com/yigini/soilfer-lims/blob/{BASE}/WP/batch-build-stable-accounting-be837974-20261015/first-build-190000-closed-originals-once/publication-index.json). [Actual new source PASS/full current authorities/YY-requested note](https://github.com/yigini/soilfer-lims/blob/ca1abf203a881ef4ce423aa6073899a477cd7bd5/WP/batch-build-stable-accounting-be837974-20261015/actual-source-pass-6200145007-complete-publication-once/publication-index.json). The first evidence-retainer count mistake was63bindings+index=64blobs; it refused before output/stage/commit/host and is honestly retained with its unique successor. Reviewed source was unchanged.

Failed180000/a61 remains FAILED/unqualified, never remeasured/adopted/retried; original221500/oldresidual/B5/allhistorical roots and stopped containers remain protected. New190000/root/unit/package/PASS/helpers are consumed; never rebuild/retag/replay/cleanup.

Next I will implement concrete bounded R2 cache-maintenance source for review: actual `max-used-space`5GB cap, protect every in-use/image-shared record even above5GB, immutable item receipts and df before/after. No R2 operator or new R2 source-review request exists yet; this notice requests no approval of an unimplemented graph. Then complete NEWimage-bound proof tooling/all-hash SourcePASS/fresh R4computed+10GB/NEWproofroot; never cde8/B5/100000retry. No proof, cleanup, kit, gate, deployment, production DB/settings/restart or103operation occurred. Production remains the historical959d/7a image and was not newly probed by this build. All science/refusal/report/impact/approved-amendmentSTOP/YYlists/fullhash/copyrace/600s805/forward-only/history/human protections remain.
'''
D.mkdir()
def save(n,b):
 with (D/n).open('xb') as f:f.write(b)
save('history-before-original.json',history)
save('actual-qualified-notice-body.txt',body.encode())
payload=(json.dumps({'body':body})+'\n').encode();save('post-payload-original.json',payload)
save('post-intent.json',(json.dumps({'startedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'marker':marker,'neverReplay':True,'sourceReviewId':6200145007,'acknowledgesNote':6200229685,'proofsCleanupDeployments':0})+'\n').encode())
actual=None
try:
 result=subprocess.run(['gh','api','--method','POST','repos/yigini/soilfer-lims/issues/162/comments','--input','-'],cwd=R,input=payload,capture_output=True,timeout=60)
 save('post-response-original.json',result.stdout);save('post-stderr-original.txt',result.stderr)
 if result.returncode==0:actual=json.loads(result.stdout)
except subprocess.TimeoutExpired as e:
 save('post-response-partial.txt',e.stdout or b'');save('post-stderr-partial.txt',e.stderr or b'')
if actual is None:
 raw=run('gh','api','--paginate','--slurp','repos/yigini/soilfer-lims/issues/162/comments?per_page=100');save('reconcile-original.json',raw)
 matches=[c for page in json.loads(raw) for c in page if c.get('body')==body]
 assert len(matches)==1,'Unknown outcome; never repost';actual=matches[0]
assert actual['body']==body
save('actual-post-confirmed.json',(json.dumps(actual,indent=2)+'\n').encode())
print(json.dumps({'status':'QUALIFIED_BUILD190000_PROGRESS_NOTICE_AND_BUNDLED_ACK_POSTED_ONCE','id':actual['id'],'url':actual['html_url'],'createdUtc':actual['created_at'],'proofsCleanupDeployments':0}))
