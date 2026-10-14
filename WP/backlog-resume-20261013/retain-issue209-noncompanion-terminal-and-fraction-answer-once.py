"""Retain one closed failure and the independently fetched actual fraction decision."""
import datetime, hashlib, json, subprocess, sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf8')
root=Path(__file__).resolve().parents[2]; wp=Path(__file__).parent
dest=wp/'issue209-attempt-noncompanion-order-context-focused'
answer_dir=wp/'issue209-fraction-decisions-6166518424'
assert not (dest/'index.json').exists() and not answer_dir.exists()
def command(*args): return subprocess.run(args,cwd=root,capture_output=True,check=True).stdout
def git(*args): return command('git',*args)
assert git('branch','--show-current').strip()==b'audit/release-eb6de2e8'
assert not git('diff','--cached','--name-only').strip()
prior=git('rev-parse','HEAD').decode().strip()
assert prior=='4def9e19c8d10024714527c2c31438d1985b7f94'
assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==prior
summary=json.loads((dest/'summary.json').read_bytes())
assert summary['exit']==1 and summary['tests']==124 and summary['passedTests']==119 and summary['failed']==5
assert summary['pending']==summary['todo']==0 and summary['sourceUnchanged'] and summary['selectedInventoryEqual']
before=json.loads((dest/'source-before.json').read_bytes())
assert before==json.loads((dest/'source-after.json').read_bytes())
for path,digest in before.items(): assert hashlib.sha256((root/path).read_bytes()).hexdigest()==digest,path
source=json.loads((wp/'issue209-attempt-single-order-context-focused/index.json').read_bytes())['sourceDraftPaths']
held=[]
for line in (dest/'physical-retention-original.jsonl').read_text(encoding='utf8').splitlines():
 row=json.loads(line); p=Path(row['path']); assert p.exists(),p
 if p.is_file(): held.append({'path':str(p),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
(dest/'physical-retained-terminal-index.json').write_bytes((json.dumps({'terminalUtc':summary['closedUtc'],'allTeardownTargetsRetained':True,'files':held},indent=2)+'\n').encode())
raw={name:command('gh','api',path) for name,path in [
 ('answer-original.json','repos/yigini/soilfer-lims/issues/comments/6166518424'),
 ('question-original.json','repos/yigini/soilfer-lims/issues/comments/6166098211'),
 ('issue209-original.json','repos/yigini/soilfer-lims/issues/209'),
 ('main-original.json','repos/yigini/soilfer-lims/git/ref/heads/main')]}
answer=json.loads(raw['answer-original.json'])
assert answer['id']==6166518424 and answer['created_at']==answer['updated_at']=='2026-10-14T10:42:10Z'
assert answer['performed_via_github_app']['slug']=='claude' and 'answering 6166098211' in answer['body']
for required in ['Existing items only','TEXTURE_FRACTION_OWNERS_INCOMPLETE','Every existing non-WAIVED fraction WorkItem','No widening of the legacy exact-match fallback']:
 assert required in answer['body'],required
assert json.loads(raw['main-original.json'])['object']['sha']=='2242bcb4861a7085bb95e78e0e7b1e4edf11d1b8'
answer_dir.mkdir()
for name,data in raw.items(): (answer_dir/name).write_bytes(data)
(answer_dir/'answer-original.md').write_bytes(answer['body'].encode())
raw_pins={p.relative_to(root).as_posix():{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for d in [dest,answer_dir] for p in d.iterdir() if p.is_file()}
(dest/'index.json').write_bytes((json.dumps({'retainedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'status':'CLOSED_NONCOMPANION_CONTEXT_FAILURE','summary':summary,'cause':'Only five existing TEXTURE/fraction contexts remain; no-TEXTURE triplet now passes. Actual fraction direction arrived after closure and is retained separately. No assertion weakening or fraction runtime changes yet.','sourceDraftPaths':source,'applicationFullyVerified':False,'productionOperations':0,'rawFiles':{k:v for k,v in raw_pins.items() if k.startswith(dest.relative_to(root).as_posix())}},indent=2)+'\n').encode())
(answer_dir/'index.json').write_bytes((json.dumps({'retainedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'status':'ACTUAL_FRACTION_SCOPE_ACCEPTED_BEFORE_IMPLEMENTATION','comment':6166518424,'question':6166098211,'commentUrl':answer['html_url'],'productionOperations':0,'fractionRuntimeChanged':False,'rawFiles':{k:v for k,v in raw_pins.items() if k.startswith(answer_dir.relative_to(root).as_posix())}},indent=2)+'\n').encode())
lead='''## 2026-10-14 #209 actual fraction companion direction6166518424 retained; latest119/5 failure honest

ActualCl6166518424 at10:42:10UTC answers ONCEquestion6166098211. FULLanswer issue209-fraction-decisions-6166518424: TEXTURE logical target preserves every existing non-WAIVED SAND/SILT/CLAY owner inclCOMPLETED; fixed linked companion lines and canonicalTEXTURE line in one reasoned TX/audit; no newfraction owners/generalnormalizer/requiredAnalyses/report/derivation change. Partial1/2 owners refuse409 TEXTURE_FRACTION_OWNERS_INCOMPLETE/missingcodes/zero writes. Explicit noTEXTURE target uses normal reasoned reconciliation. Oldline/attempt identity unchanged/exactlegacy fallback unchanged. Kit reports fraction-owner refusal cause and partial-owner samples/IDs; YY sees lists ifnonzero. Allfour owner resolution/partial/explicitremoval/newsample-collapse and unchangedatomictexture/separate-texture assertions required. ScopeanswerNOTfinalPASS; nativependingquestionhandoff obsolete/UNSENT, never resend question. Latestclosed10:50:06.0543192/124119PASS5FAIL/sourceunchanged/exact370discovery retained issue209-attempt-noncompanion-order-context-focused; five fractioncontexts await this correction. Priorindependent11/350 andapprovedhistory2/181 pass. No runner/fullserverPASS/209PR/ready/audit/merge/kit/gate/productionoperation. Samewriter/214+206 sourcegreenundeployed/humancontent/103noapply/allhistoryguards hold.

'''
readmes=['WP/audit-release-eb6de2e8/README.md','WP/runtime-recovery-kobo/README.md']
for path in readmes:
 f=root/path;f.write_bytes(lead.encode()+f.read_bytes())
owned=list(raw_pins)+[(dest/'index.json').relative_to(root).as_posix(),(answer_dir/'index.json').relative_to(root).as_posix()]+source+readmes+[Path(__file__).relative_to(root).as_posix(),(wp/'verify-issue209-attempt-noncompanion-order-context-focused-once.py').relative_to(root).as_posix()]
git('add','-f','--',*owned)
assert set(git('diff','--cached','--name-only').decode().splitlines())<=set(owned)
for path,pin in raw_pins.items(): assert hashlib.sha256(git('show',':'+path)).hexdigest()==pin['sha256'],path
for path in source: assert git('show',':'+path)==(root/path).read_bytes().replace(b'\r\n',b'\n'),path
git('commit','-m','audit(209): retain actual fraction scope and closed noncompanion result')
retained=git('rev-parse','HEAD').decode().strip()
for path,pin in raw_pins.items(): assert hashlib.sha256(git('show',retained+':'+path)).hexdigest()==pin['sha256'],path
git('push','origin','HEAD:refs/heads/audit/release-eb6de2e8')
assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==retained
print(json.dumps({'auditHead':retained,'closedRawBlobsVerified':len(raw_pins),'comment':6166518424,'passedTests':119,'failedTests':5,'productionOperations':0}))
