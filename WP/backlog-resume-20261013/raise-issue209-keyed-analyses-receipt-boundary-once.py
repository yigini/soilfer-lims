"""Ask one narrow auditor contract question; preserve existing assertions pending the answer."""
import datetime,hashlib,json,subprocess,sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf8')
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent;dest=wp/'issue209-keyed-analyses-receipt-boundary'
assert not dest.exists()
def cmd(*args):return subprocess.run(args,cwd=root,capture_output=True,check=True).stdout
def git(*args):return cmd('git',*args)
assert git('branch','--show-current').strip()==b'audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip()
prior=git('rev-parse','HEAD').decode().strip();assert prior=='aa25effa110cb92dde6f1dba4047a79fb3b1f9a5'
assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==prior
main=cmd('gh','api','repos/yigini/soilfer-lims/git/ref/heads/main');assert json.loads(main)['object']['sha']=='2242bcb4861a7085bb95e78e0e7b1e4edf11d1b8'
comments=cmd('gh','api','repos/yigini/soilfer-lims/issues/209/comments?per_page=100')
marker='#209 keyed analyses receipt contract'
assert not any(marker in c['body'] for c in json.loads(comments)),'Already posted; never duplicate.'
sourcePaths=['server/services/orderService.js','server/controllers/sampleController.js','server/tests/contracts/audit_1_2_state_authority.test.js']
source={p:git('show',prior+':'+p) for p in sourcePaths}
assert all(b== (root/p).read_bytes().replace(b'\r\n',b'\n') for p,b in source.items()),'Question source changed.'
assert b"expect(saved.receipts).toHaveLength(mode === 'order' ? 1 : 0);" in source[sourcePaths[2]]
report=json.loads((wp/'issue209-full-ordinary-companion/report-original.json').read_bytes())
suite=next(s for s in report['testResults'] if Path(s['name']).name=='audit_1_2_state_authority.test.js')
failure=next(c for c in suite['assertionResults'] if c['fullName']=='analyses adding work to SUBMITTED_FULL atomically resumes processing')
assert failure['status']=='failed' and 'Expected length: 0' in '\n'.join(failure['failureMessages'])
body=f'''{marker}, following accepted scope 6163271808 and the no-assertion-weakening condition in 6167740581. This is a narrow contract question, not an audit-ready request.

During the per-case review I found one existing assertion that is not an orderless-fixture problem. `audit_1_2_state_authority` calls the shared service in both modes with a real caller-supplied `idempotencyKey`. Its order-mode expectation is one receipt; its analyses-mode expectation is zero receipts, because the old analyses service ignored the key. The full-run original failure is expected length 0, received one `APPLY_ORDER_REVISION` receipt. The sample transition, generated work, one revision and two lines already pass that test.

The #209 draft routes both endpoints to one service and accepts the key on both routes. A supplied key checks and records one scoped receipt in the same transaction, with the normalized full target and reason in the payload hash. Replay returns the retained outcome; a differing payload with that key refuses 409 `IDEMPOTENCY_KEY_CONFLICT`. A call without a key creates no receipt.

Please confirm whether keyed analyses commands should share that one-receipt contract. I propose retaining the shared behavior and changing this specific legacy zero-receipt expectation to exactly one for both keyed modes, with explicit same-key zero-write replay and differing-payload refusal checks for both modes. This strengthens the new shared contract rather than removing the key from the test or silently restoring the old ignore-key behavior. If preserving the old receipt-free analyses behavior is required, please state that boundary explicitly. No assertion or receipt implementation has been changed to resolve this case.

Exact pushed source: [shared order service](https://github.com/yigini/soilfer-lims/blob/{prior}/server/services/orderService.js), [both controllers](https://github.com/yigini/soilfer-lims/blob/{prior}/server/controllers/sampleController.js), [legacy state-authority assertion](https://github.com/yigini/soilfer-lims/blob/{prior}/server/tests/contracts/audit_1_2_state_authority.test.js). Original full failure stays at daca2a12. The other three state-authority failures omit the newly mandatory reason before their injected order/receipt failures; I will supply that explicit command input while preserving their original rollback assertions.

Progress: 309 of the original 650 failing cases are independently verified in closed focused runs; 341 remain unresolved. The current corrected sequential successor has passed result writes 56/56, import-owner preservation 100/100, QC locks 57/57, intake cancellation 47/47 and core209 32/32; strict scanners are still running, so those new results are not yet claimed as complete batch or full-suite PASS. The earlier new fixture query typo and all other failures remain retained honestly. Runtime missing-order refusals, separate read-only impact lists and the approved-orphan nonzero STOP remain unchanged under 6167740581. No production collection, #209 PR, CI/audit-ready notice, merge, release kit, gate or deployment.
'''
dest.mkdir();(dest/'question-original.md').write_bytes(body.encode())
(dest/'comments-before-original.json').write_bytes(comments);(dest/'main-before-original.json').write_bytes(main)
for p,b in source.items():(dest/(Path(p).name+'.source-original')).write_bytes(b)
(dest/'original-failing-assertion.json').write_bytes((json.dumps(failure,indent=2)+'\n').encode())
(dest/'question-post-request.json').write_bytes((json.dumps({'body':body})+'\n').encode())
with (dest/'question-post-original.json').open('xb') as out,(dest/'question-post-stderr-original.log').open('xb') as err:
 result=subprocess.run(['gh','api','repos/yigini/soilfer-lims/issues/209/comments','--method','POST','--input',str(dest/'question-post-request.json')],cwd=root,stdout=out,stderr=err)
(dest/'question-post-exit-original.txt').write_bytes((str(result.returncode)+'\n').encode())
assert result.returncode==0,'Unknown remote outcome: inspect actual history, never replay.'
posted=json.loads((dest/'question-post-original.json').read_bytes());assert posted['body']==body
fresh=cmd('gh','api','repos/yigini/soilfer-lims/issues/comments/'+str(posted['id']));assert json.loads(fresh)['body']==body
(dest/'question-fresh-original.json').write_bytes(fresh)
record={'recordedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'comment':posted['id'],'url':posted['html_url'],'createdUtc':posted['created_at'],'sourceEvidenceAudit':prior,'bodySha256':hashlib.sha256(body.encode()).hexdigest(),'postedOnce':True,'actualAnswerPending':True,'nativeHandoffSent':False,'assertionChanges':0,'runtimeChanges':0,'productionOperations':0}
(dest/'question-post-record.json').write_bytes((json.dumps(record,indent=2)+'\n').encode())
raw={p.relative_to(root).as_posix():{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in dest.iterdir() if p.is_file()}
(dest/'index.json').write_bytes((json.dumps({'record':record,'rawFiles':raw},indent=2)+'\n').encode())
owned=list(raw)+[(dest/'index.json').relative_to(root).as_posix(),Path(__file__).relative_to(root).as_posix()]
git('add','-f','--',*owned);assert set(git('diff','--cached','--name-only').decode().splitlines())<=set(owned)
for p,pin in raw.items():assert hashlib.sha256(git('show',':'+p)).hexdigest()==pin['sha256'],p
git('commit','-m','audit(209): ask keyed analyses receipt contract once');head=git('rev-parse','HEAD').decode().strip()
for p,pin in raw.items():assert hashlib.sha256(git('show',head+':'+p)).hexdigest()==pin['sha256'],p
git('push','origin','HEAD:refs/heads/audit/release-eb6de2e8');assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head
print(json.dumps({'auditHead':head,'comment':posted['id'],'url':posted['html_url'],'rawBlobsVerified':len(raw),'postedOnce':True,'actualAnswerPending':True,'assertionChanges':0,'productionOperations':0}))
