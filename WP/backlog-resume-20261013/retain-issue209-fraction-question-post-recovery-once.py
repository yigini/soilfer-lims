"""Recover retention after the confirmed one POST; never posts or replays the original helper."""
import datetime,hashlib,json,subprocess,sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf8')
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent;dest=wp/'issue209-owned-fraction-order-probe'
assert not (dest/'post-retention-recovery-index.json').exists()
record=json.loads((dest/'question-post-record.json').read_bytes());assert record['id']==6166098211 and record['postedOnce']
fresh=subprocess.run(['gh','api','repos/yigini/soilfer-lims/issues/comments/6166098211'],cwd=root,capture_output=True,check=True).stdout
actual=json.loads(fresh);assert actual['id']==record['id'] and hashlib.sha256(actual['body'].encode()).hexdigest()==record['bodySha256']
assert actual['body']==(dest/'question-prepared.md').read_text(encoding='utf8')
(dest/'question-fresh-verified-original.json').write_bytes(fresh)
names=['comments-before-post-original.json','question-post-record.json','question-post-response-original.json','question-post-stderr-original.log','question-prepared.md','question-fresh-verified-original.json']
pins={(dest/name).relative_to(root).as_posix():{'bytes':(dest/name).stat().st_size,'sha256':hashlib.sha256((dest/name).read_bytes()).hexdigest()} for name in names}
recovery={'retainedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'postRecord':record,'confirmedFreshExactBody':True,'postCountThisHelper':0,
 'previousFailure':'Original helper completed probe push and the one confirmed POST, then narrow git add refused an ignored stderr.log. Partial staging is owned and retained; never replay original helper.',
 'rawFiles':pins,'productionOperations':0}
(dest/'post-retention-recovery-index.json').write_bytes((json.dumps(recovery,indent=2)+'\n').encode())
lead='''## 2026-10-14 #209 fraction scientific scope question POSTED ONCE6166098211

ActualGHquestion6166098211 posted10:17:55UTC at https://github.com/yigini/soilfer-lims/issues/209#issuecomment-6166098211, independentlyfreshverifiedexactbodySHA d89f30a6c60acd84444139f04893b43d78f3dc1abf88ee7f07b12fba3e5395e0. Neverduplicate/edit/repost/replay. Probeoriginals4verifiedblobspushedf87b30a039d51a2fef6734064d11400f7d4e7ba4: explicit4target normalizesTEXTURE, waives3fractionowners, onlyTEXTUREline, NO_LINEforfractions onNEWownedclone/originaltriple+source unchanged/notproduction/full209owner/DockerPASS. Proposedsource-onlysameTX preservationofexistingfractionWorkItems+newlinkedcompanionlineswhenlogicalTEXTUREtarget, retainalloldline/attemptrows/no broadenedlegacyfallback/generalnormalizerchange; actualClanswerPENDING untilfreshread. No fraction-relatedruntimechangebeforeanswer. Independentownedfixture contexts/wiring/aliquot-probe corrections authorizedmaycontinue. Originalretainerfailed AFTERconfirmedPOST because ignoredstderr.log narrowgitadd refused; newread-onlyrecoveryverifiedactualcomment andretainsownedpartialstage, noapp/CI/prodfailure/no remote replay. Records issue209-owned-fraction-order-probe/post-retention-recovery-index.json. Priorfamily181/65 b5f5566f/10-274PASSfbfc604d/clientUI22a5d072/native274checkpointab4d immutable. No runner/fullserverPASS/209PR/ready/audit/productionoperation. Samewriter/Cl209original6163271808/nativeguardcode1c153fda/humancontent/103noapply/historyguards hold.

'''
readmes=['WP/audit-release-eb6de2e8/README.md','WP/runtime-recovery-kobo/README.md']
for name in readmes:
 f=root/name;f.write_bytes(lead.encode()+f.read_bytes())
owned=list(pins)+[(dest/'post-retention-recovery-index.json').relative_to(root).as_posix(),Path(__file__).relative_to(root).as_posix()]+readmes
def git(*args):return subprocess.run(['git',*args],cwd=root,capture_output=True,check=True).stdout
assert git('branch','--show-current').strip()==b'audit/release-eb6de2e8'
assert set(git('diff','--cached','--name-only').decode().splitlines())<=set(owned)
assert git('rev-parse','HEAD').decode().strip()==record['sourceAuditHead']
git('add','-f','--',*owned);assert set(git('diff','--cached','--name-only').decode().splitlines())<=set(owned)
for name,pin in pins.items():assert hashlib.sha256(git('show',':'+name)).hexdigest()==pin['sha256'],name
git('commit','-m','audit(209): recover retention of confirmed once-posted fraction scope question')
retained=git('rev-parse','HEAD').decode().strip()
for name,pin in pins.items():assert hashlib.sha256(git('show',retained+':'+name)).hexdigest()==pin['sha256'],name
git('push','origin','HEAD:refs/heads/audit/release-eb6de2e8');assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==retained
print(json.dumps({'auditHead':retained,'actualQuestionId':record['id'],'postedOnceAlreadyVerified':True,'verifiedRawBlobs':len(pins),'postCountThisHelper':0,'productionOperations':0}))
