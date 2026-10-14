"""Retain actual bounded metadata-only source PASS; never image adoption or deployment authority."""
import datetime,json,pathlib,subprocess,sys
REPO=pathlib.Path(__file__).resolve().parents[2]
SOURCE=REPO/'WP/batch-forward-metadata-cde8-20261014'
DEST=SOURCE/'actual-source-pass-6180876636'
TOOLING='0b01804f9d409d74a19472c22469824e2df95005'
def cmd(*args):return subprocess.check_output(args,cwd=REPO)
assert cmd('git','rev-parse','HEAD').decode().strip()=='e992b6d464d4d0a756f5b68a38c852e5361d3ea6'
assert not cmd('git','diff','--cached','--name-only').strip() and not DEST.exists()
sys.path.insert(0,str(SOURCE))
from forward_metadata_contract import *
from prepare_forward_metadata import raw_git,fresh_authority
index={'head':TOOLING,'files':{}}
for n in sorted(SOURCE_FILES):
    raw,index['files'][n]=raw_git(TOOLING,'WP/batch-forward-metadata-cde8-20261014/'+n)
    require(raw==(SOURCE/n).read_bytes(),'Current source differs from actual reviewed graph')
review_raw=cmd('gh','api','repos/yigini/soilfer-lims/issues/comments/6180876636');review=exact_json(review_raw)
source_review(review,index);authority=fresh_authority(review,index)
DEST.mkdir()
def save(n,raw):
    with (DEST/n).open('xb') as f:f.write(raw)
save('actual-source-review-original.json',review_raw);save('actual-source-review-readable.txt',review['body'].encode());save('source-index-original.json',(json.dumps(index,indent=2)+'\n').encode())
for n,raw in authority.items():save(n,raw)
save('independent-source-validation.json',(json.dumps({'status':'ACTUAL_EXACT_METADATA_ONLY_SOURCE_PASS_VALIDATED','sourceReviewId':6180876636,'reviewUtc':review['created_at'],'toolingCommit':TOOLING,'fiveRawSourceHashesVerified':True,'imageEligibility':False,'metadataCollectorsRun':0,'imageAdoptionReceipts':0,'proofLaunches':0,'productionDeployments':0,'validatedUtc':datetime.datetime.now(datetime.UTC).isoformat()},indent=2)+'\n').encode())
paths=sorted(p for p in DEST.iterdir() if p.is_file())+[pathlib.Path(__file__)]
readme=REPO/'WP/audit-release-eb6de2e8/README.md'
readme.write_bytes(('## 2026-10-14 actualCl metadata-only Source review PASS6180876636\n\nActual23:37:37UTC PASS binds0b01804f/full5hashes/exact233000metadataRoot/image1d/currentcde8/mainCI/scopedirections/reference/limits. Rawsourceverdict/index/freshauthorities/independentbinding retained at WP/batch-forward-metadata-cde8-20261014/actual-source-pass-6180876636/index.json. Only firstboundedmetadata capture nowauthorized; operator/package/root/unit notyetcreated. ImageEligibilityFALSE/no adoptionreceipt/fullgrowth verdict/proof/kit/gate/deploy. One reviewed preparation/upload/newunit only; ifSTOP/budget/interfaceunknown preserveall/no replay. Source review notes server-side read-only BuildKit size work canoutlive killedclient; do notstopdaemon orotherjobs. Fullvalidator/receipt source review stillrequired later.\n\n').encode()+readme.read_bytes());paths.append(readme)
index_path=DEST/'index.json'
with index_path.open('x',encoding='utf-8') as f:json.dump({'status':'ACTUAL_METADATA_ONLY_SOURCE_PASS_RETAINED','sourceReviewId':6180876636,'toolingCommit':TOOLING,'imageEligibility':False,'files':[{'path':p.relative_to(REPO).as_posix(),'bytes':p.stat().st_size,'sha256':sha(p.read_bytes())} for p in paths]},f,indent=2)
paths.append(index_path);rels=[p.relative_to(REPO).as_posix() for p in paths]
cmd('git','-c','core.autocrlf=false','add','-f','--',*rels)
require(set(cmd('git','diff','--cached','--name-only').decode().splitlines())==set(rels),'Staged owner differs')
for p,rel in zip(paths,rels):require(cmd('git','show',':'+rel)==p.read_bytes(),'Raw staged bytes differ')
cmd('git','commit','-m','Retain actual bounded metadata source PASS and independent bindings')
head=cmd('git','rev-parse','HEAD').decode().strip()
for p,rel in zip(paths,rels):require(cmd('git','show',head+':'+rel)==p.read_bytes(),'Raw Git bytes differ')
cmd('git','push','origin','audit/release-eb6de2e8')
require(cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head,'Pushed audit differs')
print(json.dumps({'status':'PUSHED_ACTUAL_METADATA_ONLY_SOURCE_PASS','head':head,'verifiedBlobs':len(paths),'sourceReviewId':6180876636,'toolingCommit':TOOLING,'imageEligibility':False,'metadataCollectorsRun':0}))
