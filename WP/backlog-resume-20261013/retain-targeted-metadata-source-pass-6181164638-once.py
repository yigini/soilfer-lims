"""Retain actual exact targeted metadata-only PASS; no image adoption or attribution verdict."""
import datetime,json,pathlib,subprocess,sys
REPO=pathlib.Path(__file__).resolve().parents[2]
SOURCE=REPO/'WP/batch-forward-metadata-cde8-20261014'
DEST=SOURCE/'actual-targeted-source-pass-6181164638'
TOOLING='8df9e1261647dcc8ba018c739bd606fe5291f1ca'
def cmd(*a):return subprocess.check_output(a,cwd=REPO)
assert cmd('git','rev-parse','HEAD').decode().strip()=='efdac16d1d952614e4b780445143e159deeac33a'
assert not cmd('git','diff','--cached','--name-only').strip() and not DEST.exists()
sys.path.insert(0,str(SOURCE))
from forward_metadata_contract import *
from prepare_forward_metadata import raw_git,fresh_authority
index={'head':TOOLING,'files':{}}
for n in sorted(SOURCE_FILES):
    raw,index['files'][n]=raw_git(TOOLING,'WP/batch-forward-metadata-cde8-20261014/'+n);require(raw==(SOURCE/n).read_bytes(),'Current reviewed source differs')
raw=cmd('gh','api','repos/yigini/soilfer-lims/issues/comments/6181164638');review=exact_json(raw)
source_review(review,index);authority=fresh_authority(review,index)
require(review['created_at']=='2026-10-15T00:00:00Z' and 'before-state was never measured' in review['body'] and 'Residual ≥ 500 MB is still STOP.' in review['body'],'Full actual attribution note missing')
DEST.mkdir()
def save(n,raw):
    with (DEST/n).open('xb') as f:f.write(raw)
save('actual-source-review-original.json',raw);save('actual-source-review-readable.txt',review['body'].encode());save('source-index-original.json',(json.dumps(index,indent=2)+'\n').encode())
for n,raw in authority.items():save(n,raw)
save('independent-source-validation.json',(json.dumps({'status':'ACTUAL_EXACT_TARGETED_METADATA_ONLY_PASS_VALIDATED','sourceReviewId':6181164638,'reviewUtc':review['created_at'],'toolingCommit':TOOLING,'fiveRawSourceHashesVerified':True,'completeCatalogueNoTruncation':True,'exactCandidateChainSelection':True,'imageEligibility':False,'metadataCollectorsRun':0,'imageAdoptionReceipts':0,'proofLaunches':0,'productionDeployments':0,'laterAttributionMustSeparateOlderBaseLayers':True,'missingBeforeStateUnknown':True,'residualAtLeast500MBStillStop':True,'validatedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat()},indent=2)+'\n').encode())
paths=sorted(p for p in DEST.iterdir() if p.is_file())+[pathlib.Path(__file__)]
readme=REPO/'WP/audit-release-eb6de2e8/README.md'
readme.write_bytes(('## 2026-10-15 actualCl targeted metadata-only PASS6181164638\n\nActual00:00:00UTC SourcePASS binds8df9e1261647dcc8ba018c739bd606fe5291f1ca/all5hashes/new000500root/exactcandidate-chain-selection/no-truncation/limits. Fullverdict/rawsourceindex/freshauthority/independentbinding at WP/batch-forward-metadata-cde8-20261014/actual-targeted-source-pass-6181164638/index.json. Only one NEW targeted metadata capture authorized; package/root/unit notyetcreated. Original233000STOP consumed/unchanged, old0bPASS doesnotcoverthissource. Actual later-validator note: older base layers maypreexist(#200), before-state NEVERmeasured; use snapshotinfo timestamps versus actualfailedbuildwindow, unknowncountsUNEXPLAINED/residual>=500MBSTOP. No attribution/adoption/proofeligibility/receipt/kit/gate/deploy/DB103; image1dforensic excluded. Bothpins/all6directions/referenceabsence/500MBfloorlimits/history preserved.\n\n').encode()+readme.read_bytes());paths.append(readme)
indexpath=DEST/'index.json'
with indexpath.open('x',encoding='utf-8') as f:json.dump({'status':'ACTUAL_TARGETED_METADATA_ONLY_SOURCE_PASS_RETAINED','sourceReviewId':6181164638,'toolingCommit':TOOLING,'imageEligibility':False,'files':[{'path':p.relative_to(REPO).as_posix(),'bytes':p.stat().st_size,'sha256':sha(p.read_bytes())} for p in paths]},f,indent=2)
paths.append(indexpath);rels=[p.relative_to(REPO).as_posix() for p in paths]
cmd('git','-c','core.autocrlf=false','add','-f','--',*rels);require(set(cmd('git','diff','--cached','--name-only').decode().splitlines())==set(rels),'Staged owner differs')
tree=cmd('git','write-tree').decode().strip()
for p,rel in zip(paths,rels):require(raw_git(tree,rel)[0]==p.read_bytes(),'Raw staged bytes differ')
cmd('git','commit','-m','Retain actual targeted metadata source PASS and missing-before-state attribution guard')
head=cmd('git','rev-parse','HEAD').decode().strip()
for p,rel in zip(paths,rels):require(raw_git(head,rel)[0]==p.read_bytes(),'Raw Git bytes differ')
cmd('git','push','origin','audit/release-eb6de2e8');require(cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head,'Pushed audit differs')
print(json.dumps({'status':'PUSHED_ACTUAL_TARGETED_METADATA_ONLY_PASS','head':head,'verifiedBlobs':len(paths),'sourceReviewId':6181164638,'toolingCommit':TOOLING,'imageEligibility':False,'metadataCollectorsRun':0}))
