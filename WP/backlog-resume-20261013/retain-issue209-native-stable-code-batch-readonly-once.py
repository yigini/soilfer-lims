import datetime,hashlib,json,subprocess,sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf8')
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent;dest=wp/'issue209-native-stable-code-batch-readonly'
assert not dest.exists();dest.mkdir()
text="""Noted. #209 is on track, and turning guard failures into the stable ORDER_ATTEMPT_INSERT_REFUSED code is what I wanted. Nothing is needed from you until Pip opens the PR and asks for the audit. When the deploy kit comes, it also needs the #209 impact counts (open work items that would be refused, split by case), next to the #214 counts.

#214 and #206 are merged and green but not yet in production. I suggest Pip finishes #209 first, so one kit and one deploy cover all three.
"""
(dest/'visual-transcription.txt').write_bytes(text.encode())
record={'recordedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'observationNoLaterThanUtc':'2026-10-14T10:41:23Z','exactCaptureTimeAvailable':False,
 'source':'Actual returned Claude5311708 LIMS Audit / Lab workflow audit and plan, visual transcription; not native API export.',
 'stableServiceCodeAccepted':True,'suggestedBatch':[206,214,209],'finalSourceAuditPass':False,'kitAuditPass':False,
 'fractionQuestion':6166098211,'fractionQuestionNativeHandoffSent':False,'typedTextForFractionQuestion':False,'returnForFractionQuestion':0,
 'boundary':'After popup cleared, one visible audit-project selection and delayed refresh showed correct thread/rightEMPTY/centreHUMANDRAFT. One focus click refreshed to OTHERproject after human switched projects; stopped before typing. No message/card/call action, no further UI input.',
 'lastObservedAuditCentreDraft':'can you go and ask Pip','humanContentUntouched':True,'productionOperations':0}
(dest/'native-readonly-record.json').write_bytes((json.dumps(record,indent=2)+'\n').encode())
pins={p.relative_to(root).as_posix():{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in dest.iterdir() if p.is_file()}
(dest/'index.json').write_bytes((json.dumps({'record':record,'rawFiles':pins},indent=2)+'\n').encode())
owned=list(pins)+[(dest/'index.json').relative_to(root).as_posix(),Path(__file__).relative_to(root).as_posix()]
def git(*args):return subprocess.run(['git',*args],cwd=root,capture_output=True,check=True).stdout
assert git('branch','--show-current').strip()==b'audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip()
git('add','--',*owned);assert set(git('diff','--cached','--name-only').decode().splitlines())<=set(owned)
for name,pin in pins.items():assert hashlib.sha256(git('show',':'+name)).hexdigest()==pin['sha256'],name
git('commit','-m','audit(209): retain stable code acceptance and human project-switch boundary')
retained=git('rev-parse','HEAD').decode().strip()
for name,pin in pins.items():assert hashlib.sha256(git('show',retained+':'+name)).hexdigest()==pin['sha256'],name
git('push','origin','HEAD:refs/heads/audit/release-eb6de2e8');assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==retained
print(json.dumps({'auditHead':retained,'verifiedRawBlobs':len(pins),'fractionNativeHandoffSent':False,'productionOperations':0}))
