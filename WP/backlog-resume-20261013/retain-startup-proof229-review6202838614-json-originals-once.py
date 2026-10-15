"""Retain and publish the one actual source-review delivery; never repost."""
import datetime,hashlib,json,pathlib,subprocess,sys
repo=pathlib.Path(__file__).resolve().parents[2];source=repo/'WP/batch-proof-startup-be837974-20261015';sys.path.insert(0,str(source))
from proof_contract import *
def git(*args,input=None):return subprocess.check_output(['git','-c','core.longpaths=true','-c','core.autocrlf=false',*args],cwd=repo,input=input)
base=git('rev-parse','HEAD').decode().strip();assert base=='29fa000751f25447f1ff8c129b0dfcc5d2b67445' and not git('diff','--cached','--name-only')
delivery=source/'exact-source-review-29fa0007-once';record=exact_json((delivery/'delivery-record.json').read_bytes());assert record['commentId']==6202838614 and record['allLiteralReviewBindings']==112
raw=subprocess.check_output(['gh','api','repos/yigini/soilfer-lims/issues/comments/6202838614'],cwd=repo)
request=exact_json((delivery/'post-request-exact.json').read_bytes());assert exact_json(raw)['body']==request['body']==exact_json((delivery/'post-response-original.json').read_bytes())['body']
(delivery/'actual-review-body-utf8-raw.txt').write_bytes(request['body'].encode())
(delivery/'local-text-newline-retention-derived.json').write_bytes(canonical({'status':'LOCAL_RETENTION_TEXT_NEWLINE_MISMATCH_ONLY','originalRequestJsonEqualsActualGithubBody':True,'actualUnedited':exact_json(raw)['created_at']==exact_json(raw)['updated_at'],'localTextFileContainsWindowsCRCRLF':(delivery/'review-body-exact.txt').read_bytes().count(b'\r\r\n'),'authoritativeBodies':['post-request-exact.json','post-response-original.json','actual-review-body-utf8-raw.txt'],'firstRetainerRefusedBeforeOutputStageCommitHostOperation':True,'postOrServerOperationReplayed':False,'originalFailureToolOutputTranscription':'AssertionError comparing GH body to universal-newline decoded local text; request JSON and actual response/readback independently equal.'})+b'\n')
(delivery/'fresh-actual-request-original.json').write_bytes(raw)
idx=exact_json((source/'source-publication-index.json').read_bytes());rows=idx['files']
b=(source/'source-publication-index.json').read_bytes();rows=rows+[{'path':source.relative_to(repo).as_posix()+'/source-publication-index.json','length':len(b),'sha256':sha(b),'gitBlobOid':hashlib.sha1(('blob '+str(len(b))+'\0').encode()+b).hexdigest()}]
def batch(refs):
    data=git('cat-file','--batch',input=('\n'.join(refs)+'\n').encode());at=0;out=[]
    for ref in refs:
        end=data.index(b'\n',at);oid,kind,size=data[at:end].decode().split();size=int(size);at=end+1;raw=data[at:at+size];at+=size;assert kind=='blob' and len(raw)==size and data[at:at+1]==b'\n';at+=1;out.append((oid,raw))
    assert at==len(data);return out
