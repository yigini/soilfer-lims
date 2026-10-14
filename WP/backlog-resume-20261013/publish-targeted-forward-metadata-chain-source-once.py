"""Publish only owned targeted successor/source evidence; raw OID verification avoids Windows long paths."""
import ast,datetime,hashlib,json,pathlib,subprocess,sys
REPO=pathlib.Path(__file__).resolve().parents[2]
SOURCE=REPO/'WP/batch-forward-metadata-cde8-20261014'
PREFIX='WP/batch-forward-metadata-cde8-20261014/'
BASE='1da5885659f5bfd7831e51f30471ed068e8550f7'
OLD='0b01804f9d409d74a19472c22469824e2df95005'
def cmd(*a):return subprocess.check_output(a,cwd=REPO)
def raw_git(head,rel):
    listing=cmd('git','ls-tree','-z',head,'--',rel)
    if not listing:return None
    meta,path=listing.rstrip(b'\0').split(b'\t',1);mode,kind,oid=meta.decode().split()
    assert path.decode()==rel and kind=='blob'
    raw=cmd('git','cat-file','blob',oid)
    assert hashlib.sha1(('blob '+str(len(raw))+'\0').encode()+raw).hexdigest()==oid
    return raw
def record(p,v):
    with p.open('x',encoding='utf-8') as f:json.dump(v,f,indent=2,ensure_ascii=False)
assert cmd('git','rev-parse','HEAD').decode().strip()==BASE
assert cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==BASE
assert not cmd('git','diff','--cached','--name-only').strip()
sys.path.insert(0,str(SOURCE))
from forward_metadata_contract import *
proof=exact_json((SOURCE/'targeted-chain-source-verification-once/exit-original.json').read_bytes())
require(proof['status']=='PASS_TARGETED_METADATA_SOURCE_GUARDS_NOT_EXECUTION' and proof['sourceUnchanged'] and proof['localGuardTests']==proof['actualHostGuardTests']==18,'Current targeted proof missing')
for n,d in proof['sourceSha256After'].items():require(sha((SOURCE/n).read_bytes())==d,'Frozen source changed')
changed=[n for n in sorted(SOURCE_FILES) if raw_git(OLD,PREFIX+n)!=(SOURCE/n).read_bytes()]
require(changed==['collect_forward_metadata.py','forward_metadata_contract.py','verify_forward_metadata_guards.py'],'Only targeted collector/contract/guards may change')
def methods(raw):
    node=next(v for v in ast.parse(raw).body if isinstance(v,ast.ClassDef));lines=raw.splitlines(keepends=True)
    return {v.name:b''.join(lines[v.lineno-1:v.end_lineno]) for v in node.body if isinstance(v,ast.FunctionDef) and v.name.startswith('test_')}
