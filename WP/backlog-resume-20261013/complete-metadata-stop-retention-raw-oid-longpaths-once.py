"""Finish the committed raw retention by Git object ID after honest Windows revision-path refusal."""
import hashlib,json,pathlib,subprocess
REPO=pathlib.Path(__file__).resolve().parents[2]
SOURCE=REPO/'WP/batch-forward-metadata-cde8-20261014'
DEST=SOURCE/'first-metadata-233000-closed-stop'
HEAD='e8f2f2e330ab8daa987c269fe576f2a4a9f15874'
def cmd(*args):return subprocess.check_output(args,cwd=REPO)
assert cmd('git','rev-parse','HEAD').decode().strip()==HEAD
assert not cmd('git','diff','--cached','--name-only').strip()
index=json.loads((DEST/'index.json').read_bytes())
assert index['status']=='ACTUAL_METADATA_STOP_RETAINED_IMAGE_EXCLUDED'
def blob(head,path):
    tree=cmd('git','ls-tree','-z',head,'--',path);meta,actual=tree.rstrip(b'\0').split(b'\t',1);mode,kind,oid=meta.decode().split()
    assert kind=='blob' and actual.decode()==path
    return cmd('git','cat-file','blob',oid)
for row in index['files']:
    raw=(REPO/row['path']).read_bytes();assert len(raw)==row['bytes'] and hashlib.sha256(raw).hexdigest()==row['sha256'] and blob(HEAD,row['path'])==raw,row['path']
index_rel=(DEST/'index.json').relative_to(REPO).as_posix();assert blob(HEAD,index_rel)==(DEST/'index.json').read_bytes()
cmd('git','push','origin','audit/release-eb6de2e8')
assert cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==HEAD
record=DEST/'postcommit-long-revision-path-refusal-transcription.json'
with record.open('x',encoding='utf-8') as f:json.dump({'status':'LOCAL_POSTCOMMIT_RAW_VERIFIER_REFUSED_BEFORE_PUSH','evidenceKind':'TOOL_OUTPUT_TRANSCRIPTION','consumedHelper':'retain-forward-metadata-233000-closed-stop-once.py','localExitCode':1,'literalError':'fatal: failed to stat revision:path: Filename too long','committedAudit':HEAD,'allStagedRawBlobsPreviouslyVerified':True,'completion':'Every original committed blob independently verified by ls-tree OID and cat-file, then same prepared commit pushed; no rename or original record change','productionOperations':0},f,indent=2)
paths=[record,pathlib.Path(__file__)];rels=[p.relative_to(REPO).as_posix() for p in paths]
cmd('git','-c','core.autocrlf=false','add','-f','--',*rels)
assert set(cmd('git','diff','--cached','--name-only').decode().splitlines())==set(rels)
for p,rel in zip(paths,rels):assert cmd('git','show',':'+rel)==p.read_bytes()
cmd('git','commit','-m','Retain local long revision-path refusal and OID verification completion')
head=cmd('git','rev-parse','HEAD').decode().strip()
for p,rel in zip(paths,rels):assert blob(head,rel)==p.read_bytes()
cmd('git','push','origin','audit/release-eb6de2e8')
assert cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head
print(json.dumps({'status':'PUSHED_CLOSED_METADATA_STOP_ALL_RAW_OID_VERIFIED','originalClosedAudit':HEAD,'currentAudit':head,'verifiedOriginalBlobs':len(index['files'])+1,'additionalRefusalBlobs':2,'validation':index['validation']}))
