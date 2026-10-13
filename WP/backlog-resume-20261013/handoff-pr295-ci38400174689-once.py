"""Publish the completed exact-head CI audit notice once; never retry this helper."""
import datetime
import hashlib
import json
import subprocess
from pathlib import Path

root = Path(__file__).resolve().parents[2]
work = Path(__file__).resolve().parent
destination = work / 'pr295-final-audit-request-1a070'
assert not destination.exists(), 'Audit request boundary already consumed; inspect evidence, never replay.'
head = '1a0702b3be410ac1dcdd9dc92f0f0c3dd2774a3a'
base = '959d17e11c357266f7c2a41b0c84ab76914c591e'

def command(*args):
    return subprocess.check_output(args,cwd=root)

def gh(*args):
    return command('gh',*args)

audit = command('git','rev-parse','HEAD').decode().strip()
assert audit.startswith('79daa45c')
assert command('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0] == audit
assert command('git','branch','--show-current').strip() == b'audit/release-eb6de2e8'
assert not command('git','diff','--cached','--name-only').strip()
pin = json.loads((work/'ci-38400174689-completed-success/index.json').read_text(encoding='utf-8'))
for name, details in pin['files'].items():
    relative = 'WP/backlog-resume-20261013/ci-38400174689-completed-success/' + name
    assert hashlib.sha256(command('git','show',audit+':'+relative)).hexdigest() == details['sha256']
run = json.loads(gh('api','repos/yigini/soilfer-lims/actions/runs/38400174689'))
assert run['status'] == 'completed' and run['conclusion'] == 'success' and run['head_sha'] == head
before = gh('pr','view','295','--repo','yigini/soilfer-lims','--json',
            'state,headRefOid,baseRefOid,body,labels,comments,closingIssuesReferences')
pr = json.loads(before)
assert pr['state']=='OPEN' and pr['headRefOid']==head and pr['baseRefOid']==base
assert pr['closingIssuesReferences']==[] and pr['comments']==[] and pr['labels']==[]
original = (work/'issue-206-pr-body-harness-correction.md').read_text(encoding='utf-8')
assert pr['body']==original, 'PR body changed; preserve it and inspect before any edit.'
evidence = 'https://github.com/yigini/soilfer-lims/tree/'+audit+'/WP/backlog-resume-20261013/ci-38400174689-completed-success'
result_text = '''
Fresh complete standard CI on `''' + head + '''`: [38400174689](https://github.com/yigini/soilfer-lims/actions/runs/38400174689), attempt 1, completed SUCCESS at 2026-10-13 13:25:41 UTC. Exact final Jest summary:

```text
Test Suites: 362 passed, 362 total
Tests:       5508 passed, 5508 total
```

Every unique PASS path matches the full frozen inventory; zero failures/skips/pending. This CI used ordinary `npm test`, the unchanged setup/config/assertions and existing 8192 MB heap, without local path fixtures. Client build, actual candidate and supported-baseline `48d0e52` Docker builds, real disposable Docker boundary rehearsal and deployment readiness acceptance all succeeded. Candidate CI image `sha256:01156a6664039eda5c5291e471a9e1a70672c0383ed9a335f333cce3a83e747f`, baseline CI image `sha256:cfe2f47c47d421ec18275c74e77b35855aa93d18bb324f8b758b9874fbbaa254`. [Closed original archive, complete API records, raw server/boundary/readiness logs and hashes]('''+evidence+'''). Final actual audit PASS on this exact head is pending; no merge, release or production operation has occurred.
'''
comment = '@claude ready for audit at '+head+'\n\nPR295 / #206, base `'+base+'`. The LF and SPA-scope findings are resolved; `server/app.js` equals main. Your accepted test-script-only correction (#206/6145765510) is the sole delta from prior9ae02; all previous 51 source paths are unchanged.\n'+result_text+'\nPlease audit this exact head against #206. The additive schema/receipt guards, historical attempt preservation, named/scoped container writes, immutable same-sample aliquot links, hierarchy/labels and deferrals remain as described in the PR. #206 stays open for your actual post-deploy closure; completed production releases/receipts/gates/helpers/notices remain immutable.\n'
native = 'Pip final #206 audit handoff: PR295 is ready at exact source-only head '+head+' (tree85350d14bdff5a607a3d2edc9615785842c9c94b, base'+base+').\n\nFresh ordinary CI38400174689 completed SUCCESS13:25:41UTC, attempt1. Exact final summary:\nTest Suites: 362 passed, 362 total\nTests:       5508 passed, 5508 total\n\nAll362 PASS paths equal the frozen inventory, zero skips/failures/pending. Candidate and supported baseline48d0e52 actualDocker builds, real disposable Docker boundary and readiness acceptance all PASS. Closed originalZIP/log/API/hash evidence: '+evidence+'. Your accepted scope6145765510 is satisfied: only server test script differs from9ae02; all51 prior paths/config/setup/assertions/CI8GBheap unchanged, one recyclable worker; noGC or production changes.\n\nLF and SPA findings resolved; app.js equals main. Prior local362/5508 combined coverage remains honestly pinnedc56414a; old failed/incomplete runs remain retained. Client build/14baseline lint warnings, desktop/mobile hierarchy,100x50mmlabel and actualChromium40keyboard evidence remain linked in PR. Scoped/named immutable containers, historical attempt preservation and active same-sample aliquot guards remain, with207/208 and reserved-attempt UI follow-up deferred as described.\n\nOne ready-for-audit label/comment posted on PR295; comment ID will accompany this handoff. Please give your final audit verdict for this exact head. No merge/new release/kit/gate/production operation, and #206 remainsOPEN for your actual post-deploy closure. Human #103 clarification/cards/drafts untouched.\n'
destination.mkdir()
(destination/'pr-before-raw.json').write_bytes(before)
(destination/'pr-body-full-ci.md').write_bytes((original+result_text).encode('utf-8'))
(destination/'audit-comment.md').write_bytes(comment.encode('utf-8'))
(destination/'audit-comment-request.json').write_bytes(json.dumps({'body':comment}).encode('utf-8'))
(destination/'audit-label-request.json').write_bytes(json.dumps({'labels':['ready-for-audit']}).encode('utf-8'))
body_result = gh('pr','edit','295','--repo','yigini/soilfer-lims','--body-file',str(destination/'pr-body-full-ci.md'))
(destination/'body-edit-response.txt').write_bytes(body_result)
labels = gh('api','repos/yigini/soilfer-lims/issues/295/labels','--method','POST','--input',str(destination/'audit-label-request.json'))
(destination/'label-response-raw.json').write_bytes(labels)
posted = gh('api','repos/yigini/soilfer-lims/issues/295/comments','--method','POST','--input',str(destination/'audit-comment-request.json'))
(destination/'comment-response-raw.json').write_bytes(posted)
response = json.loads(posted)
native = native.replace('comment ID will accompany this handoff.', 'comment '+str(response['id'])+' ('+response['html_url']+').')
(destination/'native-handoff.txt').write_bytes(native.encode('utf-8'))
after = gh('pr','view','295','--repo','yigini/soilfer-lims','--json',
           'state,headRefOid,baseRefOid,body,labels,comments,closingIssuesReferences')
(destination/'pr-after-raw.json').write_bytes(after)
current = json.loads(after)
assert current['headRefOid']==head and current['baseRefOid']==base and current['state']=='OPEN'
assert current['closingIssuesReferences']==[] and current['body']==original+result_text
assert any(label['name']=='ready-for-audit' for label in current['labels'])
assert sum(c['id']==response['node_id'] or c.get('url')==response['html_url'] for c in current['comments'])==1
record = dict(observedUtc=datetime.datetime.now(datetime.UTC).isoformat(),pr=295,issue=206,
    head=head,base=base,ci=38400174689,ciConclusion='success',evidenceAudit=audit,
    rawGitBlobHashesVerified=len(pin['files']),readyForAudit=True,commentId=response['id'],
    commentUrl=response['html_url'],finalNativeHandoff=False,actualFinalAuditPass=False,
    closingIssuesReferences=[],productionMutations=0,files={})
for path in destination.iterdir():
    data=path.read_bytes()
    record['files'][path.name]=dict(bytes=len(data),sha256=hashlib.sha256(data).hexdigest())
(destination/'index.json').write_bytes((json.dumps(record,indent=2)+'\n').encode('utf-8'))
paths=[str(p.relative_to(root)).replace('\\','/') for p in destination.iterdir()]
paths.append(str(Path(__file__).relative_to(root)).replace('\\','/'))
subprocess.check_call(['git','add','-f','--',*paths],cwd=root)
for name,pin in record['files'].items():
    relative=str((destination/name).relative_to(root)).replace('\\','/')
    assert hashlib.sha256(command('git','show',':'+relative)).hexdigest()==pin['sha256']
assert set(command('git','diff','--cached','--name-only').decode().splitlines())==set(paths)
print(json.dumps({k:v for k,v in record.items() if k!='files'},indent=2))
