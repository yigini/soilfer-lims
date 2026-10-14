"""Retain actual new build-only source approval and read-only runtime compatibility."""
import datetime, hashlib, json, pathlib, subprocess, sys
REPO=pathlib.Path(__file__).resolve().parents[2]
SOURCE=REPO/'WP/batch-release-cde8-20261014'
DEST=SOURCE/'actual-build-source-pass-6179796996'
HEAD='3debeb0e16fa8d7d1311adf317e2c6e48efcfb5a'
TOOLING='9ef893b38fe381061d4dc8aa90968d1d7a4f6fff'
assert not DEST.exists(), 'Consumed approval retention'
def cmd(*args):return subprocess.check_output(args,cwd=REPO)
assert cmd('git','rev-parse','HEAD').decode().strip()==HEAD
assert not cmd('git','diff','--cached','--name-only').strip()
sys.path.insert(0,str(SOURCE))
from batch_build_contract import *
from prepare_batch_build import raw_git,current_evidence
index={'head':TOOLING,'files':{}}
for n in sorted(SOURCE_FILES):
    raw,index['files'][n]=raw_git(TOOLING,'WP/batch-release-cde8-20261014/'+n)
    require(raw==(SOURCE/n).read_bytes(),'Actual source bytes changed')
review_raw=cmd('gh','api','repos/yigini/soilfer-lims/issues/comments/6179796996');review=json_exact(review_raw)
validate_source_review(review,TOOLING,index)
pages=cmd('gh','api','--paginate','--slurp','repos/yigini/soilfer-lims/issues/162/comments?per_page=100')
no_later_source_failure([v for p in json_exact(pages) for v in p],review,TOOLING)
fresh=current_evidence();DEST.mkdir()
def save(name,raw):
    with (DEST/name).open('xb') as f:f.write(raw)
save('source-review-original.json',review_raw);save('source-review-readable.txt',review['body'].encode())
save('source-index-original.json',(json.dumps(index,indent=2)+'\n').encode());save('issue162-comments-original.json',pages)
for n,raw in fresh.items():save(n,raw)
probe="import datetime,json,sys,tarfile,pathlib,subprocess; root=pathlib.Path('/opt/lims/releases/workflow-batch-build-cde8c889-20261014T221500Z'); unit='lims-workflow-batch-build-cde8c889-20261014t221500z'; state=subprocess.run(['systemctl','show',unit,'--property=LoadState','--value'],capture_output=True,text=True); print(json.dumps({'scope':'READONLY_HOST_COMPATIBILITY_NO_DB_PATH','pythonVersion':sys.version,'datetimeUtc':hasattr(datetime,'UTC'),'tarDataFilter':hasattr(tarfile,'data_filter'),'rootAbsent':not root.exists() and not root.is_symlink(),'unitLoadState':state.stdout.strip(),'databaseConnections':0,'databasePathsOpened':0,'buildsLaunched':0})); assert hasattr(datetime,'UTC') and hasattr(tarfile,'data_filter') and not root.exists() and not root.is_symlink() and state.stdout.strip()=='not-found'"
save('readonly-host-probe-source.txt',probe.encode())
result=subprocess.run(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=15','root@46.19.33.37','python3','-B','-'],cwd=REPO,input=probe.encode(),capture_output=True,timeout=40)
save('readonly-host-probe-stdout-original.json',result.stdout);save('readonly-host-probe-stderr-original.txt',result.stderr)
require(result.returncode==0,'Read-only host compatibility refused; no build root created')
runtime=json_exact(result.stdout);require(runtime['rootAbsent'] and runtime['datetimeUtc'] and runtime['tarDataFilter'],'Host not compatible')
save('source-validation.json',(json.dumps({'status':'ACTUAL_NEW_BUILD_ONLY_SOURCE_PASS_VALIDATED','reviewId':review['id'],'reviewUtc':review['created_at'],'toolingCommit':TOOLING,'sourceHashCount':5,'readonlyHostCompatible':True,'productionDatabaseConnections':0,'buildsLaunched':0,'proofsLaunched':0,'productionDeployments':0,'validatedUtc':datetime.datetime.now(datetime.UTC).isoformat()},indent=2)+'\n').encode())
paths=sorted(p for p in DEST.iterdir() if p.is_file())+[pathlib.Path(__file__)]
readme=REPO/'WP/audit-release-eb6de2e8/README.md'
readme.write_bytes(('## 2026-10-14 actual new BUILD-ONLY Source review PASS6179796996\n\nActualCl PASS22:21:23UTC binds exacttooling9ef893b3/all5hashes/candidatecde8/tree638/mainCI38636615469/fixedfirstbuildroot221500Z/disk/lifetime/YYpins. Rawreview/currentauthorities/sourcegraph and read-only remote Python compatibility retained at WP/batch-release-cde8-20261014/actual-build-source-pass-6179796996/index.json. Remotehost supportsdatetimeUTC/tarfiledatafilter; exactrootABSENT/unitnot-found; no DBpath/connection/build/proof/deploy. Only the first build is authorized; future stopped-copy proof/impact/fullkit/gate/deploy remain unapproved. Prepare/launch reviewed graph ONCE; uncertain unit closure without terminalfile means journal inspection NEVERreplay. No new nativeack/request sent by this helper.\n\n').encode()+readme.read_bytes());paths.append(readme)
index_path=DEST/'index.json'
with index_path.open('x',encoding='utf-8') as f:json.dump({'status':'ACTUAL_BUILD_SOURCE_PASS_AND_RUNTIME_RETAINED','reviewId':review['id'],'toolingCommit':TOOLING,'files':[{'path':p.relative_to(REPO).as_posix(),'bytes':p.stat().st_size,'sha256':sha(p.read_bytes())} for p in paths]},f,indent=2)
paths.append(index_path);rels=[p.relative_to(REPO).as_posix() for p in paths]
cmd('git','-c','core.autocrlf=false','add','-f','--',*rels)
require(set(cmd('git','diff','--cached','--name-only').decode().splitlines())==set(rels),'Staged owner differs')
for p,rel in zip(paths,rels):require(cmd('git','show',':'+rel)==p.read_bytes(),'Raw staged bytes differ')
cmd('git','commit','-m','Retain actual batch build source PASS and read-only host compatibility')
head=cmd('git','rev-parse','HEAD').decode().strip()
for p,rel in zip(paths,rels):require(cmd('git','show',head+':'+rel)==p.read_bytes(),'Committed raw bytes differ')
cmd('git','push','origin','audit/release-eb6de2e8')
require(cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head,'Pushed audit differs')
print(json.dumps({'status':'PUSHED_ACTUAL_BUILD_SOURCE_PASS','head':head,'reviewId':review['id'],'verifiedBlobs':len(paths),'hostPython':runtime['pythonVersion'],'scope':SCOPE,'buildsLaunched':0,'databaseConnections':0}))
