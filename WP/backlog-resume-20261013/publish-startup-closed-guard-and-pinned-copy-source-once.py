"""Publish exact corrected source and all closed successor results, never an active log."""
import datetime,hashlib,json,pathlib,subprocess
R=pathlib.Path(__file__).resolve().parents[2];D=R/'WP/startup-order-readiness-20261015';W=R/'WP/backlog-resume-20261013'
BASE='787aa5692996a108120b510efa0154d7a74da85e'
def cmd(*args):return subprocess.check_output(args,cwd=R,stderr=subprocess.PIPE)
def sha(value):return hashlib.sha256(value).hexdigest()
assert cmd('git','rev-parse','HEAD').decode().strip()==BASE and not cmd('git','diff','--cached','--name-only').strip()
assert cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==BASE
focused=json.loads((D/'retained-copy-validation-focused-once/summary.json').read_bytes())
assert focused['status']=='PASS' and focused['passed']==focused['tests']==167 and focused['sourceUnchanged'] and focused['exactInventory']
frozen=json.loads((D/'retained-copy-validation-focused-once/source-after.json').read_bytes())
assert all(sha((R/n).read_bytes())==v for n,v in frozen.items())
original=json.loads((D/'full-ordinary-once/source-before.json').read_bytes())
newTests={'server/tests/contracts/startup_readiness_context.test.js','server/tests/contracts/order_revision_impact_set_query.test.js'}
stock={n:v for n,v in original.items() if n.startswith('server/tests/') and n.endswith('.test.js') and n not in newTests}
assert len(stock)==371 and all(sha((R/n).read_bytes())==v for n,v in stock.items())
app=json.loads((D/'private-context-focused-and-full-open-publication-index.json').read_bytes())['appPaths']+[
    'server/tests/helpers/startupImpactFixture.js','server/tests/helpers/workflowWriteScanner.js']
assert len(app)==len(set(app))==36
folders=['closed-guard-source-successor-once','closed-owned-fixture-successor-once','visible-guards-and-races-preparation-once',
    'closed-guard-wal-race-focused-once','pinned-policy-alias-source-successor-once','pinned-policy-alias-focused-once',
    'retained-copy-validation-source-successor-once','retained-copy-validation-focused-once']
helpers=['prepare-startup-context-closed-guard-successor-once.py','prepare-startup-closed-owned-fixture-successor-once.py',
    'prepare-startup-context-visible-guards-and-races-once.py','verify-startup-closed-guard-wal-race-focused-once.py',
    'prepare-startup-pinned-policy-alias-successor-once.py','verify-startup-pinned-policy-alias-focused-once.py',
    'prepare-startup-retained-copy-validation-successor-once.py','verify-startup-retained-copy-validation-focused-once.py',
    pathlib.Path(__file__).name]
paths=[R/n for n in app]+[W/n for n in helpers]
for folder in folders:
    paths.extend(p for p in (D/folder).rglob('*') if p.is_file())
fullRecord=json.loads((D/'full-ordinary-closed-terminal-once/closed-result-and-all-failures-parsed-derived.json').read_bytes())
findings=fullRecord['scannerFindingsParsedDerivedFromFullClosedStderr'];unique={json.dumps(row,sort_keys=True):row for row in findings}
assert len(findings)==24 and len(unique)==12
dedup=D/'full-closed-findings-unique-parsed-derived.json';assert not dedup.exists()
dedup.write_text(json.dumps({'source':'full-ordinary-once/stderr-original.log','occurrences':24,'uniqueFindings':list(unique.values()),
    'twelveFindingsRepeatedInJestFailureSummary':True,'originalsUntouched':True},indent=2),encoding='utf-8');paths.append(dedup)
