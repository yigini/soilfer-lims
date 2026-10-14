"""Retain the actual closed full successor honestly; never treat active output as terminal."""
import datetime,hashlib,json,subprocess,sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf8')
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent;dest=wp/'issue209-full-ordinary-companion'
assert not (dest/'index.json').exists()
summary=json.loads((dest/'summary.json').read_bytes())
assert summary['closedUtc'] and int((dest/'exit-original.txt').read_text())==summary['exit']
before=json.loads((dest/'source-before.json').read_bytes());after=json.loads((dest/'source-after.json').read_bytes())
assert before==after and summary['sourceUnchanged'] and len(before)==1310
for path,digest in before.items():assert hashlib.sha256((root/path).read_bytes()).hexdigest()==digest,path
report=json.loads((dest/'report-original.json').read_bytes()) if (dest/'report-original.json').exists() else {}
inventory=json.loads((dest/'inventory-original.json').read_bytes());assert len(inventory)==len(set(inventory))==370
if summary['status']=='PASS':
 assert summary['exit']==0 and report['success'] and summary['suites']==summary['passedSuites']==370
 assert summary['tests']==summary['passedTests']==5630 and summary['selectedInventoryEqual'] and summary['visibleAssetsUnchanged']
 assert all(report[k]==0 for k in ['numFailedTests','numPendingTests','numTodoTests','numFailedTestSuites','numPendingTestSuites'])
 assert set(row['name'] for row in report['testResults'])==set(inventory)
def git(*args):return subprocess.run(['git',*args],cwd=root,capture_output=True,check=True).stdout
assert git('branch','--show-current').strip()==b'audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip()
base='2242bcb4861a7085bb95e78e0e7b1e4edf11d1b8'
source=git('diff','--name-only',base,'HEAD','--','server','client','docs/audit','Dockerfile','docker-entrypoint.sh','.gitattributes').decode().splitlines()
assert len(source)==57 and all(path in before for path in source)
held=[]
for line in (dest/'physical-retention-original.jsonl').read_text(encoding='utf8').splitlines():
 row=json.loads(line);p=Path(row['path']);assert p.exists(),p
 if p.is_file():held.append({'path':str(p),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
(dest/'physical-retained-terminal-index.json').write_bytes((json.dumps({'terminalUtc':summary['closedUtc'],'allTeardownTargetsRetained':True,'files':held},indent=2)+'\n').encode())
rawPins={p.relative_to(root).as_posix():{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in dest.iterdir() if p.is_file() and p.name!='open-retention-index.json'}
record={'retainedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'status':'CLOSED_FULL_ORDINARY_'+summary['status'],'summary':summary,
 'scopeComments':[6163271808,6166518424],'sourceDraftPaths':source,'actualApplicationDiffCount':57,
 'prior55PathDraftListsExcludedTwoAlreadyRetainedRequestPaths':['server/services/orderRevisionContract.js','server/tests/contracts/issue_209_order_revision_request.test.js'],
 'applicationFullyVerified':summary['status']=='PASS','productionOperations':0,'rawFiles':rawPins}
(dest/'index.json').write_bytes((json.dumps(record,indent=2)+'\n').encode())
lead=f'''## 2026-10-14 #209 full ordinary successor CLOSED {summary['status']}

Closed{summary['closedUtc']} exit{summary['exit']}; suites{summary['suites']}/tests{summary['tests']}/passed{summary['passedTests']}/failed{summary['failed']}/pending{summary['pending']}. All1310frozeninputs unchanged; actualinventory370 retained. Exact result is {summary['status']}; no invented fullPASS. Originalreport/logs/config/discovery/command/exit/sourcebeforeafter/localbyteidenticalvisibleassets/physicalretainedindex at issue209-full-ordinary-companion/index.json; everyteardowntargetheld/stockCIhooks unchanged. Actualappdiff againstmain2242 is57paths (prior55draftlists omittedtwoalreadyretainedrequestpaths fromc759; no source lost). BothClscope6163271808+6166518424/full8/248companionPASSpushed27477ea8/scanners/intakecollapse/history unchanged. Only after actualfullPASS mayprepare source-only209PR onfreshmain, thenactualstockCI370/5630/allDocker209proof/exactheadClauditPASS. No209PR/ready/audit/merge/kit/gate/productionoperation at retention. Samewriter/humancontent/103noapply/214+206sourcegreenundeployed/allhistoryguards hold.

'''
readmes=['WP/audit-release-eb6de2e8/README.md','WP/runtime-recovery-kobo/README.md']
for path in readmes:
 f=root/path;f.write_bytes(lead.encode()+f.read_bytes())
owned=list(rawPins)+[(dest/'index.json').relative_to(root).as_posix()]+source+readmes+[Path(__file__).relative_to(root).as_posix()]
git('add','-f','--',*owned);assert set(git('diff','--cached','--name-only').decode().splitlines())<=set(owned)
for path,pin in rawPins.items():assert hashlib.sha256(git('show',':'+path)).hexdigest()==pin['sha256'],path
for path in source:assert git('show',':'+path)==(root/path).read_bytes().replace(b'\r\n',b'\n'),path
git('commit','-m','audit(209): retain exact closed full ordinary result and source inventory')
retained=git('rev-parse','HEAD').decode().strip()
for path,pin in rawPins.items():assert hashlib.sha256(git('show',retained+':'+path)).hexdigest()==pin['sha256'],path
git('push','origin','HEAD:refs/heads/audit/release-eb6de2e8')
assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==retained
print(json.dumps({'auditHead':retained,'status':summary['status'],'closedRawBlobsVerified':len(rawPins),'sourcePaths':57,'productionOperations':0}))
