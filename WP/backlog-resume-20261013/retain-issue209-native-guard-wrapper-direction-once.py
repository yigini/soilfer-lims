"""Retain the actual displayed native guard-error direction and read-only boundary once."""
import datetime,hashlib,json,subprocess,sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf8')
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent;dest=wp/'issue209-native-guard-wrapper-direction'
assert not dest.exists();dest.mkdir()
transcript="""Noted. Nothing is needed from you or from me right now.

#214: Main CI on the merge commit is green, 5566 out of 5566. #214 and #206 now wait for Pip's deploy kit. When it comes, I'll check four things before gate:
- the policy check reads PRESENT/NO_OP 0 (anything else means STOP);
- the snapshot disk accounting;
- the #214 impact counts;
- the #209 impact counts.

#209: For you to pass to Pip. Keeping every guard and fixing only the two assertions is the right call. Pip should not test against the Prisma wrapper's text. The service should catch the guard failure and turn it into its own error code, and the tests should check that code, because the wrapper text can change between Prisma versions. I'll audit when Pip asks for the exact-head review.
"""
(dest/'visual-transcription.txt').write_bytes(transcript.encode())
record={'recordedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'observationNoLaterThanUtc':'2026-10-14T09:25:55Z',
 'exactCaptureTimeAvailable':False,'source':'Actual returned Claude5311708 displayed LIMS Audit / Lab workflow audit and plan, visual transcription; not a native API export.',
 'initialProject':'Dashboards','action':'One visible LIMS Audit project selection followed by fresh state after its delayed navigation',
 'rightComposer':'EMPTY','centreHumanDraft':'can you go and ask Pip','humanDraftPreserved':True,
 'messageSent':False,'cardsAnswered':False,'applicationFullPass':False,'finalAuditRequest':False,'productionOperations':0,
 'direction':'Keep source guards; map wrapped guard errors to stable service-owned codes and verify actual application/Prisma calls before final audit.'}
(dest/'native-readonly-record.json').write_bytes((json.dumps(record,indent=2)+'\n').encode())
for filename,endpoint in [('issue209-original.json','issues/209'),('comments209-original.json','issues/209/comments')]:
 raw=subprocess.run(['gh','api','repos/yigini/soilfer-lims/'+endpoint],cwd=root,capture_output=True,check=True).stdout
 (dest/filename).write_bytes(raw)
rawPins={p.relative_to(root).as_posix():{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in dest.iterdir() if p.is_file()}
(dest/'index.json').write_bytes((json.dumps({'record':record,'rawFiles':rawPins},indent=2)+'\n').encode())
lead='''## 2026-10-14 #209 actual native stable guard-code direction read, human draft preserved

Fresh returnedClaude5311708 initiallyshowedDashboards; ONEvisible LIMS Audit project selection and freshdelayedstate returned actualLabworkflowauditandplan. CentreHUMANDRAFT "can you go and ask Pip" preserved/rightEMPTY/no typing/message/cardanswer. Observation no laterthan09:25:55UTC, exactcapturetimeunavailable. ActualCl: service mustcatchguardfailures andreturnitsownstablecode; testscheckthatcode, notPrismawrappertext. Retainvisualtranscription/read-onlyrecord/currentGH at issue209-native-guard-wrapper-direction/index.json; thisisNOTnativeAPIexport orfinal209auditPASS. NEXTmap209guardwrappers throughservices andactualORMtests keepingALLSQL/scanner/historyguards, then broaderoldfixtures/fullverification. PriorHTTP/readiness/impact/schema/scanners10/270PASS cc90bf53; clientstockbuildlint+actualdetachedChromiumPASS22a5d072/46verifiedblobs, NOTfull209PASS/PR/ready. Allpriorfailuresretainedhonestly. No runner/productionconnectioncollectionoperation. Cl2096163271808/standingcontinuation authorized;214mainCIcompletegreen366/5566/#214+#206undeployed/open/allhandoffs onceimmutable. Humancontent/103noapply/samewriter/historyguards hold.

'''
readmes=['WP/audit-release-eb6de2e8/README.md','WP/runtime-recovery-kobo/README.md']
for name in readmes:
 f=root/name;f.write_bytes(lead.encode()+f.read_bytes())
owned=list(rawPins)+[(dest/'index.json').relative_to(root).as_posix(),Path(__file__).relative_to(root).as_posix()]+readmes
def git(*args):return subprocess.run(['git',*args],cwd=root,capture_output=True,check=True).stdout
assert git('branch','--show-current').strip()==b'audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip()
git('add','--',*owned);assert set(git('diff','--cached','--name-only').decode().splitlines())<=set(owned)
for name,pin in rawPins.items():assert hashlib.sha256(git('show',':'+name)).hexdigest()==pin['sha256'],name
git('commit','-m','audit(209): retain actual native stable guard-code direction')
retained=git('rev-parse','HEAD').decode().strip()
for name,pin in rawPins.items():assert hashlib.sha256(git('show',retained+':'+name)).hexdigest()==pin['sha256'],name
git('push','origin','HEAD:refs/heads/audit/release-eb6de2e8');assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==retained
print(json.dumps({'auditHead':retained,'rawBlobsVerified':len(rawPins),'nativeMessageSent':False,'productionOperations':0}))
