"""Retain actual qualification acceptance and new kit scope. No host calls."""
import sys
sys.dont_write_bytecode=True
from prechecks6210209468_boundary_publication import *
N=W/'WP/batch-proof-mount-order-forward-be837974-20261016'
sys.path.insert(0,str(N))
import prepare_proof as prepare
import proof_contract as contract

assert git('rev-parse','HEAD').decode().strip()=='d48d804024fb0f67dcd32b84e54814bb27971003'
assert git('branch','--show-current').decode().strip()=='audit/release-eb6de2e8'
assert not git('diff','--cached','--name-only').strip()
D=N/'actual-result-accepted6212990400-once'
assert not D.exists()
verified=verify_publication('e5689d026138f5ecef76ade70ac6d3ee58518a95',N.relative_to(W).as_posix()+'/mount-order100000-closed-qualified-evidence-complete-publication-once/publication-index.json',11663)
index=json.loads((N/'exact-source-review568-once/source-index.json').read_bytes())
assert len(index['files'])==37
for name,pin in index['files'].items():
    raw=(N/name).read_bytes();assert len(raw)==pin['bytes'] and sha(raw)==pin['sha256']
frozen=json.loads((W/'WP/startup-order-readiness-20261015/full-pinned-copy-retention-bound-ordinary-once/source-before.json').read_bytes())
assert len(frozen)==1333 and all(sha((W/name).read_bytes())==digest for name,digest in frozen.items())
captures=[]
def read(path):
    raw=subprocess.check_output(['gh','api',path],cwd=W);captures.append((path,raw));return json.loads(raw)
review=read('repos/yigini/soilfer-lims/issues/comments/6212990400')
assert review['id']==6212990400 and review['created_at']==review['updated_at']=='2026-10-16T09:59:11Z'
assert review['performed_via_github_app']['id']==1236702 and review['performed_via_github_app']['slug']=='claude'
assert review['body'].splitlines()[0]=='Result review: mount-order100000 qualification run accepted as reported. Not deployed. Kit scope below.'
assert len(review['body'])==6662 and 'Main stays on merge hold.' in review['body']
projection=contract.authority_projection(review)
prepare.gh=read
evidence=prepare.current_evidence()
assert not any(c['id']>review['id'] and c.get('performed_via_github_app',{}).get('id')==1236702 and 'mount-order100000' in c.get('body','') and any(t in c['body'].lower() for t in ['changes required','result rejected','acceptance withdrawn']) for c in evidence['sourceComments'])
D.mkdir()
save(D,'actual-acceptance-original.json',captures[0][1])
save(D,'actual-acceptance-readable.txt',review['body'].encode())
save(D,'acceptance-semantic-projection.json',canonical(projection)+b'\n')
save(D,'current-authority-evidence.json',canonical(evidence)+b'\n')
for i,(path,raw) in enumerate(captures):save(D,'api-original-'+str(i).zfill(2)+'.json',raw)
save(D,'api-command-index.json',canonical([{'path':path,'file':'api-original-'+str(i).zfill(2)+'.json','bytes':len(raw),'sha256':sha(raw)} for i,(path,raw) in enumerate(captures)])+b'\n')
record={'verifiedUtc':utc(),'actualAcceptanceId':review['id'],'bodySha256':sha(review['body'].encode()),'semanticSha256':sha(canonical(projection)),'completePublicationVerified':verified,'source37Unchanged':True,'app1333Unchanged':True,'qualificationAccepted':True,'deployed':False,'mainMergeHold':True,'newKitScopeAuthorized':True,'newKitSourcePassExists':False,'singleUseGateExists':False,'hostOperations':0,'nativeResultFallbackCancelledAnswered':True,'nativeFallbackNeverRepeat':'2026-10-16T10:04:23Z','acknowledgementOnlyNextConcreteKitSourceReview':True,'parallel208207DirectUserAuthorizedAndAlreadyRunning':True,'reviewerPageCacheCauseExplanationIsHisInference':True}
save(D,'independent-acceptance-validation.json',canonical(record)+b'\n')
lead='LATEST ACTUAL QUALIFICATION ACCEPTED6212990400 / NEW RELEASE KIT SCOPE - 2026-10-16T09:59:11Z.\nActual unedited Claude app1236702/slugclaude accepts mount-order100000 result6212737130 as reported; qualification accepted, NOT DEPLOYED. BodySHA'+record['bodySha256']+'/semantic'+record['semanticSha256']+'. Full11664 public bindings independently reverified, all37 source and1333 frozen app inputs unchanged/current mainbe837974 CI38772398721 SUCCESS/#191CLOSED. Original runtime receipt a82a8f53 remains AWAITING; accepted closure combines stop-post36516567/nonvacuous2stoppedretained/errorsEMPTY plus successful09:19:58.494170 same-invocation lifecycle. No new proof or operator replay.\nNEW scope: build concrete be837974/acc15844/cd3a2757 release kit bound to THIS acceptance, exact source review then fresh YY single-use gate. Time quiesce503/stop-t10+actualexit/stopped integrityFK/backup/install/start/ready/reopen; disclose600s forward-only failure/held503/stoppedretained/no restore/partial receipt162 and explicit predecessor-restart policy. Verify unhealthy-state consumers beforegate. Bind postflight AFTER natural sync with enumerated per-table intake deltas. Gateplainimpact193new23holds20oldcrossduplicates1ZMBmanagernotification/otherlabs0/productionmaydiffer; freshYYlab-hub workload confirmation. Keep805blankheap/memory.events OOM0/diskfloor+10GB and release-day aborts/fullreceipt. Do not claim measured whole downtime fit until actual retained phase timings establish it. Leave all proof roots for now. MainMERGEHOLD until actual deployment plus Claudio postcheckPASS.\nResult6212737130 ANSWERED;10:04:23 native fallback CANCELLED forever/no duplicateACK/GH/native. Acknowledge621299 only in next concrete kit-source request. Direct human YES already started exclusive isolated208207 agents/worktrees; preserve both, no duplicates/additionalagents. Both source PRs audited after actual greenCI/mergesheld. No kit graph/sourcePASS/gate/deployment exists at this acceptance boundary; ACTUALLY implement concrete new kit now. R2COMPLETE/233000KEEPIT/no prune/no growrestart/no103/humansheld. HeartbeatACTIVE2min;restore10 only actualbeDEPLOYED+ClpostdeployPASS. All prior README bytes preserved below.\n\n'
print(json.dumps(boundary_publish(D,{__import__('pathlib').Path(__file__)},'Retain qualification acceptance6212990400 and concrete kit scope',lead)))
