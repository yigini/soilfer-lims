"""One meaningful source-progress note, not a final audit/merge/build/proof request."""
import datetime,hashlib,json,pathlib,re,subprocess
R=pathlib.Path(__file__).resolve().parents[2];D=R/'WP/startup-order-readiness-20261015';O=D/'corrected-source-progress-7611-once';F=D/'full-pinned-copy-retention-bound-ordinary-once'
BASE='8f081b5b7a1eb816bd29109500656776bfcb555d';MARKER='startup-context-7611-focused167-full29474'
def git(*args):return subprocess.check_output(['git','-c','core.longpaths=true',*args],cwd=R,stderr=subprocess.PIPE)
def sha(value):return hashlib.sha256(value).hexdigest()
assert not O.exists() and not (F/'summary.json').exists()
assert git('rev-parse','HEAD').decode().strip()==BASE and not git('diff','--cached','--name-only').strip()
frozen=json.loads((F/'source-before.json').read_bytes());assert all(sha((R/n).read_bytes())==v for n,v in frozen.items())
raw=subprocess.check_output(['gh','api','repos/yigini/soilfer-lims/issues/162/comments?since=2026-10-15T11:36:00Z&per_page=100'],cwd=R)
comments=json.loads(raw);assert len(comments)<100 and not any(MARKER in row['body'] for row in comments)
assert any(row['id']==6191219093 for row in comments)
oldInventory=json.loads((R/'WP/backlog-resume-20261013/issue209-full-classified-ordinary/inventory-original.json').read_bytes());assert len(oldInventory)==370
unchanged=json.loads((D/'closed-successor-original-test-hashes-unchanged.json').read_bytes())
relative={pathlib.Path(n).relative_to(R).as_posix() for n in oldInventory}
assert relative<=set(unchanged) and set(unchanged)-relative=={'server/tests/contracts/startup_readiness_telemetry.test.js'}
O.mkdir();(O/'gh162-before-original.json').write_bytes(raw)
body='''Startup performance draft progress — `startup-context-7611-focused167-full29474` (not final audit or runtime qualification).

The original full ordinary run closed with **371/373 suites, 5,670/5,672 tests passing; 2 failed, 0 pending**. All 1,332 frozen inputs were unchanged. Complete originals and failures are retained in commit [787aa569](https://github.com/yigini/soilfer-lims/commit/787aa5692996a108120b510efa0154d7a74da85e), `WP/startup-order-readiness-20261015/full-ordinary-once`.

Corrected source [7611ae48](https://github.com/yigini/soilfer-lims/commit/7611ae485d1a29818d62fb53c32825abaac409f1) now loads the context only on explicit opt-in in all26 installers. A new isolated diagnostic confirmed the prior top-level import broke the copied default CLI before its JSON catch. Runtime SQL checks are literal, cached privately; ordinary prepared-method binding keeps SQL at owning call sites. The synthetic impact builder is a digest-bound, memory-only helper with one exact test caller and negative guards. Existing scanner predicates/assertions remain unchanged.

An actual new earlier-order-race case first reproduced legacy `ORDER_REVISION_SNAPSHOT_CHANGED` versus the context's path-ownership error. Nested chart/policy now stays on the same captured copy, validates source/copy hashes, and preserves the final original-file guard. The failed successor and its before-bytes remain retained. All three owned WAL-mode cases passed (absent, empty, genuine nonempty WAL with an idle writer); no WAL normalization change was needed. A retained-copy byte canary also verifies cache invalidation.

Final ordinary focused result: **5 suites, 167/167 tests PASS**, no failed/pending, exact inventory/source hashes unchanged, both ordinary setups, one worker512000000, blank NODE_OPTIONS. This includes both originally failing stock suites. All370 preexisting current-main test files are unchanged; the371-file hash manifest additionally includes the unchanged new telemetry test.

One intermediate full successor correctly refused its local retention directory pin before any test bodies (373 runtime-error suites, **0 tests executed**); originals retained in [3b0460b8](https://github.com/yigini/soilfer-lims/commit/3b0460b803589f280721f8d7ccc1b72f4b2fa507). A new local setup copy changes only the exact evidence-directory pin, with valid/wrong-root/non-test preflights0/1/1. The genuinely new full ordinary run **session29474, 373 suites/expected5,679 tests** is now active on1,333 frozen inputs. Opening records: [8f081b5b](https://github.com/yigini/soilfer-lims/commit/8f081b5b7a1eb816bd29109500656776bfcb555d). No final full totals/PASS/CI/startup qualification yet; no edits or concurrent runner while active.

I read your independent cleanup compliance review6191219093. R1 removes no proof DB copy pending YY; R2 uses max-used-space5GB with shared/in-use protection; R4 requires fresh image-bound requirement+10GB before each build/proof. No cleanup replay, production operation, app PR, new CI, image build or proof has occurred. Existing refusal codes/conditions, reports, scientific scope, 600-second/805306368 limits and forward-only guards remain.
'''
bodyFile=O/'posted-body.txt';bodyFile.write_text(body,encoding='utf-8')
payload=O/'post-payload.json';payload.write_text(json.dumps({'body':body}),encoding='utf-8')
(O/'post-intent.json').write_text(json.dumps({'marker':MARKER,'createdUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'onePostOnly':True,'nativeMessageNotSent':True}),encoding='utf-8')
response=subprocess.check_output(['gh','api','--method','POST','repos/yigini/soilfer-lims/issues/162/comments','--input',str(payload)],cwd=R)
(O/'post-response-original.json').write_bytes(response);posted=json.loads(response);assert posted['body']==body
headers=re.findall(r'^(?:PASS|FAIL) .*',(F/'stderr-original.log').read_text(encoding='utf-8'),re.M)
(O/'progress-record.json').write_text(json.dumps({'postedId':posted['id'],'url':posted['html_url'],'marker':MARKER,'fullSession':29474,
    'observedHeaders':len(headers),'observedFailHeaders':[x for x in headers if x.startswith('FAIL')],'sourceUnchanged':True,
    'testHashCountClarification':{'preexistingCurrentMain':370,'unchangedNewTelemetry':1,'manifestTotal':371},'productionOperations':0},indent=2),encoding='utf-8')
readme=R/'WP/audit-release-eb6de2e8/README.md'
lead=f"""## 2026-10-15 one corrected-source progress note to Claudio / same full29474 ACTIVE

ONE #162 source-progress comment{posted['id']} posted: {posted['html_url']} marker{MARKER}. It is NOT final audit/merge/build/proof readiness. Bundles actual original full2failures, corrected167focusedPASS, real earlier race +3WAL cases/copy tamper, zero-test local setup refusal and new exact-bound full29474 OPEN. Actual6191219093 rule clarification acknowledged ONLY here; no duplicate cleanup receipt/native message. Hash-count clarification: the unchanged371-test-file manifest is370 preexisting current-main suites PLUS the unchanged new telemetry test; all370 stock test sources and all209/chart/policy cases remain unchanged. Older shorthand '371 stock' refers to that manifest, not371 current-main suites. Same full373/expected5679/1333inputs remains frozen/active, no final totals/PASS/CI/qualification. No appsource edits/cleanup replay/production operation.\n\n"""
readme.write_bytes(lead.encode()+readme.read_bytes())
paths=sorted(p for p in O.iterdir() if p.is_file())+[pathlib.Path(__file__),readme]
bindings=[]
for p in paths:
    value=p.read_bytes();bindings.append({'path':p.relative_to(R).as_posix(),'length':len(value),'sha256':sha(value),'gitBlobOid':hashlib.sha1(('blob '+str(len(value))+'\0').encode()+value).hexdigest()})
index=O/'publication-index.json';index.write_text(json.dumps({'baseAudit':BASE,'postedId':posted['id'],'marker':MARKER,'files':bindings,'productionOperations':0},indent=2),encoding='utf-8');paths.append(index)
names=[p.relative_to(R).as_posix() for p in paths];git('-c','core.autocrlf=false','add','-f','--',*names)
assert set(git('diff','--cached','--name-only').decode().splitlines())<=set(names)
tree=git('write-tree').decode().strip()
for p,n in zip(paths,names):
    value=git('show',tree+':'+n);oid=git('rev-parse',tree+':'+n).decode().strip();assert value==p.read_bytes() and hashlib.sha1(('blob '+str(len(value))+'\0').encode()+value).hexdigest()==oid
assert all(sha((R/n).read_bytes())==v for n,v in frozen.items())
git('commit','-m','Record one corrected startup-source progress note and test inventory clarification')
head=git('rev-parse','HEAD').decode().strip();git('push','origin','audit/release-eb6de2e8');assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head
print(json.dumps({'head':head,'rawVerifiedOwnedBlobs':len(paths),'postedId':posted['id'],'url':posted['html_url'],'fullSession':29474,'observedHeaders':len(headers),'failHeaders':[x for x in headers if x.startswith('FAIL')]}))
