"""Ask about a newly evidenced test-context conflict; never repeat the lot-binding question."""
import datetime, hashlib, json, subprocess, sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf-8')
root=Path(__file__).resolve().parents[2];dest=Path(__file__).parent/'issue214-retained-native-fixture-scope'
assert not dest.exists()
report=json.loads((Path(__file__).parent/'issue214-lot-ui-regression-first/report-original.json').read_bytes())
assert report['numFailedTests']==32 and report['numTotalTests']==145
dest.mkdir()
body='''Claudio, implementation follows your actual decisions 6148143929 and lot-binding answer 6152114918. A completed, source-frozen regression run exposed a concrete conflict with “audit_2_3_native_runs.test.js limited to adding the new chart-mode case”.

The unmodified retained Native fixture inherits ISO17025_STRICT, whose shipped qc.lrmLimitMode is already CONTROL_CHART on main1a070. Its historical cases assume the old fixed-window arithmetic/late binding and install only the pre-chart schema. With only the new chart case added, 31 retained Native cases now refuse either the required unbound lot or missing ControlLimitSet table. The new chart kernel/integration/UI, policy, catalogue UI, SQL scanner and readiness-bootstrap suites passed; one separate startup-schema comparison failure is being fixed. Closed local run: 9 suites/145 tests, 113 pass/32 fail/0 pending, no production access.

May the retained pre-chart Native test fixtures explicitly choose FIXED_WINDOW for their analyte contexts (including shared secondary analytes), with all stock assertions unchanged, while the added/new CONTROL_CHART cases use the fully guarded disposable fixture and prove Provisional prebinding, frozen lot, and genuine pre-release start compatibility? This changes test context only, never the shipped Strict default or production policy. Current native-runs file has its original fixture and assertions plus only the added chart case; the proposed fixture correction is held for your direction. Existing earlier failed/incomplete evidence stays honest. Same worktree/writer; no release, kit, gate, production operation, #103 apply go or human-card response.
'''
payload=json.dumps({'body':body}).encode();(dest/'request-original.json').write_bytes(payload)
raw=subprocess.check_output(['gh','api','--method','POST','repos/yigini/soilfer-lims/issues/214/comments','--input','-'],input=payload,cwd=root)
(dest/'response-original.json').write_bytes(raw);posted=json.loads(raw)
assert posted['body']==body
actual=subprocess.check_output(['gh','api','repos/yigini/soilfer-lims/issues/comments/'+str(posted['id'])],cwd=root)
(dest/'actual-posted-raw.json').write_bytes(actual);assert json.loads(actual)['body']==body
index={'observedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'status':'ACTUAL_RETAINED_FIXTURE_SCOPE_QUESTION_POSTED_ONCE','id':posted['id'],'url':posted['html_url'],'productionOperations':0,'files':{}}
for p in dest.iterdir():
 raw=p.read_bytes();index['files'][p.name]={'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()}
(dest/'index.json').write_bytes((json.dumps(index,indent=2)+'\n').encode());print(json.dumps({k:v for k,v in index.items() if k!='files'},indent=2))
