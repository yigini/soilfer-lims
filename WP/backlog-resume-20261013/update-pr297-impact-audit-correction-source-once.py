"""Advance the same PR once after retained focused PASS; stock new-head CI follows."""
import datetime,hashlib,json,os,re,subprocess,sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf-8')
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent
old='562cab2d24b25a500041a44abf384ffc4dbfad7c';base='2242bcb4861a7085bb95e78e0e7b1e4edf11d1b8'
ref='refs/heads/codex/issue-209-order-revisions'
changed=['docs/audit/209-order-revisions.md','server/scripts/install_order_revisions.js','server/tests/contracts/issue_209_order_revision_integration.test.js']
focused=wp/'issue209-pr297-impact-audit-correction-focused-spelling';dest=wp/'pr297-impact-audit-correction-source-update'
index=wp/'pr297-impact-audit-correction-source-update.index'
assert not dest.exists() and not index.exists(),'Attempt already exists; inspect actual remote outcome, never replay.'
def run(argv,env=None,data=None):return subprocess.run(argv,cwd=root,env=env,input=data,capture_output=True,check=True).stdout
def git(*args,env=None,data=None):return run(['git',*args],env,data)
def gh(path):return run(['gh','api',path])
terminal=json.loads((focused/'terminal-index.json').read_bytes());summary=terminal['summary']
assert summary['status']=='PASS' and summary['suites']==summary['passedSuites']==5 and summary['tests']==summary['passedTests']==333
assert summary['sourceUnchanged'] and summary['selectedInventoryEqual'] and summary['fullDiscovery']==370 and terminal['oldIntegrationBytesRecovered']
frozen=json.loads((focused/'source-before.json').read_bytes())
assert frozen==json.loads((focused/'source-after.json').read_bytes())
for p,h in frozen.items():assert hashlib.sha256((root/p).read_bytes()).hexdigest()==h,p
assert git('branch','--show-current').strip()==b'audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip()
audit=git('rev-parse','HEAD').decode().strip()
assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==audit
assert git('show',audit+':'+(focused/'terminal-index.json').relative_to(root).as_posix())==(focused/'terminal-index.json').read_bytes()
for p,pin in terminal['rawFiles'].items():
 oid=git('ls-tree',audit,'--',p).decode().split()[2]
 assert hashlib.sha256(git('cat-file','blob',oid)).hexdigest()==pin['sha256'],p
before={'pr-before-original.json':gh('repos/yigini/soilfer-lims/pulls/297'),
 'main-before-original.json':gh('repos/yigini/soilfer-lims/git/ref/heads/main'),
 'failed-audit-original.json':gh('repos/yigini/soilfer-lims/issues/comments/6176831479'),
 'closing-refs-before-original.json':run(['gh','pr','view','297','--repo','yigini/soilfer-lims','--json','closingIssuesReferences'])}
pr=json.loads(before['pr-before-original.json']);verdict=json.loads(before['failed-audit-original.json'])
assert pr['state']=='open' and pr['head']['sha']==old and pr['base']['sha']==base
assert pr['body']==(wp/'issue209-classified-source-pr-created/pr-body-original.md').read_text(encoding='utf-8')
assert json.loads(before['main-before-original.json'])['object']['sha']==base
assert verdict['body']==json.loads((wp/'pr297-native-handoff-and-audit-findings-6176831479/audit-failure-original.json').read_bytes())['body']
assert verdict['body'].startswith('Audit failed:') and old in verdict['body']
assert json.loads(before['closing-refs-before-original.json'])['closingIssuesReferences']==[]
assert git('ls-remote','origin',ref).decode().split()[0]==old and git('rev-parse',ref).decode().strip()==old
assert sorted(git('diff','--name-only',old,audit,'--','.',':!WP',':!.gitattributes').decode().splitlines())==changed
applicationAttributes=lambda b:[line for line in b.decode().splitlines() if line.strip() and not line.startswith(('#','WP/'))]
assert applicationAttributes(git('show',old+':.gitattributes'))==applicationAttributes(git('show',audit+':.gitattributes'))
dest.mkdir()
for n,data in before.items():(dest/n).write_bytes(data)
env=dict(os.environ,GIT_INDEX_FILE=str(index));git('read-tree',old,env=env)
for p in changed:
 entry=git('ls-tree',audit,'--',p).decode().strip();meta,listed=entry.split('\t');mode,kind,blob=meta.split()
 assert kind=='blob' and listed==p and git('cat-file','blob',blob)==(root/p).read_bytes().replace(b'\r\n',b'\n')
 git('update-index','--add','--cacheinfo',mode+','+blob+','+p,env=env)
