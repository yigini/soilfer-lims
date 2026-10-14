"""Retain the actual corrected exact-source PASS before the first reviewed build."""
import datetime,json,pathlib,subprocess,sys
REPO=pathlib.Path(__file__).resolve().parents[2]
SOURCE=REPO/'WP/batch-release-cde8-20261014'
TOOLING='2afd192872ce38bfabbaf5c69404d0aa7e679123'
DEST=SOURCE/'actual-build-python39-source-pass-6179940139'
def cmd(*args):return subprocess.check_output(args,cwd=REPO)
assert cmd('git','rev-parse','HEAD').decode().strip()=='c34a3f1f7eedab4bc4e40ba9575276b84825c30f'
assert not cmd('git','diff','--cached','--name-only').strip() and not DEST.exists()
sys.path.insert(0,str(SOURCE))
from batch_build_contract import *
from prepare_batch_build import raw_git,current_evidence
index={'head':TOOLING,'files':{}}
for n in sorted(SOURCE_FILES):
    raw,index['files'][n]=raw_git(TOOLING,'WP/batch-release-cde8-20261014/'+n)
    require(raw==(SOURCE/n).read_bytes(),'Current reviewed source differs')
review_raw=cmd('gh','api','repos/yigini/soilfer-lims/issues/comments/6179940139');review=json_exact(review_raw)
validate_source_review(review,TOOLING,index)
history=cmd('gh','api','--paginate','--slurp','repos/yigini/soilfer-lims/issues/162/comments?per_page=100')
no_later_source_failure([v for p in json_exact(history) for v in p],review,TOOLING)
fresh=current_evidence();host=json_exact((SOURCE/'build-python39-source-host-verification-once/exit-original.json').read_bytes())
require(host['status']=='PASS' and host['sourceUnchanged'] and {n:row['sha256'] for n,row in index['files'].items()}==host['sourceSha256After'],'Actual host verification binding differs')
DEST.mkdir()
def save(n,raw):
    with (DEST/n).open('xb') as f:f.write(raw)
save('source-review-original.json',review_raw);save('source-review-readable.txt',review['body'].encode());save('source-index-original.json',(json.dumps(index,indent=2)+'\n').encode());save('issue162-comments-original.json',history)
for n,raw in fresh.items():save(n,raw)
save('source-validation.json',(json.dumps({'status':'ACTUAL_CORRECTED_BUILD_ONLY_SOURCE_PASS_VALIDATED','reviewId':6179940139,'reviewUtc':review['created_at'],'toolingCommit':TOOLING,'sourceHashCount':5,'localGuardTests':14,'actualHostGuardTests':14,'newBuildCount':0,'productionConnections':0,'futureProofOrProductionApproved':False,'validatedUtc':datetime.datetime.now(datetime.UTC).isoformat()},indent=2)+'\n').encode())
paths=sorted(p for p in DEST.iterdir() if p.is_file())+[pathlib.Path(__file__)]
readme=REPO/'WP/audit-release-eb6de2e8/README.md'
readme.write_bytes(('## 2026-10-14 actual corrected2afd BUILD-ONLY Source review PASS6179940139\n\nActualCl PASS22:29:31UTC supersedes6179796996 for execution, binds exact2afd/full5currenthashes/fixed221500firstroot/candidatecde8/tree638/mainCI/allguards. Actual14local+14host3.9 guard/compile/timezone/tarfilter proof bound to these same source hashes. Fullrawreview/independentvalidation/freshappPASS/main/CI retained at actual-build-python39-source-pass-6179940139/index.json. One firstbuild only nowauthorized through reviewed2afdprepare/launcher/builder; no package/root/unit/build alreadyexists. No DBconnection/volume/proof/deploy. Separate proof/impact/finalkit/freshgate remain unapproved; historical9efPASS/preflightrefusal immutable.\n\n').encode()+readme.read_bytes());paths.append(readme)
index_path=DEST/'index.json'
with index_path.open('x',encoding='utf-8') as f:json.dump({'status':'ACTUAL_CORRECTED_BUILD_SOURCE_PASS_RETAINED','reviewId':6179940139,'toolingCommit':TOOLING,'files':[{'path':p.relative_to(REPO).as_posix(),'bytes':p.stat().st_size,'sha256':sha(p.read_bytes())} for p in paths]},f,indent=2)
paths.append(index_path);rels=[p.relative_to(REPO).as_posix() for p in paths]
cmd('git','-c','core.autocrlf=false','add','-f','--',*rels)
require(set(cmd('git','diff','--cached','--name-only').decode().splitlines())==set(rels),'Staged owner differs')
for p,rel in zip(paths,rels):require(cmd('git','show',':'+rel)==p.read_bytes(),'Raw staged bytes differ')
cmd('git','commit','-m','Retain actual corrected batch build source PASS before first build')
head=cmd('git','rev-parse','HEAD').decode().strip()
for p,rel in zip(paths,rels):require(cmd('git','show',head+':'+rel)==p.read_bytes(),'Raw committed bytes differ')
cmd('git','push','origin','audit/release-eb6de2e8')
require(cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head,'Pushed source differs')
print(json.dumps({'status':'PUSHED_ACTUAL_CORRECTED_BUILD_SOURCE_PASS','head':head,'verifiedBlobs':len(paths),'reviewId':6179940139,'source':TOOLING,'buildsLaunched':0,'productionConnections':0}))
