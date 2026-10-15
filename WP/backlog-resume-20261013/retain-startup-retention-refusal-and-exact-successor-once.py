"""Retain zero-test local setup refusal; prepare a separately pinned local-only successor."""
import datetime,hashlib,json,os,pathlib,subprocess
R=pathlib.Path(__file__).resolve().parents[2];D=R/'WP/startup-order-readiness-20261015';W=R/'WP/backlog-resume-20261013'
F=D/'full-guard-pinned-copy-ordinary-once';O=D/'full-retention-refusal-closed-once';BASE='7611ae485d1a29818d62fb53c32825abaac409f1'
def git(*args):return subprocess.check_output(['git','-c','core.longpaths=true',*args],cwd=R,stderr=subprocess.PIPE)
def sha(value):return hashlib.sha256(value).hexdigest()
assert not O.exists() and git('rev-parse','HEAD').decode().strip()==BASE and not git('diff','--cached','--name-only').strip()
summary=json.loads((F/'summary.json').read_bytes());report=json.loads((F/'report-original.json').read_bytes())
assert summary['closedUtc']=='2026-10-15T12:01:03.109616+00:00' and summary['tests']==0 and summary['sourceUnchanged'] and summary['exactInventory']
assert report['numFailedTestSuites']==report['numRuntimeErrorTestSuites']==373
assert all(not row['assertionResults'] and 'Local physical retention requires the owned evidence directory.' in row['message'] for row in report['testResults'])
before=json.loads((F/'source-before.json').read_bytes());assert len(before)==1333 and before==json.loads((F/'source-after.json').read_bytes())
assert all(sha((R/n).read_bytes())==v for n,v in before.items())
O.mkdir()
raw=subprocess.check_output(['gh','api','repos/yigini/soilfer-lims/issues/comments/6191219093'],cwd=R);comment=json.loads(raw)
assert comment['id']==6191219093 and comment['performed_via_github_app']['slug']=='claude' and 'no proof DB copy is removed under R1' in comment['body']
(O/'actual-cleanup-compliance-6191219093-original.json').write_bytes(raw)
(O/'actual-cleanup-compliance-6191219093-readable.txt').write_text(comment['body'],encoding='utf-8')
newRoot='full-pinned-copy-retention-bound-ordinary-once'
setup=D/'local-owned-pinned-copy-retention-bound.setup.cjs';assert not setup.exists()
oldSetup=(D/'local-owned-physical-retention.setup.cjs').read_bytes()
assert oldSetup.count(b'full-ordinary-once')==1
setup.write_bytes(oldSetup.replace(b'full-ordinary-once',newRoot.encode()))
assert setup.read_bytes().replace(newRoot.encode(),b'full-ordinary-once')==oldSetup
preflights=[]
for name,nodeEnv,ledger,expected in [('valid','test',D/newRoot/'physical-retention-original.jsonl',0),
    ('wrong-root','test',D/'full-ordinary-once/physical-retention-original.jsonl',1),
    ('wrong-environment','production',D/newRoot/'physical-retention-original.jsonl',1)]:
    env=dict(os.environ);env['NODE_ENV']=nodeEnv;env['LIMS_OWNED_RETENTION_LEDGER']=str(ledger)
    argv=['node','-e','require(process.argv[1])',str(setup)]
    with (O/(name+'-preflight-stdout-original.log')).open('xb') as out,(O/(name+'-preflight-stderr-original.log')).open('xb') as err:
        p=subprocess.run(argv,cwd=R/'server',env=env,stdout=out,stderr=err)
    assert p.returncode==expected
    preflights.append({'name':name,'argv':argv,'NODE_ENV':nodeEnv,'ledger':str(ledger),'exitCode':p.returncode})
runner=W/'verify-startup-pinned-copy-retention-bound-full-ordinary-once.py';assert not runner.exists()
text=(W/'verify-startup-guard-pinned-copy-full-ordinary-once.py').read_text(encoding='utf-8')
text=text.replace('full-guard-pinned-copy-ordinary-once',newRoot).replace('local-owned-physical-retention.setup.cjs',setup.name)
runner.write_bytes(text.encode())
record={'status':'CLOSED_LOCAL_SETUP_REFUSAL_ZERO_TESTS_NOT_APPLICATION_TEST_FAILURE','retainedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'session':12570,'actualSummary':summary,'runtimeErrorSuites':373,'executedTests':0,'all1333SourceHashesUnchanged':True,
    'cause':'New runner evidence root was not the original local retention setup exact directory pin. Setup refused before test bodies.',
    'noOriginalSetupOrAppSourceEdited':True,'newSetupOnlyChange':'One exact owned ledger directory prefix; all retention scopes/guards/assertions byte-identical.',
    'newSetupPreflights':preflights,'newRunnerPreparedNotExecuted':runner.relative_to(R).as_posix(),
    'consumedOpeningPublisher':'publish-startup-corrected-full-open-and-cleanup-review-once.py',
    'openingPublisherRefusal':{'kind':'TOOL_OUTPUT_TRANSCRIPTION','exitCode':1,'boundary':'First assertion before output directory creation because SAME full run had already closed. No opening evidence published.'},
    'actualClaudioReview':6191219093,'nativeReadNotClaimed':True,'r1NoProofDbCopyRemovedPendingYY':True,'productionOperations':0}