for r,(oid,b) in zip(rows,batch([base+':'+r['path'] for r in rows])):assert oid==r['gitBlobOid'] and sha(b)==r['sha256'] and len(b)==r['length']
index=exact_json((delivery/'tooling-source-index.json').read_bytes());assert graph(index)=={n:sha((source/n).read_bytes()) for n in FILES}
frozen=exact_json((repo/'WP/startup-order-readiness-20261015/full-pinned-copy-retention-bound-ordinary-once/source-before.json').read_bytes())
assert len(frozen)==1333 and all(sha((repo/n).read_bytes())==d for n,d in frozen.items())
fresh=subprocess.check_output(['gh','api','repos/yigini/soilfer-lims/issues/162/comments?since=2026-10-15T21:39:24Z&per_page=100'],cwd=repo)
(delivery/'fresh-coordination-overlap-original.json').write_bytes(fresh)
observed=datetime.datetime.now(datetime.timezone.utc).isoformat()
(delivery/'independent-delivery-validation.json').write_bytes(canonical({'status':'EXACT_SOURCE_REQUEST_READBACK_AND_ALL630_SOURCE_PUBLICATION_BLOBS_VERIFIED','observedUtc':observed,'commentId':6202838614,'sourceCommit':base,'all630SourceRawOidShaLengthVerified':True,'all14SourceHashesUnchanged':True,'all1333ApplicationInputsUnchanged':True,'actualSourcePassClaimed':False,'newCommentsObserved':[{k:c[k] for k in ['id','created_at','updated_at']} for c in exact_json(fresh)],'operatorsExecuted':0})+b'\n')
lead="""LATEST SOURCE HANDOFF â€” 2026-10-15 21:44 UTC. COMPLETE new14-file proof source PUBLISHED29fa000751f25447f1ff8c129b0dfcc5d2b67445 at WP/batch-proof-startup-be837974-20261015/README.md/source-publication-index.json;ALL629indexedraws+index630 independentlyGitOID/SHA/lenverified/229LOCAL+229ACTUALhostPython3.9.23 guardsPASS/14hashes+1333appinputs unchanged. ONE@claude#162NEWexactSourceReview6202838614 POSTED21:39:25UTC https://github.com/yigini/soilfer-lims/issues/162#issuecomment-6202838614 ALL14SHA+112literalbindings/completegraph/actual229both/source457apprawpins/newroot/newR4. BundlesONLYHERE R2acceptance6202252017ACK+YYback6202595120+conditionalgrow6202615241ACK+fullpostrebootdisk-prod-health result. NOduplicateACK/native/source-request. ActualNEWproof SourcePASS stillrequiresFULLactualread+ownapproval/allhash/currentauthority/newunusedrootunit/freshEXACTpackageR4beforeROOT/unit/runtime. No operationalproofpackage/root/unit/defaultstartup/cleanup/deploy. Proposed230000rootABSENT/unitnot-found ONLYat21:32reference. NativefallbackONLYifanswer missing~20min after21:39:25/freshactualtargetEMPTYcomposer/humanspreserved; notbefore~21:59/no duplicatehandoff. Serverhold6202483884 supersededbyactualYYback6202595120;spacealreadyvisible320GiBdisk343597383680B/ext4FS338094891008B/free109582163968B/3productionhealthyHTTP200restarts0. NOhostgrowth/restart/change performed. Fresh21:32 newR4ref req41768863854B INCLUDING10GB EXCLUDINGfutureexactpackage vsfree109577981952B EACH SAMEFS/notadditive/referenceNOTlaunchauthority. Allscience/R1-R5/history/forwardonly/mainmergeHOLD/humans guards held.

"""
readmes=[repo/'WP/audit-release-eb6de2e8/README.md',repo/'WP/runtime-recovery-kobo/README.md']
for p in readmes:p.write_bytes(lead.encode()+p.read_bytes())
files=[p for p in delivery.iterdir() if p.is_file()]+readmes+[repo/'WP/backlog-resume-20261013/retain-startup-proof229-review6202838614-once.py',repo/'WP/backlog-resume-20261013/request-startup-acc158-proof229-exact-source-review-once.py',pathlib.Path(__file__)]
def meta(p):
    b=p.read_bytes();return {'path':p.relative_to(repo).as_posix(),'length':len(b),'sha256':sha(b),'gitBlobOid':hashlib.sha1(('blob '+str(len(b))+'\0').encode()+b).hexdigest()}
items=[meta(p) for p in files];publication=delivery/'publication-index.json';assert not publication.exists()
publication.write_bytes(canonical({'status':'ONE_ACTUAL_NEW_SOURCE_REVIEW_REQUEST_PUBLICATION','sourceCommit':base,'commentId':6202838614,'files':items})+b'\n');files.append(publication);items.append(meta(publication))
paths=[p.relative_to(repo).as_posix() for p in files]
assert not git('diff','--cached','--name-only') and git('rev-parse','HEAD').decode().strip()==base
for at in range(0,len(paths),20):git('add','-f','--',*paths[at:at+20])
assert set(git('diff','--cached','--name-only','-z').decode().split('\0'))-{''}==set(paths)
for row,(oid,b) in zip(items,batch([':'+r['path'] for r in items])):assert oid==row['gitBlobOid'] and len(b)==row['length'] and sha(b)==row['sha256']
git('commit','-m','audit: retain exact startup proof source review6202838614')
head=git('rev-parse','HEAD').decode().strip()
for row,(oid,b) in zip(items,batch([head+':'+r['path'] for r in items])):assert oid==row['gitBlobOid'] and len(b)==row['length'] and sha(b)==row['sha256']
git('push','origin','HEAD:refs/heads/audit/release-eb6de2e8')
assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head and not git('diff','--cached','--name-only')
print(json.dumps({'status':'PUBLISHED_ACTUAL_ONE_SOURCE_REVIEW_DELIVERY','head':head,'sourceCommit':base,'commentId':6202838614,'rawOidShaLengthVerified':len(items),'all630SourcePublicationBlobsVerified':True,'all14SourceAnd1333ApplicationHashesUnchanged':True,'actualNewSourcePassNotClaimed':True,'operatorsExecuted':0}))

