"""Post one concrete auditor decision after independently pushed source evidence."""
import datetime,hashlib,json,subprocess,sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf8')
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent;dest=wp/'issue209-closed-runtime-boundary-analysis'
assert not (dest/'question-post-original.json').exists() and not (dest/'question-post-record.json').exists()
def command(*args):return subprocess.run(args,cwd=root,capture_output=True,check=True).stdout
def git(*args):return command('git',*args)
assert git('branch','--show-current').strip()==b'audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip()
prior=git('rev-parse','HEAD').decode().strip();assert prior=='b5e2e4c8f9f52f1b8c07820e57959de267743631'
assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==prior
index=json.loads((dest/'pre-question-index.json').read_bytes())
for path,pin in index['rawFiles'].items():assert hashlib.sha256(git('show',prior+':'+path)).hexdigest()==pin['sha256'],path
raw_comments=command('gh','api','repos/yigini/soilfer-lims/issues/209/comments?per_page=100')
comments=json.loads(raw_comments)
body=(dest/'claudio-remediation-question-draft.md').read_text(encoding='utf8')
assert body.startswith('#209 runtime reachability follow-up') and 'APPROVED-to-PROCESSING' in body
assert not any('#209 runtime reachability follow-up' in row['body'] for row in comments),'Question already exists; never repeat.'
main=command('gh','api','repos/yigini/soilfer-lims/git/ref/heads/main')
assert json.loads(main)['object']['sha']=='2242bcb4861a7085bb95e78e0e7b1e4edf11d1b8'
(dest/'comments-before-question-original.json').write_bytes(raw_comments)
(dest/'main-before-question-original.json').write_bytes(main)
request=dest/'question-post-request.json';request.write_bytes((json.dumps({'body':body})+'\n').encode())
with (dest/'question-post-original.json').open('xb') as out,(dest/'question-post-stderr-original.log').open('xb') as err:
 result=subprocess.run(['gh','api','repos/yigini/soilfer-lims/issues/209/comments','--method','POST','--input',str(request)],cwd=root,stdout=out,stderr=err)
(dest/'question-post-exit-original.txt').write_bytes((str(result.returncode)+'\n').encode())
assert result.returncode==0,'Remote outcome uncertain; inspect actual history and do not replay.'
posted=json.loads((dest/'question-post-original.json').read_bytes());assert posted['body']==body
record={'recordedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'comment':posted['id'],'url':posted['html_url'],'createdUtc':posted['created_at'],
 'sourceEvidenceAudit':prior,'bodySha256':hashlib.sha256(body.encode()).hexdigest(),'postedOnce':True,'actualAnswerPending':True,
 'nativeHandoffSent':False,'productionOperations':0,'applicationAndFixtureCorrections':0}
(dest/'question-post-record.json').write_bytes((json.dumps(record,indent=2)+'\n').encode())
owned=[p.relative_to(root).as_posix() for p in dest.iterdir() if p.is_file() and p.name.startswith(('question-post','comments-before','main-before','claudio-remediation'))]+[Path(__file__).relative_to(root).as_posix()]
pins={path:{'bytes':(root/path).stat().st_size,'sha256':hashlib.sha256((root/path).read_bytes()).hexdigest()} for path in owned}
(dest/'question-post-retention-index.json').write_bytes((json.dumps({'record':record,'rawFiles':pins},indent=2)+'\n').encode())
lead=f'''## 2026-10-14 #209 approved-orphan remediation question POSTED ONCE {posted['id']}

ActualGHquestion {posted['html_url']} at{posted['created_at']} asksnewapproved-orphan remediation scope underClnativecompatibilitycaution. Independentpushedsourceproofb5e2e4c8: supportedbaseline48d WIs survive caughtinitialorder/line failure; currentmainnormalintakecreatesorder; draftexactlegacyfallbackotherwisezero-write409; APPROVED orphan cannotordinaryedit409AMENDMENT_WORKFLOW_REQUIRED andscientificpreflightresolvesline beforePROCESSING. NeedactualClanswer: explicitfulltargetreasonedorderstepinsideamendment orseparatekitSTOP/forwardfix prerequisite; proposaldistinctnoACTIVE/nomatchingline+prospectiveapproved-amendment readonlylists. No productioninspection/count, onlypinnedsource reachability. NOsource/fixture semantic correctionbeforeactualanswer; continue independentper-case readonlyclassification. NEVERduplicate/edit/repost/replay question. Original6163271808/6166518424/no backfill/relink/fallbackweakening/approvededitguard held. FullCLOSED370/5630 4980PASS650FAIL65suites/onlyderivedhelpartifactchanged/1309coreinputs+57appunchanged/daca20blobs. No runner/fullPASS/209PR/ready/audit/merge/kit/gate/productionoperation. Nativehandoff of thisnewquestion UNSENT atretention. Samewriter/humancontent/103noapply/214+206sourcegreenundeployed/historyguards hold.

'''
readmes=['WP/audit-release-eb6de2e8/README.md','WP/runtime-recovery-kobo/README.md']
for path in readmes:
 f=root/path;f.write_bytes(lead.encode()+f.read_bytes())
owned +=[(dest/'question-post-retention-index.json').relative_to(root).as_posix()]+readmes
git('add','-f','--',*owned);assert set(git('diff','--cached','--name-only').decode().splitlines())<=set(owned)
for path,pin in pins.items():assert hashlib.sha256(git('show',':'+path)).hexdigest()==pin['sha256'],path
git('commit','-m','audit(209): raise approved orphan remediation boundary once')
retained=git('rev-parse','HEAD').decode().strip()
for path,pin in pins.items():assert hashlib.sha256(git('show',retained+':'+path)).hexdigest()==pin['sha256'],path
git('push','origin','HEAD:refs/heads/audit/release-eb6de2e8')
assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==retained
print(json.dumps({'auditHead':retained,'comment':posted['id'],'url':posted['html_url'],'rawBlobsVerified':len(pins),'postedOnce':True,'actualAnswerPending':True,'productionOperations':0}))