stockFile=D/'closed-successor-original-test-hashes-unchanged.json';assert not stockFile.exists()
stockFile.write_text(json.dumps(stock,indent=2),encoding='utf-8');paths.append(stockFile)
report=json.loads((D/'retained-copy-validation-focused-once/report-original.json').read_bytes())
context=[row for row in report['testResults'] if row['name'].endswith('startup_readiness_context.test.js')][0]
cases=context['assertionResults'];wal=[row['fullName'] for row in cases if 'owned WAL-mode' in row['fullName']];assert len(wal)==3
readme=R/'WP/audit-release-eb6de2e8/README.md'
lead='''## 2026-10-15 corrected opt-in context / CLOSED focused167 PASS / new full still required

Original full session76923 CLOSED11:44:21.283845UTC FAILED373suites5672tests:371suites5670testsPASS/2failed/0pending/exactinventory/all1332 frozeninputs unchanged. Complete original report/logs/exit/source-before+after retained and raw-Git-verified in787aa569; never retry or overwrite. Closed stderr repeats12unique scanner findings twice (24occurrences), now separately deduplicated without changing originals. Fresh isolated owned CLI diagnostic confirms missing new top-level context module before JSON catch, not an original-child-stderr claim. All26 installers now lazy-require context only for explicit opt-in; default reader uses its original newDatabase path. Context uses literal integrity/FK SQL/private cached full rows and ordinary prepared-method binding. New impact fixture is a digest-bound closed in-memory builder, exact caller + declared cases, no file/SQL/connection/callback inputs; passive SQLite execution trace replaces SQL forwarding. Existing scanner predicates/negative assertions unchanged; only this narrow test-only binding added with new negative guards.

First new focused5suites166tests CLOSED165PASS/1FAIL reproduced earlier original-file race after order policy capture: legacy ORDER_REVISION_SNAPSHOT_CHANGED versus context path-ownership TypeError. All3 actual owned WAL-mode absent/empty/nonempty-idle-writer cases PASS; no WAL normalization fix was needed. Corrected nested chart/policy uses the SAME pinned copy as legacy, validates copy aliases and migration source, keeps final ORIGINAL order hash guard and every original copy/hash/race/refusal branch. Next focused166/166PASS. Additional owned retained-copy byte canary now validates full copy hashes before original or alias cache reuse, invalidates SQL/chart caches on changed copy, and leaves original unchanged. Final ordinary5suites167/167PASS0failpending/exactinventory/all963frozenpaths unchanged, both ordinary setups/stock assertions/oneworker512000000/blankNODE_OPTIONS; all371 original test sources unchanged. Context20 + telemetry4 + impact6 and both formerly failing stock suites pass. Existing209/chart/policy tests unchanged. Full corrected373/5679 remains required before source-only PR readiness; focused PASS is not CI/startup qualification. No appPR/newCI/build/proof/deploy/productionSQL/cleanup replay. Historical failed source/runs and all science/refusal/600/805306368/forward-only/no103 guards preserved.

'''
readme.write_bytes(lead.encode()+readme.read_bytes());paths.append(readme)
paths=sorted(set(paths))
bindings=[]
for file in paths:
    value=file.read_bytes();bindings.append({'path':file.relative_to(R).as_posix(),'length':len(value),'sha256':sha(value),
        'gitBlobOid':hashlib.sha1(('blob '+str(len(value))+'\0').encode()+value).hexdigest()})
index=D/'private-context-closed-guards-pinned-copy-publication-index.json';assert not index.exists()
index.write_text(json.dumps({'status':'CORRECTED_SOURCE_FOCUSED167PASS_FULL_STILL_REQUIRED','publishedPreparationUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'baseAudit':BASE,'scopeDirection':6189025975,'appPaths':app,'focusedSummary':focused,'originalStockTestPathsUnchanged':371,
    'priorClosedFullSummary':fullRecord['actualSummary'],'actualWalCases':wal,'expectedCorrectedFullSuites':373,'expectedCorrectedFullTests':5679,
    'noAppPrCiBuildProofQualification':True,'files':bindings,'productionOperations':0},indent=2),encoding='utf-8');paths.append(index)
names=[p.relative_to(R).as_posix() for p in paths]
cmd('git','-c','core.autocrlf=false','add','-f','--',*names)
staged=set(cmd('git','diff','--cached','--name-only').decode().splitlines());assert staged and staged<=set(names)
tree=cmd('git','write-tree').decode().strip()
for p,n in zip(paths,names):
    value=cmd('git','show',tree+':'+n);oid=cmd('git','rev-parse',tree+':'+n).decode().strip();assert value==p.read_bytes() and hashlib.sha1(('blob '+str(len(value))+'\0').encode()+value).hexdigest()==oid
assert all(sha((R/n).read_bytes())==v for n,v in frozen.items())
cmd('git','commit','-m','Fix opt-in startup context guard compatibility and pinned snapshot reuse')
head=cmd('git','rev-parse','HEAD').decode().strip();cmd('git','push','origin','audit/release-eb6de2e8');assert cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head
print(json.dumps({'head':head,'rawVerifiedOwnedBlobs':len(paths),'appPaths':len(app),'focused':focused,'stockTestsUnchanged':len(stock)}))
