"""Record an actual read-only native boundary; do not overwrite a human draft."""
import datetime,hashlib,json,subprocess,sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf-8')
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent
dest=wp/'issue214-native-human-draft-policy-scope-boundary'
assert not dest.exists()
def git(*args,binary=False):
 r=subprocess.run(['git',*args],cwd=root,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
 if r.returncode:raise RuntimeError(r.stderr.decode('utf-8','replace'))
 return r.stdout if binary else r.stdout.decode('utf-8').strip()
assert git('rev-parse','HEAD')=='fec2118aa7432970ad9e772ea404b85da053b091'
assert git('branch','--show-current')=='audit/release-eb6de2e8' and not git('diff','--cached','--name-only')
frozen=json.loads((wp/'issue214-scanner-call-form-full/source-before.json').read_bytes())
assert len(frozen)==415 and all(hashlib.sha256((root/p).read_bytes()).hexdigest()==d for p,d in frozen.items())
record={'recordedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'observedBoundaryUtc':'2026-10-13T21:57Z',
 'app':'Claude_pzs8sxrjxfjjc!Claude','window':3408874,'workspace':'LIMS Audit',
 'rightThread':'Lab workflow audit and plan','freshWindowReturned':True,
 'firstCapture':'Window minimized','recovery':'One activation, fresh get_window and actual state capture',
 'rightComposerHumanDraft':'n','centralComposerEmpty':True,'centralHumanModelMenuOpen':True,
 'typingNavigationOrMessageInputs':0,'nativeFailureBoundarySent':False,
 'reason':'Preserve the actual human right-composer draft and open model menu. GitHub question is already posted once.',
 'central103HumanChoiceObserved':'see the list','centralClaudioAcknowledgement':'Nothing changes in production until YY has seen the full list; Pip read-only check is passed to the audit thread.',
 '103ApplyGo':False,'103ProductionConnection':False,'scopeQuestionComment':6156034087,
 'scopeQuestionAnswer':'PENDING','ciRun':38467368095,'ciOverall':'FAILED','sourceUnchanged':True,
 'productionOperations':0}
dest.mkdir();path=dest/'native-readonly-record.json';path.write_bytes((json.dumps(record,indent=2)+'\n').encode())
lead=('## 2026-10-13 #214 policy schema-owner question posted once; native human draft preserved\n\n'
 'Actual CI38467368095 is CLOSED FAILED despite365/5547 server PASS and both actual Docker builds/boundary PASS. '
 'Readiness fails the genuine supported-baseline/PRE_199 copy at214 because policy prerequisites are absent. '
 'Claudio question6156034087 was posted ONCE at21:56:11UTC, with closed originals and an explicitly owned '
 'zero-write reproduction; proposed correction reuses canonical policy migrationfa6ef0563f80704dbc4ee08d90ceae91f632c912813ca037221b02aa03ef7b70 '
 'through a guarded prerequisite owner. Actual schema-ownership direction is PENDING; no source/new head/CI correction yet. '
 'Original PR296/e47b/current main6d and original PR body remain unchanged. Never retry the failed CI or consumed helpers. '
 'The unused original green-CI audit request helper is bound to the failed run and MUST NOT execute; use new unique successors '
 'only after accepted scope/new source/full verification/actual green CI.\n\n'
 'Fresh native boundary21:57 returned actual Claude3408874/LIMS Audit/Lab workflow audit and plan after one minimized-window '
 'recovery. The right composer contains human draft "n" and the central human model menu is open. NO typing/navigation/message '
 'was attempted; preserve both. Native failure/scope acknowledgement is UNSENT; if still needed later, use a fresh actual '
 'target/focus/empty-draft observation and deliver once. Do not repeat the GitHub question or old progress acknowledgements. '
 'Actual central YY "see the list" and Claudio acknowledgement were observed for103; this is NO APPLY GO, and no103 '
 'production connection/collection occurred. Human files/drafts/cards remain untouched. '
 'Current records: `WP/backlog-resume-20261013/issue214-ci-policy-owner-scope-boundary/posted-record.json` and '
 '`WP/backlog-resume-20261013/issue214-native-human-draft-policy-scope-boundary/native-readonly-record.json`. '
 'Same worktree/writer/branch; no ready notice/final audit handoff/PASS/merge/kit/gate/production operation.\n\n')
readmes=['WP/audit-release-eb6de2e8/README.md','WP/runtime-recovery-kobo/README.md']
for p in readmes:(root/p).write_bytes(lead.encode()+(root/p).read_bytes())
owned=[path.relative_to(root).as_posix(),Path(__file__).relative_to(root).as_posix()]
pins={p:hashlib.sha256((root/p).read_bytes()).hexdigest() for p in owned}
git('add','-f','--',*owned,*readmes)
assert set(git('diff','--cached','--name-only').splitlines())<=set(owned+readmes)
git('commit','-m','Retain actual human-draft boundary and pending policy owner direction')
head=git('rev-parse','HEAD')
for p,d in pins.items():assert hashlib.sha256(git('show',head+':'+p,binary=True)).hexdigest()==d,p
git('push','origin','HEAD:refs/heads/audit/release-eb6de2e8')
assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').split()[0]==head
print(json.dumps({'auditCommit':head,'nativeFailureBoundarySent':False,'humanDraftPreserved':True,
 'scopeQuestion':6156034087,'answer':'PENDING','sourceUnchanged':True,'productionOperations':0}))