tree=git('write-tree',env=env).decode().strip()
assert sorted(git('diff','--name-only',old,tree).decode().splitlines())==changed
assert not git('diff','--name-only',old,tree,'--','WP')
for p in terminal['sourceDraftPaths']:
 if p!='.gitattributes':assert git('show',tree+':'+p)==(root/p).read_bytes().replace(b'\r\n',b'\n'),p
head=git('commit-tree',tree,'-p',old,data=b'fix(workflow): make order impact reporting match amendment eligibility\n').decode().strip()
assert git('rev-parse',head+'^').decode().strip()==old
paths=git('diff','--name-only',base,head).decode().splitlines();assert len(paths)==122 and not any(p.startswith('WP/') for p in paths)
testPaths=[p for p in paths if p.startswith('server/tests/')];assert len(testPaths)==87
diff=git('diff','--no-ext-diff','--unified=0',base,head,'--',*testPaths)
(dest/'all-test-fixture-lines-original.diff').write_bytes(diff)
inventory={};current=None
for line in diff.decode().splitlines():
 if line.startswith('+++ b/'):current=line[6:];inventory[current]=[]
 elif line.startswith('@@ '):inventory[current].append(line.split('@@',2)[1].strip())
assert set(inventory)==set(testPaths)
(dest/'line-inventory.json').write_bytes((json.dumps(inventory,indent=2)+'\n').encode())
prose=pr['body'].split('Validation on exact source-only head ',1)[0]
body=prose+f'''The read-only impact report now matches scientific amendment eligibility: only ACCEPTED, non-duplicate measurement owners on noneditable samples can raise the prospective amendment STOP. WAIVED work and marked duplicates cannot trigger that list. Malformed stored fraction analysis lists are reported as INVALID_STORED_ANALYSES with sample/owner IDs without throwing, blocking schema-ready startup, repairing data or normalizing stored values. Unexpected schema/SQL errors still refuse. Seven new checks cover waived/duplicate exclusion and ACCEPTED orphan STOP, plus six malformed JSON/list shapes with original file/row equality and startup readiness. Fresh retained spellings in the new exclusion fixture normalize to the same analysis while honoring its raw unique key. All old integration source and assertions are byte-exact recoverable; no runtime, scientific, DDL or scanner change.

Validation on exact source-only head `{head}`, tree `{tree}`, base `{base}`:

- Current ordinary focused verification: **5/5 suites and333/333 tests passed**, both scanners, startup readiness and full order integration included; all370 discovery paths and1327 frozen source/shared/generated-Prisma/scenario/template inputs unchanged. Both stock setups and worker512MB/blank NODE_OPTIONS retained. This is focused proof, not a full result for the new head.
- Prior full local and ONE stock CI38615738432 passed370/5642/all370inventory/all real Docker steps on predecessor562cab2d24b25a500041a44abf384ffc4dbfad7c. Its actual audit6176831479 failed on the two report points corrected here; every original result remains immutable. The new automatic CI must complete370 suites/expected5649 tests and all real Docker steps before a new exact-head audit PASS or merge.
- Delta from the audited predecessor is exactly three paths: installer impact reporting, seven added integration cases, and documentation. All122 application paths equal the retained tested source; WP and audit attributes are excluded. All650 original failure occurrences/59 passing report references and original1653-line fixture provenance remain retained. Existing client evidence is unchanged.

[Current closed focused originals](https://github.com/yigini/soilfer-lims/tree/{audit}/WP/backlog-resume-20261013/{focused.name}); [actual predecessor findings]({verdict['html_url']}). Initial focused setup refusal and subsequent332PASS/one new fixture raw-unique-key failure remain honestly retained; neither was replayed. The existing retention guard and schema were unchanged.

<details><summary>Every changed retained test/fixture source line range</summary>

The complete current literal diff is retained with this source update and includes every added/removed fixture line, including the seven added correction cases. SHA256 `{hashlib.sha256(diff).hexdigest()}`, {len(diff)} bytes/{len(diff.splitlines())} lines. The previous1653-line diff remains bound to the predecessor. All87 current test/fixture paths and old/new ranges follow.

| Test or fixture | Old/new changed line ranges |
|---|---|
'''
body+=''.join(f'| `{p}` | `'+ '; '.join(inventory[p])+'` |\n' for p in sorted(inventory))+'\n</details>\n'
(dest/'pr-body-successor.md').write_bytes(body.encode())
record={'preparedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'oldHead':old,'head':head,'tree':tree,'base':base,'auditSource':audit,
 'changedPaths':changed,'sourcePaths':paths,'focusSummary':summary,'fullNewHeadLocalPass':False,'expectedFullTests':5649,
 'newHeadCiPass':False,'newHeadAuditPass':False,'productionOperations':0,'automaticCiExpected':True}
