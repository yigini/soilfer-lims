"""Retain real successor request/handoff and synthetic host originals; no production operation."""
import base64,datetime,json,pathlib,subprocess,sys
REPO=pathlib.Path(__file__).resolve().parents[2];SOURCE=REPO/'WP/batch-proof-cde8-20261015';DEST=SOURCE/'exact-controller-review-request-6a235c68';BASE='6a235c68ecf3a8ef8c405d49ff4d3f41bedabe38'
sys.path.insert(0,str(SOURCE))
from proof_contract import *
from prepare_proof import raw_git
def cmd(*a):return subprocess.check_output(a,cwd=REPO)
require(cmd('git','rev-parse','HEAD').decode().strip()==BASE and not cmd('git','diff','--cached','--name-only').strip(),'Same writer/empty staging required')
require(cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==BASE,'Remote moved')
original=exact_json((DEST/'actual-request-confirmed.json').read_bytes());native=exact_json((DEST/'native-delivery-record.json').read_bytes())
require(original['id']==6182530739 and original['body']==(DEST/'actual-request-body.txt').read_text(encoding='utf-8'),'Posted request differs')
require(native['actualSentBubbleVerified'] and native['rightEmptyAfterSend'] and native['returnPressCount']==1 and native['humanDraftAndCardsUntouched'],'Verified native delivery missing')
fresh_raw=cmd('gh','api','repos/yigini/soilfer-lims/issues/comments/6182530739');fresh=exact_json(fresh_raw);require(fresh['body']==original['body'] and fresh['created_at']==fresh['updated_at'],'Actual new request changed')
with (DEST/'actual-request-fresh-original.json').open('xb') as f:f.write(fresh_raw)
script='''import base64,hashlib,json,os,pathlib,stat
root=pathlib.Path('/tmp/lims-owned-stopped-copy-source-guards-20261015T021000Z');assert root.is_dir() and not root.is_symlink()
rows=[];total=0
for directory,children,files in os.walk(root,followlinks=False):
 children.sort();files.sort();d=pathlib.Path(directory);assert not d.is_symlink()
 for n in children:assert not (d/n).is_symlink()
 for n in files:
  p=d/n;a=p.stat();assert p.is_file() and not p.is_symlink() and a.st_size<=1048576
  raw=p.read_bytes();b=p.stat();assert (a.st_size,a.st_mtime_ns,a.st_mode,a.st_ino)==(b.st_size,b.st_mtime_ns,b.st_mode,b.st_ino)
  total+=len(raw);assert total<=8388608 and len(rows)<256
  rows.append({'path':p.relative_to(root).as_posix(),'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'mode':stat.S_IMODE(b.st_mode),'data':base64.b64encode(raw).decode()})
print(json.dumps({'status':'READONLY_SYNTHETIC44_HOST_FIXTURE_RAW_RETENTION','root':str(root),'files':rows,'productionConnections':0,'productionCopies':0,'noCleanup':True}))
'''
with (DEST/'synthetic-host-retainer-source.py').open('x',encoding='utf-8') as f:f.write(script)
r=subprocess.run(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=15','root@46.19.33.37','python3','-B','-'],cwd=REPO,input=script.encode(),capture_output=True,timeout=45)
for n,data in [('synthetic-host-stdout-original.json',r.stdout),('synthetic-host-stderr-original.log',r.stderr)]:
    with (DEST/n).open('xb') as f:f.write(data)
require(r.returncode==0,'Original synthetic retainer failed; retain, never replay');host=exact_json(r.stdout)
for row in host['files']:
    rel=pathlib.PurePosixPath(row['path']);require(not rel.is_absolute() and '..' not in rel.parts,'Unsafe synthetic path');raw=base64.b64decode(row.pop('data'));require(len(raw)==row['bytes'] and sha(raw)==row['sha256'],'Synthetic original hash differs');p=DEST/'synthetic-host-files'/str(rel);p.parent.mkdir(parents=True,exist_ok=True)
    with p.open('xb') as f:f.write(raw)
with (DEST/'synthetic-host-index.json').open('xb') as f:f.write(canonical(host)+b'\n')
raw_history=cmd('gh','api','--paginate','--slurp','repos/yigini/soilfer-lims/issues/162/comments?per_page=100')
with (DEST/'comments-after-handoff-original.json').open('xb') as f:f.write(raw_history)
later=[c for page in exact_json(raw_history) for c in page if c.get('created_at','')>original['created_at'] and BASE in c.get('body','') and (c.get('performed_via_github_app') or {}).get('slug')=='claude']
state='ACTUAL_REVIEW_RESPONSE_PRESENT_INSPECTION_REQUIRED' if later else 'ACTUAL_NEW_SUCCESSOR_SOURCE_PASS_PENDING'
lead='''## 2026-10-15 successor6a exact review6182530739/native ONCE — no dispatch

NEWcontroller6a235c68ecf3a8ef8c405d49ff4d3f41bedabe38/tenfilegraph/5changed5identical/44local+44actualhost3.9tests/all10compile/hashunchanged CLOSED01:44:34.381557UTC,96verifiedownedsource/evidenceblobs. Corrects policyABSENTcopiedDDL preflight via--dry-run; ownedstop independentoffailedreserve/headroom+THIScontrollertrackedID/exactb5owner/stopsbeforelogretention; everyinputancestor aliasrefused. Actual87df PASS6182389127 retained8c unchangedbutUNEXECUTED/supersededfornewcode. ONEnew#162request6182530739POSTED01:49:25UTC/full10hashes+3newliterals; ONEnativehandofffresh7867734/LIMS Audit/Labworkflow/EMPTYright/caret/ownEND+HEAD/oneReturn/actualbubbleemptyright/ClWorking verified, centrehumanDraft preserved. Actualtext/request/history/hostsyntheticraws at WP/batch-proof-cde8-20261015/exact-controller-review-request-6a235c68/index.json. Do NOTduplicate request/handoff/oldPASSack. New6a actualverdict mustbeinspectedseparately; statusatretention recordedinindex. ROOT020000/package/unitUNCREATED/no operators everrun. BeforeNEWexact6aPASS neverprepare/upload/launch/collect. Fullscope stillupstream snapshot/owned206214209install/jobsOFFstartupONLY/notreleasequalified/jobsONnatural+broadpostflights/exactkitfreshgate later. Allcounts/scientificlistsUNKNOWN. Old37/40PASS/failed44Windows264path43PASS1error/HOSTNOTRUN/publisherSyntaxRefusedBEFOREexecution keptimmutable; current44shortfixturePASS. Allglobalpolicycanonical/approvedSTOPYYlists/primarysecondaryallocation/allstoppedcontainers/retainedreleasesDockerctrd128DB3assets4GiB/floor500MBmem805readinessunitheadroom/YYpins/forwardonly/103/human/history guards hold.

'''
readme=REPO/'WP/audit-release-eb6de2e8/README.md';readme.write_bytes(lead.encode()+readme.read_bytes())
checkpoint={'status':state,'sourceCommit':BASE,'reviewRequestId':6182530739,'requestUtc':fresh['created_at'],'nativeDeliveredOnce':True,'actualLaterReviewerResponses':[{'id':c['id'],'created_at':c['created_at']} for c in later],'actualSuccessorPassValidated':False,'predecessorPass':6182389127,'predecessorUnexecuted':True,'localTests':44,'actualHostTests':44,'productionCopies':0,'productionConnections':0,'proofOperatorsExecuted':0,'rootCreated':False,'jobsOnQualificationStillRequired':True,'closedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat()}
with (DEST/'checkpoint.json').open('xb') as f:f.write(canonical(checkpoint)+b'\n')
paths=sorted(p for p in DEST.rglob('*') if p.is_file())+[REPO/'WP/backlog-resume-20261013/request-stopped-copy-controller-successor-review-once.py',pathlib.Path(__file__),SOURCE/'controller-publisher-syntax-refusal.json',readme];out=DEST/'index.json';require(not out.exists(),'Retainer consumed')
with out.open('xb') as f:f.write(canonical({**checkpoint,'files':[{'path':p.relative_to(REPO).as_posix(),'bytes':p.stat().st_size,'sha256':sha(p.read_bytes())} for p in paths]})+b'\n')
paths.append(out);rels=[p.relative_to(REPO).as_posix() for p in paths];require(len(rels)==len(set(rels)),'Duplicate owner')
for start in range(0,len(rels),15):cmd('git','-c','core.autocrlf=false','add','-f','--',*rels[start:start+15])
require(set(cmd('git','diff','--cached','--name-only').decode().splitlines())==set(rels),'Unowned staging');tree=cmd('git','write-tree').decode().strip()
for p,rel in zip(paths,rels):require(raw_git(tree,rel)[0]==p.read_bytes(),'Staged raw differs '+rel)
cmd('git','commit','-m','Retain corrected-controller exact source request, native delivery and synthetic raw originals');head=cmd('git','rev-parse','HEAD').decode().strip()
for p,rel in zip(paths,rels):require(raw_git(head,rel)[0]==p.read_bytes(),'Committed raw differs '+rel)
cmd('git','push','origin','audit/release-eb6de2e8');require(cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head,'Remote differs')
print(json.dumps({'status':state,'head':head,'verifiedOwnedBlobs':len(paths),'reviewRequestId':6182530739,'laterResponses':checkpoint['actualLaterReviewerResponses'],'productionCopies':0,'proofOperatorsExecuted':0}))