oldtests=methods(raw_git(OLD,PREFIX+'verify_forward_metadata_guards.py'));newtests=methods((SOURCE/'verify_forward_metadata_guards.py').read_bytes())
require(len(oldtests)==14 and len(newtests)==18 and set(oldtests)<=set(newtests),'Old guard inventory lost')
adapted=[n for n in oldtests if oldtests[n]!=newtests[n]]
require(adapted==['test_exact_first_new_root_is_bound_and_failed_root_or_aliases_refuse'],'Only original root guard may be adapted')
delta={'status':'EXACT_TARGETED_METADATA_DELTA_VERIFIED','oldSource':OLD,'baseAudit':BASE,'changedSourcePaths':changed,'unchangedSourcePaths':sorted(SOURCE_FILES-set(changed)),'oldGuardCount':14,'newGuardCount':18,'oldGuardsByteIdentical':13,'onlyAdaptedOldGuard':adapted,'addedGuards':sorted(set(newtests)-set(oldtests)),'actualCompleteCatalogue':1526,'selectedCandidateCount':59,'allSelectedCommittedWithExactParents':True,'catalogueTruncated':False,'imageEligibility':False,'newSourceReview':None,'metadataOperatorsExecuted':0}
delta_path=SOURCE/'targeted-chain-source-delta-original.json';record(delta_path,delta)
closed=proof['closedUtc']
lead='''# Targeted successor after the first metadata capture stopped

The original metadata root233000 is CLOSED STOP_METADATA_INCOMPLETE_IMAGE_EXCLUDED, exit1, not successful. Its eight read-only calls exited0; the fresh image response equals the first forensic response byte-for-byte. The complete moby snapshot catalogue contains1,526unique keys and exceeded the original80-key query limit. No truncation or per-key usage/cache/OCI calls occurred. Full original evidence remains at e8f2f2e330ab8daa987c269fe576f2a4a9f15874/first-metadata-233000-closed-stop/index.json. A Windows long revision:path verification refusal after commit was retained honestly; the OID-only completion verified all91blobs and pushed the same commit, then retained the error/completion at1da5885659f5bfd7831e51f30471ed068e8550f7. Never replay233000 or its operators/retainers. Original0bSourcePASS6180876636 authorized only that consumed capture.

This NEW source keeps the complete namespace/content/snapshot catalogues intact and selects the candidate's exact59RootFS layer ChainIDs plus every parent, rather than query unrelated snapshots. Each selected key must exist once in the complete catalogue, be Committed and have the exact prior ChainID parent. Missing/duplicate/malformed/uncommitted/wrong-parent input refuses. The80selected-key limit is unchanged; nothing is truncated, and the full catalogue retains its2MiB bound. Only the moby candidate chain receives info/usage calls; buildkit retains its complete catalogue without per-key traversal. This deliberately gathers targeted metadata and makes no completeness claim for all daemon snapshots or full growth accounting.

The new exact root is /opt/lims/releases/workflow-batch-forward-metadata-cde8c889-20261015T000500Z. The original233000root is explicitly refused by the successor. All19package inputs, immutable forensic reference roles/modes/absence, source/main/CI/direction/rejection checks, command whitelist, client state isolation, exclusive intents and unused-unit guards remain. Same10secondcalls/2MiBoutputs/256commands/600secondcollection/900secondunit/805306368memory/swap0/floor10556150894/500000000abort, both YY pins, OCI<=32, and zero filesystem du/build/retag/pull/push/save/load/container-start/prune/DB/volume/daemon/config changes remain.

Current verification CLOSED '''+closed+''':18local and18actual host Python3.9pure guards PASS; all5source files compiled and hashes unchanged. Both environments selected the same59unique Committed exact-parent keys from the actual complete retained1,526-row catalogue, whose244320bytes/SHA256f9ac4687d7fa74206c9a598a42ffd8c05116e3224c8758e17227a01c90464461 remain immutable. No metadata operator or API was run by verification. Thirteen prior guards remain byte-identical, one old root guard is adapted only to reject old233000/newroot aliases, and four additional selection/refusal tests cover the change. Preparer/launcher source bytes are unchanged. Exact source delta and original logs/witness/host in-memory verification are beside this README.

NEW actual exact-source Claudio PASS is required before any package/upload/collector at000500; old0bPASS and scope/reference directions6180234041/6180335648 do not approve the successor. Candidate image1d4882f49f351a08549c79c0409f7848dbb205feef314b33432aae63ed11217b remains forensic excluded. The original build221500 failed its unchanged500MBgate with unexplained3,609,116,672B; missing pre-build containerd allocation stays unknown. This source captures evidence only; it cannot adopt the image, make it proof-eligible, create an adoption receipt or claim full disk-growth attribution. A separately reviewed validator/receipt source must satisfy all six actual directions, with residual>=500MB STOP.

Maincde8/tree638/mainCI38636615469attempt1 SUCCESS370/5649 and the three application PASS/merges remain. No production-copy proof/counts/installer/default-entrypoint/kit/gate/deploy/#103connection. All future exact adoption/proof/kit reviews, policyPRESENT/NO_OP0orSTOP, actual214/209impact/invalidStoredAnalysisSampleCount/sample-owner lists, retained allocation accounting/nonzero lists toYY/approved-amendment nonzeroSTOP/separate forward remedy/fresh single-use gate remain required. Human files/drafts/cards and historical artifacts stay untouched.

---

Historical original source description, retained for provenance:

'''
readme=SOURCE/'README.md';readme.write_bytes(lead.encode()+readme.read_bytes())
tracking=REPO/'WP/audit-release-eb6de2e8/README.md'
tracking.write_bytes(('## 2026-10-14 NEW targeted metadata000500 source verified, review required\n\nOriginal233000STOP/1526keys/all8reads/byte-exactimage remains immutable e8f/1da; never replay. New exact candidate59-chain selection/fullcatalogue/no truncation/same80keybound, all parent+Committed checks. Current18local+18actualhost3.9guards/all5compile/hashunchanged/actual1526catalogue59keys PASS '+closed+'. Only3source paths changed;13priorguards byteidentical/1rootguard adapted/+4targetedtests; preparer+launcher byteidentical. New fixed000500root/package/unit UNCREATED and unapproved; need actual NEW exact-sourcePASS. EvidenceONLY/imageexcluded/fullGrowthAttributionfalse/noadoptionreceipt/proof/kit/gate/deploy/DB/103. All six forward directions, original500MBfailure/3.609GBunknown, pins/limits/history/human drafts hold.\n\n').encode()+tracking.read_bytes())
paths=[SOURCE/n for n in sorted(SOURCE_FILES)]+sorted(p for p in (SOURCE/'targeted-chain-source-verification-once').iterdir() if p.is_file())+[delta_path,readme,tracking,REPO/'WP/backlog-resume-20261013/verify-targeted-forward-metadata-chain-source-once.py',pathlib.Path(__file__)]
index_path=SOURCE/'targeted-chain-source-publication-index.json'
record(index_path,{'status':'TARGETED_METADATA_SUCCESSOR_REVIEW_READY_NOT_APPROVED','preparedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceSha256':proof['sourceSha256After'],'newRoot':str(safe_root(ROOT_NAME)),'newSourceReview':None,'newExecutionAuthority':None,'imageEligibility':False,'originalMetadataStopAudit':'e8f2f2e330ab8daa987c269fe576f2a4a9f15874','files':[{'path':p.relative_to(REPO).as_posix(),'bytes':p.stat().st_size,'sha256':sha(p.read_bytes())} for p in paths]});paths.append(index_path)
rels=[p.relative_to(REPO).as_posix() for p in paths];require(len(rels)==len(set(rels)),'Duplicate owner path')
expected={rel for p,rel in zip(paths,rels) if raw_git(BASE,rel)!=p.read_bytes()}
cmd('git','-c','core.autocrlf=false','add','-f','--',*rels)
require(set(cmd('git','diff','--cached','--name-only').decode().splitlines())==expected,'Staged owner differs')
for p,rel in zip(paths,rels):require(raw_git(cmd('git','write-tree').decode().strip(),rel)==p.read_bytes(),'Raw staged OID bytes differ')
cmd('git','commit','-m','Prepare exact candidate-chain metadata successor after complete-catalogue STOP')
head=cmd('git','rev-parse','HEAD').decode().strip()
for p,rel in zip(paths,rels):require(raw_git(head,rel)==p.read_bytes(),'Raw committed OID bytes differ')
cmd('git','push','origin','audit/release-eb6de2e8')
require(cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head,'Pushed audit differs')
print(json.dumps({'status':'PUSHED_TARGETED_METADATA_SUCCESSOR_REVIEW_READY','head':head,'verifiedOwnedBlobs':len(paths),'changedSourcePaths':changed,'localTests':18,'hostTests':18,'actualCatalogue':1526,'exactCandidateChain':59,'newExecutionAuthority':None,'imageEligibility':False}))