(dest/'source-head-prepared.json').write_bytes((json.dumps(record,indent=2)+'\n').encode())
# Remove the predecessor's ready label before advancing; do not represent pending new CI as ready.
assert any(l['name']=='ready-for-audit' for l in pr['labels'])
(dest/'predecessor-ready-label-remove-response-original.txt').write_bytes(run(['gh','api','repos/yigini/soilfer-lims/issues/297/labels/ready-for-audit','--method','DELETE']))
git('update-ref',ref,head,old)
git('push','origin',head+':'+ref)
assert git('ls-remote','origin',ref).decode().split()[0]==head
request=dest/'pr-update-request.json';request.write_bytes((json.dumps({'body':body},indent=2)+'\n').encode())
response=run(['gh','api','repos/yigini/soilfer-lims/pulls/297','--method','PATCH','--input',str(request)])
(dest/'pr-update-response-original.json').write_bytes(response)
fresh=json.loads(response);assert fresh['head']['sha']==head and fresh['base']['sha']==base and fresh['body']==body and fresh['state']=='open'
assert not any(l['name']=='ready-for-audit' for l in fresh['labels'])
record.update({'completedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'sourceRefAdvancedOnce':True,'prBodyUpdatedOnce':True,'oldReadyLabelRemovedOnce':True,'newReadyNoticeSent':False,'newNativeHandoffSent':False})
(dest/'source-update-record.json').write_bytes((json.dumps(record,indent=2)+'\n').encode())
pins={p.relative_to(root).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in dest.iterdir() if p.is_file()}
pins[index.relative_to(root).as_posix()]=hashlib.sha256(index.read_bytes()).hexdigest()
(dest/'index.json').write_bytes((json.dumps(pins,indent=2)+'\n').encode())
readmes=['WP/audit-release-eb6de2e8/README.md','WP/runtime-recovery-kobo/README.md']
lead=f'''## 2026-10-14 #209 PR297 advanced ONCE after scoped audit correction focused PASS

Same PR297 exact newhead{head}/tree{tree}/base{base}; parent old562 whose actual audit FAILED6176831479/oldCI3705642green immutable. ONLY3-path report/7newtests/doc delta, current focused5/333PASS/all1327unchanged/bothscanners/full370discovery, everyoldintegrationbyte recovered. Correct closed PASS evidence path is issue209-pr297-impact-audit-correction-focused-spelling/terminal-index.json at audit{audit}; the predecessor focused-owned index remains honestly FAILED332/333 despite the copied README path typo. Original PR bodies/full literal current87fixture inventory/source-ref/tempindex/actualresponses at pr297-impact-audit-correction-source-update/index.json. Old readylabel removed once; new actual automatic stock CI must be observed, no newready/audit/native request until actual complete green370/expected5649/allrealDocker. No current full localPASS claimed, no newhead finalPASS/merge/kit/gate/production. Native priorfinal handoff completeonce/humanDraft preserved; all old650failures/scope/approvednonzeroSTOP/readonly lists/103noapply/history guards hold.

'''
for p in readmes:
 f=root/p;f.write_bytes(lead.encode()+f.read_bytes())
owned=list(pins)+[(dest/'index.json').relative_to(root).as_posix(),Path(__file__).relative_to(root).as_posix()]+readmes
git('add','-f','--',*owned);assert set(git('diff','--cached','--name-only').decode().splitlines())<=set(owned)
git('commit','-m','audit(209): advance same PR297 with scoped impact report corrections')
retained=git('rev-parse','HEAD').decode().strip()
for p,h in pins.items():assert hashlib.sha256(git('show',retained+':'+p)).hexdigest()==h,p
git('push','origin','HEAD:refs/heads/audit/release-eb6de2e8')
assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==retained
print(json.dumps({'auditCommit':retained,'oldHead':old,'head':head,'tree':tree,'base':base,'number':297,'verifiedBlobs':len(pins),'expectedFullTests':5649,'productionOperations':0}))
