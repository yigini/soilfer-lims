"""Publish the completed read-only capacity list; no host operations."""
import hashlib,json,pathlib,subprocess
R=pathlib.Path(__file__).resolve().parents[2];D=R/'WP/yy-host-capacity-options-6gb-20261015';BASE='862079a557bfcf74b3936a18c285d56eef168a12'
def cmd(*args):return subprocess.check_output(args,cwd=R)
def sha(b):return hashlib.sha256(b).hexdigest()
def raw(ref,name):
 b=cmd('git','show',ref+':'+name);oid=cmd('git','rev-parse',ref+':'+name).decode().strip()
 assert hashlib.sha1(('blob '+str(len(b))+'\0').encode()+b).hexdigest()==oid
 return b
assert cmd('git','rev-parse','HEAD').decode().strip()==BASE
assert cmd('git','branch','--show-current').decode().strip()=='audit/release-eb6de2e8'
assert not cmd('git','diff','--cached','--name-only').strip()
assert cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==BASE
v=json.loads((D/'exact-review-list.json').read_bytes());assert v['totals']['estimatedCombinedBytes']==6083182001 and v['filesDeleted']==v['prunes']==0
assert len(v['cache'])==65 and len(v['proofFolders'])==3
assert all(x['allCurrentFileBytesHaveIndependentlyVerifiedElsewhereCopy'] for x in v['proofFolders'])
out=D/'publication-index.json';assert not out.exists()
lead='''## 2026-10-15 YY read-only six-GB exact host list complete; Claudio delivery requested

NEW direct YY request is LIST/SEND ONLY: give Claudio exact sizes/dependencies for about6GB; NOTHING deleted/pruned/moved/untagged and NO YY exact-list approval. Full readable list/JSON/four exact CSVs at WP/yy-host-capacity-options-6gb-20261015. Estimated6,083,182,001B decimal6.083GB: 65 exact unused/unshared BuildKit records4,140,195,008B, THREE old backup files1,689,980,928B, one unused Soil Museum previous image245,985,521B unique estimate, THREE fully Git-verified proof roots7,020,544B. TWO backups (dev_pre_issue155_20261003_132428.db and dev_pre_issue159_20261003_221538.db) are DISTINCT historical restore points with no other exact copy verified; must plainly disclose retirement/YY acceptance. Only failed_db_20261004_031055.db has an independently hash-verified keeper dev_pre_api_dialog218_20261004_031055.db. Keeping both distinct restore points yields4,956,528,049B/4.957GB alternative. Docker accounting is estimated, not measured reclaim/no blanket prune. Every cache ID/per-item bytes/parent-child dependency in exact CSV; none has children outside selected set.

Three offered closed roots ONLY metadata233000/020000/023000: all93 actual files freshly stable-hashed and matched independently to existing published raw Git blobs; no current mount/process-open-file/selected retained-release input consumer. Explicit050000 raw/060000 DB evidence and ALL unverified proof folders excluded. Running production image/currentDB/latestbackup and070000080000/current-next inputs excluded. OCI manifest aliases resolved: candidate1d has15 stopped-container consumers, not unused. Lab2026.10b15.275GB is still selected by hub LAB_IMAGE+env; manual-sync/Temporal admin-tools still Compose referenced; old LIMS images historicalprotected/release refs held. Exact dependency paths/raw sanitized metadata retained. Captures09:49:42 through09:57:50UTC/free27,415,519,232B reference ONLY. No SQL/live production DB content open/fetch/settings mutation. Claudio GitHub+native handoff next, no prior cleanup card authority inferred. Actual app-performance-only correction6189025975 and telemetry4PASS862079 remain current; no active runner/proof/new app PR/build. All standing scientific/retention/805306368/600/forward-only/no103 guards hold.

'''
readme=R/'WP/audit-release-eb6de2e8/README.md';readme.write_bytes(lead.encode()+readme.read_bytes())
helpers=['capture-yy-host-capacity-six-gb-metadata-once.py','capture-yy-six-gb-dependencies-backup-hashes-once.py','capture-six-gb-cache-parents-and-image-config-once.py','verify-six-gb-proof-copies-elsewhere-once.py','derive-yy-six-gb-exact-review-list-once.py']
paths=sorted(x for x in D.rglob('*') if x.is_file())+[R/'WP/backlog-resume-20261013'/n for n in helpers]+[pathlib.Path(__file__),readme]
index={'status':'READ_ONLY_EXACT_LIST_PUBLISHED_NO_DELETION_APPROVAL','totals':v['totals'],'filesDeleted':0,'prunes':0,'files':[{'path':p.relative_to(R).as_posix(),'bytes':p.stat().st_size,'sha256':sha(p.read_bytes())} for p in paths]}
with out.open('xb') as f:f.write(json.dumps(index,sort_keys=True,indent=2).encode()+b'\n')
paths.append(out);rels=[p.relative_to(R).as_posix() for p in paths];assert len(rels)==len(set(rels))
for at in range(0,len(rels),15):cmd('git','-c','core.autocrlf=false','-c','core.longpaths=true','add','-f','--',*rels[at:at+15])
assert set(cmd('git','diff','--cached','--name-only').decode().splitlines())==set(rels)
tree=cmd('git','write-tree').decode().strip()
for p,n in zip(paths,rels):assert raw(tree,n)==p.read_bytes(),n
cmd('git','commit','-m','Publish read-only six-GB host capacity options and dependencies');head=cmd('git','rev-parse','HEAD').decode().strip()
for p,n in zip(paths,rels):assert raw(head,n)==p.read_bytes(),n
cmd('git','push','origin','audit/release-eb6de2e8');assert cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head
print(json.dumps({'head':head,'verifiedOwnedBlobs':len(rels),'estimatedGb':6.083182001,'deleted':0,'ClaudioDelivery':'NEXT'}))
