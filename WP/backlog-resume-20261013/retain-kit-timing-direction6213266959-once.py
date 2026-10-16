"""Retain the actual timing answer and current authority, without host calls."""
import sys
sys.dont_write_bytecode=True
from prechecks6210209468_evidence import *
K=W/'WP/batch-release-kit-be837974-20261016'
D=K/'actual-timing-direction6213266959-once'
assert not D.exists()
endpoints=['repos/yigini/soilfer-lims/issues/comments/6213266959',
           'repos/yigini/soilfer-lims/issues/comments/6213148920',
           'repos/yigini/soilfer-lims/git/ref/heads/main',
           'repos/yigini/soilfer-lims/actions/runs/38772398721',
           'repos/yigini/soilfer-lims/issues/191',
           'repos/yigini/soilfer-lims/issues/162/comments?since=2026-10-16T10%3A08%3A26Z&per_page=100']
raws=[subprocess.check_output(['gh','api',x],cwd=W) for x in endpoints]
answer,question,main,ci,issue,context=map(json.loads,raws)
assert answer['id']==6213266959 and answer['created_at']==answer['updated_at']=='2026-10-16T10:15:47Z'
assert answer['performed_via_github_app']['id']==1236702 and answer['performed_via_github_app']['slug']=='claude'
assert answer['body'].splitlines()[0]=='Timing pin for the be837974 kit: disclose the real whole outage and gate it. The 600 s readiness deadline stays.'
assert all(s in answer['body'] for s in ['both as withdrawn','before the first APPLY starts','still hash-equal the backup','No automatic restart once any APPLY has started','Don\'t start a performance change first','Main stays on merge hold'])
assert question['body']==json.loads((K/'whole-outage-timing-question-once/request.json').read_bytes())['body']
assert main['object']['sha']==ci['head_sha']=='be8379745bdfae52ce46496ff26514dc7d729640' and ci['run_attempt']==1 and ci['status']=='completed' and ci['conclusion']=='success' and issue['state']=='closed'
later=[c for c in context if c['id']>answer['id'] and (c.get('performed_via_github_app') or {}).get('id')==1236702]
assert not later,'Read full later direction before retaining current scope'
D.mkdir()
for i,raw in enumerate(raws):save(D,'api-original-'+str(i)+'.json',raw)
save(D,'actual-answer-readable.txt',answer['body'].encode())
projection={k:answer[k] for k in ('id','body','created_at','updated_at')};projection['app']={k:answer['performed_via_github_app'][k] for k in ('id','slug')}
save(D,'semantic-projection.json',canonical(projection)+b'\n')
record={'observedUtc':utc(),'commentId':answer['id'],'createdUtc':answer['created_at'],
        'bodySha256':sha(answer['body'].encode()),'semanticSha256':sha(canonical(projection)),
        'question6213148920Answered':True,'nativeFallback102825CancelledForever':True,
        'qualificationAcceptance6212990400UnchangedExceptWithdrawnTimingShorthand':True,
        'actualWholeOutageDisclosedAndFreshGateRequired':True,'candidateReadinessSeconds':600,
        'keepDryApplyRepeatAndPreservation':True,'noNewKillPointsInsideInstallerTransaction':True,
        'preApplyPredecessorRecoveryOnlyWithExactFullTripleBackupHashEquality':True,
        'afterAnyApplyOrUnknownApplyOutcomeForwardHoldOnly':True,'hostCalls':0,'deployment':False}
save(D,'direction-record.json',canonical(record)+b'\n');print(json.dumps(record))