(O/'closed-refusal-and-exact-successor.json').write_text(json.dumps(record,indent=2),encoding='utf-8')
paths=sorted(p for p in F.iterdir() if p.is_file())+sorted(p for p in O.iterdir() if p.is_file())+[setup,runner,pathlib.Path(__file__),
    W/'prepare-startup-guard-pinned-copy-full-runner-once.py',W/'verify-startup-guard-pinned-copy-full-ordinary-once.py',
    W/'publish-startup-corrected-full-open-and-cleanup-review-once.py']
readme=R/'WP/audit-release-eb6de2e8/README.md'
lead='''## 2026-10-15 corrected full local setup REFUSED before tests / exact new successor prepared

App source7611ae48/focused167PASS remains unchanged. Full session12570 CLOSED12:01:03.109616UTC exit1:373runtime-error suites, ZERO tests executed. All1333 frozen inputs unchanged/exactinventory. Actual cause: LOCAL physical-retention setup remains pinned to original full-ordinary-once directory, so the new evidence directory was correctly refused before test bodies. No application/full PASS inferred. Complete original report/logs/exit/source-before+after retained; no replay. Opening publisher first assertion refused after that run had already closed, before creating opening outputs; consumed/refusal transcription retained. New LOCAL setup copy changes ONLY one exact future ledger-directory prefix, preserving original bytes/retention scope/stock assertions; valid new directory PASS, old directory REFUSED, non-test environment REFUSED in separately retained real Node preflights. New verify-startup-pinned-copy-retention-bound-full-ordinary-once.py prepared but not yet executed, target full-pinned-copy-retention-bound-ordinary-once373/5679. Existing setups and every app source unchanged. Original full76923 actual2testfailures/closed787aa569 and focused165/166 failure plus166/166 and167/167 successes remain immutable.

Actual FULL GitHub-app Claudio review6191219093/11:42:12UTC retained: cleanup receipt complies; R2 max-used-space5GB cap accepted with shared/in-use protection; R1 requires actual verified copy elsewhere and explicitly NO proof DB copy removal pending YY; R4 fresh image-bound computed requirement+10GB before each build/proof. Native read not claimed/no other-project interruption/no duplicate cleanup receipt/ACK/replay. No appPR/newCI/build/proof/deploy/productionSQL/no103. All science/refusal/600/805306368/forward-only/history guards hold.

'''
readme.write_bytes(lead.encode()+readme.read_bytes());paths.append(readme)
bindings=[]
for p in paths:
    value=p.read_bytes();bindings.append({'path':p.relative_to(R).as_posix(),'length':len(value),'sha256':sha(value),
        'gitBlobOid':hashlib.sha1(('blob '+str(len(value))+'\0').encode()+value).hexdigest()})
index=O/'publication-index.json';index.write_text(json.dumps({'baseAudit':BASE,'status':'ZERO_TEST_SETUP_REFUSAL_RETAINED_NEW_EXACT_SUCCESSOR_UNEXECUTED',
    'actualSummary':summary,'appSourceUnchanged':True,'files':bindings,'productionOperations':0},indent=2),encoding='utf-8');paths.append(index)
names=[p.relative_to(R).as_posix() for p in paths];git('-c','core.autocrlf=false','add','-f','--',*names)
assert set(git('diff','--cached','--name-only').decode().splitlines())<=set(names)
tree=git('write-tree').decode().strip()
for p,n in zip(paths,names):
    value=git('show',tree+':'+n);oid=git('rev-parse',tree+':'+n).decode().strip();assert value==p.read_bytes() and hashlib.sha1(('blob '+str(len(value))+'\0').encode()+value).hexdigest()==oid
assert all(sha((R/n).read_bytes())==v for n,v in before.items())
git('commit','-m','Retain zero-test local retention refusal and bind a new exact full-suite setup')
head=git('rev-parse','HEAD').decode().strip();git('push','origin','audit/release-eb6de2e8');assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head
print(json.dumps({'head':head,'rawVerifiedOwnedBlobs':len(paths),'executedTests':0,'newSetupPreflights':[x['exitCode'] for x in preflights],'newRunnerPrepared':runner.relative_to(R).as_posix()}))
