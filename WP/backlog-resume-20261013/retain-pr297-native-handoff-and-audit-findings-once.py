"""Retain actual sent native handoff and actual failed audit without replay."""
import datetime,hashlib,json,subprocess,sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf-8')
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent
dest=wp/'pr297-native-handoff-and-audit-findings-6176831479'
assert not dest.exists()
def run(args):return subprocess.run(args,cwd=root,capture_output=True,check=True).stdout
def git(*args):return run(['git',*args])
assert git('branch','--show-current').strip()==b'audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip()
raw={'audit-failure-original.json':run(['gh','api','repos/yigini/soilfer-lims/issues/comments/6176831479']),
 'pr-original.json':run(['gh','api','repos/yigini/soilfer-lims/pulls/297']),
 'run-original.json':run(['gh','api','repos/yigini/soilfer-lims/actions/runs/38615738432']),
 'main-original.json':run(['gh','api','repos/yigini/soilfer-lims/git/ref/heads/main'])}
answer=json.loads(raw['audit-failure-original.json'])
assert answer['performed_via_github_app']['slug']=='claude' and answer['body'].startswith('Audit failed:')
assert '562cab2d24b25a500041a44abf384ffc4dbfad7c' in answer['body'] and 'INVALID_STORED_ANALYSES' in answer['body']
assert json.loads(raw['pr-original.json'])['head']['sha']=='562cab2d24b25a500041a44abf384ffc4dbfad7c'
assert json.loads(raw['run-original.json'])['conclusion']=='success'
source=root/'server/scripts/install_order_revisions.js'
assert source.read_bytes()==git('show','562cab2d24b25a500041a44abf384ffc4dbfad7c:server/scripts/install_order_revisions.js')
raw['install-order-revisions-before-original.js']=source.read_bytes()
raw['native-handoff-actual-sent.txt']=(wp/'pr297-native-final-handoff-actual-sent.txt').read_bytes()
record={'recordedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'head':'562cab2d24b25a500041a44abf384ffc4dbfad7c',
 'nativeHandoffSentOnce':True,'sentBubbleAndEmptyRightComposerObservedByUtc':'2026-10-14T19:42:27Z',
 'window':{'app':'Claude_pzs8sxrjxfjjc!Claude','id':7867734,'project':'LIMS Audit','thread':'Lab workflow audit and plan'},
 'observations':['Fresh unique returned window; right thread showed actual PR297 audit running and empty composer',
  'Right composer click refreshed with caret; only owned evidence draft typed',
  'Owned draft completion time corrected BEFORE sending to exact closed job19:32:08Z',
  'Draft END and HEAD visually inspected; ONE Return; actual head/tree/base bubble and EMPTY right composer verified',
  'Centre human draft can you go and ask Pip preserved; no card or human file modified',
  'Subsequent actual native reply confirmed audit failed on two report points and each needs a test; no acknowledgement sent'],
 'auditVerdict':'FAILED','auditComment':6176831479,'auditCommentUrl':answer['html_url'],
 'stockCiPass':True,'finalAuditPass':False,'mergePermitted':False,'productionOperations':0}
dest.mkdir()
for n,data in raw.items():(dest/n).write_bytes(data)
(dest/'native-delivery-and-audit-record.json').write_bytes((json.dumps(record,indent=2)+'\n').encode())
pins={p.relative_to(root).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in dest.iterdir()}
(dest/'index.json').write_bytes((json.dumps(pins,indent=2)+'\n').encode())
lead='''## 2026-10-14 #209 actual audit FAILED6176831479 after complete greenCI; native handoff ONCE verified

Actual Claudio failed audit on exact PR297 head562cab2d24b25a500041a44abf384ffc4dbfad7c requires two read-only impact corrections: approved-amendment list only ACCEPTED/duplicateOfNULL measurement items, and invalid stored analysis lists must be listed rather than throw/block startup. Runtime/source and full stock370/5642/Docker passed; this is NOT final audit PASS. Full raw actual verdict/source BEFORE retained at pr297-native-handoff-and-audit-findings-6176831479/index.json. Native final evidence handoff sent ONCE, bubble/emptyright visually verified19:42:27UTC/freshClaude7867734/LIMS Audit/Lab workflow; centre human draft preserved. Actual native failure direction read; no duplicate acknowledgement/question/request. Correct in SAME writer with new tests/unique verification/source head/one new automatic CI; never replay old CI/run/helpers or merge before exact new-head actual PASS. All prior evidence/guards/103noapply/no kit/gate/production preserved.

'''
readmes=['WP/audit-release-eb6de2e8/README.md','WP/runtime-recovery-kobo/README.md']
for p in readmes:
 f=root/p;f.write_bytes(lead.encode()+f.read_bytes())
owned=list(pins)+[(dest/'index.json').relative_to(root).as_posix(),Path(__file__).relative_to(root).as_posix(),(wp/'pr297-native-final-handoff-actual-sent.txt').relative_to(root).as_posix()]+readmes
git('add','-f','--',*owned)
assert set(git('diff','--cached','--name-only').decode().splitlines())<=set(owned)
git('commit','-m','audit(209): retain actual failed review and one native final handoff')
audit=git('rev-parse','HEAD').decode().strip()
for p,h in pins.items():assert hashlib.sha256(git('show',audit+':'+p)).hexdigest()==h,p
git('push','origin','HEAD:refs/heads/audit/release-eb6de2e8')
assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==audit
print(json.dumps(dict(record,auditCommit=audit,verifiedRawBlobs=len(pins))))
