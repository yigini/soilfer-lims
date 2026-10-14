"""Complete the prepared source publication after the honest ignored-evidence refusal."""
import datetime, hashlib, json, pathlib, subprocess

REPO=pathlib.Path(__file__).resolve().parents[2]
OWNED=REPO/'WP/batch-release-cde8-20261014'
def cmd(*args):return subprocess.check_output(args,cwd=REPO)
assert cmd('git','rev-parse','HEAD').decode().strip()=='6e4ec5a5ce7fc52a55e175d44213dd75f57f1733'
assert cmd('git','branch','--show-current').decode().strip()=='audit/release-eb6de2e8'
index=json.loads((OWNED/'build-source-publication-index.json').read_bytes())
expected={v['path']:v for v in index['files']}
expected['WP/batch-release-cde8-20261014/build-source-publication-index.json']={'sha256':hashlib.sha256((OWNED/'build-source-publication-index.json').read_bytes()).hexdigest()}
staged=set(cmd('git','diff','--cached','--name-only').decode().splitlines())
assert staged and staged<=set(expected), 'Unexpected staged owner'
for name,row in expected.items():assert hashlib.sha256((REPO/name).read_bytes()).hexdigest()==row['sha256'],name
record=OWNED/'source-publication-ignored-evidence-refusal.json'
with record.open('x',encoding='utf-8') as f:json.dump({'status':'PUBLICATION_REFUSED_BEFORE_COMMIT_OR_PUSH','evidenceKind':'TOOL_OUTPUT_TRANSCRIPTION','literalError':'The following paths are ignored by one of your .gitignore files:','commandExitCode':1,'consumedHelper':'WP/backlog-resume-20261013/publish-batch-cde8-build-source-review-once.py','partialStagingPreserved':True,'sourceUnchanged':True,'remoteMutations':0,'productionConnections':0,'dockerOperations':0,'buildsLaunched':0,'resolution':'Explicitly force-add only the prehashed owned source and immutable raw evidence in this unique completion'},f,indent=2)
paths=list(expected)+[record.relative_to(REPO).as_posix(),pathlib.Path(__file__).relative_to(REPO).as_posix()]
cmd('git','-c','core.autocrlf=false','add','-f','--',*paths)
assert set(cmd('git','diff','--cached','--name-only').decode().splitlines())==set(paths)
for name in paths:assert cmd('git','show',':'+name)==(REPO/name).read_bytes(),name
cmd('git','commit','-m','Prepare source-bound build-only batch package and retain guard proofs')
head=cmd('git','rev-parse','HEAD').decode().strip()
for name in paths:assert cmd('git','show',head+':'+name)==(REPO/name).read_bytes(),name
cmd('git','push','origin','audit/release-eb6de2e8')
assert cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head
print(json.dumps({'status':'PUSHED_NEW_BUILD_ONLY_SOURCE_REVIEW_READY','head':head,'verifiedBlobs':len(paths),'closedGuardCount':14,'archiveGitBlobs':1561,'newSourceApproval':None,'productionOperations':0,'closedUtc':datetime.datetime.now(datetime.UTC).isoformat()}))
