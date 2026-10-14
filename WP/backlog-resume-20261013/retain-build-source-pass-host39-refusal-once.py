"""Retain the actual PASS and incompatible host honestly after the original retainer refused."""
import datetime, hashlib, json, pathlib, subprocess
REPO=pathlib.Path(__file__).resolve().parents[2]
DEST=REPO/'WP/batch-release-cde8-20261014/actual-build-source-pass-6179796996'
def cmd(*args):return subprocess.check_output(args,cwd=REPO)
assert cmd('git','rev-parse','HEAD').decode().strip()=='3debeb0e16fa8d7d1311adf317e2c6e48efcfb5a'
assert not cmd('git','diff','--cached','--name-only').strip()
assert not (DEST/'index.json').exists()
review=json.loads((DEST/'source-review-original.json').read_bytes())
runtime=json.loads((DEST/'readonly-host-probe-stdout-original.json').read_bytes())
assert review['id']==6179796996 and review['created_at']==review['updated_at'] and review['performed_via_github_app']['slug']=='claude'
assert review['body'].startswith('Source review: PASS') and runtime['pythonVersion'].startswith('3.9.') and runtime['datetimeUtc'] is False and runtime['tarDataFilter'] is True and runtime['rootAbsent'] is True and runtime['unitLoadState']=='not-found' and runtime['databaseConnections']==runtime['buildsLaunched']==0
assert b'AssertionError' in (DEST/'readonly-host-probe-stderr-original.txt').read_bytes()
record={'status':'ACTUAL_SOURCE_PASS_HOST_COMPATIBILITY_REFUSED_BEFORE_BUILD_ROOT','retainedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'actualSourcePassId':6179796996,'toolingCommit':'9ef893b38fe381061d4dc8aa90968d1d7a4f6fff','runtimeOriginal':'readonly-host-probe-stdout-original.json','localRetainerExitCode':1,'retainerFailureEvidenceKind':'TOOL_OUTPUT_TRANSCRIPTION','literalRetainerError':'RuntimeError: Read-only host compatibility refused; no build root created','consumedRetainer':'retain-batch-build-source-pass-6179796996-once.py','rootAbsent':True,'unitLoadState':'not-found','databaseConnections':0,'buildsLaunched':0,'oldSourceMustNotLaunch':True,'requiredNextAction':'Correct build-only timestamps for actual Python3.9, verify actual host compatibility without source execution, publish a new exact source and obtain new Claudio PASS before first build'}
with (DEST/'host-compatibility-refusal.json').open('x',encoding='utf-8') as f:json.dump(record,f,indent=2)
paths=sorted(p for p in DEST.iterdir() if p.is_file())+[REPO/'WP/backlog-resume-20261013/retain-batch-build-source-pass-6179796996-once.py',pathlib.Path(__file__)]
readme=REPO/'WP/audit-release-eb6de2e8/README.md'
readme.write_bytes(('## 2026-10-14 new build source approved; host Python3.9 compatibility REFUSED before build root\n\nActualCl Source review PASS6179796996/22:21:23UTC on exact9ef/all5hashes is retained honestly. Independent read-only hostprobe found Python3.9.23/datetimeUTCabsent/tarfiledatafilterpresent/rootABSENT/unitnot-found; no DBpaths/connections/builds. Original approval retainer refused before any package/root/build, and is consumed. Old9efsource MUSTNOTlaunch. New timestamps compatible with actual3.9 need exact source verification/publication/NEWCl PASS before firstbuild; first221500root remains uncreated. Originalreview/probe/stdout/stderr/refusal/helper/index preserved at actual-build-source-pass-6179796996/index.json. Historicalguards/human drafts/cards unchanged; no duplicate oldrequest/ack.\n\n').encode()+readme.read_bytes());paths.append(readme)
index_path=DEST/'index.json'
with index_path.open('x',encoding='utf-8') as f:json.dump({'status':record['status'],'actualSourcePassId':6179796996,'files':[{'path':p.relative_to(REPO).as_posix(),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in paths]},f,indent=2)
paths.append(index_path);rels=[p.relative_to(REPO).as_posix() for p in paths]
cmd('git','-c','core.autocrlf=false','add','-f','--',*rels)
assert set(cmd('git','diff','--cached','--name-only').decode().splitlines())==set(rels)
for p,rel in zip(paths,rels):assert cmd('git','show',':'+rel)==p.read_bytes()
cmd('git','commit','-m','Retain actual build source approval and Python3.9 host refusal honestly')
head=cmd('git','rev-parse','HEAD').decode().strip()
for p,rel in zip(paths,rels):assert cmd('git','show',head+':'+rel)==p.read_bytes()
cmd('git','push','origin','audit/release-eb6de2e8')
assert cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head
print(json.dumps({'status':record['status'],'head':head,'verifiedBlobs':len(paths),'rootAbsent':True,'buildsLaunched':0,'productionConnections':0}))
