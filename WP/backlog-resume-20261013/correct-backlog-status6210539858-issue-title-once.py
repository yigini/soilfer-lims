"""Correct the mistaken #216 description in the same status comment, once."""
import json,pathlib,subprocess
from prechecks6210209468_boundary_publication import *
D=B/'backlog-status6210539858-title-correction-once';Q=B/'backlog-seven-status6210510617-once';assert not D.exists() and not git('diff','--cached','--name-only').strip();D.mkdir()
args=['gh','api','repos/yigini/soilfer-lims/issues/comments/6210539858'];r=subprocess.run(args,capture_output=True,timeout=90);save(D,'actual-before-original.json',r.stdout);assert r.returncode==0;before=json.loads(r.stdout)
assert sha(before['body'].encode())=='aeec5180aa2cbc0e323edc3fd392c63b10beebf31a844c0b798f94747a7c0c26' and before['created_at']==before['updated_at']=='2026-10-16T07:37:19Z'
assert before['body'].count('| #216 Dashboard dependent work |')==1
body=before['body'].replace('| #216 Dashboard dependent work |','| #216 LOD/LOQ proposals from blank history |')
title=json.loads((Q/'api-original-03.json').read_bytes());assert title['number']==216 and title['title']=='[Audit 7.3] LOD/LOQ proposals from blank history'
save(D,'patch-request.json',canonical({'body':body})+b'\n');save(D,'correction-intent.json',canonical({'utc':utc(),'commentId':6210539858,'reason':'I used an incorrect generic description for216; correct it to the actual retained issue title. All seven NOT_STARTED statuses and release priorities remain unchanged.','duplicateComment':False,'newSourceOrHostWork':False})+b'\n')
r=subprocess.run(['gh','api','--method','PATCH','repos/yigini/soilfer-lims/issues/comments/6210539858','--input',str(D/'patch-request.json')],capture_output=True,timeout=90);save(D,'actual-patch-response.json',r.stdout);save(D,'patch-stderr.log',r.stderr);save(D,'patch-exit.json',canonical({'returnCode':r.returncode})+b'\n');assert r.returncode==0,'Unknown patch outcome inspect same comment never replay'
after=json.loads(r.stdout);assert after['body']==body and after['created_at']==before['created_at']
r=subprocess.run(args,capture_output=True,timeout=90);save(D,'actual-fresh-readback.json',r.stdout);assert r.returncode==0;fresh=json.loads(r.stdout);assert fresh['body']==body and fresh['updated_at']==after['updated_at']
record={'commentId':6210539858,'createdUtc':after['created_at'],'updatedUtc':after['updated_at'],'bodySha256':sha(body.encode()),'only216TitleCorrected':True,'allSevenStatusesRemainNotStarted':True,'originalStatusBodyPreserved':True,'duplicateComment':False,'requestResponseFreshEqual':True};save(D,'correction-record.json',canonical(record)+b'\n')
lead=f'''LATEST QUEUED STATUS COMMENT6210539858 TITLE CORRECTEDONCE - {record['updatedUtc']}.
Same existing statuscomment6210539858 nowcorrectly labels216 LOD/LOQ proposals from blank history; earlier Dashboard dependent work was my incorrect generic description. ONLYthatlabel corrected/ALL7NOTSTARTED statuses+releasepriorityunchanged/NOduplicatecomment/source/branch/hostwork. Original07:37:19body retainedverbatim in priorpublicationee07b8e5; exactPATCHrequestresponsefreshreadback at WP/controller063000-prechecks-be837974-20261016/backlog-status6210539858-title-correction-once/publication-index.json. CurrentbodySHA{record['bodySha256']}/updated{record['updatedUtc']}; don'trequirestatuscommentuneditedafterthisexplicitcorrection.
Cl6210510617 is unrelatedqueuedstatusrequest and NOT080000resultacceptance. ActualC1PASS/C2FAIL review6210471146 STILLPENDING/nativefallbackONLYTHISunansweredNOEARLIER07:52:50UTC/no duplicates. All080000operatorsCONSUMED/NOnewremedygraph/sourcePASS/package/attempt/noqualificationkitgatedeploy/MainMERGEHOLD. AllprivatekeysDBsinspectstreamsHOST0400NEVERFETCH. SAMEheartbeatACTIVE2min/restore10ONLYactualbeDEPLOYED+ClactualpostdeployPASS. Preserve ALLolderhistoryverbatimbelow.

'''
out=boundary_publish(D,[pathlib.Path(__file__)],'Correct only issue216 title in existing queued status comment',lead);print(json.dumps({**out,**record}))
