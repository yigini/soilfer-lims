"""Complete the prepared exact publication after a Windows path-length refusal."""
import datetime,hashlib,json,pathlib,subprocess
R=pathlib.Path(__file__).resolve().parents[2];D=R/'WP/startup-order-readiness-20261015';BASE='787aa5692996a108120b510efa0154d7a74da85e'
def cmd(*args):return subprocess.check_output(['git','-c','core.longpaths=true',*args],cwd=R,stderr=subprocess.PIPE)
def binding(file):
    value=file.read_bytes();return {'path':file.relative_to(R).as_posix(),'length':len(value),'sha256':hashlib.sha256(value).hexdigest(),
        'gitBlobOid':hashlib.sha1(('blob '+str(len(value))+'\0').encode()+value).hexdigest()}
assert cmd('rev-parse','HEAD').decode().strip()==BASE and cmd('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==BASE
prior=D/'private-context-closed-guards-pinned-copy-publication-index.json';index=json.loads(prior.read_bytes())
assert index['focusedSummary']['status']=='PASS' and index['focusedSummary']['passed']==167
frozen=json.loads((D/'retained-copy-validation-focused-once/source-after.json').read_bytes())
assert all(hashlib.sha256((R/n).read_bytes()).hexdigest()==v for n,v in frozen.items())
allowed={row['path'] for row in index['files']}|{prior.relative_to(R).as_posix()}
staged=set(cmd('diff','--cached','--name-only').decode().splitlines());assert staged and staged<=allowed
for row in index['files']:assert binding(R/row['path'])==row
record=D/'closed-guard-publication-longpath-refusal-tool-transcription.json';assert not record.exists()
record.write_text(json.dumps({'recordedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'kind':'TOOL_OUTPUT_TRANSCRIPTION_NOT_ORIGINAL_RAW_PROCESS_CAPTURE',
    'consumedHelper':'publish-startup-closed-guard-and-pinned-copy-source-once.py','exitCode':1,
    'boundary':'git show while verifying staged tree 35b97afcd6e39ba4b373d8a2d6dc27268916d839 before commit/push',
    'freshReadonlyDiagnostic':{'exitCode':128,'stdoutLength':0,'stderr':"fatal: failed to stat '35b97afcd6e39ba4b373d8a2d6dc27268916d839:WP/startup-order-readiness-20261015/retained-copy-validation-source-successor-once/source-before/server/tests/contracts/startup_readiness_context.test.js': Filename too long\n"},
    'allPreparedPathsExistInIndex':True,'perCommandLongpathsOptionSucceeds':True,
    'noSourceOrEvidenceRewrittenAndNoGlobalGitSettingChange':True,'originalPublisherNeverReplayed':True},indent=2),encoding='utf-8')
paths=[R/row['path'] for row in index['files']]+[prior,record,pathlib.Path(__file__)]
complete=D/'private-context-closed-guards-pinned-copy-complete-publication-index.json';assert not complete.exists()
complete.write_text(json.dumps({'status':'CORRECTED_SOURCE_FOCUSED167PASS_FULL_STILL_REQUIRED',
    'baseAudit':BASE,'predecessorPreparedIndex':binding(prior),'appPaths':index['appPaths'],'focusedSummary':index['focusedSummary'],
    'stockTestsUnchanged':371,'originalFullFailedResultRetained':True,'expectedNewFullSuites':373,'expectedNewFullTests':5679,
    'files':[binding(p) for p in paths],'productionOperations':0},indent=2),encoding='utf-8');paths.append(complete)
new=[record,pathlib.Path(__file__),complete]
cmd('-c','core.autocrlf=false','add','-f','--',*[p.relative_to(R).as_posix() for p in new])
assert set(cmd('diff','--cached','--name-only').decode().splitlines())<=set(p.relative_to(R).as_posix() for p in paths)
tree=cmd('write-tree').decode().strip()
for file in paths:
    n=file.relative_to(R).as_posix();value=cmd('show',tree+':'+n);oid=cmd('rev-parse',tree+':'+n).decode().strip()
    assert value==file.read_bytes() and hashlib.sha1(('blob '+str(len(value))+'\0').encode()+value).hexdigest()==oid
assert all(hashlib.sha256((R/n).read_bytes()).hexdigest()==v for n,v in frozen.items())
cmd('commit','-m','Fix opt-in startup context compatibility and pinned snapshot reuse')
head=cmd('rev-parse','HEAD').decode().strip();cmd('push','origin','audit/release-eb6de2e8')
assert cmd('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head
print(json.dumps({'head':head,'rawVerifiedOwnedBlobs':len(paths),'appPaths':len(index['appPaths']),'focusedPassed':167,'stockTestsUnchanged':371}))
