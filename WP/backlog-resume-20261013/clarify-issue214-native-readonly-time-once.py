"""Clarify time precision without overwriting/replaying the original native record."""
import datetime,hashlib,json,subprocess
from pathlib import Path
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent
original=wp/'issue214-corrected-push-native-readonly/native-readonly-record.json'
dest=original.parent/'native-time-precision-note.json';assert not dest.exists()
data=original.read_bytes();old=json.loads(data)
def git(*args):return subprocess.run(['git',*args],cwd=root,capture_output=True,check=True).stdout
assert git('branch','--show-current').strip()==b'audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip()
record={'clarifiedUtc':datetime.datetime.now(datetime.UTC).isoformat(),
 'originalRecord':original.relative_to(root).as_posix(),'originalSha256':hashlib.sha256(data).hexdigest(),
 'originalObservedBoundaryUtcWasApproximateUnverified':old['observedBoundaryUtc'],
 'actualRecordedUtc':old['recordedUtc'],'observationOccurredNoLaterThanUtc':old['recordedUtc'],
 'exactNativeCaptureTimeKnown':False,'useOriginalRecordingTimeAsUpperBound':True,
 'windowDraftAndNoMessageFactsUnchanged':True,'originalPreserved':True,'nativeInputs':0,'productionOperations':0}
dest.write_bytes((json.dumps(record,indent=2)+'\n').encode())
lead='''## 2026-10-14 #214 native record time precision clarified

The prior native-readonly record's 05:13:00 boundary time was an unverified minute estimate. Exact capture time is unavailable; the actual record was written at05:12:50.422128UTC, so the native observation occurred no later than that. Use that actual recording time as the upper bound. Original record preserved unchanged; `issue214-corrected-push-native-readonly/native-time-precision-note.json` clarifies only timing. Actual returnedwindow5311708/centreHUMANdraftpreserved/rightcomposerEMPTY/zero typing-navigation-message facts remain. New automatic CI38515104824 exactPR8d564c24 is ACTIVE; no final audit request yet, then209. All owner/production/history guards hold.

'''
readmes=['WP/audit-release-eb6de2e8/README.md','WP/runtime-recovery-kobo/README.md']
for p in readmes:
 f=root/p;f.write_bytes(lead.encode()+f.read_bytes())
owned=readmes+[Path(__file__).relative_to(root).as_posix(),dest.relative_to(root).as_posix()]
pins={p:hashlib.sha256((root/p).read_bytes()).hexdigest() for p in owned if p not in readmes}
git('add','--',*owned);assert set(git('diff','--cached','--name-only').decode().splitlines())<=set(owned)
git('commit','-m','audit(214): clarify native observation time without overwriting original')
head=git('rev-parse','HEAD').decode().strip()
for p,digest in pins.items():assert hashlib.sha256(git('show',head+':'+p)).hexdigest()==digest,p
assert original.read_bytes()==data and git('show',head+':'+original.relative_to(root).as_posix())==data
git('push','origin','HEAD:refs/heads/audit/release-eb6de2e8')
assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head
print(json.dumps({'auditHead':head,'actualRecordedUtc':old['recordedUtc'],'originalPreserved':True,'verifiedBlobs':len(pins)}))
