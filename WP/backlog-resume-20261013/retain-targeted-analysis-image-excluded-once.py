"""Retain the local analysis refusal to adopt; no source direction/metadata recapture/adoption."""
import datetime,hashlib,json,pathlib,subprocess
REPO=pathlib.Path(__file__).resolve().parents[2]
DEST=REPO/'WP/batch-forward-metadata-cde8-20261014/retained-targeted-analysis-no-adoption-once'
def cmd(*a):return subprocess.check_output(a,cwd=REPO)
assert cmd('git','rev-parse','HEAD').decode().strip()=='2f7594ac4596ae71e2f912533f371c1492165cb6' and not cmd('git','diff','--cached','--name-only').strip()
v=json.loads((DEST/'analysis-original.json').read_bytes());assert v['status']=='RETAINED_METADATA_INSUFFICIENT_FOR_IMAGE_ADOPTION' and v['adoptionMustStop'] and not v['imageEligibility'] and v['growthBytesCreditedByThisAnalysis']==0
paths=sorted(p for p in DEST.iterdir() if p.is_file())+[REPO/'WP/backlog-resume-20261013/analyse-retained-targeted-metadata-no-adoption-once.py',pathlib.Path(__file__)]
readme=REPO/'WP/audit-release-eb6de2e8/README.md'
readme.write_bytes(('## 2026-10-15 retained metadata attribution INSUFFICIENT — no image adoption\n\nLOCALretained-only analysis CLOSED00:09:58.130UTC validates133originalreads/actual59snapshots/58Createdduringactualfailedbuildwindow22:33:26.906969..22:38:24.457022/1older;379cache records/68Createdduringwindow/58Shared10unshared. Humanformattedusage/cacheSizes rounded; sharedcache/image overlap lacksphysicalunionmapping; exactOCIcompresseddescriptorlengths areNOTphysicalbeforeaftergrowth. Missingprebuildcontainerdallocation remainsUNKNOWN. Pointtotals retained clearlyrounded/non-disjoint/uncredited; creditedgrowth0/unproven3,609,116,672B>=500MBSTOP; image1dFORENSICEXCLUDED/noadoptionreceipt/validatorauthority. Fullsnapshot/cache classifications/originalinputhashes at retained-targeted-analysis-no-adoption-once/index.json. No newCLI/API/source/productionconnection/proof/kit/gate/deploy. Peractual618023fallback, prepare a genuinelyNEW corrected Docker+containerd beforeafter-accounting BUILDONLY source for separateexactClreview; no sourcePASS/buildauthority inferred and originalfailedbuild/metadata roots never replay. Docsprimarylinks explainoverlap, nothost measurements; user/history/humanDraft preserved.\n\n').encode()+readme.read_bytes());paths.append(readme)
idx=DEST/'index.json'
with idx.open('x',encoding='utf-8') as f:json.dump({'status':'RETAINED_LOCAL_ANALYSIS_IMAGE_EXCLUDED','analysisUtc':v['analysedUtc'],'imageEligibility':False,'newBuildAuthority':None,'forwardBuildSourceReviewAllowedByDirection':6180234041,'files':[{'path':p.relative_to(REPO).as_posix(),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in paths]},f,indent=2)
paths.append(idx);rels=[p.relative_to(REPO).as_posix() for p in paths]
cmd('git','-c','core.autocrlf=false','add','-f','--',*rels);assert set(cmd('git','diff','--cached','--name-only').decode().splitlines())==set(rels)
def verify(head):
    for p,rel in zip(paths,rels):
        meta,path=cmd('git','ls-tree','-z',head,'--',rel).rstrip(b'\0').split(b'\t',1);mode,kind,oid=meta.decode().split();assert kind=='blob' and path.decode()==rel
        raw=cmd('git','cat-file','blob',oid);assert raw==p.read_bytes() and hashlib.sha1(('blob '+str(len(raw))+'\0').encode()+raw).hexdigest()==oid
verify(cmd('git','write-tree').decode().strip());cmd('git','commit','-m','Retain local timestamp and shared-size analysis with image adoption refused')
head=cmd('git','rev-parse','HEAD').decode().strip();verify(head);cmd('git','push','origin','audit/release-eb6de2e8');assert cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head
print(json.dumps({'status':'PUSHED_RETAINED_ANALYSIS_IMAGE_EXCLUDED','head':head,'verifiedBlobs':len(paths),'imageEligibility':False,'newBuildAuthority':None}))
