"""Retain the once-only read-only list delivery and publish exact raw blobs."""
import hashlib,json,pathlib,subprocess
R=pathlib.Path(__file__).resolve().parents[2];D=R/'WP/yy-host-capacity-options-6gb-20261015/claudio-handoff-once';BASE='420919a83fed52ee229caaee32158a0a61eccd59'
def cmd(*a):return subprocess.check_output(a,cwd=R)
def sha(b):return hashlib.sha256(b).hexdigest()
def raw(ref,name):
 b=cmd('git','show',ref+':'+name);oid=cmd('git','rev-parse',ref+':'+name).decode().strip();assert hashlib.sha1(('blob '+str(len(b))+'\0').encode()+b).hexdigest()==oid;return b
assert cmd('git','rev-parse','HEAD').decode().strip()==BASE and not cmd('git','diff','--cached','--name-only').strip()
assert cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==BASE
native=json.loads((D/'native-delivery-record.json').read_bytes());assert native['status']=='SENT_ONCE_VISUALLY_VERIFIED' and not native['cleanupApproved']
posted=json.loads((D/'post-response-original.json').read_bytes());assert posted['id']==6189575607 and posted['body']==(D/'posted-body.txt').read_text(encoding='utf-8')
after=D/'comments-after-native-original.json';assert not after.exists();b=cmd('gh','api','--paginate','--slurp','repos/yigini/soilfer-lims/issues/162/comments?per_page=100');after.write_bytes(b)
comments=[c for page in json.loads(b) for c in page];matches=[c for c in comments if c['id']==6189575607];assert len(matches)==1 and matches[0]['body']==posted['body']
later=[{'id':c['id'],'createdAt':c['created_at'],'author':c['user']['login']} for c in comments if c['id']>6189575607]
lead='''## 2026-10-15 six-GB exact list GIVEN TO CLAUDIO ONCE; no deletion approval

YY direct give-list instruction completed: ONE #162 read-only list comment6189575607/10:06:48UTC https://github.com/yigini/soilfer-lims/issues/162#issuecomment-6189575607 and ONE native fresh Claude7867734/LIMS Audit/Lab workflow audit and plan handoff, own HEAD+END/oneReturn/actual sentbubble/rightEMPTY/ClManifesting verified. Actual senttext+visualdeliveryrecord and freshafterGH retained at WP/yy-host-capacity-options-6gb-20261015/claudio-handoff-once/index.json. Do NOT repeat list/native/ACK. List+raw evidence29blobs independently OID/SHA verified and published420919a83fed52ee229caaee32158a0a61eccd59. Exact~6.083GB estimate and~4.957GB alternative explicitly disclose TWO distinct old backup restore points whose other exact copies are unverified; cache65exactIDs/3oldbackups/oneMuseumimage/3small fullyGitverifiedproofroots. All per-item sizes and dependencies linked. NO blanketprune/cleanup authority; YY exact-list approval remains required. NOTHINGdeleted/pruned/moved/untagged. Human cards/drafts untouched. Do NOT offer050000raw/060000DBfiles/currentDB/latestbackup/runningprodimage/unverifiedprooffolders/current-nextinputs/qualifiedbuilds/stoppedcontainers. On-demandlabimage/configuredimages/historicalLIMSrefs held. Any future removal needs exact YY approval and fresh dependency/state/tooling verification; this message/list is read-only only.

Claudio review response not inferred from Manifesting. Scope6189025975 still governs app performance-only correction; telemetry4PASS862079 remains DRAFT/notcompletefix/noPR/newCI/build/proof. Resume shared-startup work under unchanged scientific/refusal/integrity/hash/report/600s/805306368/forward-only guards; no cde8/B5/root retry. No active proof or local runner. Coordination remains active every10minutes; quiet unchanged, notify meaningful progress/failure/requireddecision. All historical evidence retained.

'''
readme=R/'WP/audit-release-eb6de2e8/README.md';readme.write_bytes(lead.encode()+readme.read_bytes())
out=D/'index.json';assert not out.exists()
paths=sorted(p for p in D.rglob('*') if p.is_file())+[R/'WP/backlog-resume-20261013/give-yy-six-gb-exact-list-to-claudio-once.py',pathlib.Path(__file__),readme]
with out.open('xb') as f:f.write(json.dumps({'status':'ONE_GITHUB_AND_NATIVE_READ_ONLY_LIST_DELIVERED','listCommit':BASE,'commentId':6189575607,'commentUrl':posted['html_url'],'nativeVerified':True,'cleanupApproved':False,'deleted':0,'laterCommentsMetadataOnly':later,'files':[{'path':p.relative_to(R).as_posix(),'bytes':p.stat().st_size,'sha256':sha(p.read_bytes())} for p in paths]},indent=2,sort_keys=True).encode()+b'\n')
paths.append(out);names=[p.relative_to(R).as_posix() for p in paths];assert len(names)==len(set(names))
for at in range(0,len(names),15):cmd('git','-c','core.autocrlf=false','-c','core.longpaths=true','add','-f','--',*names[at:at+15])
assert set(cmd('git','diff','--cached','--name-only').decode().splitlines())==set(names);tree=cmd('git','write-tree').decode().strip()
for p,n in zip(paths,names):assert raw(tree,n)==p.read_bytes(),n
cmd('git','commit','-m','Retain exact six-GB capacity list delivery to Claudio');head=cmd('git','rev-parse','HEAD').decode().strip()
for p,n in zip(paths,names):assert raw(head,n)==p.read_bytes(),n
cmd('git','push','origin','audit/release-eb6de2e8');assert cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head
print(json.dumps({'head':head,'verifiedOwnedBlobs':len(paths),'commentId':6189575607,'native':'SENT_ONCE_VERIFIED','cleanupApproved':False,'laterComments':later}))
